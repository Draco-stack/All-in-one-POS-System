const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldOrdersQuery = `    const shiftOrders = await prisma.order.findMany({
      where: {
        organizationId: tenant.organizationId,
        shiftId: shift.id,
        status: { notIn: ['CANCELLED', 'cancelled'] },
      },
      select: { paymentMethod: true, paymentStatus: true, total: true, splitPayments: true },
    });`;

const newOrdersQuery = `    const shiftOrders = await prisma.order.findMany({
      where: {
        organizationId: tenant.organizationId,
        shiftId: shift.id,
        status: { notIn: ['CANCELLED', 'cancelled'] },
      },
      select: { paymentMethod: true, paymentStatus: true, total: true, splitPayments: true },
    });
    console.log('[DEBUG] Shift orders for', shift.id, 'count:', shiftOrders.length, 'Data:', JSON.stringify(shiftOrders));`;

code = code.replace(oldOrdersQuery, newOrdersQuery);
fs.writeFileSync('server.ts', code);
