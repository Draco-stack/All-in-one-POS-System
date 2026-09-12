/**
 * Test Suite: Phase 22 — Website Registration, Verified Account Provisioning,
 * Temporary Password Lifecycle, and Branch-Scoped Authorization.
 * 
 * Verifies:
 * 1. Atomic registration and verification with temporary password option
 * 2. User creation with mustChangePassword flag and UserBranchAssignment
 * 3. Blocking of business endpoints when mustChangePassword is true
 * 4. Password rotation via /api/auth/change-password and session revocation
 * 5. Branch scoping: staff restricted to assigned branch, cross-branch access blocked (403),
 *    and owner organization-wide access allowed.
 */

import http from 'http';
import prisma from '../src/server/prisma';
import bcrypt from 'bcryptjs';
import { app } from '../server';
import { getVerificationCodeForTest } from '../src/server/auth/emailVerificationService';

async function runTests() {
  console.log('========================================================================');
  console.log('🛡️ RUNNING PHASE 22: REGISTRATION, ACCOUNT PROVISIONING & BRANCH SECURITY');
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

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Registration Intent & Email Verification with Temporary Password
    // -------------------------------------------------------------------------
    console.log('1. Testing Registration Intent & Verification Flow...');
    const uniqueSuffix = Date.now().toString().slice(-6);
    const testEmail = `owner_${uniqueSuffix}@example.com`;
    const testSubdomain = `bistro-${uniqueSuffix}`;

    const initiateRes = await fetch(`${baseUrl}/api/auth/register-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: `Test Bistro ${uniqueSuffix}`,
        email: testEmail,
        fullName: 'Bistro Owner',
        phone: '+15550001111',
        subdomain: testSubdomain,
        useTemporaryPassword: true,
      }),
    });

    const initiateData = await initiateRes.json();
    assert(initiateRes.status === 200, 'Registration initiate returned 200 OK');
    assert(initiateData.success === true, 'Initiate succeeded');
    assert(typeof initiateData.pendingId === 'string', 'Received pendingId');

    // Retrieve the verification token generated in test memory store
    const verificationCode = getVerificationCodeForTest(testEmail) || '';
    assert(verificationCode.length === 6, 'Verification code is 6 digits');

    // Verify Email
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        code: verificationCode,
        pendingId: initiateData.pendingId,
      }),
    });

    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200 || verifyRes.status === 201, 'Verify email returned 200 or 201 Created');
    assert(verifyData.success === true, 'Account provisioned successfully');
    assert(verifyData.mustChangePassword === true, 'Response indicates mustChangePassword is true');
    assert(typeof verifyData.temporaryPassword === 'string', 'Temporary password generated');
    assert(verifyData.temporaryPassword.startsWith('TEMP:'), 'Temporary password has TEMP: prefix');

    const newOrgId = verifyData.organizationId;
    createdOrgId = newOrgId;
    const newBranchId = verifyData.branchId;
    const newUsername = verifyData.username;
    const tempPassword = verifyData.temporaryPassword;

    // Verify DB entities created
    const createdUser = await prisma.user.findFirst({
      where: { username: newUsername, organizationId: newOrgId },
      include: { branchAssignments: true },
    });
    assert(!!createdUser, 'User record created in database');
    assert(createdUser?.role === 'OWNER', 'User created with OWNER role');
    assert(createdUser?.mustChangePassword === true, 'User mustChangePassword is true in DB');
    assert(createdUser?.branchAssignments.length! > 0, 'UserBranchAssignment provisioned');
    assert(createdUser?.branchAssignments[0].branchId === newBranchId, 'User assigned to provisioned branch');

    // -------------------------------------------------------------------------
    // TEST 2: Login with Temporary Password
    // -------------------------------------------------------------------------
    console.log('\n2. Testing Login with Temporary Password...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: newUsername,
        password: tempPassword,
      }),
    });

    const loginData = await loginRes.json();
    assert(loginRes.status === 200, 'Login with temporary password returned 200 OK');
    assert(loginData.mustChangePassword === true, 'Login payload flags mustChangePassword');
    assert(typeof loginData.token === 'string', 'JWT token issued');

    const tempToken = loginData.token;

    // -------------------------------------------------------------------------
    // TEST 3: Restricted Business Operations Under Temporary Password
    // -------------------------------------------------------------------------
    console.log('\n3. Testing Middleware Blocking of Business Operations...');
    const blockedRes = await fetch(`${baseUrl}/api/branches`, {
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    assert(blockedRes.status === 403, 'Access to /api/branches blocked with 403 Forbidden');
    const blockedData = await blockedRes.json();
    assert(
      blockedData.code === 'PASSWORD_CHANGE_REQUIRED' || blockedData.code === 'MUST_CHANGE_PASSWORD',
      'Received password change required error code'
    );

    // Me endpoint should still be allowed
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    assert(meRes.status === 200, 'Access to /api/auth/me allowed while mustChangePassword is true');

    // -------------------------------------------------------------------------
    // TEST 4: Password Rotation via /api/auth/change-password
    // -------------------------------------------------------------------------
    console.log('\n4. Testing Password Rotation via /api/auth/change-password...');
    const newPermanentPassword = 'SecurePermanentPassword!2026';

    const changeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tempToken}`,
      },
      body: JSON.stringify({
        currentPassword: tempPassword,
        newPassword: newPermanentPassword,
      }),
    });

    const changeData = await changeRes.json();
    assert(changeRes.status === 200, 'Password changed successfully with 200 OK');
    assert(changeData.success === true, 'Change password success is true');

    // Verify DB user record updated
    const updatedUser = await prisma.user.findFirst({
      where: { id: createdUser?.id },
    });
    assert(updatedUser?.mustChangePassword === false, 'mustChangePassword reset to false in DB');

    // Verify previous session token is now invalid/revoked
    const revokedCheckRes = await fetch(`${baseUrl}/api/branches`, {
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    assert(revokedCheckRes.status === 401, 'Old temporary session token was revoked (401 Unauthorized)');

    // -------------------------------------------------------------------------
    // TEST 5: Login with New Permanent Password
    // -------------------------------------------------------------------------
    console.log('\n5. Testing Login with New Permanent Password...');
    const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: newUsername,
        password: newPermanentPassword,
      }),
    });

    const newLoginData = await newLoginRes.json();
    assert(newLoginRes.status === 200, 'Login with permanent password returned 200 OK');
    assert(!newLoginData.mustChangePassword, 'mustChangePassword is false');
    const permanentToken = newLoginData.token;

    // Normal business access is now unblocked
    const unblockedRes = await fetch(`${baseUrl}/api/branches`, {
      headers: { Authorization: `Bearer ${permanentToken}` },
    });
    assert(unblockedRes.status === 200, 'Access to /api/branches now allowed (200 OK)');

    // -------------------------------------------------------------------------
    // TEST 6: Branch-Scoped Authorization & Cross-Branch Defense
    // -------------------------------------------------------------------------
    console.log('\n6. Testing Branch-Scoped Authorization & Cross-Branch Protection...');

    // Create a secondary branch for this organization
    const branch2 = await prisma.branch.create({
      data: {
        organizationId: newOrgId,
        name: `West Branch ${uniqueSuffix}`,
        slug: `west-branch-${uniqueSuffix}`,
        active: true,
      },
    });

    // Create a staff user (MANAGER) assigned strictly to branch2
    const staffHashedPin = await bcrypt.hash('StaffPass123!', 10);
    const staffUser = await prisma.user.create({
      data: {
        organizationId: newOrgId,
        branchId: branch2.id,
        name: 'West Branch Manager',
        username: `mgr_${uniqueSuffix}`,
        pin: staffHashedPin,
        role: 'MANAGER',
        mustChangePassword: false,
        active: true,
      },
    });

    await prisma.userBranchAssignment.create({
      data: {
        organizationId: newOrgId,
        userId: staffUser.id,
        branchId: branch2.id,
      },
    });

    // Staff logs in
    const staffLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: staffUser.username,
        password: 'StaffPass123!',
      }),
    });
    const staffLoginData = await staffLoginRes.json();
    assert(staffLoginRes.status === 200, 'Staff user authenticated');
    const staffToken = staffLoginData.token;

    // Staff accesses assigned branch (branch2)
    const staffAllowedRes = await fetch(`${baseUrl}/api/branches/${branch2.id}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffAllowedRes.status === 200, 'Staff granted access to their assigned branch (200 OK)');

    // Staff attempts to access branch1 (not assigned)
    const staffForbiddenRes = await fetch(`${baseUrl}/api/branches/${newBranchId}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffForbiddenRes.status === 403, 'Cross-branch access denied with 403 Forbidden');
    const staffForbiddenData = await staffForbiddenRes.json();
    assert(staffForbiddenData.code === 'CROSS_BRANCH_ACCESS_DENIED', 'Returned code CROSS_BRANCH_ACCESS_DENIED');

    // Owner accesses branch2 (Owner has organization-wide access)
    const ownerBranch2Res = await fetch(`${baseUrl}/api/branches/${branch2.id}`, {
      headers: { Authorization: `Bearer ${permanentToken}` },
    });
    assert(ownerBranch2Res.status === 200, 'Owner granted access to any organization branch (200 OK)');

    // Check that audit event for cross-branch access denial was recorded
    const denialAudit = await prisma.auditLog.findFirst({
      where: {
        organizationId: newOrgId,
        action: 'CROSS_BRANCH_ACCESS_DENIED',
      },
    });
    assert(!!denialAudit, 'CROSS_BRANCH_ACCESS_DENIED audit log recorded in database');

    console.log('\n========================================================================');
    console.log(`🏁 TEST SUMMARY: ${passed} passed, ${failed} failed`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('Test suite error:', err);
    failed++;
  } finally {
    if (createdOrgId) {
      await prisma.organization.delete({ where: { id: createdOrgId } }).catch(() => {});
    }
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
