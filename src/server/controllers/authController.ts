import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { signTenantToken, verifyTenantToken } from '../auth/jwt';
import { createSession, revokeSession, validateSession } from '../auth/sessionService';
import { logAuditEvent, AUDIT_ACTIONS } from '../auth/auditService';
import { DEFAULT_ORG_ID, DEFAULT_ORG_SLUG } from '../seed';


interface LoginFailureTracker {
  attempts: number;
  lockoutUntil: Date | null;
}
const loginFailuresMap = new Map<string, LoginFailureTracker>();

function getLockoutKey(username: string, ip: string): string {
  return `${String(username).trim().toLowerCase()}:${ip}`;
}

export function recordLoginFailure(key: string) {
  const current = loginFailuresMap.get(key) || { attempts: 0, lockoutUntil: null };
  current.attempts += 1;
  if (current.attempts >= 5) {
    current.lockoutUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes lockout
  }
  loginFailuresMap.set(key, current);
}

export function isLoginLocked(key: string): boolean {
  const current = loginFailuresMap.get(key);
  if (!current) return false;
  if (current.lockoutUntil && new Date() < current.lockoutUntil) {
    return true;
  }
  if (current.lockoutUntil && new Date() >= current.lockoutUntil) {
    loginFailuresMap.delete(key);
  }
  return false;
}

export function resetLoginFailures(key: string) {
  loginFailuresMap.delete(key);
}

/**
 * Strips sensitive fields (PINs, passwords, hashes) before sending user data to clients.
 */
export function sanitizeUser(user: any) {
  if (!user) return null;
  const { pin, password, ...safeUser } = user;
  return safeUser;
}

/**
 * Tenant-Aware Login Handler.
 * Authenticates user, enforces organization & branch membership, enforces organization status,
 * creates an active session, and issues a tenant-scoped JWT.
 */
export async function loginHandler(req: Request, res: Response) {
  try {
    const { pin, password, username, email, organizationSlug, organizationId } = req.body;
    const rawPin = String(pin || password || '').trim();
    if (!rawPin) {
      return res.status(400).json({ error: 'PIN or Password required' });
    }

    const rawUser = String(username || email || '').trim().toLowerCase();
    const lockoutKey = getLockoutKey(rawUser, req.ip || 'unknown');

    if (isLoginLocked(lockoutKey)) {
      return res.status(429).json({
        error: 'Too many failed login attempts. Your account is locked out for 5 minutes.',
        code: 'ACCOUNT_LOCKED_OUT',
      });
    }


    // 1. Resolve Target Organization if provided via payload or header
    let targetOrgId: string | null = null;
    const headerOrgId = req.headers['x-organization-id'] as string;
    const headerOrgSlug = req.headers['x-organization-slug'] as string;

    const orgIdentifier = organizationId || headerOrgId;
    const orgSlugIdentifier = organizationSlug || headerOrgSlug;

    if (orgIdentifier) {
      const org = await prisma.organization.findUnique({ where: { id: orgIdentifier } });
      if (org) targetOrgId = org.id;
    } else if (orgSlugIdentifier) {
      const org = await prisma.organization.findUnique({ where: { slug: orgSlugIdentifier } });
      if (org) targetOrgId = org.id;
    }

    // 2. Query Users
    let userQueryWhere: any = { active: true };
    if (targetOrgId) {
      userQueryWhere.organizationId = targetOrgId;
    }

    const users = await prisma.user.findMany({
      where: userQueryWhere,
      include: {
        organization: true,
        branch: true,
      },
    });

    let matchedUser: any = null;

    if (rawUser) {
      const userPrefix = rawUser.includes('@') ? rawUser.split('@')[0] : rawUser;
      const compactUser = rawUser.replace(/[\s._-]+/g, '');
      const compactPrefix = userPrefix.replace(/[\s._-]+/g, '');

      // A. Exact username match
      matchedUser = users.find((u) => {
        const uUsername = (u.username || '').toLowerCase();
        return (
          uUsername === rawUser ||
          uUsername === userPrefix ||
          uUsername.replace(/[\s._-]+/g, '') === compactUser ||
          uUsername.replace(/[\s._-]+/g, '') === compactPrefix
        );
      });

      // B. Standard roles and aliases
      if (!matchedUser) {
        if (['admin', 'owner', 'root'].includes(compactPrefix) || ['admin', 'owner'].includes(rawUser)) {
          matchedUser = users.find((u) => u.role === 'OWNER' || u.username === 'admin');
        } else if (['manager', 'storemanager'].includes(compactPrefix) || rawUser === 'manager') {
          matchedUser = users.find((u) => u.role === 'MANAGER' || u.username === 'manager');
        } else if (['cashier', 'pos'].includes(compactPrefix) || rawUser === 'cashier') {
          matchedUser = users.find((u) => u.role === 'CASHIER' || u.username === 'cashier');
        }
      }

      // C. Fallback to name match
      if (!matchedUser) {
        matchedUser = users.find((u) => (u.name || '').toLowerCase().includes(rawUser));
      }
    }

    // 3. Credential Verification
    if (matchedUser) {
      const isMatch = matchedUser.pin.startsWith('$2')
        ? await bcrypt.compare(rawPin, matchedUser.pin)
        : rawPin === matchedUser.pin;

      if (!isMatch) {
        recordLoginFailure(lockoutKey);
        if (matchedUser.organizationId) {
          logAuditEvent({
            organizationId: matchedUser.organizationId,
            userId: matchedUser.id,
            action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
            entity: 'USER',
            entityId: matchedUser.id,
            metadata: { username: matchedUser.username, reason: 'Bad credentials' },
            ipAddress: req.ip,
          }).catch(() => {});
        }
        return res.status(401).json({ error: 'Invalid Password or PIN' });
      }
    } else {
      // PIN-only match across scoped users
      for (const u of users) {
        const isMatch = u.pin.startsWith('$2')
          ? await bcrypt.compare(rawPin, u.pin)
          : rawPin === u.pin;
        if (isMatch) {
          matchedUser = u;
          break;
        }
      }
    }

    if (!matchedUser) {
      recordLoginFailure(lockoutKey);
      return res.status(401).json({ error: 'Invalid Password or PIN' });
    }

    resetLoginFailures(lockoutKey);

    // Auto-hash plaintext PIN on successful login for ongoing security upgrade
    if (!matchedUser.pin.startsWith('$2')) {
      bcrypt.hash(rawPin, 10).then((hashed) => {
        prisma.user.update({
          where: { id: matchedUser.id },
          data: { pin: hashed },
        }).catch(() => {});
      });
    }

    // 4. Resolve & Verify Organization
    let organization = matchedUser.organization;
    if (!organization && matchedUser.organizationId) {
      organization = await prisma.organization.findUnique({
        where: { id: matchedUser.organizationId },
      });
    }

    if (!organization) {
      organization = await prisma.organization.findUnique({
        where: { id: DEFAULT_ORG_ID },
      });
    }

    if (!organization) {
      return res.status(401).json({ error: 'Organization not found' });
    }

    // 5. Enforce Organization Status
    if (organization.status === 'SUSPENDED') {
      logAuditEvent({
        organizationId: organization.id,
        userId: matchedUser.id,
        action: AUDIT_ACTIONS.ORGANIZATION_SUSPENDED_BLOCKED,
        entity: 'ORGANIZATION',
        entityId: organization.id,
        metadata: { reason: 'Login attempt on suspended organization' },
        ipAddress: req.ip,
      }).catch(() => {});

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

    // 6. Branch Resolution
    const branch = matchedUser.branch || null;

    // 7. Create Session
    const session = await createSession({
      userId: matchedUser.id,
      organizationId: organization.id,
      branchId: branch?.id || null,
      deviceInfo: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    // 8. Sign Tenant-Aware JWT
    const token = signTenantToken({
      userId: matchedUser.id,
      organizationId: organization.id,
      branchId: branch?.id || null,
      sessionId: session?.id,
      role: matchedUser.role,
      name: matchedUser.name,
    });

    // 9. Record Successful Login Audit Log
    logAuditEvent({
      organizationId: organization.id,
      branchId: branch?.id || null,
      userId: matchedUser.id,
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
      entity: 'USER',
      entityId: matchedUser.id,
      metadata: { username: matchedUser.username, role: matchedUser.role, sessionId: session?.id },
      ipAddress: req.ip,
    }).catch(() => {});

    // 10. Return Safe Response
    const safeUser = sanitizeUser(matchedUser);
    const safeOrg = {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
    };
    const safeBranch = branch
      ? {
          id: branch.id,
          name: branch.name,
          slug: branch.slug,
          taxRate: branch.taxRate,
          active: branch.active,
        }
      : null;

    return res.json({
      token,
      user: safeUser,
      organization: safeOrg,
      branch: safeBranch,
    });
  } catch (error) {
    console.error('[LoginHandler] Error:', error);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
}

/**
 * Tenant-Aware Session Validation Handler.
 * Validates token signature, DB user status, organization active status, and session revocation.
 */
export async function validateSessionHandler(req: Request, res: Response) {
  try {
    const { userId, pin, token } = req.body;
    if (!userId) {
      return res.status(400).json({ valid: false, error: 'User ID is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true, branch: true },
    });

    if (!user || !user.active) {
      return res.json({ valid: false, reason: 'User not found or inactive' });
    }

    // Check organization status
    const org = user.organization || (await prisma.organization.findUnique({ where: { id: DEFAULT_ORG_ID } }));
    if (!org) {
      return res.json({ valid: false, reason: 'Organization not found' });
    }

    if (org.status === 'SUSPENDED' || org.status === 'CANCELLED') {
      return res.json({
        valid: false,
        reason: `Organization is ${org.status.toLowerCase()}`,
        code: `ORGANIZATION_${org.status}`,
      });
    }

    // Check JWT signature & claims if token provided
    if (token && token !== 'null' && token !== 'undefined') {
      const decoded = verifyTenantToken(token);
      if (!decoded) {
        return res.json({ valid: false, reason: 'Invalid or expired token' });
      }
      if (decoded.userId !== userId) {
        return res.json({ valid: false, reason: 'Token user ID mismatch' });
      }

      // Check session validity if sessionId in token
      if (decoded.sessionId) {
        const isSessionValid = await validateSession(decoded.sessionId, token);
        if (!isSessionValid) {
          return res.json({ valid: false, reason: 'Session revoked or expired' });
        }
      }
    }

    // Check PIN if provided
    if (pin) {
      const rawPin = String(pin).trim();
      const isMatch = user.pin.startsWith('$2')
        ? await bcrypt.compare(rawPin, user.pin)
        : rawPin === user.pin;
      if (!isMatch) {
        return res.json({ valid: false, reason: 'Password updated' });
      }
    }

    const safeUser = sanitizeUser(user);
    return res.json({
      valid: true,
      user: safeUser,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
      },
      branch: user.branch
        ? {
            id: user.branch.id,
            name: user.branch.name,
            slug: user.branch.slug,
            active: user.branch.active,
          }
        : null,
    });
  } catch (error) {
    console.error('[ValidateSessionHandler] Error:', error);
    return res.status(500).json({ valid: false, error: 'Internal server error during session validation' });
  }
}

/**
 * Logout Handler. Revokes active session.
 */
export async function logoutHandler(req: Request, res: Response) {
  try {
    const rawToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (rawToken) {
      const decoded = verifyTenantToken(rawToken);
      if (decoded?.sessionId) {
        await revokeSession(decoded.sessionId);
        if (decoded.organizationId) {
          logAuditEvent({
            organizationId: decoded.organizationId,
            branchId: decoded.branchId,
            userId: decoded.userId,
            action: AUDIT_ACTIONS.AUTH_LOGOUT,
            entity: 'SESSION',
            entityId: decoded.sessionId,
            ipAddress: req.ip,
          }).catch(() => {});
        }
      }
    }
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('[LogoutHandler] Error:', error);
    return res.status(500).json({ error: 'Error processing logout' });
  }
}

const pinFailuresMap = new Map<string, { attempts: number; lockoutUntil: Date | null }>();

function getPinLockoutKey(orgId: string, ip: string): string {
  return `${orgId}:${ip}`;
}

export function recordPinFailure(key: string) {
  const current = pinFailuresMap.get(key) || { attempts: 0, lockoutUntil: null };
  current.attempts += 1;
  if (current.attempts >= 5) {
    current.lockoutUntil = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes lockout
  }
  pinFailuresMap.set(key, current);
}

export function isPinLocked(key: string): boolean {
  const current = pinFailuresMap.get(key);
  if (!current) return false;
  if (current.lockoutUntil && new Date() < current.lockoutUntil) {
    return true;
  }
  if (current.lockoutUntil && new Date() >= current.lockoutUntil) {
    pinFailuresMap.delete(key);
  }
  return false;
}

export function resetPinFailures(key: string) {
  pinFailuresMap.delete(key);
}

/**
 * Explicit Manager PIN Verification Endpoint.
 * Checks PIN against active managers strictly within the requesting tenant organization.
 */
export async function verifyManagerPinHandler(req: Request, res: Response) {
  try {
    const { pin, organizationId, organizationSlug } = req.body;
    const cleanPin = String(pin || '').trim();

    if (!cleanPin || cleanPin.length < 4) {
      return res.status(400).json({ valid: false, error: 'PIN must be at least 4 digits' });
    }

    // Resolve tenant organization
    let targetOrgId = req.tenant?.organizationId;
    if (!targetOrgId) {
      if (organizationId) {
        const org = await prisma.organization.findUnique({ where: { id: organizationId } });
        if (org) targetOrgId = org.id;
      } else if (organizationSlug) {
        const org = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
        if (org) targetOrgId = org.id;
      } else {
        targetOrgId = DEFAULT_ORG_ID;
      }
    }

    const pinLockoutKey = getPinLockoutKey(targetOrgId || 'unknown', req.ip || 'unknown');
    if (isPinLocked(pinLockoutKey)) {
      return res.status(429).json({
        valid: false,
        error: 'Too many failed manager PIN attempts. Locked out for 2 minutes.',
        code: 'PIN_LOCKED_OUT',
      });
    }

    const managers = await prisma.user.findMany({
      where: {
        organizationId: targetOrgId,
        role: { in: ['OWNER', 'MANAGER', 'ADMIN', 'owner', 'manager', 'admin'] },
        active: true,
      },
    });

    for (const mgr of managers) {
      const isMatch = mgr.pin.startsWith('$2')
        ? await bcrypt.compare(cleanPin, mgr.pin)
        : cleanPin === mgr.pin;

      if (isMatch) {
        resetPinFailures(pinLockoutKey);
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

        return res.json({
          valid: true,
          manager: {
            id: mgr.id,
            name: mgr.name,
            role: mgr.role,
            organizationId: mgr.organizationId,
          },
        });
      }
    }

    recordPinFailure(pinLockoutKey);
    logAuditEvent({
      organizationId: targetOrgId,
      action: AUDIT_ACTIONS.MANAGER_PIN_FAILED,
      entity: 'MANAGER_PIN',
      metadata: { attemptedAt: new Date().toISOString() },
      ipAddress: req.ip,
    }).catch(() => {});

    return res.status(401).json({ valid: false, error: 'Invalid manager PIN' });
  } catch (error) {
    console.error('[VerifyManagerPinHandler] Error:', error);
    return res.status(500).json({ valid: false, error: 'Error validating manager PIN' });
  }
}
