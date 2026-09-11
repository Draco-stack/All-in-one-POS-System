import prisma from '../prisma';
import { logAuditEvent } from '../auth/auditService';

export interface ReminderDeliveryResult {
  organizationId: string;
  organizationName: string;
  ownerEmail: string;
  reminderType: 'subscription_expiry_3d' | 'subscription_expiry_2d' | 'subscription_expiry_1d';
  daysRemaining: number;
  trialEndsAt: string;
  status: 'DELIVERED' | 'SKIPPED_ALREADY_SENT' | 'FAILED';
  message: string;
}

export interface ReminderJobSummary {
  processedCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  results: ReminderDeliveryResult[];
}

/**
 * Generates branded HTML email template for subscription expiration warnings.
 */
export function generateExpiryEmailTemplate(data: {
  restaurantName: string;
  planName: string;
  daysRemaining: number;
  expirationDateStr: string;
  portalUrl: string;
}): string {
  const urgencyColor = data.daysRemaining <= 1 ? '#DC2626' : data.daysRemaining <= 2 ? '#EA580C' : '#D97706';
  const headerTitle = data.daysRemaining <= 1 
    ? 'CRITICAL NOTICE: Subscription Expires Tomorrow' 
    : `Urgent: ${data.daysRemaining} Days Remaining on Your Tillora Subscription`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${headerTitle}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #0F172A;">
  <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    <!-- Header -->
    <div style="background-color: #0F172A; padding: 24px; text-align: center;">
      <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">TILLORA</h1>
      <p style="color: #94A3B8; margin: 4px 0 0 0; font-size: 13px;">The Operating System for Your Restaurant</p>
    </div>

    <!-- Warning Banner -->
    <div style="background-color: ${urgencyColor}; color: #FFFFFF; padding: 12px 24px; text-align: center; font-weight: 600; font-size: 14px;">
      ⚠️ Your ${data.planName} subscription expires in ${data.daysRemaining} ${data.daysRemaining === 1 ? 'day' : 'days'}
    </div>

    <!-- Content Body -->
    <div style="padding: 32px 24px;">
      <h2 style="font-size: 20px; font-weight: 600; margin-top: 0; color: #0F172A;">
        Action Required for ${data.restaurantName}
      </h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
        Your Tillora subscription and POS services will expire on <strong>${data.expirationDateStr}</strong>. Renew or upgrade your subscription now to ensure uninterrupted restaurant POS operations, KDS ordering, and employee shift management.
      </p>

      <!-- Key Details Card -->
      <div style="background-color: #F1F5F9; border-radius: 8px; padding: 16px 20px; margin-bottom: 28px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
          <span style="color: #64748B;">Restaurant Name:</span>
          <strong style="color: #0F172A;">${data.restaurantName}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
          <span style="color: #64748B;">Current Plan:</span>
          <strong style="color: #0F172A;">${data.planName}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
          <span style="color: #64748B;">Expiration Date:</span>
          <strong style="color: ${urgencyColor};">${data.expirationDateStr} (${data.daysRemaining} days remaining)</strong>
        </div>
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin-bottom: 28px;">
        <a href="${data.portalUrl}" style="background-color: #2563EB; color: #FFFFFF; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
          Manage Subscription & Renew Now →
        </a>
      </div>

      <p style="color: #94A3B8; font-size: 13px; line-height: 1.5; text-align: center; margin: 0;">
        If you need assistance, contact Tillora Executive Support at support@tillora.com or access your Customer Portal account dashboard.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #F8FAFC; padding: 16px 24px; border-top: 1px solid #E2E8F0; text-align: center; font-size: 12px; color: #94A3B8;">
      © ${new Date().getFullYear()} Tillora SaaS Platform. All rights reserved.
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Runs the daily subscription reminder engine.
 * Scans for trialing and active subscriptions expiring within 3 days.
 * Idempotently creates SubscriptionReminderLog entries to ensure max 1 email per type per organization.
 */
export async function runSubscriptionReminderScheduler(): Promise<ReminderJobSummary> {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000);

  // 1. Query subscriptions expiring within 3.5 days
  const expiringSubscriptions = await prisma.subscription.findMany({
    where: {
      status: { in: ['TRIALING', 'ACTIVE'] },
      trialEndsAt: {
        not: null,
        lte: threeDaysFromNow,
      },
    },
    include: {
      organization: {
        include: {
          users: {
            where: { role: 'OWNER', active: true },
            take: 1,
          },
        },
      },
    },
  });

  const results: ReminderDeliveryResult[] = [];
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const sub of expiringSubscriptions) {
    const org = sub.organization;
    if (!org) continue;

    const owner = org.users[0];
    const ownerEmail = owner?.username || `owner_${org.slug}@tillora.com`;
    const trialEndsAtDate = sub.trialEndsAt ? new Date(sub.trialEndsAt) : now;

    // Calculate exact full days remaining
    const diffMs = trialEndsAtDate.getTime() - now.getTime();
    const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    if (daysRemaining > 3) {
      continue; // More than 3 days remaining, no email needed yet
    }

    // Determine target reminder type
    let reminderType: 'subscription_expiry_3d' | 'subscription_expiry_2d' | 'subscription_expiry_1d';
    if (daysRemaining >= 3) {
      reminderType = 'subscription_expiry_3d';
    } else if (daysRemaining === 2) {
      reminderType = 'subscription_expiry_2d';
    } else {
      reminderType = 'subscription_expiry_1d';
    }

    // 2. Check Idempotency - Has this specific reminder type ALREADY been dispatched for this organization?
    const existingLog = await prisma.subscriptionReminderLog.findUnique({
      where: {
        organizationId_reminderType: {
          organizationId: org.id,
          reminderType,
        },
      },
    });

    if (existingLog) {
      skippedCount++;
      results.push({
        organizationId: org.id,
        organizationName: org.name,
        ownerEmail,
        reminderType,
        daysRemaining,
        trialEndsAt: trialEndsAtDate.toISOString(),
        status: 'SKIPPED_ALREADY_SENT',
        message: `Reminder type '${reminderType}' was already sent on ${existingLog.sentAt.toISOString()}`,
      });
      continue;
    }

    // 3. Dispatch Email & Record Idempotent Log atomically
    try {
      const emailHtml = generateExpiryEmailTemplate({
        restaurantName: org.name,
        planName: sub.plan,
        daysRemaining,
        expirationDateStr: trialEndsAtDate.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        portalUrl: '/portal/subscription',
      });

      // Simulated production email dispatch (Logged to console & stored in audit)
      console.log(`[EMAIL_SERVICE] Dispatched ${reminderType} to ${ownerEmail} for ${org.name} (${daysRemaining} days left)`);

      await prisma.$transaction(async (tx) => {
        await tx.subscriptionReminderLog.create({
          data: {
            organizationId: org.id,
            reminderType,
            deliveryStatus: 'DELIVERED',
            metadata: JSON.stringify({
              sentTo: ownerEmail,
              daysRemaining,
              trialEndsAt: trialEndsAtDate.toISOString(),
              plan: sub.plan,
            }),
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId: org.id,
            action: `REMINDER_SENT_${reminderType.toUpperCase()}`,
            entity: 'SUBSCRIPTION',
            entityId: sub.id,
            metadata: JSON.stringify({
              reminderType,
              daysRemaining,
              recipient: ownerEmail,
            }),
          },
        });
      });

      sentCount++;
      results.push({
        organizationId: org.id,
        organizationName: org.name,
        ownerEmail,
        reminderType,
        daysRemaining,
        trialEndsAt: trialEndsAtDate.toISOString(),
        status: 'DELIVERED',
        message: `Successfully dispatched ${reminderType} reminder email`,
      });
    } catch (err: any) {
      failedCount++;
      results.push({
        organizationId: org.id,
        organizationName: org.name,
        ownerEmail,
        reminderType,
        daysRemaining,
        trialEndsAt: trialEndsAtDate.toISOString(),
        status: 'FAILED',
        message: err.message || 'Failed to send reminder email',
      });
    }
  }

  return {
    processedCount: expiringSubscriptions.length,
    sentCount,
    skippedCount,
    failedCount,
    results,
  };
}
