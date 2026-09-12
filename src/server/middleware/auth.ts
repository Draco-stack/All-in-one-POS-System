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

    // 1. Fetch user from DB with branch assignments
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        organization: true,
        branch: true,
        branchAssignments: true,
      },
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Unauthorized: User account is inactive or not found' });
    }

    // 2. Check mustChangePassword constraint (Phase 22)
    // Rejects regular business operations until temporary password is changed
    const isPasswordChangeRoute =
      req.path.includes('/change-password') ||
      req.originalUrl.includes('/change-password') ||
      req.path.includes('/auth/logout') ||
      req.path.includes('/auth/validate-session') ||
      req.path.includes('/auth/me');

    if (user.mustChangePassword && !isPasswordChangeRoute) {
      return res.status(403).json({
        error: 'Password change required before accessing business operations.',
        code: 'PASSWORD_CHANGE_REQUIRED',
        mustChangePassword: true,
      });
    }

    // 3. Resolve organization (use user's assigned organization or fallback to payload organization)
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

    // 4. Organization Status Enforcement
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

    // 5. Branch Resolution & Branch-Scoped Access Control (Phase 22)
    const userRole = (user.role || '').toUpperCase();
    let authorizedBranchIds: string[] = [];

    if (userRole === 'OWNER' || userRole === 'PLATFORM_ADMIN' || userRole === 'EXECUTIVE_ADMIN') {
      // Owners have multi-branch access across all active branches within their organization
      const orgBranches = await prisma.branch.findMany({
        where: { organizationId: organization.id, active: true },
        select: { id: true },
      });
      authorizedBranchIds = orgBranches.map((b) => b.id);
    } else {
      // Non-owners (managers, staff) are strictly restricted to assigned branches
      const assigned = (user.branchAssignments || []).map((ba) => ba.branchId);
      if (user.branchId) assigned.push(user.branchId);
      authorizedBranchIds = [...new Set(assigned)];
    }

    // Check requested branch from client headers, query parameters, or token payload
    const requestedBranchId =
      (req.headers['x-branch-id'] as string) ||
      (req.query.branchId as string) ||
      payload.branchId ||
      null;

    let branch = user.branch;

    if (requestedBranchId) {
      // Verify branch exists and belongs to the user's organization
      const targetBranch = await prisma.branch.findFirst({
        where: {
          id: requestedBranchId,
          organizationId: organization.id,
          active: true,
        },
      });

      if (!targetBranch) {
        return res.status(403).json({
          error: 'Forbidden: Requested branch does not exist or does not belong to your organization.',
          code: 'INVALID_BRANCH',
        });
      }

      // Check if user is authorized for this branch
      if (!authorizedBranchIds.includes(targetBranch.id)) {
        await logAuditEvent({
          organizationId: organization.id,
          branchId: targetBranch.id,
          userId: user.id,
          action: AUDIT_ACTIONS.CROSS_BRANCH_ACCESS_DENIED,
          entity: 'BRANCH',
          entityId: targetBranch.id,
          metadata: {
            requestedBranchId: targetBranch.id,
            authorizedBranchIds,
            userRole,
          },
          ipAddress: req.ip,
        }).catch(() => {});

        return res.status(403).json({
          error: 'Forbidden: You are not authorized to access this branch.',
          code: 'CROSS_BRANCH_ACCESS_DENIED',
        });
      }

      branch = targetBranch;
    } else if (!branch && authorizedBranchIds.length > 0) {
      branch = await prisma.branch.findFirst({
        where: {
          id: { in: authorizedBranchIds },
          organizationId: organization.id,
          active: true,
        },
      });
    }

    // 6. Session Validation (if sessionId is present)
    if (payload.sessionId) {
      const isValidSession = await validateSession(payload.sessionId, rawToken);
      if (!isValidSession) {
        return res.status(401).json({ error: 'Unauthorized: Session has expired or been revoked' });
      }
    }

    // 7. Compute Effective Permissions
    const permissions = getEffectivePermissions(user.role, user.restrictions);

    // 8. Attach Typed Context
    req.auth = {
      userId: user.id,
      role: user.role,
      name: user.name,
      username: user.username,
      authorizedBranchIds,
      mustChangePassword: user.mustChangePassword,
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
      authorizedBranchIds,
      mustChangePassword: user.mustChangePassword,
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
 * Branch-Scoped Authorization Middleware (Phase 22).
 * Verifies that the client has explicit authorization for the target branch
 * specified in headers ('x-branch-id'), query (?branchId=), or route params (:branchId).
 * Owners and Platform Admins have organization-wide multi-branch authorization.
 * All other roles (Manager, Staff) are strictly confined to their assigned branch(es).
 */
export function enforceBranchScope(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant) {
    return res.status(401).json({ error: 'Unauthorized: Tenant authentication required' });
  }

  const role = (req.tenant.role || '').toUpperCase();
  if (role === 'OWNER' || role === 'PLATFORM_ADMIN' || role === 'EXECUTIVE_ADMIN') {
    return next();
  }

  const requestedBranchId =
    (req.headers['x-branch-id'] as string) ||
    (req.query.branchId as string) ||
    (req.params && req.params.branchId) ||
    (req.body && req.body.branchId) ||
    null;

  if (!requestedBranchId) {
    return next();
  }

  const allowedBranchIds = req.tenant.authorizedBranchIds || (req.tenant.branchId ? [req.tenant.branchId] : []);

  if (!allowedBranchIds.includes(requestedBranchId)) {
    logAuditEvent({
      organizationId: req.tenant.organizationId,
      branchId: requestedBranchId,
      userId: req.tenant.userId,
      action: AUDIT_ACTIONS.CROSS_BRANCH_ACCESS_DENIED,
      entity: 'BRANCH',
      entityId: requestedBranchId,
      metadata: {
        attemptedBranchId: requestedBranchId,
        authorizedBranchIds: allowedBranchIds,
        userRole: role,
      },
      ipAddress: req.ip,
    }).catch(() => {});

    return res.status(403).json({
      error: 'Forbidden: You are not authorized to view or manage this branch.',
      code: 'CROSS_BRANCH_ACCESS_DENIED',
    });
  }

  return next();
}

/**
 * Platform Executive Admin Authorization Middleware.
 * 
 * Strictly guards /api/platform-admin endpoints.
 * Only users with PLATFORM_ADMIN or EXECUTIVE_ADMIN role are allowed.
 * Restaurant-level roles (OWNER, ADMIN, MANAGER, CASHIER, etc.) are strictly FORBIDDEN (403).
 */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.tenant && !req.auth) {
    return res.status(401).json({ error: 'Unauthorized: Platform admin authentication required' });
  }

  const role = (req.tenant?.role || req.auth?.role || '').toUpperCase();
  const isPlatformAdmin = role === 'PLATFORM_ADMIN' || role === 'EXECUTIVE_ADMIN';

  if (!isPlatformAdmin) {
    logAuditEvent({
      organizationId: req.tenant?.organizationId || 'PLATFORM',
      branchId: req.tenant?.branchId || null,
      userId: req.tenant?.userId || req.auth?.userId || 'anonymous',
      action: AUDIT_ACTIONS.PERMISSION_DENIED,
      entity: 'PLATFORM_ADMIN_GATE',
      entityId: req.path,
      metadata: {
        reason: 'Attempted unauthorized access to platform admin interface',
        attemptedRole: role,
        path: req.path,
      },
      ipAddress: req.ip,
    }).catch(() => {});

    return res.status(403).json({
      error: 'Forbidden: Platform Executive Administrator privileges required.',
      code: 'FORBIDDEN_PLATFORM_ADMIN_REQUIRED',
    });
  }

  return next();
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
