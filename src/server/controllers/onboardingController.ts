import { Request, Response } from 'express';
import prisma from '../prisma';
import { evaluateOnboardingReadiness } from '../services/onboardingService';
import { logAuditEvent, AUDIT_ACTIONS } from '../auth/auditService';

/**
 * GET /api/portal/onboarding
 * Gets full server-evaluated onboarding state, service model, and step progress.
 */
export async function getOnboardingState(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const readiness = await evaluateOnboardingReadiness(organizationId, req.query.branchId as string);

    return res.json({
      success: true,
      data: readiness,
    });
  } catch (error: any) {
    console.error('[OnboardingController] getOnboardingState error:', error);
    return res.status(500).json({ error: 'Failed to retrieve onboarding state' });
  }
}

/**
 * GET /api/portal/onboarding/readiness
 * Evaluates readiness checks server-side.
 */
export async function checkOnboardingReadiness(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const readiness = await evaluateOnboardingReadiness(organizationId, req.query.branchId as string);

    await logAuditEvent({
      organizationId,
      userId: req.tenant?.userId || 'unknown',
      action: readiness.isReady
        ? AUDIT_ACTIONS.ONBOARDING_READINESS_CHECKED
        : AUDIT_ACTIONS.ONBOARDING_READINESS_FAILED,
      entity: 'ORGANIZATION',
      entityId: organizationId,
      metadata: { isReady: readiness.isReady, progressPercentage: readiness.progressPercentage },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      data: readiness,
    });
  } catch (error: any) {
    console.error('[OnboardingController] checkOnboardingReadiness error:', error);
    return res.status(500).json({ error: 'Failed to evaluate readiness' });
  }
}

/**
 * POST /api/portal/onboarding/start
 * Initializes onboarding status to IN_PROGRESS.
 */
export async function startOnboarding(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';

    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (org.onboardingStatus === 'NOT_STARTED') {
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          onboardingStatus: 'IN_PROGRESS',
          onboardingStartedAt: new Date(),
        },
      });

      await logAuditEvent({
        organizationId,
        userId,
        action: AUDIT_ACTIONS.ONBOARDING_STARTED,
        entity: 'ORGANIZATION',
        entityId: organizationId,
        metadata: { status: 'IN_PROGRESS' },
        ipAddress: req.ip,
      });
    }

    const readiness = await evaluateOnboardingReadiness(organizationId);

    return res.json({
      success: true,
      message: 'Onboarding initialized',
      data: readiness,
    });
  } catch (error: any) {
    console.error('[OnboardingController] startOnboarding error:', error);
    return res.status(500).json({ error: 'Failed to start onboarding' });
  }
}

/**
 * POST /api/portal/onboarding/service-model
 * Configures the restaurant service model (DINE_IN, COUNTER_SERVICE, TAKEAWAY_ONLY, HYBRID).
 */
export async function setServiceModel(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { serviceModel } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const validModels = ['DINE_IN', 'COUNTER_SERVICE', 'TAKEAWAY_ONLY', 'HYBRID', 'QUICK_SERVICE', 'BAKERY', 'CLOUD_KITCHEN'];
    if (!serviceModel || !validModels.includes(serviceModel)) {
      return res.status(400).json({ error: `Invalid serviceModel. Allowed: ${validModels.join(', ')}` });
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: { serviceModel },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.ONBOARDING_SERVICE_MODEL_SET,
      entity: 'ORGANIZATION',
      entityId: organizationId,
      metadata: { serviceModel },
      ipAddress: req.ip,
    });

    const readiness = await evaluateOnboardingReadiness(organizationId);

    return res.json({
      success: true,
      message: `Service model configured as ${serviceModel}`,
      data: readiness,
    });
  } catch (error: any) {
    console.error('[OnboardingController] setServiceModel error:', error);
    return res.status(500).json({ error: 'Failed to set service model' });
  }
}

/**
 * POST /api/portal/onboarding/test-order
 * Executes a safe training test order transaction without polluting real financial reports.
 */
export async function executeTestOrder(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { branchId } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const branch = await prisma.branch.findFirst({
      where: { organizationId, ...(branchId ? { id: branchId } : {}) },
    });

    if (!branch) {
      return res.status(400).json({ error: 'Valid branch required for test order' });
    }

    // Get a sample menu item or create a placeholder if none exists
    let sampleItem = await prisma.menuItem.findFirst({
      where: { organizationId, active: true },
    });

    const orderNumber = `TEST-${Date.now().toString().slice(-6)}`;

    const testOrder = await prisma.order.create({
      data: {
        organizationId,
        branchId: branch.id,
        orderNumber,
        status: 'COMPLETED',
        orderType: 'TAKEAWAY',
        paymentStatus: 'PAID',
        paymentMethod: 'TEST_TRAINING',
        subtotal: sampleItem ? sampleItem.price : 12.0,
        tax: sampleItem ? sampleItem.price * 0.1 : 1.2,
        total: sampleItem ? sampleItem.price * 1.1 : 13.2,
        isTraining: true,
        createdById: userId !== 'unknown' ? userId : null,
        notes: 'Phase 19 Safe Onboarding Test Order',
        items: {
          create: [
            {
              name: sampleItem ? sampleItem.title : 'Sample Test Burger',
              price: sampleItem ? sampleItem.price : 12.0,
              quantity: 1,
              menuItemId: sampleItem ? sampleItem.id : null,
            },
          ],
        },
      },
      include: { items: true },
    });

    await logAuditEvent({
      organizationId,
      branchId: branch.id,
      userId,
      action: AUDIT_ACTIONS.TEST_ORDER_COMPLETED,
      entity: 'ORDER',
      entityId: testOrder.id,
      metadata: { orderNumber: testOrder.orderNumber, total: testOrder.total, isTraining: true },
      ipAddress: req.ip,
    });

    const readiness = await evaluateOnboardingReadiness(organizationId);

    return res.status(201).json({
      success: true,
      message: 'Training test order completed successfully',
      data: { order: testOrder, readiness },
    });
  } catch (error: any) {
    console.error('[OnboardingController] executeTestOrder error:', error);
    return res.status(500).json({ error: 'Failed to execute test order' });
  }
}

/**
 * POST /api/portal/onboarding/complete
 * Performs server-side validation. Completes onboarding ONLY if all required readiness checks pass.
 */
export async function completeOnboarding(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';

    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const readiness = await evaluateOnboardingReadiness(organizationId);

    if (!readiness.isReady) {
      await logAuditEvent({
        organizationId,
        userId,
        action: AUDIT_ACTIONS.ONBOARDING_READINESS_FAILED,
        entity: 'ORGANIZATION',
        entityId: organizationId,
        metadata: { blockingReasons: readiness.blockingReasons },
        ipAddress: req.ip,
      });

      return res.status(400).json({
        error: 'Cannot complete onboarding. Required setup steps are incomplete.',
        blockingReasons: readiness.blockingReasons,
        readiness,
      });
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        onboardingStatus: 'COMPLETED',
        onboardingCompletedAt: new Date(),
      },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.ONBOARDING_COMPLETED,
      entity: 'ORGANIZATION',
      entityId: organizationId,
      metadata: { completedAt: new Date().toISOString() },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: 'Restaurant onboarding completed! Your restaurant is ready for live operations.',
      data: {
        onboardingStatus: 'COMPLETED',
        readiness,
      },
    });
  } catch (error: any) {
    console.error('[OnboardingController] completeOnboarding error:', error);
    return res.status(500).json({ error: 'Failed to complete onboarding' });
  }
}
