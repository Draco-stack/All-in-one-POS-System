import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
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
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { slug: { contains: search.trim(), mode: 'insensitive' } },
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
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { username: { contains: search.trim(), mode: 'insensitive' } },
        { phone: { contains: search.trim(), mode: 'insensitive' } },
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

// ============================================================================
// 14. BRANCH MANAGEMENT (ALL RESTAURANTS ACROSS PLATFORM)
// ============================================================================
export async function getPlatformBranches(req: Request, res: Response): Promise<Response> {
  try {
    const { organizationId, active, search, limit = '50', page = '1' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * take;

    const whereClause: any = {};

    if (organizationId && typeof organizationId === 'string' && organizationId !== 'ALL') {
      whereClause.organizationId = organizationId;
    }

    if (active === 'true') {
      whereClause.active = true;
    } else if (active === 'false') {
      whereClause.active = false;
    }

    if (search && typeof search === 'string' && search.trim()) {
      whereClause.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { slug: { contains: search.trim(), mode: 'insensitive' } },
        { phone: { contains: search.trim(), mode: 'insensitive' } },
        { address: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [total, branches] = await Promise.all([
      prisma.branch.count({ where: whereClause }),
      prisma.branch.findMany({
        where: whereClause,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true, slug: true, status: true } },
          _count: {
            select: { users: true, devices: true, orders: true, shifts: true },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: branches,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('[PlatformAdmin] getPlatformBranches error:', error);
    return res.status(500).json({ error: 'Failed to retrieve platform branches' });
  }
}

export async function createPlatformBranch(req: Request, res: Response): Promise<Response> {
  try {
    const { organizationId, name, slug, address, phone, taxRate = 0, printerIp, printerPort = 9100, settings = '{}' } = req.body;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    if (!organizationId || !name || !slug) {
      return res.status(400).json({ error: 'organizationId, name, and slug are strictly required.' });
    }

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      return res.status(404).json({ error: `Organization '${organizationId}' not found.` });
    }

    const normalizedSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');

    const existingBranch = await prisma.branch.findUnique({
      where: { organizationId_slug: { organizationId, slug: normalizedSlug } },
    });
    if (existingBranch) {
      return res.status(409).json({ error: `A branch with slug '${normalizedSlug}' already exists in this organization.` });
    }

    const branch = await prisma.branch.create({
      data: {
        organizationId,
        name: name.trim(),
        slug: normalizedSlug,
        address: address ? String(address).trim() : null,
        phone: phone ? String(phone).trim() : null,
        taxRate: Number(taxRate) || 0,
        printerIp: printerIp ? String(printerIp).trim() : null,
        printerPort: Number(printerPort) || 9100,
        settings: typeof settings === 'string' ? settings : JSON.stringify(settings),
        active: true,
      },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    await logAuditEvent({
      organizationId,
      branchId: branch.id,
      userId: adminId,
      action: 'EXECUTIVE_ADMIN_BRANCH_CREATED',
      entity: 'BRANCH',
      entityId: branch.id,
      metadata: {
        branchName: branch.name,
        branchSlug: branch.slug,
        orgName: org.name,
        createdByAdminId: adminId,
      },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: `Branch '${branch.name}' created successfully for '${org.name}'`,
      data: branch,
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] createPlatformBranch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create branch' });
  }
}

export async function updatePlatformBranch(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { name, slug, address, phone, taxRate, printerIp, printerPort, active, settings } = req.body;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    const branch = await prisma.branch.findUnique({
      where: { id },
      include: { organization: true },
    });

    if (!branch) {
      return res.status(404).json({ error: `Branch '${id}' not found.` });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (slug !== undefined) {
      updateData.slug = String(slug).toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
    }
    if (address !== undefined) updateData.address = address ? String(address).trim() : null;
    if (phone !== undefined) updateData.phone = phone ? String(phone).trim() : null;
    if (taxRate !== undefined) updateData.taxRate = Number(taxRate) || 0;
    if (printerIp !== undefined) updateData.printerIp = printerIp ? String(printerIp).trim() : null;
    if (printerPort !== undefined) updateData.printerPort = Number(printerPort) || 9100;
    if (active !== undefined) updateData.active = Boolean(active);
    if (settings !== undefined) {
      updateData.settings = typeof settings === 'string' ? settings : JSON.stringify(settings);
    }

    const updated = await prisma.branch.update({
      where: { id },
      data: updateData,
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });

    await logAuditEvent({
      organizationId: branch.organizationId,
      branchId: branch.id,
      userId: adminId,
      action: 'EXECUTIVE_ADMIN_BRANCH_UPDATED',
      entity: 'BRANCH',
      entityId: branch.id,
      metadata: {
        branchName: updated.name,
        updatedFields: Object.keys(updateData),
        adminId,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Branch '${updated.name}' updated successfully`,
      data: updated,
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] updatePlatformBranch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update branch' });
  }
}

export async function deletePlatformBranch(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true, shifts: true, users: true, devices: true },
        },
      },
    });

    if (!branch) {
      return res.status(404).json({ error: `Branch '${id}' not found.` });
    }

    // Safety rule: If branch has historical orders or shifts, soft-deactivate to protect financial integrity
    if (branch._count.orders > 0 || branch._count.shifts > 0) {
      const deactivated = await prisma.branch.update({
        where: { id },
        data: { active: false },
      });

      await logAuditEvent({
        organizationId: branch.organizationId,
        branchId: branch.id,
        userId: adminId,
        action: 'EXECUTIVE_ADMIN_BRANCH_DEACTIVATED',
        entity: 'BRANCH',
        entityId: branch.id,
        metadata: {
          reason: 'Branch has historical financial orders/shifts; deactivated instead of permanent deletion to preserve audit integrity.',
          orderCount: branch._count.orders,
          shiftCount: branch._count.shifts,
          adminId,
        },
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        message: `Branch has historical financial activity. Branch was safely deactivated rather than deleted to preserve financial audit integrity.`,
        data: deactivated,
      });
    }

    // If no historical financial records, safely delete
    await prisma.branch.delete({ where: { id } });

    await logAuditEvent({
      organizationId: branch.organizationId,
      userId: adminId,
      action: 'EXECUTIVE_ADMIN_BRANCH_DELETED',
      entity: 'BRANCH',
      entityId: id,
      metadata: { branchName: branch.name, adminId },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Branch '${branch.name}' successfully deleted.`,
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] deletePlatformBranch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete branch' });
  }
}

// ============================================================================
// 15. USER CREATION, EDITING & PASSWORD / CREDENTIAL RECOVERY
// ============================================================================
export async function createPlatformUser(req: Request, res: Response): Promise<Response> {
  try {
    const { organizationId, branchId, name, username, pin, role = 'CASHIER', phone, restrictions = '[]' } = req.body;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    if (!organizationId || !name || !username || !pin) {
      return res.status(400).json({ error: 'organizationId, name, username, and pin/password are strictly required.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const cleanPin = String(pin).trim();

    if (cleanPin.length < 4) {
      return res.status(400).json({ error: 'PIN/Password must be at least 4 characters.' });
    }

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      return res.status(404).json({ error: `Organization '${organizationId}' not found.` });
    }

    if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch || branch.organizationId !== organizationId) {
        return res.status(400).json({ error: 'Specified branch does not belong to the target organization.' });
      }
    }

    const existingUser = await prisma.user.findFirst({
      where: { organizationId, username: cleanUsername },
    });
    if (existingUser) {
      return res.status(409).json({ error: `Username '${cleanUsername}' already exists within this organization.` });
    }

    const hashedPin = await bcrypt.hash(cleanPin, 10);
    const validRoles = ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'SERVER', 'RIDER', 'PLATFORM_ADMIN', 'EXECUTIVE_ADMIN'];
    const assignedRole = validRoles.includes(String(role).toUpperCase()) ? String(role).toUpperCase() : 'CASHIER';

    const newUser = await prisma.user.create({
      data: {
        organizationId,
        branchId: branchId || null,
        name: String(name).trim(),
        username: cleanUsername,
        pin: hashedPin,
        role: assignedRole,
        phone: phone ? String(phone).trim() : null,
        restrictions: typeof restrictions === 'string' ? restrictions : JSON.stringify(restrictions),
        active: true,
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
        createdAt: true,
        organization: { select: { name: true, slug: true } },
        branch: { select: { name: true } },
      },
    });

    await logAuditEvent({
      organizationId,
      branchId: branchId || null,
      userId: adminId,
      action: 'EXECUTIVE_ADMIN_USER_CREATED',
      entity: 'USER',
      entityId: newUser.id,
      metadata: {
        newUserId: newUser.id,
        newUserName: newUser.name,
        newUsername: newUser.username,
        role: newUser.role,
        createdByAdminId: adminId,
      },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: `User '${newUser.name}' (${newUser.username}) created with role ${newUser.role}`,
      data: newUser,
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] createPlatformUser error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create platform user' });
  }
}

export async function updatePlatformUser(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { name, username, role, branchId, phone, restrictions, active } = req.body;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    const user = await prisma.user.findUnique({
      where: { id },
      include: { organization: true },
    });

    if (!user) {
      return res.status(404).json({ error: `User '${id}' not found.` });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (username !== undefined) {
      const cleanUsername = String(username).trim().toLowerCase();
      if (cleanUsername !== user.username) {
        const existing = await prisma.user.findFirst({
          where: { organizationId: user.organizationId, username: cleanUsername, id: { not: id } },
        });
        if (existing) {
          return res.status(409).json({ error: `Username '${cleanUsername}' is already in use in this organization.` });
        }
        updateData.username = cleanUsername;
      }
    }

    let roleChanged = false;
    let oldRole = user.role;
    if (role !== undefined) {
      const validRoles = ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'SERVER', 'RIDER', 'PLATFORM_ADMIN', 'EXECUTIVE_ADMIN'];
      const normalizedRole = String(role).toUpperCase();
      if (!validRoles.includes(normalizedRole)) {
        return res.status(400).json({ error: `Invalid role '${role}'. Allowed: ${validRoles.join(', ')}` });
      }
      if (normalizedRole !== user.role) {
        roleChanged = true;
        updateData.role = normalizedRole;
      }
    }

    if (branchId !== undefined) {
      if (branchId === null || branchId === '') {
        updateData.branchId = null;
      } else {
        const branch = await prisma.branch.findUnique({ where: { id: branchId } });
        if (!branch || (user.organizationId && branch.organizationId !== user.organizationId)) {
          return res.status(400).json({ error: 'Branch does not belong to user organization.' });
        }
        updateData.branchId = branchId;
      }
    }

    if (phone !== undefined) updateData.phone = phone ? String(phone).trim() : null;
    if (restrictions !== undefined) {
      updateData.restrictions = typeof restrictions === 'string' ? restrictions : JSON.stringify(restrictions);
    }
    if (active !== undefined) {
      updateData.active = Boolean(active);
      if (!updateData.active) {
        // Revoke all sessions if user is deactivated
        revokeAllUserSessions(user.id, user.organizationId || '').catch(() => {});
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        active: true,
        organizationId: true,
        branchId: true,
        organization: { select: { name: true, slug: true } },
        branch: { select: { name: true } },
      },
    });

    if (roleChanged) {
      await logAuditEvent({
        organizationId: user.organizationId || 'PLATFORM',
        userId: adminId,
        action: 'EXECUTIVE_ADMIN_ROLE_CHANGED',
        entity: 'USER',
        entityId: user.id,
        metadata: {
          targetUserId: user.id,
          targetUsername: user.username,
          oldRole,
          newRole: updatedUser.role,
          changedByAdminId: adminId,
        },
        ipAddress: req.ip,
      });
    }

    await logAuditEvent({
      organizationId: user.organizationId || 'PLATFORM',
      userId: adminId,
      action: 'EXECUTIVE_ADMIN_USER_UPDATED',
      entity: 'USER',
      entityId: user.id,
      metadata: {
        targetUserId: user.id,
        targetUsername: user.username,
        updatedFields: Object.keys(updateData),
        changedByAdminId: adminId,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `User '${updatedUser.name}' updated successfully.`,
      data: updatedUser,
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] updatePlatformUser error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update user' });
  }
}

export async function deletePlatformUser(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { createdOrders: true, shiftsOpened: true, unifiedAuditLogs: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: `User '${id}' not found.` });
    }

    // Never delete the last Executive Admin or self
    if (user.id === adminId) {
      return res.status(400).json({ error: 'Cannot delete your own active administrator account.' });
    }

    // Safety rule: if user has created financial orders or shifts, soft-deactivate to prevent foreign key errors and preserve financial audit trail
    if (user._count.createdOrders > 0 || user._count.shiftsOpened > 0) {
      await prisma.user.update({
        where: { id },
        data: { active: false },
      });
      await revokeAllUserSessions(user.id, user.organizationId || '');

      await logAuditEvent({
        organizationId: user.organizationId || 'PLATFORM',
        userId: adminId,
        action: 'EXECUTIVE_ADMIN_USER_DEACTIVATED',
        entity: 'USER',
        entityId: user.id,
        metadata: {
          targetUsername: user.username,
          reason: 'User has historical financial orders/shifts; deactivated instead of permanent deletion to preserve financial audit integrity.',
          adminId,
        },
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        message: `User '${user.name}' has historical sales or shift records. Account was safely deactivated and sessions revoked to preserve financial integrity.`,
      });
    }

    // Hard deletion if no operational dependencies
    await revokeAllUserSessions(user.id, user.organizationId || '');
    await prisma.user.delete({ where: { id } });

    await logAuditEvent({
      organizationId: user.organizationId || 'PLATFORM',
      userId: adminId,
      action: 'EXECUTIVE_ADMIN_USER_DELETED',
      entity: 'USER',
      entityId: id,
      metadata: { deletedUsername: user.username, adminId },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `User '${user.username}' successfully deleted.`,
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] deletePlatformUser error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
}

export async function resetPlatformUserPassword(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { tempPassword } = req.body;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    const user = await prisma.user.findUnique({
      where: { id },
      include: { organization: true },
    });

    if (!user) {
      return res.status(404).json({ error: `User '${id}' not found.` });
    }

    // Generate secure temporary PIN/password (e.g. 6-digit number or alphanumeric)
    const generatedTemp = tempPassword && String(tempPassword).trim().length >= 4
      ? String(tempPassword).trim()
      : Math.floor(100000 + Math.random() * 900000).toString();

    const hashed = await bcrypt.hash(generatedTemp, 10);

    await prisma.user.update({
      where: { id },
      data: { pin: hashed },
    });

    // Revoke all active sessions so the user MUST re-authenticate with the temporary credential
    await revokeAllUserSessions(user.id, user.organizationId || '');

    // Audit log (NEVER store temporary password in audit metadata)
    await logAuditEvent({
      organizationId: user.organizationId || 'PLATFORM',
      userId: adminId,
      action: 'EXECUTIVE_ADMIN_PASSWORD_RESET',
      entity: 'USER',
      entityId: user.id,
      metadata: {
        targetUserId: user.id,
        targetUsername: user.username,
        resetByAdminId: adminId,
        sessionsRevoked: true,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Password reset successfully for user '${user.username}'. All previous sessions revoked.`,
      tempPassword: generatedTemp,
      username: user.username,
      note: 'Provide this temporary credential to the authorized user. It will only be displayed once.',
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] resetPlatformUserPassword error:', error);
    return res.status(500).json({ error: error.message || 'Failed to reset password' });
  }
}

export async function revokePlatformUserSessions(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: `User '${id}' not found.` });
    }

    const revokeResult = await prisma.session.updateMany({
      where: { userId: id, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    await logAuditEvent({
      organizationId: user.organizationId || 'PLATFORM',
      userId: adminId,
      action: 'EXECUTIVE_ADMIN_SESSIONS_REVOKED',
      entity: 'USER',
      entityId: user.id,
      metadata: {
        targetUserId: user.id,
        targetUsername: user.username,
        revokedSessionCount: revokeResult.count,
        adminId,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Successfully revoked ${revokeResult.count} active session(s) for user '${user.username}'.`,
      revokedCount: revokeResult.count,
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] revokePlatformUserSessions error:', error);
    return res.status(500).json({ error: error.message || 'Failed to revoke sessions' });
  }
}

// ============================================================================
// 16. DEVICE MANAGEMENT (POS, KDS, TABLETS, BRIDGES)
// ============================================================================
export async function getPlatformDevices(req: Request, res: Response): Promise<Response> {
  try {
    const { organizationId, branchId, status, deviceType, search, limit = '50', page = '1' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * take;

    const whereClause: any = {};

    if (organizationId && typeof organizationId === 'string' && organizationId !== 'ALL') {
      whereClause.organizationId = organizationId;
    }
    if (branchId && typeof branchId === 'string' && branchId !== 'ALL') {
      whereClause.branchId = branchId;
    }
    if (status && typeof status === 'string' && status !== 'ALL') {
      whereClause.status = status.toUpperCase();
    }
    if (deviceType && typeof deviceType === 'string' && deviceType !== 'ALL') {
      whereClause.deviceType = deviceType.toUpperCase();
    }
    if (search && typeof search === 'string' && search.trim()) {
      whereClause.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { deviceIdentifier: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [total, devices] = await Promise.all([
      prisma.device.count({ where: whereClause }),
      prisma.device.findMany({
        where: whereClause,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: devices,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('[PlatformAdmin] getPlatformDevices error:', error);
    return res.status(500).json({ error: 'Failed to retrieve devices' });
  }
}

export async function revokePlatformDevice(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    const device = await prisma.device.findUnique({
      where: { id },
      include: { organization: true },
    });

    if (!device) {
      return res.status(404).json({ error: `Device '${id}' not found.` });
    }

    const updated = await prisma.device.update({
      where: { id },
      data: { status: 'REVOKED' },
    });

    await logAuditEvent({
      organizationId: device.organizationId,
      branchId: device.branchId,
      userId: adminId,
      action: 'EXECUTIVE_ADMIN_DEVICE_REVOKED',
      entity: 'DEVICE',
      entityId: device.id,
      metadata: {
        deviceIdentifier: device.deviceIdentifier,
        deviceName: device.name,
        reason: reason || 'Executive Admin device authorization revoked',
        adminId,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Device '${device.name}' (${device.deviceIdentifier}) status set to REVOKED.`,
      data: updated,
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] revokePlatformDevice error:', error);
    return res.status(500).json({ error: error.message || 'Failed to revoke device' });
  }
}

export async function reactivatePlatformDevice(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    const device = await prisma.device.findUnique({
      where: { id },
      include: { organization: true },
    });

    if (!device) {
      return res.status(404).json({ error: `Device '${id}' not found.` });
    }

    const updated = await prisma.device.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await logAuditEvent({
      organizationId: device.organizationId,
      branchId: device.branchId,
      userId: adminId,
      action: 'EXECUTIVE_ADMIN_DEVICE_REACTIVATED',
      entity: 'DEVICE',
      entityId: device.id,
      metadata: {
        deviceIdentifier: device.deviceIdentifier,
        deviceName: device.name,
        adminId,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Device '${device.name}' status set to ACTIVE.`,
      data: updated,
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] reactivatePlatformDevice error:', error);
    return res.status(500).json({ error: error.message || 'Failed to reactivate device' });
  }
}

export async function deletePlatformDevice(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) {
      return res.status(404).json({ error: `Device '${id}' not found.` });
    }

    await prisma.device.delete({ where: { id } });

    await logAuditEvent({
      organizationId: device.organizationId,
      branchId: device.branchId,
      userId: adminId,
      action: 'EXECUTIVE_ADMIN_DEVICE_UNPAIRED',
      entity: 'DEVICE',
      entityId: id,
      metadata: {
        deviceIdentifier: device.deviceIdentifier,
        deviceName: device.name,
        adminId,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Device '${device.name}' unpaired and deleted successfully.`,
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] deletePlatformDevice error:', error);
    return res.status(500).json({ error: error.message || 'Failed to unpair device' });
  }
}

// ============================================================================
// 17. ORGANIZATION DETAILS EDITING
// ============================================================================
export async function updateOrganizationDetails(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { name, slug, settings } = req.body;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) {
      return res.status(404).json({ error: `Organization '${id}' not found.` });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (slug !== undefined) {
      const cleanSlug = String(slug).toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
      if (cleanSlug !== org.slug) {
        const existing = await prisma.organization.findUnique({ where: { slug: cleanSlug } });
        if (existing) {
          return res.status(409).json({ error: `Organization slug '${cleanSlug}' is already in use.` });
        }
        updateData.slug = cleanSlug;
      }
    }
    if (settings !== undefined) {
      updateData.settings = typeof settings === 'string' ? settings : JSON.stringify(settings);
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: updateData,
    });

    await logAuditEvent({
      organizationId: org.id,
      userId: adminId,
      action: 'EXECUTIVE_ADMIN_ORGANIZATION_UPDATED',
      entity: 'ORGANIZATION',
      entityId: org.id,
      metadata: {
        oldName: org.name,
        newName: updated.name,
        oldSlug: org.slug,
        newSlug: updated.slug,
        adminId,
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Organization '${updated.name}' updated successfully.`,
      data: updated,
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] updateOrganizationDetails error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update organization' });
  }
}

// ============================================================================
// 18. OPERATIONAL DATA VISIBILITY (READ-ONLY SUPPORT / DEBUGGING)
// ============================================================================
export async function getPlatformOrders(req: Request, res: Response): Promise<Response> {
  try {
    const { organizationId, branchId, status, search, limit = '50', page = '1' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * take;

    const whereClause: any = {};
    if (organizationId && typeof organizationId === 'string' && organizationId !== 'ALL') {
      whereClause.organizationId = organizationId;
    }
    if (branchId && typeof branchId === 'string' && branchId !== 'ALL') {
      whereClause.branchId = branchId;
    }
    if (status && typeof status === 'string' && status !== 'ALL') {
      whereClause.status = status.toUpperCase();
    }
    if (search && typeof search === 'string' && search.trim()) {
      whereClause.OR = [
        { orderNumber: { contains: search.trim(), mode: 'insensitive' } },
        { customerName: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where: whereClause }),
      prisma.order.findMany({
        where: whereClause,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          branch: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, username: true, role: true } },
          items: {
            take: 4,
            select: { id: true, name: true, quantity: true, price: true },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('[PlatformAdmin] getPlatformOrders error:', error);
    return res.status(500).json({ error: 'Failed to retrieve platform orders' });
  }
}

export async function getPlatformCustomers(req: Request, res: Response): Promise<Response> {
  try {
    const { organizationId, search, limit = '50', page = '1' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * take;

    const whereClause: any = {};
    if (organizationId && typeof organizationId === 'string' && organizationId !== 'ALL') {
      whereClause.organizationId = organizationId;
    }
    if (search && typeof search === 'string' && search.trim()) {
      whereClause.OR = [
        { name: { contains: search.trim() } },
        { phone: { contains: search.trim() } },
        { email: { contains: search.trim() } },
      ];
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where: whereClause }),
      prisma.customer.findMany({
        where: whereClause,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: customers,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('[PlatformAdmin] getPlatformCustomers error:', error);
    return res.status(500).json({ error: 'Failed to retrieve platform customers' });
  }
}

export async function getPlatformShifts(req: Request, res: Response): Promise<Response> {
  try {
    const { organizationId, branchId, status, limit = '50', page = '1' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * take;

    const whereClause: any = {};
    if (organizationId && typeof organizationId === 'string' && organizationId !== 'ALL') {
      whereClause.organizationId = organizationId;
    }
    if (branchId && typeof branchId === 'string' && branchId !== 'ALL') {
      whereClause.branchId = branchId;
    }
    if (status && typeof status === 'string' && status !== 'ALL') {
      whereClause.status = status.toUpperCase();
    }

    const [total, shifts] = await Promise.all([
      prisma.registerShift.count({ where: whereClause }),
      prisma.registerShift.findMany({
        where: whereClause,
        take,
        skip,
        orderBy: { openedAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          branch: { select: { id: true, name: true } },
          openedBy: { select: { id: true, name: true, username: true } },
          closedBy: { select: { id: true, name: true, username: true } },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: shifts,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('[PlatformAdmin] getPlatformShifts error:', error);
    return res.status(500).json({ error: 'Failed to retrieve platform shifts' });
  }
}

// ============================================================================
// 19. GLOBAL PLATFORM SEARCH
// ============================================================================
export async function searchPlatform(req: Request, res: Response): Promise<Response> {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.json({
        success: true,
        data: { organizations: [], branches: [], users: [], devices: [], orders: [] },
      });
    }

    const query = q.trim();

    const [orgs, branches, users, devices, orders] = await Promise.all([
      prisma.organization.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
            { id: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          _count: { select: { branches: true, users: true, orders: true } },
          subscriptions: { select: { plan: true, status: true }, take: 1 },
        },
      }),
      prisma.branch.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { username: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          phone: true,
          active: true,
          organization: { select: { id: true, name: true, slug: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
      prisma.device.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { deviceIdentifier: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
      prisma.order.findMany({
        where: {
          OR: [
            { orderNumber: { contains: query, mode: 'insensitive' } },
            { customerName: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
    ]);

    return res.json({
      success: true,
      query,
      data: {
        organizations: orgs,
        branches,
        users,
        devices,
        orders,
      },
    });
  } catch (error) {
    console.error('[PlatformAdmin] searchPlatform error:', error);
    return res.status(500).json({ error: 'Global platform search failed' });
  }
}

// ============================================================================
// 20. AUDITED SUPPORT SESSIONS ("VIEW AS RESTAURANT")
// ============================================================================
export async function startSupportSession(req: Request, res: Response): Promise<Response> {
  try {
    const { organizationId, reason } = req.body;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    if (!organizationId) {
      return res.status(400).json({ error: 'organizationId is required.' });
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        branches: { select: { id: true, name: true } },
        users: { select: { id: true, name: true, role: true } },
        subscriptions: { select: { plan: true, status: true } },
      },
    });

    if (!org) {
      return res.status(404).json({ error: `Organization '${organizationId}' not found.` });
    }

    await logAuditEvent({
      organizationId: org.id,
      userId: adminId,
      action: 'EXECUTIVE_ADMIN_SUPPORT_SESSION_STARTED',
      entity: 'ORGANIZATION',
      entityId: org.id,
      metadata: {
        targetOrgName: org.name,
        targetOrgSlug: org.slug,
        adminId,
        reason: reason || 'Executive Admin started controlled technical support inspection session',
        sessionStartedAt: new Date().toISOString(),
      },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Support viewing session initiated for '${org.name}'. All actions will be explicitly audited.`,
      data: {
        organization: org,
        sessionStartedAt: new Date().toISOString(),
        adminId,
        isSupportSession: true,
      },
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] startSupportSession error:', error);
    return res.status(500).json({ error: error.message || 'Failed to initiate support session' });
  }
}

export async function endSupportSession(req: Request, res: Response): Promise<Response> {
  try {
    const { organizationId, reason } = req.body;
    const adminId = req.tenant?.userId || req.auth?.userId || 'unknown';

    if (organizationId) {
      await logAuditEvent({
        organizationId,
        userId: adminId,
        action: 'EXECUTIVE_ADMIN_SUPPORT_SESSION_ENDED',
        entity: 'ORGANIZATION',
        entityId: organizationId,
        metadata: {
          adminId,
          reason: reason || 'Executive Admin concluded support inspection session',
          sessionEndedAt: new Date().toISOString(),
        },
        ipAddress: req.ip,
      });
    }

    return res.json({
      success: true,
      message: 'Support session successfully terminated.',
    });
  } catch (error: any) {
    console.error('[PlatformAdmin] endSupportSession error:', error);
    return res.status(500).json({ error: error.message || 'Failed to end support session' });
  }
}


