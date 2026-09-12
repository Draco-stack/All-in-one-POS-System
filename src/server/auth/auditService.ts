import prisma from '../prisma';

export const AUDIT_ACTIONS = {
  AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  SESSION_REVOKED: 'SESSION_REVOKED',
  MANAGER_PIN_VERIFIED: 'MANAGER_PIN_VERIFIED',
  MANAGER_PIN_FAILED: 'MANAGER_PIN_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ORGANIZATION_SUSPENDED_BLOCKED: 'ORGANIZATION_SUSPENDED_BLOCKED',
  SUBSCRIPTION_EXPIRED_BLOCKED: 'SUBSCRIPTION_EXPIRED_BLOCKED',
  CROSS_TENANT_ACCESS_DENIED: 'CROSS_TENANT_ACCESS_DENIED',
  // Phase 17 & Phase 22 Registration, Provisioning & Identity
  REGISTRATION_STARTED: 'REGISTRATION_STARTED',
  ORGANIZATION_SIGNUP_STARTED: 'ORGANIZATION_SIGNUP_STARTED',
  EMAIL_VERIFICATION_SENT: 'EMAIL_VERIFICATION_SENT',
  EMAIL_VERIFICATION_FAILED: 'EMAIL_VERIFICATION_FAILED',
  EMAIL_VERIFICATION_RESENT: 'EMAIL_VERIFICATION_RESENT',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  ACCOUNT_CREATED: 'ACCOUNT_CREATED',
  ORGANIZATION_CREATED: 'ORGANIZATION_CREATED',
  BRANCH_CREATED: 'BRANCH_CREATED',
  BRANCH_UPDATED: 'BRANCH_UPDATED',
  BRANCH_DEACTIVATED: 'BRANCH_DEACTIVATED',
  OWNER_ASSIGNED: 'OWNER_ASSIGNED',
  WELCOME_EMAIL_SENT: 'WELCOME_EMAIL_SENT',
  FIRST_LOGIN: 'FIRST_LOGIN',
  TEMPORARY_PASSWORD_CHANGED: 'TEMPORARY_PASSWORD_CHANGED',
  STAFF_CREATED: 'STAFF_CREATED',
  STAFF_UPDATED: 'STAFF_UPDATED',
  STAFF_DEACTIVATED: 'STAFF_DEACTIVATED',
  STAFF_CREDENTIAL_RESET: 'STAFF_CREDENTIAL_RESET',
  ALL_SESSIONS_REVOKED: 'ALL_SESSIONS_REVOKED',
  // Phase 18 Restaurant Operations Control Center
  ORGANIZATION_UPDATED: 'ORGANIZATION_UPDATED',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
  MENU_ITEM_CREATED: 'MENU_ITEM_CREATED',
  MENU_ITEM_UPDATED: 'MENU_ITEM_UPDATED',
  MENU_ITEM_ARCHIVED: 'MENU_ITEM_ARCHIVED',
  INVENTORY_ADJUSTED: 'INVENTORY_ADJUSTED',
  INVENTORY_TRANSFERRED: 'INVENTORY_TRANSFERRED',
  TABLE_CREATED: 'TABLE_CREATED',
  TABLE_UPDATED: 'TABLE_UPDATED',
  TABLE_DELETED: 'TABLE_DELETED',
  VENDOR_CREATED: 'VENDOR_CREATED',
  VENDOR_UPDATED: 'VENDOR_UPDATED',
  KITCHEN_SETTINGS_UPDATED: 'KITCHEN_SETTINGS_UPDATED',
  // Phase 19 Onboarding & Go-Live Readiness
  ONBOARDING_STARTED: 'ONBOARDING_STARTED',
  ONBOARDING_SERVICE_MODEL_SET: 'ONBOARDING_SERVICE_MODEL_SET',
  ONBOARDING_STEP_COMPLETED: 'ONBOARDING_STEP_COMPLETED',
  ONBOARDING_STEP_SKIPPED: 'ONBOARDING_STEP_SKIPPED',
  TEST_ORDER_COMPLETED: 'TEST_ORDER_COMPLETED',
  ONBOARDING_READINESS_CHECKED: 'ONBOARDING_READINESS_CHECKED',
  ONBOARDING_READINESS_FAILED: 'ONBOARDING_READINESS_FAILED',
  ONBOARDING_COMPLETED: 'ONBOARDING_COMPLETED',
  // Phase 20 Production Restaurant Configuration & Advanced Menu Management
  CATEGORY_CREATED: 'CATEGORY_CREATED',
  CATEGORY_UPDATED: 'CATEGORY_UPDATED',
  CATEGORY_ARCHIVED: 'CATEGORY_ARCHIVED',
  CATEGORY_REORDERED: 'CATEGORY_REORDERED',
  MENU_ITEM_RESTORED: 'MENU_ITEM_RESTORED',
  AVAILABILITY_CHANGED: 'AVAILABILITY_CHANGED',
  BULK_MENU_UPDATED: 'BULK_MENU_UPDATED',
  VARIANT_CREATED: 'VARIANT_CREATED',
  VARIANT_UPDATED: 'VARIANT_UPDATED',
  VARIANT_DELETED: 'VARIANT_DELETED',
  MODIFIER_GROUP_CREATED: 'MODIFIER_GROUP_CREATED',
  MODIFIER_GROUP_UPDATED: 'MODIFIER_GROUP_UPDATED',
  MODIFIER_GROUP_DELETED: 'MODIFIER_GROUP_DELETED',
  BRANCH_MENU_OVERRIDE_UPDATED: 'BRANCH_MENU_OVERRIDE_UPDATED',
  MENU_CLONED: 'MENU_CLONED',
  CROSS_BRANCH_ACCESS_DENIED: 'CROSS_BRANCH_ACCESS_DENIED',
  // Phase 23 Professional Account Lifecycle & Branch-Scoped Administration
  OWNER_ACCOUNT_CREATED: 'OWNER_ACCOUNT_CREATED',
  OWNER_EMAIL_VERIFIED: 'OWNER_EMAIL_VERIFIED',
  OWNER_WELCOME_EMAIL_SENT: 'OWNER_WELCOME_EMAIL_SENT',
  OWNER_WELCOME_EMAIL_FAILED: 'OWNER_WELCOME_EMAIL_FAILED',
  STAFF_INVITED: 'STAFF_INVITED',
  STAFF_ACCOUNT_ACTIVATED: 'STAFF_ACCOUNT_ACTIVATED',
  STAFF_ROLE_CHANGED: 'STAFF_ROLE_CHANGED',
  STAFF_BRANCH_ASSIGNED: 'STAFF_BRANCH_ASSIGNED',
  STAFF_BRANCH_UNASSIGNED: 'STAFF_BRANCH_UNASSIGNED',
  STAFF_DISABLED: 'STAFF_DISABLED',
  STAFF_REENABLED: 'STAFF_REENABLED',
  PASSWORD_SETUP_COMPLETED: 'PASSWORD_SETUP_COMPLETED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  // Phase 24 Operational Access & Sensitive Actions
  ORDER_VOIDED: 'ORDER_VOIDED',
  SHIFT_REOPENED: 'SHIFT_REOPENED',
  SENSITIVE_ACTION_AUTHORIZED: 'SENSITIVE_ACTION_AUTHORIZED',
  SENSITIVE_ACTION_DENIED: 'SENSITIVE_ACTION_DENIED',
  // Phase 26 Cash Management, Approvals & Financial Controls
  CASH_MOVEMENT_CREATED: 'CASH_MOVEMENT_CREATED',
  CASH_AUDIT_CONDUCTED: 'CASH_AUDIT_CONDUCTED',
  APPROVAL_REQUESTED: 'APPROVAL_REQUESTED',
  APPROVAL_APPROVED: 'APPROVAL_APPROVED',
  APPROVAL_REJECTED: 'APPROVAL_REJECTED',
  APPROVAL_CANCELLED: 'APPROVAL_CANCELLED',
  VARIANCE_RESOLVED: 'VARIANCE_RESOLVED',
} as const;

export interface LogAuditEventParams {
  organizationId: string;
  branchId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, any>;
  ipAddress?: string | null;
}

const REDACTED_KEYS = new Set([
  'password',
  'pin',
  'passwordhash',
  'pinhash',
  'secret',
  'jwtsecret',
  'token',
  'rawtoken',
  'bearertoken',
  'authorization',
  'x-manager-pin',
  'code',
  'codehash',
  'verificationcode',
  'temporarypassword',
  'temppassword',
  'temppin',
  'activationurl',
  'resettoken',
  'tempcredential',
]);

/**
 * Strips sensitive keys recursively from metadata before persistence.
 */
function sanitizeMetadata(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeMetadata);
  }

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    const lower = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (REDACTED_KEYS.has(lower)) {
      clean[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      clean[key] = sanitizeMetadata(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export async function logAuditEvent(params: LogAuditEventParams) {
  try {
    if (!params.organizationId) {
      return null;
    }

    // Safety: Only insert into relational table if organization actually exists
    const orgExists = await prisma.organization.findUnique({
      where: { id: params.organizationId },
      select: { id: true },
    }).catch(() => null);

    if (!orgExists) {
      // Pre-registration or system events that do not yet have a tenant organization record
      return null;
    }

    let validBranchId: string | null = null;
    if (params.branchId) {
      const branchExists = await prisma.branch.findUnique({
        where: { id: params.branchId },
        select: { id: true },
      }).catch(() => null);
      if (branchExists) validBranchId = branchExists.id;
    }

    let validUserId: string | null = null;
    if (params.userId) {
      const userExists = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { id: true },
      }).catch(() => null);
      if (userExists) validUserId = userExists.id;
    }

    const safeMeta = params.metadata ? sanitizeMetadata(params.metadata) : {};

    const entry = await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        branchId: validBranchId,
        userId: validUserId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        metadata: JSON.stringify(safeMeta),
        ipAddress: params.ipAddress || null,
      },
    });

    return entry;
  } catch (error) {
    return null;
  }
}
