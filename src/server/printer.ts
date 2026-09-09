import * as net from 'net';

export interface ThermalPrinterConfig {
  ip: string;
  port?: number;
  timeoutMs?: number;
}

/**
 * Sends an ESC/POS text payload and paper cut command to a network thermal printer over raw TCP/IP.
 */
export async function printReceipt(
  printerIp: string,
  printerPort: number = 9100,
  receiptData: string,
  timeoutMs: number = 4000
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!printerIp) {
      console.warn('[Printer] No printer IP specified, skipping network print.');
      return resolve(false);
    }

    const client = new net.Socket();
    let isFinished = false;

    const cleanup = (success: boolean) => {
      if (isFinished) return;
      isFinished = true;
      try {
        client.destroy();
      } catch {}
      resolve(success);
    };

    client.setTimeout(timeoutMs);

    client.on('timeout', () => {
      console.error(`[Printer Timeout] Connection timed out after ${timeoutMs}ms for ${printerIp}:${printerPort}`);
      cleanup(false);
    });

    client.on('error', (err) => {
      console.error(`[Printer Error] Socket connection failed to ${printerIp}:${printerPort}:`, err.message);
      cleanup(false);
    });

    client.connect(printerPort, printerIp, () => {
      // Standard ESC/POS commands
      const ESC = '\x1B';
      const GS = '\x1D';
      const INIT = `${ESC}@`;          // Initialize printer
      const ALIGN_LEFT = `${ESC}a\x00`; // Left align
      const CUT = `${GS}V\x00`;        // Full cut paper

      const payload = INIT + ALIGN_LEFT + receiptData + '\n\n\n\n' + CUT;

      client.write(payload, 'utf-8', () => {
        client.end(() => {
          console.log(`[Printer] Successfully dispatched receipt ticket to ${printerIp}:${printerPort}`);
          cleanup(true);
        });
      });
    });
  });
}

/**
 * Triggers the 24V or 12V pulse to kick open the connected cash drawer via ESC/POS command.
 * Command: ESC p m t1 t2 (ESC p 0 25 250)
 */
export async function openCashDrawer(
  printerIp: string,
  printerPort: number = 9100,
  timeoutMs: number = 3000
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!printerIp) {
      return resolve(false);
    }

    const client = new net.Socket();
    let isFinished = false;

    const cleanup = (success: boolean) => {
      if (isFinished) return;
      isFinished = true;
      try {
        client.destroy();
      } catch {}
      resolve(success);
    };

    client.setTimeout(timeoutMs);

    client.on('timeout', () => cleanup(false));
    client.on('error', (err) => {
      console.error('[Printer Drawer Kick Error]:', err.message);
      cleanup(false);
    });

    client.connect(printerPort, printerIp, () => {
      // ESC p 0 25 250: pulse pin 2 for 50ms
      const DRAWER_KICK = '\x1Bp\x00\x19\xFA';
      client.write(DRAWER_KICK, () => {
        client.end(() => {
          console.log(`[Printer] Cash drawer kick pulse sent to ${printerIp}:${printerPort}`);
          cleanup(true);
        });
      });
    });
  });
}

/**
 * Generates an ESC/POS formatted receipt layout from an Order record.
 */
export function formatReceiptEscPos(order: any, restaurantName: string = 'COMMERCIAL POS'): string {
  const line = '------------------------------------------------';
  const shortLine = '================================================';
  const orderNum = order.orderNumber || order.receiptNumber || 'N/A';
  const dateStr = new Date(order.createdAt || Date.now()).toLocaleString();
  const orderType = (order.orderType || order.type || 'DINE_IN').toUpperCase();
  const cashier = order.cashierName || 'Cashier';

  const rows: string[] = [
    `\x1B\x61\x01`, // Center
    `\x1B\x45\x01${restaurantName}\x1B\x45\x00`, // Bold Header
    `Point of Sale & Kitchen Slip`,
    `Order #${orderNum} [${orderType}]`,
    dateStr,
    `Cashier: ${cashier}`,
    `\x1B\x61\x00`, // Left
    line,
    `ITEM                            QTY        PRICE`,
    line,
  ];

  if (Array.isArray(order.items)) {
    for (const item of order.items) {
      const name = (item.name || 'Item').padEnd(30, ' ').slice(0, 30);
      const qty = String(item.quantity || 1).padStart(4, ' ');
      const price = Number(item.price || 0) * (item.quantity || 1);
      const priceStr = `PKR ${price.toLocaleString()}`.padStart(12, ' ');
      rows.push(`${name} ${qty} ${priceStr}`);

      if (item.flavor) {
        rows.push(`  + Flavor: ${item.flavor}`);
      }
      if (item.customization) {
        rows.push(`  + ${item.customization}`);
      }
      if (item.itemNote) {
        rows.push(`  * Note: ${item.itemNote}`);
      }
    }
  }

  rows.push(line);
  const subtotal = Number(order.subtotal ?? order.total ?? 0);
  const tax = Number(order.tax ?? 0);
  const discount = Number(order.discount ?? 0);
  const total = Number(order.total ?? 0);

  rows.push(`Subtotal:                        PKR ${subtotal.toLocaleString()}`.padStart(48, ' '));
  if (tax > 0) rows.push(`Tax:                             PKR ${tax.toLocaleString()}`.padStart(48, ' '));
  if (discount > 0) rows.push(`Discount:                       -PKR ${discount.toLocaleString()}`.padStart(48, ' '));
  rows.push(shortLine);
  rows.push(`\x1B\x45\x01TOTAL DUE:                      PKR ${total.toLocaleString()}\x1B\x45\x00`.padStart(54, ' '));

  if (order.splitPayments && Array.isArray(order.splitPayments) && order.splitPayments.length > 0) {
    rows.push(line);
    rows.push(`Split Payments Tendered:`);
    for (const sp of order.splitPayments) {
      const method = (sp.method || 'CASH').toUpperCase();
      const amt = Number(sp.amount || 0);
      rows.push(`  - ${method}: PKR ${amt.toLocaleString()}`);
    }
  } else {
    rows.push(`Payment: ${(order.paymentMethod || 'CASH').toUpperCase()} [${(order.paymentStatus || 'PAID').toUpperCase()}]`);
  }

  if (order.customer && order.customer.name) {
    rows.push(line);
    rows.push(`Customer: ${order.customer.name} (${order.customer.phone || 'No phone'})`);
    if (order.customer.address) rows.push(`Address: ${order.customer.address}`);
  }

  rows.push(`\x1B\x61\x01`); // Center
  rows.push(`\nThank you for your business!`);

  return rows.join('\n');
}
