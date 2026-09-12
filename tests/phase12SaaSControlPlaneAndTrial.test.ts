process.env.NODE_ENV = 'test';

import http from 'http';
import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../src/server/prisma';
import app from '../server';
import { signTenantToken } from '../src/server/auth/jwt';
import { runSubscriptionReminderScheduler } from '../src/server/billing/reminderService';
import { getVerificationCodeForTest } from '../src/server/auth/emailVerificationService';

async function runPhase12Tests() {
  console.log('======================================================================');
  console.log('🚀 STARTING PHASE 12: SAAS CONTROL PLANE & TRIAL ENFORCEMENT TEST SUITE');
  console.log('======================================================================');

  await prisma.$connect();
  const server = http.createServer(app);
  let baseUrl = '';

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`Phase 12 Test Server running at ${baseUrl}`);
      resolve();
    });
  });

  try {

  // --- 1. One-Time 14-Day Trial Enforcement on Registration ---
  console.log('\n--- 1. Testing One-Time 14-Day Trial Enforcement on Registration ---');

  const testEmail1 = `owner_phase12_alpha_${Date.now()}@tillora-test.com`;
  const regPayload1 = {
    name: 'Alpha Owner',
    email: testEmail1,
    password: 'Password123!',
    restaurantName: 'Phase12 Alpha Bistro',
    branchName: 'Downtown',
    plan: 'STARTER',
  };

  const regRes1 = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload1),
  });

  const regInitData1 = await regRes1.json();
  if (!regInitData1.requiresVerification && !regInitData1.token) {
    throw new Error(`Failed to initiate registration: ${JSON.stringify(regInitData1)}`);
  }

  const code = getVerificationCodeForTest(testEmail1);
  const verifyRes1 = await fetch(`${baseUrl}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail1,
      code,
    }),
  });

  const regData1 = await verifyRes1.json();
  if ((verifyRes1.status !== 200 && verifyRes1.status !== 201) || !regData1.token) {
    throw new Error(`Failed to verify and register initial organization: ${JSON.stringify(regData1)}`);
  }
  console.log('  ✅ PASS: Successfully registered new tenant organization');

  const org1 = await prisma.organization.findUnique({
    where: { id: regData1.user.organizationId },
    include: { subscriptions: true },
  });

  if (!org1 || !org1.trialUsedAt) {
    throw new Error('FAILED: trialUsedAt timestamp was not recorded on newly created trial organization');
  }
  console.log(`  ✅ PASS: Organization 'trialUsedAt' timestamp recorded: ${org1.trialUsedAt.toISOString()}`);

  const sub1 = org1.subscriptions[0];
  if (!sub1 || sub1.status !== 'TRIALING' || !sub1.trialEndsAt) {
    throw new Error(`FAILED: Subscription was not initialized as TRIALING with trialEndsAt. Subscription: ${JSON.stringify(sub1)}`);
  }

  const daysDiff = Math.round((new Date(sub1.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff !== 14) {
    throw new Error(`FAILED: Trial duration is ${daysDiff} days instead of 14 days`);
  }
  console.log(`  ✅ PASS: Server granted exactly a 14-day trial ending on ${sub1.trialEndsAt.toISOString()}`);


  // --- 2. Trial Abuse Prevention (Re-registration does not grant duplicate trial) ---
  console.log('\n--- 2. Testing Trial Abuse Prevention ---');

  // Re-register using same email for a "second" organization attempt
  // Note: register endpoint rejects duplicate active email linked to org (409 Conflict)
  const regRes2 = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload1),
  });

  if (regRes2.status !== 409) {
    throw new Error(`FAILED: Duplicate email registration was not blocked with 409 Conflict. Got ${regRes2.status}`);
  }
  console.log('  ✅ PASS: Re-registering with existing owner email is strictly rejected with 409 Conflict');


  // --- 3. Customer Portal Overview API & Trial Warnings ---
  console.log('\n--- 3. Testing Customer Portal Overview API & Trial Warnings ---');

  const portalRes1 = await fetch(`${baseUrl}/api/portal/overview`, {
    headers: { Authorization: `Bearer ${regData1.token}` },
  });

  const portalData1 = await portalRes1.json();
  if (portalRes1.status !== 200 || !portalData1.success) {
    throw new Error(`FAILED: Customer Portal Overview failed: ${JSON.stringify(portalData1)}`);
  }

  if (portalData1.data.subscription.daysRemaining !== 14) {
    throw new Error(`FAILED: Expected 14 days remaining, got ${portalData1.data.subscription.daysRemaining}`);
  }
  console.log('  ✅ PASS: Customer Portal Overview returned server-calculated daysRemaining = 14');


  // --- 4. Daily Subscription Reminder Engine & Idempotency ---
  console.log('\n--- 4. Testing Daily Subscription Reminder Engine & Idempotency ---');

  // Simulate sub expiring in 2 days to trigger 2d reminder
  const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 - 10000);
  await prisma.subscription.update({
    where: { id: sub1.id },
    data: { trialEndsAt: twoDaysFromNow },
  });

  const summary1 = await runSubscriptionReminderScheduler();
  if (summary1.sentCount === 0) {
    throw new Error(`FAILED: Reminder scheduler did not send email for 2-day expiring trial: ${JSON.stringify(summary1)}`);
  }
  console.log(`  ✅ PASS: Reminder scheduler dispatched 2-day warning email (sentCount=${summary1.sentCount})`);

  // Verify Persistent Reminder Log recorded in DB
  const reminderLog = await prisma.subscriptionReminderLog.findUnique({
    where: {
      organizationId_reminderType: {
        organizationId: org1.id,
        reminderType: 'subscription_expiry_2d',
      },
    },
  });

  if (!reminderLog || reminderLog.deliveryStatus !== 'DELIVERED') {
    throw new Error('FAILED: SubscriptionReminderLog entry was not created or delivered');
  }
  console.log(`  ✅ PASS: SubscriptionReminderLog created with unique constraint: ${reminderLog.id}`);

  // Re-run reminder job immediately -> must skip duplicate email
  const summary2 = await runSubscriptionReminderScheduler();
  if (summary2.sentCount !== 0 || summary2.skippedCount === 0) {
    throw new Error(`FAILED: Re-running scheduler failed idempotency check. Sent: ${summary2.sentCount}, Skipped: ${summary2.skippedCount}`);
  }
  console.log(`  ✅ PASS: Re-running reminder scheduler idempotently skipped duplicate dispatch (skippedCount=${summary2.skippedCount})`);


  // --- 5. Controlled Trial Extension by Platform Admin ---
  console.log('\n--- 5. Testing Controlled Trial Extension by Platform Admin ---');

  // Create Platform Admin Token
  const platformAdminUser = await prisma.user.findFirst({ where: { role: 'PLATFORM_ADMIN' } });
  if (!platformAdminUser) {
    throw new Error('FAILED: Seeded Platform Admin user not found');
  }

  const platformAdminToken = signTenantToken({
    userId: platformAdminUser.id,
    organizationId: platformAdminUser.organizationId || 'platform_admin_org',
    role: 'PLATFORM_ADMIN',
    permissions: ['PLATFORM_ADMIN_ALL'],
  });

  // Attempt trial extension WITHOUT mandatory reason -> Must fail 400
  const extRes1 = await fetch(`${baseUrl}/api/platform-admin/organizations/${org1.id}/extend-trial`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${platformAdminToken}`,
    },
    body: JSON.stringify({ extensionDays: 7, reason: '' }),
  });

  if (extRes1.status !== 400) {
    throw new Error(`FAILED: Extending trial without reason should return 400 Bad Request. Got ${extRes1.status}`);
  }
  console.log('  ✅ PASS: Extending trial without explicit reason is rejected with 400 Bad Request');

  // Attempt trial extension WITH mandatory reason -> Must succeed 200
  const extRes2 = await fetch(`${baseUrl}/api/platform-admin/organizations/${org1.id}/extend-trial`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${platformAdminToken}`,
    },
    body: JSON.stringify({
      extensionDays: 7,
      reason: 'Customer onboarding delay extension approved by executive support',
    }),
  });

  const extData2 = await extRes2.json();
  if (extRes2.status !== 200 || !extData2.success) {
    throw new Error(`FAILED: Controlled trial extension failed: ${JSON.stringify(extData2)}`);
  }
  console.log(`  ✅ PASS: Trial extended successfully: ${extData2.message}`);

  // Verify Audit Log recorded
  const extAudit = await prisma.auditLog.findFirst({
    where: {
      organizationId: org1.id,
      action: 'ORGANIZATION_TRIAL_EXTENDED',
    },
  });

  if (!extAudit) {
    throw new Error('FAILED: ORGANIZATION_TRIAL_EXTENDED audit log was not generated');
  }
  console.log(`  ✅ PASS: Trial extension recorded in platform audit trail: ${extAudit.id}`);


  // --- 6. Non-Admin Rejection on Trial Extension & Executive Admin Access ---
  console.log('\n--- 6. Testing Security Boundary on Trial Extension ---');

  const extRes3 = await fetch(`${baseUrl}/api/platform-admin/organizations/${org1.id}/extend-trial`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${regData1.token}`, // Restaurant Owner token
    },
    body: JSON.stringify({
      extensionDays: 14,
      reason: 'Unauthorized attempt by restaurant owner',
    }),
  });

  if (extRes3.status !== 403) {
    throw new Error(`FAILED: Non-platform-admin extending trial was not blocked with 403. Got ${extRes3.status}`);
  }
  console.log('  ✅ PASS: Restaurant Owner attempting trial extension is strictly blocked with 403 FORBIDDEN');

  console.log('\n======================================================================');
  console.log('🎉 ALL PHASE 12 SAAS CONTROL PLANE & TRIAL ASSERTIONS PASSED SUCCESSFULLY!');
  console.log('======================================================================');
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await prisma.$disconnect();
  }
}

runPhase12Tests().catch((err) => {
  console.error('\n❌ PHASE 12 TEST SUITE FAILED:', err);
  process.exit(1);
});
