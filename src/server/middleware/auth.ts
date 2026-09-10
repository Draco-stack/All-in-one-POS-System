import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { verifyTenantToken } from '../auth/jwt';
import { validateSession } from '../auth/sessionService';
import { getEffectivePermissions, Permission } from '../auth/permissions';
import { logAuditEvent, AUDIT_ACTIONS } from '../auth/auditService';
import { DEFAULT_ORG_ID, DEFAULT_ORG_SLUG } from '../seed';

/**
 * Extracts Bearer token from Authorization header.
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return null;
}

/**
 * Primary authentication middleware.
 * Verifies JWT token, loads user & tenant organization from database,
 * checks organization active/trial status, verifies branch access,
 * checks session status, and attaches type-safe req.tenant and req.auth.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const rawToken = extractBearerToken(req);
    if (!rawToken) {
      return res.status(401).json({ error: 'Unauthorized: Authentication token required' });
    }

    const payload = verifyTenantToken(rawToken);
    if (!payload || !payload.userId) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token' });
    }

    // 1. Fetch user from DB
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        organization: true,
        branch: true,
      },
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Unauthorized: User account is inactive or not found' });
    }

    // 2. Resolve organization (use user's assigned organization or fallback to payload organization)
    let organization = user.organization;
    if (!organization && payload.organizationId) {
      organization = await prisma.organization.findUnique({
        where: { id: payload.organizationId },
      });
    }

    if (!organization) {
      return res.status(403).json({
        error: 'Forbidden: Organization required. Please complete onboarding.',
        code: 'NEEDS_ONBOARDING',
        needsOnboarding: true,
      });
    }

    // 3. Organization Status Enforcement
    // ACTIVE and TRIAL are allowed. SUSPENDED and CANCELLED are strictly blocked.
    if (organization.status === 'SUSPENDED') {
      await logAuditEvent({
        organizationId: organization.id,
        userId: user.id,
        action: AUDIT_ACTIONS.ORGANIZATION_SUSPENDED_BLOCKED,
        entity: 'ORGANIZATION',
        entityId: organization.id,
        metadata: { reason: 'Access attempt on suspended tenant' },
        ipAddress: req.ip,
      });
      return res.status(403).json({
        error: 'Forbidden: Organization account is suspended. Please contact support.',
        code: 'ORGANIZATION_SUSPENDED',
      });
    }

    if (organization.status === 'CANCELLED') {
      return res.status(403).json({
        error: 'Forbidden: Organization account is cancelled.',
        code: 'ORGANIZATION_CANCELLED',
      });
    }

    // 4. Branch Resolution & Access Control
    let branch = user.branch;
    // If payload specified a branch, verify it belongs to this organization
    if (payload.branchId && (!branch || branch.id !== payload.branchId)) {
      const requestedBranch = await prisma.branch.findFirst({
        where: {
          id: payload.branchId,
          organizationId: organization.id,
          active: true,
        },
      });
      if (requestedBranch) {
        branch = requestedBranch;
      }
    }

    if (!branch) {
      branch = await prisma.branch.findFirst({
        where: {
          organizationId: organization.id,
          active: true,
        },
      });
    }

    // 5. Session Validation (if sessionId is present)
    if (payload.sessionId) {
      const isValidSession = await validateSession(payload.sessionId, rawToken);
      if (!isValidSession) {
        return res.status(401).json({ error: 'Unauthorized: Session has expired or been revoked' });
      }
    }

    // 6. Compute Effective Permissions
    const permissions = getEffectivePermissions(user.role, user.restrictions);

    // 7. Attach Typed Context
    req.auth = {
      userId: user.id,
      role: user.role,
      name: user.name,
      username: user.username,
    };

    req.tenant = {
      userId: user.id,
      organizationId: organization.id,
      branchId: branch?.id || null,
      sessionId: payload.sessionId,
      role: user.role,
      name: user.name,
      username: user.username,
      organizationSlug: organization.slug,
      organizationName: organization.name,
      organizationStatus: organization.status,
      branchName: branch?.name || null,
      permissions,
    };

    // Backward-compatibility for legacy handlers expecting req.user
    req.user = {
      id: user.id,
      role: user.role,
      name: user.name,
      organizationId: organization.id,
      branchId: branch?.id || null,
    };

    return next();
  } catch (error) {
    console.error('[Authenticate Middleware] Error:', error);
    return res.status(401).json({ error: 'Unauthorized: Authentication processing failed' });
  }
}

/**
 * Optional authentication middleware. Populates req.tenant if valid Bearer token provided,
 * otherwise proceeds.
 */
export async function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const rawToken = extractBearerToken(req);
  if (!rawToken) {
    return next();
  }
  return authenticate(req, res, next);
}

/**
 * Ensures authenticated tenant context exists.
 */
export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant || !req.tenant.organizationId) {
    return res.status(401).json({ error: 'Unauthorized: Tenant context required' });
  }
  return next();
}

/**
 * Enforces a specific permission requirement.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant) {
      return res.status(401).json({ error: 'Unauthorized: Tenant authentication required' });
    }

    const hasAccess = req.tenant.permissions.includes(permission);
    if (!hasAccess) {
      logAuditEvent({
        organizationId: req.tenant.organizationId,
        branchId: req.tenant.branchId,
        userId: req.tenant.userId,
        action: AUDIT_ACTIONS.PERMISSION_DENIED,
        entity: 'PERMISSION',
        entityId: permission,
        metadata: {
          requiredPermission: permission,
          userRole: req.tenant.role,
        },
        ipAddress: req.ip,
      }).catch(() => {});

      return res.status(403).json({
        error: `Forbidden: Missing required permission [${permission}]`,
        requiredPermission: permission,
      });
    }

    return next();
  };
}

/**
 * Enforces a role requirement.
 */
export function requireRole(allowedRoles: string[]) {
  const normalized = allowedRoles.map((r) => r.toUpperCase());
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant) {
      return res.status(401).json({ error: 'Unauthorized: Tenant authentication required' });
    }

    const currentRole = (req.tenant.role || '').toUpperCase();
    if (!normalized.includes(currentRole)) {
      logAuditEvent({
        organizationId: req.tenant.organizationId,
        branchId: req.tenant.branchId,
        userId: req.tenant.userId,
        action: AUDIT_ACTIONS.PERMISSION_DENIED,
        entity: 'ROLE',
        entityId: currentRole,
        metadata: {
          allowedRoles: normalized,
          userRole: currentRole,
        },
        ipAddress: req.ip,
      }).catch(() => {});

      return res.status(403).json({
        error: 'Forbidden: Insufficient role permissions for this operation',
      });
    }

    return next();
  };
}

/**
 * Tenant-Isolated Manager Authentication Middleware.
 * 
 * Supports two authentication paths:
 * 1. Bearer JWT from an authenticated OWNER, ADMIN, or MANAGER within the tenant organization.
 * 2. x-manager-pin header: Verifies PIN strictly against active managers belonging to the
 *    CURRENT tenant organization. NEVER queries managers across different organizations.
 */
export async function authenticateManager(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Try Bearer JWT validation first
    const rawToken = extractBearerToken(req);
    if (rawToken) {
      const payload = verifyTenantToken(rawToken);
      if (payload && payload.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: payload.userId },
          include: { organization: true, branch: true },
        });

        if (
          dbUser &&
          dbUser.active &&
          ['OWNER', 'ADMIN', 'MANAGER'].includes(dbUser.role.toUpperCase())
        ) {
          const org = dbUser.organization || (await prisma.organization.findUnique({ where: { id: DEFAULT_ORG_ID } }));
          if (org) {
            if (org.status === 'SUSPENDED' || org.status === 'CANCELLED') {
              return res.status(403).json({ error: 'Forbidden: Organization is inactive or suspended' });
            }

            const permissions = getEffectivePermissions(dbUser.role, dbUser.restrictions);
            req.auth = {
              userId: dbUser.id,
              role: dbUser.role,
              name: dbUser.name,
              username: dbUser.username,
            };
            req.tenant = {
              userId: dbUser.id,
              organizationId: org.id,
              branchId: dbUser.branchId || null,
              sessionId: payload.sessionId,
              role: dbUser.role,
              name: dbUser.name,
              username: dbUser.username,
              organizationSlug: org.slug,
              organizationName: org.name,
              organizationStatus: org.status,
              branchName: dbUser.branch?.name || null,
              permissions,
            };
            req.user = {
              id: dbUser.id,
              role: dbUser.role,
              name: dbUser.name,
              organizationId: org.id,
              branchId: dbUser.branchId || null,
            };

            return next();
          }
        }
      }
    }

    // 2. Try Manager PIN header (x-manager-pin)
    const managerPinHeader = req.headers['x-manager-pin'];
    if (typeof managerPinHeader === 'string' && managerPinHeader.trim().length >= 4) {
      const cleanPin = managerPinHeader.trim();

      // Resolve tenant organization context for PIN verification:
      // Priority:
      // A. Existing req.tenant if already authenticated
      // B. x-organization-id or x-organization-slug header
      // C. Default organization fallback for workstation POS
      let targetOrgId = req.tenant?.organizationId;

      if (!targetOrgId) {
        const headerOrgId = req.headers['x-organization-id'] as string;
        const headerOrgSlug = req.headers['x-organization-slug'] as string;

        if (headerOrgId) {
          const org = await prisma.organization.findUnique({ where: { id: headerOrgId } });
          if (org) targetOrgId = org.id;
        } else if (headerOrgSlug) {
          const org = await prisma.organization.findUnique({ where: { slug: headerOrgSlug } });
          if (org) targetOrgId = org.id;
        } else {
          targetOrgId = DEFAULT_ORG_ID;
        }
      }

      if (!targetOrgId) {
        return res.status(403).json({ error: 'Forbidden: Tenant organization context required for manager verification' });
      }

      // STRICT TENANT ISOLATION:
      // Only query active managers belonging to targetOrgId!
      const activeTenantManagers = await prisma.user.findMany({
        where: {
          organizationId: targetOrgId,
          role: { in: ['OWNER', 'MANAGER', 'ADMIN', 'owner', 'manager', 'admin'] },
          active: true,
        },
        include: {
          organization: true,
          branch: true,
        },
      });

      for (const mgr of activeTenantManagers) {
        const isMatch = mgr.pin.startsWith('$2')
          ? await bcrypt.compare(cleanPin, mgr.pin)
          : cleanPin === mgr.pin;

        if (isMatch) {
          // If unhashed PIN, upgrade in background
          if (!mgr.pin.startsWith('$2')) {
            bcrypt.hash(cleanPin, 10).then((hashed) => {
              prisma.user.update({ where: { id: mgr.id }, data: { pin: hashed } }).catch(() => {});
            });
          }

          const org = mgr.organization || (await prisma.organization.findUnique({ where: { id: targetOrgId } }));
          if (org && (org.status === 'SUSPENDED' || org.status === 'CANCELLED')) {
            return res.status(403).json({ error: 'Forbidden: Organization is inactive or suspended' });
          }

          const permissions = getEffectivePermissions(mgr.role, mgr.restrictions);

          req.auth = {
            userId: mgr.id,
            role: mgr.role,
            name: mgr.name,
            username: mgr.username,
          };
          req.tenant = {
            userId: mgr.id,
            organizationId: targetOrgId,
            branchId: mgr.branchId || null,
            role: mgr.role,
            name: mgr.name,
            username: mgr.username,
            organizationSlug: org?.slug || '',
            organizationName: org?.name || '',
            organizationStatus: org?.status || 'ACTIVE',
            branchName: mgr.branch?.name || null,
            permissions,
          };
          req.user = {
            id: mgr.id,
            role: mgr.role,
            name: mgr.name,
            organizationId: targetOrgId,
            branchId: mgr.branchId || null,
          };

          // Record audit log of successful manager elevation
          logAuditEvent({
            organizationId: targetOrgId,
            branchId: mgr.branchId,
            userId: mgr.id,
            action: AUDIT_ACTIONS.MANAGER_PIN_VERIFIED,
            entity: 'MANAGER_PIN',
            entityId: mgr.id,
            metadata: { managerName: mgr.name, role: mgr.role },
            ipAddress: req.ip,
          }).catch(() => {});

          return next();
        }
      }

      // Record failed manager PIN attempt
      logAuditEvent({
        organizationId: targetOrgId,
        action: AUDIT_ACTIONS.MANAGER_PIN_FAILED,
        entity: 'MANAGER_PIN',
        metadata: { attemptedAt: new Date().toISOString() },
        ipAddress: req.ip,
      }).catch(() => {});
    }

    return res.status(403).json({ error: 'Forbidden: Elevated manager credentials required' });
  } catch (err) {
    console.error('[authenticateManager] Error:', err);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired manager authorization' });
  }
}
