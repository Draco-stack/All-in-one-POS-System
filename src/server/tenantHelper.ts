import { Request, Response } from 'express';
import prisma from './prisma';
import { verifyTenantToken } from './auth/jwt';
import { DEFAULT_ORG_ID, DEFAULT_BRANCH_ID } from './seed';
import { TenantContext } from './types/auth';

/**
 * Authoritatively resolves the active tenant organization and branch context for any incoming request.
 * 
 * Hierarchy of authority:
 * 1. Already-authenticated req.tenant populated by middleware
 * 2. Validated Bearer JWT token from Authorization header
 * 3. Workstation POS headers (x-organization-id or x-organization-slug)
 * 4. Safe fallback to default flagship organization (DEFAULT_ORG_ID)
 * 
 * SECURITY INVARIANT: Client-supplied payload overrides (e.g. body.organizationId)
 * are NEVER trusted over server-side context.
 */
export async function resolveTenantContext(req: Request): Promise<{
  organizationId: string;
  branchId: string | null;
  userId?: string | null;
  role?: string | null;
}> {
  // 1. Check req.tenant if already authenticated by middleware
  if (req.tenant && req.tenant.organizationId) {
    return {
      organizationId: req.tenant.organizationId,
      branchId: req.tenant.branchId || null,
      userId: req.tenant.userId || null,
      role: req.tenant.role ? String(req.tenant.role) : null,
    };
  }

  // 2. Try Bearer JWT token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.substring(7).trim();
    const payload = verifyTenantToken(rawToken);
    if (payload && payload.organizationId) {
      return {
        organizationId: payload.organizationId,
        branchId: payload.branchId || null,
        userId: payload.userId || null,
        role: payload.role || null,
      };
    }
  }

  // 3. Try workstation organization headers
  const headerOrgId = req.headers['x-organization-id'] as string;
  const headerOrgSlug = req.headers['x-organization-slug'] as string;

  if (headerOrgId) {
    const org = await prisma.organization.findUnique({
      where: { id: headerOrgId },
      select: { id: true, status: true },
    });
    if (org && org.status !== 'SUSPENDED' && org.status !== 'CANCELLED') {
      return {
        organizationId: org.id,
        branchId: (req.headers['x-branch-id'] as string) || null,
      };
    }
  }

  if (headerOrgSlug) {
    const org = await prisma.organization.findUnique({
      where: { slug: headerOrgSlug },
      select: { id: true, status: true },
    });
    if (org && org.status !== 'SUSPENDED' && org.status !== 'CANCELLED') {
      return {
        organizationId: org.id,
        branchId: (req.headers['x-branch-id'] as string) || null,
      };
    }
  }

  // 4. Default to Flagship Organization for local workstation / demo POS
  return {
    organizationId: DEFAULT_ORG_ID,
    branchId: DEFAULT_BRANCH_ID,
  };
}

/**
 * Returns the authoritative organizationId for a request synchronously when req.tenant is present,
 * or safely falls back to DEFAULT_ORG_ID.
 */
export function getTenantOrgId(req: Request): string {
  return req.tenant?.organizationId || DEFAULT_ORG_ID;
}

/**
 * Returns the authoritative branchId for a request.
 */
export function getTenantBranchId(req: Request): string | null {
  return req.tenant?.branchId || null;
}

/**
 * Standardized tenant-isolated 404 response to avoid leaking the existence of foreign tenant records.
 */
export function sendTenantNotFound(res: Response, entityName: string, id: string): Response {
  return res.status(404).json({
    error: `${entityName} with ID '${id}' was not found.`,
    code: 'NOT_FOUND',
  });
}
