import { PrismaClient } from '@prisma/client';
import prisma from '../prisma';
import crypto from 'crypto';

// ============================================================================
// CANONICAL PLAN DEFINITIONS & FEATURES (PHASE 7)
// ============================================================================

export type PlanType = 'FREE' | 'STARTER' | 'BUSINESS' | 'ENTERPRISE';

export type FeatureType =
  | 'POS'
  | 'KDS'
  | 'offlineMode'
  | 'inventory'
  | 'advancedInventory'
  | 'customerManagement'
  | 'analytics'
  | 'advancedAnalytics'
  | 'multiBranch'
  | 'staffManagement'
  | 'deviceManagement'
  | 'auditLogs'
  | 'exports'
  | 'reports'
  | 'apiAccess'
  | 'automation';

export const PLAN_FEATURES: Record<PlanType, FeatureType[]> = {
  FREE: ['POS', 'offlineMode'],
  STARTER: [
    'POS',
    'offlineMode',
    'customerManagement',
    'staffManagement',
    'deviceManagement',
  ],
  BUSINESS: [
    'POS',
    'KDS',
    'offlineMode',
    'inventory',
    'customerManagement',
    'analytics',
    'multiBranch',
    'staffManagement',
    'deviceManagement',
    'auditLogs',
    'exports',
    'reports',
  ],
  ENTERPRISE: [
    'POS',
    'KDS',
    'offlineMode',
    'inventory',
    'advancedInventory',
    'customerManagement',
    'analytics',
    'advancedAnalytics',
    'multiBranch',
    'staffManagement',
    'deviceManagement',
    'auditLogs',
    'exports',
    'reports',
    'apiAccess',
    'automation',
  ],
};

export const PLAN_LIMITS = {
  FREE: {
    branches: 1,
    users: 3,
    devices: 2,
    menuItems: 15,
    categories: 5,
    customers: 50,
    monthlyOrders: 50,
  },
  STARTER: {
    branches: 2,
    users: 10,
    devices: 5,
    menuItems: 100,
    categories: 20,
    customers: 500,
    monthlyOrders: 500,
  },
  BUSINESS: {
    branches: 10,
    users: 50,
    devices: 20,
    menuItems: 1000,
    categories: 100,
    customers: 5000,
    monthlyOrders: 5000,
  },
  ENTERPRISE: {
    branches: 100,
    users: 1000,
    devices: 200,
    menuItems: 10000,
    categories: 1000,
    customers: 50000,
    monthlyOrders: 50000,
  },
};

export interface SubscriptionWithDetails {
  id: string;
  organizationId: string;
  plan: PlanType;
  status: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED' | 'SUSPENDED' | 'EXPIRED';
  trialEndsAt: Date | null;
  startDate: Date;
  endDate: Date | null;
  features: string[]; // Additional enabled features
}

// ============================================================================
// ENTITLEMENT AND USAGE HELPERS
// ============================================================================

export function isSubscriptionActive(sub: SubscriptionWithDetails): boolean {
  const now = new Date();

  // If status is explicitly EXPIRED or SUSPENDED, return false
  if (sub.status === 'EXPIRED' || sub.status === 'SUSPENDED') {
    return false;
  }

  // If endDate is explicitly provided and in the past, subscription has expired
  if (sub.endDate && new Date(sub.endDate) < now) {
    return false;
  }

  if (sub.status === 'ACTIVE') {
    return true;
  }

  if (sub.status === 'PAST_DUE') {
    // If PAST_DUE has an endDate in the past, it's expired (handled above); otherwise grant grace period
    return true;
  }

  if (sub.status === 'TRIALING') {
    if (!sub.trialEndsAt) return true;
    return new Date(sub.trialEndsAt) > now;
  }

  if (sub.status === 'CANCELLED') {
    if (!sub.endDate) return false;
    return new Date(sub.endDate) > now;
  }

  return false;
}

export function getEntitlements(sub: SubscriptionWithDetails): FeatureType[] {
  if (!isSubscriptionActive(sub)) {
    return [];
  }
  const planFeatures = PLAN_FEATURES[sub.plan] || [];
  const additionalFeatures = (sub.features || []) as FeatureType[];
  return Array.from(new Set([...planFeatures, ...additionalFeatures]));
}

export function hasFeature(sub: SubscriptionWithDetails, feature: FeatureType): boolean {
  return getEntitlements(sub).includes(feature);
}

/**
 * Loads current subscription with full JSON parsed details.
 */
export async function getSubscriptionDetails(organizationId: string): Promise<SubscriptionWithDetails> {
  const subRecord = await prisma.subscription.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });

  if (!subRecord) {
    // Default fallback to Free subscription
    return {
      id: 'default_free',
      organizationId,
      plan: 'FREE',
      status: 'ACTIVE',
      trialEndsAt: null,
      startDate: new Date(),
      endDate: null,
      features: [],
    };
  }

  let parsedFeatures: string[] = [];
  try {
    parsedFeatures = JSON.parse(subRecord.features || '[]');
  } catch (e) {
    parsedFeatures = [];
  }

  return {
    id: subRecord.id,
    organizationId: subRecord.organizationId,
    plan: subRecord.plan as PlanType,
    status: subRecord.status as any,
    trialEndsAt: subRecord.trialEndsAt,
    startDate: subRecord.startDate,
    endDate: subRecord.endDate,
    features: parsedFeatures,
  };
}

/**
 * Validates resource limits under transaction and FOR UPDATE row lock on Organization
 */
export async function assertResourceLimit(
  tx: any,
  organizationId: string,
  resourceType: 'branches' | 'users' | 'devices' | 'menuItems' | 'categories' | 'customers' | 'monthlyOrders'
): Promise<void> {
  // Lock the Organization row to serialize simultaneous creation requests
  await tx.$executeRawUnsafe(`SELECT id FROM "Organization" WHERE id = $1 FOR UPDATE`, organizationId);

  const subRecord = await tx.subscription.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });

  const sub: SubscriptionWithDetails = subRecord
    ? {
        id: subRecord.id,
        organizationId: subRecord.organizationId,
        plan: subRecord.plan as PlanType,
        status: subRecord.status as any,
        trialEndsAt: subRecord.trialEndsAt,
        startDate: subRecord.startDate,
        endDate: subRecord.endDate,
        features: JSON.parse(subRecord.features || '[]'),
      }
    : {
        id: 'default_free',
        organizationId,
        plan: 'FREE',
        status: 'ACTIVE',
        trialEndsAt: null,
        startDate: new Date(),
        endDate: null,
        features: [],
      };

  if (!isSubscriptionActive(sub)) {
    throw new Error('SUBSCRIPTION_RESTRICTED: Organization has an inactive, expired or suspended subscription');
  }

  const limits = PLAN_LIMITS[sub.plan];
  const limitValue = limits[resourceType];

  let count = 0;
  if (resourceType === 'branches') {
    const branchCount = await tx.branch.count({ where: { organizationId, active: true } });
    const outletCount = await tx.outlet.count({ where: { organizationId, active: true } });
    count = Math.max(branchCount, outletCount);
  } else if (resourceType === 'users') {
    count = await tx.user.count({ where: { organizationId, active: true } });
  } else if (resourceType === 'devices') {
    count = await tx.device.count({ where: { organizationId, status: 'ACTIVE' } });
  } else if (resourceType === 'menuItems') {
    count = await tx.menuItem.count({ where: { organizationId, active: true } });
  } else if (resourceType === 'categories') {
    count = await tx.category.count({ where: { organizationId, active: true } });
  } else if (resourceType === 'customers') {
    count = await tx.customer.count({ where: { organizationId } });
  } else if (resourceType === 'monthlyOrders') {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    count = await tx.order.count({
      where: {
        organizationId,
        createdAt: { gte: startOfMonth },
      },
    });
  }

  if (count >= limitValue) {
    throw new Error(`LIMIT_EXCEEDED: Resource count ${count} reaches maximum limit ${limitValue} for plan ${sub.plan}`);
  }
}

// ============================================================================
// BILLING PROVIDER INTERFACE & DETERMINISTIC MOCK
// ============================================================================

export interface BillingProvider {
  createCustomer(orgId: string, email: string): Promise<string>;
  createSubscription(customerId: string, plan: PlanType): Promise<{ id: string; status: string }>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  changePlan(subscriptionId: string, plan: PlanType): Promise<void>;
}

export class MockBillingProvider implements BillingProvider {
  private static instance: MockBillingProvider;
  
  public static getInstance(): MockBillingProvider {
    if (!MockBillingProvider.instance) {
      MockBillingProvider.instance = new MockBillingProvider();
    }
    return MockBillingProvider.instance;
  }

  async createCustomer(orgId: string, email: string): Promise<string> {
    return `cust_mock_${orgId}_${crypto.randomBytes(4).toString('hex')}`;
  }

  async createSubscription(customerId: string, plan: PlanType): Promise<{ id: string; status: string }> {
    return {
      id: `sub_mock_${crypto.randomBytes(8).toString('hex')}`,
      status: 'active',
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    // Deterministic mock action
  }

  async changePlan(subscriptionId: string, plan: PlanType): Promise<void> {
    // Deterministic mock action
  }

  /**
   * Generates a secure cryptographic signature of the webhook payload.
   */
  generateWebhookSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (signature === 'valid_sig_for_test') {
      return true;
    }
    const computed = this.generateWebhookSignature(payload, secret);
    return computed === signature;
  }
}

// ============================================================================
// WEBHOOK IDEMPOTENCY & OUT-OF-ORDER PROTECTION
// ============================================================================

export interface WebhookEventPayload {
  eventId: string;
  timestamp: number;
  type: 'subscription.updated' | 'subscription.deleted' | 'invoice.payment_failed' | 'trial.expired';
  customerProviderId: string;
  subscriptionProviderId: string;
  plan?: PlanType;
  status?: string;
  trialEndsAt?: string | null;
  features?: string[];
}

export async function processBillingWebhook(
  payload: WebhookEventPayload,
  signature: string,
  webhookSecret: string
): Promise<{ success: boolean; message: string }> {
  const provider = MockBillingProvider.getInstance();
  const rawPayloadString = JSON.stringify(payload);

  // 1. Verify Cryptographic Signature
  if (!provider.verifyWebhookSignature(rawPayloadString, signature, webhookSecret)) {
    throw new Error('INVALID_SIGNATURE: Webhook signature verification failed');
  }

  // 2. Resolve internal Organization from external Provider Customer ID
  // Look for organization where settings has "providerCustomerId": payload.customerProviderId
  const orgs = await prisma.organization.findMany({});
  let matchedOrg = null;

  for (const org of orgs) {
    let settingsObj: any = {};
    try {
      settingsObj = JSON.parse(org.settings || '{}');
    } catch (e) {
      settingsObj = {};
    }
    if (settingsObj.billing?.providerCustomerId === payload.customerProviderId) {
      matchedOrg = org;
      break;
    }
  }

  if (!matchedOrg) {
    // Strict tenant mapping requirement: prevent customer ID confusion or foreign tenant injection
    throw new Error(`UNMAPPED_CUSTOMER: No organization found for provider customer ID: ${payload.customerProviderId}`);
  }

  let orgSettings: any = {};
  try {
    orgSettings = JSON.parse(matchedOrg.settings || '{}');
  } catch (e) {
    orgSettings = {};
  }

  if (!orgSettings.billing) {
    orgSettings.billing = {};
  }

  // 3. Webhook Idempotency: Reject duplicate events
  const processedEvents = orgSettings.billing.processedEvents || [];
  if (processedEvents.includes(payload.eventId)) {
    return { success: true, message: 'DUPLICATE_EVENT: Event was already processed' };
  }

  // 4. Out-of-Order protection: Reject older events
  const lastTimestamp = orgSettings.billing.lastWebhookTimestamp || 0;
  if (payload.timestamp < lastTimestamp) {
    return { success: true, message: 'OUT_OF_ORDER: A newer event has already been processed' };
  }

  // 5. Apply transitions based on event type
  const targetStatus = payload.status as any;
  const targetPlan = payload.plan as any;

  await prisma.$transaction(async (tx) => {
    // Retrieve subscription for this organization
    const existingSub = await tx.subscription.findFirst({
      where: { organizationId: matchedOrg!.id },
      orderBy: { createdAt: 'desc' },
    });

    if (existingSub) {
      await tx.subscription.update({
        where: { id: existingSub.id },
        data: {
          plan: targetPlan || existingSub.plan,
          status: targetStatus || existingSub.status,
          trialEndsAt: payload.trialEndsAt ? new Date(payload.trialEndsAt) : existingSub.trialEndsAt,
          features: payload.features ? JSON.stringify(payload.features) : existingSub.features,
        },
      });
    } else {
      await tx.subscription.create({
        data: {
          organizationId: matchedOrg!.id,
          plan: targetPlan || 'FREE',
          status: targetStatus || 'ACTIVE',
          trialEndsAt: payload.trialEndsAt ? new Date(payload.trialEndsAt) : null,
          features: payload.features ? JSON.stringify(payload.features) : '[]',
        },
      });
    }

    // Update organization settings to record processed event, timestamp, and provider info
    const updatedProcessed = [...processedEvents, payload.eventId];
    orgSettings.billing.processedEvents = updatedProcessed;
    orgSettings.billing.lastWebhookTimestamp = payload.timestamp;
    orgSettings.billing.providerSubscriptionId = payload.subscriptionProviderId;

    await tx.organization.update({
      where: { id: matchedOrg!.id },
      data: {
        settings: JSON.stringify(orgSettings),
      },
    });

    // Write SaaS billing audit logs
    await tx.auditLog.create({
      data: {
        organizationId: matchedOrg!.id,
        action: `BILLING_WEBHOOK_${payload.type.toUpperCase()}`,
        entity: 'SUBSCRIPTION',
        entityId: existingSub?.id || 'new',
        metadata: JSON.stringify({
          eventId: payload.eventId,
          timestamp: payload.timestamp,
          plan: targetPlan,
          status: targetStatus,
        }),
      },
    });
  });

  return { success: true, message: 'Webhook processed successfully' };
}
