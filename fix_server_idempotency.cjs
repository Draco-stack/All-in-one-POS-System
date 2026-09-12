const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldCreate = `const order = await tx.order.create({
      data: {
        organizationId: tenant.organizationId,
        branchId: tenant.branchId,`;

const newCreate = `let order;
    try {
      order = await tx.order.create({
        data: {
          organizationId: tenant.organizationId,
          branchId: tenant.branchId,`;

code = code.replace(oldCreate, newCreate);

const oldAfterCreate = `      },
      include: { customer: true, items: true, assignedRider: true, auditLogs: true },
    });

    // Reduce inventory strictly in transaction`;

const newAfterCreate = `      },
        include: { customer: true, items: true, assignedRider: true, auditLogs: true },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        const dupOrder = await tx.order.findFirst({
           where: { organizationId: tenant.organizationId, orderNumber: clientOrderNum || String(idempotencyKey) },
           include: { customer: true, items: true, assignedRider: true, auditLogs: true },
        });
        if (dupOrder) return dupOrder;
      }
      throw e;
    }

    // Reduce inventory strictly in transaction`;

code = code.replace(oldAfterCreate, newAfterCreate);

fs.writeFileSync('server.ts', code);
