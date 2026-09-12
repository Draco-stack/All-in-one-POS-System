const fs = require('fs');
let code = fs.readFileSync('src/utils/indexedDB.ts', 'utf8');

const target = `const effectiveOrgId = organizationId || orderData.organizationId || 'org_default';`;
code = code.replace(target, `const effectiveOrgId = organizationId || orderData.organizationId;\n    if (!effectiveOrgId) throw new Error('Tenant isolation violation: Missing organizationId for offline order queue');`);

fs.writeFileSync('src/utils/indexedDB.ts', code);
