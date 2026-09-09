import crypto from 'crypto';
import prisma from '../prisma';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface CreateSessionParams {
  userId: string;
  organizationId: string;
  branchId?: string | null;
  rawToken?: string;
  deviceInfo?: string;
  ipAddress?: string;
  expiresInHours?: number;
}

export async function createSession(params: CreateSessionParams) {
  try {
    const hours = params.expiresInHours || 12;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const tokenHash = params.rawToken ? hashToken(params.rawToken) : null;

    const session = await prisma.session.create({
      data: {
        userId: params.userId,
        organizationId: params.organizationId,
        branchId: params.branchId || null,
        tokenHash,
        status: 'ACTIVE',
        deviceInfo: params.deviceInfo || null,
        ipAddress: params.ipAddress || null,
        expiresAt,
        lastUsedAt: new Date(),
      },
    });

    return session;
  } catch (error) {
    console.warn('[SessionService] Could not persist session in database:', error);
    return null;
  }
}

export async function validateSession(sessionId: string, rawToken?: string): Promise<boolean> {
  if (!sessionId) return false;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) return false;
    if (session.status !== 'ACTIVE') return false;
    if (new Date() > new Date(session.expiresAt)) {
      // Mark expired
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'EXPIRED' },
      }).catch(() => {});
      return false;
    }

    if (rawToken && session.tokenHash) {
      const currentHash = hashToken(rawToken);
      if (session.tokenHash !== currentHash) {
        return false;
      }
    }

    // Touch last used timestamp asynchronously
    prisma.session.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return true;
  } catch (error) {
    // If sessions table check fails, allow validation to proceed if token itself is valid
    return true;
  }
}

export async function revokeSession(sessionId: string) {
  try {
    return await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });
  } catch (error) {
    console.warn('[SessionService] Error revoking session:', error);
    return null;
  }
}

export async function revokeAllUserSessions(userId: string, organizationId: string) {
  try {
    return await prisma.session.updateMany({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
      },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });
  } catch (error) {
    console.warn('[SessionService] Error revoking all user sessions:', error);
    return null;
  }
}
