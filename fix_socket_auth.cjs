const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// Replace the io.use function
const oldIoUse = `io.use((socket, next) => {
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
});`;

const newIoUse = `io.use((socket, next) => {
  const authType = socket.handshake.query?.type;
  if (authType === 'agent') {
      // hardware agent, let initHardwareSocket handle it
      return next();
  }

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
});`;

code = code.replace(oldIoUse, newIoUse);
fs.writeFileSync('server.ts', code);
