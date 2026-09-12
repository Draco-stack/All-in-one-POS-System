const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldCatch = `          const existingOrder = await prisma.order.findFirst({
            where: { organizationId: tenant.organizationId, orderNumber: String(idempotencyKey) },
            include: { customer: true, items: true, assignedRider: true, auditLogs: true },
          });`;

const newCatch = `          const existingOrder = await prisma.order.findFirst({
            where: { organizationId: tenant.organizationId, idempotencyKey: String(idempotencyKey) },
            include: { customer: true, items: true, assignedRider: true, auditLogs: true },
          });`;

code = code.replace(oldCatch, newCatch);
fs.writeFileSync('server.ts', code);
