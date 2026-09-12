const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Add import if needed
if (!code.includes("import { verifyTenantToken }")) {
  code = code.replace("import { signTenantToken }", "import { signTenantToken, verifyTenantToken }");
  if (!code.includes("verifyTenantToken")) {
      code = code.replace("import jwt from 'jsonwebtoken';", "import jwt from 'jsonwebtoken';\nimport { verifyTenantToken } from './src/server/auth/jwt';");
  }
}

// Add io.use
const ioUseStr = `
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
  if (!token) return next(new Error('Authentication required'));
  
  const rawToken = token.replace('Bearer ', '');
  const decoded = verifyTenantToken(rawToken);
  if (!decoded || !decoded.organizationId) {
    return next(new Error('Invalid token'));
  }
  
  (socket as any).tenant = decoded;
  socket.join('org_' + decoded.organizationId);
  if (decoded.branchId) {
    socket.join('branch_' + decoded.branchId);
  }
  next();
});

io.on('connection', (socket) => {
  const tenant = (socket as any).tenant;
  console.log('Client connected:', socket.id, 'Org:', tenant?.organizationId);
`;

code = code.replace(/io\.on\('connection', \(socket\) => \{\n\s*console\.log\('Client connected:', socket\.id\);/g, ioUseStr);

// Replace io.emit with io.to(\`org_\${tenant.organizationId}\`).emit in server.ts
code = code.replace(/io\.emit\('tablesUpdated'\)/g, "io.to(`org_${tenant.organizationId}`).emit('tablesUpdated')");
code = code.replace(/io\.emit\('categoriesUpdated'\)/g, "io.to(`org_${tenant.organizationId}`).emit('categoriesUpdated')");
code = code.replace(/io\.emit\('customer:blocked'/g, "io.to(`org_${tenant.organizationId}`).emit('customer:blocked'");
code = code.replace(/io\.emit\('customer:unblocked'/g, "io.to(`org_${tenant.organizationId}`).emit('customer:unblocked'");
code = code.replace(/io\.emit\('orderCreated'/g, "io.to(`org_${tenant.organizationId}`).emit('orderCreated'");
code = code.replace(/io\.emit\('orderUpdated'/g, "io.to(`org_${tenant.organizationId}`).emit('orderUpdated'");

fs.writeFileSync('server.ts', code);
