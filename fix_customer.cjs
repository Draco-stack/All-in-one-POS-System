const fs = require('fs');
let code = fs.readFileSync('src/components/pos/POSWorkstation.tsx', 'utf8');

code = code.replace(/o\.customer\.name/g, "o.customer?.name");
code = code.replace(/o\.customer\.phone/g, "o.customer?.phone");
code = code.replace(/order\.customer\.name/g, "order.customer?.name");
code = code.replace(/order\.customer\.phone/g, "order.customer?.phone");

fs.writeFileSync('src/components/pos/POSWorkstation.tsx', code);
