const fs = require('fs');
let code = fs.readFileSync('src/components/pos/POSWorkstation.tsx', 'utf8');

const regexManage = /<CustomerManageModal[\s\S]*?\/>/g;
const matchesManage = [...code.matchAll(regexManage)];

// Add Customer
code = code.replace(matchesManage[0][0], `<CustomerManageModal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        title="Add New Customer"
        initialData={{ phone: posCart.customer.phone }}
        onSave={(c) => {
          setPosCustomerField('name', c.name);
          setPosCustomerField('phone', c.phone);
          setPosCustomerField('address', c.address);
          setIsAddCustomerModalOpen(false);
        }}
      />`);

// Edit Customer
code = code.replace(matchesManage[1][0], `<CustomerManageModal
        isOpen={isEditCustomerModalOpen}
        onClose={() => setIsEditCustomerModalOpen(false)}
        title="Edit Customer"
        initialData={{ name: posCart.customer?.name, phone: posCart.customer?.phone, address: posCart.customer?.address }}
        onSave={(c) => {
          setPosCustomerField('name', c.name);
          setPosCustomerField('phone', c.phone);
          setPosCustomerField('address', c.address);
          setIsEditCustomerModalOpen(false);
        }}
      />`);

// Add Address
code = code.replace(matchesManage[2][0], `<CustomerManageModal
        isOpen={isAddAddressModalOpen}
        onClose={() => setIsAddAddressModalOpen(false)}
        title="Add Address"
        initialData={{ name: posCart.customer?.name, phone: posCart.customer?.phone }}
        onSave={(c) => {
          setPosCustomerField('address', c.address);
          setIsAddAddressModalOpen(false);
        }}
      />`);

// Edit Address
code = code.replace(matchesManage[3][0], `<CustomerManageModal
        isOpen={isEditAddressModalOpen}
        onClose={() => setIsEditAddressModalOpen(false)}
        title="Edit Address"
        initialData={{ name: posCart.customer?.name, phone: posCart.customer?.phone, address: posCart.customer?.address }}
        onSave={(c) => {
          setPosCustomerField('address', c.address);
          setIsEditAddressModalOpen(false);
        }}
      />`);

const regexView = /<CustomerViewModal[\s\S]*?\/>/;
const matchView = code.match(regexView);

code = code.replace(matchView[0], `<CustomerViewModal
        isOpen={isViewCustomerModalOpen}
        onClose={() => setIsViewCustomerModalOpen(false)}
        customer={{
          name: posCart.customer?.name || '',
          phone: posCart.customer?.phone || '',
          address: posCart.customer?.address
        }}
      />`);

fs.writeFileSync('src/components/pos/POSWorkstation.tsx', code);
