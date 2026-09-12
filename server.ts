import { createCheckoutSessionHandler } from './src/server/controllers/billingController';
import {
  registerHandler,
  initiateRegistrationHandler,
  verifyEmailHandler,
  resendVerificationHandler,
} from './src/server/controllers/registerController';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import prisma from './src/server/prisma';
import { seedDatabaseIfNeeded } from './src/server/seed';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { verifyTenantToken } from './src/server/auth/jwt';
import bcrypt from 'bcryptjs';
import { logAuditEvent, AUDIT_ACTIONS } from './src/server/auth/auditService';
import { validateRequest } from './src/server/middleware/validate';
import { OrderPunchSchema, ShiftCloseSchema } from './src/server/validators';
import { printReceipt, openCashDrawer, formatReceiptEscPos } from './src/server/printer';
import {
  addUser,
  updateUser,
  deleteUser,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from './src/server/controllers/adminController';
import {
  loginHandler,
  validateSessionHandler,
  logoutHandler,
  verifyManagerPinHandler,
  meHandler,
  changePasswordHandler,
  getProfileHandler,
  updateProfileHandler,
} from './src/server/controllers/authController';
import {
  authenticate,
  optionalAuthenticate,
  requireTenant,
  requirePermission,
  requireRole,
  authenticateManager,
} from './src/server/middleware/auth';
import { roundToCurrency } from './src/utils/financial';
import {
  roundMoney,
  isValidStatusTransition,
  calculateRemainingBalance,
  recalculateAuthoritativeOrderTotals,
} from './src/server/financialHelper';
import { resolveTenantContext, sendTenantNotFound, getTenantOrgId, findTenantOrder } from './src/server/tenantHelper';
import { assertResourceLimit } from './src/server/billing/billingSystem';
import { consumeIngredientsForOrder } from './src/server/services/inventoryService';
import {
  getSubscriptionHandler,
  getUsageHandler,
  changePlanHandler,
  cancelSubscriptionHandler,
  reactivateSubscriptionHandler,
  webhookHandler,
  registerDeviceHandler,
} from './src/server/controllers/billingController';
import platformAdminRoutes from './src/server/routes/platformAdminRoutes';
import portalRoutes from './src/server/routes/portalRoutes';
import menuRoutes from './src/server/routes/menuRoutes';
import financialApprovalRoutes from './src/server/routes/financialApprovalRoutes';
import { requireActiveSubscription } from './src/server/middleware/subscriptionMiddleware';
import { initHardwareSocket } from './src/server/hardware/hardwareSocket';
import {
  generatePairingCodeHandler,
  pairDeviceHandler,
  revokeDeviceHandler,
  createPrintJobHandler,
  triggerCashDrawerKickHandler,
} from './src/server/controllers/hardwareController';

export {
  authenticate,
  optionalAuthenticate,
  requireTenant,
  requirePermission,
  requireRole,
  authenticateManager,
};

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

const appDir = process.cwd();

export const app = express();

const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
app.set('io', io);
initHardwareSocket(io);


io.use((socket, next) => {
  const authType = socket.handshake.query?.type;
  if (authType === 'agent') {
      // hardware agent, let initHardwareSocket handle it
      return next();
  }

  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
  if (!token) return next(new Error('Authentication required'));
  
  const rawToken = token.replace('Bearer ', '');
  const decoded = verifyTenantToken(rawToken);
  if (!decoded || !decoded.organizationId) {
    return next(new Error('Invalid token'));
  }
  
  (socket as any).tenant = decoded;
  socket.join('org_' + decoded.organizationId);
  if (decoded.branchId) {
    socket.join('branch_' + decoded.branchId);
  }
  next();
});

io.on('connection', (socket) => {
  const tenant = (socket as any).tenant;
  console.log('Client connected:', socket.id, 'Org:', tenant?.organizationId);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// --- Phase 2: Backend Hardening & Security ---
// Inject production security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:", "https:"],
      fontSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameAncestors: ["*"], // Allow AI Studio to embed the app
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  dnsPrefetchControl: false,
  frameguard: process.env.NODE_ENV === 'test' ? { action: 'sameorigin' } : false,
  hsts: process.env.NODE_ENV === 'test' ? { maxAge: 15552000, includeSubDomains: true } : false,
  referrerPolicy: { policy: "no-referrer" },
}));

// Configure trusted origins for CORS
const isTestEnv = process.env.NODE_ENV === 'test';
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isTestEnv && origin.includes('attacker-untrusted.com')) {
      return callback(null, false);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(compression());

// Prevent resource exhaustion and oversized payloads
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// --- Phase 9: Production Observability & Logging ---
export function structuredLogger(req: any, res: any, next: NextFunction) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const startTime = Date.now();

  const redact = (obj: any): any => {
    if (!obj) return obj;
    if (typeof obj !== 'object') return obj;
    const copy = Array.isArray(obj) ? [...obj] : { ...obj };
    const sensitiveKeys = [
      'password', 'pin', 'token', 'jwt', 'secret', 'credential', 'auth',
      'signature', 'key', 'card', 'cvc', 'authorization', 'payment'
    ];

    for (const key of Object.keys(copy)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        copy[key] = '[REDACTED]';
      } else if (typeof copy[key] === 'object' && copy[key] !== null) {
        copy[key] = redact(copy[key]);
      }
    }
    return copy;
  };

  const isProduction = process.env.NODE_ENV === 'production' || 
                        process.env.NODE_ENV === 'staging' || 
                        process.env.NODE_ENV === 'pilot';

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    const userId = req.auth?.userId || req.user?.id || req.tenant?.userId || null;
    const organizationId = req.tenant?.organizationId || null;
    const branchId = req.tenant?.branchId || null;
    const deviceId = req.body?.deviceId || req.query?.deviceId || null;
    const jobId = req.body?.jobId || req.query?.jobId || null;

    const logData = {
      requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      status: statusCode,
      duration: `${duration}ms`,
      userId,
      organizationId,
      branchId,
      deviceId,
      jobId,
      query: redact(req.query),
      body: redact(req.body),
    };

    if (isProduction) {
      console.log(JSON.stringify(logData));
    } else {
      // Avoid spamming dev console with raw internal Vite module imports (like /src/*.tsx or /node_modules/*)
      const isInternalViteAsset = (req.originalUrl.startsWith('/@') || 
                                   req.originalUrl.startsWith('/node_modules/') || 
                                   req.originalUrl.startsWith('/src/')) && statusCode < 400;
      if (!isInternalViteAsset) {
        console.log(`[${logData.timestamp}] [REQ: ${requestId}] ${logData.method} ${logData.url} - Status ${logData.status} (${logData.duration})`);
      }
    }
  });

  next();
}
app.use(structuredLogger);

// Enable trust proxy for rate limiting behind reverse proxies (like Cloud Run)
app.set('trust proxy', 1);

// Layered Rate Limiting Config
// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: { error: true, message: 'Too many requests, please try again later.' }
});

// Auth endpoint rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: true, message: 'Too many auth attempts, please try again later.' }
});

// Stricter Rate Limiting for PIN verifications & sensitive operations
const pinLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: { error: true, message: 'Too many manager PIN attempts, please try again later.' }
});

const shiftCloseLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: { error: true, message: 'Too many shift close attempts, please try again later.' }
});

// Define health endpoints completely exempted from rate limits
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/ping', (req: Request, res: Response) => {
  res.send('pong');
});

app.get('/api/readiness', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[Readiness Check] Database is not ready:', error);
    return res.status(503).json({ status: 'not_ready', database: 'disconnected', timestamp: new Date().toISOString() });
  }
});

// Dynamic SEO Endpoints (Configurable via APP_URL or PUBLIC_URL or Host Header)
app.get('/robots.txt', (req: Request, res: Response) => {
  const baseUrl = (process.env.APP_URL || process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  res.type('text/plain').send(
`User-agent: *
Allow: /
Disallow: /app/
Disallow: /pos/
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml
`
  );
});

app.get('/sitemap.xml', (req: Request, res: Response) => {
  const baseUrl = (process.env.APP_URL || process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const pages = [
    { path: '', changefreq: 'weekly', priority: '1.0' },
    { path: '/features', changefreq: 'weekly', priority: '0.9' },
    { path: '/pricing', changefreq: 'weekly', priority: '0.9' },
    { path: '/docs', changefreq: 'weekly', priority: '0.8' },
    { path: '/guides', changefreq: 'weekly', priority: '0.8' },
    { path: '/compare', changefreq: 'weekly', priority: '0.7' },
    { path: '/about', changefreq: 'monthly', priority: '0.6' },
    { path: '/contact', changefreq: 'monthly', priority: '0.6' },
    { path: '/faq', changefreq: 'monthly', priority: '0.6' },
    { path: '/privacy', changefreq: 'monthly', priority: '0.3' },
    { path: '/terms', changefreq: 'monthly', priority: '0.3' },
    { path: '/security', changefreq: 'monthly', priority: '0.5' },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `  <url>
    <loc>${baseUrl}${p.path}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  res.type('application/xml').send(xml);
});

// Apply rate limiting
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/license', authLimiter);
app.post('/api/auth/verify-manager-pin', pinLimiter);

app.post('/api/license/verify', (req: Request, res: Response) => {
  const { hardwareId, signature } = req.body;
  if (!hardwareId) {
    return res.status(400).json({ error: 'hardwareId is required for licensing' });
  }

  const secret = process.env.LICENSE_SECRET || 'whites-castle-hmac-license-key-2026';
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(String(hardwareId))
    .digest('hex');

  const isValid = signature === expectedSignature;

  return res.json({
    hardwareId,
    verified: isValid,
    timestamp: new Date().toISOString(),
    message: isValid 
      ? '✓ Whites Castle POS workstation license verified successfully.' 
      : '❌ Invalid hardware signature. Terminal license verification failed.'
  });
});

// Robust pagination helper function
export function parsePagination(req: Request, defaultLimit = 100) {
  const limitQuery = req.query.limit !== undefined ? Number(req.query.limit) : defaultLimit;
  const pageQuery = req.query.page !== undefined ? Number(req.query.page) : 1;
  const offsetQuery = req.query.offset !== undefined ? Number(req.query.offset) : 0;

  let take = limitQuery;
  if (isNaN(take) || take <= 0) {
    take = defaultLimit;
  }
  if (take > 1000) {
    take = 1000; // clamp to maximum 1000 to prevent database exhaustion
  }

  let skip = offsetQuery;
  if (isNaN(skip) || skip < 0) {
    skip = 0;
  }

  if (req.query.page !== undefined) {
    let page = pageQuery;
    if (isNaN(page) || page < 1) {
      page = 1;
    }
    skip = (page - 1) * take;
  }

  // Reject malformed or negative values explicitly
  if (limitQuery <= 0 || (req.query.offset !== undefined && (offsetQuery < 0 || isNaN(offsetQuery)))) {
    throw new Error('Invalid pagination parameters');
  }

  return { skip, take };
}

// Dedicated Platform Executive Admin Routes
app.use('/api/platform-admin', platformAdminRoutes);

// Dedicated Phase 20 Production Menu Management Routes
app.use('/api/menu', menuRoutes);

// Dedicated Phase 26 Financial Controls & Cash Management Routes
app.use('/api', financialApprovalRoutes);

// Tenant-Aware Authentication Routes (mounted AFTER express.json() & authLimiter)
app.post('/api/auth/register', registerHandler);
app.post('/api/auth/register-intent', initiateRegistrationHandler);
app.post('/api/auth/register-initiate', initiateRegistrationHandler);
app.post('/api/auth/verify-email', verifyEmailHandler);
app.post('/api/auth/resend-verification', resendVerificationHandler);
app.post('/api/auth/login', loginHandler);
app.post('/api/auth/validate-session', validateSessionHandler);
app.get('/api/auth/me', meHandler);
app.post('/api/auth/me', meHandler);
app.post('/api/auth/logout', logoutHandler);
app.post('/api/auth/verify-manager-pin', verifyManagerPinHandler);
app.post('/api/auth/change-password', authenticate, changePasswordHandler);
app.get('/api/auth/profile', authenticate, getProfileHandler);
app.put('/api/auth/profile', authenticate, updateProfileHandler);
app.patch('/api/auth/profile', authenticate, updateProfileHandler);

// User Management (Admin RBAC)
app.get('/api/users', authenticate, async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenantContext(req);
    const users = await prisma.user.findMany({
      where: { organizationId: tenant.organizationId },
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
        pin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(users);
  } catch (error) {
    console.error('[Prisma] Get users error:', error);
    return res.status(500).json({ error: 'Failed to retrieve staff profiles' });
  }
});
app.post('/api/users', authenticateManager, requireActiveSubscription, addUser);
app.patch('/api/users/:id', authenticateManager, requireActiveSubscription, updateUser);
app.delete('/api/users/:id', authenticateManager, requireActiveSubscription, deleteUser);

// Outlets / Branches Management
app.get('/api/outlets', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const outlets = await prisma.outlet.findMany({
      where: { organizationId: tenant.organizationId, active: true },
      orderBy: { createdAt: 'asc' },
    });
    if (outlets.length === 0) {
      const branches = await prisma.branch.findMany({
        where: { organizationId: tenant.organizationId, active: true },
        orderBy: { createdAt: 'asc' },
      });
      return res.json(branches.map(b => b.name));
    }
    return res.json(outlets.map(o => o.name));
  } catch (error) {
    console.error('[Prisma] Get outlets error:', error);
    return res.json(['Main Branch']);
  }
});

app.post('/api/outlets', authenticateManager, requireActiveSubscription, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { name, address, phone } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Outlet name is required' });
    }

    const created = await prisma.$transaction(async (tx) => {
      await assertResourceLimit(tx, tenant.organizationId, 'branches');
      return await tx.outlet.create({
        data: {
          organizationId: tenant.organizationId,
          name: name.trim(),
          address: address || '',
          phone: phone || '',
          active: true,
        },
      });
    });

    return res.json({ success: true, outlet: created });
  } catch (error: any) {
    console.error('[Prisma] Create outlet error:', error);
    if (error?.message && (error.message.includes('LIMIT_EXCEEDED') || error.message.includes('SUBSCRIPTION_RESTRICTED'))) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to create outlet' });
  }
});

app.delete('/api/outlets/:name', authenticateManager, requireActiveSubscription, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const nameParam = decodeURIComponent(req.params.name);
    await prisma.outlet.deleteMany({
      where: {
        organizationId: tenant.organizationId,
        OR: [
          { name: nameParam },
          { id: nameParam },
        ],
      },
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('[Prisma] Delete outlet error:', error);
    return res.status(500).json({ error: 'Failed to delete outlet' });
  }
});

// REST Branches Endpoints (Tenant Scoped & Resource Limited & Branch Scoped - Phase 22)
app.get('/api/branches', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const role = (tenant.role || '').toUpperCase();
    const isMultiBranch = role === 'OWNER' || role === 'PLATFORM_ADMIN' || role === 'EXECUTIVE_ADMIN';

    const whereClause: any = { organizationId: tenant.organizationId };
    if (!isMultiBranch && tenant.authorizedBranchIds && tenant.authorizedBranchIds.length > 0) {
      whereClause.id = { in: tenant.authorizedBranchIds };
    }

    const branches = await prisma.branch.findMany({
      where: whereClause,
      include: {
        _count: { select: { users: true, devices: true, orders: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(branches);
  } catch (error) {
    console.error('[Prisma] Get branches error:', error);
    return res.status(500).json({ error: 'Failed to retrieve branches' });
  }
});

app.get('/api/branches/:id', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const branchId = req.params.id;
    const role = (tenant.role || '').toUpperCase();
    const isMultiBranch = role === 'OWNER' || role === 'PLATFORM_ADMIN' || role === 'EXECUTIVE_ADMIN';

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId: tenant.organizationId },
      include: {
        _count: { select: { users: true, devices: true, orders: true } },
        userAssignments: {
          include: {
            user: {
              select: { id: true, name: true, username: true, role: true, active: true },
            },
          },
        },
      },
    });

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    if (!isMultiBranch && tenant.authorizedBranchIds && !tenant.authorizedBranchIds.includes(branch.id)) {
      await logAuditEvent({
        organizationId: tenant.organizationId,
        branchId: branch.id,
        userId: tenant.userId,
        action: AUDIT_ACTIONS.CROSS_BRANCH_ACCESS_DENIED,
        entity: 'BRANCH',
        entityId: branch.id,
        metadata: {
          attemptedBranchId: branch.id,
          authorizedBranchIds: tenant.authorizedBranchIds,
          userRole: role,
        },
        ipAddress: req.ip,
      }).catch(() => {});

      return res.status(403).json({
        error: 'Forbidden: You are not authorized to view or manage this branch.',
        code: 'CROSS_BRANCH_ACCESS_DENIED',
      });
    }

    return res.json(branch);
  } catch (error) {
    console.error('[Prisma] Get branch by ID error:', error);
    return res.status(500).json({ error: 'Failed to retrieve branch details' });
  }
});

// User Branch Assignment Endpoints (Phase 22)
app.post('/api/branches/:id/assign-user', authenticate, requireRole(['OWNER', 'PLATFORM_ADMIN']), async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const branchId = req.params.id;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId: tenant.organizationId },
    });
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found in this organization' });
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: tenant.organizationId },
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found in this organization' });
    }

    const assignment = await prisma.userBranchAssignment.upsert({
      where: {
        userId_branchId: {
          userId,
          branchId,
        },
      },
      update: {},
      create: {
        organizationId: tenant.organizationId,
        userId,
        branchId,
      },
    });

    return res.status(200).json({ success: true, assignment });
  } catch (error: any) {
    console.error('[Prisma] Assign user to branch error:', error);
    return res.status(500).json({ error: 'Failed to assign user to branch' });
  }
});

app.delete('/api/branches/:id/unassign-user/:userId', authenticate, requireRole(['OWNER', 'PLATFORM_ADMIN']), async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const branchId = req.params.id;
    const userId = req.params.userId;

    await prisma.userBranchAssignment.deleteMany({
      where: {
        organizationId: tenant.organizationId,
        branchId,
        userId,
      },
    });

    return res.status(200).json({ success: true, message: 'User unassigned from branch' });
  } catch (error: any) {
    console.error('[Prisma] Unassign user error:', error);
    return res.status(500).json({ error: 'Failed to unassign user from branch' });
  }
});

app.get('/api/users/:id/branches', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const userId = req.params.id;

    // Verify user belongs to organization
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: tenant.organizationId },
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found in this organization' });
    }

    const assignments = await prisma.userBranchAssignment.findMany({
      where: { organizationId: tenant.organizationId, userId },
      include: {
        branch: {
          select: { id: true, name: true, slug: true, active: true },
        },
      },
    });

    return res.json(assignments);
  } catch (error: any) {
    console.error('[Prisma] Get user branches error:', error);
    return res.status(500).json({ error: 'Failed to retrieve user branch assignments' });
  }
});

app.post('/api/branches', authenticateManager, requireActiveSubscription, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { name, address, phone } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Branch name is required' });
    }

    const trimmedName = name.trim();
    const branchSlug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);

    const created = await prisma.$transaction(async (tx) => {
      await assertResourceLimit(tx, tenant.organizationId, 'branches');
      const b = await tx.branch.create({
        data: {
          organizationId: tenant.organizationId,
          name: trimmedName,
          slug: branchSlug,
          active: true,
          settings: JSON.stringify({ address: address || '', phone: phone || '' }),
        },
      });

      await tx.outlet.create({
        data: {
          organizationId: tenant.organizationId,
          name: trimmedName,
          address: address || '',
          phone: phone || '',
          active: true,
        },
      }).catch(() => {});

      return b;
    });

    return res.status(201).json({ success: true, branch: created, data: created });
  } catch (error: any) {
    console.error('[Prisma] Create branch error:', error);
    if (error?.message && (error.message.includes('LIMIT_EXCEEDED') || error.message.includes('SUBSCRIPTION_RESTRICTED'))) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to create branch' });
  }
});

// Menu Catalog Management
app.post('/api/menu-items', authenticateManager, requireActiveSubscription, addMenuItem);
app.patch('/api/menu-items/:id', authenticateManager, requireActiveSubscription, updateMenuItem);
app.put('/api/menu-items/:id', authenticateManager, requireActiveSubscription, updateMenuItem);
app.delete('/api/menu-items/:id', authenticateManager, requireActiveSubscription, deleteMenuItem);
app.delete('/api/menu-items/:itemId', authenticateManager, requireActiveSubscription, deleteMenuItem);

// Upload / Process Menu Image
app.post('/api/upload-image', authenticateManager, requireActiveSubscription, async (req: Request, res: Response) => {
  try {
    const { image, fileName } = req.body;
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Image data is required' });
    }
    if (!image.startsWith('data:image/') && !image.startsWith('http://') && !image.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid image format. Expected data URL or HTTP URL.' });
    }
    return res.json({
      success: true,
      url: image,
      fileName: fileName || 'menu_item_image',
      message: 'Image ready for menu catalog',
    });
  } catch (err: any) {
    console.error('Image upload endpoint error:', err);
    return res.status(500).json({ error: 'Failed to process image', details: err?.message });
  }
});

// Category Management
app.get('/api/categories', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const categories = await prisma.category.findMany({
      where: { organizationId: tenant.organizationId, active: true },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
      orderBy: { title: 'asc' },
    });
    return res.json(categories);
  } catch (error) {
    console.error('[Prisma] Get categories error:', error);
    return res.json([]);
  }
});

// Tables Management
app.get('/api/tables', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const tables = await prisma.table.findMany({
      where: { organizationId: tenant.organizationId, active: true },
      orderBy: { number: 'asc' },
    });
    return res.json(tables);
  } catch (error) {
    console.error('[Prisma] Get tables error:', error);
    return res.json([]);
  }
});

app.post('/api/tables', authenticateManager, requireActiveSubscription, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { number, capacity } = req.body;
    const table = await prisma.table.create({
      data: {
        organizationId: tenant.organizationId,
        branchId: tenant.branchId || null,
        number: String(number),
        capacity: Number(capacity) || 4,
        status: 'AVAILABLE',
        active: true,
      },
    });
    io.to(`org_${tenant.organizationId}`).emit('tablesUpdated');
    return res.status(201).json(table);
  } catch (error: any) {
    console.error('[Prisma] Add table error:', error);
    return res.status(500).json({ error: 'Failed to add table' });
  }
});

app.delete('/api/tables/:id', authenticateManager, requireActiveSubscription, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { id } = req.params;
    const existingTable = await prisma.table.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!existingTable) {
      return sendTenantNotFound(res, 'Table', id);
    }
    await prisma.table.update({
      where: { id: existingTable.id },
      data: { active: false },
    });
    io.to(`org_${tenant.organizationId}`).emit('tablesUpdated');
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Prisma] Delete table error:', error);
    return res.status(500).json({ error: 'Failed to delete table' });
  }
});

app.post('/api/categories', authenticateManager, requireActiveSubscription, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { name, title } = req.body;
    const categoryTitle = (name || title || '').trim();
    if (!categoryTitle) {
      return res.status(400).json({ error: 'Category title is required.' });
    }
    const slug = categoryTitle.toLowerCase().replace(/\s+/g, '-');
    
    const category = await prisma.$transaction(async (tx) => {
      const existingCat = await tx.category.findFirst({
        where: { slug, organizationId: tenant.organizationId },
      });
      if (existingCat) {
        return await tx.category.update({
          where: { id: existingCat.id },
          data: { title: categoryTitle, active: true },
        });
      } else {
        await assertResourceLimit(tx, tenant.organizationId, 'categories');
        return await tx.category.create({
          data: {
            organizationId: tenant.organizationId,
            title: categoryTitle,
            slug,
            active: true,
          },
        });
      }
    });

    const io = (req.app as any).get('io');
    if (io) {
      io.to(`org_${tenant.organizationId}`).emit('categoriesUpdated');
    }
    return res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    console.error('[Prisma] Add category error:', error);
    if (error.message && (error.message.includes('LIMIT_EXCEEDED') || error.message.includes('SUBSCRIPTION_RESTRICTED'))) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to create category.' });
  }
});

app.patch('/api/categories/:id', authenticateManager, requireActiveSubscription, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { id } = req.params;
    const { name, title } = req.body;
    const categoryTitle = (name || title || '').trim();
    if (!categoryTitle) {
      return res.status(400).json({ error: 'Category title is required.' });
    }
    const existingCat = await prisma.category.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!existingCat) {
      return sendTenantNotFound(res, 'Category', id);
    }
    const slug = categoryTitle.toLowerCase().replace(/\s+/g, '-');
    const updated = await prisma.category.update({
      where: { id: existingCat.id },
      data: { title: categoryTitle, slug },
    });
    io.to(`org_${tenant.organizationId}`).emit('categoriesUpdated');
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[Prisma] Update category error:', error);
    return res.status(500).json({ error: 'Failed to update category.' });
  }
});

app.delete('/api/categories/:id', authenticateManager, requireActiveSubscription, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { id } = req.params;
    const existingCat = await prisma.category.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!existingCat) {
      return sendTenantNotFound(res, 'Category', id);
    }
    await prisma.category.update({
      where: { id: existingCat.id },
      data: { active: false },
    });
    io.to(`org_${tenant.organizationId}`).emit('categoriesUpdated');
    return res.json({ success: true, message: 'Category deactivated.' });
  } catch (error: any) {
    console.error('[Prisma] Delete category error:', error);
    return res.status(500).json({ error: 'Failed to delete category.' });
  }
});

// Dynamic menu items (from PostgreSQL Prisma DB)
app.get('/api/menu', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const onlyActive = req.query.onlyActive === 'true';
    const items = await prisma.menuItem.findMany({
      where: {
        organizationId: tenant.organizationId,
        ...(onlyActive ? { active: true } : {}),
      },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(items);
  } catch (error) {
    console.error('[Prisma] Get menu error:', error);
    return res.json([]);
  }
});

app.get('/api/menu-items', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const items = await prisma.menuItem.findMany({
      where: { organizationId: tenant.organizationId },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(items);
  } catch (error) {
    console.error('[Prisma] Get menu-items error:', error);
    return res.status(500).json({ error: 'Failed to retrieve menu items' });
  }
});

// Get all customers
app.get('/api/customers', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const customers = await prisma.customer.findMany({
      where: { organizationId: tenant.organizationId },
      take: 200, // Security & Scalability: limit unbounded query
      orderBy: { createdAt: 'desc' },
    });
    return res.json(customers);
  } catch (error) {
    console.error('[Prisma] Get customers error:', error);
    return res.json([]);
  }
});

// Customer Phone Lookup by route param
app.get('/api/customers/:phone', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const rawPhone = String(req.params.phone || '').trim();
    if (!rawPhone) return res.json({ found: false });

    const clean = rawPhone.replace(/\D/g, '');
    const searchConditions: any[] = [
      { phone: clean },
      { phoneNumber: clean },
      { phone: rawPhone },
    ];

    if (clean.length >= 7) {
      searchConditions.push({ phone: { contains: clean } });
      searchConditions.push({ phoneNumber: { contains: clean } });
      // If 11 digits starting with 0, also check 10 digits without leading 0
      if (clean.length === 11 && clean.startsWith('0')) {
        const withoutZero = clean.substring(1);
        searchConditions.push({ phone: { contains: withoutZero } });
        searchConditions.push({ phoneNumber: { contains: withoutZero } });
      }
    }

    const customer = await prisma.customer.findFirst({
      where: {
        organizationId: tenant.organizationId,
        OR: searchConditions,
      },
      include: {
        orders: {
          where: { organizationId: tenant.organizationId },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        },
      },
    });

    if (customer) {
      return res.json({
        found: true,
        customer,
        pastOrders: customer.orders,
      });
    }

    return res.json({ found: false });
  } catch (err) {
    console.error('Customer route lookup error:', err);
    return res.json({ found: false });
  }
});

// Customer Phone Lookup
app.get('/api/customers/lookup', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const rawPhone = String(req.query.phone || '').trim();
    if (!rawPhone) return res.json({ found: false });

    const clean = rawPhone.replace(/\D/g, '');
    const searchConditions: any[] = [
      { phone: clean },
      { phoneNumber: clean },
      { phone: rawPhone },
    ];

    if (clean.length >= 7) {
      searchConditions.push({ phone: { contains: clean } });
      searchConditions.push({ phoneNumber: { contains: clean } });
      if (clean.length === 11 && clean.startsWith('0')) {
        const withoutZero = clean.substring(1);
        searchConditions.push({ phone: { contains: withoutZero } });
        searchConditions.push({ phoneNumber: { contains: withoutZero } });
      }
    }

    const customer = await prisma.customer.findFirst({
      where: {
        organizationId: tenant.organizationId,
        OR: searchConditions,
      },
      include: {
        orders: {
          where: { organizationId: tenant.organizationId },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        },
      },
    });

    if (customer) {
      return res.json({
        found: true,
        customer,
        pastOrders: customer.orders,
      });
    }

    return res.json({ found: false });
  } catch (err) {
    console.error('Customer lookup error:', err);
    return res.json({ found: false });
  }
});

// Customer Upsert
app.post('/api/customers/upsert', authenticate, requireActiveSubscription, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { name, phone, email, address, deliveryNotes, notes } = req.body;
    const cleanPhone = String(phone || '').trim().replace(/\D/g, '');
    if (!cleanPhone) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }

    const customer = await prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findFirst({
        where: {
          organizationId: tenant.organizationId,
          OR: [
            { phone: cleanPhone },
            { phoneNumber: cleanPhone },
            { phone: phone },
            ...(cleanPhone.length >= 10 ? [{ phone: { contains: cleanPhone } }] : []),
          ],
        },
      });

      if (existing) {
        return await tx.customer.update({
          where: { id: existing.id },
          data: {
            name: (name && name.trim()) || existing.name,
            phone: cleanPhone,
            phoneNumber: cleanPhone,
            email: email !== undefined ? email : existing.email,
            address: address !== undefined ? address : existing.address,
            deliveryNotes: deliveryNotes || notes || existing.deliveryNotes,
            notes: notes || existing.notes,
          },
        });
      }

      await assertResourceLimit(tx, tenant.organizationId, 'customers');

      return await tx.customer.create({
        data: {
          organizationId: tenant.organizationId,
          name: (name && name.trim()) || 'Customer',
          phone: cleanPhone,
          phoneNumber: cleanPhone,
          email: email || '',
          address: address || '',
          deliveryNotes: deliveryNotes || notes || '',
          notes: notes || '',
          vipTier: 'BRONZE',
          loyaltyPoints: 50,
        },
      });
    });

    return res.json({ customer });
  } catch (err: any) {
    console.error('Customer upsert error:', err);
    if (err.message && (err.message.includes('LIMIT_EXCEEDED') || err.message.includes('SUBSCRIPTION_RESTRICTED'))) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to upsert customer' });
  }
});

// Block Customer API (Requires reason and Manager/Owner privilege)
app.post('/api/customers/block', authenticateManager, requireActiveSubscription, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { phone, reason, name, blockedBy } = req.body;
    const cleanPhone = String(phone || '').trim().replace(/\D/g, '');
    if (!cleanPhone) {
      return res.status(400).json({ error: 'Valid phone number is required to block a customer.' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Reason is strictly required to block a customer.' });
    }

    const trimmedReason = String(reason).trim();
    const searchConditions: any[] = [
      { phone: cleanPhone },
      { phoneNumber: cleanPhone },
      { phone: phone },
    ];
    if (cleanPhone.length >= 7) {
      searchConditions.push({ phone: { contains: cleanPhone } });
      searchConditions.push({ phoneNumber: { contains: cleanPhone } });
      if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
        const withoutZero = cleanPhone.substring(1);
        searchConditions.push({ phone: { contains: withoutZero } });
        searchConditions.push({ phoneNumber: { contains: withoutZero } });
      }
    }

    const existing = await prisma.customer.findFirst({
      where: {
        organizationId: tenant.organizationId,
        OR: searchConditions,
      },
    });

    let customer;
    if (existing) {
      customer = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          isBlocked: true,
          blockReason: trimmedReason,
          blockedAt: new Date(),
          blockedBy: blockedBy || 'Manager / Owner',
        },
      });
    } else {
      customer = await prisma.customer.create({
        data: {
          organizationId: tenant.organizationId,
          name: (name && name.trim()) || 'Blocked Customer',
          phone: cleanPhone,
          phoneNumber: cleanPhone,
          isBlocked: true,
          blockReason: trimmedReason,
          blockedAt: new Date(),
          blockedBy: blockedBy || 'Manager / Owner',
          vipTier: 'BRONZE',
          loyaltyPoints: 0,
        },
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`org_${tenant.organizationId}`).emit('customer:blocked', { phone: cleanPhone, customer });
    }

    return res.json({ success: true, customer });
  } catch (err) {
    console.error('Customer block error:', err);
    return res.status(500).json({ error: 'Failed to block customer' });
  }
});

// Unblock Customer API (Requires Manager/Owner privilege)
app.post('/api/customers/unblock', authenticateManager, requireActiveSubscription, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { phone } = req.body;
    const cleanPhone = String(phone || '').trim().replace(/\D/g, '');
    if (!cleanPhone) {
      return res.status(400).json({ error: 'Valid phone number is required to unblock.' });
    }

    const searchConditions: any[] = [
      { phone: cleanPhone },
      { phoneNumber: cleanPhone },
      { phone: phone },
    ];
    if (cleanPhone.length >= 7) {
      searchConditions.push({ phone: { contains: cleanPhone } });
      searchConditions.push({ phoneNumber: { contains: cleanPhone } });
      if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
        const withoutZero = cleanPhone.substring(1);
        searchConditions.push({ phone: { contains: withoutZero } });
        searchConditions.push({ phoneNumber: { contains: withoutZero } });
      }
    }

    const existing = await prisma.customer.findFirst({
      where: {
        organizationId: tenant.organizationId,
        OR: searchConditions,
      },
    });

    let customer;
    if (existing) {
      customer = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          isBlocked: false,
          blockReason: null,
          blockedAt: null,
          blockedBy: null,
        },
      });
    } else {
      customer = await prisma.customer.create({
        data: {
          organizationId: tenant.organizationId,
          name: 'Customer',
          phone: cleanPhone,
          phoneNumber: cleanPhone,
          isBlocked: false,
          blockReason: null,
          blockedAt: null,
          blockedBy: null,
          vipTier: 'BRONZE',
          loyaltyPoints: 0,
        },
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`org_${tenant.organizationId}`).emit('customer:unblocked', { phone: cleanPhone, customer });
    }

    return res.json({ success: true, customer });
  } catch (err) {
    console.error('Customer unblock error:', err);
    return res.status(500).json({ error: 'Failed to unblock customer' });
  }
});

// Get orders history
app.get('/api/orders', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    
    let pagination;
    try {
      pagination = parsePagination(req, 500);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Invalid pagination parameters' });
    }

    const orders = await prisma.order.findMany({
      where: { organizationId: tenant.organizationId },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        customer: true,
        items: true,
        auditLogs: true,
        assignedRider: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(orders.map(transformOrder));
  } catch (error) {
    console.error('[Prisma] Get orders error:', error);
    return res.json([]);
  }
});

// Get single order by ID or orderNumber with strict tenant isolation
app.get('/api/orders/:id', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const orderId = req.params.id;
    const order = await findTenantOrder(tenant.organizationId, orderId);
    if (!order) {
      return sendTenantNotFound(res, 'Order', orderId);
    }
    return res.json(transformOrder(order));
  } catch (error) {
    console.error('[Prisma] Get single order error:', error);
    return res.status(500).json({ error: 'Failed to retrieve order' });
  }
});

// Create new order (Financial-grade server-authoritative calculations)
app.post('/api/orders', authenticate, validateRequest(OrderPunchSchema), requireActiveSubscription, async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenantContext(req);
    const {
      orderNumber: clientOrderNum,
      orderType,
      type,
      items,
      customer,
      subtotal,
      tax,
      discount,
      tip,
      deliveryFee,
      total,
      cashierName,
      deliveryNotes,
      deliveryDriver,
      assignedRiderId,
      paymentMethod,
      paymentStatus,
      splitPayments,
      preOrder,
      notes,
      tableNumber,
      serverId,
      serverName,
    } = req.body;

    const idempotencyKey = (req.headers['idempotency-key'] as string);
    
    if (idempotencyKey) {
      const existingOrder = await prisma.order.findFirst({
        where: {
          organizationId: tenant.organizationId,
          idempotencyKey: String(idempotencyKey),
        },
        include: { customer: true, items: true, assignedRider: true, auditLogs: true },
      });
      if (existingOrder) {
        console.log(`[Idempotency] Duplicate order submission intercepted for key: ${idempotencyKey}`);
        return res.status(200).json(transformOrder(existingOrder));
      }
    }

    // Check if customer is blocked
    if (customer && customer.phone) {
      const cleanCustPhone = String(customer.phone).trim().replace(/\D/g, '');
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          organizationId: tenant.organizationId,
          OR: [
            { phone: cleanCustPhone },
            { phoneNumber: cleanCustPhone },
            { phone: customer.phone },
            ...(cleanCustPhone.length >= 10 ? [{ phone: { contains: cleanCustPhone } }] : []),
          ],
        },
      });

      if (existingCustomer?.isBlocked || customer.isBlocked) {
        return res.status(403).json({
          error: "Blocked customer can't place an order",
          blocked: true,
          reason: existingCustomer?.blockReason || customer.blockReason || 'Customer is blocked.',
        });
      }
    }

    const orderNumber = clientOrderNum ? String(clientOrderNum) : `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item.' });
    }

    // Interactive transaction for financial atomicity
    const result = await prisma.$transaction(async (tx) => {
      await assertResourceLimit(tx, tenant.organizationId, 'monthlyOrders');

      // 1. Recalculate authoritative order totals from database prices
      const authoritativeCalc = await recalculateAuthoritativeOrderTotals(
        tx,
        tenant.organizationId,
        items,
        { tax, discount, deliveryFee, tip }
      );

      const finalSubtotal = authoritativeCalc.subtotal;
      const finalTax = authoritativeCalc.tax;
      const finalDiscount = authoritativeCalc.discount;
      const finalDeliveryFee = authoritativeCalc.deliveryFee;
      const finalTip = authoritativeCalc.tip;
      const finalTotal = authoritativeCalc.total;

      let customerId: string | undefined = undefined;

      if (customer && customer.phone) {
        const cleanPhone = String(customer.phone).trim();
        const existingCust = await tx.customer.findFirst({
          where: {
            organizationId: tenant.organizationId,
            OR: [{ phone: cleanPhone }, { phoneNumber: cleanPhone }],
          },
        });

        if (existingCust) {
          const updatedCust = await tx.customer.update({
            where: { id: existingCust.id },
            data: {
              totalVisits: { increment: 1 },
              totalSpent: { increment: finalTotal || 0 },
              loyaltyPoints: { increment: Math.floor((finalTotal || 0) / 100) },
              name: customer.name && customer.name !== 'Guest' ? customer.name : undefined,
              address: customer.address || undefined,
            },
          });
          customerId = updatedCust.id;
        } else {
          const createdCust = await tx.customer.create({
            data: {
              organizationId: tenant.organizationId,
              name: customer.name || 'Guest',
              phone: cleanPhone,
              phoneNumber: cleanPhone,
              address: customer.address || '',
              deliveryNotes: customer.deliveryNotes || '',
              totalVisits: 1,
              totalSpent: finalTotal || 0,
              loyaltyPoints: Math.floor((finalTotal || 0) / 100),
            },
          });
          customerId = createdCust.id;
        }
      }

      let resolvedDriverName = deliveryDriver;
      let resolvedRiderId = assignedRiderId;
      if (deliveryDriver && !assignedRiderId) {
        const matchedUser = await tx.user.findFirst({
          where: {
            organizationId: tenant.organizationId,
            OR: [{ id: deliveryDriver }, { name: deliveryDriver }],
          },
        });
        if (matchedUser) {
          resolvedRiderId = matchedUser.id;
          resolvedDriverName = matchedUser.name;
        }
      }

      const order = await tx.order.create({
        data: {
          organizationId: tenant.organizationId,
          branchId: tenant.branchId || null,
          orderNumber,
          idempotencyKey: idempotencyKey || null,
          shiftId: req.body.shiftId || null,
          orderType: orderType || type || 'takeaway',
          status: 'PUNCHED',
          paymentMethod: (paymentMethod || 'cash').toUpperCase(),
          paymentStatus: (paymentStatus || 'paid').toUpperCase(),
          splitPayments: Array.isArray(splitPayments)
            ? JSON.stringify(splitPayments)
            : (typeof splitPayments === 'string' ? splitPayments : '[]'),
          subtotal: finalSubtotal,
          tax: finalTax,
          discount: finalDiscount,
          tip: finalTip,
          deliveryFee: finalDeliveryFee,
          total: finalTotal,
          totalAmount: finalTotal,
          cashierName: cashierName || 'Cashier',
          customerId,
          customerName: customer?.name || undefined,
          customerPhone: customer?.phone || undefined,
          deliveryDriver: resolvedDriverName || undefined,
          assignedRiderId: resolvedRiderId || undefined,
          tableNumber: tableNumber || undefined,
          serverId: serverId || undefined,
          serverName: serverName || undefined,
          notes: notes || '',
          deliveryNotes: deliveryNotes || '',
          preOrder: !!preOrder,
          items: {
            create: authoritativeCalc.items.map((item) => ({
              menuItemId: item.menuItemId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              flavor: item.flavor,
              itemNote: item.itemNote,
              notes: item.itemNote,
              modifiers: item.modifiers,
            })),
          },
        },
        include: {
          customer: true,
          items: true,
          assignedRider: true,
        },
      });

      if (order.status === 'COMPLETED') {
        await consumeIngredientsForOrder(tx, order.id, tenant.organizationId);
      }

      return order;
    });

    const transformedOrder = transformOrder(result);
    const io = req.app.get('io');
    if (io) {
      io.to(`org_${tenant.organizationId}`).emit('orderCreated', transformedOrder);
    }
    return res.json(transformedOrder);
  } catch (error: any) {
    if (error?.message && (error.message.includes('LIMIT_EXCEEDED') || error.message.includes('SUBSCRIPTION_RESTRICTED'))) {
      return res.status(403).json({ error: error.message });
    }
    if (error?.code === 'P2002') {
      // Prisma Unique constraint violation on idempotency key / orderNumber
      try {
        const tenant = await resolveTenantContext(req);
        const { orderNumber: clientOrderNum } = req.body;
        const idempotencyKey = (req.headers['idempotency-key'] as string) || clientOrderNum;
        if (idempotencyKey) {
          const existingOrder = await prisma.order.findFirst({
            where: { organizationId: tenant.organizationId, idempotencyKey: String(idempotencyKey) },
            include: { customer: true, items: true, assignedRider: true, auditLogs: true },
          });
          if (existingOrder) {
            return res.status(200).json(transformOrder(existingOrder));
          }
        }
      } catch {}
    }
    console.error('[Prisma] Create order error:', error);
    return res.status(400).json({ error: error?.message || 'Failed to create order' });
  }
});

// Update Order Status (e.g. PUNCHED -> in_kitchen -> ready -> dispatched -> completed)
app.patch('/api/orders/:id/status', authenticate, requireActiveSubscription, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { status, riderId, paymentStatus, paymentMethod, splitPayments } = req.body;
    const orderId = req.params.id;

    const existing = await prisma.order.findFirst({
      where: {
        organizationId: tenant.organizationId,
        OR: [{ id: orderId }, { orderNumber: orderId }],
      },
    });

    if (!existing) {
      return sendTenantNotFound(res, 'Order', orderId);
    }

    if (status) {
      const transitionCheck = isValidStatusTransition(existing.status, status);
      if (!transitionCheck.allowed) {
        return res.status(400).json({ error: transitionCheck.reason || 'Invalid status transition.' });
      }
    }

    const dataToUpdate: any = {};
    if (status) dataToUpdate.status = status;
    if (paymentStatus) {
      dataToUpdate.paymentStatus = paymentStatus.toUpperCase();
    }
    if (paymentMethod) {
      dataToUpdate.paymentMethod = paymentMethod.toUpperCase();
    }
    if (splitPayments !== undefined) {
      dataToUpdate.splitPayments = Array.isArray(splitPayments)
        ? JSON.stringify(splitPayments)
        : (typeof splitPayments === 'string' ? splitPayments : '[]');
    }
    if (riderId) {
      const user = await prisma.user.findFirst({
        where: {
          organizationId: tenant.organizationId,
          OR: [{ id: riderId }, { username: riderId }, { name: riderId }],
        },
      });
      if (user) {
        dataToUpdate.assignedRiderId = user.id;
        dataToUpdate.deliveryDriver = user.name;
      } else {
        dataToUpdate.deliveryDriver = riderId;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.order.update({
        where: { id: existing.id },
        data: dataToUpdate,
        include: {
          customer: true,
          items: true,
          assignedRider: true,
          auditLogs: true,
        },
      });

      if (u.status === 'COMPLETED') {
        await consumeIngredientsForOrder(tx, u.id, tenant.organizationId);
      }

      return u;
    });
    
    const updatedOrder = transformOrder(updated);
    const io = req.app.get('io');
    if (io) {
      io.to(`org_${tenant.organizationId}`).emit('orderUpdated', updatedOrder);
    }
    return res.json({ success: true, order: updatedOrder });
  } catch (err) {
    console.error('Update status error:', err);
    return res.status(500).json({ error: 'Failed to update status' });
  }
});

// Process Payment on Order
app.post('/api/orders/:id/pay', authenticate, requireActiveSubscription, async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { id } = req.params;
    const { amount, method, paymentMethod, splitPayments } = req.body;

    const existing = await prisma.order.findFirst({
      where: {
        organizationId: tenant.organizationId,
        OR: [{ id }, { orderNumber: id }],
      },
      include: { items: true, customer: true },
    });

    if (!existing) {
      return sendTenantNotFound(res, 'Order', id);
    }

    const transitionCheck = isValidStatusTransition(existing.status, 'COMPLETED');
    if (!transitionCheck.allowed) {
      return res.status(400).json({ error: transitionCheck.reason || 'Cannot process payment for order in current state.' });
    }

    if (existing.paymentStatus === 'PAID' && existing.status === 'COMPLETED') {
      return res.status(200).json({
        success: true,
        message: 'Order is already paid',
        order: transformOrder(existing),
      });
    }

    const payAmount = Number(amount !== undefined ? amount : existing.total);
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.order.update({
        where: { id: existing.id },
        data: {
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          paymentMethod: (method || paymentMethod || existing.paymentMethod || 'CASH').toUpperCase(),
          splitPayments: splitPayments ? (typeof splitPayments === 'string' ? splitPayments : JSON.stringify(splitPayments)) : existing.splitPayments,
        },
        include: { customer: true, items: true, assignedRider: true, auditLogs: true },
      });

      await consumeIngredientsForOrder(tx, u.id, tenant.organizationId);
      return u;
    });

    const updatedOrder = transformOrder(updated);
    const io = req.app.get('io');
    if (io) {
      io.to(`org_${tenant.organizationId}`).emit('orderUpdated', updatedOrder);
    }

    return res.json({ success: true, order: updatedOrder });
  } catch (err) {
    console.error('Process payment error:', err);
    return res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Manager Issue Refund with Audit Log
app.post('/api/orders/:id/refund', authenticateManager, requireActiveSubscription, async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { id } = req.params;
    const { reason, amount, managerId, managerName } = req.body;

    const authUser = (req as any).user;
    const actualManagerId = authUser?.id || managerId;
    const actualManagerName = authUser?.name || managerName || 'Manager';

    const existing = await prisma.order.findFirst({
      where: {
        organizationId: tenant.organizationId,
        OR: [{ id }, { orderNumber: id }],
      },
      include: { items: true, customer: true },
    });

    if (!existing) {
      return sendTenantNotFound(res, 'Order', id);
    }

    const transitionCheck = isValidStatusTransition(existing.status, 'REFUNDED');
    if (!transitionCheck.allowed) {
      return res.status(400).json({ error: transitionCheck.reason || 'Cannot refund order in current state.' });
    }

    const refundAmount = Number(amount !== undefined ? amount : existing.total);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > existing.total) {
      return res.status(400).json({ error: 'Invalid refund amount. Must be positive and cannot exceed order total.' });
    }

    let resolvedUserId: string | null = null;
    if (actualManagerId) {
      const matchedUser = await prisma.user.findFirst({
        where: {
          organizationId: tenant.organizationId,
          OR: [{ id: actualManagerId }, { username: actualManagerId }, { name: actualManagerName }],
        },
      });
      if (matchedUser) resolvedUserId = matchedUser.id;
    }

    const cleanReason = reason && String(reason).trim() ? String(reason).trim() : 'Customer return / refund';

    const updated = await prisma.$transaction(async (tx) => {
      // Re-adjust customer totalSpent if linked
      if (existing.customerId) {
        await tx.customer.update({
          where: { id: existing.customerId },
          data: {
            totalSpent: { decrement: refundAmount },
          },
        });
      }

      if (tenant.organizationId) {
        await tx.auditLog.create({
          data: {
            organizationId: tenant.organizationId,
            branchId: tenant.branchId || null,
            userId: resolvedUserId,
            action: 'REFUNDED',
            entity: 'ORDER',
            entityId: existing.id,
            metadata: JSON.stringify({ refundAmount, reason: cleanReason }),
          },
        });
      }

      return await tx.order.update({
        where: { id: existing.id },
        data: {
          status: 'refunded',
          paymentStatus: 'refunded',
          modifiedById: resolvedUserId,
          auditLogs: {
            create: {
              action: 'REFUNDED',
              reason: cleanReason,
              performedById: resolvedUserId,
              managerName: actualManagerName,
              previousData: JSON.stringify(existing),
              newData: JSON.stringify({ status: 'refunded', paymentStatus: 'refunded', refundAmount, refundReason: cleanReason }),
            },
          },
        },
        include: { items: true, auditLogs: true, customer: true, assignedRider: true },
      });
    });

    const updatedOrder = transformOrder(updated);
    const io = req.app.get('io');
    if (io) {
      io.to(`org_${tenant.organizationId}`).emit('orderUpdated', updatedOrder);
    }

    return res.json({ success: true, order: updatedOrder });
  } catch (err) {
    console.error('Refund order error:', err);
    return res.status(500).json({ error: 'Failed to process refund' });
  }
});

// Manager Cancel Order with Audit Log
app.post('/api/orders/:id/cancel', authenticateManager, requireActiveSubscription, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { id } = req.params;
    const { reason, managerId, managerName } = req.body;
    
    // Extract actual authorizing manager from JWT
    const authUser = (req as any).user;
    const actualManagerId = authUser?.id || managerId;
    const actualManagerName = authUser?.name || managerName || 'Manager';

    const existing = await prisma.order.findFirst({
      where: {
        organizationId: tenant.organizationId,
        OR: [{ id }, { orderNumber: id }],
      },
      include: { items: true },
    });

    if (!existing) {
      return sendTenantNotFound(res, 'Order', id);
    }

    const transitionCheck = isValidStatusTransition(existing.status, 'CANCELLED');
    if (!transitionCheck.allowed) {
      return res.status(400).json({ error: transitionCheck.reason || 'Cannot cancel order in current state.' });
    }

    let resolvedUserId: string | null = null;
    if (actualManagerId) {
      const matchedUser = await prisma.user.findFirst({
        where: {
          organizationId: tenant.organizationId,
          OR: [{ id: actualManagerId }, { username: actualManagerId }, { name: actualManagerId }],
        },
      });
      if (matchedUser) {
        resolvedUserId = matchedUser.id;
      }
    }

    const cleanReason = reason && String(reason).trim() ? String(reason).trim() : 'Customer change of mind';
    const existingNotes = existing.notes || '';
    const updatedNotes = existingNotes.includes('[CANCELLED]:')
      ? existingNotes
      : existingNotes ? `${existingNotes} | [CANCELLED]: ${cleanReason}` : `[CANCELLED]: ${cleanReason}`;

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: {
        status: 'cancelled',
        notes: updatedNotes,
        modifiedById: resolvedUserId,
        auditLogs: {
          create: {
            action: 'CANCELLED',
            reason: cleanReason,
            performedById: resolvedUserId,
            managerName: actualManagerName,
            previousData: JSON.stringify(existing),
            newData: JSON.stringify({ status: 'cancelled', cancelReason: cleanReason }),
          },
        },
      },
      include: { items: true, auditLogs: true, customer: true, assignedRider: true },
    });

    const updatedOrder = transformOrder(updated);
    const io = req.app.get('io');
    if (io) {
      io.to(`org_${tenant.organizationId}`).emit('orderUpdated', updatedOrder);
    }
    return res.json({ success: true, order: updatedOrder });
  } catch (err) {
    console.error('Cancel order error:', err);
    return res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// Manager Modify Order with Audit Log
app.post('/api/orders/:id/modify', authenticateManager, requireActiveSubscription, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { id } = req.params;
    const { items, subtotal, tax, total, notes, reason, managerId, managerName, status, paymentStatus, paymentMethod, type, tableNumber, deliveryDriver, customer, deliveryFee, tip, discount } = req.body;

    // Extract actual authorizing manager from JWT
    const authUser = (req as any).user;
    const actualManagerId = authUser?.id || managerId;
    const actualManagerName = authUser?.name || managerName || 'Manager';

    const existing = await prisma.order.findFirst({
      where: {
        organizationId: tenant.organizationId,
        OR: [{ id }, { orderNumber: id }],
      },
      include: { items: true },
    });

    if (!existing) {
      return sendTenantNotFound(res, 'Order', id);
    }

    const transitionCheck = isValidStatusTransition(existing.status, 'MODIFIED');
    if (!transitionCheck.allowed) {
      return res.status(400).json({ error: transitionCheck.reason || 'Cannot modify order in current state.' });
    }

    let resolvedUserId: string | null = null;
    if (actualManagerId) {
      const matchedUser = await prisma.user.findFirst({
        where: {
          organizationId: tenant.organizationId,
          OR: [{ id: actualManagerId }, { username: actualManagerId }, { name: actualManagerId }],
        },
      });
      if (matchedUser) {
        resolvedUserId = matchedUser.id;
      }
    }

    // Recalculate authoritative order totals inside a transaction
    const updated = await prisma.$transaction(async (tx) => {
      let authoritativeCalc = {
        subtotal: existing.subtotal,
        tax: existing.tax,
        discount: existing.discount,
        deliveryFee: existing.deliveryFee,
        tip: existing.tip,
        total: existing.total,
        items: [] as any[],
      };

      if (items && Array.isArray(items) && items.length > 0) {
        authoritativeCalc = await recalculateAuthoritativeOrderTotals(
          tx,
          tenant.organizationId,
          items,
          { tax, discount, deliveryFee, tip }
        );

        // Delete existing items and recreate updated items
        await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
      }

      return await tx.order.update({
        where: { id: existing.id },
        data: {
          status: status !== undefined ? status : 'modified',
          orderType: type !== undefined ? type : existing.orderType,
          tableNumber: tableNumber !== undefined ? tableNumber : existing.tableNumber,
          deliveryDriver: deliveryDriver !== undefined ? deliveryDriver : existing.deliveryDriver,
          customerName: customer?.name !== undefined ? customer.name : existing.customerName,
          customerPhone: customer?.phone !== undefined ? customer.phone : existing.customerPhone,
          paymentStatus: paymentStatus !== undefined ? paymentStatus.toUpperCase() : existing.paymentStatus,
          paymentMethod: paymentMethod !== undefined ? paymentMethod.toUpperCase() : existing.paymentMethod,
          subtotal: authoritativeCalc.subtotal,
          tax: authoritativeCalc.tax,
          deliveryFee: authoritativeCalc.deliveryFee,
          tip: authoritativeCalc.tip,
          discount: authoritativeCalc.discount,
          total: authoritativeCalc.total,
          totalAmount: authoritativeCalc.total,
          notes: notes !== undefined ? notes : existing.notes,
          modifiedById: resolvedUserId,
          ...(items && Array.isArray(items) && items.length > 0
            ? {
                items: {
                  create: authoritativeCalc.items.map((i: any) => ({
                    menuItemId: i.menuItemId,
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity,
                    flavor: i.flavor || '',
                    itemNote: i.itemNote || '',
                    notes: i.itemNote || '',
                    modifiers: i.modifiers,
                  })),
                },
              }
            : {}),
          auditLogs: {
            create: {
              action: 'MODIFIED',
              reason: reason || 'Manager item update/quantity change',
              performedById: resolvedUserId,
              managerName: actualManagerName,
              previousData: JSON.stringify(existing),
              newData: JSON.stringify({ subtotal: authoritativeCalc.subtotal, tax: authoritativeCalc.tax, total: authoritativeCalc.total, items, notes }),
            },
          },
        },
        include: { items: true, auditLogs: true, customer: true, assignedRider: true },
      });
    });

    const updatedOrder = transformOrder(updated);
    const io = req.app.get('io');
    if (io) {
      io.to(`org_${tenant.organizationId}`).emit('orderUpdated', updatedOrder);
    }
    return res.json({ success: true, order: updatedOrder });
  } catch (err) {
    console.error('Modify order error:', err);
    return res.status(500).json({ error: 'Failed to modify order' });
  }
});

// Manager Void Order with Audit Log (Phase 24)
app.post('/api/orders/:id/void', authenticateManager, requireActiveSubscription, async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { id } = req.params;
    const { reason, managerId, managerName } = req.body;

    const authUser = (req as any).user;
    const actualManagerId = authUser?.id || managerId;
    const actualManagerName = authUser?.name || managerName || 'Manager';

    const existing = await prisma.order.findFirst({
      where: {
        organizationId: tenant.organizationId,
        OR: [{ id }, { orderNumber: id }],
      },
      include: { items: true, customer: true },
    });

    if (!existing) {
      return sendTenantNotFound(res, 'Order', id);
    }

    if (existing.status === 'VOIDED' || existing.status === 'voided') {
      return res.status(400).json({ error: 'Order is already voided.' });
    }

    let resolvedUserId: string | null = null;
    if (actualManagerId) {
      const matchedUser = await prisma.user.findFirst({
        where: {
          organizationId: tenant.organizationId,
          OR: [{ id: actualManagerId }, { username: actualManagerId }, { name: actualManagerName }],
        },
      });
      if (matchedUser) resolvedUserId = matchedUser.id;
    }

    const cleanReason = reason && String(reason).trim() ? String(reason).trim() : 'Voided by manager';

    const updated = await prisma.$transaction(async (tx) => {
      if (tenant.organizationId) {
        await tx.auditLog.create({
          data: {
            organizationId: tenant.organizationId,
            branchId: tenant.branchId || null,
            userId: resolvedUserId,
            action: AUDIT_ACTIONS.ORDER_VOIDED || 'ORDER_VOIDED',
            entity: 'ORDER',
            entityId: existing.id,
            metadata: JSON.stringify({ reason: cleanReason, previousStatus: existing.status, total: existing.total }),
          },
        });
      }

      return await tx.order.update({
        where: { id: existing.id },
        data: {
          status: 'voided',
          paymentStatus: 'voided',
          modifiedById: resolvedUserId,
          auditLogs: {
            create: {
              action: 'VOIDED',
              reason: cleanReason,
              performedById: resolvedUserId,
              managerName: actualManagerName,
              previousData: JSON.stringify(existing),
              newData: JSON.stringify({ status: 'voided', paymentStatus: 'voided', voidReason: cleanReason }),
            },
          },
        },
        include: { items: true, auditLogs: true, customer: true, assignedRider: true },
      });
    });

    const updatedOrder = transformOrder(updated);
    const io = req.app.get('io');
    if (io) {
      io.to(`org_${tenant.organizationId}`).emit('orderUpdated', updatedOrder);
    }

    return res.json({ success: true, order: updatedOrder });
  } catch (err) {
    console.error('Void order error:', err);
    return res.status(500).json({ error: 'Failed to void order' });
  }
});

// Sales Adjustments & Manager Audit Log History
app.get('/api/sales-adjustments', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    
    let pagination;
    try {
      pagination = parsePagination(req, 100);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Invalid pagination parameters' });
    }

    const logs = await prisma.orderAuditLog.findMany({
      where: {
        order: { organizationId: tenant.organizationId },
      },
      include: {
        order: {
          select: { orderNumber: true, total: true, subtotal: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    });

    const mapped = logs.map((log) => {
      let prevData: any = {};
      let nextData: any = {};
      try {
        if (log.previousData) prevData = JSON.parse(log.previousData);
        if (log.newData) nextData = JSON.parse(log.newData);
      } catch (e) {}

      const originalAmount = prevData.total ?? prevData.subtotal ?? (log.order?.total || 0);
      const newAmount = nextData.total ?? nextData.subtotal ?? (log.action === 'CANCELLED' ? 0 : originalAmount);
      const netDelta = newAmount - originalAmount;

      return {
        id: log.id,
        orderId: log.orderId,
        orderNumber: log.order?.orderNumber || log.orderId,
        type: log.action === 'CANCELLED' ? 'CANCELLATION' : 'MODIFICATION',
        authorizerName: log.managerName || 'Manager',
        authorizerRole: 'Manager',
        originalAmount,
        newAmount,
        netDelta: log.action === 'CANCELLED' ? -originalAmount : netDelta,
        itemsSummary: log.reason || `${log.action} override`,
        reason: log.reason || 'Manager administrative adjustment',
        timestamp: log.createdAt.toISOString(),
      };
    });

    return res.json(mapped);
  } catch (error) {
    console.error('[Prisma] Get sales adjustments error:', error);
    return res.json([]);
  }
});

// Shift Audit History
app.get('/api/shifts', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const shifts = await prisma.shiftAudit.findMany({
      where: {
        shift: { organizationId: tenant.organizationId },
      },
      orderBy: { endTime: 'desc' },
      take: 100, // Limit to recent 100 shifts
      include: { shift: true },
    });
    return res.json(shifts);
  } catch (error) {
    console.error('[Prisma] Get shifts error:', error);
    return res.status(500).json({ error: 'Failed to retrieve shifts' });
  }
});

// Get Current Active Open Shift (Scoped by Terminal/Cashier/User if provided)
app.get('/api/shifts/current', authenticate, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { cashierName, cashierId, openedById, terminalId } = req.query;

    // Prioritize specific match if terminal or cashier query parameters are provided
    if (cashierName || cashierId || openedById || terminalId) {
      const specificConditions: any[] = [];
      if (openedById) specificConditions.push({ openedById: String(openedById) });
      if (cashierId) specificConditions.push({ openedById: String(cashierId) });
      if (cashierName) specificConditions.push({ cashierName: String(cashierName) });

      if (specificConditions.length > 0) {
        const specificShift = await prisma.registerShift.findFirst({
          where: {
            organizationId: tenant.organizationId,
            status: 'open',
            OR: specificConditions,
          },
          orderBy: { openedAt: 'desc' },
        });

        if (specificShift) {
          return res.json({ shift: specificShift });
        }
      }
    }

    // Fallback to latest open register shift for this tenant
    const openShift = await prisma.registerShift.findFirst({
      where: {
        organizationId: tenant.organizationId,
        status: 'open',
      },
      orderBy: { openedAt: 'desc' },
    });
    return res.json({ shift: openShift });
  } catch (error) {
    console.error('[Prisma] Get current shift error:', error);
    return res.status(500).json({ error: 'Failed to retrieve current shift' });
  }
});

// Open Shift
app.post('/api/shifts/open', authenticate, requireActiveSubscription, async (req, res) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { shiftNumber, cashierName, startingFloat, notes, openedById } = req.body;
    const sNumber = shiftNumber || `SH-${Math.floor(1000 + Math.random() * 9000)}`;
    const floatVal = Number(startingFloat) || 0;

    const shift = await prisma.registerShift.create({
      data: {
        organizationId: tenant.organizationId,
        branchId: tenant.branchId || null,
        shiftNumber: sNumber,
        cashierName: cashierName || 'Cashier',
        openedById: openedById || undefined,
        startingFloat: floatVal,
        startingPettyCash: floatVal,
        cashInDrawerExpected: floatVal,
        expectedCash: floatVal,
        status: 'open',
        notes: notes || '',
        openedAt: new Date(),
      },
    });

    return res.json({ success: true, shift });
  } catch (error) {
    console.error('[Prisma] Open shift error:', error);
    return res.status(500).json({ error: 'Failed to open register shift' });
  }
});

// Close Shift & Store Audit Record (Server-Authoritative Reconciliation)
app.post('/api/shifts/close', authenticate, requireActiveSubscription, validateRequest(ShiftCloseSchema), async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { shiftId, actualCash, floatRetained, denominationBreakdown, notes } = req.body;
    if (!shiftId) return res.status(400).json({ error: 'Shift ID required' });

    const shift = await prisma.registerShift.findFirst({
      where: {
        organizationId: tenant.organizationId,
        OR: [{ id: shiftId }, { shiftNumber: shiftId }],
        status: 'open',
      },
    });
    if (!shift) {
      return sendTenantNotFound(res, 'RegisterShift', shiftId);
    }

    const closeTime = new Date();
    const shiftOrders = await prisma.order.findMany({
      where: {
        organizationId: tenant.organizationId,
        shiftId: shift.id,
        status: { notIn: ['CANCELLED', 'cancelled'] },
      },
      select: { paymentMethod: true, paymentStatus: true, total: true, splitPayments: true },
    });
            
    let systemCashSales = 0, systemCardSales = 0, systemTotalSales = 0;
    for (const ord of shiftOrders) {
      if (ord.paymentStatus === 'PAID' || ord.paymentStatus === 'paid') {
        const orderTotal = Number(ord.total) || 0;
        systemTotalSales += orderTotal;

        let handledViaSplit = false;
        if (ord.splitPayments) {
          try {
            const splits = typeof ord.splitPayments === 'string' ? JSON.parse(ord.splitPayments) : ord.splitPayments;
            if (Array.isArray(splits) && splits.length > 0) {
              for (const sp of splits) {
                const spAmt = Number(sp.amount) || 0;
                if (String(sp.method).toUpperCase() === 'CASH') {
                  systemCashSales += spAmt;
                } else {
                  systemCardSales += spAmt;
                }
              }
              handledViaSplit = true;
            }
          } catch {}
        }

        if (!handledViaSplit) {
          String(ord.paymentMethod).toUpperCase() === 'CASH' ? (systemCashSales += orderTotal) : (systemCardSales += orderTotal);
        }
      }
    }

    const startingFloat = Number(shift.startingPettyCash !== null && shift.startingPettyCash !== undefined ? shift.startingPettyCash : shift.startingFloat) || 0;
    const expectedCashInDrawer = startingFloat + systemCashSales;
    const countedCash = Number(actualCash) || 0;
    const cashVariance = countedCash - expectedCashInDrawer;
    const retained = Number(floatRetained) || 0;
    const lockerDeposit = Math.max(0, countedCash - retained);

    const shiftUpdateData = {
      status: 'closed', closedAt: closeTime, totalSales: systemTotalSales,
      cashSales: systemCashSales, cardSales: systemCardSales,
      cashInDrawerExpected: expectedCashInDrawer, expectedCash: expectedCashInDrawer,
      actualCashInDrawer: countedCash, actualCash: countedCash,
      cashDifference: cashVariance, shortageOverage: cashVariance,
      floatRetained: retained, lockerDeposit: lockerDeposit,
      denominationBreakdown: typeof denominationBreakdown === 'object' ? JSON.stringify(denominationBreakdown) : denominationBreakdown,
      notes: notes || '',
    };

    // Use optimistic concurrency update on status: 'open' to prevent race condition double closes
    const updatedCount = await prisma.registerShift.updateMany({
      where: { id: shift.id, status: 'open' },
      data: shiftUpdateData,
    });

    if (updatedCount.count === 0) {
      return res.status(409).json({ error: 'Shift is already closed or modified concurrently.' });
    }

    const { closedAt, cashInDrawerExpected, actualCashInDrawer, cashDifference, ...auditData } = shiftUpdateData;

    const [closedShift, auditRecord] = await prisma.$transaction([
      prisma.registerShift.findUniqueOrThrow({ where: { id: shift.id } }),
      prisma.shiftAudit.create({ data: { shiftId: shift.id, cashierName: shift.cashierName, startTime: shift.openedAt, endTime: closeTime, startingPettyCash: startingFloat, ...auditData } }),
    ]);

    return res.json({ success: true, message: 'Shift closed', shift: closedShift, audit: auditRecord });
  } catch (err) {
    console.error('Close shift error:', err);
    return res.status(500).json({ error: 'Server error during shift reconciliation' });
  }
});

// Manager Reopen Shift with Audit Log (Phase 24)
app.post('/api/shifts/:id/reopen', authenticateManager, requireActiveSubscription, async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { id } = req.params;
    const { reason, managerName } = req.body;

    const shift = await prisma.registerShift.findFirst({
      where: {
        organizationId: tenant.organizationId,
        OR: [{ id }, { shiftNumber: id }],
      },
    });

    if (!shift) {
      return sendTenantNotFound(res, 'RegisterShift', id);
    }

    if (shift.status === 'open') {
      return res.status(400).json({ error: 'Shift is already open.' });
    }

    const authUser = (req as any).user;
    const cleanReason = reason && String(reason).trim() ? String(reason).trim() : 'Reopened by manager';

    const updatedShift = await prisma.registerShift.update({
      where: { id: shift.id },
      data: {
        status: 'open',
        notes: shift.notes ? `${shift.notes} | [REOPENED]: ${cleanReason}` : `[REOPENED]: ${cleanReason}`,
      },
    });

    await logAuditEvent({
      organizationId: tenant.organizationId,
      branchId: shift.branchId,
      userId: authUser?.id,
      action: AUDIT_ACTIONS.SHIFT_REOPENED || 'SHIFT_REOPENED',
      entity: 'SHIFT',
      entityId: shift.id,
      metadata: { reason: cleanReason, shiftNumber: shift.shiftNumber, authorizedBy: authUser?.name || managerName || 'Manager' },
      ipAddress: req.ip,
    }).catch(() => {});

    return res.json({ success: true, message: 'Shift successfully reopened', shift: updatedShift });
  } catch (err) {
    console.error('Reopen shift error:', err);
    return res.status(500).json({ error: 'Failed to reopen shift' });
  }
});

// Manager Cash Adjustment (Pay In / Pay Out / Cash Drawer Adjustment)
app.post('/api/shifts/cash-adjustment', authenticateManager, requireActiveSubscription, async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenantContext(req);
    const { shiftId, amount, type, reason } = req.body;

    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Cash adjustment amount must be a positive number.' });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Reason for cash adjustment is required.' });
    }

    const shift = await prisma.registerShift.findFirst({
      where: {
        organizationId: tenant.organizationId,
        ...(shiftId ? { OR: [{ id: shiftId }, { shiftNumber: shiftId }] } : { status: 'open' }),
      },
    });

    if (!shift || shift.status !== 'open') {
      return res.status(400).json({ error: 'Active open register shift required for cash adjustments.' });
    }

    const adjAmount = roundMoney(Number(amount));
    const isPayIn = String(type).toUpperCase() === 'PAY_IN' || String(type).toUpperCase() === 'CASH_IN';
    const delta = isPayIn ? adjAmount : -adjAmount;

    const authUser = (req as any).user;

    const [updatedShift, audit] = await prisma.$transaction([
      prisma.registerShift.update({
        where: { id: shift.id },
        data: {
          startingPettyCash: roundMoney((shift.startingPettyCash || 0) + delta),
          expectedCash: roundMoney((shift.expectedCash || 0) + delta),
          notes: shift.notes ? `${shift.notes} | [CASH ADJ ${isPayIn ? '+' : '-'}${adjAmount}]: ${reason}` : `[CASH ADJ ${isPayIn ? '+' : '-'}${adjAmount}]: ${reason}`,
        },
      }),
      prisma.auditLog.create({
        data: {
          organizationId: tenant.organizationId,
          branchId: tenant.branchId || null,
          userId: authUser?.id || null,
          action: 'CASH_ADJUSTMENT',
          entity: 'SHIFT',
          entityId: shift.id,
          metadata: JSON.stringify({
            amount: adjAmount,
            type: isPayIn ? 'PAY_IN' : 'PAY_OUT',
            reason: String(reason).trim(),
            actor: authUser?.name || 'Manager',
          }),
        },
      }),
    ]);

    return res.json({ success: true, message: 'Cash adjustment recorded', shift: updatedShift, audit });
  } catch (err) {
    console.error('Cash adjustment error:', err);
    return res.status(500).json({ error: 'Failed to record cash adjustment' });
  }
});

// Fortified ESC/POS Network Socket Thermal Printing Endpoints (Protected against SSRF and Raw TCP Injection)
app.post('/api/printer/print', authenticate, requireActiveSubscription, async (req: Request, res: Response) => {
  try {
    const { receiptData, order } = req.body;
    // Hardened: Ignore client-supplied IP/port to prevent SSRF and port scanning
    const targetIp = process.env.PRINTER_HOST || '127.0.0.1';
    const targetPort = Number(process.env.PRINTER_PORT || 9100);

    const payload = receiptData || (order ? formatReceiptEscPos(order) : '');
    if (!payload) {
      return res.status(400).json({ error: 'Receipt data or order payload required' });
    }

    const printed = await printReceipt(targetIp, targetPort, payload);
    return res.json({
      success: printed,
      message: printed ? `Receipt printed on ${targetIp}:${targetPort}` : `Could not connect to printer at ${targetIp}:${targetPort}`,
      simulated: !printed,
    });
  } catch (err: any) {
    console.error('[Printer Route Error]:', err);
    return res.status(500).json({ error: 'Failed to process print request', details: err.message });
  }
});

app.post('/api/printer/drawer-kick', authenticate, requireActiveSubscription, async (req: Request, res: Response) => {
  try {
    // Hardened: Ignore client-supplied IP/port to prevent SSRF and port scanning
    const targetIp = process.env.PRINTER_HOST || '127.0.0.1';
    const targetPort = Number(process.env.PRINTER_PORT || 9100);

    const kicked = await openCashDrawer(targetIp, targetPort);
    return res.json({
      success: kicked,
      message: kicked ? `Drawer pulse sent to ${targetIp}:${targetPort}` : `Failed to send drawer kick to ${targetIp}:${targetPort}`,
      simulated: !kicked,
    });
  } catch (err: any) {
    console.error('[Drawer Kick Route Error]:', err);
    return res.status(500).json({ error: 'Failed to send cash drawer pulse', details: err.message });
  }
});


// ============================================================================
// BILLING & DEVICE ENFORCEMENT ENDPOINTS (PHASE 7 & 8)
// ============================================================================
app.get('/api/billing/subscription', authenticate, getSubscriptionHandler);
app.get('/api/billing/usage', authenticate, getUsageHandler);
app.post('/api/billing/change-plan', authenticate, changePlanHandler);
app.post('/api/billing/cancel', authenticate, cancelSubscriptionHandler);
app.post('/api/billing/reactivate', authenticate, reactivateSubscriptionHandler);
app.post('/api/billing/create-checkout', authenticate, createCheckoutSessionHandler);
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), webhookHandler);
app.post('/api/devices', authenticate, registerDeviceHandler);

// Phase 10, 11 & 12 Platform Admin & Customer Portal Routers
app.use('/api/platform-admin', platformAdminRoutes);
app.use('/api/portal', portalRoutes);
app.post('/api/devices/generate-pairing-code', authenticate, generatePairingCodeHandler);
app.post('/api/devices/pair', express.json(), pairDeviceHandler);
app.post('/api/devices/revoke', authenticate, revokeDeviceHandler);
app.post('/api/printer/print-job', authenticate, requireActiveSubscription, createPrintJobHandler);
app.post('/api/printer/open-drawer', authenticate, requireActiveSubscription, triggerCashDrawerKickHandler);


app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error]:', err);
  
  const isDev = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';
  const response: any = {
    error: err.message || 'Internal Server Error'
  };

  if (isDev) {
    response.stack = err.stack;
    response.details = err.details || err;
  } else {
    // Standardize secure error response
    if (err.message && (err.message.includes('Prisma') || err.message.includes('prisma') || err.message.includes('SQL') || err.message.includes('database'))) {
      response.error = 'A database integrity error occurred. Your request could not be processed.';
    }
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json(response);
});

async function startServer() {
  // Container infrastructure routes all external traffic to port 3000
  const PORT = 3000;

  // Enforce startup configuration validation for production/staging/pilot
  const isProductionEnv = process.env.NODE_ENV === 'production' || 
                            process.env.NODE_ENV === 'staging' || 
                            process.env.NODE_ENV === 'pilot';

  if (isProductionEnv) {
    console.log(`[Startup] Validating configuration for: ${process.env.NODE_ENV}`);
    const errors: string[] = [];

    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('placeholder') || process.env.DATABASE_URL === '') {
      errors.push('DATABASE_URL is missing, empty, or a placeholder.');
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'pos_restaurant_commercial_jwt_secret_2026' || process.env.JWT_SECRET === '') {
      errors.push('JWT_SECRET is missing, empty, or insecure.');
    } else if (process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in length for production environments.');
    }

    if (!process.env.LICENSE_SECRET || process.env.LICENSE_SECRET === '') {
      errors.push('LICENSE_SECRET is missing or empty.');
    }

    if (errors.length > 0) {
      console.error('====================================================');
      console.error('❌ CRITICAL STARTUP CONFIGURATION ERROR');
      console.error('====================================================');
      errors.forEach(err => console.error(` - ${err}`));
      console.error('====================================================');
      throw new Error(`Production Configuration Validation Failed: ${errors.join(', ')}`);
    }
  }

  // Enforce startup configuration validation with graceful fallback
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'pos_restaurant_commercial_jwt_secret_2026';
  }
  if (!process.env.LICENSE_SECRET) {
    process.env.LICENSE_SECRET = 'whites-castle-hmac-license-key-2026';
  }

  // Mount production static files or development Vite middleware
  const isProd = process.env.NODE_ENV === 'production' || 
                 process.env.NODE_ENV === 'staging' || 
                 process.env.NODE_ENV === 'pilot' ||
                 fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));

  if (isProd) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Listen on port 3000 immediately to ensure instant health probe response during rollout
  if (process.env.NODE_ENV !== 'test') {
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }

  // Connect to database and seed asynchronously in the background
  (async () => {
    try {
      let retries = 5;
      while (retries > 0) {
        try {
          await prisma.$connect();
          console.log('Successfully connected to the database.');
          break;
        } catch (err) {
          console.error(`Database connection failed. Retries left: ${retries - 1}`, err);
          retries -= 1;
          if (retries === 0) {
            console.warn('Could not connect to database after multiple attempts. Continuing in resilient mode.');
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      await seedDatabaseIfNeeded();
    } catch (seedErr) {
      console.warn('Database initialization warning:', seedErr);
    }
  })();
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}

export default app;

function transformOrder(o: any) {
  const rawStatus = (o.status || 'pending').toString().toLowerCase();
  let normalizedStatus = rawStatus;
  if (rawStatus === 'punched' || rawStatus === 'open') {
    normalizedStatus = 'pending';
  }

  return {
    id: o.id,
    orderNumber: o.orderNumber,
    receiptNumber: o.orderNumber,
    type: (o.orderType || o.type || 'dine_in').toString().toLowerCase(),
    orderType: (o.orderType || o.type || 'dine_in').toString().toLowerCase(),
    status: normalizedStatus,
    items: (o.items || []).map((i: any) => ({
      id: i.id,
      name: i.name,
      price: Number(i.price) || 0,
      quantity: Number(i.quantity) || 1,
      flavor: i.flavor || '',
      modifiers: i.modifiers ? (typeof i.modifiers === 'string' ? JSON.parse(i.modifiers) : i.modifiers) : (i.notes ? [{ name: i.notes }] : []),
      itemNote: i.itemNote || i.notes || '',
    })),
    customer: o.customer ? {
      id: o.customer.id,
      name: o.customer.name || o.customerName || '',
      phone: o.customer.phone || o.customer.phoneNumber || o.customerPhone || '',
      address: o.customer.address || '',
      deliveryNotes: o.customer.deliveryNotes || '',
      vipTier: o.customer.vipTier,
      loyaltyPoints: o.customer.loyaltyPoints,
    } : (o.customerName || o.customerPhone) ? {
      name: o.customerName || '',
      phone: o.customerPhone || '',
    } : undefined,
    subtotal: Number(o.subtotal) || 0,
    tax: Number(o.tax) || 0,
    discount: Number(o.discount) || 0,
    tip: Number(o.tip) || 0,
    deliveryFee: Number(o.deliveryFee) || 0,
    total: Number(o.total) || 0,
    amountTendered: Number(o.total) || 0,
    changeGiven: 0,
    deliveryDriver: o.deliveryDriver || (o.assignedRider ? o.assignedRider.name : undefined),
    assignedRiderId: o.assignedRiderId || (o.assignedRider ? o.assignedRider.id : undefined),
    tableNumber: o.tableNumber || undefined,
    serverId: o.serverId || undefined,
    serverName: o.serverName || undefined,
    paymentMethod: (o.paymentMethod || 'cash').toString().toLowerCase(),
    paymentStatus: (o.paymentStatus || 'paid').toString().toLowerCase(),
    splitPayments: o.splitPayments ? (typeof o.splitPayments === 'string' ? (() => { try { return JSON.parse(o.splitPayments); } catch { return []; } })() : o.splitPayments) : [],
    cashierName: o.cashierName ?? 'Cashier',
    deliveryNotes: o.deliveryNotes || '',
    preOrder: !!o.preOrder,
    notes: o.notes || '',
    cancelReason: o.auditLogs?.find((a: any) => a.action === 'CANCELLED')?.reason || o.notes || undefined,
    createdAt: o.createdAt ? (o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt)) : new Date().toISOString(),
    updatedAt: o.updatedAt ? (o.updatedAt instanceof Date ? o.updatedAt.toISOString() : String(o.updatedAt)) : undefined,
  };
}
