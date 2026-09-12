const fs = require('fs');
let code = fs.readFileSync('prisma/schema.prisma', 'utf8');

code = code.replace('idempotencyKey  String?         @unique', 'idempotencyKey  String?');

if (!code.includes('@@unique([organizationId, idempotencyKey])')) {
    code = code.replace('@@unique([organizationId, orderNumber])', '@@unique([organizationId, orderNumber])\n  @@unique([organizationId, idempotencyKey])');
}

fs.writeFileSync('prisma/schema.prisma', code);
