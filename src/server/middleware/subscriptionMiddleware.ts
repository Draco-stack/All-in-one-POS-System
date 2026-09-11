import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../prisma';
import { getSubscriptionDetails, isSubscriptionActive } from '../billing/billingSystem';
import { logAuditEvent, AUDIT_ACTIONS } from '../auth/auditService';
import { RESTAURANT_PERMISSIONS } from '../auth/permissions';

export interface POSEntitlementResult {
  allowed: boolean;
  code?: 'SUBSCRIPTION_EXPIRED' | 'ORGANIZATION_SUSPENDED' | 'ORGANIZATION_CANCELLED' | 'NEEDS_SUBSCRIPTION' | 'ORGANIZATION_NOT_FOUND';
  reason?: string;
  subscription?: any;
}

/**
 * Server-Authoritative POS Entitlement Evaluator
 * Checks organization status and subscription state.
 */
export async function checkPOSEntitlement(organizationId: string): Promise<POSEntitlementResult> {
  if (!organizationId) {
    return {
      allowed: false,
      code: 'ORGANIZATION_NOT_FOUND',
      reason: 'Tenant organization ID required',
    };
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, status: true, name: true, slug: true },
  });

  if (!org) {
    return {
      allowed: false,
      code: 'ORGANIZATION_NOT_FOUND',
      reason: 'Organization record not found',
    };
  }

  if (org.status === 'SUSPENDED') {
    return {
      allowed: false,
      code: 'ORGANIZATION_SUSPENDED',
      reason: 'Forbidden: Restaurant organization account is suspended. Please contact Tillora support.',
    };
  }

  if (org.status === 'CANCELLED') {
    return {
      allowed: false,
      code: 'ORGANIZATION_CANCELLED',
      reason: 'Forbidden: Restaurant organization account is cancelled.',
    };
  }

  const subscriptionDetails = await getSubscriptionDetails(organizationId);
  const active = isSubscriptionActive(subscriptionDetails);

  if (!active) {
    let reason = 'Forbidden: Restaurant subscription or trial has expired. POS access is locked until renewed.';
    if (subscriptionDetails.status === 'TRIALING') {
      reason = 'Forbidden: Restaurant 14-day trial has expired. POS access is locked until a plan is subscribed.';
    }

    return {
      allowed: false,
      code: 'SUBSCRIPTION_EXPIRED',
      reason,
      subscription: subscriptionDetails,
    };
  }

  return {
    allowed: true,
    subscription: subscriptionDetails,
  };
}

/**
 * Express Middleware: requireActiveSubscription
 * Guards all POS operational endpoints.
 */
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant;
    if (!tenant || !tenant.organizationId) {
      return res.status(401).json({ error: 'Unauthorized: Tenant authentication required' });
    }

    const entitlement = await checkPOSEntitlement(tenant.organizationId);

    if (!entitlement.allowed) {
      logAuditEvent({
        organizationId: tenant.organizationId,
        branchId: tenant.branchId || null,
        userId: tenant.userId || null,
        action: entitlement.code === 'ORGANIZATION_SUSPENDED'
          ? AUDIT_ACTIONS.ORGANIZATION_SUSPENDED_BLOCKED
          : AUDIT_ACTIONS.SUBSCRIPTION_EXPIRED_BLOCKED,
        entity: 'POS_OPERATION',
        entityId: req.path,
        metadata: {
          path: req.path,
          method: req.method,
          code: entitlement.code,
          reason: entitlement.reason,
        },
        ipAddress: req.ip,
      }).catch(() => {});

      return res.status(403).json({
        error: entitlement.reason,
        code: entitlement.code,
        subscriptionExpired: entitlement.code === 'SUBSCRIPTION_EXPIRED',
        organizationId: tenant.organizationId,
      });
    }

    return next();
  } catch (error) {
    console.error('[SubscriptionMiddleware] Error checking entitlement:', error);
    return res.status(500).json({ error: 'Internal server error checking POS subscription entitlement' });
  }
}

/**
 * Express Middleware: requireCustomerPortalAccess
 * Guards /api/portal/* endpoints.
 * Restricts access to Owners, Admins, or Managers with settings/portal permissions.
 * DOES NOT block when subscription is expired (so owners can manage billing/renewal).
 */
export function requireCustomerPortalAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant;
    if (!tenant || !tenant.organizationId) {
      return res.status(401).json({ error: 'Unauthorized: Tenant authentication required' });
    }

    const role = (tenant.role || '').toUpperCase();

    // 1. OWNER and ADMIN always have full Customer Portal access
    if (role === 'OWNER' || role === 'ADMIN' || role === 'EXECUTIVE_ADMIN' || role === 'PLATFORM_ADMIN') {
      return next();
    }

    // 2. MANAGER or other roles must have explicit settings/portal permission
    const permissions = tenant.permissions || [];
    const hasPortalPermission = permissions.some((p) =>
      p === RESTAURANT_PERMISSIONS.SETTINGS_VIEW ||
      p === RESTAURANT_PERMISSIONS.SETTINGS_MANAGE ||
      p === 'portal.access' ||
      p === 'PORTAL_ACCESS'
    );

    if (role === 'MANAGER' && permissions.length === 0) {
      // Default MANAGER role has setting access
      return next();
    }

    if (hasPortalPermission) {
      return next();
    }

    // Non-administrative roles (e.g. CASHIER, SERVER, RIDER) are strictly denied
    logAuditEvent({
      organizationId: tenant.organizationId,
      branchId: tenant.branchId || null,
      userId: tenant.userId || null,
      action: AUDIT_ACTIONS.PERMISSION_DENIED,
      entity: 'CUSTOMER_PORTAL',
      entityId: req.path,
      metadata: {
        role,
        path: req.path,
        reason: 'Non-administrative role attempted Customer Portal access',
      },
      ipAddress: req.ip,
    }).catch(() => {});

    return res.status(403).json({
      error: 'Forbidden: Insufficient permissions to access the Customer Portal. Administrative privileges required.',
      code: 'PORTAL_ACCESS_DENIED',
    });
  } catch (error) {
    console.error('[SubscriptionMiddleware] Error checking portal access:', error);
    return res.status(500).json({ error: 'Internal server error checking Customer Portal access' });
  }
}

/**
 * Issues a server-signed offline lease object for offline POS resilience verification.
 */
export function issueOfflineLease(organizationId: string, branchId?: string, isSubscriptionActive: boolean = true) {
  const secret = process.env.LICENSE_SECRET || 'whites-castle-hmac-license-key-2026';
  const issuedAt = new Date().toISOString();
  // 24-hour lease window
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const payload = `${organizationId}:${branchId || 'default'}:${issuedAt}:${expiresAt}:${isSubscriptionActive}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return {
    organizationId,
    branchId: branchId || null,
    issuedAt,
    expiresAt,
    isSubscriptionActive,
    signature,
  };
}
