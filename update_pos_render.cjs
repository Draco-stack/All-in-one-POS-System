const fs = require('fs');
let content = fs.readFileSync('src/components/pos/POSWorkstation.tsx', 'utf8');

const injection = `
      {isCustomerHistoryOpen && (
        <CustomerHistoryView 
          initialPhone={phoneSearchInput || posCart.customer?.phone}
          onClose={() => setIsCustomerHistoryOpen(false)}
        />
      )}
    </div>
  );
};
`;

content = content.replace("    </div>\n  );\n};\n", injection);
// Also just in case it's different line endings:
content = content.replace("    </div>\r\n  );\r\n};\r\n", injection);

fs.writeFileSync('src/components/pos/POSWorkstation.tsx', content);
