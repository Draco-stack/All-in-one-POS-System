const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `// Reduce inventory strictly in transaction`;
code = code.replace(target, `// Reduce inventory strictly in transaction\n    console.log('[DEBUG-ORDER-CREATED]', order.id, 'shiftId:', order.shiftId);`);

fs.writeFileSync('server.ts', code);
