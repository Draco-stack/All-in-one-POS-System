const fs = require('fs');

let ctx = fs.readFileSync('src/context/RestaurantContext.tsx', 'utf8');

if (!ctx.includes("import { v4 as uuidv4 } from 'uuid';")) {
  ctx = "import { v4 as uuidv4 } from 'uuid';\n" + ctx;
}

ctx = ctx.replace(/const orderSeq = 100 \+ orders\.length \+ 1;\n\s*const orderNumber = `ORD-\$\{orderSeq\}`;\n/, `const idempotencyKey = uuidv4();\n    const orderSeq = 100 + orders.length + 1;\n    const orderNumber = \`ORD-\${orderSeq}\`;\n`);

ctx = ctx.replace(/body: JSON\.stringify\(newOrder\),/, "body: JSON.stringify({...newOrder, shiftId: currentShift?.id}),\n        headers: {\n          'idempotency-key': idempotencyKey,\n          'Content-Type': 'application/json',\n          'Authorization': `Bearer ${token}`\n        },");

ctx = ctx.replace(/headers: \{\n\s*'Content-Type': 'application\/json',\n\s*'Authorization': `Bearer \$\{token\}`\n\s*\},/, "");

fs.writeFileSync('src/context/RestaurantContext.tsx', ctx);
