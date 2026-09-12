const fs = require('fs');
let code = fs.readFileSync('tests/phase5FinancialIntegrity.test.ts', 'utf8');
code = code.replace(/console\.log\('Cash Sales:', shiftCloseRes\.body\.shift\.cashSales\); assert\(shiftCloseRes\.body\.shift\.cashSales === 25\.00, 'Tally cash sales \$25\.00'\);/, `assert(shiftCloseRes.body.shift.cashSales === 25.00, 'Tally cash sales $25.00');`);
code = code.replace(/console\.log\('Expected Cash:', shiftCloseRes\.body\.shift\.expectedCash\); assert\(shiftCloseRes\.body\.shift\.expectedCash === 125\.00, 'Expected cash \$125\.00'\);/, `assert(shiftCloseRes.body.shift.expectedCash === 125.00, 'Expected cash $125.00');`);
fs.writeFileSync('tests/phase5FinancialIntegrity.test.ts', code);
