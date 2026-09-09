/**
 * Phase 7 — SaaS Billing, Plans, Entitlements & Usage Enforcement Test Suite
 */

import express from 'express';
import http from 'http';
import prisma from '../src/server/prisma';
import app from '../server';
import { signTenantToken } from '../src/server/auth/jwt';
import { MockBillingProvider, WebhookEventPayload } from '../src/server/billing/billingSystem';

async function runSaaSBillingTests() {
  console.log('====================================================');
  console.log('💳 RUNNING PHASE 7 SAAS BILLING & ENTITLEMENT TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Setup test server from main app
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  const mockProvider = MockBillingProvider.getInstance();
  const webhookSecret = process.env.BILLING_WEBHOOK_SECRET || 'secret';

  try {
    // --------------------------------------------------------------------------
    // SETUP: Create P7 Test Organization, User, and clean up subscriptions/outlets
    // --------------------------------------------------------------------------
    const orgId = 'org_test_p7';
    const email = 'owner@testp7.com';
    const providerCustomerId = 'cust_p7_test_external';

    const orgSettings = JSON.stringify({
      billing: {
        providerCustomerId,
        processedEvents: [],
        lastWebhookTimestamp: 0,
      },
    });

    const org = await prisma.organization.upsert({
      where: { id: orgId },
      update: {
        status: 'ACTIVE',
        slug: 'org-test-p7',
        settings: orgSettings,
      },
      create: {
        id: orgId,
        name: 'Test Org Phase 7',
        slug: 'org-test-p7',
        status: 'ACTIVE',
        settings: orgSettings,
      },
    });

    const user = await prisma.user.upsert({
      where: { id: 'user_test_p7_owner' },
      update: { pin: '1122', role: 'OWNER', active: true },
      create: {
        id: 'user_test_p7_owner',
        organizationId: orgId,
        name: 'P7 Owner',
        username: 'p7_owner',
        pin: '1122',
        role: 'OWNER',
        active: true,
      },
    });

    // Clean up existing resources for this org
    await prisma.subscription.deleteMany({ where: { organizationId: orgId } });
    await prisma.outlet.deleteMany({ where: { organizationId: orgId } });
    await prisma.device.deleteMany({ where: { organizationId: orgId } });

    const token = signTenantToken({
      userId: user.id,
      organizationId: orgId,
      role: user.role,
      username: user.username,
    });

    // --------------------------------------------------------------------------
    // 1. DEFAULT PLAN VERIFICATION
    // --------------------------------------------------------------------------
    console.log('\n--- 1. Default Plan / Subscription Retrieval ---');
    const resSub = await fetch(`${baseUrl}/api/billing/subscription`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    assert(resSub.status === 200, 'GET /api/billing/subscription returns 200 OK');
    const subData = await resSub.json();
    assert(subData.success === true, 'Response indicates success');
    assert(subData.subscription.plan === 'FREE', 'New organization defaults safely to FREE plan');
    assert(subData.subscription.status === 'ACTIVE', 'Default subscription is ACTIVE');

    // --------------------------------------------------------------------------
    // 2. RESOURCE USAGE CHECKS
    // --------------------------------------------------------------------------
    console.log('\n--- 2. Resource Usage Dashboard Checks ---');
    const resUsage = await fetch(`${baseUrl}/api/billing/usage`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    assert(resUsage.status === 200, 'GET /api/billing/usage returns 200 OK');
    const usageData = await resUsage.json();
    assert(usageData.success === true, 'Usage response indicates success');
    assert(usageData.usage.branches.used === 0, 'Used branch count starts at 0');
    assert(usageData.usage.branches.limit === 1, 'FREE plan branch limit is 1');
    assert(usageData.usage.devices.limit === 2, 'FREE plan device limit is 2');

    // --------------------------------------------------------------------------
    // 3. LIMIT ENFORCEMENT & DYNAMIC CALCULATIONS
    // --------------------------------------------------------------------------
    console.log('\n--- 3. Resource Limit Enforcement & Dynamic Calculations ---');
    
    // Create first branch (within limit)
    const resCreateBranch1 = await fetch(`${baseUrl}/api/outlets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Flagship P7 Outlet', address: '123 Main St' }),
    });
    assert(resCreateBranch1.status === 200, 'Creating first branch succeeds (limit 1)');

    // Attempt second branch (exceeds limit)
    const resCreateBranch2 = await fetch(`${baseUrl}/api/outlets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Secondary P7 Outlet', address: '456 Secondary St' }),
    });
    assert(resCreateBranch2.status === 403, 'Creating second branch is rejected with 403 Forbidden');
    const branch2Err = await resCreateBranch2.json();
    assert(branch2Err.error.includes('LIMIT_EXCEEDED'), 'Error details accurately indicate limit violation');

    // --------------------------------------------------------------------------
    // 4. PLAN UPGRADES / ENTITLEMENT MODIFICATIONS
    // --------------------------------------------------------------------------
    console.log('\n--- 4. Plan Upgrade and Entitlement Modification ---');
    
    // Upgrade plan to STARTER
    const resUpgrade = await fetch(`${baseUrl}/api/billing/change-plan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan: 'STARTER' }),
    });
    assert(resUpgrade.status === 200, 'Upgrading plan to STARTER succeeds');

    // Verify limit increased dynamically to 2
    const resUsage2 = await fetch(`${baseUrl}/api/billing/usage`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const usageData2 = await resUsage2.json();
    assert(usageData2.usage.branches.limit === 2, 'STARTER plan branch limit increased to 2');

    // Try creating second branch now (should succeed)
    const resCreateBranch2Retry = await fetch(`${baseUrl}/api/outlets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Secondary P7 Outlet', address: '456 Secondary St' }),
    });
    assert(resCreateBranch2Retry.status === 200, 'Creating second branch succeeds after upgrade');

    // Try creating third branch (should exceed limit)
    const resCreateBranch3 = await fetch(`${baseUrl}/api/outlets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Tertiary P7 Outlet', address: '789 Tertiary St' }),
    });
    assert(resCreateBranch3.status === 403, 'Creating third branch fails on STARTER (limit 2)');

    // --------------------------------------------------------------------------
    // 5. DOWNGRADES & RESOURCE RETENTION (NO DATA DELETION)
    // --------------------------------------------------------------------------
    console.log('\n--- 5. Downgrade and Resource Retention ---');
    
    // Downgrade back to FREE
    const resDowngrade = await fetch(`${baseUrl}/api/billing/change-plan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan: 'FREE' }),
    });
    assert(resDowngrade.status === 200, 'Downgrading back to FREE succeeds');

    // Verify resources remain intact
    const activeOutlets = await prisma.outlet.findMany({ where: { organizationId: orgId, active: true } });
    assert(activeOutlets.length === 2, 'Downgrade does NOT delete existing branches (retains data safely)');

    // Creation remains restricted
    const resCreateBranchDowngraded = await fetch(`${baseUrl}/api/outlets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Extra P7 Outlet' }),
    });
    assert(resCreateBranchDowngraded.status === 403, 'Creating new resources is blocked while in over-limit state');

    // --------------------------------------------------------------------------
    // 6. CRYPTOGRAPHIC WEBHOOK HANDLERS & IDEMPOTENCY
    // --------------------------------------------------------------------------
    console.log('\n--- 6. Cryptographic Webhooks, Idempotency & Out-of-Order Check ---');

    // Valid webhook payload to change plan to ENTERPRISE
    const eventId = 'evt_p7_test_webhook_001';
    const payload: WebhookEventPayload = {
      eventId,
      timestamp: 1700000000,
      type: 'subscription.updated',
      customerProviderId: providerCustomerId,
      subscriptionProviderId: 'sub_external_p7',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
    };

    const signature = mockProvider.generateWebhookSignature(JSON.stringify(payload), webhookSecret);

    // Dispatch valid webhook
    const resWebhookOk = await fetch(`${baseUrl}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
      },
      body: JSON.stringify(payload),
    });
    assert(resWebhookOk.status === 200, 'Valid webhook signature and payload returns 200 OK');
    const webhookResult = await resWebhookOk.json();
    assert(webhookResult.success === true, 'Webhook indicates successful processing');

    // Check DB updated
    const updatedSub = await prisma.subscription.findFirst({ where: { organizationId: orgId } });
    assert(updatedSub?.plan === 'ENTERPRISE', 'Webhook transition successfully upgraded subscription to ENTERPRISE');

    // Duplicate event (Idempotency check)
    const resWebhookDuplicate = await fetch(`${baseUrl}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
      },
      body: JSON.stringify(payload),
    });
    assert(resWebhookDuplicate.status === 200, 'Duplicate webhook returns 200 OK');
    const webhookDupResult = await resWebhookDuplicate.json();
    assert(webhookDupResult.message.includes('DUPLICATE_EVENT'), 'Duplicate event is safely ignored without re-processing');

    // Out-of-Order check (older timestamp)
    const olderPayload: WebhookEventPayload = {
      eventId: 'evt_p7_test_webhook_older',
      timestamp: 1600000000, // Older than 1700000000
      type: 'subscription.updated',
      customerProviderId: providerCustomerId,
      subscriptionProviderId: 'sub_external_p7',
      plan: 'STARTER',
      status: 'ACTIVE',
    };
    const olderSig = mockProvider.generateWebhookSignature(JSON.stringify(olderPayload), webhookSecret);
    const resWebhookOlder = await fetch(`${baseUrl}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': olderSig,
      },
      body: JSON.stringify(olderPayload),
    });
    assert(resWebhookOlder.status === 200, 'Older webhook returns 200 OK');
    const olderResult = await resWebhookOlder.json();
    assert(olderResult.message.includes('OUT_OF_ORDER'), 'Older event is safely rejected to protect newer state');

    // Strict tenant mapping (unmapped customer ID)
    const unmappedPayload: WebhookEventPayload = {
      eventId: 'evt_p7_unmapped',
      timestamp: 1800000000,
      type: 'subscription.updated',
      customerProviderId: 'cust_unmapped_foreign_id',
      subscriptionProviderId: 'sub_external_p7',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
    };
    const unmappedSig = mockProvider.generateWebhookSignature(JSON.stringify(unmappedPayload), webhookSecret);
    const resWebhookUnmapped = await fetch(`${baseUrl}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': unmappedSig,
      },
      body: JSON.stringify(unmappedPayload),
    });
    assert(resWebhookUnmapped.status === 400, 'Unmapped customer ID webhook returns 400 Bad Request');
    const unmappedResult = await resWebhookUnmapped.json();
    assert(unmappedResult.message.includes('UNMAPPED_CUSTOMER'), 'Unmapped providerCustomerId returns descriptive error');

    // Invalid signature rejection
    const resWebhookBadSig = await fetch(`${baseUrl}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': 'invalid_sig',
      },
      body: JSON.stringify(payload),
    });
    assert(resWebhookBadSig.status === 400, 'Invalid webhook signature returns 400 Bad Request');
    const badSigResult = await resWebhookBadSig.json();
    assert(badSigResult.message.includes('INVALID_SIGNATURE'), 'Invalid signature yields explicit rejection');

    // --------------------------------------------------------------------------
    // 7. DEVICE MANAGEMENT & LIMIT ENFORCEMENT
    // --------------------------------------------------------------------------
    console.log('\n--- 7. Device Management & Device limits ---');
    
    // Downgrade to FREE to check device limits (FREE limit is 2)
    await fetch(`${baseUrl}/api/billing/change-plan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan: 'FREE' }),
    });

    // Register 1st device
    const resDev1 = await fetch(`${baseUrl}/api/devices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceIdentifier: 'POS-DEV-1', name: 'Counter 1 POS' }),
    });
    assert(resDev1.status === 200, 'Registering first device succeeds (limit 2)');

    // Register 2nd device
    const resDev2 = await fetch(`${baseUrl}/api/devices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceIdentifier: 'POS-DEV-2', name: 'Counter 2 POS' }),
    });
    assert(resDev2.status === 200, 'Registering second device succeeds (limit 2)');

    // Attempt 3rd device (exceeds limit)
    const resDev3 = await fetch(`${baseUrl}/api/devices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceIdentifier: 'POS-DEV-3', name: 'Kitchen KDS' }),
    });
    assert(resDev3.status === 403, 'Registering third device is blocked with 403 Forbidden');
    const dev3Result = await resDev3.json();
    assert(dev3Result.error.includes('LIMIT_EXCEEDED'), 'Device limit violation properly reported');

  } catch (err: any) {
    console.error('Fatal Test Suite Error:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log(`📊 PHASE 7 SAAS BILLING TEST RUN COMPLETED:`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSaaSBillingTests();
