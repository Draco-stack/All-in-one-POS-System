import { Request } from 'express';

export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER' | 'RIDER' | 'SERVER';

export type OrganizationStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CANCELLED';

export interface AuthUserContext {
  userId: string;
  role: UserRole | string;
  name: string;
  username?: string | null;
  email?: string | null;
}

export interface TenantContext {
  userId: string;
  organizationId: string;
  branchId?: string | null;
  sessionId?: string;
  role: UserRole | string;
  name: string;
  username?: string | null;
  organizationSlug: string;
  organizationName: string;
  organizationStatus: OrganizationStatus | string;
  branchName?: string | null;
  permissions: string[];
}

export interface TokenPayload {
  userId: string;
  organizationId: string;
  branchId?: string | null;
  sessionId?: string;
  role: string;
  name?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

// Extend Express namespace with typed auth and tenant context
declare global {
  namespace Express {
    interface Request {
      auth?: AuthUserContext;
      tenant?: TenantContext;
      user?: {
        id: string;
        role: string;
        name: string;
        organizationId?: string | null;
        branchId?: string | null;
      };
    }
  }
}
