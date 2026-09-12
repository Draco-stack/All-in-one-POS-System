const fs = require('fs');

let portal = fs.readFileSync('src/server/controllers/portalController.ts', 'utf8');
portal = portal.replace(/io\.emit\('subscriptionUpdated'/g, "io.to(`org_${organizationId}`).emit('subscriptionUpdated'");
portal = portal.replace(/io\.emit\('SUBSCRIPTION_REACTIVATED'/g, "io.to(`org_${organizationId}`).emit('SUBSCRIPTION_REACTIVATED'");
fs.writeFileSync('src/server/controllers/portalController.ts', portal);

let admin = fs.readFileSync('src/server/controllers/adminController.ts', 'utf8');
admin = admin.replace(/io\.emit\('menuItemCreated'/g, "io.to(`org_${tenant.organizationId}`).emit('menuItemCreated'");
admin = admin.replace(/io\.emit\('menuItemDeleted'/g, "io.to(`org_${tenant.organizationId}`).emit('menuItemDeleted'");
admin = admin.replace(/io\.emit\('menuItemUpdated'/g, "io.to(`org_${tenant.organizationId}`).emit('menuItemUpdated'");
fs.writeFileSync('src/server/controllers/adminController.ts', admin);
