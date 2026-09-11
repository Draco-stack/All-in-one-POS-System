import { Request, Response } from 'express';
import prisma from '../prisma';
import { logAuditEvent, AUDIT_ACTIONS } from '../auth/auditService';
import { revokeAllUserSessions } from '../auth/sessionService';
import { runSubscriptionReminderScheduler } from '../billing/reminderService';

// ============================================================================
// 1. GET PLATFORM OVERVIEW METRICS
// ============================================================================
export async function getPlatformOverview(req: Request, res: Response): Promise<Response> {
  try {
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    const [
      totalOrganizations,
      activeOrganizations,
      trialOrganizations,
      suspendedOrganizations,
      totalBranches,
      totalUsers,
      totalOrders,
      orderAggregates,
      subscriptionsByPlan,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: 'ACTIVE' } }),
      prisma.organization.count({ where: { status: 'TRIAL' } }),
      prisma.organization.count({ where: { status: 'SUSPENDED' } }),
      prisma.branch.count({ where: { active: true } }),
      prisma.user.count({ where: { active: true } }),
      prisma.order.count(),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: { in: ['COMPLETED', 'PAID'] } },
      }),
      prisma.subscription.groupBy({
        by: ['plan', 'status'],
        _count: { _all: true },
      }),
      prisma.auditLog.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const systemInfo = {
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      environment: process.env.NODE_ENV || 'development',
      serverTimestamp: new Date().toISOString(),
    };

    return res.json({
      success: true,
      data: {
        tenants: {
          total: totalOrganizations,
          active: activeOrganizations,
          trial: trialOrganizations,
          suspended: suspendedOrganizations,
        },
        infrastructure: {
          totalBranches,
          totalUsers,
          totalOrders,
          totalProcessedVolume: orderAggregates._sum.totalAmount || 0,
        },
        subscriptions: subscriptionsByPlan,
        system: systemInfo,
        recentActivity: recentAuditLogs,
      },
    });
  } catch (error) {
    console.error('[PlatformAdmin] getPlatformOverview error:', error);
    return res.status(500).json({ error: 'Failed to retrieve platform overview metrics' });
  }
}

// ============================================================================
// 2. LIST ALL ORGANIZATIONS (TENANTS)
// ============================================================================
export async function getOrganizations(req: Request, res: Response): Promise<Response> {
  try {
    const { search, status, limit = '50', page = '1' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * take;

    const whereClause: any = {};

    if (status && typeof status === 'string' && status !== 'ALL') {
      whereClause.status = status.toUpperCase();
    }

    if (search && typeof search === 'string' && search.trim()) {
      whereClause.OR = [
        { name: { contains: search.trim() } },
        { slug: { contains: search.trim() } },
      ];
    }

    const [total, organizations] = await Promise.all([
      prisma.organization.count({ where: whereClause }),
      prisma.organization.findMany({
        where: whereClause,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          branches: { select: { id: true, name: true, active: true } },
          users: { select: { id: true, name: true, username: true, role: true, active: true } },
          subscriptions: { select: { id: true, plan: true, status: true, startDate: true, endDate: true } },
          _count: {
            select: {
              orders: true,
              customers: true,
              menuItems: true,
              devices: true,
            },
          },
        },
      }),
    ]);

    const formatted = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      branchCount: org.branches.length,
      userCount: org.users.length,
      orderCount: org._count.orders,
      customerCount: org._count.customers,
      menuItemCount: org._count.menuItems,
      deviceCount: org._count.devices,
      subscription: org.subscriptions[0] || { plan: 'STARTER', status: 'INACTIVE' },
      owner: org.users.find((u) => u.role.toUpperCase() === 'OWNER') || org.users[0] || null,
    }));

    return res.json({
      success: true,
      data: formatted,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('[PlatformAdmin] getOrganizations error:', error);
    return res.status(500).json({ error: 'Failed to retrieve organizations' });
  }
}

// ============================================================================
// 3. GET SINGLE ORGANIZATION DRILLDOWN
// ============================================================================
export async function getOrganizationDetail(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        branches: {
          orderBy: { createdAt: 'asc' },
        },
        users: {
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
        },
        subscriptions: true,
        devices: {
          select: {
            id: true,
            deviceIdentifier: true,
            name: true,
            deviceType: true,
            status: true,
            lastSeenAt: true,
          },
        },
        _count: {
          select: {
            orders: true,
            customers: true,
            menuItems: true,
            categories: true,
            tables: true,
          },
        },
      },
    });

    if (!org) {
      return res.status(404).json({ error: `Organization with ID '${id}' not found` });
    }

    // Aggregate revenue metrics for this tenant
    const financialStats = await prisma.order.aggregate({
      where: {
        organizationId: org.id,
        status: { in: ['COMPLETED', 'PAID'] },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    });

    return res.json({
      success: true,
      data: {
        ...org,
        subscription: org.subscriptions[0] || null,
        stats: {
          totalRevenue: financialStats._sum.totalAmount || 0,
          completedOrders: financialStats._count._all || 0,
        },
      },
    });
  } catch (error) {
    console.error('[PlatformAdmin] getOrganizationDetail error:', error);
    return res.status(500).json({ error: 'Failed to retrieve organization detail' });
  }
}

// ============================================================================
// 4. UPDATE ORGANIZATION STATUS (ACTIVE, SUSPENDED, TRIAL, CANCELLED)
// ============================================================================
export async function updateOrganizationStatus(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    const validStatuses = ['ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED'];
    const normalizedStatus = (status || '').toUpperCase();

    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        error: `Invalid organization status. Allowed values: ${validStatuses.join(', ')}`,
      });
    }

    const org = await prisma.organization.findUnique({
      where: { id },
      include: { users: { select: { id: true } } },
    });

    if (!org) {
      return res.status(404).json({ error: `Organization '${id}' not found` });
    }

    const oldStatus = org.status;

    const updatedOrg = await prisma.organization.update({
      where: { id },
      data: { status: normalizedStatus },
    });

    // If tenant is SUSPENDED or CANCELLED, revoke all active sessions for its users immediately
    if (['SUSPENDED', 'CANCELLED'].includes(normalizedStatus)) {
      for (const u of org.users) {
        revokeAllUserSessions(u.id, org.id).catch(() => {});
      }
    }

    // Log high-priority platform security audit event
    await logAuditEvent({
      organizationId: org.id,
      userId: adminId,
      action: 'ORGANIZATION_STATUS_CHANGED',
      entity: 'ORGANIZATION',
      entityId: org.id,
      metadata: {
        oldStatus,
        newStatus: normalizedStatus,
        reason: reason || 'Administrative status change by platform executive',
        changedByAdminId: adminId,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Organization status changed from ${oldStatus} to ${normalizedStatus}`,
      data: updatedOrg,
    });
  } catch (error) {
    console.error('[PlatformAdmin] updateOrganizationStatus error:', error);
    return res.status(500).json({ error: 'Failed to update organization status' });
  }
}

// ============================================================================
// 5. LIST PLATFORM USERS ACROSS ALL TENANTS
// ============================================================================
export async function getPlatformUsers(req: Request, res: Response): Promise<Response> {
  try {
    const { search, role, status, organizationId, limit = '50', page = '1' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * take;

    const whereClause: any = {};

    if (role && typeof role === 'string' && role !== 'ALL') {
      whereClause.role = role.toUpperCase();
    }

    if (status === 'active') {
      whereClause.active = true;
    } else if (status === 'inactive') {
      whereClause.active = false;
    }

    if (organizationId && typeof organizationId === 'string') {
      whereClause.organizationId = organizationId;
    }

    if (search && typeof search === 'string' && search.trim()) {
      whereClause.OR = [
        { name: { contains: search.trim() } },
        { username: { contains: search.trim() } },
        { phone: { contains: search.trim() } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          phone: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          organization: { select: { id: true, name: true, slug: true, status: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('[PlatformAdmin] getPlatformUsers error:', error);
    return res.status(500).json({ error: 'Failed to retrieve platform users' });
  }
}

// ============================================================================
// 6. TOGGLE USER STATUS ACROSS PLATFORM
// ============================================================================
export async function updatePlatformUserStatus(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { active, reason } = req.body;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'Field "active" must be a boolean.' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: { organization: true },
    });

    if (!user) {
      return res.status(404).json({ error: `User '${id}' not found` });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { active },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        active: true,
        organizationId: true,
      },
    });

    // If deactivated, revoke all sessions
    if (!active) {
      revokeAllUserSessions(user.id, user.organizationId).catch(() => {});
    }

    await logAuditEvent({
      organizationId: user.organizationId || 'PLATFORM',
      userId: adminId,
      action: active ? 'USER_STATUS_ACTIVE' : 'USER_STATUS_INACTIVE',
      entity: 'USER',
      entityId: user.id,
      metadata: {
        userName: user.name,
        username: user.username,
        activeState: active,
        reason: reason || 'Platform executive user status toggle',
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `User account '${user.username}' is now ${active ? 'Active' : 'Deactivated'}`,
      data: updatedUser,
    });
  } catch (error) {
    console.error('[PlatformAdmin] updatePlatformUserStatus error:', error);
    return res.status(500).json({ error: 'Failed to update user status' });
  }
}

// ============================================================================
// 7. LIST PLATFORM SUBSCRIPTIONS
// ============================================================================
export async function getPlatformSubscriptions(req: Request, res: Response): Promise<Response> {
  try {
    const subscriptions = await prisma.subscription.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            _count: {
              select: { branches: true, users: true, orders: true },
            },
          },
        },
      },
    });

    return res.json({
      success: true,
      data: subscriptions,
    });
  } catch (error) {
    console.error('[PlatformAdmin] getPlatformSubscriptions error:', error);
    return res.status(500).json({ error: 'Failed to retrieve subscriptions' });
  }
}

// ============================================================================
// 8. UPDATE SUBSCRIPTION PLAN & STATUS
// ============================================================================
export async function updateSubscriptionPlan(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { plan, status } = req.body;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    const validPlans = ['STARTER', 'BUSINESS', 'ENTERPRISE'];
    const validStatuses = ['ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELLED'];

    const dataToUpdate: any = {};

    if (plan) {
      const planUpper = plan.toUpperCase();
      if (!validPlans.includes(planUpper)) {
        return res.status(400).json({ error: `Invalid plan. Allowed: ${validPlans.join(', ')}` });
      }
      dataToUpdate.plan = planUpper;
    }

    if (status) {
      const statusUpper = status.toUpperCase();
      if (!validStatuses.includes(statusUpper)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${validStatuses.join(', ')}` });
      }
      dataToUpdate.status = statusUpper;
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: dataToUpdate,
      include: { organization: { select: { id: true, name: true } } },
    });

    await logAuditEvent({
      organizationId: updated.organizationId,
      userId: adminId,
      action: 'PLATFORM_SUBSCRIPTION_UPDATED',
      entity: 'SUBSCRIPTION',
      entityId: updated.id,
      metadata: {
        updatedFields: dataToUpdate,
        orgName: updated.organization?.name,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('[PlatformAdmin] updateSubscriptionPlan error:', error);
    return res.status(500).json({ error: 'Failed to update subscription' });
  }
}

// ============================================================================
// 9. PLATFORM AUDIT LOGS VIEWER
// ============================================================================
export async function getPlatformAuditLogs(req: Request, res: Response): Promise<Response> {
  try {
    const { organizationId, action, entity, limit = '50', page = '1' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * take;

    const whereClause: any = {};

    if (organizationId && typeof organizationId === 'string') {
      whereClause.organizationId = organizationId;
    }

    if (action && typeof action === 'string') {
      whereClause.action = action;
    }

    if (entity && typeof entity === 'string') {
      whereClause.entity = entity;
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where: whereClause }),
      prisma.auditLog.findMany({
        where: whereClause,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, username: true, role: true } },
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('[PlatformAdmin] getPlatformAuditLogs error:', error);
    return res.status(500).json({ error: 'Failed to retrieve platform audit logs' });
  }
}

// ============================================================================
// 10. SYSTEM HEALTH & DIAGNOSTICS
// ============================================================================
export async function getPlatformHealth(req: Request, res: Response): Promise<Response> {
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startTime;

    return res.json({
      success: true,
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      database: {
        status: 'CONNECTED',
        latencyMs: dbLatencyMs,
      },
      system: {
        uptime: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
      },
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] getPlatformHealth error:', error);
    return res.status(503).json({
      success: false,
      status: 'UNHEALTHY',
      error: error.message || 'Database connection error',
    });
  }
}

// ============================================================================
// 11. CONTROLLED TRIAL EXTENSION (PLATFORM ADMIN ONLY)
// ============================================================================
export async function extendOrganizationTrial(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { extensionDays = 7, reason } = req.body;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({
        error: 'EXPLICIT_REASON_REQUIRED: An explicit administrative reason is strictly required to extend an organization trial.',
      });
    }

    const days = parseInt(extensionDays as any, 10) || 7;
    if (days <= 0 || days > 90) {
      return res.status(400).json({ error: 'Extension days must be between 1 and 90 days.' });
    }

    const org = await prisma.organization.findUnique({
      where: { id },
      include: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!org) {
      return res.status(404).json({ error: `Organization '${id}' not found` });
    }

    const sub = org.subscriptions[0];
    const previousTrialEndsAt = sub?.trialEndsAt ? new Date(sub.trialEndsAt) : new Date();
    const baseTime = Math.max(Date.now(), previousTrialEndsAt.getTime());
    const newTrialEndsAt = new Date(baseTime + days * 24 * 60 * 60 * 1000);

    // Update Subscription & Organization status
    let updatedSub;
    if (sub) {
      updatedSub = await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          trialEndsAt: newTrialEndsAt,
          status: 'TRIALING',
        },
      });
    } else {
      updatedSub = await prisma.subscription.create({
        data: {
          organizationId: org.id,
          plan: 'STARTER',
          status: 'TRIALING',
          trialEndsAt: newTrialEndsAt,
        },
      });
    }

    const updatedOrg = await prisma.organization.update({
      where: { id: org.id },
      data: {
        status: 'TRIAL',
        // Note: trialUsedAt is preserved and never overwritten
      },
    });

    // Audit Log
    await logAuditEvent({
      organizationId: org.id,
      userId: adminId,
      action: 'ORGANIZATION_TRIAL_EXTENDED',
      entity: 'ORGANIZATION',
      entityId: org.id,
      metadata: {
        previousTrialEndsAt: previousTrialEndsAt.toISOString(),
        newTrialEndsAt: newTrialEndsAt.toISOString(),
        extensionDays: days,
        reason: reason.trim(),
        adminId,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Trial for '${org.name}' extended by ${days} days until ${newTrialEndsAt.toISOString()}`,
      data: {
        organization: updatedOrg,
        subscription: updatedSub,
        extensionDays: days,
        reason: reason.trim(),
      },
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] extendOrganizationTrial error:', error);
    return res.status(500).json({ error: 'Failed to extend organization trial' });
  }
}

// ============================================================================
// 12. TRIGGER SUBSCRIPTION REMINDERS (MANUAL / SCHEDULER DISPATCH)
// ============================================================================
export async function triggerSubscriptionReminders(req: Request, res: Response): Promise<Response> {
  try {
    const summary = await runSubscriptionReminderScheduler();
    return res.json({
      success: true,
      message: `Daily subscription reminder scheduler executed successfully. Sent: ${summary.sentCount}, Skipped: ${summary.skippedCount}`,
      data: summary,
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] triggerSubscriptionReminders error:', error);
    return res.status(500).json({ error: 'Failed to run subscription reminder scheduler' });
  }
}

// ============================================================================
// 13. VIEW SUBSCRIPTION REMINDER LOGS
// ============================================================================
export async function getPlatformReminderLogs(req: Request, res: Response): Promise<Response> {
  try {
    const logs = await prisma.subscriptionReminderLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: 100,
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return res.json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] getPlatformReminderLogs error:', error);
    return res.status(500).json({ error: 'Failed to retrieve reminder logs' });
  }
}

