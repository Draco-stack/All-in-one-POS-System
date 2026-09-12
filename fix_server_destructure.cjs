const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldDestructure = `    const {
      orderNumber: 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        idempotencyKey: idempotencyKey || null,
        shiftId: req.body.shiftId || null,`;

const newDestructure = `    const {
      orderNumber: clientOrderNum,`;

code = code.replace(oldDestructure, newDestructure);

// Now put it in data:
const oldData = `      data: {
        organizationId: tenant.organizationId,
        branchId: tenant.branchId,
        orderType: String(type || orderType || 'takeaway'),`;

const newData = `      data: {
        organizationId: tenant.organizationId,
        branchId: tenant.branchId,
        orderNumber: clientOrderNum || ('ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase()),
        idempotencyKey: idempotencyKey || null,
        shiftId: req.body.shiftId || null,
        orderType: String(type || orderType || 'takeaway'),`;

code = code.replace(oldData, newData);

fs.writeFileSync('server.ts', code);
