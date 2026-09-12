const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Update order creation logic
const oldLogic = `    const idempotencyKey = (req.headers['idempotency-key'] as string) || clientOrderNum;
    if (idempotencyKey) {
      const existingOrder = await prisma.order.findFirst({
        where: {
          organizationId: tenant.organizationId,
          orderNumber: String(idempotencyKey),
        },
        include: { customer: true, items: true, assignedRider: true, auditLogs: true },
      });`;

const newLogic = `    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (idempotencyKey) {
      const existingOrder = await prisma.order.findFirst({
        where: {
          organizationId: tenant.organizationId,
          idempotencyKey: String(idempotencyKey),
        },
        include: { customer: true, items: true, assignedRider: true, auditLogs: true },
      });`;

code = code.replace(oldLogic, newLogic);

const oldOrderCreate = `      data: {
        organizationId: tenant.organizationId,
        branchId: tenant.branchId,
        orderNumber: clientOrderNum,`;

// Wait, we need to generate a real orderNumber
const newOrderCreate = `      data: {
        organizationId: tenant.organizationId,
        branchId: tenant.branchId,
        orderNumber: 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase(), // simple secure-enough display id for now
        idempotencyKey: idempotencyKey || null,
        shiftId: req.body.shiftId || null,`;

code = code.replace(oldOrderCreate, newOrderCreate);

fs.writeFileSync('server.ts', code);
