const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `const idempotencyKey = (req.headers['idempotency-key'] as string);`;
code = code.replace(target, `const idempotencyKey = (req.headers['idempotency-key'] as string);\n    console.log('[DEBUG-CREATE] req.body.shiftId:', req.body.shiftId);`);

fs.writeFileSync('server.ts', code);
