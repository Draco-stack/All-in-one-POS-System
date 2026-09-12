/**
 * EXECUTIVE ADMIN PLATFORM-WIDE FLEET MANAGEMENT TEST SUITE
 * 
 * Verifies:
 * 1. Platform-wide super-admin visibility and control over all organizations, branches, staff, devices, and orders.
 * 2. Strict tenant isolation maintenance: regular restaurant owners/managers cannot access platform endpoints.
 * 3. Audited Support Sessions ("View as Restaurant").
 * 4. Safe credential resets (temporary passwords, hash security, session revocation).
 */

import { app } from '../server';
import http from 'http';
import prisma from '../src/server/prisma';
import { signTenantToken } from '../src/server/auth/jwt';

let server: http.Server;
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
  console.log('👑 STARTING EXECUTIVE ADMIN PLATFORM-WIDE FLEET MANAGEMENT AUDIT');
  console.log('======================================================================\n');

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`Test server running at ${baseUrl}`);
      resolve();
    });
  });

  try {
    // 1. Setup Test Organizations & Users
    console.log('--- 1. Setting Up Test Tenants and Tokens ---');
    const orgAlpha = await prisma.organization.upsert({
      where: { id: 'org_fleet_alpha' },
      create: {
        id: 'org_fleet_alpha',
        name: 'Alpha Dining Co',
        slug: 'alpha-dining',
        status: 'ACTIVE',
      },
      update: { name: 'Alpha Dining Co', status: 'ACTIVE' },
    });

    const orgBeta = await prisma.organization.upsert({
      where: { id: 'org_fleet_beta' },
      create: {
        id: 'org_fleet_beta',
        name: 'Beta Gourmet',
        slug: 'beta-gourmet',
        status: 'ACTIVE',
      },
      update: { name: 'Beta Gourmet', status: 'ACTIVE' },
    });

    const userAlphaOwner = await prisma.user.upsert({
      where: { id: 'user_alpha_owner_fleet' },
      create: {
        id: 'user_alpha_owner_fleet',
        organizationId: orgAlpha.id,
        name: 'Alpha Owner',
        username: 'alpha_owner_fleet',
        pin: '1111',
        role: 'OWNER',
        active: true,
      },
      update: { active: true },
    });

    const platformAdminUser = await prisma.user.upsert({
      where: { id: 'exec_super_admin_fleet' },
      create: {
        id: 'exec_super_admin_fleet',
        organizationId: orgAlpha.id,
        name: 'Executive Super Admin',
        username: 'platform_admin_fleet',
        pin: '9999',
        role: 'PLATFORM_ADMIN',
        active: true,
      },
      update: { role: 'PLATFORM_ADMIN', active: true },
    });

    // Create Platform Admin and Restaurant Owner tokens
    const platformAdminToken = signTenantToken({
      userId: platformAdminUser.id,
      username: platformAdminUser.username,
      role: 'PLATFORM_ADMIN',
      organizationId: orgAlpha.id,
    });

    const restaurantOwnerToken = signTenantToken({
      userId: userAlphaOwner.id,
      username: userAlphaOwner.username,
      role: 'OWNER',
      organizationId: orgAlpha.id,
    });

    assert(!!platformAdminToken && !!restaurantOwnerToken, 'Generated authentication tokens');

    // 2. Strict Authorization Gate on New Endpoints
    console.log('\n--- 2. Testing Strict Security Boundaries for Non-Platform Admins ---');
    const nonAdminEndpoints = [
      { path: '/api/platform-admin/branches', method: 'GET' },
      { path: '/api/platform-admin/branches', method: 'POST', body: { name: 'Hack Branch' } },
      { path: '/api/platform-admin/devices', method: 'GET' },
      { path: '/api/platform-admin/search?q=alpha', method: 'GET' },
      { path: '/api/platform-admin/orders', method: 'GET' },
      { path: '/api/platform-admin/support-session/start', method: 'POST', body: { organizationId: orgAlpha.id } },
    ];

    for (const ep of nonAdminEndpoints) {
      const res = await request(ep.path, {
        method: ep.method,
        body: ep.body,
        token: restaurantOwnerToken,
      });
      assert(res.status === 403, `Restaurant owner strictly rejected with 403 on ${ep.method} ${ep.path}`);
    }

    // 3. Platform Admin Global Search
    console.log('\n--- 3. Testing Global Platform Fleet Search ---');
    const searchRes = await request('/api/platform-admin/search?q=alpha', {
      token: platformAdminToken,
    });
    assert(searchRes.status === 200, 'Global search returned 200 OK');
    assert(searchRes.data.success === true, 'Global search returned success: true');
    assert(Array.isArray(searchRes.data.data.organizations), 'Search results contain organizations array');
    const hasAlpha = searchRes.data.data.organizations.some((o: any) => o.id === orgAlpha.id);
    assert(hasAlpha, 'Global search found Alpha Dining Co');

    // 4. Branch Fleet Management
    console.log('\n--- 4. Testing Multi-Branch Fleet Management ---');
    // Create branch under Alpha Dining Co
    const createBranchRes = await request('/api/platform-admin/branches', {
      method: 'POST',
      body: {
        organizationId: orgAlpha.id,
        name: 'Alpha Waterfront Branch',
        slug: `alpha-waterfront-${Date.now()}`,
        address: '100 Marina Bay Drive',
        phone: '+92 300 9991111',
      },
      token: platformAdminToken,
    });
    assert(createBranchRes.status === 201, 'POST /api/platform-admin/branches created branch (201)');
    const branchId = createBranchRes.data.data.id;
    assert(!!branchId, 'Branch ID generated');

    // Get branches across platform
    const getBranchesRes = await request('/api/platform-admin/branches', {
      token: platformAdminToken,
    });
    assert(getBranchesRes.status === 200, 'GET /api/platform-admin/branches returned 200 OK');
    assert(getBranchesRes.data.data.some((b: any) => b.id === branchId), 'New branch appears in platform branch fleet');

    // Update branch
    const updateBranchRes = await request(`/api/platform-admin/branches/${branchId}`, {
      method: 'PATCH',
      body: { name: 'Alpha Waterfront Flagship' },
      token: platformAdminToken,
    });
    assert(updateBranchRes.status === 200, 'PATCH /api/platform-admin/branches/:id updated branch (200)');
    assert(updateBranchRes.data.data.name === 'Alpha Waterfront Flagship', 'Branch name was updated');

    // 5. User Creation & Credential Security
    console.log('\n--- 5. Testing Platform User Management & Safe Password Reset ---');
    const createUserRes = await request('/api/platform-admin/users', {
      method: 'POST',
      body: {
        organizationId: orgAlpha.id,
        branchId: branchId,
        name: 'Tariq Cashier',
        username: `tariq_cashier_${Date.now()}`,
        pin: '1234',
        role: 'CASHIER',
        phone: '+92 312 3456789',
      },
      token: platformAdminToken,
    });
    assert(createUserRes.status === 201, 'POST /api/platform-admin/users created user (201)');
    const newUserId = createUserRes.data.data.id;
    assert(!!newUserId, 'User created with ID');
    assert(!createUserRes.data.data.password, 'Plaintext password is NOT returned');

    // Reset password safely
    const resetRes = await request(`/api/platform-admin/users/${newUserId}/reset-password`, {
      method: 'POST',
      token: platformAdminToken,
    });
    assert(resetRes.status === 200, 'POST /api/platform-admin/users/:id/reset-password succeeded (200)');
    assert(!!resetRes.data.tempPassword, 'Secure temporary credential provided');
    assert(!resetRes.data.passwordHash, 'Password hash is NOT exposed in response');

    // Revoke user sessions
    const revokeSessionsRes = await request(`/api/platform-admin/users/${newUserId}/revoke-sessions`, {
      method: 'POST',
      token: platformAdminToken,
    });
    assert(revokeSessionsRes.status === 200, 'POST /api/platform-admin/users/:id/revoke-sessions succeeded (200)');

    // 6. Device Fleet Management
    console.log('\n--- 6. Testing POS & Connected Terminal Fleet Governance ---');
    // Register a device directly in DB for testing
    const testDevice = await prisma.device.create({
      data: {
        organizationId: orgAlpha.id,
        branchId: branchId,
        name: 'Register Counter 01',
        deviceIdentifier: `DEV_${Date.now()}`,
        deviceType: 'POS',
        status: 'ACTIVE',
      },
    });

    // List platform devices
    const getDevicesRes = await request('/api/platform-admin/devices', {
      token: platformAdminToken,
    });
    assert(getDevicesRes.status === 200, 'GET /api/platform-admin/devices returned 200 OK');
    assert(getDevicesRes.data.data.some((d: any) => d.id === testDevice.id), 'Device found in platform devices fleet');

    // Revoke device
    const revokeDevRes = await request(`/api/platform-admin/devices/${testDevice.id}/revoke`, {
      method: 'POST',
      body: { reason: 'Suspected compromised device' },
      token: platformAdminToken,
    });
    assert(revokeDevRes.status === 200, 'POST /api/platform-admin/devices/:id/revoke succeeded');
    assert(revokeDevRes.data.data.status === 'REVOKED', 'Device status transitioned to REVOKED');

    // Reactivate device
    const reactivateDevRes = await request(`/api/platform-admin/devices/${testDevice.id}/reactivate`, {
      method: 'POST',
      token: platformAdminToken,
    });
    assert(reactivateDevRes.status === 200, 'POST /api/platform-admin/devices/:id/reactivate succeeded');
    assert(reactivateDevRes.data.data.status === 'ACTIVE', 'Device status restored to ACTIVE');

    // 7. Audited Support Sessions ("View as Restaurant")
    console.log('\n--- 7. Testing Audited Support Viewing Sessions ---');
    const startSupportRes = await request('/api/platform-admin/support-session/start', {
      method: 'POST',
      body: {
        organizationId: orgAlpha.id,
        reason: 'Investigating payment discrepancy for Alpha Dining',
      },
      token: platformAdminToken,
    });
    assert(startSupportRes.status === 200, 'POST /api/platform-admin/support-session/start succeeded (200)');
    assert(startSupportRes.data.data.organization.id === orgAlpha.id, 'Support session established for Alpha Dining');
    assert(!!startSupportRes.data.data.sessionStartedAt, 'Session start timestamp recorded');

    const endSupportRes = await request('/api/platform-admin/support-session/end', {
      method: 'POST',
      body: {
        organizationId: orgAlpha.id,
        reason: 'Investigation concluded successfully',
      },
      token: platformAdminToken,
    });
    assert(endSupportRes.status === 200, 'POST /api/platform-admin/support-session/end succeeded (200)');

    // 8. Operational Orders Visibility
    console.log('\n--- 8. Testing Operational Orders Support Visibility ---');
    const getOrdersRes = await request('/api/platform-admin/orders', {
      token: platformAdminToken,
    });
    assert(getOrdersRes.status === 200, 'GET /api/platform-admin/orders returned 200 OK');
    assert(Array.isArray(getOrdersRes.data.data), 'Returned orders array for diagnostic support');

    // 9. Organization Profile Management
    console.log('\n--- 9. Testing Organization Details Update ---');
    const updateOrgRes = await request(`/api/platform-admin/organizations/${orgAlpha.id}`, {
      method: 'PATCH',
      body: {
        name: 'Alpha Dining Holdings',
      },
      token: platformAdminToken,
    });
    assert(updateOrgRes.status === 200, 'PATCH /api/platform-admin/organizations/:id succeeded (200)');
    assert(updateOrgRes.data.data.name === 'Alpha Dining Holdings', 'Organization name updated to Alpha Dining Holdings');

    console.log('\n======================================================================');
    console.log(`🎉 ALL ${assertionsPassed} EXECUTIVE ADMIN PLATFORM ASSERTIONS PASSED!`);
    console.log('======================================================================\n');
  } finally {
    if (server) {
      server.close();
    }
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
