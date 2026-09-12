// Restaurant / Tenant-Level Permissions (Canonical Registry for Tillora Phase 24)
export const RESTAURANT_PERMISSIONS = {
  // Organization & Tenant Settings
  ORGANIZATION_VIEW: 'organization.view',
  ORGANIZATION_UPDATE: 'organization.update',

  // Branches
  BRANCH_VIEW: 'branch.view',
  BRANCH_CREATE: 'branch.create',
  BRANCH_UPDATE: 'branch.update',
  BRANCH_ACTIVATE: 'branch.activate',
  BRANCH_DEACTIVATE: 'branch.deactivate',
  BRANCHES_VIEW: 'branches.view',
  BRANCHES_MANAGE: 'branches.manage',

  // Staff & Identity Management
  STAFF_VIEW: 'staff.view',
  STAFF_CREATE: 'staff.create',
  STAFF_UPDATE: 'staff.update',
  STAFF_DISABLE: 'staff.disable',
  STAFF_REENABLE: 'staff.reenable',
  STAFF_ASSIGN_BRANCH: 'staff.assign_branch',
  STAFF_CHANGE_ROLE: 'staff.change_role',
  STAFF_RESET_PASSWORD: 'staff.reset_password',
  STAFF_MANAGE: 'staff.manage',

  // Menu & Catalog
  MENU_VIEW: 'menu.view',
  MENU_CREATE: 'menu.create',
  MENU_UPDATE: 'menu.update',
  MENU_ARCHIVE: 'menu.archive',
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_MANAGE: 'products.manage',
  CATEGORIES_VIEW: 'categories.view',
  CATEGORIES_MANAGE: 'categories.manage',

  // Inventory & Costing
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_TRANSFER: 'inventory.transfer',
  INVENTORY_RECONCILE: 'inventory.reconcile',
  INVENTORY_WASTE: 'inventory.waste',
  INVENTORY_MANAGE: 'inventory.manage',

  // Recipes & Bill of Materials
  RECIPE_VIEW: 'recipe.view',
  RECIPE_CREATE: 'recipe.create',
  RECIPE_UPDATE: 'recipe.update',
  RECIPE_ARCHIVE: 'recipe.archive',

  // Procurement & Purchasing
  PROCUREMENT_VIEW: 'procurement.view',
  PROCUREMENT_CREATE: 'procurement.create',
  PROCUREMENT_APPROVE: 'procurement.approve',
  PROCUREMENT_RECEIVE: 'procurement.receive',

  // Vendors
  VENDOR_VIEW: 'vendor.view',
  VENDOR_CREATE: 'vendor.create',
  VENDOR_UPDATE: 'vendor.update',

  // Orders & POS Operations
  ORDERS_VIEW: 'orders.view',
  ORDERS_CREATE: 'orders.create',
  ORDERS_UPDATE: 'orders.update',
  ORDERS_MODIFY: 'orders.modify',
  ORDERS_CANCEL: 'orders.cancel',
  ORDERS_VOID: 'orders.void',
  ORDERS_REFUND: 'orders.refund',

  // Payments
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_PROCESS: 'payments.process',
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_REFUND: 'payments.refund',

  // Shifts & Cash Management
  SHIFTS_VIEW: 'shifts.view',
  SHIFTS_OPEN: 'shifts.open',
  SHIFTS_CLOSE: 'shifts.close',
  SHIFTS_REOPEN: 'shifts.reopen',
  CASH_IN: 'cash.in',
  CASH_OUT: 'cash.out',
  CASH_AUDIT: 'cash.audit',
  APPROVALS_VIEW: 'approvals.view',
  APPROVALS_REQUEST: 'approvals.request',
  APPROVALS_APPROVE: 'approvals.approve',

  // Customers
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_UPDATE: 'customers.update',
  CUSTOMERS_MANAGE: 'customers.manage',

  // Reports & Business Intelligence
  REPORTS_VIEW: 'reports.view',
  REPORTS_FINANCIAL: 'reports.financial',
  REPORTS_INVENTORY: 'reports.inventory',
  REPORTS_SALES: 'reports.sales',

  // Settings, Devices & Tables
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_UPDATE: 'settings.update',
  SETTINGS_MANAGE: 'settings.manage',
  DEVICES_VIEW: 'devices.view',
  DEVICES_MANAGE: 'devices.manage',
  TABLES_VIEW: 'tables.view',
  TABLES_MANAGE: 'tables.manage',

  // Audit Logs & KDS
  AUDIT_VIEW: 'audit.view',
  KDS_VIEW: 'kds.view',
  KDS_UPDATE: 'kds.update',
} as const;

// Dedicated Platform / Executive Admin Permissions (Strictly isolated from restaurant tenants)
export const PLATFORM_PERMISSIONS = {
  PLATFORM_ACCESS: 'platform.access',
  PLATFORM_ORGS_VIEW: 'platform.orgs.view',
  PLATFORM_ORGS_MANAGE: 'platform.orgs.manage',
  PLATFORM_USERS_VIEW: 'platform.users.view',
  PLATFORM_USERS_MANAGE: 'platform.users.manage',
  PLATFORM_SUBSCRIPTIONS_VIEW: 'platform.subscriptions.view',
  PLATFORM_SUBSCRIPTIONS_MANAGE: 'platform.subscriptions.manage',
  PLATFORM_AUDIT_VIEW: 'platform.audit.view',
  PLATFORM_HEALTH_VIEW: 'platform.health.view',
} as const;

export const PERMISSIONS = {
  ...RESTAURANT_PERMISSIONS,
  ...PLATFORM_PERMISSIONS,
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Default role-to-permission matrix for Tillora platform.
 * 
 * - PLATFORM_ADMIN / EXECUTIVE_ADMIN: SaaS fleet administration (platform level).
 * - OWNER: Complete organization authority across all organization branches.
 * - ADMIN: Organization administrator (tenant-scoped).
 * - MANAGER: Operational management (assigned branches, branch staff, inventory, operational reports, voids/refunds).
 * - CASHIER: Point of sale, order taking, allowed payments, shift operations, customers.
 * - WAITER / SERVER: Order taking, table status, operational menu view.
 * - KITCHEN: KDS order status updates, kitchen orders, operational recipes.
 * - RIDER: Assigned delivery order views.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  PLATFORM_ADMIN: Object.values(PERMISSIONS),
  EXECUTIVE_ADMIN: Object.values(PERMISSIONS),

  // Restaurant OWNER receives all RESTAURANT permissions, but NEVER platform permissions
  OWNER: Object.values(RESTAURANT_PERMISSIONS),

  ADMIN: Object.values(RESTAURANT_PERMISSIONS),

  MANAGER: [
    RESTAURANT_PERMISSIONS.ORGANIZATION_VIEW,
    RESTAURANT_PERMISSIONS.BRANCH_VIEW,
    RESTAURANT_PERMISSIONS.BRANCHES_VIEW,
    RESTAURANT_PERMISSIONS.STAFF_VIEW,
    RESTAURANT_PERMISSIONS.STAFF_CREATE,
    RESTAURANT_PERMISSIONS.STAFF_UPDATE,
    RESTAURANT_PERMISSIONS.STAFF_DISABLE,
    RESTAURANT_PERMISSIONS.STAFF_REENABLE,
    RESTAURANT_PERMISSIONS.STAFF_ASSIGN_BRANCH,
    RESTAURANT_PERMISSIONS.STAFF_MANAGE,
    RESTAURANT_PERMISSIONS.MENU_VIEW,
    RESTAURANT_PERMISSIONS.MENU_CREATE,
    RESTAURANT_PERMISSIONS.MENU_UPDATE,
    RESTAURANT_PERMISSIONS.PRODUCTS_VIEW,
    RESTAURANT_PERMISSIONS.PRODUCTS_MANAGE,
    RESTAURANT_PERMISSIONS.CATEGORIES_VIEW,
    RESTAURANT_PERMISSIONS.CATEGORIES_MANAGE,
    RESTAURANT_PERMISSIONS.INVENTORY_VIEW,
    RESTAURANT_PERMISSIONS.INVENTORY_ADJUST,
    RESTAURANT_PERMISSIONS.INVENTORY_TRANSFER,
    RESTAURANT_PERMISSIONS.INVENTORY_RECONCILE,
    RESTAURANT_PERMISSIONS.INVENTORY_WASTE,
    RESTAURANT_PERMISSIONS.INVENTORY_MANAGE,
    RESTAURANT_PERMISSIONS.RECIPE_VIEW,
    RESTAURANT_PERMISSIONS.PROCUREMENT_VIEW,
    RESTAURANT_PERMISSIONS.PROCUREMENT_CREATE,
    RESTAURANT_PERMISSIONS.PROCUREMENT_RECEIVE,
    RESTAURANT_PERMISSIONS.VENDOR_VIEW,
    RESTAURANT_PERMISSIONS.VENDOR_CREATE,
    RESTAURANT_PERMISSIONS.VENDOR_UPDATE,
    RESTAURANT_PERMISSIONS.ORDERS_VIEW,
    RESTAURANT_PERMISSIONS.ORDERS_CREATE,
    RESTAURANT_PERMISSIONS.ORDERS_UPDATE,
    RESTAURANT_PERMISSIONS.ORDERS_MODIFY,
    RESTAURANT_PERMISSIONS.ORDERS_CANCEL,
    RESTAURANT_PERMISSIONS.ORDERS_VOID,
    RESTAURANT_PERMISSIONS.ORDERS_REFUND,
    RESTAURANT_PERMISSIONS.PAYMENTS_VIEW,
    RESTAURANT_PERMISSIONS.PAYMENTS_PROCESS,
    RESTAURANT_PERMISSIONS.PAYMENTS_CREATE,
    RESTAURANT_PERMISSIONS.PAYMENTS_REFUND,
    RESTAURANT_PERMISSIONS.SHIFTS_VIEW,
    RESTAURANT_PERMISSIONS.SHIFTS_OPEN,
    RESTAURANT_PERMISSIONS.SHIFTS_CLOSE,
    RESTAURANT_PERMISSIONS.SHIFTS_REOPEN,
    RESTAURANT_PERMISSIONS.CASH_IN,
    RESTAURANT_PERMISSIONS.CASH_OUT,
    RESTAURANT_PERMISSIONS.CASH_AUDIT,
    RESTAURANT_PERMISSIONS.APPROVALS_VIEW,
    RESTAURANT_PERMISSIONS.APPROVALS_REQUEST,
    RESTAURANT_PERMISSIONS.APPROVALS_APPROVE,
    RESTAURANT_PERMISSIONS.CUSTOMERS_VIEW,
    RESTAURANT_PERMISSIONS.CUSTOMERS_CREATE,
    RESTAURANT_PERMISSIONS.CUSTOMERS_UPDATE,
    RESTAURANT_PERMISSIONS.CUSTOMERS_MANAGE,
    RESTAURANT_PERMISSIONS.REPORTS_VIEW,
    RESTAURANT_PERMISSIONS.REPORTS_SALES,
    RESTAURANT_PERMISSIONS.REPORTS_INVENTORY,
    RESTAURANT_PERMISSIONS.SETTINGS_VIEW,
    RESTAURANT_PERMISSIONS.DEVICES_VIEW,
    RESTAURANT_PERMISSIONS.TABLES_VIEW,
    RESTAURANT_PERMISSIONS.TABLES_MANAGE,
    RESTAURANT_PERMISSIONS.AUDIT_VIEW,
    RESTAURANT_PERMISSIONS.KDS_VIEW,
    RESTAURANT_PERMISSIONS.KDS_UPDATE,
  ],

  CASHIER: [
    RESTAURANT_PERMISSIONS.ORDERS_VIEW,
    RESTAURANT_PERMISSIONS.ORDERS_CREATE,
    RESTAURANT_PERMISSIONS.ORDERS_UPDATE,
    RESTAURANT_PERMISSIONS.ORDERS_MODIFY,
    RESTAURANT_PERMISSIONS.PAYMENTS_VIEW,
    RESTAURANT_PERMISSIONS.PAYMENTS_PROCESS,
    RESTAURANT_PERMISSIONS.PAYMENTS_CREATE,
    RESTAURANT_PERMISSIONS.SHIFTS_VIEW,
    RESTAURANT_PERMISSIONS.SHIFTS_OPEN,
    RESTAURANT_PERMISSIONS.SHIFTS_CLOSE,
    RESTAURANT_PERMISSIONS.CASH_IN,
    RESTAURANT_PERMISSIONS.CASH_OUT,
    RESTAURANT_PERMISSIONS.APPROVALS_VIEW,
    RESTAURANT_PERMISSIONS.APPROVALS_REQUEST,
    RESTAURANT_PERMISSIONS.CUSTOMERS_VIEW,
    RESTAURANT_PERMISSIONS.CUSTOMERS_CREATE,
    RESTAURANT_PERMISSIONS.CUSTOMERS_UPDATE,
    RESTAURANT_PERMISSIONS.CUSTOMERS_MANAGE,
    RESTAURANT_PERMISSIONS.MENU_VIEW,
    RESTAURANT_PERMISSIONS.PRODUCTS_VIEW,
    RESTAURANT_PERMISSIONS.CATEGORIES_VIEW,
    RESTAURANT_PERMISSIONS.TABLES_VIEW,
  ],

  WAITER: [
    RESTAURANT_PERMISSIONS.ORDERS_VIEW,
    RESTAURANT_PERMISSIONS.ORDERS_CREATE,
    RESTAURANT_PERMISSIONS.ORDERS_UPDATE,
    RESTAURANT_PERMISSIONS.MENU_VIEW,
    RESTAURANT_PERMISSIONS.PRODUCTS_VIEW,
    RESTAURANT_PERMISSIONS.CATEGORIES_VIEW,
    RESTAURANT_PERMISSIONS.TABLES_VIEW,
    RESTAURANT_PERMISSIONS.CUSTOMERS_VIEW,
  ],

  SERVER: [
    RESTAURANT_PERMISSIONS.ORDERS_VIEW,
    RESTAURANT_PERMISSIONS.ORDERS_CREATE,
    RESTAURANT_PERMISSIONS.ORDERS_UPDATE,
    RESTAURANT_PERMISSIONS.MENU_VIEW,
    RESTAURANT_PERMISSIONS.PRODUCTS_VIEW,
    RESTAURANT_PERMISSIONS.CATEGORIES_VIEW,
    RESTAURANT_PERMISSIONS.TABLES_VIEW,
    RESTAURANT_PERMISSIONS.CUSTOMERS_VIEW,
  ],

  KITCHEN: [
    RESTAURANT_PERMISSIONS.KDS_VIEW,
    RESTAURANT_PERMISSIONS.KDS_UPDATE,
    RESTAURANT_PERMISSIONS.ORDERS_VIEW,
    RESTAURANT_PERMISSIONS.RECIPE_VIEW,
    RESTAURANT_PERMISSIONS.MENU_VIEW,
    RESTAURANT_PERMISSIONS.PRODUCTS_VIEW,
  ],

  RIDER: [
    RESTAURANT_PERMISSIONS.ORDERS_VIEW,
  ],
};

/**
 * Resolves effective permissions for a user given their role and custom restrictions.
 */
export function getEffectivePermissions(role: string, restrictionsRaw?: string | string[]): string[] {
  const normalizedRole = (role || '').toUpperCase();
  const basePermissions = ROLE_PERMISSIONS[normalizedRole] || [];

  let restrictions: string[] = [];
  if (Array.isArray(restrictionsRaw)) {
    restrictions = restrictionsRaw;
  } else if (typeof restrictionsRaw === 'string' && restrictionsRaw.trim()) {
    try {
      const parsed = JSON.parse(restrictionsRaw);
      if (Array.isArray(parsed)) restrictions = parsed;
    } catch {
      restrictions = [];
    }
  }

  if (restrictions.length === 0) {
    return [...basePermissions];
  }

  const restrictedSet = new Set(restrictions);
  return basePermissions.filter((perm) => !restrictedSet.has(perm));
}

/**
 * Checks if an array of granted permissions satisfies a required permission.
 */
export function hasPermission(grantedPermissions: string[], requiredPermission: string): boolean {
  return grantedPermissions.includes(requiredPermission);
}
