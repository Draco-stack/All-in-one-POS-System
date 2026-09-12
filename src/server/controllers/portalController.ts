import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { logAuditEvent, AUDIT_ACTIONS } from '../auth/auditService';
import { convertUnit, canonicalUnit } from '../services/inventoryService';
import { revokeSession, revokeAllUserSessions } from '../auth/sessionService';
import { assertResourceLimit } from '../billing/billingSystem';
import { sendStaffInvitationEmail, maskEmail } from '../auth/emailVerificationService';

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
          onboardingStatus: true,
          onboardingStartedAt: true,
          onboardingCompletedAt: true,
          onboardingVersion: true,
          serviceModel: true,
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

    // Calculate live operational metrics from DB (excluding test/training orders)
    const [openShiftsCount, activeOrdersCount, pendingKitchenCount, paidOrdersAggregate] = await Promise.all([
      prisma.registerShift.count({ where: { organizationId, status: 'open' } }),
      prisma.order.count({ where: { organizationId, isTraining: false, status: { in: ['PUNCHED', 'PREPARING', 'READY', 'IN_KITCHEN', 'pending', 'open'] } } }),
      prisma.order.count({ where: { organizationId, isTraining: false, status: { in: ['PUNCHED', 'MODIFIED', 'punched', 'modified', 'in_kitchen', 'pending'] } } }),
      prisma.order.aggregate({
        where: { organizationId, isTraining: false, paymentStatus: 'PAID' },
        _sum: { total: true, subtotal: true, tax: true, discount: true },
        _count: { id: true },
      }),
    ]);

    let lowStockCount = 0;
    try {
      if (org.settings) {
        const parsed = typeof org.settings === 'string' ? JSON.parse(org.settings) : org.settings;
        if (Array.isArray(parsed.inventory)) {
          lowStockCount = parsed.inventory.filter((i: any) => Number(i.currentStock || 0) <= Number(i.minStock || 0)).length;
        }
      }
    } catch (e) {}

    const grossSales = Number(paidOrdersAggregate._sum.total || 0);
    const netSales = Number(paidOrdersAggregate._sum.subtotal || 0);
    const taxTotal = Number(paidOrdersAggregate._sum.tax || 0);
    const discountTotal = Number(paidOrdersAggregate._sum.discount || 0);
    const paidOrderCount = paidOrdersAggregate._count.id || 0;
    const averageOrderValue = paidOrderCount > 0 ? grossSales / paidOrderCount : 0;

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
          openShifts: openShiftsCount,
          activeOrders: activeOrdersCount,
          pendingKitchen: pendingKitchenCount,
          lowStock: lowStockCount,
        },
        metrics: {
          grossSales,
          netSales,
          taxTotal,
          discountTotal,
          paidOrderCount,
          averageOrderValue,
          notEnoughData: orderCount === 0,
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
      io.to(`org_${organizationId}`).emit('subscriptionUpdated', { organizationId, status: 'ACTIVE', plan: targetPlan });
      io.to(`org_${organizationId}`).emit('SUBSCRIPTION_REACTIVATED', { organizationId, status: 'ACTIVE', plan: targetPlan });
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
 * Customer Portal Team Directory (Phase 24).
 * Returns employee profiles scoped to tenant and authorized branches for managers.
 */
export async function getPortalTeam(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const currentUserRole = (req.tenant?.role || '').toUpperCase();
    const authorizedBranches = req.tenant?.authorizedBranchIds || (req.tenant?.branchId ? [req.tenant.branchId] : []);
    const isMultiBranch = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN' || currentUserRole === 'PLATFORM_ADMIN' || currentUserRole === 'EXECUTIVE_ADMIN';

    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const whereClause: any = {
      organizationId,
      role: { notIn: ['PLATFORM_ADMIN', 'EXECUTIVE_ADMIN'] },
    };

    if (!isMultiBranch && authorizedBranches.length > 0) {
      whereClause.OR = [
        { branchId: { in: authorizedBranches } },
        { branchAssignments: { some: { branchId: { in: authorizedBranches } } } },
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        active: true,
        mustChangePassword: true,
        restrictions: true,
        createdAt: true,
        updatedAt: true,
        branch: { select: { id: true, name: true, slug: true } },
        branchAssignments: {
          include: {
            branch: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({
      success: true,
      data: users,
      staff: users,
    });
  } catch (error: any) {
    console.error('[PortalController] getPortalTeam error:', error);
    return res.status(500).json({ error: 'Failed to load team directory' });
  }
}

/**
 * Customer Portal Staff Detail (Phase 24).
 * Returns a specific employee profile.
 */
export async function getPortalStaffById(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const currentUserRole = (req.tenant?.role || '').toUpperCase();
    const authorizedBranches = req.tenant?.authorizedBranchIds || (req.tenant?.branchId ? [req.tenant.branchId] : []);
    const isMultiBranch = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN' || currentUserRole === 'PLATFORM_ADMIN' || currentUserRole === 'EXECUTIVE_ADMIN';
    const { userId } = req.params;

    if (!organizationId || !userId) {
      return res.status(400).json({ error: 'Staff ID and organization context required' });
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        active: true,
        mustChangePassword: true,
        restrictions: true,
        createdAt: true,
        updatedAt: true,
        branch: { select: { id: true, name: true, slug: true } },
        branchAssignments: {
          include: {
            branch: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Staff member not found in this organization' });
    }

    // Branch scoping for managers
    if (!isMultiBranch) {
      const assignedBranchIds = [
        ...(user.branch ? [user.branch.id] : []),
        ...(user.branchAssignments?.map((ba) => ba.branch.id) || []),
      ];
      const hasOverlap = assignedBranchIds.some((bId) => authorizedBranches.includes(bId));
      if (!hasOverlap && assignedBranchIds.length > 0) {
        return res.status(403).json({ error: 'Forbidden: Staff member is outside your branch management scope' });
      }
    }

    return res.json({
      success: true,
      data: user,
      staff: user,
    });
  } catch (error: any) {
    console.error('[PortalController] getPortalStaffById error:', error);
    return res.status(500).json({ error: 'Failed to load staff details' });
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

/**
 * ============================================================================
 * BRANCH MANAGEMENT (PHASE 17)
 * ============================================================================
 */

export async function getPortalBranches(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const branches = await prisma.branch.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: {
            users: true,
            devices: true,
            orders: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({
      success: true,
      data: branches,
    });
  } catch (error: any) {
    console.error('[PortalController] getPortalBranches error:', error);
    return res.status(500).json({ error: 'Failed to load organization branches' });
  }
}

export async function createPortalBranch(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { name, address, phone } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Branch name is required' });
    }

    const trimmedName = name.trim();
    const branchSlug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);

    const createdBranch = await prisma.$transaction(async (tx) => {
      // Enforce plan branch limits
      await assertResourceLimit(tx, organizationId, 'branches');

      const branch = await tx.branch.create({
        data: {
          organizationId,
          name: trimmedName,
          slug: branchSlug,
          active: true,
          settings: JSON.stringify({ address: address || '', phone: phone || '' }),
        },
      });

      // Also create outlet record for POS compatibility
      await tx.outlet.create({
        data: {
          organizationId,
          name: trimmedName,
          address: address || '',
          phone: phone || '',
          active: true,
        },
      }).catch(() => {});

      return branch;
    });

    await logAuditEvent({
      organizationId,
      userId,
      branchId: createdBranch.id,
      action: AUDIT_ACTIONS.BRANCH_CREATED,
      entity: 'BRANCH',
      entityId: createdBranch.id,
      metadata: { branchName: trimmedName },
      ipAddress: req.ip,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Branch created successfully',
      data: createdBranch,
    });
  } catch (error: any) {
    console.error('[PortalController] createPortalBranch error:', error);
    if (error?.message && (error.message.includes('LIMIT_EXCEEDED') || error.message.includes('SUBSCRIPTION_RESTRICTED'))) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to create branch' });
  }
}

export async function updatePortalBranch(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { branchId } = req.params;
    const { name, active, address, phone } = req.body;

    if (!organizationId || !branchId) {
      return res.status(400).json({ error: 'Branch ID and organization context required' });
    }

    const existingBranch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });

    if (!existingBranch) {
      return res.status(404).json({ error: 'Branch not found in this organization' });
    }

    const dataToUpdate: any = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Branch name cannot be empty' });
      }
      dataToUpdate.name = name.trim();
    }
    if (active !== undefined) {
      dataToUpdate.active = Boolean(active);
    }
    if (address !== undefined || phone !== undefined) {
      let currentSettings = {};
      try {
        currentSettings = JSON.parse(existingBranch.settings || '{}');
      } catch (e) {}
      dataToUpdate.settings = JSON.stringify({
        ...currentSettings,
        ...(address !== undefined ? { address } : {}),
        ...(phone !== undefined ? { phone } : {}),
      });
    }

    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: dataToUpdate,
    });

    await logAuditEvent({
      organizationId,
      userId,
      branchId,
      action: active === false ? AUDIT_ACTIONS.BRANCH_DEACTIVATED : AUDIT_ACTIONS.BRANCH_UPDATED,
      entity: 'BRANCH',
      entityId: branchId,
      metadata: { changes: dataToUpdate },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: 'Branch updated successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error('[PortalController] updatePortalBranch error:', error);
    return res.status(500).json({ error: 'Failed to update branch' });
  }
}

export async function deletePortalBranch(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { branchId } = req.params;

    if (!organizationId || !branchId) {
      return res.status(400).json({ error: 'Branch ID and organization context required' });
    }

    const existingBranch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      include: {
        _count: {
          select: { orders: true, users: true },
        },
      },
    });

    if (!existingBranch) {
      return res.status(404).json({ error: 'Branch not found in this organization' });
    }

    // Safety: if branch has historical orders or assigned staff, soft-deactivate instead of destructive delete
    if (existingBranch._count.orders > 0 || existingBranch._count.users > 0) {
      await prisma.branch.update({
        where: { id: branchId },
        data: { active: false },
      });
      await prisma.outlet.updateMany({
        where: { organizationId, name: existingBranch.name },
        data: { active: false },
      }).catch(() => {});
    } else {
      await prisma.branch.delete({ where: { id: branchId } });
      await prisma.outlet.deleteMany({
        where: { organizationId, name: existingBranch.name },
      }).catch(() => {});
    }

    await logAuditEvent({
      organizationId,
      userId,
      branchId,
      action: AUDIT_ACTIONS.BRANCH_DEACTIVATED,
      entity: 'BRANCH',
      entityId: branchId,
      metadata: { branchName: existingBranch.name },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: 'Branch removed or deactivated successfully',
    });
  } catch (error: any) {
    console.error('[PortalController] deletePortalBranch error:', error);
    return res.status(500).json({ error: 'Failed to remove branch' });
  }
}

/**
 * ============================================================================
 * STAFF MANAGEMENT (PHASE 17)
 * ============================================================================
 */

export async function createPortalStaff(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const currentUserId = req.tenant?.userId || 'unknown';
    const currentUserRole = (req.tenant?.role || '').toUpperCase();
    const authorizedBranches = req.tenant?.authorizedBranchIds || (req.tenant?.branchId ? [req.tenant.branchId] : []);
    const { name, username, pin, role, phone, branchId, branchIds, restrictions, mustChangePassword } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Staff name is required' });
    }

    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username / email is required' });
    }

    const sanitizedUsername = username.trim().toLowerCase();

    if (!pin || typeof pin !== 'string' || !pin.trim()) {
      return res.status(400).json({ error: 'Password / PIN is required' });
    }

    const roleUpper = (role || 'CASHIER').toString().toUpperCase();

    // Role Escalation Prevention: Non-Platform Admins cannot create PLATFORM_ADMIN or EXECUTIVE_ADMIN
    if (['PLATFORM_ADMIN', 'EXECUTIVE_ADMIN'].includes(roleUpper)) {
      return res.status(403).json({ error: 'Forbidden: Cannot create Platform Admin accounts' });
    }

    // Role Hierarchy: MANAGER cannot create OWNER or ADMIN
    if (currentUserRole === 'MANAGER' && ['OWNER', 'ADMIN', 'PLATFORM_ADMIN', 'EXECUTIVE_ADMIN'].includes(roleUpper)) {
      return res.status(403).json({ error: 'Forbidden: Managers cannot create administrative or owner accounts' });
    }

    const validRoles = ['CASHIER', 'MANAGER', 'OWNER', 'RIDER', 'KITCHEN', 'ADMIN', 'SERVER'];
    if (!validRoles.includes(roleUpper)) {
      return res.status(400).json({ error: `Invalid role. Allowed roles: ${validRoles.join(', ')}` });
    }

    // Check duplicate username in this organization
    const existing = await prisma.user.findFirst({
      where: { organizationId, username: sanitizedUsername },
    });

    if (existing) {
      return res.status(409).json({ error: `Username '${sanitizedUsername}' is already taken in this organization.` });
    }

    // Validate branch belongs strictly to THIS organization
    let targetBranchId: string | null = null;
    let targetBranchName = 'Main Branch';

    if (branchId) {
      const branchMatch = await prisma.branch.findFirst({
        where: { id: String(branchId), organizationId },
      });
      if (!branchMatch) {
        return res.status(400).json({ error: 'Selected branch does not belong to this organization' });
      }
      // If creator is MANAGER, verify they have authority over this branch
      if (currentUserRole === 'MANAGER' && !authorizedBranches.includes(branchMatch.id)) {
        return res.status(403).json({ error: 'Forbidden: You cannot assign staff to a branch you do not manage' });
      }
      targetBranchId = branchMatch.id;
      targetBranchName = branchMatch.name;
    }

    // Validate additional branchIds if provided
    const allBranchIdsToAssign = new Set<string>();
    if (targetBranchId) allBranchIdsToAssign.add(targetBranchId);

    if (Array.isArray(branchIds)) {
      for (const bId of branchIds) {
        if (bId) {
          const bMatch = await prisma.branch.findFirst({
            where: { id: String(bId), organizationId },
          });
          if (!bMatch) {
            return res.status(400).json({ error: `Branch '${bId}' does not belong to this organization` });
          }
          if (currentUserRole === 'MANAGER' && !authorizedBranches.includes(bMatch.id)) {
            return res.status(403).json({ error: `Forbidden: Branch '${bMatch.name}' is outside your management scope` });
          }
          allBranchIdsToAssign.add(bMatch.id);
        }
      }
    }

    const rawPin = pin.trim();
    const hashedPin = rawPin.startsWith('$2') ? rawPin : await bcrypt.hash(rawPin, 10);
    const serializedRestrictions = typeof restrictions === 'string' ? restrictions : JSON.stringify(restrictions || []);
    const requirePassChange = mustChangePassword !== undefined ? Boolean(mustChangePassword) : true;

    // Fetch organization info for welcome/invitation email
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    const createdStaff = await prisma.$transaction(async (tx) => {
      await assertResourceLimit(tx, organizationId, 'users');

      const user = await tx.user.create({
        data: {
          organizationId,
          branchId: targetBranchId,
          name: name.trim(),
          username: sanitizedUsername,
          pin: hashedPin,
          role: roleUpper,
          phone: phone ? phone.trim() : null,
          active: true,
          mustChangePassword: requirePassChange,
          restrictions: serializedRestrictions,
        },
        select: {
          id: true,
          organizationId: true,
          branchId: true,
          name: true,
          username: true,
          role: true,
          phone: true,
          active: true,
          mustChangePassword: true,
          restrictions: true,
          createdAt: true,
          branch: { select: { id: true, name: true } },
        },
      });

      // Synchronize UserBranchAssignment
      for (const bId of allBranchIdsToAssign) {
        await tx.userBranchAssignment.upsert({
          where: {
            userId_branchId: {
              userId: user.id,
              branchId: bId,
            },
          },
          update: {},
          create: {
            organizationId,
            userId: user.id,
            branchId: bId,
          },
        }).catch(() => {});
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          branchId: targetBranchId,
          userId: currentUserId,
          action: AUDIT_ACTIONS.STAFF_CREATED,
          entity: 'USER',
          entityId: user.id,
          metadata: JSON.stringify({
            staffName: name.trim(),
            role: roleUpper,
            username: sanitizedUsername,
            branchId: targetBranchId,
            assignedBranches: Array.from(allBranchIdsToAssign),
            mustChangePassword: requirePassChange,
          }),
          ipAddress: req.ip,
        },
      }).catch(() => {});

      await tx.auditLog.create({
        data: {
          organizationId,
          branchId: targetBranchId,
          userId: currentUserId,
          action: AUDIT_ACTIONS.STAFF_INVITED,
          entity: 'USER',
          entityId: user.id,
          metadata: JSON.stringify({
            username: sanitizedUsername,
            role: roleUpper,
          }),
          ipAddress: req.ip,
        },
      }).catch(() => {});

      if (targetBranchId) {
        await tx.auditLog.create({
          data: {
            organizationId,
            branchId: targetBranchId,
            userId: currentUserId,
            action: AUDIT_ACTIONS.STAFF_BRANCH_ASSIGNED,
            entity: 'USER',
            entityId: user.id,
            metadata: JSON.stringify({
              branchId: targetBranchId,
              branchName: targetBranchName,
            }),
            ipAddress: req.ip,
          },
        }).catch(() => {});
      }

      return user;
    });

    // If username looks like an email, dispatch staff invitation
    if (sanitizedUsername.includes('@')) {
      const loginUrl = (process.env.PUBLIC_URL || req.headers.origin || 'https://www.tillora.net') + '/login';
      sendStaffInvitationEmail({
        email: sanitizedUsername,
        name: name.trim(),
        restaurantName: org?.name || 'Restaurant',
        role: roleUpper,
        branches: [targetBranchName],
        loginUrl,
        temporaryPassword: rawPin,
        mustChangePassword: requirePassChange,
      }).catch((err) => {
        console.warn(`[createPortalStaff] Staff invitation email dispatch notice:`, err.message);
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Staff account created successfully',
      data: createdStaff,
    });
  } catch (error: any) {
    console.error('[PortalController] createPortalStaff error:', error);
    if (error?.message && (error.message.includes('LIMIT_EXCEEDED') || error.message.includes('SUBSCRIPTION_RESTRICTED'))) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to create staff account' });
  }
}

export async function updatePortalStaff(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const currentUserId = req.tenant?.userId || 'unknown';
    const currentUserRole = (req.tenant?.role || '').toUpperCase();
    const authorizedBranches = req.tenant?.authorizedBranchIds || (req.tenant?.branchId ? [req.tenant.branchId] : []);
    const { userId } = req.params;
    const { name, role, phone, pin, active, branchId, branchIds, restrictions } = req.body;

    if (!organizationId || !userId) {
      return res.status(400).json({ error: 'User ID and organization context required' });
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found in this organization' });
    }

    // Role Hierarchy & Privilege Checks
    if (currentUserRole === 'MANAGER') {
      if (['OWNER', 'ADMIN', 'PLATFORM_ADMIN', 'EXECUTIVE_ADMIN'].includes(targetUser.role)) {
        return res.status(403).json({ error: 'Forbidden: Managers cannot edit administrative or owner accounts' });
      }
      if (role && ['OWNER', 'ADMIN', 'PLATFORM_ADMIN', 'EXECUTIVE_ADMIN'].includes(role.toString().toUpperCase())) {
        return res.status(403).json({ error: 'Forbidden: Managers cannot promote users to administrative or owner roles' });
      }
    }

    const dataToUpdate: any = {};
    let roleChanged = false;
    let branchChanged = false;
    let pinChanged = false;
    let statusChanged = false;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      dataToUpdate.name = name.trim();
    }

    if (role !== undefined) {
      const roleUpper = role.toString().toUpperCase();
      if (['PLATFORM_ADMIN', 'EXECUTIVE_ADMIN'].includes(roleUpper)) {
        return res.status(403).json({ error: 'Forbidden: Cannot assign Platform Admin role' });
      }
      const validRoles = ['CASHIER', 'MANAGER', 'OWNER', 'RIDER', 'KITCHEN', 'ADMIN', 'SERVER'];
      if (!validRoles.includes(roleUpper)) {
        return res.status(400).json({ error: `Invalid role: ${role}` });
      }
      if (roleUpper !== targetUser.role) {
        dataToUpdate.role = roleUpper;
        roleChanged = true;
      }
    }

    if (phone !== undefined) {
      dataToUpdate.phone = phone ? phone.trim() : null;
    }

    if (pin !== undefined) {
      if (typeof pin !== 'string' || !pin.trim()) {
        return res.status(400).json({ error: 'Password / PIN cannot be empty' });
      }
      dataToUpdate.pin = pin.trim().startsWith('$2') ? pin.trim() : await bcrypt.hash(pin.trim(), 10);
      pinChanged = true;
    }

    if (active !== undefined) {
      const newActive = Boolean(active);
      if (newActive !== targetUser.active) {
        dataToUpdate.active = newActive;
        statusChanged = true;
      }
    }

    let newBranchMatch: any = null;
    if (branchId !== undefined) {
      if (branchId) {
        newBranchMatch = await prisma.branch.findFirst({
          where: { id: String(branchId), organizationId },
        });
        if (!newBranchMatch) {
          return res.status(400).json({ error: 'Selected branch does not belong to this organization' });
        }
        if (currentUserRole === 'MANAGER' && !authorizedBranches.includes(newBranchMatch.id)) {
          return res.status(403).json({ error: 'Forbidden: Cannot assign user to a branch outside your management scope' });
        }
        dataToUpdate.branchId = newBranchMatch.id;
        if (newBranchMatch.id !== targetUser.branchId) {
          branchChanged = true;
        }
      } else {
        dataToUpdate.branchId = null;
        if (targetUser.branchId !== null) {
          branchChanged = true;
        }
      }
    }

    if (restrictions !== undefined) {
      dataToUpdate.restrictions = typeof restrictions === 'string' ? restrictions : JSON.stringify(restrictions || []);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        organizationId: true,
        branchId: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        active: true,
        restrictions: true,
        createdAt: true,
        updatedAt: true,
        branch: { select: { id: true, name: true } },
      },
    });

    // Synchronize UserBranchAssignments if branchId or branchIds provided
    if (branchId !== undefined || Array.isArray(branchIds)) {
      if (branchId && newBranchMatch) {
        await prisma.userBranchAssignment.upsert({
          where: {
            userId_branchId: {
              userId: targetUser.id,
              branchId: newBranchMatch.id,
            },
          },
          update: {},
          create: {
            organizationId,
            userId: targetUser.id,
            branchId: newBranchMatch.id,
          },
        }).catch(() => {});
      }

      if (Array.isArray(branchIds)) {
        for (const bId of branchIds) {
          if (bId) {
            const bMatch = await prisma.branch.findFirst({
              where: { id: String(bId), organizationId },
            });
            if (bMatch) {
              await prisma.userBranchAssignment.upsert({
                where: {
                  userId_branchId: {
                    userId: targetUser.id,
                    branchId: bMatch.id,
                  },
                },
                update: {},
                create: {
                  organizationId,
                  userId: targetUser.id,
                  branchId: bMatch.id,
                },
              }).catch(() => {});
            }
          }
        }
      }
    }

    // MANDATORY SECURITY SESSION REVOCATION:
    // If role changed, branch changed, credentials changed, or account disabled -> REVOKE ALL ACTIVE SESSIONS IMMEDIATELY
    if (roleChanged || branchChanged || pinChanged || (statusChanged && !updated.active)) {
      await revokeAllUserSessions(userId, organizationId);
    }

    // Detailed Audit Logging
    if (roleChanged) {
      await logAuditEvent({
        organizationId,
        userId: currentUserId,
        branchId: updated.branchId,
        action: AUDIT_ACTIONS.STAFF_ROLE_CHANGED,
        entity: 'USER',
        entityId: userId,
        metadata: {
          targetUser: updated.username,
          previousRole: targetUser.role,
          newRole: updated.role,
        },
        ipAddress: req.ip,
      }).catch(() => {});
    }

    if (branchChanged) {
      await logAuditEvent({
        organizationId,
        userId: currentUserId,
        branchId: updated.branchId,
        action: updated.branchId ? AUDIT_ACTIONS.STAFF_BRANCH_ASSIGNED : AUDIT_ACTIONS.STAFF_BRANCH_UNASSIGNED,
        entity: 'USER',
        entityId: userId,
        metadata: {
          targetUser: updated.username,
          previousBranchId: targetUser.branchId,
          newBranchId: updated.branchId,
        },
        ipAddress: req.ip,
      }).catch(() => {});
    }

    if (statusChanged) {
      await logAuditEvent({
        organizationId,
        userId: currentUserId,
        branchId: updated.branchId,
        action: updated.active ? AUDIT_ACTIONS.STAFF_REENABLED : AUDIT_ACTIONS.STAFF_DISABLED,
        entity: 'USER',
        entityId: userId,
        metadata: {
          targetUser: updated.username,
          active: updated.active,
        },
        ipAddress: req.ip,
      }).catch(() => {});
    }

    if (pinChanged) {
      await logAuditEvent({
        organizationId,
        userId: currentUserId,
        branchId: updated.branchId,
        action: AUDIT_ACTIONS.STAFF_CREDENTIAL_RESET,
        entity: 'USER',
        entityId: userId,
        metadata: {
          targetUser: updated.username,
          credentialReset: true,
        },
        ipAddress: req.ip,
      }).catch(() => {});

      await logAuditEvent({
        organizationId,
        userId: currentUserId,
        branchId: updated.branchId,
        action: AUDIT_ACTIONS.PASSWORD_SETUP_COMPLETED,
        entity: 'USER',
        entityId: userId,
        metadata: {
          targetUser: updated.username,
        },
        ipAddress: req.ip,
      }).catch(() => {});
    }

    await logAuditEvent({
      organizationId,
      userId: currentUserId,
      branchId: updated.branchId,
      action: AUDIT_ACTIONS.STAFF_UPDATED,
      entity: 'USER',
      entityId: userId,
      metadata: {
        targetUser: updated.username,
        role: updated.role,
        active: updated.active,
      },
      ipAddress: req.ip,
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Staff updated successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error('[PortalController] updatePortalStaff error:', error);
    return res.status(500).json({ error: 'Failed to update staff member' });
  }
}

export async function deletePortalStaff(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const currentUserId = req.tenant?.userId || 'unknown';
    const currentUserRole = (req.tenant?.role || '').toUpperCase();
    const { userId } = req.params;

    if (!organizationId || !userId) {
      return res.status(400).json({ error: 'User ID and organization context required' });
    }

    if (userId === currentUserId) {
      return res.status(400).json({ error: 'Cannot delete your own active owner account' });
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found in this organization' });
    }

    if (currentUserRole === 'MANAGER' && ['OWNER', 'ADMIN', 'PLATFORM_ADMIN', 'EXECUTIVE_ADMIN'].includes(targetUser.role)) {
      return res.status(403).json({ error: 'Forbidden: Managers cannot delete administrative or owner accounts' });
    }

    // Revoke sessions first
    await revokeAllUserSessions(userId, organizationId);

    // Deactivate user (soft delete)
    await prisma.user.update({
      where: { id: userId },
      data: { active: false },
    });

    await logAuditEvent({
      organizationId,
      userId: currentUserId,
      branchId: targetUser.branchId,
      action: AUDIT_ACTIONS.STAFF_DISABLED,
      entity: 'USER',
      entityId: userId,
      metadata: { targetUser: targetUser.username, role: targetUser.role },
      ipAddress: req.ip,
    }).catch(() => {});

    await logAuditEvent({
      organizationId,
      userId: currentUserId,
      branchId: targetUser.branchId,
      action: AUDIT_ACTIONS.STAFF_DEACTIVATED,
      entity: 'USER',
      entityId: userId,
      metadata: { targetUser: targetUser.username, role: targetUser.role },
      ipAddress: req.ip,
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Staff account deactivated successfully',
    });
  } catch (error: any) {
    console.error('[PortalController] deletePortalStaff error:', error);
    return res.status(500).json({ error: 'Failed to deactivate staff member' });
  }
}

/**
 * Update Restaurant Profile & Global Settings
 */
export async function updatePortalRestaurant(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { name, logoUrl, address, phone, settings } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required' });
    }

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const updateData: any = {};
    if (name && typeof name === 'string' && name.trim()) {
      updateData.name = name.trim();
    }
    if (logoUrl !== undefined) {
      updateData.logoUrl = logoUrl;
    }

    let existingSettings: Record<string, any> = {};
    try {
      if (org.settings) existingSettings = typeof org.settings === 'string' ? JSON.parse(org.settings) : org.settings;
    } catch (e) {}

    if (settings || address !== undefined || phone !== undefined) {
      const mergedSettings = {
        ...existingSettings,
        ...(settings || {}),
        ...(address !== undefined ? { address } : {}),
        ...(phone !== undefined ? { phone } : {}),
      };
      updateData.settings = JSON.stringify(mergedSettings);
    }

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: updateData,
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.ORGANIZATION_UPDATED,
      entity: 'ORGANIZATION',
      entityId: organizationId,
      metadata: { changes: updateData },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: 'Restaurant profile and settings updated successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error('[PortalController] updatePortalRestaurant error:', error);
    return res.status(500).json({ error: 'Failed to update restaurant settings' });
  }
}

/**
 * Menu & Category Management
 */
export async function getPortalMenu(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });

    const [categories, items] = await Promise.all([
      prisma.category.findMany({
        where: { organizationId },
        orderBy: { title: 'asc' },
      }),
      prisma.menuItem.findMany({
        where: { organizationId },
        include: { category: true },
        orderBy: { title: 'asc' },
      }),
    ]);

    return res.json({
      success: true,
      data: { categories, items },
    });
  } catch (error: any) {
    console.error('[PortalController] getPortalMenu error:', error);
    return res.status(500).json({ error: 'Failed to load menu data' });
  }
}

export async function createPortalCategory(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const { name, title, active } = req.body;
    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });
    const categoryTitle = (title || name || '').trim();
    if (!categoryTitle) return res.status(400).json({ error: 'Category title is required' });

    const slug = categoryTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const category = await prisma.category.create({
      data: {
        organizationId,
        title: categoryTitle,
        slug: `${slug}-${Date.now().toString().slice(-4)}`,
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    return res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    console.error('[PortalController] createPortalCategory error:', error);
    return res.status(500).json({ error: 'Failed to create category' });
  }
}

export async function updatePortalCategory(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const { id } = req.params;
    const { name, title, active } = req.body;
    if (!organizationId || !id) return res.status(400).json({ error: 'Category ID and org required' });

    const existing = await prisma.category.findFirst({ where: { id, organizationId } });
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    const newTitle = (title || name || '').trim();
    const updateData: any = {};
    if (newTitle) {
      updateData.title = newTitle;
      updateData.slug = `${newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;
    }
    if (active !== undefined) {
      updateData.active = Boolean(active);
    }

    const updated = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[PortalController] updatePortalCategory error:', error);
    return res.status(500).json({ error: 'Failed to update category' });
  }
}

export async function deletePortalCategory(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const { id } = req.params;
    if (!organizationId || !id) return res.status(400).json({ error: 'Category ID required' });

    const existing = await prisma.category.findFirst({ where: { id, organizationId } });
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    await prisma.category.delete({ where: { id } });
    return res.json({ success: true, message: 'Category removed' });
  } catch (error: any) {
    console.error('[PortalController] deletePortalCategory error:', error);
    return res.status(500).json({ error: 'Failed to delete category' });
  }
}

export async function createPortalMenuItem(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { categoryId, name, title, price, description, active, options, modifierGroups, imageUrl } = req.body;

    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });
    const itemTitle = (title || name || '').trim();
    if (!itemTitle) return res.status(400).json({ error: 'Item title is required' });
    if (price === undefined || isNaN(Number(price))) return res.status(400).json({ error: 'Valid price is required' });

    const optionsStr = typeof (options || modifierGroups) === 'string'
      ? (options || modifierGroups)
      : JSON.stringify(options || modifierGroups || []);

    const item = await prisma.menuItem.create({
      data: {
        organizationId,
        categoryId: categoryId || 'uncategorized',
        title: itemTitle,
        price: Number(price),
        imageUrl: imageUrl || '',
        description: description || '',
        active: active !== undefined ? Boolean(active) : true,
        options: optionsStr,
      },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.MENU_ITEM_CREATED,
      entity: 'MENU_ITEM',
      entityId: item.id,
      metadata: { itemName: item.title, price: item.price },
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    console.error('[PortalController] createPortalMenuItem error:', error);
    return res.status(500).json({ error: 'Failed to create menu item' });
  }
}

export async function updatePortalMenuItem(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { id } = req.params;
    const { categoryId, name, title, price, description, active, options, modifierGroups, imageUrl } = req.body;

    if (!organizationId || !id) return res.status(400).json({ error: 'Item ID and org required' });

    const existing = await prisma.menuItem.findFirst({ where: { id, organizationId } });
    if (!existing) return res.status(404).json({ error: 'Menu item not found' });

    const itemTitle = (title || name || '').trim();

    const updated = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(categoryId ? { categoryId } : {}),
        ...(itemTitle ? { title: itemTitle } : {}),
        ...(price !== undefined ? { price: Number(price) } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
        ...((options || modifierGroups) !== undefined
          ? {
              options: typeof (options || modifierGroups) === 'string'
                ? (options || modifierGroups)
                : JSON.stringify(options || modifierGroups),
            }
          : {}),
      },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.MENU_ITEM_UPDATED,
      entity: 'MENU_ITEM',
      entityId: id,
      metadata: { changes: req.body },
      ipAddress: req.ip,
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[PortalController] updatePortalMenuItem error:', error);
    return res.status(500).json({ error: 'Failed to update menu item' });
  }
}

export async function deletePortalMenuItem(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { id } = req.params;
    if (!organizationId || !id) return res.status(400).json({ error: 'Item ID required' });

    const existing = await prisma.menuItem.findFirst({ where: { id, organizationId } });
    if (!existing) return res.status(404).json({ error: 'Menu item not found' });

    // Archive / soft deactivate to preserve historical order references
    await prisma.menuItem.update({
      where: { id },
      data: { active: false },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.MENU_ITEM_ARCHIVED,
      entity: 'MENU_ITEM',
      entityId: id,
      metadata: { itemName: existing.title },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Menu item archived' });
  } catch (error: any) {
    console.error('[PortalController] deletePortalMenuItem error:', error);
    return res.status(500).json({ error: 'Failed to archive menu item' });
  }
}

/**
 * Tables & Floor Management
 */
export async function getPortalTables(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const { branchId } = req.query;
    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });

    const tables = await prisma.table.findMany({
      where: {
        organizationId,
        ...(branchId ? { branchId: String(branchId) } : {}),
      },
      orderBy: { number: 'asc' },
    });

    return res.json({ success: true, data: tables });
  } catch (error: any) {
    console.error('[PortalController] getPortalTables error:', error);
    return res.status(500).json({ error: 'Failed to load tables' });
  }
}

export async function createPortalTable(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { number, capacity, branchId, status } = req.body;

    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });
    if (!number || !String(number).trim()) return res.status(400).json({ error: 'Table number is required' });

    const table = await prisma.table.create({
      data: {
        organizationId,
        branchId: branchId || null,
        number: String(number).trim(),
        capacity: capacity ? Number(capacity) : 4,
        status: status || 'AVAILABLE',
        active: true,
      },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.TABLE_CREATED,
      entity: 'TABLE',
      entityId: table.id,
      metadata: { tableNumber: table.number },
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, data: table });
  } catch (error: any) {
    console.error('[PortalController] createPortalTable error:', error);
    return res.status(500).json({ error: 'Failed to create table' });
  }
}

export async function updatePortalTable(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { id } = req.params;
    const { number, capacity, status, active, branchId } = req.body;

    if (!organizationId || !id) return res.status(400).json({ error: 'Table ID required' });

    const existing = await prisma.table.findFirst({ where: { id, organizationId } });
    if (!existing) return res.status(404).json({ error: 'Table not found' });

    const updated = await prisma.table.update({
      where: { id },
      data: {
        ...(number !== undefined ? { number: String(number).trim() } : {}),
        ...(capacity !== undefined ? { capacity: Number(capacity) } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
      },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.TABLE_UPDATED,
      entity: 'TABLE',
      entityId: id,
      metadata: { changes: req.body },
      ipAddress: req.ip,
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[PortalController] updatePortalTable error:', error);
    return res.status(500).json({ error: 'Failed to update table' });
  }
}

export async function deletePortalTable(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { id } = req.params;
    if (!organizationId || !id) return res.status(400).json({ error: 'Table ID required' });

    const existing = await prisma.table.findFirst({ where: { id, organizationId } });
    if (!existing) return res.status(404).json({ error: 'Table not found' });

    await prisma.table.delete({ where: { id } });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.TABLE_DELETED,
      entity: 'TABLE',
      entityId: id,
      metadata: { tableNumber: existing.number },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Table removed' });
  } catch (error: any) {
    console.error('[PortalController] deletePortalTable error:', error);
    return res.status(500).json({ error: 'Failed to delete table' });
  }
}

/**
 * Kitchen Management
 */
export async function getPortalKitchen(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });

    const devices = await prisma.device.findMany({
      where: { organizationId, deviceType: { in: ['KDS', 'PRINTER'] } },
    });

    const activeOrders = await prisma.order.findMany({
      where: {
        organizationId,
        status: { in: ['PUNCHED', 'PREPARING', 'READY', 'IN_KITCHEN', 'pending'] },
      },
      include: { items: true, branch: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({
      success: true,
      data: { devices, activeOrders },
    });
  } catch (error: any) {
    console.error('[PortalController] getPortalKitchen error:', error);
    return res.status(500).json({ error: 'Failed to load kitchen dashboard' });
  }
}

/**
 * Inventory Management & Stock Adjustment (Database-Backed Production Engine)
 */

async function ensureDefaultVendorsAndIngredients(organizationId: string) {
  const vendorCount = await prisma.vendor.count({ where: { organizationId } });
  let vendors = [];
  if (vendorCount === 0) {
    vendors = await Promise.all([
      prisma.vendor.create({
        data: {
          organizationId,
          name: 'Fresh Produce Direct',
          contactName: 'Maria Garcia',
          phone: '+1 555-0192',
          email: 'maria@freshproduce.com',
          address: '100 Farmer Way',
          notes: 'Standard fresh vegetables and greens.',
        },
      }),
      prisma.vendor.create({
        data: {
          organizationId,
          name: 'Metro Beverage Distributors',
          contactName: 'John Smith',
          phone: '+1 555-0144',
          email: 'orders@metrobev.com',
          address: '45 Industrial Pkwy',
          notes: 'Coffee beans, syrup, milk, soft drinks.',
        },
      }),
    ]);
  } else {
    vendors = await prisma.vendor.findMany({ where: { organizationId } });
  }

  const ingredientCount = await prisma.ingredient.count({ where: { organizationId } });
  if (ingredientCount === 0) {
    const vProduce = vendors.find(v => v.name.includes('Produce')) || vendors[0];
    const vBeverage = vendors.find(v => v.name.includes('Beverage')) || vendors[1] || vendors[0];

    const branch = await prisma.branch.findFirst({ where: { organizationId } });
    const branchId = branch?.id || null;

    await Promise.all([
      prisma.ingredient.create({
        data: {
          organizationId,
          branchId,
          name: 'Flour (50kg)',
          code: 'ING-FLOUR',
          description: 'High-gluten wheat flour for pizza dough.',
          category: 'Dry Goods',
          baseUnit: 'g',
          purchaseUnit: 'kg',
          conversionRatio: 1000.0,
          costPerPurchaseUnit: 25.0,
          costPerBaseUnit: 25.0 / 1000.0,
          currentStock: 8 * 1000,
          minStock: 3 * 1000,
          preferredVendorId: vProduce?.id || null,
        },
      }),
      prisma.ingredient.create({
        data: {
          organizationId,
          branchId,
          name: 'Mozzarella Cheese',
          code: 'ING-MOZZ',
          description: 'Shredded low-moisture mozzarella cheese.',
          category: 'Dairy',
          baseUnit: 'g',
          purchaseUnit: 'kg',
          conversionRatio: 1000.0,
          costPerPurchaseUnit: 8.0,
          costPerBaseUnit: 8.0 / 1000.0,
          currentStock: 12 * 1000,
          minStock: 5 * 1000,
          preferredVendorId: vProduce?.id || null,
        },
      }),
      prisma.ingredient.create({
        data: {
          organizationId,
          branchId,
          name: 'Fresh Tomato Sauce',
          code: 'ING-SAUCE',
          description: 'Canned crushed tomatoes and herb sauce.',
          category: 'Produce',
          baseUnit: 'ml',
          purchaseUnit: 'L',
          conversionRatio: 1000.0,
          costPerPurchaseUnit: 4.0,
          costPerBaseUnit: 4.0 / 1000.0,
          currentStock: 2 * 1000,
          minStock: 4 * 1000,
          preferredVendorId: vProduce?.id || null,
        },
      }),
      prisma.ingredient.create({
        data: {
          organizationId,
          branchId,
          name: 'Espresso Beans',
          code: 'ING-COFFEE',
          description: 'Dark roast Arabica espresso beans.',
          category: 'Beverages',
          baseUnit: 'g',
          purchaseUnit: 'kg',
          conversionRatio: 1000.0,
          costPerPurchaseUnit: 18.0,
          costPerBaseUnit: 18.0 / 1000.0,
          currentStock: 15 * 1000,
          minStock: 3 * 1000,
          preferredVendorId: vBeverage?.id || null,
        },
      }),
    ]);
  }
}

export async function getPortalInventory(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });

    await ensureDefaultVendorsAndIngredients(organizationId);

    const items = await prisma.ingredient.findMany({
      where: { organizationId, archived: false },
      include: { preferredVendor: true },
      orderBy: { name: 'asc' },
    });

    const logs = await prisma.stockMovement.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { ingredient: { select: { name: true, baseUnit: true } } },
    });

    // Backwards compatibility mapper for standard frontend expects
    const compatItems = items.map(item => ({
      id: item.id,
      name: item.name,
      code: item.code,
      currentStock: item.currentStock,
      minStock: item.minStock,
      unit: item.baseUnit,
      purchaseUnit: item.purchaseUnit,
      conversionRatio: item.conversionRatio,
      costPerPurchaseUnit: item.costPerPurchaseUnit,
      costPerBaseUnit: item.costPerBaseUnit,
      category: item.category,
      preferredVendorId: item.preferredVendorId,
      preferredVendor: item.preferredVendor?.name || null,
    }));

    const compatLogs = logs.map(l => ({
      id: l.id,
      inventoryItemId: l.ingredientId,
      itemName: l.ingredient?.name || 'Unknown Item',
      quantityDelta: l.quantityDelta,
      previousStock: l.previousStock,
      newStock: l.newStock,
      type: l.movementType,
      reason: l.reason || `${l.movementType} movement`,
      userId: l.actorName || 'system',
      createdAt: l.createdAt.toISOString(),
    }));

    const lowStockAlerts = compatItems.filter(i => Number(i.currentStock) <= Number(i.minStock));

    return res.json({
      success: true,
      data: {
        items: compatItems,
        logs: compatLogs,
        lowStockCount: lowStockAlerts.length,
      },
    });
  } catch (error: any) {
    console.error('[PortalController] getPortalInventory error:', error);
    return res.status(500).json({ error: 'Failed to load inventory' });
  }
}

export async function adjustPortalInventory(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { inventoryItemId, ingredientId, quantityDelta, reason, movementType } = req.body;

    const targetId = ingredientId || inventoryItemId;

    if (!organizationId || !targetId) {
      return res.status(400).json({ error: 'Ingredient ID and tenant org context required' });
    }

    if (quantityDelta === undefined || isNaN(Number(quantityDelta)) || Number(quantityDelta) === 0) {
      return res.status(400).json({ error: 'Non-zero numerical quantityDelta is required' });
    }

    const ingredient = await prisma.ingredient.findFirst({
      where: { id: targetId, organizationId },
    });

    if (!ingredient) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    const delta = Number(quantityDelta);
    const prevStock = Number(ingredient.currentStock || 0);
    const newStock = Math.max(0, prevStock + delta);

    const mType = movementType || (delta >= 0 ? 'PURCHASE' : 'ADJUSTMENT');

    const [updated, movement] = await prisma.$transaction([
      prisma.ingredient.update({
        where: { id: targetId },
        data: { currentStock: newStock },
      }),
      prisma.stockMovement.create({
        data: {
          organizationId,
          branchId: ingredient.branchId,
          ingredientId: targetId,
          quantityDelta: delta,
          unit: ingredient.baseUnit,
          previousStock: prevStock,
          newStock,
          costBasis: ingredient.costPerBaseUnit,
          movementType: mType,
          referenceType: 'MANUAL',
          reason: reason || 'Manual adjustment from portal',
          actorId: userId,
          actorName: req.tenant?.name || 'Portal User',
        },
      }),
    ]);

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
      entity: 'INVENTORY_ITEM',
      entityId: targetId,
      metadata: {
        itemName: ingredient.name,
        previousStock: prevStock,
        newStock,
        delta,
        reason: reason || 'Manual adjustment',
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: 'Inventory adjusted successfully',
      data: {
        item: updated,
        log: {
          id: movement.id,
          inventoryItemId: targetId,
          itemName: ingredient.name,
          quantityDelta: delta,
          previousStock: prevStock,
          newStock,
          type: mType,
          reason: movement.reason,
          userId: movement.actorName,
          createdAt: movement.createdAt.toISOString(),
        },
      },
    });
  } catch (error: any) {
    console.error('[PortalController] adjustPortalInventory error:', error);
    return res.status(500).json({ error: 'Failed to adjust inventory' });
  }
}

/**
 * Orders Management
 */
export async function getPortalOrders(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const { branchId, status, paymentStatus, orderType, limit = 50, page = 1 } = req.query;
    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });

    const take = Math.min(Number(limit) || 50, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    const whereClause: any = {
      organizationId,
      ...(branchId ? { branchId: String(branchId) } : {}),
      ...(status ? { status: String(status) } : {}),
      ...(paymentStatus ? { paymentStatus: String(paymentStatus) } : {}),
      ...(orderType ? { orderType: String(orderType) } : {}),
    };

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          branch: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    return res.json({
      success: true,
      data: orders,
      meta: {
        total: totalCount,
        page: Number(page) || 1,
        limit: take,
        totalPages: Math.ceil(totalCount / take),
      },
    });
  } catch (error: any) {
    console.error('[PortalController] getPortalOrders error:', error);
    return res.status(500).json({ error: 'Failed to fetch portal orders' });
  }
}

/**
 * Shifts & Cash Reconciliation
 */
export async function getPortalShifts(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const { branchId } = req.query;
    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });

    const shifts = await prisma.registerShift.findMany({
      where: {
        organizationId,
        ...(branchId ? { branchId: String(branchId) } : {}),
      },
      take: 50,
      orderBy: { openedAt: 'desc' },
      include: {
        openedBy: { select: { id: true, name: true, role: true } },
        closedBy: { select: { id: true, name: true, role: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    return res.json({ success: true, data: shifts });
  } catch (error: any) {
    console.error('[PortalController] getPortalShifts error:', error);
    return res.status(500).json({ error: 'Failed to fetch shifts' });
  }
}

/**
 * Customers Directory
 */
export async function getPortalCustomers(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });

    const customers = await prisma.customer.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });

    return res.json({ success: true, data: customers });
  } catch (error: any) {
    console.error('[PortalController] getPortalCustomers error:', error);
    return res.status(500).json({ error: 'Failed to fetch customer directory' });
  }
}

/**
 * Vendors Management
 */
export async function getPortalVendors(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });

    await ensureDefaultVendorsAndIngredients(organizationId);

    const vendors = await prisma.vendor.findMany({
      where: { organizationId, active: true },
      orderBy: { name: 'asc' },
    });

    return res.json({ success: true, data: vendors });
  } catch (error: any) {
    console.error('[PortalController] getPortalVendors error:', error);
    return res.status(500).json({ error: 'Failed to fetch vendors' });
  }
}

export async function createPortalVendor(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { name, contactPerson, contactName, phone, email, address, notes } = req.body;

    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Vendor name is required' });

    const newVendor = await prisma.vendor.create({
      data: {
        organizationId,
        name: name.trim(),
        contactName: (contactName || contactPerson || '').trim() || null,
        phone: phone ? phone.trim() : null,
        email: email ? email.trim() : null,
        address: address ? address.trim() : null,
        notes: notes ? notes.trim() : null,
      },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.VENDOR_CREATED,
      entity: 'VENDOR',
      entityId: newVendor.id,
      metadata: { vendorName: newVendor.name },
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, data: newVendor });
  } catch (error: any) {
    console.error('[PortalController] createPortalVendor error:', error);
    return res.status(500).json({ error: 'Failed to create vendor' });
  }
}

export async function updatePortalVendor(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { id } = req.params;
    const { name, contactPerson, contactName, phone, email, address, notes, active } = req.body;

    if (!organizationId || !id) return res.status(400).json({ error: 'Vendor ID required' });

    const existing = await prisma.vendor.findFirst({
      where: { id, organizationId },
    });

    if (!existing) return res.status(404).json({ error: 'Vendor not found' });

    const updated = await prisma.vendor.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        contactName: contactName !== undefined ? contactName : contactPerson !== undefined ? contactPerson : undefined,
        ...(phone !== undefined ? { phone: phone ? phone.trim() : null } : {}),
        ...(email !== undefined ? { email: email ? email.trim() : null } : {}),
        ...(address !== undefined ? { address: address ? address.trim() : null } : {}),
        ...(notes !== undefined ? { notes: notes ? notes.trim() : null } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
      },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.VENDOR_UPDATED,
      entity: 'VENDOR',
      entityId: id,
      metadata: { changes: req.body },
      ipAddress: req.ip,
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[PortalController] updatePortalVendor error:', error);
    return res.status(500).json({ error: 'Failed to update vendor' });
  }
}

export async function deletePortalVendor(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const { id } = req.params;
    if (!organizationId || !id) return res.status(400).json({ error: 'Vendor ID required' });

    const existing = await prisma.vendor.findFirst({
      where: { id, organizationId },
    });

    if (!existing) return res.status(404).json({ error: 'Vendor not found' });

    await prisma.vendor.update({
      where: { id },
      data: { active: false },
    });

    return res.json({ success: true, message: 'Vendor archived' });
  } catch (error: any) {
    console.error('[PortalController] deletePortalVendor error:', error);
    return res.status(500).json({ error: 'Failed to archive vendor' });
  }
}

/**
 * Phase 21 Recipes & Bill of Materials (BOM) Management
 */
export async function getPortalRecipes(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });

    // Check if recipes are completely empty. If so, seed a default recipe for testing Margherita Pizza
    const count = await prisma.recipe.count({ where: { organizationId } });
    if (count === 0) {
      const menuItem = await prisma.menuItem.findFirst({ where: { organizationId } });
      const ingredients = await prisma.ingredient.findMany({ where: { organizationId } });

      if (menuItem && ingredients.length >= 2) {
        await prisma.recipe.create({
          data: {
            organizationId,
            menuItemId: menuItem.id,
            name: `${menuItem.title} Standard Recipe`,
            items: {
              create: [
                { ingredientId: ingredients[0].id, quantity: 200, unit: 'g' },
                { ingredientId: ingredients[1].id, quantity: 150, unit: 'g' },
              ],
            },
          },
        });
      }
    }

    const recipes = await prisma.recipe.findMany({
      where: { organizationId, archived: false },
      include: {
        menuItem: { select: { id: true, title: true, price: true } },
        variant: { select: { id: true, name: true, price: true } },
        modifierOption: { select: { id: true, name: true, price: true } },
        items: {
          include: {
            ingredient: { select: { id: true, name: true, costPerBaseUnit: true, baseUnit: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add server-side recipe costing calculations
    const computedRecipes = recipes.map(recipe => {
      let totalCost = 0;
      for (const item of recipe.items) {
        const ing = item.ingredient;
        if (!ing) continue;
        const conversion = convertUnit(item.quantity, item.unit, ing.baseUnit);
        if (conversion.success) {
          totalCost += conversion.quantity * (ing.costPerBaseUnit || 0);
        }
      }

      const sellingPrice = recipe.modifierOption
        ? Number(recipe.modifierOption.price || 0)
        : recipe.variant
          ? Number(recipe.variant.price || 0)
          : recipe.menuItem
            ? Number(recipe.menuItem.price || 0)
            : 0;

      const recipeCost = Number(totalCost.toFixed(2));
      const foodCostPercentage = sellingPrice > 0 ? Number(((recipeCost / sellingPrice) * 100).toFixed(2)) : 0;
      const grossMargin = Number((sellingPrice - recipeCost).toFixed(2));

      return {
        ...recipe,
        recipeCost,
        foodCostPercentage,
        grossMargin,
      };
    });

    return res.json({ success: true, data: computedRecipes });
  } catch (error: any) {
    console.error('[PortalController] getPortalRecipes error:', error);
    return res.status(500).json({ error: 'Failed to load recipes' });
  }
}

export async function createPortalRecipe(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const { name, menuItemId, variantId, modifierOptionId, items, notes } = req.body;

    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Recipe name is required' });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Recipe must contain at least one ingredient' });
    }

    // 1. COLLECT AND DEDUPLICATE SUBMITTED INGREDIENT IDs
    const ingredientIds = [...new Set(items.map((item: any) => item.ingredientId))];

    // 2. LOAD ALL REFERENCED INGREDIENTS IN ONE QUERY & ENSURE THEY BELONG TO THIS TENANT
    const dbIngredients = await prisma.ingredient.findMany({
      where: {
        id: { in: ingredientIds },
        organizationId,
        archived: false,
      },
    });

    if (dbIngredients.length !== ingredientIds.length) {
      return res.status(403).json({
        error: 'One or more ingredient references are invalid, archived, or belong to a different tenant.',
      });
    }

    // 3. SECURE RECIPIENTS (MENU ITEM, VARIANT, MODIFIER) IDOR VALIDATION
    if (menuItemId) {
      const dbMenuItem = await prisma.menuItem.findFirst({
        where: { id: menuItemId, organizationId },
      });
      if (!dbMenuItem) {
        return res.status(403).json({ error: 'Invalid Menu Item ownership' });
      }
    }
    if (variantId) {
      const dbVariant = await prisma.menuItemVariant.findFirst({
        where: { id: variantId, menuItem: { organizationId } },
      });
      if (!dbVariant) {
        return res.status(403).json({ error: 'Invalid Variant ownership' });
      }
    }
    if (modifierOptionId) {
      const dbModOption = await prisma.modifierOption.findFirst({
        where: { id: modifierOptionId, modifierGroup: { organizationId } },
      });
      if (!dbModOption) {
        return res.status(403).json({ error: 'Invalid Modifier Option ownership' });
      }
    }

    const branch = await prisma.branch.findFirst({ where: { organizationId } });

    // 4. IMPLEMENT RECIPE VERSIONING & PREVIOUS RECIPE RETIREMENT (IMMUTABLE PATTERN)
    let nextVersion = 1;
    const existingRecipe = await prisma.recipe.findFirst({
      where: {
        organizationId,
        menuItemId: menuItemId || null,
        variantId: variantId || null,
        modifierOptionId: modifierOptionId || null,
        active: true,
        archived: false,
      },
    });

    if (existingRecipe) {
      nextVersion = (existingRecipe.version || 1) + 1;
      // Soft-archive / deactivate the older recipe version
      await prisma.recipe.update({
        where: { id: existingRecipe.id },
        data: { active: false, archived: true },
      });
    }

    const recipe = await prisma.recipe.create({
      data: {
        organizationId,
        branchId: branch?.id || null,
        name: name.trim(),
        menuItemId: menuItemId || null,
        variantId: variantId || null,
        modifierOptionId: modifierOptionId || null,
        version: nextVersion,
        notes: notes || null,
        items: {
          create: items.map((item: any) => ({
            ingredientId: item.ingredientId,
            quantity: Number(item.quantity),
            unit: item.unit,
          })),
        },
      },
      include: {
        menuItem: { select: { id: true, title: true, price: true } },
        variant: { select: { id: true, name: true, price: true } },
        modifierOption: { select: { id: true, name: true, price: true } },
        items: {
          include: {
            ingredient: { select: { id: true, name: true, costPerBaseUnit: true, baseUnit: true } },
          },
        },
      },
    });

    // 5. SERVER-SIDE COSTING CALCULATION FOR CREATED RECIPE
    let totalCost = 0;
    for (const item of recipe.items) {
      const ing = item.ingredient;
      if (!ing) continue;
      const conversion = convertUnit(item.quantity, item.unit, ing.baseUnit);
      if (conversion.success) {
        totalCost += conversion.quantity * (ing.costPerBaseUnit || 0);
      }
    }

    const sellingPrice = recipe.modifierOption
      ? Number(recipe.modifierOption.price || 0)
      : recipe.variant
        ? Number(recipe.variant.price || 0)
        : recipe.menuItem
          ? Number(recipe.menuItem.price || 0)
          : 0;

    const recipeCost = Number(totalCost.toFixed(2));
    const foodCostPercentage = sellingPrice > 0 ? Number(((recipeCost / sellingPrice) * 100).toFixed(2)) : 0;
    const grossMargin = Number((sellingPrice - recipeCost).toFixed(2));

    const computedRecipe = {
      ...recipe,
      recipeCost,
      foodCostPercentage,
      grossMargin,
    };

    return res.status(201).json({ success: true, data: computedRecipe });
  } catch (error: any) {
    console.error('[PortalController] createPortalRecipe error:', error);
    return res.status(500).json({ error: 'Failed to create recipe' });
  }
}

export async function deletePortalRecipe(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const { id } = req.params;

    if (!organizationId || !id) return res.status(400).json({ error: 'Recipe ID and tenant context required' });

    const recipe = await prisma.recipe.findFirst({ where: { id, organizationId } });
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    // Non-destructive archiving of recipe to keep historical sales context safe
    await prisma.recipe.update({
      where: { id },
      data: { active: false, archived: true },
    });

    return res.json({ success: true, message: 'Recipe removed successfully' });
  } catch (error: any) {
    console.error('[PortalController] deletePortalRecipe error:', error);
    return res.status(500).json({ error: 'Failed to delete recipe' });
  }
}

/**
 * Ingredients / Inventory Items CRUD Endpoints
 */
export async function createPortalIngredient(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });

    const {
      name,
      code,
      description,
      category,
      baseUnit,
      purchaseUnit,
      conversionRatio,
      costPerPurchaseUnit,
      minStock,
      preferredVendorId,
      currentStock,
    } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Ingredient name is required' });
    if (!baseUnit) return res.status(400).json({ error: 'Base unit is required' });

    // Check duplicate code (SKU) within tenant organization scope
    if (code && code.trim()) {
      const dupe = await prisma.ingredient.findFirst({
        where: { organizationId, code: code.trim(), archived: false },
      });
      if (dupe) {
        return res.status(400).json({ error: 'An ingredient with this SKU / Code already exists.' });
      }
    }

    const branch = await prisma.branch.findFirst({ where: { organizationId } });
    const ratio = Number(conversionRatio) || 1.0;
    const purchaseCost = Number(costPerPurchaseUnit) || 0;
    const costPerBaseUnit = purchaseCost / ratio;

    const ingredient = await prisma.ingredient.create({
      data: {
        organizationId,
        branchId: branch?.id || null,
        name: name.trim(),
        code: code?.trim() || null,
        description: description || null,
        category: category || 'General',
        baseUnit: canonicalUnit(baseUnit),
        purchaseUnit: purchaseUnit || baseUnit,
        conversionRatio: ratio,
        costPerPurchaseUnit: purchaseCost,
        costPerBaseUnit,
        minStock: Number(minStock) || 0,
        preferredVendorId: preferredVendorId || null,
        currentStock: Number(currentStock) || 0,
        active: true,
        archived: false,
      },
    });

    // OPENING STOCK LEDGER RECORD
    if (Number(currentStock) > 0) {
      await prisma.stockMovement.create({
        data: {
          organizationId,
          branchId: branch?.id || null,
          ingredientId: ingredient.id,
          quantityDelta: Number(currentStock),
          unit: canonicalUnit(baseUnit),
          previousStock: 0,
          newStock: Number(currentStock),
          costBasis: costPerBaseUnit,
          movementType: 'OPENING_STOCK',
          referenceType: 'MANUAL',
          reason: 'Initial opening stock setup',
          actorId: userId,
          actorName: req.tenant?.name || 'Portal User',
        },
      });

      await logAuditEvent({
        organizationId,
        userId,
        action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
        entity: 'INVENTORY_ITEM',
        entityId: ingredient.id,
        metadata: {
          itemName: ingredient.name,
          previousStock: 0,
          newStock: Number(currentStock),
          delta: Number(currentStock),
          reason: 'Initial opening stock setup',
        },
        ipAddress: req.ip,
      });
    }

    return res.status(201).json({ success: true, data: ingredient });
  } catch (error: any) {
    console.error('[PortalController] createPortalIngredient error:', error);
    return res.status(500).json({ error: 'Failed to create ingredient' });
  }
}

export async function updatePortalIngredient(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { id } = req.params;

    if (!organizationId || !id) return res.status(400).json({ error: 'Tenant context and Ingredient ID required' });

    const ingredient = await prisma.ingredient.findFirst({
      where: { id, organizationId, archived: false },
    });

    if (!ingredient) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    const {
      name,
      code,
      description,
      category,
      baseUnit,
      purchaseUnit,
      conversionRatio,
      costPerPurchaseUnit,
      minStock,
      preferredVendorId,
      active,
    } = req.body;

    // Check duplicate code (SKU)
    if (code && code.trim() && code.trim() !== ingredient.code) {
      const dupe = await prisma.ingredient.findFirst({
        where: { organizationId, code: code.trim(), archived: false, NOT: { id } },
      });
      if (dupe) {
        return res.status(400).json({ error: 'An ingredient with this SKU / Code already exists.' });
      }
    }

    const ratio = conversionRatio !== undefined ? Number(conversionRatio) : ingredient.conversionRatio;
    const purchaseCost = costPerPurchaseUnit !== undefined ? Number(costPerPurchaseUnit) : ingredient.costPerPurchaseUnit;
    const costPerBaseUnit = purchaseCost / ratio;

    const updated = await prisma.ingredient.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : ingredient.name,
        code: code !== undefined ? (code?.trim() || null) : ingredient.code,
        description: description !== undefined ? description : ingredient.description,
        category: category !== undefined ? category : ingredient.category,
        baseUnit: baseUnit !== undefined ? canonicalUnit(baseUnit) : ingredient.baseUnit,
        purchaseUnit: purchaseUnit !== undefined ? purchaseUnit : ingredient.purchaseUnit,
        conversionRatio: ratio,
        costPerPurchaseUnit: purchaseCost,
        costPerBaseUnit,
        minStock: minStock !== undefined ? Number(minStock) : ingredient.minStock,
        preferredVendorId: preferredVendorId !== undefined ? preferredVendorId : ingredient.preferredVendorId,
        active: active !== undefined ? Boolean(active) : ingredient.active,
      },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: 'INGREDIENT_UPDATED',
      entity: 'INVENTORY_ITEM',
      entityId: id,
      metadata: {
        itemName: updated.name,
      },
      ipAddress: req.ip,
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[PortalController] updatePortalIngredient error:', error);
    return res.status(500).json({ error: 'Failed to update ingredient' });
  }
}

export async function archivePortalIngredient(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const { id } = req.params;

    if (!organizationId || !id) return res.status(400).json({ error: 'Tenant context and Ingredient ID required' });

    const ingredient = await prisma.ingredient.findFirst({
      where: { id, organizationId, archived: false },
    });

    if (!ingredient) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    // Safely soft archive ingredient without physical delete to maintain historical records integrity
    const updated = await prisma.ingredient.update({
      where: { id },
      data: { active: false, archived: true },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: 'INGREDIENT_ARCHIVED',
      entity: 'INVENTORY_ITEM',
      entityId: id,
      metadata: {
        itemName: ingredient.name,
      },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Ingredient archived successfully' });
  } catch (error: any) {
    console.error('[PortalController] archivePortalIngredient error:', error);
    return res.status(500).json({ error: 'Failed to archive ingredient' });
  }
}

/**
 * Phase 21 Food Waste & Spoilage Logging
 */
export async function getPortalWaste(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const branchId = req.tenant?.branchId;
    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });

    const whereClause: any = { organizationId };
    if (branchId) {
      whereClause.branchId = branchId;
    }

    const wasteLogs = await prisma.wasteLog.findMany({
      where: whereClause,
      include: {
        ingredient: { select: { name: true, baseUnit: true, costPerBaseUnit: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: wasteLogs });
  } catch (error: any) {
    console.error('[PortalController] getPortalWaste error:', error);
    return res.status(500).json({ error: 'Failed to load waste logs' });
  }
}

export async function createPortalWaste(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const userName = req.tenant?.name || 'Portal User';
    const { ingredientId, quantity, unit, reason } = req.body;

    if (!organizationId || !ingredientId || !quantity) {
      return res.status(400).json({ error: 'Ingredient ID and quantity are required' });
    }

    const whereClause: any = { id: ingredientId, organizationId };
    if (req.tenant?.branchId) {
      whereClause.branchId = req.tenant.branchId;
    }

    const ingredient = await prisma.ingredient.findFirst({
      where: whereClause,
    });

    if (!ingredient) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    const qty = Number(quantity);
    const prevStock = Number(ingredient.currentStock || 0);
    const newStock = Math.max(0, prevStock - qty);
    const totalCost = qty * ingredient.costPerBaseUnit;

    const [updated, wasteLog] = await prisma.$transaction([
      prisma.ingredient.update({
        where: { id: ingredientId },
        data: { currentStock: newStock },
      }),
      prisma.wasteLog.create({
        data: {
          organizationId,
          branchId: ingredient.branchId,
          ingredientId,
          quantity: qty,
          unit: unit || ingredient.baseUnit,
          reason: reason || 'SPOILED',
          totalCost,
          reportedById: userId,
          reportedByName: userName,
        },
      }),
      prisma.stockMovement.create({
        data: {
          organizationId,
          branchId: ingredient.branchId,
          ingredientId,
          quantityDelta: -qty,
          unit: unit || ingredient.baseUnit,
          previousStock: prevStock,
          newStock,
          costBasis: ingredient.costPerBaseUnit,
          movementType: 'WASTE',
          referenceType: 'WASTE_LOG',
          reason: reason || 'Logged food waste',
          actorId: userId,
          actorName: userName,
        },
      }),
    ]);

    return res.status(201).json({ success: true, data: wasteLog });
  } catch (error: any) {
    console.error('[PortalController] createPortalWaste error:', error);
    return res.status(500).json({ error: 'Failed to log food waste' });
  }
}

/**
 * Phase 21 Multi-Branch Stock Transfers
 */
export async function getPortalTransfers(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });

    const transfers = await prisma.stockTransfer.findMany({
      where: { organizationId },
      include: {
        items: {
          include: {
            ingredient: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: transfers });
  } catch (error: any) {
    console.error('[PortalController] getPortalTransfers error:', error);
    return res.status(500).json({ error: 'Failed to load stock transfers' });
  }
}

export async function createPortalTransfer(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const userName = req.tenant?.name || 'Portal User';
    const { sourceBranchId, targetBranchId, items, notes } = req.body;

    if (!organizationId || !sourceBranchId || !targetBranchId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Source/Target branches and transfer items are required' });
    }

    const transferNumber = `TRF-${Date.now()}`;

    // Perform database transactions to deduct from source and add to target
    const result = await prisma.$transaction(async (tx) => {
      const dbTransfer = await tx.stockTransfer.create({
        data: {
          organizationId,
          sourceBranchId,
          targetBranchId,
          transferNumber,
          notes: notes || '',
          status: 'COMPLETED',
          createdById: userId,
          createdByName: userName,
          items: {
            create: items.map((item: any) => ({
              ingredientId: item.ingredientId,
              quantity: Number(item.quantity),
              unit: item.unit,
              cost: Number(item.cost || 0),
            })),
          },
        },
        include: { items: true },
      });

      for (const item of items) {
        const ing = await tx.ingredient.findFirst({
          where: { id: item.ingredientId, organizationId },
        });

        if (ing) {
          const qty = Number(item.quantity);
          const prevStock = Number(ing.currentStock || 0);
          const newStock = Math.max(0, prevStock - qty); // deduct from source branch perspective

          await tx.ingredient.update({
            where: { id: item.ingredientId },
            data: { currentStock: newStock },
          });

          await tx.stockMovement.create({
            data: {
              organizationId,
              branchId: sourceBranchId,
              ingredientId: item.ingredientId,
              quantityDelta: -qty,
              unit: item.unit || ing.baseUnit,
              previousStock: prevStock,
              newStock,
              costBasis: ing.costPerBaseUnit,
              movementType: 'TRANSFER_OUT',
              referenceType: 'TRANSFER',
              referenceId: dbTransfer.id,
              reason: `Inter-branch Transfer Out to ${targetBranchId}`,
              actorId: userId,
              actorName: userName,
            },
          });

          // Log transfer in movement
          await tx.stockMovement.create({
            data: {
              organizationId,
              branchId: targetBranchId,
              ingredientId: item.ingredientId,
              quantityDelta: qty,
              unit: item.unit || ing.baseUnit,
              previousStock: prevStock - qty,
              newStock: prevStock, // keeping total organizational balance correct or localized
              costBasis: ing.costPerBaseUnit,
              movementType: 'TRANSFER_IN',
              referenceType: 'TRANSFER',
              referenceId: dbTransfer.id,
              reason: `Inter-branch Transfer In from ${sourceBranchId}`,
              actorId: userId,
              actorName: userName,
            },
          });
        }
      }

      return dbTransfer;
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    console.error('[PortalController] createPortalTransfer error:', error);
    return res.status(500).json({ error: 'Failed to execute stock transfer' });
  }
}

/**
 * Phase 21 Physical Stock Reconciliation Sessions
 */
export async function getPortalCounts(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });

    const counts = await prisma.stockCountSession.findMany({
      where: { organizationId },
      include: {
        items: {
          include: {
            ingredient: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: counts });
  } catch (error: any) {
    console.error('[PortalController] getPortalCounts error:', error);
    return res.status(500).json({ error: 'Failed to load stock count sessions' });
  }
}

export async function createPortalCount(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.tenant?.userId || 'unknown';
    const userName = req.tenant?.name || 'Portal User';
    const { items, notes, branchId } = req.body;

    if (!organizationId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required for physical count session' });
    }

    const sessionNumber = `CNT-${Date.now()}`;

    const session = await prisma.$transaction(async (tx) => {
      const dbSession = await tx.stockCountSession.create({
        data: {
          organizationId,
          branchId: branchId || null,
          sessionNumber,
          status: 'COMPLETED',
          notes: notes || '',
          conductedById: userId,
          conductedByName: userName,
        },
      });

      for (const item of items) {
        const ing = await tx.ingredient.findFirst({
          where: { id: item.ingredientId, organizationId },
        });

        if (ing) {
          const physicalVal = Number(item.physicalQuantity);
          const theoreticalVal = Number(ing.currentStock);
          const variance = physicalVal - theoreticalVal;
          const varianceCost = variance * ing.costPerBaseUnit;

          await tx.stockCountItem.create({
            data: {
              sessionId: dbSession.id,
              ingredientId: item.ingredientId,
              theoreticalQuantity: theoreticalVal,
              physicalQuantity: physicalVal,
              varianceQuantity: variance,
              unit: ing.baseUnit,
              unitCost: ing.costPerBaseUnit,
              varianceCost,
            },
          });

          // Adjust the actual inventory stock to match the physical count
          await tx.ingredient.update({
            where: { id: item.ingredientId },
            data: { currentStock: physicalVal },
          });

          // Record stock movement representing the correction adjustment
          await tx.stockMovement.create({
            data: {
              organizationId,
              branchId: branchId || ing.branchId,
              ingredientId: item.ingredientId,
              quantityDelta: variance,
              unit: ing.baseUnit,
              previousStock: theoreticalVal,
              newStock: physicalVal,
              costBasis: ing.costPerBaseUnit,
              movementType: 'STOCK_COUNT',
              referenceType: 'COUNT_SESSION',
              referenceId: dbSession.id,
              reason: `Physical stock count correction: ${notes || 'reconciliation'}`,
              actorId: userId,
              actorName: userName,
            },
          });
        }
      }

      return tx.stockCountSession.findUnique({
        where: { id: dbSession.id },
        include: {
          items: {
            include: { ingredient: { select: { name: true } } },
          },
        },
      });
    });

    return res.status(201).json({ success: true, data: session });
  } catch (error: any) {
    console.error('[PortalController] createPortalCount error:', error);
    return res.status(500).json({ error: 'Failed to create physical stock count session' });
  }
}

/**
 * Reports & Business Analytics
 */
export async function getPortalReports(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const { branchId, startDate, endDate } = req.query;

    if (!organizationId) return res.status(400).json({ error: 'Tenant organization context required' });

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(String(startDate));
    if (endDate) dateFilter.lte = new Date(String(endDate));

    const whereOrder: any = {
      organizationId,
      isTraining: false,
      ...(branchId ? { branchId: String(branchId) } : {}),
      ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
    };

    const orders = await prisma.order.findMany({
      where: whereOrder,
      include: { items: true, branch: { select: { id: true, name: true } } },
    });

    const totalOrders = orders.length;
    const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID');

    let totalSales = 0;
    let netSales = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    const paymentMix: Record<string, { count: number; total: number }> = {};
    const itemSales: Record<string, { name: string; total: number; quantity: number }> = {};

    paidOrders.forEach((o) => {
      const orderTotal = Number(o.total || 0);
      const orderSubtotal = Number(o.subtotal || 0);
      const orderTax = Number(o.tax || 0);
      const orderDiscount = Number(o.discount || 0);

      totalSales += orderTotal;
      netSales += orderSubtotal;
      totalTax += orderTax;
      totalDiscount += orderDiscount;

      const method = o.paymentMethod || 'CASH';
      if (!paymentMix[method]) paymentMix[method] = { count: 0, total: 0 };
      paymentMix[method].count += 1;
      paymentMix[method].total += orderTotal;

      (o.items || []).forEach((item) => {
        const itemTotal = Number(item.price || 0) * Number(item.quantity || 1);
        const itemName = item.name || 'Unknown Item';
        if (!itemSales[itemName]) itemSales[itemName] = { name: itemName, total: 0, quantity: 0 };
        itemSales[itemName].total += itemTotal;
        itemSales[itemName].quantity += Number(item.quantity || 1);
      });
    });

    const topItems = Object.values(itemSales)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const averageOrderValue = paidOrders.length > 0 ? totalSales / paidOrders.length : 0;

    return res.json({
      success: true,
      data: {
        totalOrders,
        paidOrdersCount: paidOrders.length,
        totalSales,
        netSales,
        totalTax,
        totalDiscount,
        averageOrderValue,
        paymentMix,
        topItems,
      },
    });
  } catch (error: any) {
    console.error('[PortalController] getPortalReports error:', error);
    return res.status(500).json({ error: 'Failed to generate portal reports' });
  }
}

