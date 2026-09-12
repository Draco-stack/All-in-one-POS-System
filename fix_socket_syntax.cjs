const fs = require('fs');
let code = fs.readFileSync('src/context/RestaurantContext.tsx', 'utf8');

const target = `    const token = localStorage.getItem('pos_token') || sessionStorage.getItem('pos_token') || '';
    const socket = io({
      auth: { token },
      auth: { token },
      query: { token, type: 'kds_user' },
      extraHeaders: {
        Authorization: \`Bearer \${token}\`
      }
    });`;

const replacement = `    const socket = io({
      auth: { token },
      query: { token, type: 'kds_user' },
      extraHeaders: {
        Authorization: \`Bearer \${token}\`
      }
    });`;

code = code.replace(target, replacement);
fs.writeFileSync('src/context/RestaurantContext.tsx', code);
