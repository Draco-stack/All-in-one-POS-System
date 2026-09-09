import { prisma } from './prisma';
import { CustomerUpsertSchema } from './validators';
import { Customer } from '../types';
import { DEFAULT_ORG_ID } from './seed';

// In-Memory Fallback Cache keyed by `${organizationId}:${digitsOnly}` to ensure multi-tenant isolation
const memoryCustomers: Map<string, any> = new Map();

/**
 * Normalizes phone numbers for indexing and search consistency
 */
export function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return '';
  return rawPhone.trim().replace(/[^\d+]/g, '');
}

/**
 * Lookup a customer by phone number using Prisma ORM with tenant indexed lookup
 */
export async function findCustomerByPhone(
  rawPhone: string,
  organizationId: string = DEFAULT_ORG_ID
): Promise<{
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

  // 1. Try Prisma indexed lookup scoped to organizationId
  try {
    const cust = await prisma.customer.findFirst({
      where: {
        organizationId,
        OR: [
          { phoneNumber: clean },
          { phone: clean },
          ...(digitsOnly.length >= 7
            ? [{ phoneNumber: { contains: digitsOnly } }, { phone: { contains: digitsOnly } }]
            : []),
        ],
      },
      include: {
        orders: {
          where: { organizationId },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        },
      },
    });

    if (cust) {
      const formattedCustomer: Customer = {
        id: cust.id,
        name: cust.name,
        phone: cust.phoneNumber || cust.phone,
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

  // 2. Fallback to in-memory search strictly scoped to tenant organization
  const memPrefix = `${organizationId}:`;
  for (const [key, memCust] of memoryCustomers.entries()) {
    if (!key.startsWith(memPrefix)) continue;
    const phoneKey = key.substring(memPrefix.length);

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
 * Upsert Customer (Create if new, update if existing) via Prisma with strict tenant scoping
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
  organizationId?: string;
}): Promise<{ success: boolean; isNew: boolean; customer: Customer }> {
  const cleanPhone = payload.phone.trim();
  const digitsOnly = cleanPhone.replace(/\D/g, '');
  const orgId = payload.organizationId || DEFAULT_ORG_ID;
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
    // Check if customer exists in Prisma strictly under this organizationId
    const existing = await prisma.customer.findFirst({
      where: {
        organizationId: orgId,
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
          organizationId: orgId,
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
    // In-memory fallback scoped by organizationId
    const memKey = `${orgId}:${digitsOnly}`;
    const memCust = memoryCustomers.get(memKey);
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
        organizationId: orgId,
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
      memoryCustomers.set(memKey, newEntry);
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
  const memKey = `${orgId}:${digitsOnly}`;
  memoryCustomers.set(memKey, {
    id: resultCustomer.id,
    organizationId: orgId,
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
  address?: string,
  organizationId: string = DEFAULT_ORG_ID
) {
  if (!phoneNumber || !phoneNumber.trim()) return;

  const cleanPhone = phoneNumber.trim();
  const digitsOnly = cleanPhone.replace(/\D/g, '');
  const pointsEarned = Math.floor(orderTotal * 2);

  try {
    const existing = await prisma.customer.findFirst({
      where: {
        organizationId,
        OR: [{ phoneNumber: cleanPhone }, { phone: cleanPhone }],
      },
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
        where: { id: existing.id },
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
          organizationId,
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
  const memKey = `${organizationId}:${digitsOnly}`;
  const memCust = memoryCustomers.get(memKey);
  if (memCust) {
    memCust.totalVisits += 1;
    memCust.totalSpent += orderTotal;
    memCust.loyaltyPoints += pointsEarned;
    if (memCust.loyaltyPoints > 500) memCust.vipTier = 'Platinum';
    else if (memCust.loyaltyPoints > 300) memCust.vipTier = 'Gold';
    else if (memCust.loyaltyPoints > 100) memCust.vipTier = 'Silver';
  }
}
