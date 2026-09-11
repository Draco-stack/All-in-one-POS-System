import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import prisma from '../prisma';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getJwtSecret, verifyTenantToken } from '../auth/jwt';
import { checkPOSEntitlement } from '../middleware/subscriptionMiddleware';

export const activeAgentSockets = new Map<string, Socket>();
export const activeKdsSockets = new Map<string, Socket>();

let io: SocketIOServer | null = null;

// Throttled lastSeenAt updates to prevent high write load
const lastSeenThrottleMap = new Map<string, number>();

function sha256(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

/**
 * Initializes the Socket.io server on top of the main HTTP server.
 */
export function initHardwareSocket(ioInstance: SocketIOServer) {
  io = ioInstance;

  // Main connection handler
  io.on('connection', async (socket: Socket) => {
    try {
      const authHeader = socket.handshake.headers['authorization'];
      const authQuery = socket.handshake.query['token'];
      const authType = socket.handshake.query['type'] || 'agent'; // 'agent' or 'kds_user'

      let token = '';
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (typeof authQuery === 'string') {
        token = authQuery;
      }

      if (!token || token === 'null' || token === 'undefined') {
        console.warn('[Socket Auth] Connection rejected: Missing or invalid credentials');
        socket.disconnect(true);
        return;
      }

      if (authType === 'agent') {
        // ----------------------------------------------------------------------
        // LOCAL AGENT AUTHENTICATION
        // ----------------------------------------------------------------------
        const hashedToken = sha256(token);

        // Retrieve active credentials with associated device
        const credential = await prisma.deviceCredential.findFirst({
          where: { tokenHash: hashedToken, status: 'ACTIVE' },
          include: { device: true },
        });

        if (!credential || !credential.device || credential.device.status !== 'ACTIVE') {
          console.warn('[Socket Auth] Connection rejected: Invalid device credentials or inactive device status');
          socket.disconnect(true);
          return;
        }

        const device = credential.device;
        const deviceId = device.id;
        const orgId = credential.organizationId;
        const branchId = credential.branchId || '';

        // Check SaaS Subscription Entitlement
        const agentEntitlement = await checkPOSEntitlement(orgId);
        if (!agentEntitlement.allowed) {
          console.warn(`[Socket Auth] Agent rejected: Subscription status invalid for org ${orgId}`);
          socket.emit('SUBSCRIPTION_EXPIRED', { error: agentEntitlement.reason, code: agentEntitlement.code });
          socket.disconnect(true);
          return;
        }

        // Store secure session properties inside the socket object
        socket.data = {
          type: 'agent',
          deviceId,
          deviceIdentifier: device.deviceIdentifier,
          organizationId: orgId,
          branchId,
        };

        // Invalidate older connections for this device
        const existing = activeAgentSockets.get(deviceId);
        if (existing) {
          console.log(`[Socket] Disconnecting duplicate agent session for device: ${device.deviceIdentifier}`);
          existing.disconnect(true);
        }

        activeAgentSockets.set(deviceId, socket);
        console.log(`[Socket] Secure agent connected: Device #${device.deviceIdentifier} (Org: ${orgId}, Branch: ${branchId})`);

        // Emit un-acknowledged queued jobs on reconnect
        try {
          const queuedJobs = await prisma.printJob.findMany({
            where: {
              deviceId,
              organizationId: orgId,
              status: { in: ['QUEUED', 'SENT'] },
            },
            orderBy: { createdAt: 'asc' },
            take: 20,
          });

          for (const job of queuedJobs) {
            socket.emit('job:execute', {
              id: job.id,
              jobType: job.jobType,
              payload: job.payload,
              idempotencyKey: job.idempotencyKey,
            });
          }
        } catch (dbErr) {
          console.error('[Socket Queue Sync Error]:', dbErr);
        }

        // Heartbeat listener
        socket.on('heartbeat', async (data: { agentVersion?: string; capabilities?: string[] }) => {
          try {
            const now = Date.now();
            const lastUpdate = lastSeenThrottleMap.get(deviceId) || 0;

            // Throttle database writes to at most once every 60 seconds
            if (now - lastUpdate > 60 * 1000) {
              await prisma.device.update({
                where: { id: deviceId },
                data: {
                  lastSeenAt: new Date(),
                },
              });
              lastSeenThrottleMap.set(deviceId, now);
            }

            // Emit heartbeat response / ack
            socket.emit('heartbeat:ack', { success: true, timestamp: Date.now() });
          } catch (hErr) {
            console.error('[Socket Heartbeat Error]:', hErr);
          }
        });

        // Job completed confirmation handler
        socket.on('job:ack', async (data: { jobId: string; status: string; error?: string }) => {
          try {
            const { jobId, status, error } = data;
            const job = await prisma.printJob.findFirst({
              where: { id: jobId, organizationId: orgId },
            });

            if (!job) return;

            await prisma.printJob.update({
              where: { id: jobId },
              data: {
                status: status === 'success' ? 'ACKNOWLEDGED' : 'FAILED',
                lastError: error || null,
                completedAt: status === 'success' ? new Date() : null,
              },
            });

            console.log(`[Socket Job ACK] Job ${jobId} updated to ${status === 'success' ? 'ACKNOWLEDGED' : 'FAILED'}`);
          } catch (ackErr) {
            console.error('[Socket Job ACK Error]:', ackErr);
          }
        });

        socket.on('disconnect', () => {
          console.log(`[Socket] Secure agent disconnected: Device #${device.deviceIdentifier}`);
          activeAgentSockets.delete(deviceId);
          lastSeenThrottleMap.delete(deviceId);
        });

      } else if (authType === 'kds_user') {
        // ----------------------------------------------------------------------
        // KDS USER REAL-TIME SYSTEM (Staff & Displays)
        // ----------------------------------------------------------------------
        // Validate Standard Tenant JWT Token using the authoritative verification utility
        const decoded = verifyTenantToken(token);
        if (!decoded) {
          console.warn('[Socket KDS Auth] Token verification failed for token:', token.substring(0, 10) + '...');
          socket.disconnect(true);
          return;
        }

        const orgId = decoded.organizationId;
        const userBranchId = decoded.branchId || '';

        // Check SaaS Subscription Entitlement
        const kdsEntitlement = await checkPOSEntitlement(orgId);
        if (!kdsEntitlement.allowed) {
          console.warn(`[Socket Auth] KDS Client rejected: Subscription status invalid for org ${orgId}`);
          socket.emit('SUBSCRIPTION_EXPIRED', { error: kdsEntitlement.reason, code: kdsEntitlement.code });
          socket.disconnect(true);
          return;
        }

        socket.data = {
          type: 'kds_user',
          userId: decoded.userId,
          organizationId: orgId,
          role: decoded.role,
          userBranchId,
        };

        activeKdsSockets.set(socket.id, socket);
        console.log(`[Socket] KDS Client connected: User ${decoded.name} (Org: ${orgId}, Role: ${decoded.role})`);

        // Channel subscription model with strict authentication and tenant scoping
        socket.on('kds:subscribe', (data: { branchId: string }) => {
          try {
            const { branchId } = data;
            if (!branchId) {
              socket.emit('subscription:error', { error: 'Missing branchId' });
              return;
            }

            // Enforce strict Tenant & Branch Isolation
            // Managers and Cashiers can subscribe only to their own branch.
            // If the user's branch does not match the target branch (and they are not an OWNER), reject.
            if (socket.data.role !== 'OWNER' && socket.data.userBranchId && socket.data.userBranchId !== branchId) {
              console.warn(`[Socket Violation] User ${socket.data.userId} attempted unauthorized KDS subscription to branch: ${branchId}`);
              socket.emit('subscription:error', { error: 'Access denied: Cross-branch channel subscription is forbidden' });
              return;
            }

            // Safely join the branch-scoped KDS channel
            const roomName = `kds:branch:${orgId}:${branchId}`;
            socket.join(roomName);
            console.log(`[Socket KDS] Client ${socket.id} joined KDS channel: ${roomName}`);
            socket.emit('subscription:success', { channel: branchId });
          } catch (subErr: any) {
            console.error('[Socket KDS Join Error]:', subErr);
            socket.emit('subscription:error', { error: 'Failed to join KDS channel' });
          }
        });

        socket.on('disconnect', () => {
          activeKdsSockets.delete(socket.id);
        });
      } else {
        console.warn('[Socket Connection] Unknown connection type');
        socket.disconnect(true);
      }

    } catch (gErr) {
      console.error('[Socket Error]:', gErr);
      socket.disconnect(true);
    }
  });
}

/**
 * Dispatches a PrintJob real-time to the paired Agent if online.
 */
export function dispatchJobToAgent(job: any): boolean {
  if (!io) return false;
  const socket = activeAgentSockets.get(job.deviceId);
  if (socket) {
    // Optimistically update status to SENT
    prisma.printJob.update({
      where: { id: job.id },
      data: {
        status: 'SENT',
        attempts: { increment: 1 },
      },
    }).catch((err) => console.error('[Socket Job Status Update Error]:', err));

    socket.emit('job:execute', {
      id: job.id,
      jobType: job.jobType,
      payload: job.payload,
      idempotencyKey: job.idempotencyKey,
    });
    return true;
  }
  return false;
}

/**
 * Dispatches a KDS ticket update real-time to the branch's active KDS clients.
 */
export function dispatchKdsUpdate(orgId: string, branchId: string, eventType: string, orderData: any) {
  if (!io) return;
  const roomName = `kds:branch:${orgId}:${branchId}`;
  io.to(roomName).emit('kds:order_update', {
    eventType,
    order: orderData,
    timestamp: Date.now(),
  });
  console.log(`[Socket KDS Update] Order ${orderData.orderNumber} broadcast to channel: ${roomName}`);
}

/**
 * Force-invalidates a connected agent socket immediately (e.g. on revocation).
 */
export function invalidateDeviceSocket(deviceId: string) {
  const socket = activeAgentSockets.get(deviceId);
  if (socket) {
    console.log(`[Socket Control] Revoking socket connection for deviceId: ${deviceId}`);
    socket.emit('auth:revoked', { message: 'This device identity has been revoked.' });
    socket.disconnect(true);
    activeAgentSockets.delete(deviceId);
  }
}
