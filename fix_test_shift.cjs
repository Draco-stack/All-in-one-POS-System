const fs = require('fs');
let code = fs.readFileSync('tests/phase5FinancialIntegrity.test.ts', 'utf8');

const oldOrder = `    const ordShiftSales = await apiRequest('/api/orders', {
      method: 'POST',
      headers: headersA_Cashier,
      body: {
        orderNumber: \`P5-SHIFT-SALES-\${Date.now()}\`,
        items: [{ menuItemId: menuItemA1.id, name: 'Burger', price: 12.50, quantity: 2 }],
      },
    });`;

const newOrder = `    const ordShiftSales = await apiRequest('/api/orders', {
      method: 'POST',
      headers: headersA_Cashier,
      body: {
        orderNumber: \`P5-SHIFT-SALES-\${Date.now()}\`,
        shiftId: reconShiftId,
        items: [{ menuItemId: menuItemA1.id, name: 'Burger', price: 12.50, quantity: 2 }],
      },
    });`;

code = code.replace(oldOrder, newOrder);
fs.writeFileSync('tests/phase5FinancialIntegrity.test.ts', code);
