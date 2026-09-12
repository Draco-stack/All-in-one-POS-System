const fs = require('fs');

let ctx = fs.readFileSync('src/context/RestaurantContext.tsx', 'utf8');

ctx = ctx.replace(/headers: \{\n\s*'Content-Type': 'application\/json',\n\s*\.\.\.\(token \? \{ Authorization: `Bearer \$\{token\}` \} : \{\}\),\n\s*\},\n\s*body: JSON\.stringify\(\{\.\.\.newOrder, shiftId: currentShift\?\.id\}\),\n\s*headers: \{\n\s*'idempotency-key': idempotencyKey,\n\s*'Content-Type': 'application\/json',\n\s*'Authorization': `Bearer \$\{token\}`\n\s*\},/, 
`headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
            'idempotency-key': idempotencyKey
          },
          body: JSON.stringify({...newOrder, shiftId: currentShift?.id}),`);

fs.writeFileSync('src/context/RestaurantContext.tsx', ctx);
