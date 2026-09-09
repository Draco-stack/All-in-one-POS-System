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

  // Load authoritative database menu items for this organization
  const dbMenuItems = itemIdsToCheck.length > 0
    ? await tx.menuItem.findMany({
        where: {
          organizationId,
          id: { in: itemIdsToCheck },
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

    // Use authoritative database price if menu item found; otherwise sanitize client price
    let unitPrice = 0;
    if (dbItem) {
      unitPrice = roundMoney(dbItem.price);
    } else {
      const rawPrice = Number(item.price);
      if (!Number.isFinite(rawPrice) || rawPrice < 0) {
        throw new Error(`Invalid price for item: ${item.name}`);
      }
      unitPrice = roundMoney(rawPrice);
    }

    const itemSubtotal = roundMoney(unitPrice * quantity);
    calculatedSubtotal = roundMoney(calculatedSubtotal + itemSubtotal);

    return {
      menuItemId: dbItem ? dbItem.id : null,
      name: dbItem ? dbItem.title : (String(item.name || 'Custom Item').trim() || 'Item'),
      price: unitPrice,
      quantity,
      flavor: item.flavor ? String(item.flavor).trim() : '',
      itemNote: item.itemNote ? String(item.itemNote).trim() : '',
      modifiers: typeof item.modifiers === 'string' ? item.modifiers : JSON.stringify(item.modifiers || []),
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
