const fs = require('fs');
const file = './src/components/admin/AdminReportsAnalytics.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /    \/\/ If current month has open shift sales, add to current month[\s\S]*?\} else if \(currentShift\) \{[\s\S]*?    \}/;

content = content.replace(regex, "");

fs.writeFileSync(file, content, 'utf8');
