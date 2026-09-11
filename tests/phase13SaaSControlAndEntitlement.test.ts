process.env.NODE_ENV = 'test';

import http from 'http';
import express from 'express';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import prisma from '../src/server/prisma';
import app from '../server';
import { checkPOSEntitlement } from '../src/server/middleware/subscriptionMiddleware';

const JWT_SECRET = process.env.JWT_SECRET || 'tillora_jwt_secret_dev_32char_key_min';

async function runPhase13Tests() {
  console.log('======================================================================');
  console.log('🚀 STARTING PHASE 13: SAAS SUBSCRIPTION ACCESS CONTROL & LOCKOUT SUITE');
  console.log('======================================================================');

  await prisma.$connect();
  const server = http.createServer(app);
  let baseUrl = '';

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`Phase 13 Test Server running at ${baseUrl}`);
      resolve();
    });
  });

  let activeOrgId = '';
  let expiredOrgId = '';

  try {
    // 1. Create Active Subscription Organization
    const activeOrg = await prisma.organization.create({
      data: {
        name: 'Phase13 Active Cafe',
        slug: `phase13-active-${Date.now()}`,
        subscriptions: {
          create: {
            plan: 'BUSINESS',
            status: 'ACTIVE',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 86400 * 1000),
          },
        },
      },
    });
    activeOrgId = activeOrg.id;

    // 2. Create Expired Subscription Organization
    const expiredOrg = await prisma.organization.create({
      data: {
        name: 'Phase13 Expired Bistro',
        slug: `phase13-expired-${Date.now()}`,
        subscriptions: {
          create: {
            plan: 'STARTER',
            status: 'PAST_DUE',
            startDate: new Date(Date.now() - 60 * 86400 * 1000),
            endDate: new Date(Date.now() - 5 * 86400 * 1000), // Expired 5 days ago
          },
        },
      },
    });
    expiredOrgId = expiredOrg.id;

    // Create user accounts for testing auth
    const activeUser = await prisma.user.create({
      data: {
        organizationId: activeOrgId,
        username: `cashier_active_${Date.now()}`,
        name: 'Active Cashier',
        role: 'CASHIER',
        pin: '1234',
      },
    });

    const expiredOwner = await prisma.user.create({
      data: {
        organizationId: expiredOrgId,
        username: `owner_expired_${Date.now()}`,
        name: 'Expired Owner',
        role: 'OWNER',
        pin: '1234',
      },
    });

    const expiredCashier = await prisma.user.create({
      data: {
        organizationId: expiredOrgId,
        username: `cashier_expired_${Date.now()}`,
        name: 'Expired Cashier',
        role: 'CASHIER',
        pin: '1234',
      },
    });

    // JWT Tokens
    const activeCashierToken = jwt.sign(
      { userId: activeUser.id, organizationId: activeOrgId, role: 'CASHIER', username: activeUser.username },
      JWT_SECRET
    );

    const expiredOwnerToken = jwt.sign(
      { userId: expiredOwner.id, organizationId: expiredOrgId, role: 'OWNER', username: expiredOwner.username },
      JWT_SECRET
    );

    const expiredCashierToken = jwt.sign(
      { userId: expiredCashier.id, organizationId: expiredOrgId, role: 'CASHIER', username: expiredCashier.username },
      JWT_SECRET
    );

    // --- TEST 1: Authoritative check on Active Subscription ---
    console.log('\n--- Test 1: Authoritative check on Active Subscription ---');
    const activeCheck = await checkPOSEntitlement(activeOrgId);
    assert.strictEqual(activeCheck.allowed, true, 'Active subscription must be allowed POS access');
    console.log('✅ Active subscription check passed');

    // --- TEST 2: Authoritative check on Expired Subscription ---
    console.log('\n--- Test 2: Authoritative check on Expired Subscription ---');
    const expiredCheck = await checkPOSEntitlement(expiredOrgId);
    assert.strictEqual(expiredCheck.allowed, false, 'Expired subscription must be blocked');
    assert.strictEqual(expiredCheck.code, 'SUBSCRIPTION_EXPIRED', 'Expected error code SUBSCRIPTION_EXPIRED');
    console.log('✅ Expired subscription check passed');

    // --- TEST 3: POS route order creation allowed for active subscription ---
    console.log('\n--- Test 3: Order creation allowed for active subscription ---');
    const activeOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeCashierToken}`,
      },
      body: JSON.stringify({
        items: [{ id: 'item-1', name: 'Coffee', quantity: 1, price: 5.0 }],
      }),
    });
    // Status should be 200 or 201 or 400 (if validation), but NOT 403 SUBSCRIPTION_EXPIRED
    assert.notStrictEqual(activeOrderRes.status, 403, 'Active subscription should not return 403 Forbidden on order route');
    console.log('✅ Active order creation access passed');

    // --- TEST 4: POS route order creation strictly BLOCKED for expired subscription ---
    console.log('\n--- Test 4: Order creation strictly BLOCKED for expired subscription ---');
    const expiredOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expiredCashierToken}`,
      },
      body: JSON.stringify({
        items: [{ id: 'item-1', name: 'Coffee', quantity: 1, price: 5.0 }],
      }),
    });
    assert.strictEqual(expiredOrderRes.status, 403, 'Expired subscription must return 403 Forbidden');
    const expiredOrderData = await expiredOrderRes.json();
    assert.strictEqual(expiredOrderData.code, 'SUBSCRIPTION_EXPIRED', 'Expected code SUBSCRIPTION_EXPIRED');
    assert.strictEqual(expiredOrderData.subscriptionExpired, true, 'Expected subscriptionExpired: true');
    console.log('✅ Expired order creation blocked with 403 SUBSCRIPTION_EXPIRED');

    // --- TEST 5: POS shift opening BLOCKED for expired subscription ---
    console.log('\n--- Test 5: Shift opening BLOCKED for expired subscription ---');
    const expiredShiftRes = await fetch(`${baseUrl}/api/shifts/open`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expiredCashierToken}`,
      },
      body: JSON.stringify({ startingFloat: 100 }),
    });
    assert.strictEqual(expiredShiftRes.status, 403, 'Expired shift open must return 403 Forbidden');
    console.log('✅ Expired shift operation blocked');

    // --- TEST 6: Customer Portal allows OWNER of expired subscription to access billing ---
    console.log('\n--- Test 6: Customer Portal allows OWNER of expired subscription to access portal ---');
    const portalRes = await fetch(`${baseUrl}/api/portal/subscription`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${expiredOwnerToken}`,
      },
    });
    assert.strictEqual(portalRes.status, 200, 'Owner must be able to view subscription portal even if expired');
    const portalData = await portalRes.json();
    assert.strictEqual(portalData.success, true);
    console.log('✅ Portal access granted for expired organization OWNER for renewal');

    // --- TEST 7: Customer Portal blocks CASHIER ---
    console.log('\n--- Test 7: Customer Portal blocks non-admin CASHIER ---');
    const portalCashierRes = await fetch(`${baseUrl}/api/portal/subscription`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${expiredCashierToken}`,
      },
    });
    assert.strictEqual(portalCashierRes.status, 403, 'Cashier must be blocked from Customer Portal');
    console.log('✅ Customer Portal correctly restricted to admin roles');

    // --- TEST 8: Reactivating subscription restores POS entitlement instantly ---
    console.log('\n--- Test 8: Reactivating subscription restores POS entitlement instantly ---');
    await prisma.subscription.updateMany({
      where: { organizationId: expiredOrgId },
      data: {
        status: 'ACTIVE',
        endDate: new Date(Date.now() + 30 * 86400 * 1000),
      },
    });

    const restoredCheck = await checkPOSEntitlement(expiredOrgId);
    assert.strictEqual(restoredCheck.allowed, true, 'Restored subscription must grant POS entitlement');

    const restoredOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expiredCashierToken}`,
      },
      body: JSON.stringify({
        items: [{ id: 'item-1', name: 'Coffee', quantity: 1, price: 5.0 }],
      }),
    });
    assert.notStrictEqual(restoredOrderRes.status, 403, 'Restored subscription must no longer return 403');
    console.log('✅ Access restoration verified successfully');

    console.log('\n======================================================================');
    console.log('🎉 ALL PHASE 13 SAAS ACCESS CONTROL TESTS PASSED PERFECTLY!');
    console.log('======================================================================');
  } catch (err) {
    console.error('❌ Phase 13 Test Failure:', err);
    process.exit(1);
  } finally {
    // Cleanup test data
    if (activeOrgId) {
      await prisma.user.deleteMany({ where: { organizationId: activeOrgId } });
      await prisma.subscription.deleteMany({ where: { organizationId: activeOrgId } });
      await prisma.organization.deleteMany({ where: { id: activeOrgId } });
    }
    if (expiredOrgId) {
      await prisma.user.deleteMany({ where: { organizationId: expiredOrgId } });
      await prisma.subscription.deleteMany({ where: { organizationId: expiredOrgId } });
      await prisma.organization.deleteMany({ where: { id: expiredOrgId } });
    }
    server.close();
    await prisma.$disconnect();
  }
}

runPhase13Tests();
