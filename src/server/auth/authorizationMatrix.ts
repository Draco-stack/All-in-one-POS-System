/**
 * TILLORA SAAS POS - MACHINE-READABLE CENTRAL AUTHORIZATION MATRIX
 * Phase 11: Permanent Security Regression Gate & Multi-Tenant Access Policy
 * 
 * Defines the strict, server-enforced authorization rules across all actors,
 * resource domains, actions, and tenant/branch scopes.
 */

export enum ActorRole {
  ANONYMOUS = 'ANONYMOUS',
  SUSPENDED_USER = 'SUSPENDED_USER',
  DISABLED_USER = 'DISABLED_USER',
  EXPIRED_SESSION = 'EXPIRED_SESSION',
  CASHIER = 'CASHIER',
  SERVER = 'SERVER',
  RIDER = 'RIDER',
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  EXECUTIVE_ADMIN = 'EXECUTIVE_ADMIN',
}

export enum ResourceDomain {
  ORGANIZATIONS = 'organizations',
  BRANCHES = 'branches',
  USERS = 'users',
  ROLES = 'roles',
  PERMISSIONS = 'permissions',
  SUBSCRIPTIONS = 'subscriptions',
  PRODUCTS = 'products',
  CATEGORIES = 'categories',
  INVENTORY = 'inventory',
  VENDORS = 'vendors',
  CUSTOMERS = 'customers',
  ORDERS = 'orders',
  ORDER_ITEMS = 'order_items',
  PAYMENTS = 'payments',
  INVOICES = 'invoices',
  EXPENSES = 'expenses',
  SHIFTS = 'shifts',
  REPORTS = 'reports',
  ANALYTICS = 'analytics',
  LOYALTY = 'loyalty',
  KDS = 'kds',
  DEVICES = 'devices',
  PRINT_JOBS = 'print_jobs',
  AUDIT_LOGS = 'audit_logs',
  PLATFORM_ADMIN = 'platform_admin',
  PLATFORM_DIAGNOSTICS = 'platform_diagnostics',
}

export enum ActionType {
  CREATE = 'CREATE',
  READ = 'READ',
  LIST = 'LIST',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  EXPORT = 'EXPORT',
  CANCEL = 'CANCEL',
  REFUND = 'REFUND',
  SUSPEND = 'SUSPEND',
  REACTIVATE = 'REACTIVATE',
  MANAGE = 'MANAGE',
}

export enum ScopeType {
  OWN_ORGANIZATION = 'OWN_ORGANIZATION',
  DIFFERENT_ORGANIZATION = 'DIFFERENT_ORGANIZATION',
  OWN_BRANCH = 'OWN_BRANCH',
  DIFFERENT_BRANCH = 'DIFFERENT_BRANCH',
  PLATFORM_GLOBAL = 'PLATFORM_GLOBAL',
}

export interface AuthorizationPolicyRule {
  id: string;
  actor: ActorRole;
  resource: ResourceDomain;
  action: ActionType;
  scope: ScopeType;
  allowed: boolean;
  requiredPermission?: string;
  requiredPlatformPermission?: string;
  expectedHttpStatus: number; // 200, 201, 401, 403, 404
  description: string;
}

/**
 * Complete Database Tenant Ownership Classification Matrix
 */
export enum ModelOwnershipScope {
  TENANT_SCOPED = 'TENANT_SCOPED',
  BRANCH_SCOPED = 'BRANCH_SCOPED',
  USER_SCOPED = 'USER_SCOPED',
  PLATFORM_SCOPED = 'PLATFORM_SCOPED',
  CROSS_TENANT_PLATFORM_DATA = 'CROSS_TENANT_PLATFORM_DATA',
  SHARED_REFERENCE_DATA = 'SHARED_REFERENCE_DATA',
}

export interface DatabaseModelClassification {
  modelName: string;
  classification: ModelOwnershipScope;
  tenantKey: string;
  branchKey?: string;
  userKey?: string;
  platformAccessOnly: boolean;
  allowedActors: ActorRole[];
  forbiddenActors: ActorRole[];
  enforcementMechanism: string;
}

export const DATABASE_SCHEMA_OWNERSHIP_MATRIX: Record<string, DatabaseModelClassification> = {
  Organization: {
    modelName: 'Organization',
    classification: ModelOwnershipScope.TENANT_SCOPED,
    tenantKey: 'id',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.PLATFORM_ADMIN, ActorRole.EXECUTIVE_ADMIN],
    forbiddenActors: [ActorRole.CASHIER, ActorRole.SERVER, ActorRole.RIDER, ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Prisma findUnique/findMany with id filter & resolveTenantContext',
  },
  Branch: {
    modelName: 'Branch',
    classification: ModelOwnershipScope.BRANCH_SCOPED,
    tenantKey: 'organizationId',
    branchKey: 'id',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.CASHIER, ActorRole.SERVER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Prisma query with organizationId and branch active filters',
  },
  Subscription: {
    modelName: 'Subscription',
    classification: ModelOwnershipScope.TENANT_SCOPED,
    tenantKey: 'organizationId',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.PLATFORM_ADMIN, ActorRole.EXECUTIVE_ADMIN],
    forbiddenActors: [ActorRole.CASHIER, ActorRole.SERVER, ActorRole.RIDER, ActorRole.MANAGER, ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'SaaS billing controller with organizationId binding; plan modifications restricted to Owner or Platform Admin',
  },
  SubscriptionReminderLog: {
    modelName: 'SubscriptionReminderLog',
    classification: ModelOwnershipScope.TENANT_SCOPED,
    tenantKey: 'organizationId',
    platformAccessOnly: true,
    allowedActors: [ActorRole.PLATFORM_ADMIN, ActorRole.EXECUTIVE_ADMIN],
    forbiddenActors: [ActorRole.CASHIER, ActorRole.SERVER, ActorRole.RIDER, ActorRole.MANAGER, ActorRole.OWNER, ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'System scheduler / platform admin log with immutable organizationId binding',
  },
  Device: {
    modelName: 'Device',
    classification: ModelOwnershipScope.BRANCH_SCOPED,
    tenantKey: 'organizationId',
    branchKey: 'branchId',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.CASHIER, ActorRole.SERVER, ActorRole.RIDER, ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Hardware controller scoped with organizationId and device pairing validation',
  },
  AuditLog: {
    modelName: 'AuditLog',
    classification: ModelOwnershipScope.TENANT_SCOPED,
    tenantKey: 'organizationId',
    branchKey: 'branchId',
    userKey: 'userId',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.PLATFORM_ADMIN, ActorRole.EXECUTIVE_ADMIN],
    forbiddenActors: [ActorRole.CASHIER, ActorRole.SERVER, ActorRole.RIDER, ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Audit service writes with immutable organizationId; queries strictly tenant filtered',
  },
  Session: {
    modelName: 'Session',
    classification: ModelOwnershipScope.USER_SCOPED,
    tenantKey: 'organizationId',
    userKey: 'userId',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.CASHIER, ActorRole.SERVER, ActorRole.RIDER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Session manager binds JWT token hash, organizationId and userId; revoked upon tenant suspension',
  },
  User: {
    modelName: 'User',
    classification: ModelOwnershipScope.USER_SCOPED,
    tenantKey: 'organizationId',
    branchKey: 'branchId',
    userKey: 'id',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.CASHIER, ActorRole.SERVER, ActorRole.RIDER, ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'User queries scoped to organizationId; role modification strictly validated',
  },
  Customer: {
    modelName: 'Customer',
    classification: ModelOwnershipScope.TENANT_SCOPED,
    tenantKey: 'organizationId',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.CASHIER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Customer controller with organizationId scoping on phone number and profile',
  },
  Category: {
    modelName: 'Category',
    classification: ModelOwnershipScope.TENANT_SCOPED,
    tenantKey: 'organizationId',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.CASHIER, ActorRole.SERVER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Category queries strictly filtered by organizationId',
  },
  MenuItem: {
    modelName: 'MenuItem',
    classification: ModelOwnershipScope.TENANT_SCOPED,
    tenantKey: 'organizationId',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.CASHIER, ActorRole.SERVER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Menu item catalog scoped to organizationId',
  },
  Order: {
    modelName: 'Order',
    classification: ModelOwnershipScope.BRANCH_SCOPED,
    tenantKey: 'organizationId',
    branchKey: 'branchId',
    userKey: 'createdById',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.CASHIER, ActorRole.SERVER, ActorRole.RIDER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Order operations enforce organizationId and branch scoping; foreign IDs rejected with 404',
  },
  OrderItem: {
    modelName: 'OrderItem',
    classification: ModelOwnershipScope.TENANT_SCOPED,
    tenantKey: 'order.organizationId',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.CASHIER, ActorRole.SERVER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Cascades directly through tenant-owned Order parent',
  },
  OrderAuditLog: {
    modelName: 'OrderAuditLog',
    classification: ModelOwnershipScope.TENANT_SCOPED,
    tenantKey: 'order.organizationId',
    userKey: 'performedById',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.CASHIER, ActorRole.SERVER, ActorRole.RIDER, ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Immutable order modifications history scoped through tenant Order',
  },
  RegisterShift: {
    modelName: 'RegisterShift',
    classification: ModelOwnershipScope.BRANCH_SCOPED,
    tenantKey: 'organizationId',
    branchKey: 'branchId',
    userKey: 'openedById',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.CASHIER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.SERVER, ActorRole.RIDER, ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Register shifts bound to organizationId and branchId; close/reopen requires manager verification',
  },
  ShiftAudit: {
    modelName: 'ShiftAudit',
    classification: ModelOwnershipScope.TENANT_SCOPED,
    tenantKey: 'shift.organizationId',
    userKey: 'userId',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.SERVER, ActorRole.RIDER, ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Register shift snapshots scoped through tenant RegisterShift',
  },
  Outlet: {
    modelName: 'Outlet',
    classification: ModelOwnershipScope.TENANT_SCOPED,
    tenantKey: 'organizationId',
    branchKey: 'branchId',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Physical outlet definitions scoped by organizationId',
  },
  Table: {
    modelName: 'Table',
    classification: ModelOwnershipScope.BRANCH_SCOPED,
    tenantKey: 'organizationId',
    branchKey: 'branchId',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.CASHIER, ActorRole.SERVER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Table arrangement scoped by organizationId and branchId',
  },
  DevicePairing: {
    modelName: 'DevicePairing',
    classification: ModelOwnershipScope.TENANT_SCOPED,
    tenantKey: 'organizationId',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.CASHIER, ActorRole.SERVER, ActorRole.RIDER, ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Pairing codes scoped to organizationId with TTL expiration',
  },
  DeviceCredential: {
    modelName: 'DeviceCredential',
    classification: ModelOwnershipScope.TENANT_SCOPED,
    tenantKey: 'organizationId',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.CASHIER, ActorRole.SERVER, ActorRole.RIDER, ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Stores SHA-256 hash of device token; validated against device status and organizationId',
  },
  PrintJob: {
    modelName: 'PrintJob',
    classification: ModelOwnershipScope.TENANT_SCOPED,
    tenantKey: 'organizationId',
    branchKey: 'branchId',
    platformAccessOnly: false,
    allowedActors: [ActorRole.OWNER, ActorRole.ADMIN, ActorRole.MANAGER, ActorRole.CASHIER, ActorRole.PLATFORM_ADMIN],
    forbiddenActors: [ActorRole.SUSPENDED_USER, ActorRole.ANONYMOUS],
    enforcementMechanism: 'Hardware print jobs bound to organizationId and targeted deviceId',
  },
};

/**
 * Master Authorization Policy Rules Matrix
 */
export const MASTER_AUTHORIZATION_POLICY: AuthorizationPolicyRule[] = [
  // -------------------------------------------------------------
  // ORDERS RESOURCE RULES
  // -------------------------------------------------------------
  {
    id: 'AUTH-ORD-01',
    actor: ActorRole.OWNER,
    resource: ResourceDomain.ORDERS,
    action: ActionType.READ,
    scope: ScopeType.OWN_ORGANIZATION,
    allowed: true,
    requiredPermission: 'orders.view',
    expectedHttpStatus: 200,
    description: 'Owner can view orders within own organization',
  },
  {
    id: 'AUTH-ORD-02',
    actor: ActorRole.OWNER,
    resource: ResourceDomain.ORDERS,
    action: ActionType.READ,
    scope: ScopeType.DIFFERENT_ORGANIZATION,
    allowed: false,
    expectedHttpStatus: 404,
    description: 'Owner CANNOT view orders in a foreign organization',
  },
  {
    id: 'AUTH-ORD-03',
    actor: ActorRole.CASHIER,
    resource: ResourceDomain.ORDERS,
    action: ActionType.CREATE,
    scope: ScopeType.OWN_BRANCH,
    allowed: true,
    requiredPermission: 'orders.create',
    expectedHttpStatus: 201,
    description: 'Cashier can punch orders in own branch',
  },
  {
    id: 'AUTH-ORD-04',
    actor: ActorRole.CASHIER,
    resource: ResourceDomain.ORDERS,
    action: ActionType.CANCEL,
    scope: ScopeType.OWN_ORGANIZATION,
    allowed: false,
    requiredPermission: 'orders.cancel',
    expectedHttpStatus: 403,
    description: 'Cashier CANNOT cancel orders without manager verification',
  },
  {
    id: 'AUTH-ORD-05',
    actor: ActorRole.MANAGER,
    resource: ResourceDomain.ORDERS,
    action: ActionType.CANCEL,
    scope: ScopeType.OWN_ORGANIZATION,
    allowed: true,
    requiredPermission: 'orders.cancel',
    expectedHttpStatus: 200,
    description: 'Manager can cancel orders in own organization with reason',
  },
  {
    id: 'AUTH-ORD-06',
    actor: ActorRole.SUSPENDED_USER,
    resource: ResourceDomain.ORDERS,
    action: ActionType.READ,
    scope: ScopeType.OWN_ORGANIZATION,
    allowed: false,
    expectedHttpStatus: 403,
    description: 'Suspended tenant users are strictly rejected with 403',
  },

  // -------------------------------------------------------------
  // CUSTOMERS RESOURCE RULES
  // -------------------------------------------------------------
  {
    id: 'AUTH-CUST-01',
    actor: ActorRole.CASHIER,
    resource: ResourceDomain.CUSTOMERS,
    action: ActionType.READ,
    scope: ScopeType.OWN_ORGANIZATION,
    allowed: true,
    requiredPermission: 'customers.view',
    expectedHttpStatus: 200,
    description: 'Cashier can look up customers in own organization',
  },
  {
    id: 'AUTH-CUST-02',
    actor: ActorRole.OWNER,
    resource: ResourceDomain.CUSTOMERS,
    action: ActionType.READ,
    scope: ScopeType.DIFFERENT_ORGANIZATION,
    allowed: false,
    expectedHttpStatus: 404,
    description: 'Owner CANNOT look up customers of a foreign tenant',
  },

  // -------------------------------------------------------------
  // SUBSCRIPTIONS & BILLING RULES
  // -------------------------------------------------------------
  {
    id: 'AUTH-SUB-01',
    actor: ActorRole.OWNER,
    resource: ResourceDomain.SUBSCRIPTIONS,
    action: ActionType.READ,
    scope: ScopeType.OWN_ORGANIZATION,
    allowed: true,
    expectedHttpStatus: 200,
    description: 'Owner can view own subscription plan',
  },
  {
    id: 'AUTH-SUB-02',
    actor: ActorRole.CASHIER,
    resource: ResourceDomain.SUBSCRIPTIONS,
    action: ActionType.UPDATE,
    scope: ScopeType.OWN_ORGANIZATION,
    allowed: false,
    expectedHttpStatus: 403,
    description: 'Cashier CANNOT modify subscription plans',
  },
  {
    id: 'AUTH-SUB-03',
    actor: ActorRole.OWNER,
    resource: ResourceDomain.SUBSCRIPTIONS,
    action: ActionType.UPDATE,
    scope: ScopeType.DIFFERENT_ORGANIZATION,
    allowed: false,
    expectedHttpStatus: 403,
    description: 'Owner CANNOT modify a foreign tenant subscription plan',
  },

  // -------------------------------------------------------------
  // EXECUTIVE PLATFORM ADMIN BOUNDARY RULES
  // -------------------------------------------------------------
  {
    id: 'AUTH-PLAT-01',
    actor: ActorRole.PLATFORM_ADMIN,
    resource: ResourceDomain.PLATFORM_ADMIN,
    action: ActionType.READ,
    scope: ScopeType.PLATFORM_GLOBAL,
    allowed: true,
    requiredPlatformPermission: 'platform.access',
    expectedHttpStatus: 200,
    description: 'Platform Admin can view platform fleet overview',
  },
  {
    id: 'AUTH-PLAT-02',
    actor: ActorRole.OWNER,
    resource: ResourceDomain.PLATFORM_ADMIN,
    action: ActionType.READ,
    scope: ScopeType.PLATFORM_GLOBAL,
    allowed: false,
    expectedHttpStatus: 403,
    description: 'Restaurant Owner CANNOT access platform admin endpoints',
  },
  {
    id: 'AUTH-PLAT-03',
    actor: ActorRole.MANAGER,
    resource: ResourceDomain.PLATFORM_ADMIN,
    action: ActionType.READ,
    scope: ScopeType.PLATFORM_GLOBAL,
    allowed: false,
    expectedHttpStatus: 403,
    description: 'Restaurant Manager CANNOT access platform admin endpoints',
  },
  {
    id: 'AUTH-PLAT-04',
    actor: ActorRole.CASHIER,
    resource: ResourceDomain.PLATFORM_ADMIN,
    action: ActionType.READ,
    scope: ScopeType.PLATFORM_GLOBAL,
    allowed: false,
    expectedHttpStatus: 403,
    description: 'Restaurant Cashier CANNOT access platform admin endpoints',
  },
  {
    id: 'AUTH-PLAT-05',
    actor: ActorRole.ANONYMOUS,
    resource: ResourceDomain.PLATFORM_ADMIN,
    action: ActionType.READ,
    scope: ScopeType.PLATFORM_GLOBAL,
    allowed: false,
    expectedHttpStatus: 401,
    description: 'Anonymous request to platform admin is rejected with 401',
  },
  {
    id: 'AUTH-PLAT-06',
    actor: ActorRole.PLATFORM_ADMIN,
    resource: ResourceDomain.ORGANIZATIONS,
    action: ActionType.SUSPEND,
    scope: ScopeType.PLATFORM_GLOBAL,
    allowed: true,
    requiredPlatformPermission: 'platform.orgs.manage',
    expectedHttpStatus: 200,
    description: 'Platform Admin can suspend tenant organizations',
  },
  {
    id: 'AUTH-PLAT-07',
    actor: ActorRole.OWNER,
    resource: ResourceDomain.ORGANIZATIONS,
    action: ActionType.SUSPEND,
    scope: ScopeType.DIFFERENT_ORGANIZATION,
    allowed: false,
    expectedHttpStatus: 403,
    description: 'Restaurant Owner CANNOT suspend foreign organizations',
  },

  // -------------------------------------------------------------
  // SHIFTS & FINANCIAL DRILLDOWN
  // -------------------------------------------------------------
  {
    id: 'AUTH-SHF-01',
    actor: ActorRole.CASHIER,
    resource: ResourceDomain.SHIFTS,
    action: ActionType.READ,
    scope: ScopeType.OWN_BRANCH,
    allowed: true,
    requiredPermission: 'shifts.view',
    expectedHttpStatus: 200,
    description: 'Cashier can view active shift in own branch',
  },
  {
    id: 'AUTH-SHF-02',
    actor: ActorRole.OWNER,
    resource: ResourceDomain.SHIFTS,
    action: ActionType.READ,
    scope: ScopeType.DIFFERENT_ORGANIZATION,
    allowed: false,
    expectedHttpStatus: 404,
    description: 'Owner CANNOT view shifts in a foreign organization',
  },

  // -------------------------------------------------------------
  // HARDWARE & DEVICES
  // -------------------------------------------------------------
  {
    id: 'AUTH-DEV-01',
    actor: ActorRole.OWNER,
    resource: ResourceDomain.DEVICES,
    action: ActionType.MANAGE,
    scope: ScopeType.OWN_ORGANIZATION,
    allowed: true,
    requiredPermission: 'devices.manage',
    expectedHttpStatus: 200,
    description: 'Owner can manage hardware pairing in own organization',
  },
  {
    id: 'AUTH-DEV-02',
    actor: ActorRole.OWNER,
    resource: ResourceDomain.DEVICES,
    action: ActionType.MANAGE,
    scope: ScopeType.DIFFERENT_ORGANIZATION,
    allowed: false,
    expectedHttpStatus: 404,
    description: 'Owner CANNOT pair or revoke devices in a foreign organization',
  },
];

/**
 * Helper to evaluate the policy matrix for a requested operation.
 */
export function evaluatePolicy(
  actor: ActorRole,
  resource: ResourceDomain,
  action: ActionType,
  scope: ScopeType
): AuthorizationPolicyRule | undefined {
  return MASTER_AUTHORIZATION_POLICY.find(
    (rule) =>
      rule.actor === actor &&
      rule.resource === resource &&
      rule.action === action &&
      rule.scope === scope
  );
}
