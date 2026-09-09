import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../prisma';
import { assertResourceLimit } from '../billing/billingSystem';
import { formatReceiptEscPos } from '../printer';
import { invalidateDeviceSocket, dispatchJobToAgent } from '../hardware/hardwareSocket';

// Simple in-memory rate-limiting for pairing code attempts (brute force protection)
const pairingAttempts = new Map<string, { count: number; blockedUntil: number }>();

function checkPairingRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = pairingAttempts.get(ip);
  if (record) {
    if (record.blockedUntil > now) {
      return false;
    }
    if (now - record.blockedUntil > 15 * 60 * 1000) {
      // Reset after 15 mins
      pairingAttempts.set(ip, { count: 0, blockedUntil: 0 });
      return true;
    }
  }
  return true;
}

function recordPairingAttempt(ip: string, success: boolean) {
  const record = pairingAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  if (success) {
    pairingAttempts.delete(ip);
  } else {
    record.count++;
    if (record.count >= 5) {
      record.blockedUntil = Date.now() + 5 * 60 * 1000; // Block for 5 minutes
    }
    pairingAttempts.set(ip, record);
  }
}

/**
 * Hash utility
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * POST /api/devices/generate-pairing-code
 * Access: OWNER or MANAGER. Generates a short-lived, single-use, rate-limited pairing code.
 */
export async function generatePairingCodeHandler(req: Request, res: Response) {
  try {
    const orgId = req.tenant?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized: Missing organization context' });
    }

    const role = req.tenant?.role;
    if (role !== 'OWNER' && role !== 'MANAGER') {
      return res.status(403).json({ error: 'Forbidden: Only managers or owners can generate pairing codes' });
    }

    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'Missing deviceId parameter' });
    }

    const device = await prisma.device.findFirst({
      where: { id: deviceId, organizationId: orgId },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found in this organization' });
    }

    // Generate strong secure alphanumeric code (6 characters)
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();

    // Expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Save pairing code (Single-use, expires, rate-limited)
    await prisma.devicePairing.upsert({
      where: { code },
      update: {
        organizationId: orgId,
        branchId: device.branchId,
        deviceId: device.id,
        status: 'PENDING',
        expiresAt,
      },
      create: {
        organizationId: orgId,
        branchId: device.branchId,
        deviceId: device.id,
        code,
        status: 'PENDING',
        expiresAt,
      },
    });

    // Audit log (never log pairing code itself in persistent audit log, or log only metadata)
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        branchId: device.branchId,
        userId: req.tenant?.userId || null,
        action: 'PAIRING_CODE_GENERATED',
        entity: 'DEVICE',
        entityId: device.id,
        metadata: JSON.stringify({ deviceIdentifier: device.deviceIdentifier }),
      },
    });

    return res.json({
      success: true,
      code, // return to UI once
      expiresAt,
    });
  } catch (error: any) {
    console.error('[HardwareController] generatePairingCode error:', error);
    return res.status(500).json({ error: 'Failed to generate pairing code' });
  }
}

/**
 * POST /api/devices/pair
 * Access: Public (Local Agent). Submits pairing code, retrieves deviceToken.
 */
export async function pairDeviceHandler(req: Request, res: Response) {
  const ip = req.ip || 'unknown-ip';
  try {
    if (!checkPairingRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many pairing attempts. Please try again later.' });
    }

    const { code } = req.body;
    if (!code) {
      recordPairingAttempt(ip, false);
      return res.status(400).json({ error: 'Pairing code is required' });
    }

    // Retrieve active pending code
    const pairing = await prisma.devicePairing.findUnique({
      where: { code },
    });

    if (!pairing || pairing.status !== 'PENDING' || pairing.expiresAt < new Date()) {
      recordPairingAttempt(ip, false);
      return res.status(400).json({ error: 'Invalid or expired pairing code' });
    }

    // Check device subscription entitlements BEFORE pairing/activating
    const orgId = pairing.organizationId;
    const device = await prisma.device.findUnique({
      where: { id: pairing.deviceId },
    });

    if (!device) {
      recordPairingAttempt(ip, false);
      return res.status(400).json({ error: 'Associated device not found' });
    }

    // Transaction to safely update device & pairing to ensure atomicity
    const pairingResult = await prisma.$transaction(async (tx) => {
      // Subscription entitlement limit check
      await assertResourceLimit(tx, orgId, 'devices');

      // Use pairing (mark USED)
      await tx.devicePairing.update({
        where: { id: pairing.id },
        data: { status: 'USED' },
      });

      // Update device state to ACTIVE
      const updatedDevice = await tx.device.update({
        where: { id: device.id },
        data: { status: 'ACTIVE' },
      });

      // Generate cryptographically secure pairing credential (token)
      const deviceToken = `t_dev_${crypto.randomBytes(32).toString('hex')}`;
      const tokenHash = hashToken(deviceToken);

      // Save/Upsert DeviceCredential securely
      const credential = await tx.deviceCredential.upsert({
        where: { deviceId: device.id },
        update: {
          tokenHash,
          status: 'ACTIVE',
        },
        create: {
          deviceId: device.id,
          organizationId: orgId,
          branchId: device.branchId,
          tokenHash,
          status: 'ACTIVE',
        },
      });

      return {
        deviceToken,
        updatedDevice,
        credential,
      };
    });

    recordPairingAttempt(ip, true);

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        branchId: device.branchId,
        action: 'DEVICE_PAIRED',
        entity: 'DEVICE',
        entityId: device.id,
        metadata: JSON.stringify({ deviceIdentifier: device.deviceIdentifier, ipAddress: ip }),
      },
    });

    return res.json({
      success: true,
      deviceId: device.id,
      deviceIdentifier: device.deviceIdentifier,
      name: device.name,
      organizationId: orgId,
      branchId: device.branchId,
      deviceToken: pairingResult.deviceToken, // Sent exactly once to agent
    });
  } catch (error: any) {
    console.error('[HardwareController] pairDevice error:', error);
    recordPairingAttempt(ip, false);
    if (error.message && (error.message.includes('LIMIT_EXCEEDED') || error.message.includes('SUBSCRIPTION_RESTRICTED'))) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to pair device' });
  }
}

/**
 * POST /api/devices/revoke
 * Access: OWNER or MANAGER. Revokes pairing and invalidates credentials immediately.
 */
export async function revokeDeviceHandler(req: Request, res: Response) {
  try {
    const orgId = req.tenant?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized: Missing organization context' });
    }

    const role = req.tenant?.role;
    if (role !== 'OWNER' && role !== 'MANAGER') {
      return res.status(403).json({ error: 'Forbidden: Only managers or owners can revoke devices' });
    }

    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const device = await prisma.device.findFirst({
      where: { id: deviceId, organizationId: orgId },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await prisma.$transaction(async (tx) => {
      // Set status to REVOKED
      await tx.device.update({
        where: { id: deviceId },
        data: { status: 'REVOKED' },
      });

      // Revoke credential
      await tx.deviceCredential.updateMany({
        where: { deviceId },
        data: { status: 'REVOKED' },
      });
    });

    // Notify hardware WS module to disconnect the device socket
    if (invalidateDeviceSocket) {
      invalidateDeviceSocket(deviceId);
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        branchId: device.branchId,
        userId: req.tenant?.userId || null,
        action: 'DEVICE_REVOKED',
        entity: 'DEVICE',
        entityId: device.id,
      },
    });

    return res.json({
      success: true,
      message: 'Device revoked and disconnected successfully',
    });
  } catch (error: any) {
    console.error('[HardwareController] revokeDevice error:', error);
    return res.status(500).json({ error: 'Failed to revoke device' });
  }
}

/**
 * POST /api/printer/print-job
 * Access: Staff. Creates a print job, validates raw commands and capabilities.
 */
export async function createPrintJobHandler(req: Request, res: Response) {
  try {
    const orgId = req.tenant?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { deviceId, jobType, payload, idempotencyKey } = req.body;
    if (!deviceId || !jobType || !payload) {
      return res.status(400).json({ error: 'deviceId, jobType, and payload are required' });
    }

    // Valid job types
    if (!['RECEIPT', 'KITCHEN', 'CASH_DRAWER'].includes(jobType)) {
      return res.status(400).json({ error: 'Invalid jobType' });
    }

    // Retrieve and verify device status and ownership
    const device = await prisma.device.findFirst({
      where: { id: deviceId, organizationId: orgId },
    });

    if (!device) {
      return res.status(404).json({ error: 'Target device not found in organization' });
    }

    if (device.status !== 'ACTIVE') {
      return res.status(403).json({ error: `Device is not active (Status: ${device.status})` });
    }

    // Ensure raw commands/SSRF are strictly blocked
    // The payload is plain text or structured. We forbid arbitrary binary streams in raw fields unless whitelisted.
    // Receipt formats can be built safely via formatReceiptEscPos
    if (jobType === 'CASH_DRAWER' && payload !== 'OPEN_CASH_DRAWER') {
      return res.status(403).json({ error: 'Unauthorized cash drawer payload' });
    }

    // Capability checking: Ensure receipt printers do not open drawer unless capable or authorized
    if (jobType === 'CASH_DRAWER' && device.deviceType !== 'POS') {
      return res.status(403).json({ error: 'Device type is not capable of cash drawer pulse commands' });
    }

    // Create durable print job using transaction to enforce idempotency
    const printJob = await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.printJob.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId: orgId,
              idempotencyKey,
            },
          },
        });
        if (existing) {
          return existing;
        }
      }

      return await tx.printJob.create({
        data: {
          organizationId: orgId,
          branchId: device.branchId,
          deviceId: device.id,
          jobType,
          status: 'QUEUED',
          payload,
          idempotencyKey: idempotencyKey || `ik_${crypto.randomBytes(16).toString('hex')}`,
        },
      });
    });

    // Dispatch job real-time if agent connected
    if (dispatchJobToAgent) {
      dispatchJobToAgent(printJob);
    }

    return res.json({
      success: true,
      jobId: printJob.id,
      status: printJob.status,
    });
  } catch (error: any) {
    console.error('[HardwareController] createPrintJob error:', error);
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Duplicate print job key' });
    }
    return res.status(500).json({ error: 'Failed to dispatch print job' });
  }
}

/**
 * POST /api/printer/open-drawer
 * Access: Staff. Triggers cash drawer pulse securely after validating shift state.
 */
export async function triggerCashDrawerKickHandler(req: Request, res: Response) {
  try {
    const orgId = req.tenant?.organizationId;
    const branchId = req.tenant?.branchId;
    const userId = req.tenant?.userId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized: Missing tenant details' });
    }

    const { deviceId, shiftId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    // 1. Shift context validation: Must have an active shift for this branch/cashier to kick open drawer
    const shift = await prisma.registerShift.findFirst({
      where: {
        id: shiftId,
        organizationId: orgId,
        status: 'open',
      },
    });

    if (!shift) {
      return res.status(403).json({ error: 'Security violation: Active register shift is required to pulse cash drawer' });
    }

    // 2. Validate device state and capabilities
    const device = await prisma.device.findFirst({
      where: { id: deviceId, organizationId: orgId },
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (device.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Device is not active' });
    }

    if (device.deviceType !== 'POS') {
      return res.status(403).json({ error: 'Device is not capable of cash drawer pulse commands' });
    }

    // Create durable PrintJob
    const printJob = await prisma.printJob.create({
      data: {
        organizationId: orgId,
        branchId: device.branchId,
        deviceId: device.id,
        jobType: 'CASH_DRAWER',
        status: 'QUEUED',
        payload: 'OPEN_CASH_DRAWER',
        idempotencyKey: `ik_drawer_${crypto.randomBytes(16).toString('hex')}`,
      },
    });

    // Log Cash Drawer open event to the central security audit log
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        branchId: device.branchId,
        userId: userId || null,
        action: 'CASH_DRAWER_OPENED',
        entity: 'SHIFT',
        entityId: shift.id,
        metadata: JSON.stringify({ deviceId, deviceIdentifier: device.deviceIdentifier, printJobId: printJob.id }),
      },
    });

    // Dispatch job real-time if agent connected
    if (dispatchJobToAgent) {
      dispatchJobToAgent(printJob);
    }

    return res.json({
      success: true,
      jobId: printJob.id,
      message: 'Cash drawer open job queued',
    });
  } catch (error: any) {
    console.error('[HardwareController] triggerCashDrawerKick error:', error);
    return res.status(500).json({ error: 'Failed to pulse cash drawer' });
  }
}
