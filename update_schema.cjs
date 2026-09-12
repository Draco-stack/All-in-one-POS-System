const fs = require('fs');
let code = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Add to Order
if (!code.includes('shiftId         String?')) {
    code = code.replace('  auditLogs       OrderAuditLog[]', '  auditLogs       OrderAuditLog[]\n  shiftId         String?\n  shift           RegisterShift?  @relation(fields: [shiftId], references: [id])');
}
if (!code.includes('idempotencyKey  String?')) {
    code = code.replace('  shiftId         String?', '  idempotencyKey  String?         @unique\n  shiftId         String?');
}

// Add to RegisterShift
if (!code.includes('deviceId             String?')) {
    code = code.replace('  shiftNumber          String', '  shiftNumber          String\n  deviceId             String?');
}
if (!code.includes('orders               Order[]')) {
    code = code.replace('  floatRetained        Float?        @default(0)', '  floatRetained        Float?        @default(0)\n  orders               Order[]');
}

fs.writeFileSync('prisma/schema.prisma', code);
