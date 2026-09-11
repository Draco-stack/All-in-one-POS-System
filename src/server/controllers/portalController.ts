import { Request, Response } from 'express';
import prisma from '../prisma';
import { logAuditEvent } from '../auth/auditService';
import { revokeSession } from '../auth/sessionService';

/**
 * Customer Portal Overview
 * Serves server-authoritative organization, subscription, resource counts, and critical trial warnings.
 */
export async function getPortalOverview(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const [org, subscription, branchCount, staffCount, deviceCount, orderCount, recentLogs] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          trialUsedAt: true,
          settings: true,
          createdAt: true,
        },
      }),
      prisma.subscription.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.branch.count({ where: { organizationId, active: true } }),
      prisma.user.count({ where: { organizationId, active: true } }),
      prisma.device.count({ where: { organizationId, status: 'ACTIVE' } }),
      prisma.order.count({ where: { organizationId } }),
      prisma.auditLog.findMany({
        where: { organizationId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, role: true } } },
      }),
    ]);

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const now = new Date();
    let daysRemaining: number | null = null;
    let showCriticalWarning = false;
    let isExpired = false;

    if (subscription && subscription.trialEndsAt) {
      const trialDate = new Date(subscription.trialEndsAt);
      const diffMs = trialDate.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      showCriticalWarning = daysRemaining <= 3 && (subscription.status === 'TRIALING' || subscription.status === 'ACTIVE');
      isExpired = trialDate <= now && subscription.status === 'TRIALING';
    }

    return res.json({
      success: true,
      data: {
        organization: org,
        subscription: subscription ? {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          trialEndsAt: subscription.trialEndsAt,
          daysRemaining,
          showCriticalWarning,
          isExpired,
        } : null,
        counts: {
          branches: branchCount,
          staff: staffCount,
          devices: deviceCount,
          orders: orderCount,
        },
        recentActivity: recentLogs,
      },
    });
  } catch (error: any) {
    console.error('[PortalController] getPortalOverview error:', error);
    return res.status(500).json({ error: 'Failed to load customer portal overview' });
  }
}

/**
 * Customer Portal Subscription Details & Billing
 */
export async function getPortalSubscription(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { organization: { select: { name: true, status: true, trialUsedAt: true } } },
    });

    const reminderLogs = await prisma.subscriptionReminderLog.findMany({
      where: { organizationId },
      orderBy: { sentAt: 'desc' },
      take: 10,
    });

    const now = new Date();
    let daysRemaining = 0;
    if (subscription?.trialEndsAt) {
      const diffMs = new Date(subscription.trialEndsAt).getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return res.json({
      success: true,
      data: {
        subscription,
        daysRemaining,
        showCriticalWarning: daysRemaining <= 3 && subscription?.status === 'TRIALING',
        reminderLogs,
        availablePlans: [
          { name: 'STARTER', price: '$29/mo', maxBranches: 2, maxStaff: 10, maxDevices: 5 },
          { name: 'BUSINESS', price: '$79/mo', maxBranches: 10, maxStaff: 50, maxDevices: 20 },
          { name: 'ENTERPRISE', price: '$199/mo', maxBranches: 100, maxStaff: 1000, maxDevices: 200 },
        ],
      },
    });
  } catch (error: any) {
    console.error('[PortalController] getPortalSubscription error:', error);
    return res.status(500).json({ error: 'Failed to retrieve subscription details' });
  }
}

/**
 * Customer Upgrade Plan Handler
 */
export async function upgradePortalSubscription(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const { plan } = req.body;
    const userId = req.tenant?.userId || 'unknown';

    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const validPlans = ['STARTER', 'BUSINESS', 'ENTERPRISE'];
    const targetPlan = (plan || '').toUpperCase();
    if (!validPlans.includes(targetPlan)) {
      return res.status(400).json({ error: `Invalid plan. Allowed plans: ${validPlans.join(', ')}` });
    }

    const existingSub = await prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    let updatedSub;
    if (existingSub) {
      updatedSub = await prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          plan: targetPlan,
          status: 'ACTIVE',
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day billing cycle
        },
      });
    } else {
      updatedSub = await prisma.subscription.create({
        data: {
          organizationId,
          plan: targetPlan,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: { status: 'ACTIVE' },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: 'SUBSCRIPTION_UPGRADED',
      entity: 'SUBSCRIPTION',
      entityId: updatedSub.id,
      metadata: { newPlan: targetPlan },
      ipAddress: req.ip,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('subscriptionUpdated', { organizationId, status: 'ACTIVE', plan: targetPlan });
      io.emit('SUBSCRIPTION_REACTIVATED', { organizationId, status: 'ACTIVE', plan: targetPlan });
    }

    return res.json({
      success: true,
      message: `Successfully upgraded to ${targetPlan} plan!`,
      data: updatedSub,
    });
  } catch (error: any) {
    console.error('[PortalController] upgradePortalSubscription error:', error);
    return res.status(500).json({ error: 'Failed to process plan upgrade' });
  }
}

/**
 * Customer Portal Restaurant Settings
 */
export async function getPortalRestaurant(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        branches: true,
      },
    });

    return res.json({
      success: true,
      data: org,
    });
  } catch (error: any) {
    console.error('[PortalController] getPortalRestaurant error:', error);
    return res.status(500).json({ error: 'Failed to load restaurant profile' });
  }
}

/**
 * Customer Portal Team Directory
 */
export async function getPortalTeam(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const users = await prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        active: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    console.error('[PortalController] getPortalTeam error:', error);
    return res.status(500).json({ error: 'Failed to load team directory' });
  }
}

/**
 * Customer Portal Hardware Devices
 */
export async function getPortalDevices(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const devices = await prisma.device.findMany({
      where: { organizationId },
      include: {
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      data: devices,
    });
  } catch (error: any) {
    console.error('[PortalController] getPortalDevices error:', error);
    return res.status(500).json({ error: 'Failed to load registered devices' });
  }
}

/**
 * Customer Portal Security & Sessions
 */
export async function getPortalSessions(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const sessions = await prisma.session.findMany({
      where: { organizationId, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, name: true, role: true, username: true } },
      },
      orderBy: { lastUsedAt: 'desc' },
    });

    return res.json({
      success: true,
      data: sessions,
    });
  } catch (error: any) {
    console.error('[PortalController] getPortalSessions error:', error);
    return res.status(500).json({ error: 'Failed to load active security sessions' });
  }
}

/**
 * Revoke User Session from Customer Portal
 */
export async function revokePortalSession(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const { sessionId } = req.body;

    if (!organizationId || !sessionId) {
      return res.status(400).json({ error: 'Session ID and organization context required' });
    }

    const session = await prisma.session.findFirst({
      where: { id: sessionId, organizationId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found for this organization' });
    }

    await revokeSession(sessionId);

    return res.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error: any) {
    console.error('[PortalController] revokePortalSession error:', error);
    return res.status(500).json({ error: 'Failed to revoke session' });
  }
}
