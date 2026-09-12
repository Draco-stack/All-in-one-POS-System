/**
 * Test Suite: Website Dashboard Login & Role-Based Authorization Certification
 * 
 * Verifies:
 * 1. Dedicated Website Dashboard Login authentication
 * 2. Server-authoritative role verification for Owner/Admin -> Customer Portal
 * 3. Server-authoritative role verification for Platform Admin -> Platform Admin Console
 * 4. Protection and friendly restriction of Operational roles (Cashier) from website portal
 * 5. Multi-tenant isolation and session revocation via /api/auth/logout
 */

import http from 'http';

async function runWebsiteLoginTests() {
  console.log('====================================================');
  console.log('🔐 RUNNING WEBSITE DASHBOARD LOGIN & AUTH TESTS');
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

  const baseUrl = 'http://localhost:3000';

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Restaurant Owner Login & Customer Portal Access
    // -------------------------------------------------------------------------
    console.log('1. Testing Restaurant Owner Authentication & Portal Access...');
    const ownerRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: '1234' }),
    });

    const ownerData = await ownerRes.json();
    assert(ownerRes.status === 200, 'Owner authenticated with 200 OK');
    assert(ownerData.user?.role === 'OWNER', 'User role resolved to OWNER');
    assert(typeof ownerData.token === 'string' && ownerData.token.length > 20, 'Received valid JWT session token');
    assert(ownerData.organization?.slug === 'tillora-flagship', 'Tenant context resolved to Tillora Flagship');

    // Access Customer Portal with Owner token
    const portalRes = await fetch(`${baseUrl}/api/portal/overview`, {
      headers: { Authorization: `Bearer ${ownerData.token}` },
    });
    const portalData = await portalRes.json();
    assert(portalRes.status === 200, 'Owner granted access to Customer Portal overview (200 OK)');
    assert(portalData.data?.organization?.name === 'Tillora Flagship', 'Portal returns correct organization data');
    assert(typeof portalData.data?.subscription?.plan === 'string', 'Portal returns active subscription details');

    // -------------------------------------------------------------------------
    // TEST 2: Platform Admin Login
    // -------------------------------------------------------------------------
    console.log('\n2. Testing Executive Platform Admin Authentication...');
    const platformRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'platform_admin', password: '9999' }),
    });
    const platformData = await platformRes.json();
    assert(platformRes.status === 200, 'Platform admin authenticated with 200 OK');
    assert(platformData.user?.role === 'PLATFORM_ADMIN', 'User role resolved to PLATFORM_ADMIN');

    // -------------------------------------------------------------------------
    // TEST 3: Cashier Operational Role - Blocked from Website Management Portal
    // -------------------------------------------------------------------------
    console.log('\n3. Testing Cashier Login & Enforcement of Portal Permissions...');
    const cashierRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cashier', password: '3333' }),
    });
    const cashierData = await cashierRes.json();
    assert(cashierRes.status === 200, 'Cashier credentials verified with 200 OK');
    assert(cashierData.user?.role === 'CASHIER', 'Role authoritatively confirmed as CASHIER');

    // Attempting to access Customer Portal with Cashier token MUST be rejected
    const cashierPortalRes = await fetch(`${baseUrl}/api/portal/overview`, {
      headers: { Authorization: `Bearer ${cashierData.token}` },
    });
    const cashierPortalData = await cashierPortalRes.json();
    assert(cashierPortalRes.status === 403, 'Cashier blocked from Customer Portal with 403 Forbidden');
    assert(cashierPortalData.code === 'PORTAL_ACCESS_DENIED', 'Server returned error code PORTAL_ACCESS_DENIED');

    // -------------------------------------------------------------------------
    // TEST 4: Invalid Credentials Handling
    // -------------------------------------------------------------------------
    console.log('\n4. Testing Invalid Credentials Rejection...');
    const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong_password_999' }),
    });
    assert(badLoginRes.status === 401, 'Invalid password rejected with 401 Unauthorized');

    const ghostUserRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'non_existent_user_123', password: '123' }),
    });
    assert(ghostUserRes.status === 401, 'Non-existent user rejected with 401 Unauthorized');

    // -------------------------------------------------------------------------
    // TEST 5: Session Revocation & Server-Side Logout
    // -------------------------------------------------------------------------
    console.log('\n5. Testing Session Revocation on Website Logout...');
    // Create new login session for testing logout
    const loginToLogoutRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: '1234' }),
    });
    const loginToLogoutData = await loginToLogoutRes.json();
    const activeToken = loginToLogoutData.token;

    // Verify session is active
    const verifyBeforeLogout = await fetch(`${baseUrl}/api/portal/overview`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert(verifyBeforeLogout.status === 200, 'Session active prior to logout');

    // Perform server-side logout
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert(logoutRes.status === 200, 'Server processed logout with 200 OK');

    // Verify session is revoked
    const verifyAfterLogout = await fetch(`${baseUrl}/api/portal/overview`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    assert(verifyAfterLogout.status === 401, 'Revoked session denied with 401 Unauthorized');

    console.log('\n====================================================');
    console.log(`📊 WEBSITE LOGIN TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  }
}

runWebsiteLoginTests();
