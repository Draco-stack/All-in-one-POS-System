// Restaurant / Tenant-Level Permissions
export const RESTAURANT_PERMISSIONS = {
  // Orders
  ORDERS_VIEW: 'orders.view',
  ORDERS_CREATE: 'orders.create',
  ORDERS_MODIFY: 'orders.modify',
  ORDERS_CANCEL: 'orders.cancel',
  ORDERS_REFUND: 'orders.refund',

  // Payments
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_REFUND: 'payments.refund',

  // Shifts
  SHIFTS_VIEW: 'shifts.view',
  SHIFTS_OPEN: 'shifts.open',
  SHIFTS_CLOSE: 'shifts.close',

  // Customers
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',

  // Products / Menu Items
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_MANAGE: 'products.manage',

  // Categories
  CATEGORIES_VIEW: 'categories.view',
  CATEGORIES_MANAGE: 'categories.manage',

  // Inventory
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_MANAGE: 'inventory.manage',

  // Staff / User management within organization
  STAFF_VIEW: 'staff.view',
  STAFF_MANAGE: 'staff.manage',

  // Reports & Analytics
  REPORTS_VIEW: 'reports.view',

  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',

  // Devices
  DEVICES_VIEW: 'devices.view',
  DEVICES_MANAGE: 'devices.manage',

  // Branches
  BRANCHES_VIEW: 'branches.view',
  BRANCHES_MANAGE: 'branches.manage',

  // Audit Logs
  AUDIT_VIEW: 'audit.view',

  // Tables
  TABLES_VIEW: 'tables.view',
  TABLES_MANAGE: 'tables.manage',
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
 * Default permission matrix mapped by role.
 * PLATFORM_ADMIN / EXECUTIVE_ADMIN: Complete administrative rights across the SaaS platform layer.
 * OWNER: Complete administrative rights strictly within their restaurant tenant organization.
 * ADMIN: Organization administrator (tenant-scoped).
 * MANAGER: Operational oversight (staff management, adjustments, inventory, cancellations).
 * CASHIER: Day-to-day point of sale transactions, shifts, customer records.
 * SERVER: Dine-in order punching and table status.
 * RIDER: Delivery status and route updates.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  PLATFORM_ADMIN: Object.values(PERMISSIONS),
  EXECUTIVE_ADMIN: Object.values(PERMISSIONS),

  // Restaurant OWNER receives all RESTAURANT permissions, but NEVER platform permissions
  OWNER: Object.values(RESTAURANT_PERMISSIONS),

  ADMIN: [
    RESTAURANT_PERMISSIONS.ORDERS_VIEW,
    RESTAURANT_PERMISSIONS.ORDERS_CREATE,
    RESTAURANT_PERMISSIONS.ORDERS_MODIFY,
    RESTAURANT_PERMISSIONS.ORDERS_CANCEL,
    RESTAURANT_PERMISSIONS.ORDERS_REFUND,
    RESTAURANT_PERMISSIONS.PAYMENTS_VIEW,
    RESTAURANT_PERMISSIONS.PAYMENTS_CREATE,
    RESTAURANT_PERMISSIONS.PAYMENTS_REFUND,
    RESTAURANT_PERMISSIONS.SHIFTS_VIEW,
    RESTAURANT_PERMISSIONS.SHIFTS_OPEN,
    RESTAURANT_PERMISSIONS.SHIFTS_CLOSE,
    RESTAURANT_PERMISSIONS.CUSTOMERS_VIEW,
    RESTAURANT_PERMISSIONS.CUSTOMERS_MANAGE,
    RESTAURANT_PERMISSIONS.PRODUCTS_VIEW,
    RESTAURANT_PERMISSIONS.PRODUCTS_MANAGE,
    RESTAURANT_PERMISSIONS.CATEGORIES_VIEW,
    RESTAURANT_PERMISSIONS.CATEGORIES_MANAGE,
    RESTAURANT_PERMISSIONS.INVENTORY_VIEW,
    RESTAURANT_PERMISSIONS.INVENTORY_MANAGE,
    RESTAURANT_PERMISSIONS.STAFF_VIEW,
    RESTAURANT_PERMISSIONS.STAFF_MANAGE,
    RESTAURANT_PERMISSIONS.REPORTS_VIEW,
    RESTAURANT_PERMISSIONS.SETTINGS_VIEW,
    RESTAURANT_PERMISSIONS.SETTINGS_MANAGE,
    RESTAURANT_PERMISSIONS.DEVICES_VIEW,
    RESTAURANT_PERMISSIONS.DEVICES_MANAGE,
    RESTAURANT_PERMISSIONS.BRANCHES_VIEW,
    RESTAURANT_PERMISSIONS.BRANCHES_MANAGE,
    RESTAURANT_PERMISSIONS.AUDIT_VIEW,
    RESTAURANT_PERMISSIONS.TABLES_VIEW,
    RESTAURANT_PERMISSIONS.TABLES_MANAGE,
  ],

  MANAGER: [
    RESTAURANT_PERMISSIONS.ORDERS_VIEW,
    RESTAURANT_PERMISSIONS.ORDERS_CREATE,
    RESTAURANT_PERMISSIONS.ORDERS_MODIFY,
    RESTAURANT_PERMISSIONS.ORDERS_CANCEL,
    RESTAURANT_PERMISSIONS.ORDERS_REFUND,
    RESTAURANT_PERMISSIONS.PAYMENTS_VIEW,
    RESTAURANT_PERMISSIONS.PAYMENTS_CREATE,
    RESTAURANT_PERMISSIONS.PAYMENTS_REFUND,
    RESTAURANT_PERMISSIONS.SHIFTS_VIEW,
    RESTAURANT_PERMISSIONS.SHIFTS_OPEN,
    RESTAURANT_PERMISSIONS.SHIFTS_CLOSE,
    RESTAURANT_PERMISSIONS.CUSTOMERS_VIEW,
    RESTAURANT_PERMISSIONS.CUSTOMERS_MANAGE,
    RESTAURANT_PERMISSIONS.PRODUCTS_VIEW,
    RESTAURANT_PERMISSIONS.PRODUCTS_MANAGE,
    RESTAURANT_PERMISSIONS.CATEGORIES_VIEW,
    RESTAURANT_PERMISSIONS.CATEGORIES_MANAGE,
    RESTAURANT_PERMISSIONS.INVENTORY_VIEW,
    RESTAURANT_PERMISSIONS.INVENTORY_MANAGE,
    RESTAURANT_PERMISSIONS.STAFF_VIEW,
    RESTAURANT_PERMISSIONS.REPORTS_VIEW,
    RESTAURANT_PERMISSIONS.SETTINGS_VIEW,
    RESTAURANT_PERMISSIONS.DEVICES_VIEW,
    RESTAURANT_PERMISSIONS.BRANCHES_VIEW,
    RESTAURANT_PERMISSIONS.AUDIT_VIEW,
    RESTAURANT_PERMISSIONS.TABLES_VIEW,
    RESTAURANT_PERMISSIONS.TABLES_MANAGE,
  ],

  CASHIER: [
    RESTAURANT_PERMISSIONS.ORDERS_VIEW,
    RESTAURANT_PERMISSIONS.ORDERS_CREATE,
    RESTAURANT_PERMISSIONS.PAYMENTS_VIEW,
    RESTAURANT_PERMISSIONS.PAYMENTS_CREATE,
    RESTAURANT_PERMISSIONS.SHIFTS_VIEW,
    RESTAURANT_PERMISSIONS.SHIFTS_OPEN,
    RESTAURANT_PERMISSIONS.SHIFTS_CLOSE,
    RESTAURANT_PERMISSIONS.CUSTOMERS_VIEW,
    RESTAURANT_PERMISSIONS.CUSTOMERS_MANAGE,
    RESTAURANT_PERMISSIONS.PRODUCTS_VIEW,
    RESTAURANT_PERMISSIONS.CATEGORIES_VIEW,
    RESTAURANT_PERMISSIONS.TABLES_VIEW,
  ],

  SERVER: [
    RESTAURANT_PERMISSIONS.ORDERS_VIEW,
    RESTAURANT_PERMISSIONS.ORDERS_CREATE,
    RESTAURANT_PERMISSIONS.PRODUCTS_VIEW,
    RESTAURANT_PERMISSIONS.CATEGORIES_VIEW,
    RESTAURANT_PERMISSIONS.TABLES_VIEW,
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
