import Stripe from 'stripe';

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('CODE READY — PRODUCTION PAYMENT CONFIGURATION REQUIRED: STRIPE_SECRET_KEY is missing');
    }
    stripeClient = new Stripe(key, { apiVersion: '2023-10-16' as any });
  }
  return stripeClient;
}

import { Request, Response } from 'express';
import prisma from '../prisma';
import {
  getSubscriptionDetails,
  PLAN_LIMITS,
  PLAN_FEATURES,
  PlanType,
  processBillingWebhook,
  assertResourceLimit,
  isSubscriptionActive,
} from '../billing/billingSystem';

/**
 * GET /api/billing/subscription
 * Retrieves subscription, plan details, status, trial info, enabled features.
 */
export async function getSubscriptionHandler(req: Request, res: Response) {
  try {
    const orgId = req.tenant?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized: Missing organization context' });
    }

    const sub = await getSubscriptionDetails(orgId);
    return res.json({
      success: true,
      subscription: sub,
    });
  } catch (error: any) {
    console.error('[BillingController] getSubscription error:', error);
    return res.status(500).json({ error: 'Failed to retrieve subscription' });
  }
}

/**
 * GET /api/billing/usage
 * Computes authoritative server-side usage stats for the organization.
 */
export async function getUsageHandler(req: Request, res: Response) {
  try {
    const orgId = req.tenant?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized: Missing organization context' });
    }

    const sub = await getSubscriptionDetails(orgId);
    const limits = PLAN_LIMITS[sub.plan];

    // Authoritative Server-side count of resources
    const branchCount = await prisma.branch.count({ where: { organizationId: orgId, active: true } });
    const outletCount = await prisma.outlet.count({ where: { organizationId: orgId, active: true } });
    const branchesUsed = Math.max(branchCount, outletCount);

    const usersUsed = await prisma.user.count({ where: { organizationId: orgId, active: true } });
    const devicesUsed = await prisma.device.count({ where: { organizationId: orgId, status: 'ACTIVE' } });
    const menuItemsUsed = await prisma.menuItem.count({ where: { organizationId: orgId, active: true } });
    const categoriesUsed = await prisma.category.count({ where: { organizationId: orgId, active: true } });
    const customersUsed = await prisma.customer.count({ where: { organizationId: orgId } });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const ordersUsed = await prisma.order.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: startOfMonth },
      },
    });

    const formatStat = (used: number, limit: number) => {
      const remaining = Math.max(0, limit - used);
      const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
      return { used, limit, remaining, percentage };
    };

    return res.json({
      success: true,
      usage: {
        branches: formatStat(branchesUsed, limits.branches),
        users: formatStat(usersUsed, limits.users),
        devices: formatStat(devicesUsed, limits.devices),
        menuItems: formatStat(menuItemsUsed, limits.menuItems),
        categories: formatStat(categoriesUsed, limits.categories),
        customers: formatStat(customersUsed, limits.customers),
        orders: formatStat(ordersUsed, limits.monthlyOrders),
      },
    });
  } catch (error: any) {
    console.error('[BillingController] getUsage error:', error);
    return res.status(500).json({ error: 'Failed to retrieve usage stats' });
  }
}

/**
 * POST /api/billing/change-plan
 * Upgrades, downgrades or reactivates plans.
 */
export async function changePlanHandler(req: Request, res: Response) {
  try {
    const orgId = req.tenant?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized: Missing organization context' });
    }

    // RBAC check: Only OWNER or MANAGER can change billing details
    const role = req.tenant?.role;
    if (role !== 'OWNER' && role !== 'MANAGER') {
      return res.status(403).json({ error: 'Forbidden: Only managers or owners can manage subscriptions' });
    }

    const { plan } = req.body;
    if (!plan || !['FREE', 'STARTER', 'BUSINESS', 'ENTERPRISE'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const subDetails = await getSubscriptionDetails(orgId);

    await prisma.$transaction(async (tx) => {
      // Find or Create subscription
      const existing = await tx.subscription.findFirst({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        await tx.subscription.update({
          where: { id: existing.id },
          data: {
            plan: plan as PlanType,
            status: 'ACTIVE',
            endDate: null,
          },
        });
      } else {
        await tx.subscription.create({
          data: {
            organizationId: orgId,
            plan: plan as PlanType,
            status: 'ACTIVE',
          },
        });
      }

      // Record audit event
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId: req.tenant?.userId || null,
          action: 'PLAN_CHANGED',
          entity: 'SUBSCRIPTION',
          entityId: existing?.id || 'new',
          metadata: JSON.stringify({
            oldPlan: subDetails.plan,
            newPlan: plan,
          }),
        },
      });
    });

    return res.json({
      success: true,
      message: `Plan changed successfully to ${plan}`,
    });
  } catch (error: any) {
    console.error('[BillingController] changePlan error:', error);
    return res.status(500).json({ error: 'Failed to change plan' });
  }
}

/**
 * POST /api/billing/cancel
 * Cancels subscription at end of current billing period.
 */
export async function cancelSubscriptionHandler(req: Request, res: Response) {
  try {
    const orgId = req.tenant?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized: Missing organization context' });
    }

    // RBAC check: Only OWNER or MANAGER can change billing details
    const role = req.tenant?.role;
    if (role !== 'OWNER' && role !== 'MANAGER') {
      return res.status(403).json({ error: 'Forbidden: Only managers or owners can manage subscriptions' });
    }

    const existing = await prisma.subscription.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      return res.status(400).json({ error: 'No subscription found to cancel' });
    }

    const endOfPeriod = new Date();
    endOfPeriod.setDate(endOfPeriod.getDate() + 30); // 30 day grace period / end of billing period

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: existing.id },
        data: {
          status: 'CANCELLED',
          endDate: endOfPeriod,
        },
      });

      // Record audit event
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId: req.tenant?.userId || null,
          action: 'SUBSCRIPTION_CANCELLED',
          entity: 'SUBSCRIPTION',
          entityId: existing.id,
          metadata: JSON.stringify({
            endDate: endOfPeriod,
          }),
        },
      });
    });

    return res.json({
      success: true,
      message: 'Subscription cancelled successfully. Plan remains active until billing period ends.',
      endDate: endOfPeriod,
    });
  } catch (error: any) {
    console.error('[BillingController] cancelSubscription error:', error);
    return res.status(500).json({ error: 'Failed to cancel subscription' });
  }
}

/**
 * POST /api/billing/reactivate
 * Reactivates a cancelled/expired subscription.
 */
export async function reactivateSubscriptionHandler(req: Request, res: Response) {
  try {
    const orgId = req.tenant?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized: Missing organization context' });
    }

    // RBAC check: Only OWNER or MANAGER can change billing details
    const role = req.tenant?.role;
    if (role !== 'OWNER' && role !== 'MANAGER') {
      return res.status(403).json({ error: 'Forbidden: Only managers or owners can manage subscriptions' });
    }

    const existing = await prisma.subscription.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      return res.status(400).json({ error: 'No subscription found to reactivate' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          endDate: null,
        },
      });

      // Record audit event
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId: req.tenant?.userId || null,
          action: 'SUBSCRIPTION_RESTORED',
          entity: 'SUBSCRIPTION',
          entityId: existing.id,
        },
      });
    });

    return res.json({
      success: true,
      message: 'Subscription reactivated successfully',
    });
  } catch (error: any) {
    console.error('[BillingController] reactivateSubscription error:', error);
    return res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
}

/**
 * POST /api/billing/webhook
 * Publicly exposed webhook handler that validates signatures and maps tenants.
 */

export async function webhookHandler(req: Request, res: Response) {
  try {
    // 1. Check for Internal / Mock Billing Provider Signature (Phase 7 & Tests)
    const xSignature = req.headers['x-signature'] as string;
    if (xSignature) {
      const webhookSecret = process.env.BILLING_WEBHOOK_SECRET || 'secret';
      let payload = req.body;
      if (Buffer.isBuffer(payload)) {
        payload = JSON.parse(payload.toString('utf-8'));
      } else if (typeof payload === 'string') {
        payload = JSON.parse(payload);
      }
      const result = await processBillingWebhook(payload, xSignature, webhookSecret);
      return res.status(200).json(result);
    }

    // 2. Stripe Production Webhook
    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret || !signature) {
      return res.status(400).json({ error: 'Missing signature or webhook secret' });
    }
    
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.organizationId;
      const plan = session.metadata?.plan;
      
      if (orgId && plan) {
        await prisma.subscription.updateMany({
          where: { organizationId: orgId },
          data: {
            plan: plan,
            status: 'ACTIVE',
          }
        });
        
        await prisma.auditLog.create({
          data: {
            organizationId: orgId,
            action: 'SUBSCRIPTION_PAYMENT_SUCCESS',
            entity: 'SUBSCRIPTION',
            metadata: JSON.stringify({ plan, sessionId: session.id })
          }
        });
      }
    }
    
    return res.json({ received: true });
  } catch (error: any) {
    console.error('[BillingController] Webhook error:', error.message);
    return res.status(400).json({ error: true, message: error.message });
  }
}


/**
 * POST /api/devices
 * Authenticates, validates permissions and device limits before registering a device.
 */
export async function registerDeviceHandler(req: Request, res: Response) {
  try {
    const orgId = req.tenant?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized: Missing organization context' });
    }

    // Role/permission check: Manager or Owner
    const role = req.tenant?.role;
    if (role !== 'OWNER' && role !== 'MANAGER') {
      return res.status(403).json({ error: 'Forbidden: Only managers or owners can register devices' });
    }

    const { deviceIdentifier, name, deviceType } = req.body;
    if (!deviceIdentifier || !name) {
      return res.status(400).json({ error: 'Missing device identifier or name' });
    }

    // Execute race-safe check and create under transaction
    const createdDevice = await prisma.$transaction(async (tx) => {
      await assertResourceLimit(tx, orgId, 'devices');

      const existing = await tx.device.findUnique({
        where: {
          organizationId_deviceIdentifier: {
            organizationId: orgId,
            deviceIdentifier,
          },
        },
      });

      if (existing) {
        return await tx.device.update({
          where: { id: existing.id },
          data: {
            name,
            deviceType: deviceType || 'POS',
            status: 'ACTIVE',
          },
        });
      }

      return await tx.device.create({
        data: {
          organizationId: orgId,
          deviceIdentifier,
          name,
          deviceType: deviceType || 'POS',
          status: 'ACTIVE',
        },
      });
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: req.tenant?.userId || null,
        action: 'DEVICE_REGISTERED',
        entity: 'DEVICE',
        entityId: createdDevice.id,
        metadata: JSON.stringify({ deviceIdentifier, name, deviceType }),
      },
    });

    return res.json({
      success: true,
      device: createdDevice,
    });
  } catch (error: any) {
    console.error('[BillingController] Register device error:', error.message);
    if (error.message.includes('LIMIT_EXCEEDED') || error.message.includes('SUBSCRIPTION_RESTRICTED')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to register device' });
  }
}

export async function createCheckoutSessionHandler(req: Request, res: Response) {
  try {
    const orgId = req.tenant?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    
    const { plan } = req.body;
    const stripe = getStripe();
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Tillora ${plan} Plan`,
            },
            unit_amount: plan === 'ENTERPRISE' ? 29900 : 9900, // In cents
            recurring: { interval: 'month' }
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.protocol}://${req.get('host')}/app?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/app`,
      metadata: {
        organizationId: orgId,
        plan: plan,
      }
    });
    
    return res.json({ url: session.url });
  } catch (error: any) {
    console.error('[BillingController] createCheckoutSession error:', error.message);
    // Fallback URL if Stripe is not configured, so onboarding isn't blocked in dev
    if (error.message.includes('STRIPE_SECRET_KEY is missing')) {
      return res.status(200).json({ url: `${req.protocol}://${req.get('host')}/app?payment=mock_success` });
    }
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
