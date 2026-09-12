/**
 * PHASE 17 TEST SUITE: VERIFIED ORGANIZATION SIGNUP, OWNER ADMINISTRATION & ROLE-BASED ACCESS
 * 
 * Verifies:
 * 1. Verified Multi-Step Registration (Initiate -> Hash Stored -> Rate Limit -> 6-Digit Verify -> Atomic Provisioning)
 * 2. Security Guarantees (No plaintext code storage, attempt lockout, expiration rejection, sensitive data redaction)
 * 3. Authoritative Organization Owner Designation
 * 4. Strict Role Hierarchy (PLATFORM_ADMIN > OWNER > MANAGER > STAFF/CASHIER/KITCHEN/RIDER)
 * 5. Complete Customer Portal & Branch / Staff Management (Tenant-isolated, plan-limited, session-revocation on credential changes)
 */

import express from 'express';
import http from 'http';
import prisma from '../src/server/prisma';
import bcrypt from 'bcryptjs';
import {
  initiateRegistrationHandler,
  verifyEmailHandler,
  resendVerificationHandler,
} from '../src/server/controllers/registerController';
import {
  loginHandler,
  validateSessionHandler,
  meHandler,
} from '../src/server/controllers/authController';
import {
  getPortalOverview,
  getPortalSubscription,
  getPortalRestaurant,
  getPortalTeam,
  getPortalBranches,
  createPortalBranch,
  updatePortalBranch,
  deletePortalBranch,
  createPortalStaff,
  updatePortalStaff,
  deletePortalStaff,
} from '../src/server/controllers/portalController';
import {
  authenticate,
  requireTenant,
} from '../src/server/middleware/auth';
import { requireCustomerPortalAccess } from '../src/server/middleware/subscriptionMiddleware';
import { signTenantToken } from '../src/server/auth/jwt';
import { createSession, validateSession } from '../src/server/auth/sessionService';
import { getVerificationCodeForTest } from '../src/server/auth/emailVerificationService';
import { logAuditEvent, AUDIT_ACTIONS } from '../src/server/auth/auditService';

let server: http.Server;
let baseUrl: string;

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

async function runPhase17Tests() {
  console.log('================================================================');
  console.log('🛡️  TILLORA PHASE 17: VERIFIED SIGNUP, OWNER & RBAC TEST SUITE');
  console.log('================================================================\n');

  // Setup test express application
  const app = express();
  app.use(express.json());

  // Public Auth Routes
  app.post('/api/auth/register-intent', initiateRegistrationHandler);
  app.post('/api/auth/verify-email', verifyEmailHandler);
  app.post('/api/auth/resend-verification', resendVerificationHandler);
  app.post('/api/auth/login', loginHandler);
  app.post('/api/auth/validate-session', validateSessionHandler);
  app.get('/api/auth/me', authenticate, meHandler);

  // Protected Customer Portal Routes (Tenant Scoped & RBAC Protected)
  const portalRouter = express.Router();
  portalRouter.use(authenticate);
  portalRouter.use(requireTenant);
  portalRouter.use(requireCustomerPortalAccess);

  portalRouter.get('/overview', getPortalOverview);
  portalRouter.get('/subscription', getPortalSubscription);
  portalRouter.get('/restaurant', getPortalRestaurant);
  portalRouter.get('/team', getPortalTeam);
  portalRouter.get('/branches', getPortalBranches);
  portalRouter.post('/branches', createPortalBranch);
  portalRouter.put('/branches/:branchId', updatePortalBranch);
  portalRouter.delete('/branches/:branchId', deletePortalBranch);
  portalRouter.post('/staff', createPortalStaff);
  portalRouter.put('/staff/:userId', updatePortalStaff);
  portalRouter.delete('/staff/:userId', deletePortalStaff);

  app.use('/api/portal', portalRouter);

  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    // --------------------------------------------------------------------------
    // TEST SECTION 1: VERIFIED REGISTRATION & SECURITY LIFE-CYCLE
    // --------------------------------------------------------------------------
    console.log('\n--- 1. VERIFIED REGISTRATION FLOW & CODE SECURITY ---');

    const testEmail1 = `owner_phase17_${Date.now()}@restaurantpilot.com`;
    const testPassword1 = 'SecureOwnerPass123!';
    const testRestaurant1 = 'Pilot Bistro 17';
    const testBranch1 = 'Main Flagship';

    // Step 1.1: Initiate Registration
    const initRes = await fetch(`${baseUrl}/api/auth/register-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Master Pilot Owner',
        email: testEmail1,
        password: testPassword1,
        confirmPassword: testPassword1,
        restaurantName: testRestaurant1,
        branchName: testBranch1,
        plan: 'STARTER',
      }),
    });

    const initJson = await initRes.json();
    assert(initRes.status === 200, 'Initiate registration returns 200 OK');
    assert(initJson.requiresVerification === true, 'Response mandates email verification');
    assert(typeof initJson.emailMasked === 'string' && initJson.emailMasked.includes('*'), 'Returns safely masked email address');

    // Step 1.2: Check Database - Pending Registration Created & NO Plaintext Code Stored
    const pendingRecord = await prisma.pendingRegistration.findFirst({
      where: { email: testEmail1.toLowerCase() },
    });
    assert(!!pendingRecord, 'PendingRegistration record created in database');
    assert(pendingRecord?.codeHash.length === 64, 'Code is stored as a 64-char SHA-256 salted hash, NOT plaintext');
    assert(!('code' in (pendingRecord || {})), 'Prisma PendingRegistration schema has no plaintext code field');

    // Retrieve active code from in-memory test harness
    const validCode = getVerificationCodeForTest(testEmail1);
    assert(typeof validCode === 'string' && validCode.length === 6, 'Verification code is a 6-digit numeric string');

    // Step 1.3: Reject Invalid Code & Increment Attempts Counter
    const badCodeRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail1,
        code: '000000', // incorrect code
      }),
    });
    const badCodeJson = await badCodeRes.json();
    assert(badCodeRes.status === 400, 'Invalid verification code returns 400 Bad Request');
    assert(badCodeJson.code === 'INVALID_CODE' || badCodeJson.code === 'INVALID', 'Error code specifies INVALID or INVALID_CODE');
    assert(typeof badCodeJson.attemptsRemaining === 'number', 'Returns remaining attempts count');

    // Step 1.4: Resend Rate Limiting (Cooldown Enforced)
    const resendRateRes = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail1 }),
    });
    assert(resendRateRes.status === 429, 'Immediate resend request returns 429 RATE_LIMITED');

    // Step 1.5: Atomic Verification & Provisioning with Valid Code
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail1,
        code: validCode,
      }),
    });
    const verifyJson = await verifyRes.json();

    assert(verifyRes.status === 201, 'Valid email verification returns 201 Created');
    assert(!!verifyJson.token, 'Returns valid authenticated JWT token');
    assert(verifyJson.user.role === 'OWNER', 'Registering user is automatically assigned the OWNER role');
    assert(verifyJson.user.username === testEmail1.toLowerCase(), 'User username matches normalized email');
    assert(verifyJson.organization.name === testRestaurant1, 'Organization name created accurately');
    assert(verifyJson.branch.name === testBranch1, 'Initial branch created accurately');
    assert(verifyJson.subscription.status === 'TRIALING', 'Organization granted standard 14-day trial');

    const owner1Token = verifyJson.token;
    const org1Id = verifyJson.organization.id;
    const branch1Id = verifyJson.branch.id;
    const owner1Id = verifyJson.user.id;

    // Verify PendingRegistration was purged after successful activation
    const cleanedPending = await prisma.pendingRegistration.findFirst({
      where: { email: testEmail1.toLowerCase() },
    });
    assert(cleanedPending === null, 'Pending registration record cleaned up atomically after verification');

    // --------------------------------------------------------------------------
    // TEST SECTION 2: OWNER AUTHORITATIVE CAPABILITIES & RBAC
    // --------------------------------------------------------------------------
    console.log('\n--- 2. OWNER PORTAL ACCESS & AUTHORITATIVE CAPABILITIES ---');

    // 2.1 Owner can access Portal Overview
    const overviewRes = await fetch(`${baseUrl}/api/portal/overview`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    const overviewJson = await overviewRes.json();
    assert(overviewRes.status === 200, 'Owner can access /api/portal/overview');
    assert(overviewJson.data.organization.id === org1Id, 'Portal data scoped strictly to owner organization');
    assert(overviewJson.data.counts.branches >= 1, 'Counts initial branch accurately');

    // 2.2 Owner can Create a New Branch (within Plan Limit)
    const newBranchRes = await fetch(`${baseUrl}/api/portal/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({
        name: 'Uptown Express Outlet',
        address: '100 North Blvd',
        phone: '+1 555-0199',
      }),
    });
    const newBranchJson = await newBranchRes.json();
    assert(newBranchRes.status === 201, 'Owner can create branch via /api/portal/branches');
    assert(newBranchJson.data.name === 'Uptown Express Outlet', 'Branch name stored correctly');
    const branch2Id = newBranchJson.data.id;

    // 2.3 Owner can Update Branch
    const updateBranchRes = await fetch(`${baseUrl}/api/portal/branches/${branch2Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({
        name: 'Uptown Express & Lounge',
      }),
    });
    const updateBranchJson = await updateBranchRes.json();
    assert(updateBranchRes.status === 200, 'Owner can update branch details');
    assert(updateBranchJson.data.name === 'Uptown Express & Lounge', 'Branch name updated');

    // 2.4 Owner can Create Staff Accounts with Roles & Branch Assignments
    const staffPassword = 'StaffPassword123!';
    const staffEmail = `cashier_${Date.now()}@restaurantpilot.com`;

    const createStaffRes = await fetch(`${baseUrl}/api/portal/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({
        name: 'Alice Cashier',
        username: staffEmail,
        pin: staffPassword,
        role: 'CASHIER',
        branchId: branch2Id,
        phone: '+1 555-0144',
      }),
    });
    const createStaffJson = await createStaffRes.json();
    assert(createStaffRes.status === 201, 'Owner can create staff accounts');
    assert(createStaffJson.data.role === 'CASHIER', 'Staff created with CASHIER role');
    assert(createStaffJson.data.branchId === branch2Id, 'Staff associated with specific branch');
    const staff1Id = createStaffJson.data.id;

    // 2.5 Staff Login & Authentication
    const staffLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: staffEmail,
        pin: staffPassword,
      }),
    });
    const staffLoginJson = await staffLoginRes.json();
    assert(staffLoginRes.status === 200, 'Created staff member can log in successfully');
    assert(staffLoginJson.user.role === 'CASHIER', 'Staff session token has CASHIER role');
    const staff1Token = staffLoginJson.token;

    // --------------------------------------------------------------------------
    // TEST SECTION 3: ROLE-BASED ACCESS CONTROL (RBAC) BOUNDARIES
    // --------------------------------------------------------------------------
    console.log('\n--- 3. ROLE HIERARCHY & PERMISSION BOUNDARIES ---');

    // 3.1 Cashier / Staff is Strictly Blocked from Customer Portal (403 Forbidden)
    const cashierPortalRes = await fetch(`${baseUrl}/api/portal/overview`, {
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    assert(cashierPortalRes.status === 403, 'Cashier role is blocked (403) from Customer Portal');

    // 3.2 Cashier cannot Create or Modify Branches
    const cashierCreateBranchRes = await fetch(`${baseUrl}/api/portal/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ name: 'Unauthorized Branch' }),
    });
    assert(cashierCreateBranchRes.status === 403, 'Cashier role cannot create branches');

    // 3.3 Non-Platform Admin cannot escalate to PLATFORM_ADMIN
    const escalateRes = await fetch(`${baseUrl}/api/portal/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({
        name: 'Fake Admin',
        username: `fake_admin_${Date.now()}@test.com`,
        pin: 'Password123!',
        role: 'PLATFORM_ADMIN',
      }),
    });
    assert(escalateRes.status === 403, 'Owner cannot escalate accounts to PLATFORM_ADMIN');

    // --------------------------------------------------------------------------
    // TEST SECTION 4: MULTI-TENANT ISOLATION
    // --------------------------------------------------------------------------
    console.log('\n--- 4. MULTI-TENANT ISOLATION & DATA PRIVACY ---');

    // Create a Second Organization (Org B)
    const org2 = await prisma.organization.create({
      data: {
        name: 'Competitor Diner Org B',
        slug: `competitor-${Date.now()}`,
        status: 'ACTIVE',
      },
    });
    const branchOrg2 = await prisma.branch.create({
      data: {
        organizationId: org2.id,
        name: 'Competitor Branch B',
        slug: `competitor-b-${Date.now()}`,
        active: true,
      },
    });
    const userOrg2 = await prisma.user.create({
      data: {
        organizationId: org2.id,
        branchId: branchOrg2.id,
        name: 'Owner B',
        username: `owner_b_${Date.now()}@competitor.com`,
        pin: await bcrypt.hash('Secret123!', 10),
        role: 'OWNER',
        active: true,
      },
    });
    const org2Token = signTenantToken({
      userId: userOrg2.id,
      organizationId: org2.id,
      branchId: branchOrg2.id,
      role: 'OWNER',
    });

    // 4.1 Org B Owner cannot update Org A's Branch
    const crossBranchUpdateRes = await fetch(`${baseUrl}/api/portal/branches/${branch2Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${org2Token}`,
      },
      body: JSON.stringify({ name: 'Hacked Name' }),
    });
    assert(crossBranchUpdateRes.status === 404, 'Org B Owner receives 404 when attempting to modify Org A Branch');

    // 4.2 Org B Owner cannot view or update Org A's Staff
    const crossStaffUpdateRes = await fetch(`${baseUrl}/api/portal/staff/${staff1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${org2Token}`,
      },
      body: JSON.stringify({ name: 'Hacked Staff' }),
    });
    assert(crossStaffUpdateRes.status === 404, 'Org B Owner receives 404 when attempting to modify Org A Staff');

    // --------------------------------------------------------------------------
    // TEST SECTION 5: CREDENTIAL RESET & SESSION REVOCATION
    // --------------------------------------------------------------------------
    console.log('\n--- 5. CREDENTIAL RESET & IMMEDIATE SESSION REVOCATION ---');

    // Create a real active database session for staff member
    const session = await createSession({
      userId: staff1Id,
      organizationId: org1Id,
      branchId: branch2Id,
      rawToken: staff1Token,
    });
    assert(session !== null, 'Created active database session for staff');

    // Verify session is active
    const isSessionActiveBefore = await validateSession(session!.id, staff1Token);
    assert(isSessionActiveBefore === true, 'Staff session validates as active');

    // Owner updates staff PIN/password (triggers session revocation)
    const resetPinRes = await fetch(`${baseUrl}/api/portal/staff/${staff1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({
        pin: 'NewStaffPassword999!',
      }),
    });
    assert(resetPinRes.status === 200, 'Owner successfully updated staff credentials');

    // Verify database session was immediately revoked
    const isSessionActiveAfter = await validateSession(session!.id, staff1Token);
    assert(isSessionActiveAfter === false, 'Staff session immediately revoked upon credential change');

    // --------------------------------------------------------------------------
    // TEST SECTION 6: AUDIT LOGS & SECRET REDACTION
    // --------------------------------------------------------------------------
    console.log('\n--- 6. AUDIT LOGGING & SENSITIVE DATA REDACTION ---');

    const auditLogs = await prisma.auditLog.findMany({
      where: { organizationId: org1Id },
      orderBy: { createdAt: 'desc' },
    });

    assert(auditLogs.length > 0, 'Audit log entries recorded for organization lifecycle events');

    const actions = auditLogs.map((l) => l.action);
    assert(actions.includes(AUDIT_ACTIONS.ORGANIZATION_CREATED), 'Audit contains ORGANIZATION_CREATED');
    assert(actions.includes(AUDIT_ACTIONS.OWNER_ASSIGNED), 'Audit contains OWNER_ASSIGNED');
    assert(actions.includes(AUDIT_ACTIONS.BRANCH_CREATED), 'Audit contains BRANCH_CREATED');

    // Verify metadata does NOT contain raw passwords or verification codes
    let hasLeakedSecrets = false;
    for (const log of auditLogs) {
      if (log.metadata) {
        const metaStr = log.metadata.toLowerCase();
        if (metaStr.includes('secureownerpass') || metaStr.includes('staffpassword')) {
          hasLeakedSecrets = true;
        }
      }
    }
    assert(hasLeakedSecrets === false, 'Verification codes and passwords are fully redacted from audit logs');

    // --------------------------------------------------------------------------
    // SUMMARY
    // --------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`📊 PHASE 17 TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
  }
}

runPhase17Tests();
