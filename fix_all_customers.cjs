const fs = require('fs');

const files = [
  'src/components/pos/CustomerViewModal.tsx',
  'src/components/pos/ReceiptModal.tsx',
  'src/components/pos/BlinkOrdersModal.tsx',
  'src/components/pos/POSWorkstation.tsx',
  'src/components/tickets/ActiveTicketsView.tsx',
  'src/components/customers/CustomersLoyaltyView.tsx',
  'src/components/history/OrdersHistoryView.tsx',
  'src/context/RestaurantContext.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/order\.customer\.name/g, "order.customer?.name");
    code = code.replace(/order\.customer\.phone/g, "order.customer?.phone");
    code = code.replace(/o\.customer\.name/g, "o.customer?.name");
    code = code.replace(/o\.customer\.phone/g, "o.customer?.phone");
    code = code.replace(/refundModalOrder\.customer\.name/g, "refundModalOrder.customer?.name");
    fs.writeFileSync(file, code);
  }
});
