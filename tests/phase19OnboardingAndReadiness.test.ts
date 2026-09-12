/**
 * PHASE 19 TEST SUITE: RESTAURANT ONBOARDING, FIRST-RUN SETUP & GO-LIVE READINESS SYSTEM
 * 
 * Verifies:
 * 1. Initial Onboarding State & Resume Capability (NOT_STARTED -> IN_PROGRESS)
 * 2. Service Model Customization (HYBRID, DINE_IN, COUNTER_SERVICE, TAKEAWAY_ONLY) & Step Requirement Adaptation
 * 3. Server-Authoritative Dynamic Readiness Recalculation (Categories, Items, Tables, Hardware)
 * 4. Safe Test Order Workflow (isTraining: true) & Exclusion from Financial Reports
 * 5. Go-Live Completion Gate & Validation (Fails 400 with blockingReasons when incomplete, 200 COMPLETED when ready)
 * 6. Multi-Tenant Isolation & Security (IDOR Safety, 401/403 Enforcement)
 * 7. Audit Logging (ONBOARDING_STARTED, ONBOARDING_SERVICE_MODEL_SET, TEST_ORDER_COMPLETED, ONBOARDING_COMPLETED)
 */

import express from 'express';
import http from 'http';
import prisma from '../src/server/prisma';
import bcrypt from 'bcryptjs';
import { app } from '../server';
import { signTenantToken } from '../src/server/auth/jwt';

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

async function runTests() {
  console.log('================================================================');
  console.log('STARTING PHASE 19: ONBOARDING & GO-LIVE READINESS TEST SUITE');
  console.log('================================================================');

  // Start server on dynamic port
  const port = 49199;
  server = app.listen(port);
  baseUrl = `http://localhost:${port}`;

  let tenantAOrgId = '';
  let tenantBOrgId = '';
  let tenantAToken = '';
  let tenantBToken = '';
  let tenantABranchId = '';
  let tenantBBranchId = '';
  let tenantAUserId = '';
  let tenantBUserId = '';

  try {
    // 0. Clean up existing test data
    await prisma.organization.deleteMany({
      where: { slug: { in: ['p19-test-org-a', 'p19-test-org-b'] } },
    });

    // Create Tenant A Organization
    const orgA = await prisma.organization.create({
      data: {
        name: 'Phase 19 Bistro A',
        slug: 'p19-test-org-a',
        status: 'ACTIVE',
        onboardingStatus: 'NOT_STARTED',
        serviceModel: 'HYBRID',
      },
    });
    tenantAOrgId = orgA.id;

    const branchA = await prisma.branch.create({
      data: {
        organizationId: orgA.id,
        name: 'Main Branch A',
        slug: 'main-a',
        taxRate: 10,
        active: true,
      },
    });
    tenantABranchId = branchA.id;

    const passwordHash = await bcrypt.hash('OwnerPass123!', 10);
    const userA = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        branchId: branchA.id,
        name: 'Owner Alice',
        username: 'owner_alice_p19',
        pin: passwordHash,
        role: 'OWNER',
        active: true,
      },
    });
    tenantAUserId = userA.id;

    tenantAToken = signTenantToken({
      userId: userA.id,
      organizationId: orgA.id,
      branchId: branchA.id,
      role: 'OWNER',
      username: userA.username,
    });

    await prisma.subscription.create({
      data: {
        organizationId: orgA.id,
        plan: 'BUSINESS',
        status: 'ACTIVE',
        startDate: new Date(),
      },
    });

    // Create Tenant B Organization (IDOR check)
    const orgB = await prisma.organization.create({
      data: {
        name: 'Phase 19 Diner B',
        slug: 'p19-test-org-b',
        status: 'ACTIVE',
        onboardingStatus: 'NOT_STARTED',
        serviceModel: 'TAKEAWAY_ONLY',
      },
    });
    tenantBOrgId = orgB.id;

    const branchB = await prisma.branch.create({
      data: {
        organizationId: orgB.id,
        name: 'Main Branch B',
        slug: 'main-b',
        taxRate: 5,
        active: true,
      },
    });
    tenantBBranchId = branchB.id;

    const userB = await prisma.user.create({
      data: {
        organizationId: orgB.id,
        branchId: branchB.id,
        name: 'Owner Bob',
        username: 'owner_bob_p19',
        pin: passwordHash,
        role: 'OWNER',
        active: true,
      },
    });
    tenantBUserId = userB.id;

    tenantBToken = signTenantToken({
      userId: userB.id,
      organizationId: orgB.id,
      branchId: branchB.id,
      role: 'OWNER',
      username: userB.username,
    });

    await prisma.subscription.create({
      data: {
        organizationId: orgB.id,
        plan: 'STARTER',
        status: 'ACTIVE',
        startDate: new Date(),
      },
    });

    console.log('\n--- Test Group 1: Initial Onboarding State & Start Endpoint ---');
    {
      const res = await fetch(`${baseUrl}/api/portal/onboarding`, {
        headers: { Authorization: `Bearer ${tenantAToken}` },
      });
      const json = await res.json();
      assert(res.status === 200, 'GET /api/portal/onboarding returns 200');
      assert(json.data.onboardingStatus === 'NOT_STARTED', 'Initial status is NOT_STARTED');
      assert(json.data.serviceModel === 'HYBRID', 'Default serviceModel is HYBRID');
      assert(json.data.isReady === false, 'Initial readiness is false');
    }

    {
      const res = await fetch(`${baseUrl}/api/portal/onboarding/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tenantAToken}` },
      });
      const json = await res.json();
      assert(res.status === 200, 'POST /api/portal/onboarding/start returns 200');
      assert(json.data.onboardingStatus === 'IN_PROGRESS', 'Status updated to IN_PROGRESS');

      const orgInDb = await prisma.organization.findUnique({ where: { id: tenantAOrgId } });
      assert(orgInDb?.onboardingStatus === 'IN_PROGRESS', 'DB organization status is IN_PROGRESS');
      assert(orgInDb?.onboardingStartedAt !== null, 'onboardingStartedAt timestamp recorded');
    }

    console.log('\n--- Test Group 2: Service Model Customization ---');
    {
      const res = await fetch(`${baseUrl}/api/portal/onboarding/service-model`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantAToken}`,
        },
        body: JSON.stringify({ serviceModel: 'TAKEAWAY_ONLY' }),
      });
      const json = await res.json();
      assert(res.status === 200, 'POST /api/portal/onboarding/service-model returns 200');
      assert(json.data.serviceModel === 'TAKEAWAY_ONLY', 'serviceModel updated to TAKEAWAY_ONLY');

      const tableStep = json.data.steps.find((s: any) => s.key === 'TABLES_FLOOR');
      assert(tableStep.status === 'NOT_APPLICABLE', 'TABLES_FLOOR step is NOT_APPLICABLE for TAKEAWAY_ONLY');
      assert(tableStep.required === false, 'TABLES_FLOOR step is not required for TAKEAWAY_ONLY');
    }

    {
      const res = await fetch(`${baseUrl}/api/portal/onboarding/service-model`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantAToken}`,
        },
        body: JSON.stringify({ serviceModel: 'INVALID_MODEL' }),
      });
      assert(res.status === 400, 'Rejects invalid service model with 400');
    }

    {
      const res = await fetch(`${baseUrl}/api/portal/onboarding/service-model`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantAToken}`,
        },
        body: JSON.stringify({ serviceModel: 'HYBRID' }),
      });
      const json = await res.json();
      assert(res.status === 200, 'Switched back to HYBRID model');
      const tableStep = json.data.steps.find((s: any) => s.key === 'TABLES_FLOOR');
      assert(tableStep.status === 'INCOMPLETE', 'TABLES_FLOOR step is INCOMPLETE for HYBRID without tables');
    }

    console.log('\n--- Test Group 3: Server-Authoritative Dynamic Readiness Recalculation ---');
    {
      // 1. Check initial MENU_READY
      const res1 = await fetch(`${baseUrl}/api/portal/onboarding/readiness`, {
        headers: { Authorization: `Bearer ${tenantAToken}` },
      });
      const json1 = await res1.json();
      const menuStep1 = json1.data.steps.find((s: any) => s.key === 'MENU_READY');
      assert(menuStep1.status === 'INCOMPLETE', 'MENU_READY step initially INCOMPLETE');

      // 2. Add Category & MenuItem
      const cat = await prisma.category.create({
        data: {
          organizationId: tenantAOrgId,
          title: 'Main Courses',
          slug: `mains-${Date.now()}`,
          active: true,
        },
      });

      await prisma.menuItem.create({
        data: {
          organizationId: tenantAOrgId,
          categoryId: cat.id,
          title: 'Gourmet Steak Burger',
          price: 18.0,
          active: true,
        },
      });

      // 3. Re-check readiness
      const res2 = await fetch(`${baseUrl}/api/portal/onboarding/readiness`, {
        headers: { Authorization: `Bearer ${tenantAToken}` },
      });
      const json2 = await res2.json();
      const menuStep2 = json2.data.steps.find((s: any) => s.key === 'MENU_READY');
      assert(menuStep2.status === 'COMPLETED', 'MENU_READY step becomes COMPLETED after adding category and item');
    }

    {
      // Add table
      await prisma.table.create({
        data: {
          organizationId: tenantAOrgId,
          branchId: tenantABranchId,
          number: 'T-10',
          capacity: 4,
          active: true,
        },
      });

      const res = await fetch(`${baseUrl}/api/portal/onboarding/readiness`, {
        headers: { Authorization: `Bearer ${tenantAToken}` },
      });
      const json = await res.json();
      const tableStep = json.data.steps.find((s: any) => s.key === 'TABLES_FLOOR');
      assert(tableStep.status === 'COMPLETED', 'TABLES_FLOOR step becomes COMPLETED after adding table');
    }

    {
      // Test dynamic degradation: delete menu items -> MENU_READY reverts to INCOMPLETE
      await prisma.menuItem.deleteMany({ where: { organizationId: tenantAOrgId } });

      const res = await fetch(`${baseUrl}/api/portal/onboarding/readiness`, {
        headers: { Authorization: `Bearer ${tenantAToken}` },
      });
      const json = await res.json();
      const menuStep = json.data.steps.find((s: any) => s.key === 'MENU_READY');
      assert(menuStep.status === 'INCOMPLETE', 'MENU_READY reverts to INCOMPLETE when items are deleted');
      assert(json.data.isReady === false, 'isReady becomes false when required item is removed');

      // Restore menu item
      const cat = await prisma.category.findFirst({ where: { organizationId: tenantAOrgId } });
      await prisma.menuItem.create({
        data: {
          organizationId: tenantAOrgId,
          categoryId: cat?.id,
          title: 'Restored Steak Burger',
          price: 18.0,
          active: true,
        },
      });
    }

    console.log('\n--- Test Group 4: Safe Test Order Workflow & Financial Report Exclusion ---');
    {
      const res = await fetch(`${baseUrl}/api/portal/onboarding/test-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantAToken}`,
        },
        body: JSON.stringify({ branchId: tenantABranchId }),
      });
      const json = await res.json();
      assert(res.status === 201, 'POST /api/portal/onboarding/test-order returns 201');
      assert(json.data.order.isTraining === true, 'Test order is created with isTraining: true');

      const testStep = json.data.readiness.steps.find((s: any) => s.key === 'TEST_ORDER');
      assert(testStep.status === 'COMPLETED', 'TEST_ORDER step becomes COMPLETED');
    }

    {
      // Create a real order
      await prisma.order.create({
        data: {
          organizationId: tenantAOrgId,
          branchId: tenantABranchId,
          orderNumber: `REAL-${Date.now()}`,
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          paymentMethod: 'CASH',
          subtotal: 150,
          tax: 15,
          total: 165,
          isTraining: false,
        },
      });

      const res = await fetch(`${baseUrl}/api/portal/reports`, {
        headers: { Authorization: `Bearer ${tenantAToken}` },
      });
      const json = await res.json();
      assert(res.status === 200, 'GET /api/portal/reports returns 200');
      assert(json.data.totalSales === 165, 'Financial sales report includes ONLY real order (165), training test order is excluded');
    }

    console.log('\n--- Test Group 5: Go-Live Completion Gate & Validation ---');
    {
      // Tenant B has missing menu, tables, and test order
      const res = await fetch(`${baseUrl}/api/portal/onboarding/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tenantBToken}` },
      });
      const json = await res.json();
      assert(res.status === 400, 'Completion fails with 400 when required steps incomplete');
      assert(Array.isArray(json.blockingReasons) && json.blockingReasons.length > 0, 'Returns explicit blockingReasons array');

      const orgBInDb = await prisma.organization.findUnique({ where: { id: tenantBOrgId } });
      assert(orgBInDb?.onboardingStatus !== 'COMPLETED', 'DB onboardingStatus remains IN_PROGRESS for incomplete org');
    }

    {
      // Tenant A has all required steps completed -> complete onboarding
      const res = await fetch(`${baseUrl}/api/portal/onboarding/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tenantAToken}` },
      });
      const json = await res.json();
      assert(res.status === 200, 'POST /api/portal/onboarding/complete succeeds with 200 when ready');
      assert(json.data.onboardingStatus === 'COMPLETED', 'Status updated to COMPLETED');

      const orgAInDb = await prisma.organization.findUnique({ where: { id: tenantAOrgId } });
      assert(orgAInDb?.onboardingStatus === 'COMPLETED', 'DB organization status is COMPLETED');
      assert(orgAInDb?.onboardingCompletedAt !== null, 'onboardingCompletedAt timestamp recorded in DB');
    }

    console.log('\n--- Test Group 6: Multi-Tenant Isolation & Security ---');
    {
      // Tenant A tries to alter Tenant B service model via token scoping
      const res = await fetch(`${baseUrl}/api/portal/onboarding/service-model`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantAToken}`,
        },
        body: JSON.stringify({ serviceModel: 'COUNTER_SERVICE' }),
      });
      assert(res.status === 200, 'Tenant A request succeeds for Tenant A context');

      // Verify Tenant B remains unchanged
      const orgBInDb = await prisma.organization.findUnique({ where: { id: tenantBOrgId } });
      assert(orgBInDb?.serviceModel === 'TAKEAWAY_ONLY', 'Tenant B serviceModel remains strictly isolated');
    }

    {
      const res = await fetch(`${baseUrl}/api/portal/onboarding`);
      assert(res.status === 401, 'Unauthenticated request rejected with 401');
    }

    console.log('\n--- Test Group 7: Audit Logging Verification ---');
    {
      const logs = await prisma.auditLog.findMany({
        where: { organizationId: tenantAOrgId },
        orderBy: { createdAt: 'desc' },
      });

      const actions = logs.map((l) => l.action);
      assert(actions.includes('ONBOARDING_STARTED'), 'Audit log records ONBOARDING_STARTED');
      assert(actions.includes('ONBOARDING_SERVICE_MODEL_SET'), 'Audit log records ONBOARDING_SERVICE_MODEL_SET');
      assert(actions.includes('TEST_ORDER_COMPLETED'), 'Audit log records TEST_ORDER_COMPLETED');
      assert(actions.includes('ONBOARDING_COMPLETED'), 'Audit log records ONBOARDING_COMPLETED');
    }
  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    // Clean up
    await prisma.organization.deleteMany({
      where: { slug: { in: ['p19-test-org-a', 'p19-test-org-b'] } },
    });
    if (server) {
      server.close();
    }
  }

  console.log('\n================================================================');
  console.log(`PHASE 19 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
