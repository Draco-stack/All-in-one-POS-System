import jwt from 'jsonwebtoken';
import { TokenPayload } from '../types/auth';

const ISSUER = 'tillora-pos';
const AUDIENCE = 'tillora-client';
const DEFAULT_EXPIRATION = '12h';

export function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'tillora_commercial_saas_secure_jwt_secret_2026';
}

/**
 * Generates a signed, tenant-aware JWT.
 * Encodes minimum necessary identity claims: userId, organizationId, branchId, sessionId, role, name.
 * Never includes passwords, PINs, or bcrypt hashes.
 */
export function signTenantToken(payload: {
  userId: string;
  organizationId: string;
  branchId?: string | null;
  sessionId?: string;
  role: string;
  name?: string;
}): string {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      userId: payload.userId,
      id: payload.userId, // backward-compatibility for legacy readers
      organizationId: payload.organizationId,
      branchId: payload.branchId || null,
      sessionId: payload.sessionId || null,
      role: payload.role,
      name: payload.name || '',
    },
    secret,
    {
      expiresIn: DEFAULT_EXPIRATION,
      issuer: ISSUER,
      audience: AUDIENCE,
    }
  );
}

/**
 * Verifies and decodes a tenant JWT.
 */
export function verifyTenantToken(token: string): TokenPayload | null {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as any;

    return {
      userId: decoded.userId || decoded.id,
      organizationId: decoded.organizationId,
      branchId: decoded.branchId || null,
      sessionId: decoded.sessionId || null,
      role: decoded.role,
      name: decoded.name,
      iat: decoded.iat,
      exp: decoded.exp,
      iss: decoded.iss,
      aud: decoded.aud,
    };
  } catch (error) {
    // If issuer/audience check fails on old tokens, attempt fallback verification
    try {
      const secret = getJwtSecret();
      const decodedFallback = jwt.verify(token, secret) as any;
      return {
        userId: decodedFallback.userId || decodedFallback.id,
        organizationId: decodedFallback.organizationId,
        branchId: decodedFallback.branchId || null,
        sessionId: decodedFallback.sessionId || null,
        role: decodedFallback.role,
        name: decodedFallback.name,
        iat: decodedFallback.iat,
        exp: decodedFallback.exp,
      };
    } catch {
      return null;
    }
  }
}
