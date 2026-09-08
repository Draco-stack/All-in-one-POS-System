const fs = require('fs');
let content = fs.readFileSync('src/components/pos/POSWorkstation.tsx', 'utf8');

const importStr = "import { CustomerHistoryView } from '../history/CustomerHistoryView';\n";
if (!content.includes('CustomerHistoryView')) {
    content = content.replace("import { ShiftManagementView }", importStr + "import { ShiftManagementView }");
}

const stateStr = "const [isCustomerHistoryOpen, setIsCustomerHistoryOpen] = useState<boolean>(false);\n  const [phoneSearchInput, setPhoneSearchInput]";
content = content.replace("const [phoneSearchInput, setPhoneSearchInput]", stateStr);

fs.writeFileSync('src/components/pos/POSWorkstation.tsx', content);
