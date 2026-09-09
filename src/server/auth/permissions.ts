export const PERMISSIONS = {
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

  // Staff / User management
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

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Default permission matrix mapped by role.
 * OWNER: Complete administrative rights within the organization.
 * ADMIN: Organization administrator (not platform superadmin).
 * MANAGER: Operational oversight (staff management, adjustments, inventory, cancellations).
 * CASHIER: Day-to-day point of sale transactions, shifts, customer records.
 * SERVER: Dine-in order punching and table status.
 * RIDER: Delivery status and route updates.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: Object.values(PERMISSIONS),

  ADMIN: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_MODIFY,
    PERMISSIONS.ORDERS_CANCEL,
    PERMISSIONS.ORDERS_REFUND,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.PAYMENTS_REFUND,
    PERMISSIONS.SHIFTS_VIEW,
    PERMISSIONS.SHIFTS_OPEN,
    PERMISSIONS.SHIFTS_CLOSE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_MANAGE,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.CATEGORIES_VIEW,
    PERMISSIONS.CATEGORIES_MANAGE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.STAFF_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.DEVICES_VIEW,
    PERMISSIONS.DEVICES_MANAGE,
    PERMISSIONS.BRANCHES_VIEW,
    PERMISSIONS.BRANCHES_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.TABLES_VIEW,
    PERMISSIONS.TABLES_MANAGE,
  ],

  MANAGER: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_MODIFY,
    PERMISSIONS.ORDERS_CANCEL,
    PERMISSIONS.ORDERS_REFUND,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.PAYMENTS_REFUND,
    PERMISSIONS.SHIFTS_VIEW,
    PERMISSIONS.SHIFTS_OPEN,
    PERMISSIONS.SHIFTS_CLOSE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_MANAGE,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.CATEGORIES_VIEW,
    PERMISSIONS.CATEGORIES_MANAGE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.DEVICES_VIEW,
    PERMISSIONS.BRANCHES_VIEW,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.TABLES_VIEW,
    PERMISSIONS.TABLES_MANAGE,
  ],

  CASHIER: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.SHIFTS_VIEW,
    PERMISSIONS.SHIFTS_OPEN,
    PERMISSIONS.SHIFTS_CLOSE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_MANAGE,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.CATEGORIES_VIEW,
    PERMISSIONS.TABLES_VIEW,
  ],

  SERVER: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.CATEGORIES_VIEW,
    PERMISSIONS.TABLES_VIEW,
  ],

  RIDER: [
    PERMISSIONS.ORDERS_VIEW,
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
