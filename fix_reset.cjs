const fs = require('fs');

const file = './src/components/pos/POSWorkstation.tsx';
let content = fs.readFileSync(file, 'utf8');

const wrongInsertion = `
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

`;

content = content.replace(wrongInsertion, "");

const mainReturnRegex = /  const isOwnerOrManager = currentUser\.role === 'owner' \|\| currentUser\.role === 'manager';\n\n  return \(/;

const newInsertion = `  const isOwnerOrManager = currentUser.role === 'owner' || currentUser.role === 'manager';

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

content = content.replace(mainReturnRegex, newInsertion);

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed handleResetTicket location.");
