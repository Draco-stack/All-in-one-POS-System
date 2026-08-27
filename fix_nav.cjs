const fs = require('fs');
let code = fs.readFileSync('src/components/Navigation.tsx', 'utf8');

code = code.replace(/currentUser\.name/g, "(currentUser?.name || 'User')");
code = code.replace(/currentUser\.role/g, "(currentUser?.role || 'Staff')");

fs.writeFileSync('src/components/Navigation.tsx', code);
