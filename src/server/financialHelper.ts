import { PrismaClient } from '@prisma/client';

/**
 * PHASE 5 FINANCIAL INTEGRITY HELPER
 * Ensures server-authoritative financial calculations, money precision,
 * order state machine validation, and idempotency scoping.
 */

// Rounding Policy: Standard 2 decimal places (minor units/cents) rounding
export function roundMoney(amount: number | null | undefined): number {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || Number.isNaN(amount)) {
    return 0;
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export const VALID_ORDER_STATUSES = [
  'PUNCHED',
  'PENDING',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
  'MODIFIED',
] as const;

/**
 * Centralized Server-Side Order State Machine Transition Validator
 */
export function isValidStatusTransition(
  currentStatus: string,
  targetStatus: string
): { allowed: boolean; reason?: string } {
  const curr = String(currentStatus || '').toUpperCase();
  const target = String(targetStatus || '').toUpperCase();

  if (curr === target) {
    return { allowed: true };
  }

  // Terminal states cannot be resurrected or converted arbitrarily
  if (curr === 'CANCELLED') {
    return { allowed: false, reason: 'Cannot modify or re-open a CANCELLED order.' };
  }
  if (curr === 'REFUNDED') {
    return { allowed: false, reason: 'Cannot modify or re-open a REFUNDED order.' };
  }

  // Completed orders can only transition to REFUNDED or CANCELLED (via manager refund/cancel)
  if (curr === 'COMPLETED' && target !== 'REFUNDED' && target !== 'CANCELLED') {
    return { allowed: false, reason: 'COMPLETED order can only transition to REFUNDED or CANCELLED.' };
  }

  return { allowed: true };
}

/**
 * Calculate Remaining Payable Balance on an Order
 */
export function calculateRemainingBalance(
  orderTotal: number,
  successfulPayments: number,
  validRefunds: number
): number {
  const safeTotal = roundMoney(orderTotal);
  const safePayments = roundMoney(successfulPayments);
  const safeRefunds = roundMoney(validRefunds);
  const remaining = roundMoney(safeTotal - safePayments + safeRefunds);
  return Math.max(0, remaining);
}

/**
 * Server-Authoritative Price & Order Totals Recalculation
 * Loads real database prices for all items belonging to the tenant,
 * enforces non-negative quantities and valid discounts, and calculates subtotal/total.
 */
export async function recalculateAuthoritativeOrderTotals(
  tx: any,
  organizationId: string,
  rawItems: any[],
  options: {
    tax?: number;
    discount?: number;
    deliveryFee?: number;
    tip?: number;
    taxRatePercentage?: number;
  } = {}
) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('Order must contain at least one item.');
  }

  const itemIdsToCheck = rawItems
    .map((i) => i.menuItemId || i.id)
    .filter((id): id is string => typeof id === 'string' && !!id && !id.startsWith('cart-'));

  // Load authoritative database menu items for this organization with variants and modifier groups
  const dbMenuItems = itemIdsToCheck.length > 0
    ? await tx.menuItem.findMany({
        where: {
          organizationId,
          id: { in: itemIdsToCheck },
        },
        include: {
          variants: true,
          modifierGroups: {
            include: {
              modifierGroup: {
                include: {
                  options: true,
                },
              },
            },
          },
        },
      })
    : [];

  const dbMenuMap = new Map<string, any>();
  for (const item of dbMenuItems) {
    dbMenuMap.set(item.id, item);
  }

  let calculatedSubtotal = 0;
  const processedItems = rawItems.map((item: any) => {
    const rawQty = Number(item.quantity);
    if (!Number.isFinite(rawQty) || rawQty <= 0) {
      throw new Error(`Invalid item quantity: ${item.quantity}`);
    }
    const quantity = Math.floor(rawQty);

    const targetId = item.menuItemId || (item.id && !item.id.startsWith('cart-') ? item.id : null);
    const dbItem = targetId ? dbMenuMap.get(targetId) : null;

    if (dbItem) {
      if (dbItem.archived) {
        throw new Error(`Item '${dbItem.title}' is archived and cannot be ordered.`);
      }
      if (dbItem.active === false) {
        throw new Error(`Item '${dbItem.title}' is inactive and cannot be ordered.`);
      }
    }

    // Determine Base Price & Variant
    let unitPrice = 0;
    let selectedVariant: any = null;

    if (dbItem) {
      unitPrice = roundMoney(dbItem.price);

      // Check for variant selection
      const variantIdentifier = item.variantId || item.variant || item.variantName;
      if (variantIdentifier && Array.isArray(dbItem.variants) && dbItem.variants.length > 0) {
        selectedVariant = dbItem.variants.find(
          (v: any) => v.id === variantIdentifier || v.name.toLowerCase() === String(variantIdentifier).toLowerCase()
        );
        if (selectedVariant) {
          unitPrice = roundMoney(selectedVariant.price);
        }
      }
    } else {
      const rawPrice = Number(item.price);
      if (!Number.isFinite(rawPrice) || rawPrice < 0) {
        throw new Error(`Invalid price for item: ${item.name}`);
      }
      unitPrice = roundMoney(rawPrice);
    }

    // Process Modifiers authoritatively and validate Modifier Group Rules
    let mods: any[] = [];
    if (typeof item.modifiers === 'string') {
      try { mods = JSON.parse(item.modifiers); } catch (e) {}
    } else if (Array.isArray(item.modifiers)) {
      mods = item.modifiers;
    }

    let modifierTotal = 0;
    const resolvedSnapshotModifiers: any[] = [];

    if (dbItem) {
      // Validate Modifier Groups if defined in database
      const attachedGroups = dbItem.modifierGroups || [];
      for (const mgLink of attachedGroups) {
        const group = mgLink.modifierGroup;
        if (!group || !group.active) continue;

        const groupOptions = group.options || [];
        // Count how many options from this group were selected by client
        const selectedGroupMods = mods.filter((m: any) => {
          return groupOptions.some(
            (opt: any) => opt.id === m.id || opt.id === m.optionId || opt.name.toLowerCase() === (m.name || '').toLowerCase()
          );
        });

        const selectedCount = selectedGroupMods.length;
        if (group.required && selectedCount < (group.minSelections || 1)) {
          throw new Error(`Missing required modifier selection for group '${group.name}'. Minimum required: ${group.minSelections || 1}`);
        }
        if (group.maxSelections > 0 && selectedCount > group.maxSelections) {
          throw new Error(`Too many selections for modifier group '${group.name}'. Maximum allowed: ${group.maxSelections}`);
        }
      }

      // Calculate authoritative modifier price additions
      for (const mod of mods) {
        let matchedOption: any = null;
        for (const mgLink of attachedGroups) {
          const groupOptions = mgLink.modifierGroup?.options || [];
          matchedOption = groupOptions.find(
            (o: any) => o.id === mod.id || o.id === mod.optionId || o.name.toLowerCase() === (mod.name || '').toLowerCase()
          );
          if (matchedOption) break;
        }

        if (matchedOption) {
          const modPrice = roundMoney(matchedOption.price);
          modifierTotal += modPrice;
          resolvedSnapshotModifiers.push({
            id: matchedOption.id,
            name: matchedOption.name,
            kitchenName: matchedOption.kitchenName || matchedOption.name,
            price: modPrice,
          });
        } else if (dbItem.options) {
          // Fallback to legacy JSON options
          let dbOptions: any[] = [];
          try { dbOptions = JSON.parse(dbItem.options); } catch (e) {}
          const dbMod = dbOptions.find((o: any) => o.name === mod.name);
          if (dbMod) {
            const modPrice = roundMoney(Number(dbMod.price) || 0);
            modifierTotal += modPrice;
            resolvedSnapshotModifiers.push({
              name: dbMod.name,
              price: modPrice,
            });
          }
        }
      }
    } else {
      // Custom item fallback: use client provided modifier prices
      for (const mod of mods) {
        const modPrice = roundMoney(Number(mod.price) || 0);
        modifierTotal += modPrice;
        resolvedSnapshotModifiers.push({
          name: mod.name || 'Modifier',
          price: modPrice,
        });
      }
    }

    unitPrice = roundMoney(unitPrice + modifierTotal);
    const itemSubtotal = roundMoney(unitPrice * quantity);
    calculatedSubtotal = roundMoney(calculatedSubtotal + itemSubtotal);

    const displayName = selectedVariant
      ? `${dbItem.title} (${selectedVariant.name})`
      : dbItem ? dbItem.title : (String(item.name || 'Custom Item').trim() || 'Item');

    return {
      menuItemId: dbItem ? dbItem.id : null,
      name: displayName,
      price: unitPrice,
      quantity,
      flavor: selectedVariant ? selectedVariant.name : (item.flavor ? String(item.flavor).trim() : ''),
      itemNote: item.itemNote ? String(item.itemNote).trim() : '',
      modifiers: JSON.stringify(resolvedSnapshotModifiers),
      kitchenStation: dbItem?.kitchenStation || 'Kitchen',
      kitchenName: dbItem?.kitchenName || dbItem?.title || item.name,
    };
  });

  const finalSubtotal = calculatedSubtotal;

  // Calculate tax server-side
  let finalTax = 0;
  if (options.taxRatePercentage && options.taxRatePercentage > 0) {
    finalTax = roundMoney(finalSubtotal * (options.taxRatePercentage / 100));
  } else {
    const rawTax = Number(options.tax);
    finalTax = Number.isFinite(rawTax) && rawTax >= 0 ? roundMoney(rawTax) : 0;
  }

  // Validate discount
  const rawDiscount = Number(options.discount);
  let finalDiscount = Number.isFinite(rawDiscount) && rawDiscount >= 0 ? roundMoney(rawDiscount) : 0;
  if (finalDiscount > finalSubtotal + finalTax) {
    // Cap discount at total subtotal + tax
    finalDiscount = roundMoney(finalSubtotal + finalTax);
  }

  const rawDeliveryFee = Number(options.deliveryFee);
  const finalDeliveryFee = Number.isFinite(rawDeliveryFee) && rawDeliveryFee >= 0 ? roundMoney(rawDeliveryFee) : 0;

  const rawTip = Number(options.tip);
  const finalTip = Number.isFinite(rawTip) && rawTip >= 0 ? roundMoney(rawTip) : 0;

  const finalTotal = roundMoney(finalSubtotal + finalTax + finalDeliveryFee + finalTip - finalDiscount);

  return {
    items: processedItems,
    subtotal: finalSubtotal,
    tax: finalTax,
    discount: finalDiscount,
    deliveryFee: finalDeliveryFee,
    tip: finalTip,
    total: Math.max(0, finalTotal),
  };
}
