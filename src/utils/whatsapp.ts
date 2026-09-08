import { Order } from '../types';

/**
 * Normalizes customer phone number for international WhatsApp wa.me API
 * Converts local Pakistani format (e.g., 03001234567, 3001234567) to international (923001234567)
 */
export function extractAndNormalizePhone(rawPhone?: string): string | null {
  if (!rawPhone) return null;
  // Strip non-digits
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits || digits.length < 7) return null;

  // 03XXXXXXXXX (11 digits) -> 923XXXXXXXXX
  if (digits.startsWith('0') && digits.length === 11) {
    digits = '92' + digits.slice(1);
  } else if (digits.length === 10 && digits.startsWith('3')) {
    // 3XXXXXXXXX -> 923XXXXXXXXX
    digits = '92' + digits;
  } else if (digits.startsWith('0092')) {
    // 00923XXXXXXXXX -> 923XXXXXXXXX
    digits = digits.slice(2);
  }

  return digits;
}

/**
 * Extracts accurate customer phone number from order hierarchy
 */
export function getOrderCustomerPhone(order: Order): string | null {
  const candidate =
    order.customer?.phone ||
    (order as any).customerPhone ||
    (order as any).phone ||
    (order as any).contactPhone ||
    '';
  return extractAndNormalizePhone(candidate);
}

export interface WhatsAppDispatchResult {
  url: string;
  phone: string | null;
  rawPhone: string;
  message: string;
  statusLabel: string;
}

/**
 * Generates accurate status-based WhatsApp API dispatch payload and wa.me URL
 * with detailed item names, item prices, and complete subtotal/tax/delivery breakdown.
 */
export function getWhatsAppDispatchData(order: Order): WhatsAppDispatchResult {
  const rawPhone =
    order.customer?.phone ||
    (order as any).customerPhone ||
    (order as any).phone ||
    (order as any).contactPhone ||
    '';
  const phone = extractAndNormalizePhone(rawPhone);

  const customerName = order.customer?.name?.trim() || 'Valued Customer';
  const orderNumber = order.orderNumber || order.id?.slice(-4) || 'Order';
  const branchName = order.branchName || order.outlet || 'Master POS';
  const address = order.customer?.address || order.deliveryAddress || 'Customer Address';
  const total = order.total || order.subtotal || 0;

  const isPaid = order.paymentStatus?.toUpperCase() === 'PAID';
  const paymentStatusText = isPaid
    ? `PAID via ${(order.paymentMethod || 'Online').toUpperCase()}`
    : 'Cash on Delivery (COD)';

  // Detailed items with individual unit price and line totals
  const itemsDetailedList =
    order.items && order.items.length > 0
      ? order.items
          .map((item) => {
            const qty = item.quantity || 1;
            const unitPrice = item.price || 0;
            const lineTotal = qty * unitPrice;
            const details = item.flavor ? ` [${item.flavor}]` : '';
            return `• ${qty}x *${item.name}*${details} @ PKR ${unitPrice.toLocaleString()} = *PKR ${lineTotal.toLocaleString()}*`;
          })
          .join('\n')
      : '• 1x *Master POS Special Order*';

  // Calculate clean subtotal
  const computedSubtotal =
    order.subtotal ||
    (order.items && order.items.length > 0
      ? order.items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0)
      : total);

  // Financial breakdown including subtotal, delivery fee, discount, tax, and grand total
  const financialBreakdown = [
    `*Subtotal:* PKR ${computedSubtotal.toLocaleString()}`,
    order.deliveryFee ? `*Delivery Fee:* PKR ${order.deliveryFee.toLocaleString()}` : '',
    order.discount ? `*Discount:* -PKR ${order.discount.toLocaleString()}` : '',
    order.tax ? `*Tax (GST):* PKR ${order.tax.toLocaleString()}` : '',
    `*Grand Total (${paymentStatusText}):* PKR ${total.toLocaleString()}`,
  ]
    .filter(Boolean)
    .join('\n');

  const riderName = order.riderName || order.deliveryDriver || 'Fleet Dispatch Rider';
  const riderPhone = order.riderPhone ? order.riderPhone : 'Available upon arrival';
  const riderVehicle = order.riderVehicle ? order.riderVehicle : 'Motorbike';

  const status = (order.status || '').toLowerCase();
  let statusLabel = 'Order Update';
  let rawMessage = '';

  if (status === 'dispatched' || status === 'out_for_delivery') {
    statusLabel = 'Out for Delivery';
    rawMessage = `🛵💨 *MASTER POS - OUT FOR DELIVERY!*\n━━━━━━━━━━━━━━━━━━━━\nDear *${customerName}*,\nYour order *#${orderNumber}* is now out for delivery!\n\n👤 *Rider:* ${riderName}\n📞 *Rider Contact:* ${riderPhone}\n🛵 *Vehicle:* ${riderVehicle}\n\n📋 *Order Items:*\n${itemsDetailedList}\n\n💵 *Billing Breakdown:*\n${financialBreakdown}\n\n📍 *Delivering To:* ${address}\n\n_Please keep the exact amount ready for Cash on Delivery. Enjoy your meal!_ 🍔✨\n_Master POS Delivery Fleet_`;
  } else if (status === 'in_kitchen' || status === 'preparing') {
    statusLabel = 'In Kitchen Preparation';
    rawMessage = `👨‍🍳🔥 *MASTER POS - IN KITCHEN*\n━━━━━━━━━━━━━━━━━━━━\nDear *${customerName}*,\nYour order *#${orderNumber}* is being freshly prepared in our kitchen!\n\n📋 *Order Items:*\n${itemsDetailedList}\n\n💵 *Billing Breakdown:*\n${financialBreakdown}\n\n⏱️ *Est. Prep Time:* 15-20 mins\n📍 *Delivering To:* ${address}\n\n_We will notify you the moment your rider is on the road!_ 🛵\n_Master POS Kitchen Team_`;
  } else if (status === 'ready') {
    statusLabel = 'Packed & Ready';
    rawMessage = `📦 *MASTER POS - PACKED & READY*\n━━━━━━━━━━━━━━━━━━━━\nDear *${customerName}*,\nYour order *#${orderNumber}* is freshly packed and ready for rider dispatch!\n\n📋 *Order Items:*\n${itemsDetailedList}\n\n💵 *Billing Breakdown:*\n${financialBreakdown}\n\n📍 *Delivery Address:* ${address}\n\n_Our fleet rider is picking it up for instant delivery._ 🚀\n_Master POS Express_`;
  } else if (status === 'delivered' || status === 'completed') {
    statusLabel = 'Delivered';
    rawMessage = `🎉 *MASTER POS - ORDER DELIVERED!*\n━━━━━━━━━━━━━━━━━━━━\nDear *${customerName}*,\nYour order *#${orderNumber}* has been successfully delivered! 🍽️\n\n📋 *Items Delivered:*\n${itemsDetailedList}\n\n💵 *Paid Summary:*\n${financialBreakdown}\n\nThank you for dining with Master POS. We hope you loved your meal!\n⭐ _Have feedback or loved your food? Let us know!_\n_Master POS Customer Care_`;
  } else if (status === 'cancelled') {
    statusLabel = 'Cancelled';
    const cancelReasonText =
      order.cancelReason ||
      (order as any).cancellationReason ||
      order.refundReason ||
      (order.notes && order.notes.includes('[CANCELLED]:')
        ? order.notes.split('[CANCELLED]:')[1]?.split('|')[0]?.trim()
        : order.notes) ||
      'Customer change of mind';

    rawMessage = `❌ *MASTER POS - ORDER CANCELLED*\n━━━━━━━━━━━━━━━━━━━━\nDear *${customerName}*,\nYour order *#${orderNumber}* has been cancelled.\n\n📌 *Cancellation Reason:* ${cancelReasonText}\n\n📋 *Cancelled Items:*\n${itemsDetailedList}\n\n💵 *Order Subtotal:* PKR ${computedSubtotal.toLocaleString()}\n💵 *Order Total:* PKR ${total.toLocaleString()}\n\nIf you have any questions or need assistance, please reply to this chat or call us.\n📞 *Helpdesk:* 042-111-WHITES\n\n_Master POS Customer Support_`;
  } else {
    // Pending / Open / Punched
    statusLabel = 'Order Confirmed';
    rawMessage = `🍔 *MASTER POS - ORDER CONFIRMED*\n━━━━━━━━━━━━━━━━━━━━\nDear *${customerName}*,\nYour order *#${orderNumber}* has been received & confirmed! 📋\n\n📋 *Order Items & Prices:*\n${itemsDetailedList}\n\n💵 *Billing Breakdown:*\n${financialBreakdown}\n\n📍 *Delivery Address:* ${address}\n🏢 *Branch:* ${branchName}\n\n⏳ _Our kitchen team is getting ready to prepare your meal freshly!_\n_Master POS Express_`;
  }

  const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(rawMessage)}` : '';

  return {
    url,
    phone,
    rawPhone,
    message: rawMessage,
    statusLabel,
  };
}
