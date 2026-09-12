const fs = require('fs');

let ctx = fs.readFileSync('src/context/RestaurantContext.tsx', 'utf8');
ctx = ctx.replace(/const socket = io\(\{/, `const token = localStorage.getItem('pos_token') || sessionStorage.getItem('pos_token') || '';\n    const socket = io({\n      auth: { token },`);
fs.writeFileSync('src/context/RestaurantContext.tsx', ctx);

let orders = fs.readFileSync('src/components/orders/AllOrdersSearchView.tsx', 'utf8');
orders = orders.replace(/const socket = io\(\);/, `const token = localStorage.getItem('pos_token') || sessionStorage.getItem('pos_token') || '';\n    const socket = io({ auth: { token } });`);
fs.writeFileSync('src/components/orders/AllOrdersSearchView.tsx', orders);
