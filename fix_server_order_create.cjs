const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

let startIndex = code.indexOf(`app.post('/api/orders'`);
if (startIndex === -1) throw new Error("Could not find app.post('/api/orders'");

// Find the line with idempotencyKey
let idemIndex = code.indexOf(`const idempotencyKey = (req.headers['idempotency-key'] as string) || clientOrderNum;`, startIndex);
if (idemIndex !== -1) {
    code = code.replace(`const idempotencyKey = (req.headers['idempotency-key'] as string) || clientOrderNum;`, `const idempotencyKey = (req.headers['idempotency-key'] as string);`);
}

// Find orderNumber: String(idempotencyKey)
let orderNumIndex = code.indexOf(`orderNumber: String(idempotencyKey),`, startIndex);
if (orderNumIndex !== -1) {
    code = code.replace(`orderNumber: String(idempotencyKey),`, `idempotencyKey: String(idempotencyKey),`);
}

// Find data: { organizationId: tenant.organizationId, branchId: tenant.branchId, orderNumber: clientOrderNum,
let dataIndex = code.indexOf(`orderNumber: clientOrderNum,`, startIndex);
if (dataIndex !== -1) {
    code = code.replace(`orderNumber: clientOrderNum,`, `orderNumber: 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase(),\n        idempotencyKey: idempotencyKey || null,\n        shiftId: req.body.shiftId || null,`);
}

fs.writeFileSync('server.ts', code);
console.log("Successfully updated server.ts");
