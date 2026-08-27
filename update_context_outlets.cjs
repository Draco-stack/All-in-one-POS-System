const fs = require('fs');
const file = './src/context/RestaurantContext.tsx';
let content = fs.readFileSync(file, 'utf8');

const interfaceRegex = /interface RestaurantContextType \{/;
const newInterface = `interface RestaurantContextType {\n  outlets: string[];\n  addOutlet: (name: string) => void;\n  deleteOutlet: (name: string) => void;`;
content = content.replace(interfaceRegex, newInterface);

const stateRegex = /  const \[users, setUsers\] = useState<UserAccount\[\]>\(/;
const newState = `  const [outlets, setOutlets] = useState<string[]>(['Gulberg Branch', 'DHA Phase 5', 'F-7 Islamabad', 'Mall of Lahore']);

  const addOutlet = (name: string) => {
    setOutlets(prev => [...prev, name]);
  };
  
  const deleteOutlet = (name: string) => {
    setOutlets(prev => prev.filter(o => o !== name));
  };

  const [users, setUsers] = useState<UserAccount[]>((`;
content = content.replace(stateRegex, newState);

const exportRegex = /    users,\n/;
const newExport = `    outlets,\n    addOutlet,\n    deleteOutlet,\n    users,\n`;
content = content.replace(exportRegex, newExport);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated RestaurantContext to include outlets");
