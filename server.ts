import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import prisma from './src/server/prisma';
import { seedDatabaseIfNeeded } from './src/server/seed';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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
import { roundToCurrency } from './src/utils/financial';

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

const appDir = process.cwd();

const app = express();

const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
app.set('io', io);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// --- Phase 2: Backend Hardening & Security ---
// Inject production security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Vite requires inline scripts during dev, and keeping it simple for now
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Enable trust proxy for rate limiting behind reverse proxies (like Cloud Run)
app.set('trust proxy', 1);

// Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Sufficient for high-volume POS workstation operations while preventing brute force
  message: { error: true, message: 'Too many auth attempts, please try again later.' }
});

// Apply rate limiting to login and license validation routes (if any)
app.use('/api/auth', authLimiter);
app.use('/api/license', authLimiter);

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

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: { error: true, message: 'Too many requests, please try again later.' }
});
app.use('/api', apiLimiter);

// Login route for JWT generation (mounted AFTER express.json() & authLimiter)
app.post('/api/auth/login', async (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN or Password required' });
  
  const rawPin = String(pin).trim();
  const users = await prisma.user.findMany({ where: { active: true } });
  let matchedUser = null;

  for (const u of users) {
    const isMatch = u.pin.startsWith('$2')
      ? await bcrypt.compare(rawPin, u.pin)
      : rawPin === u.pin;
    if (isMatch) {
      matchedUser = u;
      break;
    }
  }

  if (!matchedUser) return res.status(401).json({ error: 'Invalid Password or PIN' });
  
  const jwtSecret = process.env.JWT_SECRET || 'secure_fallback';
  const token = jwt.sign(
    { id: matchedUser.id, role: matchedUser.role, name: matchedUser.name },
    jwtSecret,
    { expiresIn: '12h' }
  );
  
  const { pin: _scrubbedPin, ...safeUser } = matchedUser;
  return res.json({ token, user: safeUser });
});

app.post('/api/auth/validate-session', async (req, res) => {
  try {
    const { userId, pin, token } = req.body;
    if (!userId) {
      return res.status(400).json({ valid: false, error: 'User ID is required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) {
      return res.json({ valid: false, reason: 'User not found or inactive' });
    }

    if (token && token !== 'null' && token !== 'undefined') {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secure_fallback') as any;
        if (decoded.id !== userId) {
          return res.json({ valid: false, reason: 'Token user ID mismatch' });
        }
      } catch (err) {
        return res.json({ valid: false, reason: 'Invalid or expired token' });
      }
    }

    if (pin) {
      const rawPin = String(pin).trim();
      const isMatch = user.pin.startsWith('$2')
        ? await bcrypt.compare(rawPin, user.pin)
        : rawPin === user.pin;
      if (!isMatch) {
        return res.json({ valid: false, reason: 'Password updated' });
      }
    }

    return res.json({ valid: true });
  } catch (error) {
    console.error('[validate-session] Error:', error);
    return res.status(500).json({ valid: false, error: 'Internal server error during session validation' });
  }
});

export const authenticateManager = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ error: 'Server authentication configuration missing' });
    }

    // Path A: Bearer JWT validation
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (token) {
      const decoded = jwt.verify(token, jwtSecret) as { id: string; role: string };
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true, active: true, name: true }
      });

      if (dbUser && dbUser.active && ['OWNER', 'MANAGER', 'ADMIN'].includes(dbUser.role.toUpperCase())) {
        (req as any).user = dbUser;
        return next();
      }
    }

    // Path B: Manager PIN override header
    const managerPin = req.headers['x-manager-pin'];
    if (typeof managerPin === 'string' && managerPin.trim().length >= 4) {
      const activeManagers = await prisma.user.findMany({
        where: {
          role: { in: ['OWNER', 'MANAGER', 'ADMIN', 'owner', 'manager', 'admin'] },
          active: true
        }
      });

      for (const mgr of activeManagers) {
        const isMatch = mgr.pin.startsWith('$2') 
          ? await bcrypt.compare(managerPin.trim(), mgr.pin)
          : managerPin.trim() === mgr.pin;

        if (isMatch) {
          (req as any).user = { id: mgr.id, role: mgr.role, name: mgr.name };
          return next();
        }
      }
    }

    return res.status(403).json({ error: 'Forbidden: Elevated manager credentials required' });
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired authorization' });
  }
};

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// User Management (Admin RBAC)
app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        active: true,
        restrictions: true,
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
app.post('/api/users', authenticateManager, addUser);
app.patch('/api/users/:id', authenticateManager, updateUser);
app.delete('/api/users/:id', authenticateManager, deleteUser);

// Outlets / Branches Management
app.get('/api/outlets', async (req, res) => {
  try {
    const outlets = await prisma.outlet.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(outlets.map(o => o.name));
  } catch (error) {
    console.error('[Prisma] Get outlets error:', error);
    return res.json(['Gulberg Branch', 'DHA Phase 5', 'F-7 Islamabad', 'Mall of Lahore']);
  }
});

app.post('/api/outlets', async (req, res) => {
  try {
    const { name, address, phone } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Outlet name is required' });
    }
    const created = await prisma.outlet.create({
      data: {
        name: name.trim(),
        address: address || '',
        phone: phone || '',
        active: true,
      },
    });
    return res.json({ success: true, outlet: created });
  } catch (error) {
    console.error('[Prisma] Create outlet error:', error);
    return res.status(500).json({ error: 'Failed to create outlet' });
  }
});

app.delete('/api/outlets/:name', async (req, res) => {
  try {
    const nameParam = decodeURIComponent(req.params.name);
    await prisma.outlet.deleteMany({
      where: {
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

// Menu Catalog Management
app.post('/api/menu-items', authenticateManager, addMenuItem);
app.patch('/api/menu-items/:id', authenticateManager, updateMenuItem);
app.put('/api/menu-items/:id', authenticateManager, updateMenuItem);
app.delete('/api/menu-items/:id', authenticateManager, deleteMenuItem);
app.delete('/api/menu-items/:itemId', authenticateManager, deleteMenuItem);

// Upload / Process Menu Image
app.post('/api/upload-image', authenticateManager, async (req: Request, res: Response) => {
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
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { active: true },
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
app.get('/api/tables', async (req, res) => {
  try {
    const tables = await prisma.table.findMany({
      where: { active: true },
      orderBy: { number: 'asc' },
    });
    return res.json(tables);
  } catch (error) {
    console.error('[Prisma] Get tables error:', error);
    return res.json([]);
  }
});

app.post('/api/tables', authenticateManager, async (req, res) => {
  try {
    const { number, capacity } = req.body;
    const table = await prisma.table.create({
      data: {
        number: String(number),
        capacity: Number(capacity) || 4,
        status: 'AVAILABLE',
        active: true,
      },
    });
    io.emit('tablesUpdated');
    return res.status(201).json(table);
  } catch (error: any) {
    console.error('[Prisma] Add table error:', error);
    return res.status(500).json({ error: 'Failed to add table' });
  }
});

app.delete('/api/tables/:id', authenticateManager, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.table.update({
      where: { id },
      data: { active: false },
    });
    io.emit('tablesUpdated');
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Prisma] Delete table error:', error);
    return res.status(500).json({ error: 'Failed to delete table' });
  }
});

app.post('/api/categories', authenticateManager, async (req, res) => {
  try {
    const { name, title } = req.body;
    const categoryTitle = (name || title || '').trim();
    if (!categoryTitle) {
      return res.status(400).json({ error: 'Category title is required.' });
    }
    const slug = categoryTitle.toLowerCase().replace(/\s+/g, '-');
    const category = await prisma.category.upsert({
      where: { slug },
      update: { title: categoryTitle, active: true },
      create: { title: categoryTitle, slug, active: true },
    });
    io.emit('categoriesUpdated');
    return res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    console.error('[Prisma] Add category error:', error);
    return res.status(500).json({ error: 'Failed to create category.' });
  }
});

app.patch('/api/categories/:id', authenticateManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, title } = req.body;
    const categoryTitle = (name || title || '').trim();
    if (!categoryTitle) {
      return res.status(400).json({ error: 'Category title is required.' });
    }
    const slug = categoryTitle.toLowerCase().replace(/\s+/g, '-');
    const updated = await prisma.category.update({
      where: { id },
      data: { title: categoryTitle, slug },
    });
    io.emit('categoriesUpdated');
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[Prisma] Update category error:', error);
    return res.status(500).json({ error: 'Failed to update category.' });
  }
});

app.delete('/api/categories/:id', authenticateManager, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.category.update({
      where: { id },
      data: { active: false },
    });
    io.emit('categoriesUpdated');
    return res.json({ success: true, message: 'Category deactivated.' });
  } catch (error: any) {
    console.error('[Prisma] Delete category error:', error);
    return res.status(500).json({ error: 'Failed to delete category.' });
  }
});

// Dynamic menu items (from PostgreSQL Prisma DB)
app.get('/api/menu', async (req, res) => {
  try {
    const onlyActive = req.query.onlyActive === 'true';
    const items = await prisma.menuItem.findMany({
      where: onlyActive ? { active: true } : undefined,
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(items);
  } catch (error) {
    console.error('[Prisma] Get menu error:', error);
    return res.json([]);
  }
});

app.get('/api/menu-items', async (req, res) => {
  try {
    const items = await prisma.menuItem.findMany({
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
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
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
app.get('/api/customers/:phone', async (req, res) => {
  try {
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
        OR: searchConditions,
      },
      include: {
        orders: {
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
app.get('/api/customers/lookup', async (req, res) => {
  try {
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
        OR: searchConditions,
      },
      include: {
        orders: {
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
app.post('/api/customers/upsert', async (req, res) => {
  try {
    const { name, phone, email, address, deliveryNotes, notes } = req.body;
    const cleanPhone = String(phone || '').trim().replace(/\D/g, '');
    if (!cleanPhone) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }

    const existing = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          { phoneNumber: cleanPhone },
          { phone: phone },
          ...(cleanPhone.length >= 10 ? [{ phone: { contains: cleanPhone } }] : []),
        ],
      },
    });

    if (existing) {
      const updated = await prisma.customer.update({
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
      return res.json({ customer: updated });
    }

    const created = await prisma.customer.create({
      data: {
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

    return res.json({ customer: created });
  } catch (err) {
    console.error('Customer upsert error:', err);
    return res.status(500).json({ error: 'Failed to upsert customer' });
  }
});

// Block Customer API (Requires reason and Manager/Owner privilege)
app.post('/api/customers/block', authenticateManager, async (req, res) => {
  try {
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
      where: { OR: searchConditions },
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
      io.emit('customer:blocked', { phone: cleanPhone, customer });
    }

    return res.json({ success: true, customer });
  } catch (err) {
    console.error('Customer block error:', err);
    return res.status(500).json({ error: 'Failed to block customer' });
  }
});

// Unblock Customer API (Requires Manager/Owner privilege)
app.post('/api/customers/unblock', authenticateManager, async (req, res) => {
  try {
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
      where: { OR: searchConditions },
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
      io.emit('customer:unblocked', { phone: cleanPhone, customer });
    }

    return res.json({ success: true, customer });
  } catch (err) {
    console.error('Customer unblock error:', err);
    return res.status(500).json({ error: 'Failed to unblock customer' });
  }
});

// Get orders history
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      take: 500, // Security & Scalability: limit unbounded query
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

// Create new order
app.post('/api/orders', validateRequest(OrderPunchSchema), async (req: Request, res: Response) => {
  try {
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

    const idempotencyKey = (req.headers['idempotency-key'] as string) || clientOrderNum;

    if (idempotencyKey) {
      const existingOrder = await prisma.order.findFirst({
        where: { orderNumber: String(idempotencyKey) },
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

    const orderNumber = idempotencyKey ? String(idempotencyKey) : `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item.' });
    }
    for (const item of items) {
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        return res.status(400).json({ error: 'Invalid item quantity.' });
      }
      if (typeof item.price !== 'number' || item.price < 0) {
        return res.status(400).json({ error: 'Invalid item price.' });
      }
    }
    if (typeof total !== 'number' || total < 0 || typeof subtotal !== 'number' || subtotal < 0) {
      return res.status(400).json({ error: 'Invalid order totals.' });
    }

    const calculatedSubtotal = roundToCurrency(items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0));
    const finalTotal = roundToCurrency(calculatedSubtotal + (tax || 0) + (deliveryFee || 0) + (tip || 0) - (discount || 0));

    let customerId: string | undefined = undefined;

    // Use a Prisma interactive transaction to ensure customer updates and order creation are atomic
    const result = await prisma.$transaction(async (tx) => {
      if (customer && customer.phone) {
        const cleanPhone = String(customer.phone).trim();
        const upsertedCustomer = await tx.customer.upsert({
          where: { phone: cleanPhone },
          update: {
            totalVisits: { increment: 1 },
            totalSpent: { increment: finalTotal || 0 },
            loyaltyPoints: { increment: Math.floor((finalTotal || 0) / 100) },
            name: customer.name && customer.name !== 'Guest' ? customer.name : undefined,
            address: customer.address || undefined,
          },
          create: {
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
        customerId = upsertedCustomer.id;
      }

      let resolvedDriverName = deliveryDriver;
      let resolvedRiderId = assignedRiderId;
      if (deliveryDriver && !assignedRiderId) {
        const matchedUser = await tx.user.findFirst({
          where: { OR: [{ id: deliveryDriver }, { name: deliveryDriver }] },
        });
        if (matchedUser) {
          resolvedRiderId = matchedUser.id;
          resolvedDriverName = matchedUser.name;
        }
      }

      const itemIdsToCheck = (items || []).map((i: any) => i.menuItemId || i.id).filter(Boolean);
      const existingMenuItems = await tx.menuItem.findMany({
        where: { id: { in: itemIdsToCheck } },
        select: { id: true },
      });
      const validMenuItemIds = new Set(existingMenuItems.map((m) => m.id));

      const order = await tx.order.create({
        data: {
          orderNumber,
          orderType: orderType || type || 'takeaway',
          status: 'PUNCHED',
          paymentMethod: (paymentMethod || 'cash').toUpperCase(),
          paymentStatus: (paymentStatus || 'paid').toUpperCase(),
          splitPayments: Array.isArray(splitPayments)
            ? JSON.stringify(splitPayments)
            : (typeof splitPayments === 'string' ? splitPayments : '[]'),
          subtotal: roundToCurrency(subtotal !== undefined ? subtotal : calculatedSubtotal),
          tax: roundToCurrency(tax || 0),
          discount: roundToCurrency(discount || 0),
          tip: roundToCurrency(tip || 0),
          deliveryFee: roundToCurrency(deliveryFee || 0),
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
            create: (items || []).map((item: any) => {
              const targetId = item.menuItemId || (item.id && !item.id.startsWith('cart-') ? item.id : null);
              return {
                menuItemId: targetId && validMenuItemIds.has(targetId) ? targetId : null,
                name: item.name,
                price: item.price,
                quantity: item.quantity || 1,
                flavor: item.flavor || '',
                itemNote: item.itemNote || '',
                notes: item.itemNote || '',
                modifiers: JSON.stringify(item.modifiers || []),
              };
            }),
          },
        },
        include: {
          customer: true,
          items: true,
          assignedRider: true,
        },
      });

      return order;
    });

    const transformedOrder = transformOrder(result);
    const io = req.app.get('io');
    if (io) {
      io.emit('orderCreated', transformedOrder);
    }
    return res.json(transformedOrder);
  } catch (error) {
    console.error('[Prisma] Create order error:', error);
    return res.status(500).json({ error: 'Failed to create order' });
  }
});

// Update Order Status (e.g. PUNCHED -> in_kitchen -> ready -> dispatched -> completed)
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const { status, riderId, paymentStatus, paymentMethod, splitPayments } = req.body;
    const orderId = req.params.id;

    const existing = await prisma.order.findFirst({
      where: {
        OR: [{ id: orderId }, { orderNumber: orderId }],
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const dataToUpdate: any = { status };
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
        where: { OR: [{ id: riderId }, { username: riderId }, { name: riderId }] },
      });
      if (user) {
        dataToUpdate.assignedRiderId = user.id;
        dataToUpdate.deliveryDriver = user.name;
      } else {
        dataToUpdate.deliveryDriver = riderId;
      }
    }

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: dataToUpdate,
      include: {
        customer: true,
        items: true,
        assignedRider: true,
        auditLogs: true,
      },
    });
    
    const updatedOrder = transformOrder(updated);
    const io = req.app.get('io');
    if (io) {
      io.emit('orderUpdated', updatedOrder);
    }
    return res.json({ success: true, order: updatedOrder });
  } catch (err) {
    console.error('Update status error:', err);
    return res.status(500).json({ error: 'Failed to update status' });
  }
});

// Manager Cancel Order with Audit Log
app.post('/api/orders/:id/cancel', authenticateManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, managerId, managerName } = req.body;
    
    // Extract actual authorizing manager from JWT
    const authUser = (req as any).user;
    const actualManagerId = authUser?.id || managerId;
    const actualManagerName = authUser?.name || managerName || 'Manager';

    const existing = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
      },
      include: { items: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Order not found' });
    }

    let resolvedUserId: string | null = null;
    if (actualManagerId) {
      const matchedUser = await prisma.user.findFirst({
        where: {
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
      io.emit('orderUpdated', updatedOrder);
    }
    return res.json({ success: true, order: updatedOrder });
  } catch (err) {
    console.error('Cancel order error:', err);
    return res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// Manager Modify Order with Audit Log
app.post('/api/orders/:id/modify', authenticateManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { items, subtotal, tax, total, notes, reason, managerId, managerName, status, paymentStatus, paymentMethod, type, tableNumber, deliveryDriver, customer, deliveryFee, tip, discount } = req.body;

    // Extract actual authorizing manager from JWT
    const authUser = (req as any).user;
    const actualManagerId = authUser?.id || managerId;
    const actualManagerName = authUser?.name || managerName || 'Manager';

    const existing = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
      },
      include: { items: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Order not found' });
    }

    let resolvedUserId: string | null = null;
    if (actualManagerId) {
      const matchedUser = await prisma.user.findFirst({
        where: {
          OR: [{ id: actualManagerId }, { username: actualManagerId }, { name: actualManagerId }],
        },
      });
      if (matchedUser) {
        resolvedUserId = matchedUser.id;
      }
    }

    // Delete existing items and recreate updated items
    await prisma.orderItem.deleteMany({ where: { orderId: existing.id } });

    const calculatedSubtotal = roundToCurrency(items ? items.reduce((sum: number, item: any) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0) : existing.subtotal);
    const finalTax = roundToCurrency(tax !== undefined ? Number(tax) : (existing.tax || 0));
    const finalDeliveryFee = roundToCurrency(deliveryFee !== undefined ? Number(deliveryFee) : (existing.deliveryFee || 0));
    const finalTip = roundToCurrency(tip !== undefined ? Number(tip) : (existing.tip || 0));
    const finalDiscount = roundToCurrency(discount !== undefined ? Number(discount) : (existing.discount || 0));
    const finalTotal = roundToCurrency(calculatedSubtotal + finalTax + finalDeliveryFee + finalTip - finalDiscount);

    const updated = await prisma.order.update({
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
        subtotal: calculatedSubtotal,
        tax: finalTax,
        deliveryFee: finalDeliveryFee,
        tip: finalTip,
        discount: finalDiscount,
        total: finalTotal,
        totalAmount: finalTotal,
        notes: notes !== undefined ? notes : existing.notes,
        modifiedById: resolvedUserId,
        items: {
          create: (items || []).map((i: any) => ({
            menuItemId: i.menuItemId || null,
            name: i.name,
            price: Number(i.price) || 0,
            quantity: Number(i.quantity) || 1,
            flavor: i.flavor || '',
            itemNote: i.itemNote || '',
            notes: i.itemNote || '',
            modifiers: JSON.stringify(i.modifiers || []),
          })),
        },
        auditLogs: {
          create: {
            action: 'MODIFIED',
            reason: reason || 'Manager item update/quantity change',
            performedById: resolvedUserId,
            managerName: actualManagerName,
            previousData: JSON.stringify(existing),
            newData: JSON.stringify({ subtotal, tax, total, items, notes }),
          },
        },
      },
      include: { items: true, auditLogs: true, customer: true, assignedRider: true },
    });

    const updatedOrder = transformOrder(updated);
    const io = req.app.get('io');
    if (io) {
      io.emit('orderUpdated', updatedOrder);
    }
    return res.json({ success: true, order: updatedOrder });
  } catch (err) {
    console.error('Modify order error:', err);
    return res.status(500).json({ error: 'Failed to modify order' });
  }
});

// Sales Adjustments & Manager Audit Log History
app.get('/api/sales-adjustments', async (req, res) => {
  try {
    const logs = await prisma.orderAuditLog.findMany({
      include: {
        order: {
          select: { orderNumber: true, total: true, subtotal: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
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
app.get('/api/shifts', async (req, res) => {
  try {
    const shifts = await prisma.shiftAudit.findMany({
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
app.get('/api/shifts/current', async (req, res) => {
  try {
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

    // Fallback to latest open register shift
    const openShift = await prisma.registerShift.findFirst({
      where: { status: 'open' },
      orderBy: { openedAt: 'desc' },
    });
    return res.json({ shift: openShift });
  } catch (error) {
    console.error('[Prisma] Get current shift error:', error);
    return res.status(500).json({ error: 'Failed to retrieve current shift' });
  }
});

// Open Shift
app.post('/api/shifts/open', async (req, res) => {
  try {
    const { shiftNumber, cashierName, startingFloat, notes, openedById } = req.body;
    const sNumber = shiftNumber || `SH-${Math.floor(1000 + Math.random() * 9000)}`;
    const floatVal = Number(startingFloat) || 0;

    const shift = await prisma.registerShift.create({
      data: {
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
app.post('/api/shifts/close', validateRequest(ShiftCloseSchema), async (req: Request, res: Response) => {
  try {
    const { shiftId, actualCash, floatRetained, denominationBreakdown, notes } = req.body;
    if (!shiftId) return res.status(400).json({ error: 'Shift ID required' });

    const shift = await prisma.registerShift.findFirst({
      where: { OR: [{ id: shiftId }, { shiftNumber: shiftId }], status: 'open' },
    });
    if (!shift) return res.status(404).json({ error: 'Active open shift not found' });

    const closeTime = new Date();
    const shiftOrders = await prisma.order.findMany({
      where: { createdAt: { gte: shift.openedAt, lte: closeTime }, status: { notIn: ['CANCELLED', 'cancelled'] } },
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

    const startingFloat = Number(shift.startingFloat) || 0;
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

    const [closedShift, auditRecord] = await prisma.$transaction([
      prisma.registerShift.update({ where: { id: shift.id }, data: shiftUpdateData }),
      prisma.shiftAudit.create({ data: { shiftId: shift.id, cashierName: shift.cashierName, startTime: shift.openedAt, endTime: closeTime, startingPettyCash: startingFloat, ...shiftUpdateData } }),
    ]);

    return res.json({ success: true, message: 'Shift closed', shift: closedShift, audit: auditRecord });
  } catch (err) {
    console.error('Close shift error:', err);
    return res.status(500).json({ error: 'Server error during shift reconciliation' });
  }
});

// ESC/POS Network Socket Thermal Printing Endpoints
app.post('/api/printer/print', async (req: Request, res: Response) => {
  try {
    const { printerIp, printerPort, receiptData, order } = req.body;
    const targetIp = printerIp || process.env.PRINTER_IP || '192.168.1.200';
    const targetPort = Number(printerPort || process.env.PRINTER_PORT || 9100);

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

app.post('/api/printer/drawer-kick', async (req: Request, res: Response) => {
  try {
    const { printerIp, printerPort } = req.body;
    const targetIp = printerIp || process.env.PRINTER_IP || '192.168.1.200';
    const targetPort = Number(printerPort || process.env.PRINTER_PORT || 9100);

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



app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: true, message: 'Internal Server Error' });
});

async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Enforce startup configuration validation
  const isProd = process.env.NODE_ENV === 'production';
  const missingSecrets: string[] = [];

  if (!process.env.DATABASE_URL) missingSecrets.push('DATABASE_URL');
  if (!process.env.JWT_SECRET) missingSecrets.push('JWT_SECRET');
  if (!process.env.LICENSE_SECRET) missingSecrets.push('LICENSE_SECRET');

  if (missingSecrets.length > 0) {
    if (isProd) {
      const errorMsg = `CONFIGURATION WARNING: Missing required environment secrets: ${missingSecrets.join(', ')}. Please configure them in your settings/environment.`;
      console.error('⚠️ ' + errorMsg);
      
      // Inject fallback middleware to avoid container crashes and provide clear guidance to users
      app.use((req, res, next) => {
        if (req.path === '/health' || req.path === '/api/health') {
          return res.status(200).json({ status: 'unconfigured', missing: missingSecrets });
        }
        res.status(503).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Configuration Required | POS Restaurant</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f9fafb; color: #1f2937; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); max-width: 500px; text-align: center; border: 1px solid #e5e7eb; }
              h1 { color: #dc2626; font-size: 1.5rem; margin-top: 0; }
              p { line-height: 1.6; color: #4b5563; }
              .badge { background: #fee2e2; color: #991b1b; padding: 0.35rem 0.65rem; border-radius: 6px; font-family: monospace; font-size: 0.875rem; margin: 0.25rem; display: inline-block; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>⚠️ Configuration Required</h1>
              <p>The POS Restaurant Server started successfully, but is missing required configuration secrets:</p>
              <div style="margin: 1.5rem 0;">
                ${missingSecrets.map(s => `<span class="badge">${s}</span>`).join('')}
              </div>
              <p style="margin-top: 1.5rem; font-size: 0.875rem;">Please configure these environment variables in your control panel/settings to complete the setup.</p>
            </div>
          </body>
          </html>
        `);
      });
    } else {
      console.log(`[Status] POS starting with dynamic auto-start credentials for: ${missingSecrets.join(', ')}.`);
    }
  } else {
    console.log('✓ All environment secrets verified.');
  }

  // Connect to database and seed ONLY if fully configured or not in production
  if (missingSecrets.length === 0 || !isProd) {
    // Add retry loop for Prisma connection to handle DB container startup delay
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
          console.error('Could not connect to database after multiple attempts. Exiting.');
          process.exit(1);
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    await seedDatabaseIfNeeded();
  }

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(appDir, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(appDir, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { port: 24678 }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

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
