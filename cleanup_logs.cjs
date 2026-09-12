const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/console\.log\('\[DEBUG-CREATE\] req\.body\.shiftId:', req\.body\.shiftId\);\n/g, '');
code = code.replace(/console\.log\('\[DEBUG\] Shift orders for', shift\.id, 'count:', shiftOrders\.length\);\n/g, '');
code = code.replace(/const allOrdersInOrg = await prisma\.order\.findMany\(\{ where: \{ organizationId: tenant\.organizationId \}\}\);\n/g, '');
code = code.replace(/console\.log\('\[DEBUG\] ALL orders in org:', allOrdersInOrg\.map\(o => \(\{ id: o\.id, shiftId: o\.shiftId, status: o\.status \}\)\)\);\n/g, '');

fs.writeFileSync('server.ts', code);
