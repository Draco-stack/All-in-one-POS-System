/**
 * HTTP Integration Test for Tenant Auth Routes & Protected Endpoints
 */

import express from 'express';
import http from 'http';
import { loginHandler, validateSessionHandler, logoutHandler } from '../src/server/controllers/authController';
import { authenticate, requireTenant, requirePermission, authenticateManager } from '../src/server/middleware/auth';
import { PERMISSIONS } from '../src/server/auth/permissions';

async function runHttpTests() {
  console.log('====================================================');
  console.log('🌐 RUNNING HTTP INTEGRATION AUTH & TENANT TESTS');
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

  // Setup test Express app
  const app = express();
  app.use(express.json());

  // Mount Auth Endpoints
  app.post('/api/auth/login', loginHandler);
  app.post('/api/auth/validate-session', validateSessionHandler);
  app.post('/api/auth/logout', logoutHandler);

  // Mount Protected Test Endpoints
  app.get('/api/test/tenant-context', authenticate, requireTenant, (req, res) => {
    res.json({
      success: true,
      tenant: req.tenant,
    });
  });

  app.post(
    '/api/test/orders-cancel',
    authenticate,
    requirePermission(PERMISSIONS.ORDERS_CANCEL),
    (req, res) => {
      res.json({ success: true, message: 'Order cancelled' });
    }
  );

  app.post('/api/test/manager-action', authenticateManager, (req, res) => {
    res.json({ success: true, message: 'Manager action executed', user: req.user, tenant: req.tenant });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // --------------------------------------------------------------------------
    // 1. LOGIN TESTS
    // --------------------------------------------------------------------------
    console.log('1. Testing Login Endpoint with Multi-Tenant Scoping...');

    // Alpha Cashier login with org slug
    const resAlpha = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: 'org-test-alpha',
        username: 'test_cashier',
        pin: '1122',
      }),
    });
    const dataAlpha: any = await resAlpha.json();
    assert(resAlpha.status === 200, 'Alpha cashier logged in with 200 OK');
    assert(dataAlpha.organization.id === 'org_test_alpha', 'Alpha cashier received Org Alpha tenant info');
    assert(typeof dataAlpha.token === 'string', 'Alpha cashier received valid JWT token');

    // Beta Cashier login with org slug
    const resBeta = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: 'org-test-beta',
        username: 'test_cashier',
        pin: '9988',
      }),
    });
    const dataBeta: any = await resBeta.json();
    assert(resBeta.status === 200, 'Beta cashier logged in with 200 OK');
    assert(dataBeta.organization.id === 'org_test_beta', 'Beta cashier received Org Beta tenant info');

    // Cross-tenant credential attack: attempt to login to Beta using Alpha PIN
    const resAttack = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: 'org-test-beta',
        username: 'test_cashier',
        pin: '1122', // Org Alpha PIN!
      }),
    });
    assert(resAttack.status === 401, 'Cross-tenant login attack rejected with 401 Unauthorized');

    // Suspended organization login attempt
    const resGamma = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: 'org-test-gamma',
        username: 'gamma_manager',
        pin: '1122',
      }),
    });
    assert(resGamma.status === 403, 'Suspended organization login rejected with 403 Forbidden');

    // --------------------------------------------------------------------------
    // 2. AUTHENTICATED TENANT CONTEXT TESTS
    // --------------------------------------------------------------------------
    console.log('\n2. Testing Protected Route Context Population...');

    const resContextAlpha = await fetch(`${baseUrl}/api/test/tenant-context`, {
      headers: { Authorization: `Bearer ${dataAlpha.token}` },
    });
    const dataContextAlpha: any = await resContextAlpha.json();
    assert(resContextAlpha.status === 200, 'Protected endpoint accessible with Alpha token');
    assert(
      dataContextAlpha.tenant.organizationId === 'org_test_alpha',
      'req.tenant.organizationId correctly resolved server-side'
    );
    assert(
      dataContextAlpha.tenant.role === 'CASHIER',
      'req.tenant.role correctly resolved'
    );

    // --------------------------------------------------------------------------
    // 3. PERMISSION ENFORCEMENT ON ROUTE
    // --------------------------------------------------------------------------
    console.log('\n3. Testing Permission Requirement Middleware...');

    // Cashier does not have orders.cancel permission
    const resCancelForbidden = await fetch(`${baseUrl}/api/test/orders-cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${dataAlpha.token}` },
    });
    assert(resCancelForbidden.status === 403, 'Cashier blocked from orders.cancel with 403 Forbidden');

    // --------------------------------------------------------------------------
    // 4. MANAGER PIN ELEVATION ISOLATION
    // --------------------------------------------------------------------------
    console.log('\n4. Testing Manager PIN Elevation Isolation on HTTP Route...');

    // Attempting manager action in Org Beta using Org Alpha Manager PIN (5555)
    const resMgrAttack = await fetch(`${baseUrl}/api/test/manager-action`, {
      method: 'POST',
      headers: {
        'x-organization-id': 'org_test_beta',
        'x-manager-pin': '5555', // Org Alpha PIN
      },
    });
    assert(
      resMgrAttack.status === 403,
      'Cross-tenant Manager PIN attempt in Org Beta rejected with 403 Forbidden'
    );

    // Manager action in Org Beta using Org Beta Manager PIN (7777)
    const resMgrSuccess = await fetch(`${baseUrl}/api/test/manager-action`, {
      method: 'POST',
      headers: {
        'x-organization-id': 'org_test_beta',
        'x-manager-pin': '7777', // Org Beta PIN
      },
    });
    assert(
      resMgrSuccess.status === 200,
      'Tenant Manager PIN (7777) successfully authorized in Org Beta'
    );

    // --------------------------------------------------------------------------
    // 5. SESSION VALIDATION & LOGOUT
    // --------------------------------------------------------------------------
    console.log('\n5. Testing Session Validation & Logout...');

    const resValBefore = await fetch(`${baseUrl}/api/auth/validate-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: dataAlpha.user.id,
        token: dataAlpha.token,
      }),
    });
    const valBeforeData: any = await resValBefore.json();
    assert(valBeforeData.valid === true, 'Session valid before logout');

    // Logout
    const resLogout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${dataAlpha.token}` },
    });
    assert(resLogout.status === 200, 'Logout completed with 200 OK');

    const resValAfter = await fetch(`${baseUrl}/api/auth/validate-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: dataAlpha.user.id,
        token: dataAlpha.token,
      }),
    });
    const valAfterData: any = await resValAfter.json();
    assert(valAfterData.valid === false, 'Session invalid immediately after logout');

    console.log('\n====================================================');
    console.log(`📊 HTTP TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================\n');

    server.close();

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('HTTP Test execution error:', err);
    server.close();
    process.exit(1);
  }
}

runHttpTests();
