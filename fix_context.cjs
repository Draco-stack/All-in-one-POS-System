const fs = require('fs');
const file = './src/context/RestaurantContext.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("const [users, setUsers] = useState<UserAccount[]>([[", "const [users, setUsers] = useState<UserAccount[]>([");

fs.writeFileSync(file, content, 'utf8');
