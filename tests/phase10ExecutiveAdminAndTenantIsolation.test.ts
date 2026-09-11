/**
 * PHASE 10 TEST SUITE: EXECUTIVE PLATFORM ADMIN & CANARY MULTI-TENANT ISOLATION
 */

process.env.NODE_ENV = 'test';

import { app } from '../server';
import http from 'http';
import prisma from '../src/server/prisma';
import { signTenantToken } from '../src/server/auth/jwt';
import bcrypt from 'bcryptjs';

let server: http.Server;
let port: number;
let baseUrl: string;

let assertionsPassed = 0;
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  assertionsPassed++;
  console.log(`  ✓ ${message}`);
}

async function request(path: string, options: { method?: string; body?: any; token?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data, headers: res.headers };
}

async function runTests() {
  console.log('\n======================================================================');
  console.log('🛡️  STARTING PHASE 10: EXECUTIVE ADMIN & MULTI-TENANT CANARY AUDIT');
  console.log('======================================================================\n');

  // Start temporary server
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      port = addr.port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test server running at ${baseUrl}`);
      resolve();
    });
  });

  try {
    // ------------------------------------------------------------------------
    // SETUP: 3 CANARY TENANTS & USERS
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Setting Up 3-Tenant Canary Environment (Alpha, Beta, Gamma) ---');

    // Tenant Alpha
    const orgAlpha = await prisma.organization.upsert({
      where: { id: 'org_canary_alpha' },
      update: { status: 'ACTIVE' },
      create: {
        id: 'org_canary_alpha',
        name: 'Alpha Bistro',
        slug: 'alpha-bistro',
        status: 'ACTIVE',
      },
    });

    const userAlphaOwner = await prisma.user.upsert({
      where: { id: 'user_alpha_owner' },
      update: { role: 'OWNER', active: true },
      create: {
        id: 'user_alpha_owner',
        organizationId: orgAlpha.id,
        name: 'Alpha Owner',
        username: 'alpha_owner',
        pin: '1111',
        role: 'OWNER',
        active: true,
      },
    });

    // Tenant Beta
    const orgBeta = await prisma.organization.upsert({
      where: { id: 'org_canary_beta' },
      update: { status: 'ACTIVE' },
      create: {
        id: 'org_canary_beta',
        name: 'Beta Grill',
        slug: 'beta-grill',
        status: 'ACTIVE',
      },
    });

    const userBetaOwner = await prisma.user.upsert({
      where: { id: 'user_beta_owner' },
      update: { role: 'OWNER', active: true },
      create: {
        id: 'user_beta_owner',
        organizationId: orgBeta.id,
        name: 'Beta Owner',
        username: 'beta_owner',
        pin: '2222',
        role: 'OWNER',
        active: true,
      },
    });

    // Seed Beta Subscription
    await prisma.subscription.upsert({
      where: { id: 'sub_canary_beta' },
      update: { plan: 'STARTER', status: 'ACTIVE' },
      create: {
        id: 'sub_canary_beta',
        organizationId: orgBeta.id,
        plan: 'STARTER',
        status: 'ACTIVE',
      },
    });

    // Tenant Gamma
    const orgGamma = await prisma.organization.upsert({
      where: { id: 'org_canary_gamma' },
      update: { status: 'ACTIVE' },
      create: {
        id: 'org_canary_gamma',
        name: 'Gamma Cafe',
        slug: 'gamma-cafe',
        status: 'ACTIVE',
      },
    });

    // Platform Executive Admin User
    const platformAdminUser = await prisma.user.upsert({
      where: { id: 'user_test_platform_admin' },
      update: { role: 'PLATFORM_ADMIN', active: true },
      create: {
        id: 'user_test_platform_admin',
        organizationId: orgAlpha.id,
        name: 'Platform Executive Admin',
        username: 'platform_executive_tester',
        pin: '9999',
        role: 'PLATFORM_ADMIN',
        active: true,
      },
    });

    // Generate JWT Tokens
    const tokenAlphaOwner = signTenantToken({
      userId: userAlphaOwner.id,
      organizationId: orgAlpha.id,
      role: 'OWNER',
    });

    const tokenBetaOwner = signTenantToken({
      userId: userBetaOwner.id,
      organizationId: orgBeta.id,
      role: 'OWNER',
    });

    const tokenPlatformAdmin = signTenantToken({
      userId: platformAdminUser.id,
      organizationId: orgAlpha.id,
      role: 'PLATFORM_ADMIN',
    });

    assert(Boolean(tokenAlphaOwner && tokenBetaOwner && tokenPlatformAdmin), 'Generated valid test JWT tokens for all actors');

    // ------------------------------------------------------------------------
    // TEST SECTION 1: PLATFORM ADMIN SECURITY BOUNDARY
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Testing Platform Admin Security Boundary (/api/platform-admin/*) ---');

    // 1. Unauthenticated request to /api/platform-admin/overview
    const anonOverview = await request('/api/platform-admin/overview');
    assert(anonOverview.status === 401, 'Anonymous request to /api/platform-admin/overview returned 401 Unauthorized');

    // 2. Restaurant Owner request to /api/platform-admin/overview
    const ownerOverview = await request('/api/platform-admin/overview', { token: tokenAlphaOwner });
    assert(ownerOverview.status === 403, 'Restaurant OWNER request to /api/platform-admin/overview returned 403 Forbidden');
    assert(ownerOverview.data.code === 'FORBIDDEN_PLATFORM_ADMIN_REQUIRED', 'Returned FORBIDDEN_PLATFORM_ADMIN_REQUIRED error code');

    // 3. Platform Admin request to /api/platform-admin/overview
    const adminOverview = await request('/api/platform-admin/overview', { token: tokenPlatformAdmin });
    assert(adminOverview.status === 200, 'Platform Admin request to /api/platform-admin/overview returned 200 OK');
    assert(adminOverview.data.success === true, 'Platform overview returned success: true');
    assert(adminOverview.data.data.tenants.total >= 3, 'Platform overview counted at least 3 active tenants');
    assert(Boolean(adminOverview.data.data.system.nodeVersion), 'Platform overview includes system node runtime info');

    // ------------------------------------------------------------------------
    // TEST SECTION 2: FLEET MANAGEMENT & DRILLDOWN
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing Platform Fleet Listing & Drilldown ---');

    // List Organizations
    const orgsRes = await request('/api/platform-admin/organizations', { token: tokenPlatformAdmin });
    assert(orgsRes.status === 200, 'GET /api/platform-admin/organizations returned 200 OK');
    assert(Array.isArray(orgsRes.data.data), 'Returned organizations list array');
    const hasAlpha = orgsRes.data.data.some((o: any) => o.id === orgAlpha.id);
    const hasBeta = orgsRes.data.data.some((o: any) => o.id === orgBeta.id);
    assert(hasAlpha && hasBeta, 'Organization list accurately contains Alpha and Beta tenants');

    // Get Organization Drilldown
    const drilldownRes = await request(`/api/platform-admin/organizations/${orgBeta.id}`, { token: tokenPlatformAdmin });
    assert(drilldownRes.status === 200, 'GET /api/platform-admin/organizations/:id returned 200 OK');
    assert(drilldownRes.data.data.name === 'Beta Grill', 'Drilldown details accurately match Beta Grill');
    assert(Array.isArray(drilldownRes.data.data.users), 'Drilldown contains users list');

    // ------------------------------------------------------------------------
    // TEST SECTION 3: SUSPENSION & TENANT BLOCKING
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Testing Tenant Suspension & Live API Blocking ---');

    // Suspend Tenant Beta via Platform Admin
    const suspendRes = await request(`/api/platform-admin/organizations/${orgBeta.id}/status`, {
      method: 'PATCH',
      token: tokenPlatformAdmin,
      body: { status: 'SUSPENDED', reason: 'Billing delinquency test' },
    });
    assert(suspendRes.status === 200, 'PATCH /api/platform-admin/organizations/:id/status returned 200 OK');
    assert(suspendRes.data.data.status === 'SUSPENDED', 'Beta organization status set to SUSPENDED');

    // Now test if Beta Owner is strictly blocked from normal restaurant endpoints
    const betaBlockedRes = await request('/api/orders', { token: tokenBetaOwner });
    assert(betaBlockedRes.status === 403, 'Suspended Beta tenant token is strictly blocked with 403 on /api/orders');
    assert(betaBlockedRes.data.code === 'ORGANIZATION_SUSPENDED', 'Response returned code ORGANIZATION_SUSPENDED');

    // Meanwhile, Alpha Owner must continue to work normally
    const alphaOrderRes = await request('/api/orders', { token: tokenAlphaOwner });
    assert(alphaOrderRes.status === 200, 'Active Alpha tenant is unaffected by Beta suspension (200 OK)');

    // Re-activate Tenant Beta
    const reactivateRes = await request(`/api/platform-admin/organizations/${orgBeta.id}/status`, {
      method: 'PATCH',
      token: tokenPlatformAdmin,
      body: { status: 'ACTIVE', reason: 'Account restored' },
    });
    assert(reactivateRes.status === 200, 'Reactivated Beta organization to ACTIVE');

    // Verify Beta token works again
    const betaRestoredRes = await request('/api/orders', { token: tokenBetaOwner });
    assert(betaRestoredRes.status === 200, 'Beta tenant access successfully restored (200 OK)');

    // ------------------------------------------------------------------------
    // TEST SECTION 4: SUBSCRIPTION PLAN MANAGEMENT
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Testing SaaS Subscriptions & Tier Updates ---');

    const subListRes = await request('/api/platform-admin/subscriptions', { token: tokenPlatformAdmin });
    assert(subListRes.status === 200, 'GET /api/platform-admin/subscriptions returned 200 OK');
    assert(Array.isArray(subListRes.data.data), 'Returned subscriptions array');

    // Update Beta Subscription to ENTERPRISE
    const subUpdateRes = await request('/api/platform-admin/subscriptions/sub_canary_beta/plan', {
      method: 'PATCH',
      token: tokenPlatformAdmin,
      body: { plan: 'ENTERPRISE' },
    });
    assert(subUpdateRes.status === 200, 'PATCH /api/platform-admin/subscriptions/:id/plan returned 200 OK');
    assert(subUpdateRes.data.data.plan === 'ENTERPRISE', 'Beta subscription plan successfully changed to ENTERPRISE');

    // ------------------------------------------------------------------------
    // TEST SECTION 5: GLOBAL USER TOGGLE & HEALTH DIAGNOSTICS
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Testing Global User Status & Health Diagnostics ---');

    // Query global users
    const usersRes = await request('/api/platform-admin/users', { token: tokenPlatformAdmin });
    assert(usersRes.status === 200, 'GET /api/platform-admin/users returned 200 OK');
    assert(Array.isArray(usersRes.data.data), 'Returned global users list');

    // Deactivate Beta Owner
    const deactUserRes = await request(`/api/platform-admin/users/${userBetaOwner.id}/status`, {
      method: 'PATCH',
      token: tokenPlatformAdmin,
      body: { active: false, reason: 'Staff departure' },
    });
    assert(deactUserRes.status === 200, 'Deactivated user account via platform admin');

    // Verify Beta Owner token is now rejected due to inactive user account
    const betaUserBlockedRes = await request('/api/orders', { token: tokenBetaOwner });
    assert(betaUserBlockedRes.status === 401, 'Deactivated user account is rejected with 401 Unauthorized');

    // Reactivate Beta Owner
    await request(`/api/platform-admin/users/${userBetaOwner.id}/status`, {
      method: 'PATCH',
      token: tokenPlatformAdmin,
      body: { active: true },
    });

    // Health diagnostics endpoint
    const healthRes = await request('/api/platform-admin/health', { token: tokenPlatformAdmin });
    assert(healthRes.status === 200, 'GET /api/platform-admin/health returned 200 OK');
    assert(healthRes.data.status === 'HEALTHY', 'Platform reports HEALTHY database & service state');
    assert(typeof healthRes.data.database.latencyMs === 'number', 'Reports precise DB latency in ms');

    // ------------------------------------------------------------------------
    // TEST SECTION 6: PLATFORM AUDIT TRAIL
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Verifying Platform Audit Trail ---');

    const auditRes = await request('/api/platform-admin/audit-logs', { token: tokenPlatformAdmin });
    assert(auditRes.status === 200, 'GET /api/platform-admin/audit-logs returned 200 OK');
    assert(Array.isArray(auditRes.data.data), 'Audit logs array returned');
    assert(auditRes.data.data.length > 0, 'Audit logs recorded recent administrative actions');

    console.log('\n======================================================================');
    console.log(`🎉 ALL ${assertionsPassed} PHASE 10 ASSERTIONS PASSED!`);
    console.log('======================================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  if (server) server.close();
  process.exit(1);
});
