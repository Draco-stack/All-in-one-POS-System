const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `console.log('[DEBUG] Shift orders for', shift.id, 'count:', shiftOrders.length, 'Data:', JSON.stringify(shiftOrders));`;
code = code.replace(target, `console.log('[DEBUG] Shift orders for', shift.id, 'count:', shiftOrders.length);
    const allOrdersInOrg = await prisma.order.findMany({ where: { organizationId: tenant.organizationId }});
    console.log('[DEBUG] ALL orders in org:', allOrdersInOrg.map(o => ({ id: o.id, shiftId: o.shiftId, status: o.status })));`);

fs.writeFileSync('server.ts', code);
