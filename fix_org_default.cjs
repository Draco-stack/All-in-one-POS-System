const fs = require('fs');
let code = fs.readFileSync('src/context/RestaurantContext.tsx', 'utf8');

code = code.replace(/currentUser\?\.organizationId \|\| 'org_default'/g, "currentUser?.organizationId || ''");

// If currentUser is null, organizationId will be empty. IndexedDB posDB needs to handle empty string by rejecting.
fs.writeFileSync('src/context/RestaurantContext.tsx', code);
