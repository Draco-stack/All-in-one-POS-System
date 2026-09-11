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
      console.warn('[AuditService] Skipping audit log because organizationId is missing');
      return null;
    }

    const safeMeta = params.metadata ? sanitizeMetadata(params.metadata) : {};

    const entry = await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        branchId: params.branchId || null,
        userId: params.userId || null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        metadata: JSON.stringify(safeMeta),
        ipAddress: params.ipAddress || null,
      },
    });

    return entry;
  } catch (error) {
    console.warn('[AuditService] Error recording audit event:', error);
    return null;
  }
}
