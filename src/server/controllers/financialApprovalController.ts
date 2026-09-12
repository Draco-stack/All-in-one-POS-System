import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { resolveTenantContext, sendTenantNotFound } from '../tenantHelper';
import { logAuditEvent, AUDIT_ACTIONS } from '../auth/auditService';
import { RESTAURANT_PERMISSIONS } from '../auth/permissions';

// Approval Threshold Defaults
export const DEFAULT_CASH_THRESHOLD = 50.0; // E.g., $50 or ₦50,000 threshold for cash movement without manager approval
export const DEFAULT_DISCOUNT_THRESHOLD_PERCENT = 15.0; // 15% discount threshold
export const DEFAULT_DISCOUNT_THRESHOLD_AMOUNT = 25.0; // $25 discount threshold

// Variance Classifications
export const VARIANCE_CLASSIFICATION = {
  WITHIN_TOLERANCE: 'WITHIN_TOLERANCE',
  REQUIRES_REVIEW: 'REQUIRES_REVIEW',
  MATERIAL_VARIANCE: 'MATERIAL_VARIANCE',
};

/**
 * Classify variance amount
 * <= 5: WITHIN_TOLERANCE
 * <= 20: REQUIRES_REVIEW
 * > 20: MATERIAL_VARIANCE
 */
export function classifyVariance(variance: number): string {
  const absVar = Math.abs(variance);
  if (absVar <= 5) return VARIANCE_CLASSIFICATION.WITHIN_TOLERANCE;
  if (absVar <= 20) return VARIANCE_CLASSIFICATION.REQUIRES_REVIEW;
  return VARIANCE_CLASSIFICATION.MATERIAL_VARIANCE;
}

/**
 * Check if requester has elevated managerial role (MANAGER, ADMIN, OWNER, PLATFORM_ADMIN)
 */
export function isManagerialRole(role?: string): boolean {
  if (!role) return false;
  const r = role.toUpperCase();
  return r === 'MANAGER' || r === 'ADMIN' || r === 'OWNER' || r === 'PLATFORM_ADMIN' || r === 'EXECUTIVE_ADMIN';
}

/**
 * Verify Manager PIN if supplied or verify caller's managerial authority
 */
async function verifyManagerAuthority(
  tenantOrgId: string,
  managerPin?: string,
  callerUser?: any
): Promise<{ verified: boolean; managerUser?: any; error?: string }> {
  // If PIN provided, verify against database users in organization
  if (managerPin && String(managerPin).trim()) {
    const pinStr = String(managerPin).trim();
    const managers = await prisma.user.findMany({
      where: {
        organizationId: tenantOrgId,
        active: true,
        role: { in: ['MANAGER', 'ADMIN', 'OWNER', 'PLATFORM_ADMIN'] },
      },
    });

    for (const m of managers) {
      if (m.pin) {
        const isMatch = (await bcrypt.compare(pinStr, m.pin)) || pinStr === m.pin;
        if (isMatch) {
          return { verified: true, managerUser: m };
        }
      }
    }
    return { verified: false, error: 'Invalid manager PIN provided' };
  }

  // If caller user already has managerial role
  if (callerUser && isManagerialRole(callerUser.role)) {
    return { verified: true, managerUser: callerUser };
  }

  return { verified: false, error: 'Manager authorization or PIN required' };
}

/**
 * Create Financial Approval Request
 * POST /api/approvals
 */
export async function createApprovalRequestHandler(req: Request, res: Response) {
  try {
    const tenant = await resolveTenantContext(req);
    const authUser = (req as any).user;
    const requesterId = authUser?.id || req.body.requesterId;

    if (!requesterId) {
      return res.status(400).json({ error: 'Requester user ID is required' });
    }

    const {
      type,
      amount,
      reason,
      reasonCode,
      entityType,
      entityId,
      shiftId,
      metadata,
    } = req.body;

    const validTypes = [
      'CASH_ADJUSTMENT',
      'CASH_AUDIT',
      'DISCOUNT_OVERRIDE',
      'REFUND_APPROVAL',
      'VARIANCE_RESOLUTION',
    ];

    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid approval type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'A valid reason is required for financial approvals' });
    }

    const amountVal = Number(amount) || 0;
    const metaStr = typeof metadata === 'object' ? JSON.stringify(metadata) : (metadata || '{}');

    // Create approval record
    const approval = await prisma.financialApproval.create({
      data: {
        organizationId: tenant.organizationId,
        branchId: tenant.branchId || null,
        shiftId: shiftId || null,
        type,
        status: 'PENDING',
        requesterId,
        amount: amountVal,
        reason: String(reason).trim(),
        reasonCode: reasonCode ? String(reasonCode).trim() : null,
        entityType: entityType ? String(entityType).trim() : null,
        entityId: entityId ? String(entityId).trim() : null,
        metadata: metaStr,
      },
      include: {
        requester: { select: { id: true, name: true, username: true, role: true } },
        approver: { select: { id: true, name: true, username: true, role: true } },
      },
    });

    await logAuditEvent({
      organizationId: tenant.organizationId,
      branchId: tenant.branchId || null,
      userId: requesterId,
      action: AUDIT_ACTIONS.APPROVAL_REQUESTED || 'APPROVAL_REQUESTED',
      entity: 'FINANCIAL_APPROVAL',
      entityId: approval.id,
      metadata: { type, amount: amountVal, reason, reasonCode, entityType, entityId },
      ipAddress: req.ip,
    });

    const io = (req.app as any).get('io');
    if (io) {
      io.to(`org_${tenant.organizationId}`).emit('financialApprovalCreated', approval);
    }

    return res.status(201).json({ success: true, approval });
  } catch (error: any) {
    console.error('Create approval error:', error);
    return res.status(500).json({ error: 'Failed to create financial approval request' });
  }
}

/**
 * List Approval Requests
 * GET /api/approvals
 */
export async function getApprovalRequestsHandler(req: Request, res: Response) {
  try {
    const tenant = await resolveTenantContext(req);
    const { status, type, branchId, shiftId, requesterId } = req.query;

    const where: any = { organizationId: tenant.organizationId };
    if (status && String(status).trim()) where.status = String(status).trim().toUpperCase();
    if (type && String(type).trim()) where.type = String(type).trim().toUpperCase();
    if (branchId && String(branchId).trim()) where.branchId = String(branchId).trim();
    if (shiftId && String(shiftId).trim()) where.shiftId = String(shiftId).trim();
    if (requesterId && String(requesterId).trim()) where.requesterId = String(requesterId).trim();

    const approvals = await prisma.financialApproval.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true, username: true, role: true } },
        approver: { select: { id: true, name: true, username: true, role: true } },
        branch: { select: { id: true, name: true } },
        shift: { select: { id: true, shiftNumber: true, cashierName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return res.json({ success: true, approvals });
  } catch (error: any) {
    console.error('Get approvals error:', error);
    return res.status(500).json({ error: 'Failed to retrieve financial approvals' });
  }
}

/**
 * Get Approval Request by ID
 * GET /api/approvals/:id
 */
export async function getApprovalRequestByIdHandler(req: Request, res: Response) {
  try {
    const tenant = await resolveTenantContext(req);
    const { id } = req.params;

    const approval = await prisma.financialApproval.findFirst({
      where: { id, organizationId: tenant.organizationId },
      include: {
        requester: { select: { id: true, name: true, username: true, role: true } },
        approver: { select: { id: true, name: true, username: true, role: true } },
        branch: { select: { id: true, name: true } },
        shift: { select: { id: true, shiftNumber: true, cashierName: true } },
        cashMovements: true,
        cashAudits: true,
      },
    });

    if (!approval) {
      return sendTenantNotFound(res, 'FinancialApproval', id);
    }

    return res.json({ success: true, approval });
  } catch (error: any) {
    console.error('Get approval by id error:', error);
    return res.status(500).json({ error: 'Failed to retrieve approval request details' });
  }
}

/**
 * Process Approval Request (Approve or Reject)
 * POST /api/approvals/:id/process
 * POST /api/approvals/:id/approve
 * POST /api/approvals/:id/reject
 */
export async function processApprovalRequestHandler(req: Request, res: Response) {
  try {
    const tenant = await resolveTenantContext(req);
    const { id } = req.params;
    const authUser = (req as any).user;

    // Action: APPROVED or REJECTED
    let action = (req.body.action || '').toUpperCase();
    if (req.path.endsWith('/approve')) action = 'APPROVED';
    if (req.path.endsWith('/reject')) action = 'REJECTED';

    if (action !== 'APPROVED' && action !== 'REJECTED') {
      return res.status(400).json({ error: 'Action must be APPROVED or REJECTED' });
    }

    const { pin, rejectionReason } = req.body;

    // Verify Manager Authority
    const authResult = await verifyManagerAuthority(tenant.organizationId, pin, authUser);
    if (!authResult.verified) {
      return res.status(401).json({ error: authResult.error || 'Manager authorization required' });
    }

    const approver = authResult.managerUser || authUser;

    // Execute atomic processing inside a database transaction
    const result = await prisma.$transaction(async (tx) => {
      // Fetch approval with lock check
      const approval = await tx.financialApproval.findFirst({
        where: { id, organizationId: tenant.organizationId },
      });

      if (!approval) {
        throw new Error('NOT_FOUND');
      }

      if (approval.status !== 'PENDING') {
        throw new Error(`ALREADY_PROCESSED:${approval.status}`);
      }

      // CRITICAL SEGREGATION OF DUTIES RULE: Requester != Approver
      if (approval.requesterId === approver.id) {
        throw new Error('SEGREGATION_OF_DUTIES_VIOLATION');
      }

      const updatedApproval = await tx.financialApproval.update({
        where: { id: approval.id },
        data: {
          status: action,
          approverId: approver.id,
          processedAt: new Date(),
          rejectionReason: action === 'REJECTED' ? (rejectionReason || req.body.reason || 'Rejected by manager') : null,
        },
        include: {
          requester: { select: { id: true, name: true, username: true, role: true } },
          approver: { select: { id: true, name: true, username: true, role: true } },
        },
      });

      // Execute side-effects if APPROVED
      if (action === 'APPROVED') {
        if (approval.type === 'CASH_ADJUSTMENT') {
          // Record CashMovement if not already recorded
          let meta: any = {};
          try {
            meta = JSON.parse(approval.metadata || '{}');
          } catch {}

          const movementType = meta.movementType || (approval.amount >= 0 ? 'CASH_IN' : 'CASH_OUT');
          const direction = meta.direction || (movementType === 'CASH_OUT' ? 'OUT' : 'IN');

          await tx.cashMovement.create({
            data: {
              organizationId: tenant.organizationId,
              branchId: approval.branchId,
              shiftId: approval.shiftId,
              movementType,
              amount: Math.abs(approval.amount),
              direction,
              reason: approval.reason,
              reasonCode: approval.reasonCode,
              performedById: approval.requesterId,
              approvalId: approval.id,
              metadata: JSON.stringify({ approvedById: approver.id, originalApprovalId: approval.id }),
            },
          });
        }
      }

      return updatedApproval;
    });

    await logAuditEvent({
      organizationId: tenant.organizationId,
      branchId: tenant.branchId || null,
      userId: approver.id,
      action: action === 'APPROVED' ? (AUDIT_ACTIONS.APPROVAL_APPROVED || 'APPROVAL_APPROVED') : (AUDIT_ACTIONS.APPROVAL_REJECTED || 'APPROVAL_REJECTED'),
      entity: 'FINANCIAL_APPROVAL',
      entityId: result.id,
      metadata: { requesterId: result.requesterId, approverId: approver.id, status: action, type: result.type, amount: result.amount },
      ipAddress: req.ip,
    });

    const io = (req.app as any).get('io');
    if (io) {
      io.to(`org_${tenant.organizationId}`).emit('financialApprovalUpdated', result);
    }

    return res.json({ success: true, approval: result });
  } catch (error: any) {
    if (error?.message === 'NOT_FOUND') {
      return sendTenantNotFound(res, 'FinancialApproval', req.params.id);
    }
    if (error?.message?.startsWith('ALREADY_PROCESSED')) {
      const currentStatus = error.message.split(':')[1];
      return res.status(400).json({ error: `Approval request is no longer pending (Current status: ${currentStatus})` });
    }
    if (error?.message === 'SEGREGATION_OF_DUTIES_VIOLATION') {
      return res.status(403).json({
        error: 'Segregation of duties violation: Requester cannot approve their own financial approval request.',
        code: 'SEGREGATION_OF_DUTIES_VIOLATION',
      });
    }
    console.error('Process approval error:', error);
    return res.status(500).json({ error: 'Failed to process financial approval request' });
  }
}

/**
 * Cancel Approval Request
 * POST /api/approvals/:id/cancel
 */
export async function cancelApprovalRequestHandler(req: Request, res: Response) {
  try {
    const tenant = await resolveTenantContext(req);
    const { id } = req.params;
    const authUser = (req as any).user;

    const approval = await prisma.financialApproval.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });

    if (!approval) {
      return sendTenantNotFound(res, 'FinancialApproval', id);
    }

    if (approval.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot cancel approval in status: ${approval.status}` });
    }

    // Only requester or manager can cancel
    const isRequester = authUser?.id === approval.requesterId;
    const isManager = authUser && isManagerialRole(authUser.role);

    if (!isRequester && !isManager) {
      return res.status(403).json({ error: 'Only the requester or a manager can cancel this request' });
    }

    const updated = await prisma.financialApproval.update({
      where: { id: approval.id },
      data: {
        status: 'CANCELLED',
        processedAt: new Date(),
      },
      include: {
        requester: { select: { id: true, name: true, username: true, role: true } },
      },
    });

    await logAuditEvent({
      organizationId: tenant.organizationId,
      branchId: tenant.branchId || null,
      userId: authUser?.id,
      action: AUDIT_ACTIONS.APPROVAL_CANCELLED || 'APPROVAL_CANCELLED',
      entity: 'FINANCIAL_APPROVAL',
      entityId: updated.id,
      metadata: { cancelledById: authUser?.id },
      ipAddress: req.ip,
    });

    const io = (req.app as any).get('io');
    if (io) {
      io.to(`org_${tenant.organizationId}`).emit('financialApprovalUpdated', updated);
    }

    return res.json({ success: true, approval: updated });
  } catch (error: any) {
    console.error('Cancel approval error:', error);
    return res.status(500).json({ error: 'Failed to cancel approval request' });
  }
}

/**
 * Register Cash Movement (Cash In / Cash Out / Paid In / Paid Out)
 * POST /api/cash/movements
 */
export async function createCashMovementHandler(req: Request, res: Response) {
  try {
    const tenant = await resolveTenantContext(req);
    const authUser = (req as any).user;
    const performedById = authUser?.id || req.body.performedById;

    if (!performedById) {
      return res.status(400).json({ error: 'User ID performing cash movement is required' });
    }

    const {
      shiftId,
      movementType,
      amount,
      direction,
      reason,
      reasonCode,
      managerPin,
      threshold,
      metadata,
    } = req.body;

    const validTypes = ['CASH_IN', 'CASH_OUT', 'OPENING_FLOAT', 'REFUND', 'CASH_ADJUSTMENT'];
    const normType = (movementType || 'CASH_IN').toUpperCase();

    if (!validTypes.includes(normType)) {
      return res.status(400).json({ error: `Invalid cash movement type. Must be one of: ${validTypes.join(', ')}` });
    }

    const amountVal = Math.abs(Number(amount) || 0);
    if (amountVal <= 0) {
      return res.status(400).json({ error: 'Cash movement amount must be greater than zero' });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'A valid reason is required for cash movements' });
    }

    const dir = direction ? String(direction).toUpperCase() : (normType === 'CASH_OUT' ? 'OUT' : 'IN');
    const cashThreshold = Number(threshold) || DEFAULT_CASH_THRESHOLD;

    // Find active shift if shiftId not explicitly passed
    let activeShiftId = shiftId;
    if (!activeShiftId) {
      const currentShift = await prisma.registerShift.findFirst({
        where: { organizationId: tenant.organizationId, status: 'open' },
        orderBy: { openedAt: 'desc' },
      });
      if (currentShift) activeShiftId = currentShift.id;
    }

    // Check if amount exceeds threshold requiring approval
    const exceedsThreshold = amountVal > cashThreshold;

    if (exceedsThreshold) {
      // Check if immediate manager authorization is provided
      const authCheck = await verifyManagerAuthority(tenant.organizationId, managerPin, authUser);

      if (!authCheck.verified || (authCheck.managerUser && authCheck.managerUser.id === performedById)) {
        // Create PENDING Approval Request requiring independent manager approval
        const metaObj = {
          movementType: normType,
          direction: dir,
          shiftId: activeShiftId,
          exceedsThreshold: true,
          threshold: cashThreshold,
          ...(typeof metadata === 'object' ? metadata : {}),
        };

        const approval = await prisma.financialApproval.create({
          data: {
            organizationId: tenant.organizationId,
            branchId: tenant.branchId || null,
            shiftId: activeShiftId || null,
            type: 'CASH_ADJUSTMENT',
            status: 'PENDING',
            requesterId: performedById,
            amount: amountVal,
            reason: String(reason).trim(),
            reasonCode: reasonCode ? String(reasonCode).trim() : null,
            entityType: 'CASH_MOVEMENT',
            metadata: JSON.stringify(metaObj),
          },
          include: {
            requester: { select: { id: true, name: true, username: true, role: true } },
          },
        });

        await logAuditEvent({
          organizationId: tenant.organizationId,
          branchId: tenant.branchId || null,
          userId: performedById,
          action: AUDIT_ACTIONS.APPROVAL_REQUESTED || 'APPROVAL_REQUESTED',
          entity: 'FINANCIAL_APPROVAL',
          entityId: approval.id,
          metadata: { type: 'CASH_ADJUSTMENT', amount: amountVal, threshold: cashThreshold },
          ipAddress: req.ip,
        });

        return res.status(202).json({
          success: true,
          requiresApproval: true,
          message: `Cash movement amount ($${amountVal}) exceeds threshold ($${cashThreshold}). Manager approval request submitted.`,
          approval,
        });
      }
    }

    // Amount within threshold OR authorized on the spot by independent manager
    const movement = await prisma.cashMovement.create({
      data: {
        organizationId: tenant.organizationId,
        branchId: tenant.branchId || null,
        shiftId: activeShiftId || null,
        movementType: normType,
        amount: amountVal,
        direction: dir,
        reason: String(reason).trim(),
        reasonCode: reasonCode ? String(reasonCode).trim() : null,
        performedById,
        metadata: typeof metadata === 'object' ? JSON.stringify(metadata) : (metadata || '{}'),
      },
      include: {
        performedBy: { select: { id: true, name: true, username: true, role: true } },
      },
    });

    await logAuditEvent({
      organizationId: tenant.organizationId,
      branchId: tenant.branchId || null,
      userId: performedById,
      action: AUDIT_ACTIONS.CASH_MOVEMENT_CREATED || 'CASH_MOVEMENT_CREATED',
      entity: 'CASH_MOVEMENT',
      entityId: movement.id,
      metadata: { movementType: normType, amount: amountVal, direction: dir, shiftId: activeShiftId },
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, requiresApproval: false, movement });
  } catch (error: any) {
    console.error('Create cash movement error:', error);
    return res.status(500).json({ error: 'Failed to record cash movement' });
  }
}

/**
 * List Cash Movements
 * GET /api/cash/movements
 */
export async function getCashMovementsHandler(req: Request, res: Response) {
  try {
    const tenant = await resolveTenantContext(req);
    const { shiftId, branchId, movementType } = req.query;

    const where: any = { organizationId: tenant.organizationId };
    if (shiftId && String(shiftId).trim()) where.shiftId = String(shiftId).trim();
    if (branchId && String(branchId).trim()) where.branchId = String(branchId).trim();
    if (movementType && String(movementType).trim()) where.movementType = String(movementType).trim().toUpperCase();

    const movements = await prisma.cashMovement.findMany({
      where,
      include: {
        performedBy: { select: { id: true, name: true, username: true, role: true } },
        approval: { select: { id: true, status: true, approverId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return res.json({ success: true, movements });
  } catch (error: any) {
    console.error('Get cash movements error:', error);
    return res.status(500).json({ error: 'Failed to retrieve cash movements' });
  }
}

/**
 * Conduct Spot Check Cash Audit
 * POST /api/cash/audit
 */
export async function conductCashAuditHandler(req: Request, res: Response) {
  try {
    const tenant = await resolveTenantContext(req);
    const authUser = (req as any).user;
    const conductedById = authUser?.id || req.body.conductedById;

    if (!conductedById) {
      return res.status(400).json({ error: 'Conducted by user ID is required' });
    }

    const { shiftId, actualCash, notes, reason, reasonCode } = req.body;

    if (!shiftId) {
      return res.status(400).json({ error: 'Shift ID is required for cash audit' });
    }

    const shift = await prisma.registerShift.findFirst({
      where: {
        organizationId: tenant.organizationId,
        OR: [{ id: shiftId }, { shiftNumber: shiftId }],
      },
    });

    if (!shift) {
      return sendTenantNotFound(res, 'RegisterShift', shiftId);
    }

    // Compute expected cash for shift
    const cashMovements = await prisma.cashMovement.findMany({
      where: { organizationId: tenant.organizationId, shiftId: shift.id },
    });

    let netMovements = 0;
    for (const m of cashMovements) {
      if (m.direction === 'IN') netMovements += m.amount;
      else if (m.direction === 'OUT') netMovements -= m.amount;
    }

    const startingFloat = Number(shift.startingPettyCash !== null ? shift.startingPettyCash : shift.startingFloat) || 0;
    const expectedCash = startingFloat + (shift.cashSales || 0) + netMovements;
    const countedCash = Number(actualCash) || 0;
    const variance = countedCash - expectedCash;
    const classification = classifyVariance(variance);

    let approvalId: string | null = null;
    let approvalCreated = null;

    // If variance requires review or is material variance, create PENDING FinancialApproval
    if (classification !== VARIANCE_CLASSIFICATION.WITHIN_TOLERANCE) {
      const approval = await prisma.financialApproval.create({
        data: {
          organizationId: tenant.organizationId,
          branchId: shift.branchId,
          shiftId: shift.id,
          type: 'CASH_AUDIT',
          status: 'PENDING',
          requesterId: conductedById,
          amount: Math.abs(variance),
          reason: reason || `Cash audit spot check variance (${variance >= 0 ? '+' : ''}${variance.toFixed(2)}) - ${classification}`,
          reasonCode: reasonCode || 'CASH_VARIANCE',
          entityType: 'SHIFT',
          entityId: shift.id,
          metadata: JSON.stringify({
            expectedCash,
            actualCash: countedCash,
            variance,
            classification,
          }),
        },
      });
      approvalId = approval.id;
      approvalCreated = approval;
    }

    const audit = await prisma.cashAudit.create({
      data: {
        organizationId: tenant.organizationId,
        branchId: shift.branchId,
        shiftId: shift.id,
        conductedById,
        expectedCash,
        actualCash: countedCash,
        variance,
        varianceClassification: classification,
        reason: reason || null,
        reasonCode: reasonCode || null,
        approvalId,
        notes: notes || null,
      },
      include: {
        conductedBy: { select: { id: true, name: true, username: true, role: true } },
        approval: true,
      },
    });

    await logAuditEvent({
      organizationId: tenant.organizationId,
      branchId: shift.branchId || null,
      userId: conductedById,
      action: AUDIT_ACTIONS.CASH_AUDIT_CONDUCTED || 'CASH_AUDIT_CONDUCTED',
      entity: 'CASH_AUDIT',
      entityId: audit.id,
      metadata: { expectedCash, actualCash: countedCash, variance, classification },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      audit,
      requiresApproval: classification !== VARIANCE_CLASSIFICATION.WITHIN_TOLERANCE,
      approval: approvalCreated,
    });
  } catch (error: any) {
    console.error('Conduct cash audit error:', error);
    return res.status(500).json({ error: 'Failed to conduct cash audit' });
  }
}

/**
 * List Cash Audits
 * GET /api/cash/audits
 */
export async function getCashAuditsHandler(req: Request, res: Response) {
  try {
    const tenant = await resolveTenantContext(req);
    const { shiftId, branchId } = req.query;

    const where: any = { organizationId: tenant.organizationId };
    if (shiftId && String(shiftId).trim()) where.shiftId = String(shiftId).trim();
    if (branchId && String(branchId).trim()) where.branchId = String(branchId).trim();

    const audits = await prisma.cashAudit.findMany({
      where,
      include: {
        conductedBy: { select: { id: true, name: true, username: true, role: true } },
        approval: { select: { id: true, status: true, approverId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return res.json({ success: true, audits });
  } catch (error: any) {
    console.error('Get cash audits error:', error);
    return res.status(500).json({ error: 'Failed to retrieve cash audits' });
  }
}

/**
 * Resolve Shift Variance
 * POST /api/cash/variance-resolution
 */
export async function resolveVarianceHandler(req: Request, res: Response) {
  try {
    const tenant = await resolveTenantContext(req);
    const authUser = (req as any).user;
    const { shiftId, varianceAmount, resolutionNote, managerPin } = req.body;

    if (!shiftId) {
      return res.status(400).json({ error: 'Shift ID is required for variance resolution' });
    }

    const shift = await prisma.registerShift.findFirst({
      where: { organizationId: tenant.organizationId, OR: [{ id: shiftId }, { shiftNumber: shiftId }] },
    });

    if (!shift) {
      return sendTenantNotFound(res, 'RegisterShift', shiftId);
    }

    const authCheck = await verifyManagerAuthority(tenant.organizationId, managerPin, authUser);
    if (!authCheck.verified) {
      return res.status(401).json({ error: authCheck.error || 'Manager authorization required to resolve variance' });
    }

    const varAmt = Number(varianceAmount) || (shift.cashDifference || 0);

    // Create FinancialApproval record for variance resolution
    const approval = await prisma.financialApproval.create({
      data: {
        organizationId: tenant.organizationId,
        branchId: shift.branchId,
        shiftId: shift.id,
        type: 'VARIANCE_RESOLUTION',
        status: 'APPROVED',
        requesterId: authUser?.id || authCheck.managerUser.id,
        approverId: authCheck.managerUser.id,
        amount: Math.abs(varAmt),
        reason: resolutionNote || 'Shift closing cash variance resolution',
        reasonCode: 'CASH_VARIANCE',
        entityType: 'SHIFT',
        entityId: shift.id,
        processedAt: new Date(),
      },
      include: {
        approver: { select: { id: true, name: true, username: true, role: true } },
      },
    });

    await logAuditEvent({
      organizationId: tenant.organizationId,
      branchId: shift.branchId || null,
      userId: authCheck.managerUser.id,
      action: AUDIT_ACTIONS.VARIANCE_RESOLVED || 'VARIANCE_RESOLVED',
      entity: 'REGISTER_SHIFT',
      entityId: shift.id,
      metadata: { varianceAmount: varAmt, resolutionNote, approvalId: approval.id },
      ipAddress: req.ip,
    });

    return res.json({ success: true, resolution: approval });
  } catch (error: any) {
    console.error('Resolve variance error:', error);
    return res.status(500).json({ error: 'Failed to resolve cash variance' });
  }
}
