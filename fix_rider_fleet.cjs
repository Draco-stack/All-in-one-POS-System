const fs = require('fs');
const file = './src/components/admin/AdminRidersFleet.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\\`/g, "`").replace(/\\\$/g, "$");
fs.writeFileSync(file, content, 'utf8');
