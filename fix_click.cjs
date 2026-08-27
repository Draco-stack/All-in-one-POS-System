const fs = require('fs');
let code = fs.readFileSync('src/components/pos/POSWorkstation.tsx', 'utf8');
code = code.replace(/handleMenuItemClick\(item\)/g, 'handleItemClick(item)');
fs.writeFileSync('src/components/pos/POSWorkstation.tsx', code);
