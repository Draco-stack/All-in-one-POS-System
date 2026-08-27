import { prisma } from './prisma';
import { CustomerUpsertSchema } from './validators';
import { INITIAL_CUSTOMERS } from '../data/mockData';
import { Customer, Order } from '../types';

// In-Memory Fallback Cache to ensure 100% uptime even during DB connection drops
const memoryCustomers: Map<string, any> = new Map();

// Initialize in-memory cache with initial customers
INITIAL_CUSTOMERS.forEach((c) => {
  const clean = c.phone.replace(/\D/g, '');
  memoryCustomers.set(clean, {
    id: c.id,
    phoneNumber: c.phone,
    name: c.name,
    email: c.email || null,
    address: c.address || '',
    deliveryNotes: c.deliveryNotes || '',
    vipTier: c.vipTier || 'Regular',
    loyaltyPoints: c.loyaltyPoints || 50,
    totalVisits: c.totalOrdersCount || 1,
    totalSpent: c.totalSpent || 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

/**
 * Seed initial customers into Prisma database on server boot
 */
export async function seedPrismaCustomers() {
  try {
    for (const c of INITIAL_CUSTOMERS) {
      const cleanPhone = c.phone.trim();
      await prisma.customer.upsert({
        where: { phone: cleanPhone },
        update: {
          phoneNumber: cleanPhone,
          name: c.name,
          address: c.address || '',
          deliveryNotes: c.deliveryNotes || '',
        },
        create: {
          id: c.id,
          phone: cleanPhone,
          phoneNumber: cleanPhone,
          name: c.name,
          email: c.email || null,
          address: c.address || '',
          deliveryNotes: c.deliveryNotes || '',
          vipTier: c.vipTier || 'Regular',
          loyaltyPoints: c.loyaltyPoints || 50,
          totalVisits: c.totalOrdersCount || 1,
          totalSpent: c.totalSpent || 0,
        },
      });
    }
  } catch (err) {
    console.warn('[Prisma] Customer database seed using memory sync:', err);
  }
}

/**
 * Normalizes phone numbers for indexing and search consistency
 */
export function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return '';
  return rawPhone.trim().replace(/[^\d+]/g, '');
}

/**
 * Lookup a customer by phone number using Prisma ORM with indexed lookup
 */
export async function findCustomerByPhone(rawPhone: string): Promise<{
  found: boolean;
  customer?: any;
  pastOrders?: any[];
  source: 'prisma' | 'memory';
}> {
  const clean = rawPhone.trim();
  const digitsOnly = clean.replace(/\D/g, '');

  if (!digitsOnly || digitsOnly.length < 4) {
    return { found: false, source: 'prisma' };
  }

  // 1. Try Prisma indexed lookup
  try {
    // Exact phone match
    let cust = await prisma.customer.findUnique({
      where: { phoneNumber: clean },
      include: {
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        },
      },
    });

    // If not found by raw string, search by digits match
    if (!cust && digitsOnly.length >= 7) {
      cust = await prisma.customer.findFirst({
        where: {
          OR: [
            { phoneNumber: { contains: digitsOnly } },
            { phoneNumber: clean },
          ],
        },
        include: {
          orders: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { items: true },
          },
        },
      });
    }

    if (cust) {
      const formattedCustomer: Customer = {
        id: cust.id,
        name: cust.name,
        phone: cust.phoneNumber,
        email: cust.email || undefined,
        address: cust.address || 'Walk-in / Counter',
        deliveryNotes: cust.deliveryNotes || '',
        vipTier: cust.vipTier,
        loyaltyPoints: cust.loyaltyPoints,
        totalOrdersCount: cust.totalVisits,
        totalSpent: cust.totalSpent,
        createdAt: cust.createdAt.toISOString().split('T')[0],
      };

      const pastOrders = (cust.orders || []).map((o: any) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        type: o.orderType,
        status: o.status,
        total: o.total,
        createdAt: o.createdAt.toISOString(),
        items: (o.items || []).map((item: any) => ({
          id: item.id,
          menuItemId: item.menuItemId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          flavor: item.flavor,
          customization: item.itemNote || item.flavor || '',
        })),
      }));

      return {
        found: true,
        customer: formattedCustomer,
        pastOrders,
        source: 'prisma',
      };
    }
  } catch (err) {
    console.warn('[Prisma] Customer lookup falling back to in-memory store:', err);
  }

  // 2. Fallback to in-memory search
  for (const [phoneKey, memCust] of memoryCustomers.entries()) {
    if (phoneKey === digitsOnly || (digitsOnly.length >= 7 && (phoneKey.endsWith(digitsOnly) || digitsOnly.endsWith(phoneKey)))) {
      return {
        found: true,
        customer: {
          id: memCust.id,
          name: memCust.name,
          phone: memCust.phoneNumber,
          email: memCust.email,
          address: memCust.address,
          deliveryNotes: memCust.deliveryNotes,
          vipTier: memCust.vipTier,
          loyaltyPoints: memCust.loyaltyPoints,
          totalOrdersCount: memCust.totalVisits,
          totalSpent: memCust.totalSpent,
          createdAt: new Date(memCust.createdAt).toISOString().split('T')[0],
        },
        pastOrders: [],
        source: 'memory',
      };
    }
  }

  return { found: false, source: 'prisma' };
}

/**
 * Upsert Customer (Create if new, update if existing) via Prisma
 */
export async function upsertCustomerRecord(payload: {
  name?: string;
  phone: string;
  email?: string;
  address?: string;
  deliveryNotes?: string;
  notes?: string;
  vipTier?: string;
  loyaltyPoints?: number;
}): Promise<{ success: boolean; isNew: boolean; customer: Customer }> {
  const cleanPhone = payload.phone.trim();
  const digitsOnly = cleanPhone.replace(/\D/g, '');
  const custName = (payload.name && payload.name.trim()) || 'Guest Customer';
  const custAddress = (payload.address && payload.address.trim()) || 'Walk-in / Counter';
  const custNotes = (payload.deliveryNotes || payload.notes || '').trim();

  // Validate with Zod
  const validated = CustomerUpsertSchema.safeParse({
    name: custName,
    phoneNumber: cleanPhone,
    email: payload.email || undefined,
    address: custAddress,
    deliveryNotes: custNotes,
    vipTier: (payload.vipTier as any) || 'Regular',
    loyaltyPoints: payload.loyaltyPoints ?? 50,
  });

  if (!validated.success) {
    throw new Error(((validated.error as any).issues || (validated.error as any).errors || []).map((e: any) => e.message).join(', '));
  }

  let isNew = false;
  let resultCustomer: Customer;

  try {
    // Check if customer exists in Prisma
    const existing = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          { phoneNumber: cleanPhone },
        ],
      },
    });

    if (existing) {
      isNew = false;
      const updated = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          phone: cleanPhone,
          phoneNumber: cleanPhone,
          name: custName,
          address: custAddress,
          deliveryNotes: custNotes,
          email: payload.email || existing.email,
        },
      });

      resultCustomer = {
        id: updated.id,
        name: updated.name,
        phone: updated.phone || updated.phoneNumber || cleanPhone,
        email: updated.email || undefined,
        address: updated.address || '',
        deliveryNotes: updated.deliveryNotes || '',
        vipTier: updated.vipTier,
        loyaltyPoints: updated.loyaltyPoints,
        totalOrdersCount: updated.totalVisits,
        totalSpent: updated.totalSpent,
        createdAt: updated.createdAt.toISOString().split('T')[0],
      };
    } else {
      isNew = true;
      const created = await prisma.customer.create({
        data: {
          phone: cleanPhone,
          phoneNumber: cleanPhone,
          name: custName,
          email: payload.email || null,
          address: custAddress,
          deliveryNotes: custNotes,
          vipTier: 'Regular',
          loyaltyPoints: 50,
          totalVisits: 1,
          totalSpent: 0,
        },
      });

      resultCustomer = {
        id: created.id,
        name: created.name,
        phone: created.phone || created.phoneNumber || cleanPhone,
        email: created.email || undefined,
        address: created.address || '',
        deliveryNotes: created.deliveryNotes || '',
        vipTier: created.vipTier,
        loyaltyPoints: created.loyaltyPoints,
        totalOrdersCount: created.totalVisits,
        totalSpent: created.totalSpent,
        createdAt: created.createdAt.toISOString().split('T')[0],
      };
    }
  } catch (err) {
    console.warn('[Prisma] Upsert fallback to in-memory store:', err);
    // In-memory fallback
    const memCust = memoryCustomers.get(digitsOnly);
    if (memCust) {
      isNew = false;
      memCust.name = custName;
      memCust.address = custAddress;
      memCust.deliveryNotes = custNotes;
      memCust.updatedAt = new Date();
      resultCustomer = {
        id: memCust.id,
        name: memCust.name,
        phone: memCust.phoneNumber,
        email: memCust.email,
        address: memCust.address,
        deliveryNotes: memCust.deliveryNotes,
        vipTier: memCust.vipTier,
        loyaltyPoints: memCust.loyaltyPoints,
        totalOrdersCount: memCust.totalVisits,
        totalSpent: memCust.totalSpent,
        createdAt: new Date(memCust.createdAt).toISOString().split('T')[0],
      };
    } else {
      isNew = true;
      const newId = `cust-${Date.now()}`;
      const newEntry = {
        id: newId,
        phoneNumber: cleanPhone,
        name: custName,
        email: payload.email || null,
        address: custAddress,
        deliveryNotes: custNotes,
        vipTier: 'Regular',
        loyaltyPoints: 50,
        totalVisits: 1,
        totalSpent: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryCustomers.set(digitsOnly, newEntry);
      resultCustomer = {
        id: newId,
        name: custName,
        phone: cleanPhone,
        email: payload.email,
        address: custAddress,
        deliveryNotes: custNotes,
        vipTier: 'Regular',
        loyaltyPoints: 50,
        totalOrdersCount: 1,
        totalSpent: 0,
        createdAt: new Date().toISOString().split('T')[0],
      };
    }
  }

  // Update memory cache
  memoryCustomers.set(digitsOnly, {
    id: resultCustomer.id,
    phoneNumber: resultCustomer.phone,
    name: resultCustomer.name,
    email: resultCustomer.email || null,
    address: resultCustomer.address,
    deliveryNotes: resultCustomer.deliveryNotes,
    vipTier: resultCustomer.vipTier,
    loyaltyPoints: resultCustomer.loyaltyPoints,
    totalVisits: resultCustomer.totalOrdersCount,
    totalSpent: resultCustomer.totalSpent,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    success: true,
    isNew,
    customer: resultCustomer,
  };
}

/**
 * Update Customer Visit Count, Spend & Loyalty Points upon Order Placement
 */
export async function recordCustomerOrderStats(
  phoneNumber: string,
  customerName: string,
  orderTotal: number,
  address?: string
) {
  if (!phoneNumber || !phoneNumber.trim()) return;

  const cleanPhone = phoneNumber.trim();
  const digitsOnly = cleanPhone.replace(/\D/g, '');
  const pointsEarned = Math.floor(orderTotal * 2);

  try {
    const existing = await prisma.customer.findUnique({
      where: { phoneNumber: cleanPhone },
    });

    if (existing) {
      const newVisits = existing.totalVisits + 1;
      const newSpent = existing.totalSpent + orderTotal;
      const newPoints = existing.loyaltyPoints + pointsEarned;
      let newTier = 'Regular';
      if (newPoints > 500 || newSpent > 5000) newTier = 'Platinum';
      else if (newPoints > 300 || newSpent > 3000) newTier = 'Gold';
      else if (newPoints > 100 || newSpent > 1000) newTier = 'Silver';

      await prisma.customer.update({
        where: { phoneNumber: cleanPhone },
        data: {
          totalVisits: newVisits,
          totalSpent: newSpent,
          loyaltyPoints: newPoints,
          vipTier: newTier,
          name: customerName || existing.name,
          address: address || existing.address,
        },
      });
    } else {
      await prisma.customer.create({
        data: {
          phone: cleanPhone,
          phoneNumber: cleanPhone,
          name: customerName || 'Guest Customer',
          address: address || 'Walk-in / Counter',
          totalVisits: 1,
          totalSpent: orderTotal,
          loyaltyPoints: pointsEarned + 50, // 50 welcome points
          vipTier: pointsEarned > 100 ? 'Silver' : 'Regular',
        },
      });
    }
  } catch (err) {
    console.warn('[Prisma] Error recording customer order stats:', err);
  }

  // Also update in-memory
  const memCust = memoryCustomers.get(digitsOnly);
  if (memCust) {
    memCust.totalVisits += 1;
    memCust.totalSpent += orderTotal;
    memCust.loyaltyPoints += pointsEarned;
    if (memCust.loyaltyPoints > 500) memCust.vipTier = 'Platinum';
    else if (memCust.loyaltyPoints > 300) memCust.vipTier = 'Gold';
    else if (memCust.loyaltyPoints > 100) memCust.vipTier = 'Silver';
  }
}
