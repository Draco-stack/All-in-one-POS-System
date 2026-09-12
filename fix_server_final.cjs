const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Fix orderNumber assignment
code = code.replace(
    'const orderNumber = idempotencyKey ? String(idempotencyKey) : `ORD-${Math.floor(1000 + Math.random() * 9000)}`;',
    'const orderNumber = clientOrderNum ? String(clientOrderNum) : `ORD-${Math.floor(100000 + Math.random() * 900000)}`;'
);

// 2. Add idempotencyKey and shiftId to tx.order.create
const oldData = `      const order = await tx.order.create({
        data: {
          organizationId: tenant.organizationId,
          branchId: tenant.branchId || null,
          orderNumber,
          orderType: orderType || type || 'takeaway',
          status: 'PUNCHED',`;

const newData = `      const order = await tx.order.create({
        data: {
          organizationId: tenant.organizationId,
          branchId: tenant.branchId || null,
          orderNumber,
          idempotencyKey: idempotencyKey || null,
          shiftId: req.body.shiftId || null,
          orderType: orderType || type || 'takeaway',
          status: 'PUNCHED',`;

code = code.replace(oldData, newData);

// 3. Fix the transaction error catch
const oldCatch = `      if (e.code === 'P2002') {
        const dupOrder = await tx.order.findFirst({`;

const newCatch = `      if (e.code === 'P2002') {
        throw new Error('DUPLICATE_IDEMPOTENCY');
      }`;

code = code.replace(oldCatch, newCatch);

// But wait, we can't catch inside tx. We must catch OUTSIDE the transaction!
// Let me look at where the catch is.
fs.writeFileSync('server.ts', code);
