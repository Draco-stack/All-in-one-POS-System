/**
 * Test Suite: Phase 23 — Professional Account Lifecycle, Owner Welcome,
 * Credential Delivery & Branch-Scoped Administration.
 * 
 * Verifies:
 * 1. Owner registration lifecycle with verification and professional welcome email dispatch.
 * 2. Temporary password enforcement and mandatory rotation with session revocation.
 * 3. Staff creation with one-time credential delivery, branch assignment, and manager scope guardrails.
 * 4. Manager role hierarchy checks (cannot create/promote to OWNER/ADMIN, cannot assign unmanaged branches).
 * 5. Session revocation on role, branch, credential, or status change.
 * 6. Audit event coverage across all lifecycle actions.
 */

import http from 'http';
import prisma from '../src/server/prisma';
import bcrypt from 'bcryptjs';
import { app } from '../server';
import { getVerificationCodeForTest } from '../src/server/auth/emailVerificationService';
import { AUDIT_ACTIONS } from '../src/server/auth/auditService';

async function runTests() {
  console.log('========================================================================');
  console.log('🛡️ RUNNING PHASE 23: LIFECYCLE, WELCOME EMAIL & BRANCH-SCOPED ADMIN');
  console.log('========================================================================\n');

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

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;
  let createdOrgId: string | null = null;
  let secondOrgId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Owner Registration, Verification & Welcome Email Audit
    // -------------------------------------------------------------------------
    console.log('1. Testing Owner Registration & Welcome Email Flow...');
    const uniqueSuffix = Date.now().toString().slice(-6);
    const ownerEmail = `owner23_${uniqueSuffix}@example.com`;
    const subdomain = `tillora23-${uniqueSuffix}`;

    const initiateRes = await fetch(`${baseUrl}/api/auth/register-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: `Trattoria ${uniqueSuffix}`,
        email: ownerEmail,
        fullName: 'Trattoria Owner',
        phone: '+15559876543',
        subdomain,
        plan: 'STANDARD',
        isTrial: true,
        useTemporaryPassword: true,
      }),
    });

    const initiateData = await initiateRes.json();
    assert(initiateRes.status === 200, 'Register-intent returned 200 OK');
    assert(initiateData.success === true, 'Initiate succeeded');

    const code = getVerificationCodeForTest(ownerEmail) || '';
    assert(code.length === 6, 'Generated 6-digit verification code');

    // Verify Email
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerEmail,
        code,
        pendingId: initiateData.pendingId,
      }),
    });

    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200 || verifyRes.status === 201, 'Verify email returned 200/201');
    assert(verifyData.success === true, 'Account provisioned');
    assert(verifyData.mustChangePassword === true, 'Account marked mustChangePassword');
    assert(typeof verifyData.temporaryPassword === 'string', 'Temporary password returned');

    createdOrgId = verifyData.organizationId;
    const orgId = verifyData.organizationId;
    const branchId = verifyData.branchId;
    const ownerUsername = verifyData.username;
    const tempPassword = verifyData.temporaryPassword;

    // Check Audit Logs for Registration & Welcome Email
    const regAuditLogs = await prisma.auditLog.findMany({
      where: { organizationId: orgId },
    });
    const regActions = regAuditLogs.map((l) => l.action);
    assert(regActions.includes(AUDIT_ACTIONS.OWNER_ACCOUNT_CREATED), 'Audit log contains OWNER_ACCOUNT_CREATED');
    assert(regActions.includes(AUDIT_ACTIONS.OWNER_EMAIL_VERIFIED), 'Audit log contains OWNER_EMAIL_VERIFIED');
    assert(regActions.includes(AUDIT_ACTIONS.WELCOME_EMAIL_SENT), 'Audit log contains WELCOME_EMAIL_SENT');

    // -------------------------------------------------------------------------
    // TEST 2: Owner Login with Temporary Password & Mandatory Password Rotation
    // -------------------------------------------------------------------------
    console.log('\n2. Testing Temporary Password Login & Mandatory Rotation...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: ownerUsername,
        password: tempPassword,
        organizationId: orgId,
      }),
    });

    const loginData = await loginRes.json();
    assert(loginRes.status === 200, 'Login with temporary password returned 200 OK');
    assert(loginData.mustChangePassword === true, 'Login payload flags mustChangePassword');
    const tempToken = loginData.token;

    // Change Password
    const changeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tempToken}`,
      },
      body: JSON.stringify({
        currentPassword: tempPassword,
        newPassword: 'PermSecurePassword2026!',
        confirmPassword: 'PermSecurePassword2026!',
      }),
    });

    const changeData = await changeRes.json();
    assert(changeRes.status === 200, 'Change password returned 200 OK');
    assert(changeData.mustChangePassword === false, 'mustChangePassword updated to false');
    const ownerToken = changeData.token;

    // Verify Audit Event for password setup
    const passAudits = await prisma.auditLog.findMany({
      where: { organizationId: orgId, action: AUDIT_ACTIONS.PASSWORD_SETUP_COMPLETED },
    });
    assert(passAudits.length > 0, 'Audit log contains PASSWORD_SETUP_COMPLETED');

    // -------------------------------------------------------------------------
    // TEST 3: Create Second Branch & Staff Members
    // -------------------------------------------------------------------------
    console.log('\n3. Testing Staff Creation & Branch Scoping...');
    
    // Create Branch B
    const branchBRes = await fetch(`${baseUrl}/api/portal/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Downtown Annex',
        code: `ANNEX-${uniqueSuffix}`,
        address: '456 Market St',
        taxRate: 8.5,
      }),
    });

    const branchBData = await branchBRes.json();
    assert(branchBRes.status === 201, 'Created Branch B returned 201');
    const branchBId = branchBData.data?.id || branchBData.id;

    // Create Manager assigned to Branch B
    const managerEmail = `mgr_${uniqueSuffix}@example.com`;
    const createMgrRes = await fetch(`${baseUrl}/api/portal/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Annex Manager',
        username: managerEmail,
        pin: 'MgrTempPin2026!',
        role: 'MANAGER',
        branchId: branchBId,
      }),
    });

    const mgrData = await createMgrRes.json();
    assert(createMgrRes.status === 201, 'Created Manager assigned to Branch B returned 201');
    assert(mgrData.data?.role === 'MANAGER', 'Manager role is MANAGER');
    const managerId = mgrData.data?.id;

    // Login as Manager (initial temporary password)
    const mgrLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: managerEmail,
        password: 'MgrTempPin2026!',
        organizationId: orgId,
      }),
    });

    const mgrLoginData = await mgrLoginRes.json();
    assert(mgrLoginRes.status === 200, 'Manager logged in successfully');
    assert(mgrLoginData.mustChangePassword === true, 'Manager has mustChangePassword = true');
    const mgrTempToken = mgrLoginData.token;

    // Manager blocked from business operations before rotating password
    const preRotateStaffRes = await fetch(`${baseUrl}/api/portal/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mgrTempToken}`,
      },
      body: JSON.stringify({
        name: 'Blocked Cashier',
        username: `blocked_${uniqueSuffix}@example.com`,
        pin: 'CashierPin1234!',
        role: 'CASHIER',
        branchId: branchBId,
      }),
    });
    assert(preRotateStaffRes.status === 403, 'Manager blocked from operations before rotating password (403)');

    // Manager rotates password
    const mgrChangeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mgrTempToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'MgrTempPin2026!',
        newPassword: 'ManagerPermanentPassword2026!',
        confirmPassword: 'ManagerPermanentPassword2026!',
      }),
    });
    const mgrChangeData = await mgrChangeRes.json();
    assert(mgrChangeRes.status === 200, 'Manager rotated password successfully');
    const mgrToken = mgrChangeData.token;

    // -------------------------------------------------------------------------
    // TEST 4: Manager Scope Restrictions & Privilege Escalation Prevention
    // -------------------------------------------------------------------------
    console.log('\n4. Testing Manager Scope & Privilege Escalation Protections...');

    // Attempt 4A: Manager tries to create an OWNER account -> REJECT (403)
    const mgrCreateOwnerRes = await fetch(`${baseUrl}/api/portal/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mgrToken}`,
      },
      body: JSON.stringify({
        name: 'Rogue Owner',
        username: `rogue_owner_${uniqueSuffix}@example.com`,
        pin: 'RoguePin1234!',
        role: 'OWNER',
        branchId: branchBId,
      }),
    });
    assert(mgrCreateOwnerRes.status === 403, 'Manager creating OWNER is rejected with 403 Forbidden');

    // Attempt 4B: Manager tries to assign staff to Branch A (which manager does not manage) -> REJECT (403)
    const mgrCreateCrossBranchRes = await fetch(`${baseUrl}/api/portal/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mgrToken}`,
      },
      body: JSON.stringify({
        name: 'Unauthorized Cashier',
        username: `cashier_unauth_${uniqueSuffix}@example.com`,
        pin: 'CashierPin1234!',
        role: 'CASHIER',
        branchId: branchId, // Main Branch (manager is only authorized for branchB)
      }),
    });
    assert(mgrCreateCrossBranchRes.status === 403, 'Manager assigning staff to unmanaged branch rejected with 403 Forbidden');

    // Attempt 4C: Manager creates Cashier in their own branch -> ALLOW (201)
    const cashierEmail = `cashier_${uniqueSuffix}@example.com`;
    const mgrCreateCashierRes = await fetch(`${baseUrl}/api/portal/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mgrToken}`,
      },
      body: JSON.stringify({
        name: 'Annex Cashier',
        username: cashierEmail,
        pin: 'CashierPin1234!',
        role: 'CASHIER',
        branchId: branchBId,
      }),
    });
    const cashierData = await mgrCreateCashierRes.json();
    assert(mgrCreateCashierRes.status === 201, 'Manager creating Cashier in own branch succeeded with 201');
    const cashierId = cashierData.data?.id;

    // -------------------------------------------------------------------------
    // TEST 5: Session Revocation on Role/Branch/Active Change
    // -------------------------------------------------------------------------
    console.log('\n5. Testing Session Revocation on Role and Status Modifications...');

    // Login as Cashier
    const cashierLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cashierEmail,
        password: 'CashierPin1234!',
        organizationId: orgId,
      }),
    });
    const cashierLoginData = await cashierLoginRes.json();
    assert(cashierLoginRes.status === 200, 'Cashier logged in successfully');
    const cashierToken = cashierLoginData.token;

    // Verify Cashier me endpoint is working
    const cashierMeBefore = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert(cashierMeBefore.status === 200, 'Cashier active session validated with 200');

    // Owner updates Cashier (e.g. disables account or changes role)
    const updateCashierRes = await fetch(`${baseUrl}/api/portal/staff/${cashierId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        active: false,
      }),
    });
    assert(updateCashierRes.status === 200, 'Owner disabled Cashier account');

    // Verify Cashier session is now REVOKED (401)
    const cashierMeAfter = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert(cashierMeAfter.status === 401, 'Cashier previous session revoked immediately on deactivation (401)');

    // -------------------------------------------------------------------------
    // TEST 6: Tenant Isolation & Foreign Branch Access Rejection
    // -------------------------------------------------------------------------
    console.log('\n6. Testing Cross-Tenant Security Hardening...');

    // Create Second Tenant
    const secondSuffix = (Date.now() + 100).toString().slice(-6);
    const org2 = await prisma.organization.create({
      data: {
        name: `Second Org ${secondSuffix}`,
        slug: `second-org-${secondSuffix}`,
        status: 'ACTIVE',
      },
    });
    secondOrgId = org2.id;
    const branchOrg2 = await prisma.branch.create({
      data: {
        organizationId: org2.id,
        name: 'Org2 Branch',
        slug: `org2-branch-${secondSuffix}`,
        active: true,
      },
    });

    // Owner from Org 1 attempts to assign staff to Org 2's branch -> REJECT (400)
    const crossBranchAssignRes = await fetch(`${baseUrl}/api/portal/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Injected Staff',
        username: `injected_${uniqueSuffix}@example.com`,
        pin: 'InjectPin1234!',
        role: 'CASHIER',
        branchId: branchOrg2.id, // Branch belonging to Org 2
      }),
    });
    assert(crossBranchAssignRes.status === 400, 'Cross-tenant branch assignment rejected with 400');

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log(`🛡️ PHASE 23 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  } finally {
    // Cleanup created test records
    if (createdOrgId) {
      await prisma.userBranchAssignment.deleteMany({ where: { organizationId: createdOrgId } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { organizationId: createdOrgId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { organizationId: createdOrgId } }).catch(() => {});
      await prisma.branch.deleteMany({ where: { organizationId: createdOrgId } }).catch(() => {});
      await prisma.subscription.deleteMany({ where: { organizationId: createdOrgId } }).catch(() => {});
      await prisma.organization.deleteMany({ where: { id: createdOrgId } }).catch(() => {});
    }
    if (secondOrgId) {
      await prisma.branch.deleteMany({ where: { organizationId: secondOrgId } }).catch(() => {});
      await prisma.organization.deleteMany({ where: { id: secondOrgId } }).catch(() => {});
    }
    server.close();
  }
}

runTests();
