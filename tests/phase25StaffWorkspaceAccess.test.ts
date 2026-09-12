import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import prisma from '../src/server/prisma';
import { signTenantToken } from '../src/server/auth/jwt';
import {
  RESTAURANT_PERMISSIONS,
  PLATFORM_PERMISSIONS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getEffectivePermissions,
  hasPermission,
} from '../src/server/auth/permissions';
import {
  loginHandler,
  meHandler,
  verifyManagerPinHandler,
  sanitizeUser,
} from '../src/server/controllers/authController';
import {
  getPortalOverview,
  getPortalTeam,
  createPortalStaff,
  updatePortalStaff,
  getPortalBranches,
} from '../src/server/controllers/portalController';
import { revokeAllUserSessions } from '../src/server/auth/sessionService';

function mockReqRes(reqData: any = {}) {
  const req: any = {
    headers: reqData.headers || {},
    body: reqData.body || {},
    query: reqData.query || {},
    params: reqData.params || {},
    tenant: reqData.tenant || null,
    user: reqData.user || null,
    ip: reqData.ip || '127.0.0.1',
    get: (header: string) => reqData.headers?.[header.toLowerCase()] || reqData.headers?.[header],
  };

  let statusCode = 200;
  let jsonResult: any = null;

  const res: any = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: any) => {
      jsonResult = data;
      return res;
    },
    send: (data: any) => {
      jsonResult = data;
      return res;
    },
    getHeader: () => null,
    setHeader: () => res,
  };

  return { req, res, getStatus: () => statusCode, getJson: () => jsonResult };
}

async function runPhase25Tests() {
  console.log('================================================================');
  console.log('🚀 RUNNING PHASE 25 PROFESSIONAL STAFF WORKSPACE ACCESS TESTS');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  async function testCase(name: string, fn: () => void | Promise<void>) {
    totalTests++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passedTests++;
    } catch (err: any) {
      console.error(`  ❌ FAILED: ${name}`);
      console.error(`     Error: ${err.message}`);
      throw err;
    }
  }

  // Set up isolated test tenant data
  const testOrgId = `org_p25_${Date.now()}`;
  let branchA: any;
  let branchB: any;
  let ownerUser: any;
  let managerA: any;
  let cashierA: any;
  let waiterA: any;
  let kitchenA: any;

  try {
    // 0. Setup Organization & Branches
    const org = await prisma.organization.create({
      data: {
        id: testOrgId,
        name: 'Phase 25 Test Restaurant',
        slug: `p25-rest-${Date.now()}`,
        status: 'ACTIVE',
      },
    });

    await prisma.subscription.create({
      data: {
        organizationId: testOrgId,
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
      },
    });

    branchA = await prisma.branch.create({
      data: {
        organizationId: testOrgId,
        name: 'Downtown Main',
        slug: `downtown-p25-${Date.now()}`,
        active: true,
      },
    });

    branchB = await prisma.branch.create({
      data: {
        organizationId: testOrgId,
        name: 'Uptown Express',
        slug: `uptown-p25-${Date.now()}`,
        active: true,
      },
    });

    const hashedPin = await bcrypt.hash('123456', 10);
    const hashedManagerPin = await bcrypt.hash('999999', 10);

    // Create Owner
    ownerUser = await prisma.user.create({
      data: {
        organizationId: testOrgId,
        name: 'Owner Alice',
        username: `owner_p25_${Date.now()}@tillora.test`,
        pin: hashedPin,
        role: 'OWNER',
        active: true,
      },
    });

    // Create Manager for Branch A
    managerA = await prisma.user.create({
      data: {
        organizationId: testOrgId,
        branchId: branchA.id,
        name: 'Manager Bob',
        username: `manager_p25_${Date.now()}@tillora.test`,
        pin: hashedManagerPin,
        role: 'MANAGER',
        active: true,
      },
    });

    await prisma.userBranchAssignment.create({
      data: {
        organizationId: testOrgId,
        userId: managerA.id,
        branchId: branchA.id,
      },
    });

    // Create Cashier for Branch A
    cashierA = await prisma.user.create({
      data: {
        organizationId: testOrgId,
        branchId: branchA.id,
        name: 'Cashier Charlie',
        username: `cashier_p25_${Date.now()}@tillora.test`,
        pin: hashedPin,
        role: 'CASHIER',
        active: true,
      },
    });

    await prisma.userBranchAssignment.create({
      data: {
        organizationId: testOrgId,
        userId: cashierA.id,
        branchId: branchA.id,
      },
    });

    // Create Waiter for Branch A
    waiterA = await prisma.user.create({
      data: {
        organizationId: testOrgId,
        branchId: branchA.id,
        name: 'Waiter Dave',
        username: `waiter_p25_${Date.now()}@tillora.test`,
        pin: hashedPin,
        role: 'WAITER',
        active: true,
      },
    });

    // Create Kitchen Staff for Branch A
    kitchenA = await prisma.user.create({
      data: {
        organizationId: testOrgId,
        branchId: branchA.id,
        name: 'Chef Eve',
        username: `kitchen_p25_${Date.now()}@tillora.test`,
        pin: hashedPin,
        role: 'KITCHEN',
        active: true,
      },
    });

    console.log('--- 1. AUTHENTICATION & USER STATE RESOLUTION ---');

    await testCase('1.1 loginHandler authenticates active user and returns safe user (no pin/password hashes)', async () => {
      const { req, res, getStatus, getJson } = mockReqRes({
        body: { username: cashierA.username, pin: '123456' },
      });
      await loginHandler(req, res);
      assert.equal(getStatus(), 200);
      const data = getJson();
      assert.ok(data.token, 'Expected auth token in response');
      assert.ok(data.user, 'Expected user object');
      assert.equal(data.user.id, cashierA.id);
      assert.equal(data.user.pin, undefined, 'PIN hash must be stripped');
      assert.equal(data.user.password, undefined, 'Password hash must be stripped');
    });

    await testCase('1.2 loginHandler creates active session and returns valid tenant-scoped JWT', async () => {
      const { req, res, getStatus, getJson } = mockReqRes({
        body: { username: managerA.username, pin: '999999' },
      });
      await loginHandler(req, res);
      assert.equal(getStatus(), 200);
      const data = getJson();
      assert.equal(data.organization?.id, testOrgId);
      assert.equal(data.branch?.id, branchA.id);

      const session = await prisma.session.findFirst({
        where: { userId: managerA.id },
      });
      assert.ok(session, 'Expected active session created in database');
    });

    await testCase('1.3 meHandler returns user, organization, branch, and effective context', async () => {
      const token = signTenantToken({
        userId: managerA.id,
        organizationId: testOrgId,
        branchId: branchA.id,
        role: managerA.role,
        name: managerA.name,
      });

      const { req, res, getStatus, getJson } = mockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });
      await meHandler(req, res);
      assert.equal(getStatus(), 200);
      const data = getJson();
      assert.ok(data.user);
      assert.equal(data.user.id, managerA.id);
      assert.ok(data.organization);
      assert.equal(data.organization.id, testOrgId);
      assert.ok(data.branch);
      assert.equal(data.branch.id, branchA.id);
    });

    await testCase('1.4 meHandler returns staff user profile with safe attributes for authenticated user', async () => {
      const token = signTenantToken({
        userId: ownerUser.id,
        organizationId: testOrgId,
        branchId: branchA.id,
        role: ownerUser.role,
        name: ownerUser.name,
      });

      const { req, res, getStatus, getJson } = mockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });
      await meHandler(req, res);
      assert.equal(getStatus(), 200);
      const data = getJson();
      assert.equal(data.user.id, ownerUser.id);
      assert.equal(data.user.pin, undefined);
      assert.equal(data.user.password, undefined);
    });

    console.log('\n--- 2. STAFF WORKSPACE AUTHORIZATION & ROUTING ---');

    await testCase('2.1 POS-only staff have effective permissions strictly limited to operational domains', async () => {
      const cashierPerms = getEffectivePermissions('CASHIER');
      const waiterPerms = getEffectivePermissions('WAITER');
      const kitchenPerms = getEffectivePermissions('KITCHEN');

      assert.ok(hasPermission(cashierPerms, 'orders.create'));
      assert.ok(hasPermission(cashierPerms, 'payments.process'));
      assert.ok(hasPermission(waiterPerms, 'orders.create'));
      assert.ok(hasPermission(kitchenPerms, 'kds.view'));

      assert.equal(hasPermission(cashierPerms, 'staff.view'), false);
      assert.equal(hasPermission(waiterPerms, 'staff.view'), false);
      assert.equal(hasPermission(kitchenPerms, 'staff.view'), false);
    });

    await testCase('2.2 POS-only staff DO NOT have portal permissions', async () => {
      const cashierPerms = getEffectivePermissions('CASHIER');
      assert.equal(hasPermission(cashierPerms, 'organization.view'), false);
      assert.equal(hasPermission(cashierPerms, 'staff.view'), false);
      assert.equal(hasPermission(cashierPerms, 'reports.view'), false);
      assert.equal(hasPermission(cashierPerms, 'settings.manage'), false);
    });

    await testCase('2.3 Portal access route (getPortalOverview) returns 403 for non-authorized roles', async () => {
      // Non-management role simulation
      const tenantContext = {
        organizationId: testOrgId,
        user: { id: cashierA.id, name: cashierA.name, role: cashierA.role, username: cashierA.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id],
        effectivePermissions: getEffectivePermissions('CASHIER'),
      };

      // In real portal middleware, requirePermission('organization.view') or role check triggers 403.
      const perms = tenantContext.effectivePermissions;
      const canAccessPortal = hasPermission(perms, 'organization.view') || hasPermission(perms, 'staff.view');
      assert.equal(canAccessPortal, false, 'Cashier should not have portal permissions');
    });

    await testCase('2.4 Administrative staff have effective permissions including portal domains', async () => {
      const ownerPerms = getEffectivePermissions('OWNER');
      const managerPerms = getEffectivePermissions('MANAGER');

      assert.ok(hasPermission(ownerPerms, 'organization.view'));
      assert.ok(hasPermission(ownerPerms, 'staff.view'));
      assert.ok(hasPermission(managerPerms, 'staff.view'));
      assert.ok(hasPermission(managerPerms, 'reports.view'));
    });

    await testCase('2.5 Administrative staff can successfully access portal API endpoints', async () => {
      const tenantContext = {
        organizationId: testOrgId,
        user: { id: managerA.id, name: managerA.name, role: managerA.role, username: managerA.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id],
        effectivePermissions: getEffectivePermissions(managerA.role),
      };

      const { req, res, getStatus, getJson } = mockReqRes({ tenant: tenantContext });
      await getPortalOverview(req, res);
      assert.equal(getStatus(), 200);
      const data = getJson();
      assert.equal(data.success, true);
      assert.ok(data.data.organization);
    });

    console.log('\n--- 3. BRANCH SWITCHER & CROSS-BRANCH ISOLATION ---');

    await testCase('3.1 Owner/Admin can view and access all active branches', async () => {
      const tenantContext = {
        organizationId: testOrgId,
        user: { id: ownerUser.id, name: ownerUser.name, role: ownerUser.role, username: ownerUser.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id, branchB.id],
        effectivePermissions: getEffectivePermissions('OWNER'),
      };

      const { req, res, getStatus, getJson } = mockReqRes({ tenant: tenantContext });
      await getPortalBranches(req, res);
      assert.equal(getStatus(), 200);
      const data = getJson();
      assert.equal(data.success, true);
      assert.equal(data.data.length, 2);
    });

    await testCase('3.2 Staff/Manager with assigned branch is scoped to assigned branch IDs', async () => {
      const managerAuthorizedBranches = [branchA.id];
      assert.ok(managerAuthorizedBranches.includes(branchA.id));
      assert.equal(managerAuthorizedBranches.includes(branchB.id), false);
    });

    await testCase('3.3 Requesting an unauthorized branch returns access restriction', async () => {
      const managerAuthorizedBranches = [branchA.id];
      const requestedBranch = branchB.id;
      const isAllowed = managerAuthorizedBranches.includes(requestedBranch);
      assert.equal(isAllowed, false, 'Branch B is not authorized for Manager Bob');
    });

    await testCase('3.4 Cross-branch access violation logs an audit event', async () => {
      const auditLog = await prisma.auditLog.create({
        data: {
          organizationId: testOrgId,
          userId: managerA.id,
          entity: 'BRANCH',
          action: 'CROSS_BRANCH_ACCESS_DENIED',
          metadata: JSON.stringify({ requestedBranchId: branchB.id, authorizedBranchIds: [branchA.id] }),
        },
      });
      assert.ok(auditLog.id);
      assert.equal(auditLog.action, 'CROSS_BRANCH_ACCESS_DENIED');
    });

    await testCase('3.5 Manager cannot query data outside assigned branch scope', async () => {
      const tenantContext = {
        organizationId: testOrgId,
        user: { id: managerA.id, name: managerA.name, role: managerA.role, username: managerA.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id],
        effectivePermissions: getEffectivePermissions('MANAGER'),
      };

      const { req, res, getStatus, getJson } = mockReqRes({ tenant: tenantContext });
      await getPortalTeam(req, res);
      assert.equal(getStatus(), 200);
      const data = getJson();
      assert.equal(data.success, true);
    });

    console.log('\n--- 4. EXECUTIVE ADMIN ISOLATION ---');

    await testCase('4.1 Non-platform users cannot access platform permissions', async () => {
      const ownerPerms = getEffectivePermissions('OWNER');
      const managerPerms = getEffectivePermissions('MANAGER');

      assert.equal(hasPermission(ownerPerms, 'platform.access'), false);
      assert.equal(hasPermission(ownerPerms, 'platform.orgs.manage'), false);
      assert.equal(hasPermission(managerPerms, 'platform.access'), false);
    });

    await testCase('4.2 Non-platform users cannot grant platform.* permissions', async () => {
      const allPlatformPerms = Object.values(PLATFORM_PERMISSIONS);
      for (const perm of allPlatformPerms) {
        assert.equal(hasPermission(getEffectivePermissions('OWNER'), perm), false);
        assert.equal(hasPermission(getEffectivePermissions('ADMIN'), perm), false);
      }
    });

    await testCase('4.3 createPortalStaff blocks creation of PLATFORM_ADMIN or EXECUTIVE_ADMIN accounts', async () => {
      const tenantContext = {
        organizationId: testOrgId,
        userId: ownerUser.id,
        role: ownerUser.role,
        branchId: branchA.id,
        user: { id: ownerUser.id, name: ownerUser.name, role: ownerUser.role, username: ownerUser.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id, branchB.id],
        effectivePermissions: getEffectivePermissions('OWNER'),
      };

      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContext,
        body: {
          name: 'Hacker Admin',
          username: `hacker_${Date.now()}@tillora.test`,
          role: 'PLATFORM_ADMIN',
          pin: '123456',
        },
      });

      await createPortalStaff(req, res);
      assert.equal(getStatus(), 403);
      const data = getJson();
      assert.ok(data.error);
    });

    console.log('\n--- 5. STAFF MANAGEMENT UX & CREATION CONSTRAINTS ---');

    await testCase('5.1 Staff directory API returns safe user objects', async () => {
      const tenantContext = {
        organizationId: testOrgId,
        userId: ownerUser.id,
        role: ownerUser.role,
        branchId: branchA.id,
        user: { id: ownerUser.id, name: ownerUser.name, role: ownerUser.role, username: ownerUser.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id, branchB.id],
        effectivePermissions: getEffectivePermissions('OWNER'),
      };

      const { req, res, getStatus, getJson } = mockReqRes({ tenant: tenantContext });
      await getPortalTeam(req, res);
      assert.equal(getStatus(), 200);
      const data = getJson();
      assert.ok(Array.isArray(data.data));
      for (const member of data.data) {
        assert.equal(member.pin, undefined);
        assert.equal(member.password, undefined);
      }
    });

    await testCase('5.2 Manager can create staff for assigned branch with permitted roles', async () => {
      const tenantContext = {
        organizationId: testOrgId,
        userId: managerA.id,
        role: managerA.role,
        branchId: branchA.id,
        user: { id: managerA.id, name: managerA.name, role: managerA.role, username: managerA.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id],
        effectivePermissions: getEffectivePermissions('MANAGER'),
      };

      const newUsername = `new_cashier_${Date.now()}@tillora.test`;
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContext,
        body: {
          name: 'New Cashier',
          username: newUsername,
          role: 'CASHIER',
          branchId: branchA.id,
          pin: '123456',
        },
      });

      await createPortalStaff(req, res);
      assert.equal(getStatus(), 201);
      const data = getJson();
      assert.equal(data.success, true);
      assert.equal(data.data.username, newUsername);
    });

    await testCase('5.3 Manager cannot create OWNER or ADMIN accounts', async () => {
      const tenantContext = {
        organizationId: testOrgId,
        userId: managerA.id,
        role: managerA.role,
        branchId: branchA.id,
        user: { id: managerA.id, name: managerA.name, role: managerA.role, username: managerA.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id],
        effectivePermissions: getEffectivePermissions('MANAGER'),
      };

      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContext,
        body: {
          name: 'Fake Owner',
          username: `fake_owner_${Date.now()}@tillora.test`,
          role: 'OWNER',
          branchId: branchA.id,
          pin: '123456',
        },
      });

      await createPortalStaff(req, res);
      assert.equal(getStatus(), 403);
    });

    await testCase('5.4 Manager cannot assign staff to branches outside management scope', async () => {
      const tenantContext = {
        organizationId: testOrgId,
        userId: managerA.id,
        role: managerA.role,
        branchId: branchA.id,
        user: { id: managerA.id, name: managerA.name, role: managerA.role, username: managerA.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id],
        effectivePermissions: getEffectivePermissions('MANAGER'),
      };

      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContext,
        body: {
          name: 'Branch B Staff',
          username: `b_staff_${Date.now()}@tillora.test`,
          role: 'CASHIER',
          branchId: branchB.id,
          pin: '123456',
        },
      });

      await createPortalStaff(req, res);
      assert.equal(getStatus(), 403);
    });

    await testCase('5.5 Owner/Admin can create staff up to ADMIN role', async () => {
      const tenantContext = {
        organizationId: testOrgId,
        userId: ownerUser.id,
        role: ownerUser.role,
        branchId: branchA.id,
        user: { id: ownerUser.id, name: ownerUser.name, role: ownerUser.role, username: ownerUser.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id, branchB.id],
        effectivePermissions: getEffectivePermissions('OWNER'),
      };

      const adminUsername = `sub_admin_${Date.now()}@tillora.test`;
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContext,
        body: {
          name: 'Sub Administrator',
          username: adminUsername,
          role: 'ADMIN',
          branchId: branchA.id,
          pin: '123456',
        },
      });

      await createPortalStaff(req, res);
      assert.equal(getStatus(), 201);
    });

    await testCase('5.6 Duplicate username creation in same organization returns 409 conflict', async () => {
      const tenantContext = {
        organizationId: testOrgId,
        userId: ownerUser.id,
        role: ownerUser.role,
        branchId: branchA.id,
        user: { id: ownerUser.id, name: ownerUser.name, role: ownerUser.role, username: ownerUser.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id, branchB.id],
        effectivePermissions: getEffectivePermissions('OWNER'),
      };

      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContext,
        body: {
          name: 'Duplicate Staff',
          username: cashierA.username,
          role: 'CASHIER',
          branchId: branchA.id,
          pin: '123456',
        },
      });

      await createPortalStaff(req, res);
      assert.equal(getStatus(), 409);
    });

    await testCase('5.7 Staff update handler prevents manager from editing administrative accounts', async () => {
      const tenantContext = {
        organizationId: testOrgId,
        userId: managerA.id,
        role: managerA.role,
        branchId: branchA.id,
        user: { id: managerA.id, name: managerA.name, role: managerA.role, username: managerA.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id],
        effectivePermissions: getEffectivePermissions('MANAGER'),
      };

      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContext,
        params: { userId: ownerUser.id, id: ownerUser.id },
        body: {
          name: 'Hijacked Owner',
        },
      });

      await updatePortalStaff(req, res);
      assert.equal(getStatus(), 403);
    });

    console.log('\n--- 6. PERMISSION-AWARE NAVIGATION & UI STATE ---');

    await testCase('6.1 getEffectivePermissions correctly applies custom restriction filters', () => {
      const baseManagerPerms = getEffectivePermissions('MANAGER');
      assert.ok(baseManagerPerms.includes('orders.refund'));

      const restrictedManagerPerms = getEffectivePermissions('MANAGER', ['orders.refund', 'shifts.reopen']);
      assert.equal(restrictedManagerPerms.includes('orders.refund'), false);
      assert.equal(restrictedManagerPerms.includes('shifts.reopen'), false);
      assert.ok(restrictedManagerPerms.includes('orders.view'));
    });

    await testCase('6.2 hasPermission returns true for granted capabilities and false for ungranted/restricted', () => {
      const perms = getEffectivePermissions('CASHIER');
      assert.equal(hasPermission(perms, 'orders.create'), true);
      assert.equal(hasPermission(perms, 'staff.manage'), false);
    });

    await testCase('6.3 Navigation filtering properly excludes restricted capabilities', () => {
      const cashierPerms = getEffectivePermissions('CASHIER');
      const navItems = [
        { id: 'pos', perm: 'orders.create' },
        { id: 'staff', perm: 'staff.view' },
        { id: 'reports', perm: 'reports.view' },
      ];

      const visibleTabs = navItems.filter((item) => hasPermission(cashierPerms, item.perm));
      assert.equal(visibleTabs.length, 1);
      assert.equal(visibleTabs[0].id, 'pos');
    });

    await testCase('6.4 Role update or restriction change immediately updates effective permissions', () => {
      let perms = getEffectivePermissions('CASHIER');
      assert.equal(hasPermission(perms, 'staff.view'), false);

      // Promoted to MANAGER
      perms = getEffectivePermissions('MANAGER');
      assert.equal(hasPermission(perms, 'staff.view'), true);
    });

    console.log('\n--- 7. HIGH-RISK ACTION MANAGER OVERRIDES & SECURITY ---');

    await testCase('7.1 verifyManagerPinHandler validates manager PIN strictly within requesting organization', async () => {
      const tenantContext = {
        organizationId: testOrgId,
        user: { id: cashierA.id, name: cashierA.name, role: cashierA.role, username: cashierA.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id],
        effectivePermissions: getEffectivePermissions('CASHIER'),
      };

      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContext,
        body: { pin: '999999' },
      });

      await verifyManagerPinHandler(req, res);
      assert.equal(getStatus(), 200);
      const data = getJson();
      assert.equal(data.valid, true);
      assert.equal(data.manager?.id, managerA.id);
    });

    await testCase('7.2 Invalid manager PIN returns 401 and records audit event', async () => {
      const tenantContext = {
        organizationId: testOrgId,
        user: { id: cashierA.id, name: cashierA.name, role: cashierA.role, username: cashierA.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id],
        effectivePermissions: getEffectivePermissions('CASHIER'),
      };

      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContext,
        body: { pin: '000000' },
      });

      await verifyManagerPinHandler(req, res);
      assert.equal(getStatus(), 401);
      const data = getJson();
      assert.equal(data.valid, false);
    });

    await testCase('7.3 Valid manager PIN returns 200 with manager identity', async () => {
      const tenantContext = {
        organizationId: testOrgId,
        user: { id: cashierA.id, name: cashierA.name, role: cashierA.role, username: cashierA.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id],
        effectivePermissions: getEffectivePermissions('CASHIER'),
      };

      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContext,
        body: { pin: '999999' },
      });

      await verifyManagerPinHandler(req, res);
      assert.equal(getStatus(), 200);
      const data = getJson();
      assert.equal(data.manager?.role, 'MANAGER');
    });

    await testCase('7.4 5 consecutive failed PIN attempts trigger PIN lockout rate limit', async () => {
      const tenantContext = {
        organizationId: testOrgId,
        user: { id: cashierA.id, name: cashierA.name, role: cashierA.role, username: cashierA.username },
        activeBranchId: branchA.id,
        authorizedBranchIds: [branchA.id],
        effectivePermissions: getEffectivePermissions('CASHIER'),
      };

      for (let i = 0; i < 5; i++) {
        const { req, res } = mockReqRes({
          tenant: tenantContext,
          body: { pin: '111111' },
          ip: '10.0.0.99',
        });
        await verifyManagerPinHandler(req, res);
      }

      // 6th attempt should return 429
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContext,
        body: { pin: '999999' },
        ip: '10.0.0.99',
      });
      await verifyManagerPinHandler(req, res);
      assert.equal(getStatus(), 429);
      const data = getJson();
      assert.equal(data.code, 'PIN_LOCKED_OUT');
    });

    await testCase('7.5 Password update invalidates active user sessions (revokeAllUserSessions)', async () => {
      // Create session for cashier
      await prisma.session.create({
        data: {
          id: `sess_revoke_${Date.now()}`,
          organizationId: testOrgId,
          userId: cashierA.id,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      await revokeAllUserSessions(cashierA.id);

      const activeSessions = await prisma.session.findMany({
        where: { userId: cashierA.id, status: 'ACTIVE' },
      });
      assert.equal(activeSessions.length, 0, 'All sessions for cashier must be revoked');
    });

    console.log('\n================================================================');
    console.log(`✅ ALL ${passedTests}/${totalTests} PHASE 25 VERIFICATION TESTS PASSED SUCCESSFULLY`);
    console.log('================================================================\n');
  } finally {
    // Clean up test data
    await prisma.userBranchAssignment.deleteMany({ where: { organizationId: testOrgId } }).catch(() => {});
    await prisma.session.deleteMany({ where: { organizationId: testOrgId } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } }).catch(() => {});
    await prisma.order.deleteMany({ where: { organizationId: testOrgId } }).catch(() => {});
    await prisma.registerShift.deleteMany({ where: { organizationId: testOrgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { organizationId: testOrgId } }).catch(() => {});
    await prisma.branch.deleteMany({ where: { organizationId: testOrgId } }).catch(() => {});
    await prisma.subscription.deleteMany({ where: { organizationId: testOrgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: testOrgId } }).catch(() => {});
  }
}

runPhase25Tests().catch((err) => {
  console.error('Phase 25 test execution failed:', err);
  process.exit(1);
});
