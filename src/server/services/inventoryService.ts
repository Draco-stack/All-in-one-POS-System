import prisma from '../prisma';

export function canonicalUnit(u: string): string {
  if (!u) return 'g';
  const clean = u.trim().toLowerCase();
  if (['kg', 'kilogram', 'kilograms'].includes(clean)) return 'kg';
  if (['g', 'gram', 'grams'].includes(clean)) return 'g';
  if (['mg', 'milligram', 'milligrams'].includes(clean)) return 'mg';
  if (['l', 'liter', 'liters'].includes(clean)) return 'l';
  if (['ml', 'milliliter', 'milliliters'].includes(clean)) return 'ml';
  if (['pc', 'pcs', 'piece', 'pieces'].includes(clean)) return 'pc';
  return clean;
}

export function convertUnit(quantity: number, fromUnit: string, toUnit: string): { quantity: number; success: boolean } {
  const from = canonicalUnit(fromUnit);
  const to = canonicalUnit(toUnit);

  if (from === to) {
    return { quantity, success: true };
  }

  // MASS conversions
  const massUnits: Record<string, number> = {
    'g': 1,
    'kg': 1000,
    'mg': 0.001
  };

  if (from in massUnits && to in massUnits) {
    const valInGrams = quantity * massUnits[from];
    const finalVal = valInGrams / massUnits[to];
    return { quantity: finalVal, success: true };
  }

  // VOLUME conversions
  const volumeUnits: Record<string, number> = {
    'ml': 1,
    'l': 1000
  };

  if (from in volumeUnits && to in volumeUnits) {
    const valInMl = quantity * volumeUnits[from];
    const finalVal = valInMl / volumeUnits[to];
    return { quantity: finalVal, success: true };
  }

  return { quantity, success: false };
}

/**
 * Consumes ingredients for a paid / completed POS order atomically.
 * Ensures strict idempotency and transaction safety.
 */
export async function consumeIngredientsForOrder(tx: any, orderId: string, organizationId: string): Promise<void> {
  // 1. Load order and check idempotency first
  const order = await tx.order.findFirst({
    where: { id: orderId, organizationId },
    include: { items: true },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found under tenant organization ${organizationId}`);
  }

  // Check if already consumed to ensure Exactly-Once processing
  // ATOMIC LOCK: Try to update inventoryConsumed to true
  const lockResult = await tx.order.updateMany({
    where: {
      id: orderId,
      organizationId,
      inventoryConsumed: false,
    },
    data: {
      inventoryConsumed: true,
    },
  });

  if (lockResult.count === 0) {
    console.log(`[InventorySync] Order ${orderId} already consumed. Skipping to guarantee idempotency.`);
    return;
  }

  // Accumulator for overall ingredient deductions to perform atomically
  const totalDeductions: Record<string, {
    quantity: number;
    recipeInfo: string;
    costBasis: number;
    unit: string;
  }> = {};

  for (const item of order.items) {
    if (!item.menuItemId) continue;

    const itemQuantity = Number(item.quantity || 1);

    // Resolve variant from item properties (flavor contains variant name or variant ID)
    let variantId: string | null = null;
    let variantName: string | null = null;

    if (item.flavor && item.flavor.trim()) {
      const dbVariant = await tx.menuItemVariant.findFirst({
        where: {
          menuItemId: item.menuItemId,
          OR: [
            { id: item.flavor.trim() },
            { name: { equals: item.flavor.trim(), mode: 'insensitive' } },
          ],
        },
      });
      if (dbVariant) {
        variantId = dbVariant.id;
        variantName = dbVariant.name;
      }
    }

    // A. Resolve Recipe Precedence
    // 1. Try Variant-specific Recipe
    let recipe = variantId
      ? await tx.recipe.findFirst({
          where: {
            organizationId,
            menuItemId: item.menuItemId,
            variantId,
            active: true,
            archived: false,
          },
          include: { items: { include: { ingredient: true } } },
        })
      : null;

    // 2. Fallback to base Recipe
    if (!recipe) {
      recipe = await tx.recipe.findFirst({
        where: {
          organizationId,
          menuItemId: item.menuItemId,
          variantId: null,
          modifierOptionId: null,
          active: true,
          archived: false,
        },
        include: { items: { include: { ingredient: true } } },
      });
    }

    // Process recipe items if found
    if (recipe) {
      for (const rItem of recipe.items) {
        const ing = rItem.ingredient;
        if (!ing || ing.archived) continue;

        // Convert recipe line unit to ingredient baseUnit
        const conversion = convertUnit(rItem.quantity, rItem.unit, ing.baseUnit);
        if (!conversion.success) {
          throw new Error(`Invalid unit conversion from recipe unit '${rItem.unit}' to ingredient baseUnit '${ing.baseUnit}' for recipe item in Recipe #${recipe.id}`);
        }

        const normalizedQty = conversion.quantity * itemQuantity;
        const ingId = ing.id;

        if (!totalDeductions[ingId]) {
          totalDeductions[ingId] = {
            quantity: 0,
            recipeInfo: `Recipe: ${recipe.name} (v${recipe.version})`,
            costBasis: ing.costPerBaseUnit || 0,
            unit: ing.baseUnit,
          };
        }
        totalDeductions[ingId].quantity += normalizedQty;
      }
    }

    // B. Resolve explicitly configured consuming modifiers
    let modifiersList: any[] = [];
    if (item.modifiers) {
      try {
        modifiersList = typeof item.modifiers === 'string' ? JSON.parse(item.modifiers) : item.modifiers;
      } catch (e) {
        console.error('[InventoryService] failed to parse modifiers:', e);
      }
    }

    for (const mod of modifiersList) {
      const modIdentifier = mod.id || mod.optionId;
      if (!modIdentifier) continue;

      // Find the modifier recipe configuration
      const modRecipe = await tx.recipe.findFirst({
        where: {
          organizationId,
          modifierOptionId: modIdentifier,
          active: true,
          archived: false,
        },
        include: { items: { include: { ingredient: true } } },
      });

      if (modRecipe) {
        for (const rItem of modRecipe.items) {
          const ing = rItem.ingredient;
          if (!ing || ing.archived) continue;

          const conversion = convertUnit(rItem.quantity, rItem.unit, ing.baseUnit);
          if (!conversion.success) {
            throw new Error(`Invalid unit conversion for modifier recipe item from ${rItem.unit} to ${ing.baseUnit}`);
          }

          const normalizedQty = conversion.quantity * itemQuantity;
          const ingId = ing.id;

          if (!totalDeductions[ingId]) {
            totalDeductions[ingId] = {
              quantity: 0,
              recipeInfo: `Modifier Recipe: ${modRecipe.name} (v${modRecipe.version})`,
              costBasis: ing.costPerBaseUnit || 0,
              unit: ing.baseUnit,
            };
          }
          totalDeductions[ingId].quantity += normalizedQty;
        }
      }
    }
  }

  // 3. Atomically apply deductions and write StockMovement ledger entries
  for (const [ingredientId, deduction] of Object.entries(totalDeductions)) {
    // Acquire a row lock or read fresh stock level in the transaction to prevent concurrent race conditions
    const ing = await tx.ingredient.findUnique({
      where: { id: ingredientId },
    });

    if (!ing) continue;

    const qtyDelta = deduction.quantity;

    // Update stock levels atomically to prevent lost updates
    const updatedIng = await tx.ingredient.update({
      where: { id: ingredientId },
      data: { currentStock: { decrement: qtyDelta } },
    });

    // Derive strictly consistent previous/new stock values from the atomic update result
    const newStock = Number(updatedIng.currentStock || 0);
    const prevStock = newStock + qtyDelta;

    // Create stock movement record
    await tx.stockMovement.create({
      data: {
        organizationId,
        branchId: order.branchId || ing.branchId,
        ingredientId,
        quantityDelta: -qtyDelta,
        unit: deduction.unit,
        previousStock: prevStock,
        newStock,
        costBasis: deduction.costBasis,
        movementType: 'SALE_CONSUMPTION',
        referenceType: 'ORDER',
        referenceId: order.id,
        reason: `POS sale consumption for Order #${order.orderNumber} (${deduction.recipeInfo})`,
        actorId: 'system_pos',
        actorName: 'Tillora POS Engine',
      },
    });
  }
}
