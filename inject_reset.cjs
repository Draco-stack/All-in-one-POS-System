const fs = require('fs');
const file = './src/components/pos/POSWorkstation.tsx';
let content = fs.readFileSync(file, 'utf8');

const resetFunctionStr = `
  const handleResetTicket = () => {
    clearPosCart();
    setPhoneSearchInput('');
    setCustomerLookupStatus('idle');
    setFoundCustomer(null);
    setActiveDeliveryNote('');
    setIsPreOrder(false);
    setSelectedOutlet('Gulberg Branch');
    setSelectedSource('Pos');
  };

  return (`;

content = content.replace("  return (", resetFunctionStr);

content = content.replace(
  "onClick={() => setSelectedOutlet('Gulberg Branch')} className=\"bg-[#c82333]",
  "onClick={handleResetTicket} className=\"bg-[#c82333]"
);

fs.writeFileSync(file, content, 'utf8');
console.log("Reset injected");
