import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import prisma from './src/server/prisma';
import { seedDatabaseIfNeeded } from './src/server/seed';
import {
  addUser,
  deleteUser,
  addMenuItem,
  deleteMenuItem,
} from './src/server/controllers/adminController';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// User Management (Admin RBAC)
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        pin: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(users);
  } catch (error) {
    console.error('[Prisma] Get users error:', error);
    return res.status(500).json({ error: 'Failed to retrieve users' });
  }
});
app.post('/api/users', addUser);
app.delete('/api/users/:id', deleteUser);

// Outlets / Branches Management
app.get('/api/outlets', async (req, res) => {
  try {
    const outlets = await prisma.outlet.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(outlets.map(o => o.name));
  } catch (error) {
    console.error('[Prisma] Get outlets error:', error);
    return res.json(['Gulberg Branch', 'DHA Phase 5', 'F-7 Islamabad', 'Mall of Lahore']);
  }
});

app.post('/api/outlets', async (req, res) => {
  try {
    const { name, address, phone } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Outlet name is required' });
    }
    const created = await prisma.outlet.create({
      data: {
        name: name.trim(),
        address: address || '',
        phone: phone || '',
        active: true,
      },
    });
    return res.json({ success: true, outlet: created });
  } catch (error) {
    console.error('[Prisma] Create outlet error:', error);
    return res.status(500).json({ error: 'Failed to create outlet' });
  }
});

app.delete('/api/outlets/:name', async (req, res) => {
  try {
    const nameParam = decodeURIComponent(req.params.name);
    await prisma.outlet.deleteMany({
      where: {
        OR: [
          { name: nameParam },
          { id: nameParam },
        ],
      },
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('[Prisma] Delete outlet error:', error);
    return res.status(500).json({ error: 'Failed to delete outlet' });
  }
});

// Menu Catalog Management
app.post('/api/menu-items', addMenuItem);
app.delete('/api/menu-items/:id', deleteMenuItem);
app.delete('/api/menu-items/:itemId', deleteMenuItem);

// Get active menu items
app.get('/api/menu', async (req, res) => {
  try {
    const items = await prisma.menuItem.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(items);
  } catch (error) {
    console.error('[Prisma] Get menu error:', error);
    return res.json([]);
  }
});

// Get all customers
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json(customers);
  } catch (error) {
    console.error('[Prisma] Get customers error:', error);
    return res.json([]);
  }
});

// Customer Phone Lookup by route param
app.get('/api/customers/:phone', async (req, res) => {
  try {
    const phone = String(req.params.phone || '').trim();
    if (!phone) return res.json({ found: false });

    const clean = phone.replace(/\D/g, '');
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone: clean },
          { phoneNumber: clean },
          { phone: phone },
        ],
      },
      include: {
        orders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        },
      },
    });

    if (customer) {
      return res.json({
        found: true,
        customer,
        pastOrders: customer.orders,
      });
    }

    return res.json({ found: false });
  } catch (err) {
    console.error('Customer route lookup error:', err);
    return res.json({ found: false });
  }
});

// Customer Phone Lookup
app.get('/api/customers/lookup', async (req, res) => {
  try {
    const phone = String(req.query.phone || '').trim();
    if (!phone) return res.json({ found: false });

    const clean = phone.replace(/\D/g, '');
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone: clean },
          { phoneNumber: clean },
          { phone: phone },
        ],
      },
      include: {
        orders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        },
      },
    });

    if (customer) {
      return res.json({
        found: true,
        customer,
        pastOrders: customer.orders,
      });
    }

    return res.json({ found: false });
  } catch (err) {
    console.error('Customer lookup error:', err);
    return res.json({ found: false });
  }
});

// Customer Upsert
app.post('/api/customers/upsert', async (req, res) => {
  try {
    const { name, phone, email, address, deliveryNotes, notes } = req.body;
    const cleanPhone = String(phone || '').trim().replace(/\D/g, '');

    const existing = await prisma.customer.findFirst({
      where: {
        OR: [{ phone: cleanPhone }, { phoneNumber: cleanPhone }, { phone: phone }],
      },
    });

    if (existing) {
      const updated = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: name || existing.name,
          email: email || existing.email,
          address: address || existing.address,
          deliveryNotes: deliveryNotes || notes || existing.deliveryNotes,
          notes: notes || existing.notes,
        },
      });
      return res.json({ customer: updated });
    }

    const created = await prisma.customer.create({
      data: {
        name: name || 'Customer',
        phone: cleanPhone || phone,
        phoneNumber: cleanPhone || phone,
        email: email || '',
        address: address || '',
        deliveryNotes: deliveryNotes || notes || '',
        notes: notes || '',
        vipTier: 'BRONZE',
        loyaltyPoints: 50,
      },
    });

    return res.json({ customer: created });
  } catch (err) {
    console.error('Customer upsert error:', err);
    return res.status(500).json({ error: 'Failed to upsert customer' });
  }
});

// Get orders history
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        customer: true,
        items: true,
        auditLogs: true,
        assignedRider: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(orders.map(transformOrder));
  } catch (error) {
    console.error('[Prisma] Get orders error:', error);
    return res.json([]);
  }
});

// Create new order
app.post('/api/orders', async (req, res) => {
  try {
    const {
      orderNumber: clientOrderNum,
      orderType,
      type,
      items,
      customer,
      subtotal,
      tax,
      discount,
      tip,
      deliveryFee,
      total,
      cashierName,
      deliveryNotes,
      deliveryDriver,
      assignedRiderId,
      paymentMethod,
      preOrder,
      notes,
    } = req.body;

    const orderNumber = clientOrderNum || `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    let customerId: string | undefined = undefined;
    if (customer && customer.phone) {
      const cleanPhone = String(customer.phone).trim();
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          OR: [
            { phone: cleanPhone },
            { phoneNumber: cleanPhone },
          ],
        },
      });
      if (existingCustomer) {
        customerId = existingCustomer.id;
        await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: {
            totalVisits: existingCustomer.totalVisits + 1,
            totalSpent: existingCustomer.totalSpent + (total || 0),
            loyaltyPoints: existingCustomer.loyaltyPoints + Math.floor((total || 0) / 100),
          },
        });
      } else {
        const newCust = await prisma.customer.create({
          data: {
            name: customer.name || 'Guest',
            phone: cleanPhone,
            phoneNumber: cleanPhone,
            address: customer.address || '',
            deliveryNotes: customer.deliveryNotes || '',
            totalVisits: 1,
            totalSpent: total || 0,
            loyaltyPoints: Math.floor((total || 0) / 100),
          },
        });
        customerId = newCust.id;
      }
    }

    let resolvedDriverName = deliveryDriver;
    let resolvedRiderId = assignedRiderId;
    if (deliveryDriver && !assignedRiderId) {
      const matchedUser = await prisma.user.findFirst({
        where: { OR: [{ id: deliveryDriver }, { name: deliveryDriver }] },
      });
      if (matchedUser) {
        resolvedRiderId = matchedUser.id;
        resolvedDriverName = matchedUser.name;
      }
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        orderType: orderType || type || 'takeaway',
        status: 'PUNCHED',
        paymentMethod: (paymentMethod || 'cash').toUpperCase(),
        subtotal: subtotal || 0,
        tax: tax || 0,
        discount: discount || 0,
        tip: tip || 0,
        deliveryFee: deliveryFee || 0,
        total: total || 0,
        totalAmount: total || 0,
        cashierName: cashierName || 'Cashier',
        customerId,
        deliveryDriver: resolvedDriverName || undefined,
        assignedRiderId: resolvedRiderId || undefined,
        notes: notes || '',
        deliveryNotes: deliveryNotes || '',
        preOrder: !!preOrder,
        items: {
          create: (items || []).map((item: any) => ({
            menuItemId: item.menuItemId || (item.id && !item.id.startsWith('cart-') ? item.id : null),
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            flavor: item.flavor || '',
            itemNote: item.itemNote || '',
            notes: item.itemNote || '',
            modifiers: JSON.stringify(item.modifiers || []),
          })),
        },
      },
      include: {
        customer: true,
        items: true,
        assignedRider: true,
      },
    });

    return res.json(transformOrder(order));
  } catch (error) {
    console.error('[Prisma] Create order error:', error);
    return res.status(500).json({ error: 'Failed to create order' });
  }
});

// Update Order Status (e.g. PUNCHED -> in_kitchen -> ready -> dispatched -> completed)
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const { status, riderId } = req.body;
    const orderId = req.params.id;

    const existing = await prisma.order.findFirst({
      where: {
        OR: [{ id: orderId }, { orderNumber: orderId }],
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const dataToUpdate: any = { status };
    if (riderId) {
      const user = await prisma.user.findFirst({
        where: { OR: [{ id: riderId }, { username: riderId }, { name: riderId }] },
      });
      if (user) {
        dataToUpdate.assignedRiderId = user.id;
        dataToUpdate.deliveryDriver = user.name;
      } else {
        dataToUpdate.deliveryDriver = riderId;
      }
    }

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: dataToUpdate,
      include: {
        customer: true,
        items: true,
        assignedRider: true,
        auditLogs: true,
      },
    });
    return res.json({ success: true, order: transformOrder(updated) });
  } catch (err) {
    console.error('Update status error:', err);
    return res.status(500).json({ error: 'Failed to update status' });
  }
});

// Manager Cancel Order with Audit Log
app.post('/api/orders/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, managerId, managerName } = req.body;

    const existing = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
      },
      include: { items: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Order not found' });
    }

    let resolvedUserId: string | null = null;
    if (managerId) {
      const matchedUser = await prisma.user.findFirst({
        where: {
          OR: [{ id: managerId }, { username: managerId }, { name: managerId }],
        },
      });
      if (matchedUser) {
        resolvedUserId = matchedUser.id;
      }
    }

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: {
        status: 'cancelled',
        modifiedById: resolvedUserId,
        auditLogs: {
          create: {
            action: 'CANCELLED',
            reason: reason || 'Manager void/cancel override',
            performedById: resolvedUserId,
            managerName: managerName || 'Manager',
            previousData: JSON.stringify(existing),
            newData: JSON.stringify({ status: 'cancelled' }),
          },
        },
      },
      include: { items: true, auditLogs: true, customer: true, assignedRider: true },
    });

    return res.json({ success: true, order: transformOrder(updated) });
  } catch (err) {
    console.error('Cancel order error:', err);
    return res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// Manager Modify Order with Audit Log
app.post('/api/orders/:id/modify', async (req, res) => {
  try {
    const { id } = req.params;
    const { items, subtotal, tax, total, notes, reason, managerId, managerName } = req.body;

    const existing = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
      },
      include: { items: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Order not found' });
    }

    let resolvedUserId: string | null = null;
    if (managerId) {
      const matchedUser = await prisma.user.findFirst({
        where: {
          OR: [{ id: managerId }, { username: managerId }, { name: managerId }],
        },
      });
      if (matchedUser) {
        resolvedUserId = matchedUser.id;
      }
    }

    // Delete existing items and recreate updated items
    await prisma.orderItem.deleteMany({ where: { orderId: existing.id } });

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: {
        status: 'modified',
        subtotal: subtotal !== undefined ? subtotal : existing.subtotal,
        tax: tax !== undefined ? tax : existing.tax,
        total: total !== undefined ? total : existing.total,
        totalAmount: total !== undefined ? total : existing.totalAmount,
        notes: notes !== undefined ? notes : existing.notes,
        modifiedById: resolvedUserId,
        items: {
          create: (items || []).map((i: any) => ({
            menuItemId: i.menuItemId || null,
            name: i.name,
            price: Number(i.price) || 0,
            quantity: Number(i.quantity) || 1,
            flavor: i.flavor || '',
            itemNote: i.itemNote || '',
            notes: i.itemNote || '',
            modifiers: JSON.stringify(i.modifiers || []),
          })),
        },
        auditLogs: {
          create: {
            action: 'MODIFIED',
            reason: reason || 'Manager item update/quantity change',
            performedById: resolvedUserId,
            managerName: managerName || 'Manager',
            previousData: JSON.stringify(existing),
            newData: JSON.stringify({ subtotal, tax, total, items, notes }),
          },
        },
      },
      include: { items: true, auditLogs: true, customer: true, assignedRider: true },
    });

    return res.json({ success: true, order: transformOrder(updated) });
  } catch (err) {
    console.error('Modify order error:', err);
    return res.status(500).json({ error: 'Failed to modify order' });
  }
});

// Sales Adjustments & Manager Audit Log History
app.get('/api/sales-adjustments', async (req, res) => {
  try {
    const logs = await prisma.orderAuditLog.findMany({
      include: {
        order: {
          select: { orderNumber: true, total: true, subtotal: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const mapped = logs.map((log) => {
      let prevData: any = {};
      let nextData: any = {};
      try {
        if (log.previousData) prevData = JSON.parse(log.previousData);
        if (log.newData) nextData = JSON.parse(log.newData);
      } catch (e) {}

      const originalAmount = prevData.total ?? prevData.subtotal ?? (log.order?.total || 0);
      const newAmount = nextData.total ?? nextData.subtotal ?? (log.action === 'CANCELLED' ? 0 : originalAmount);
      const netDelta = newAmount - originalAmount;

      return {
        id: log.id,
        orderId: log.orderId,
        orderNumber: log.order?.orderNumber || log.orderId,
        type: log.action === 'CANCELLED' ? 'CANCELLATION' : 'MODIFICATION',
        authorizerName: log.managerName || 'Manager',
        authorizerRole: 'Manager',
        originalAmount,
        newAmount,
        netDelta: log.action === 'CANCELLED' ? -originalAmount : netDelta,
        itemsSummary: log.reason || `${log.action} override`,
        reason: log.reason || 'Manager administrative adjustment',
        timestamp: log.createdAt.toISOString(),
      };
    });

    return res.json(mapped);
  } catch (error) {
    console.error('[Prisma] Get sales adjustments error:', error);
    return res.json([]);
  }
});

// Shift Audit History
app.get('/api/shifts', async (req, res) => {
  try {
    const shifts = await prisma.shiftAudit.findMany({
      orderBy: { endTime: 'desc' },
      take: 100, // Limit to recent 100 shifts
    });
    return res.json(shifts);
  } catch (error) {
    console.error('[Prisma] Get shifts error:', error);
    return res.status(500).json({ error: 'Failed to retrieve shifts' });
  }
});

// Close Shift & Store Audit Record
app.post('/api/shifts/close', async (req, res) => {
  try {
    const {
      shiftId,
      userId,
      cashierName,
      startTime,
      endTime,
      startingPettyCash,
      totalSales,
      cashSales,
      cardSales,
      expectedCash,
      actualCash,
      shortageOverage,
      floatRetained,
      lockerDeposit,
      denominationBreakdown,
      notes,
    } = req.body;

    const shiftAudit = await prisma.shiftAudit.create({
      data: {
        shift: {
          connectOrCreate: {
            where: { shiftNumber: shiftId || `SH-${Date.now().toString().slice(-4)}` },
            create: {
              shiftNumber: shiftId || `SH-${Date.now().toString().slice(-4)}`,
              cashierName: cashierName || 'Cashier',
              startingFloat: startingPettyCash || 0,
              startingPettyCash: startingPettyCash || 0,
              totalSales: totalSales || 0,
              cashSales: cashSales || 0,
              cardSales: cardSales || 0,
              expectedCash: expectedCash || 0,
              actualCash: actualCash || 0,
              shortageOverage: shortageOverage || 0,
              floatRetained: floatRetained || 0,
              lockerDeposit: lockerDeposit || 0,
              status: 'closed',
              closedAt: new Date(),
            },
          },
        },
        cashierName: cashierName || 'Cashier',
        startTime: startTime ? new Date(startTime) : new Date(),
        endTime: endTime ? new Date(endTime) : new Date(),
        startingPettyCash: startingPettyCash || 0,
        totalSales: totalSales || 0,
        cashSales: cashSales || 0,
        cardSales: cardSales || 0,
        expectedCash: expectedCash || 0,
        actualCash: actualCash || 0,
        shortageOverage: shortageOverage || 0,
        floatRetained: floatRetained || 0,
        lockerDeposit: lockerDeposit || 0,
        denominationBreakdown: JSON.stringify(denominationBreakdown || {}),
        notes: notes || '',
        status: 'closed',
      },
    });

    // Also update the RegisterShift directly if we have the shiftId
    if (shiftId) {
      await prisma.registerShift.update({
        where: { shiftNumber: shiftId },
        data: {
          totalSales: totalSales || 0,
          cashSales: cashSales || 0,
          cardSales: cardSales || 0,
          expectedCash: expectedCash || 0,
          actualCash: actualCash || 0,
          shortageOverage: shortageOverage || 0,
          floatRetained: floatRetained || 0,
          lockerDeposit: lockerDeposit || 0,
          status: 'closed',
          closedAt: new Date(),
        }
      }).catch(() => {}); // Ignore if it doesn't exist
    }

    return res.json({ success: true, audit: shiftAudit });
  } catch (err) {
    console.error('Close shift error:', err);
    return res.status(500).json({ error: 'Failed to record shift audit' });
  }
});

async function startServer() {
  const PORT = 3000;

  await seedDatabaseIfNeeded();

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

export default app;

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

function transformOrder(o: any) {
  const rawStatus = (o.status || 'pending').toString().toLowerCase();
  let normalizedStatus = rawStatus;
  if (rawStatus === 'punched' || rawStatus === 'open') {
    normalizedStatus = 'pending';
  }

  return {
    id: o.id,
    orderNumber: o.orderNumber,
    receiptNumber: o.orderNumber,
    type: (o.orderType || o.type || 'dine_in').toString().toLowerCase(),
    orderType: (o.orderType || o.type || 'dine_in').toString().toLowerCase(),
    status: normalizedStatus,
    items: (o.items || []).map((i: any) => ({
      id: i.id,
      name: i.name,
      price: Number(i.price) || 0,
      quantity: Number(i.quantity) || 1,
      flavor: i.flavor || '',
      modifiers: i.modifiers ? (typeof i.modifiers === 'string' ? JSON.parse(i.modifiers) : i.modifiers) : (i.notes ? [{ name: i.notes }] : []),
      itemNote: i.itemNote || i.notes || '',
    })),
    customer: o.customer ? {
      id: o.customer.id,
      name: o.customer.name,
      phone: o.customer.phone || o.customer.phoneNumber || '',
      address: o.customer.address || '',
      deliveryNotes: o.customer.deliveryNotes || '',
      vipTier: o.customer.vipTier,
      loyaltyPoints: o.customer.loyaltyPoints,
    } : undefined,
    subtotal: Number(o.subtotal) || 0,
    tax: Number(o.tax) || 0,
    discount: Number(o.discount) || 0,
    tip: Number(o.tip) || 0,
    deliveryFee: Number(o.deliveryFee) || 0,
    total: Number(o.total) || 0,
    amountTendered: Number(o.total) || 0,
    changeGiven: 0,
    deliveryDriver: o.deliveryDriver || (o.assignedRider ? o.assignedRider.name : undefined),
    assignedRiderId: o.assignedRiderId || (o.assignedRider ? o.assignedRider.id : undefined),
    paymentMethod: (o.paymentMethod || 'cash').toString().toLowerCase(),
    paymentStatus: (o.paymentStatus || 'paid').toString().toLowerCase(),
    cashierName: o.cashierName ?? 'Cashier',
    deliveryNotes: o.deliveryNotes || '',
    preOrder: !!o.preOrder,
    notes: o.notes || '',
    cancelReason: o.auditLogs?.find((a: any) => a.action === 'CANCELLED')?.reason || o.notes || undefined,
    createdAt: o.createdAt ? (o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt)) : new Date().toISOString(),
    updatedAt: o.updatedAt ? (o.updatedAt instanceof Date ? o.updatedAt.toISOString() : String(o.updatedAt)) : undefined,
  };
}
