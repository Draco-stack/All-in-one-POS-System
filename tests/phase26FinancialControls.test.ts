import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import prisma from '../src/server/prisma';
import { signTenantToken } from '../src/server/auth/jwt';
import { RESTAURANT_PERMISSIONS } from '../src/server/auth/permissions';
import {
  createApprovalRequestHandler,
  getApprovalRequestsHandler,
  getApprovalRequestByIdHandler,
  processApprovalRequestHandler,
  cancelApprovalRequestHandler,
  createCashMovementHandler,
  getCashMovementsHandler,
  conductCashAuditHandler,
  getCashAuditsHandler,
  resolveVarianceHandler,
  classifyVariance,
  VARIANCE_CLASSIFICATION,
} from '../src/server/controllers/financialApprovalController';

function mockReqRes(reqData: any = {}) {
  const req: any = {
    headers: reqData.headers || {},
    body: reqData.body || {},
    query: reqData.query || {},
    params: reqData.params || {},
    tenant: reqData.tenant || null,
    user: reqData.user || null,
    ip: reqData.ip || '127.0.0.1',
    path: reqData.path || '/api/approvals',
    app: { get: () => null },
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

async function runPhase26Tests() {
  console.log('Starting Tillora Phase 26 — Financial Exception Controls & Cash Management Test Suite...');

  // Setup Test Organizations, Branches, and Users
  const timestamp = Date.now();
  const orgA = await prisma.organization.create({
    data: {
      name: `Org Financial A ${timestamp}`,
      slug: `org-fin-a-${timestamp}`,
      status: 'ACTIVE',
    },
  });

  const orgB = await prisma.organization.create({
    data: {
      name: `Org Financial B ${timestamp}`,
      slug: `org-fin-b-${timestamp}`,
      status: 'ACTIVE',
    },
  });

  const branchA = await prisma.branch.create({
    data: {
      organizationId: orgA.id,
      name: 'Branch A Main',
      slug: `branch-a-${timestamp}`,
    },
  });

  const branchB = await prisma.branch.create({
    data: {
      organizationId: orgB.id,
      name: 'Branch B Main',
      slug: `branch-b-${timestamp}`,
    },
  });

  const managerPinHash = await bcrypt.hash('1234', 10);

  // Cashier A1 in Org A
  const cashierA1 = await prisma.user.create({
    data: {
      organization: { connect: { id: orgA.id } },
      name: 'Cashier Alice',
      username: `cashier_a1_${timestamp}`,
      role: 'CASHIER',
      pin: '1111',
      active: true,
    },
  });

  // Manager A1 in Org A (Approver)
  const managerA1 = await prisma.user.create({
    data: {
      organization: { connect: { id: orgA.id } },
      name: 'Manager Bob',
      username: `manager_a1_${timestamp}`,
      role: 'MANAGER',
      pin: managerPinHash,
      active: true,
    },
  });

  // Manager B1 in Org B (Different Tenant)
  const managerB1 = await prisma.user.create({
    data: {
      organization: { connect: { id: orgB.id } },
      name: 'Manager Charlie',
      username: `manager_b1_${timestamp}`,
      role: 'MANAGER',
      pin: managerPinHash,
      active: true,
    },
  });

  // Open Register Shift for Org A
  const shiftA = await prisma.registerShift.create({
    data: {
      organizationId: orgA.id,
      branchId: branchA.id,
      shiftNumber: `SH-TEST-${timestamp}`,
      cashierName: cashierA1.name,
      openedById: cashierA1.id,
      startingFloat: 200,
      startingPettyCash: 200,
      cashInDrawerExpected: 200,
      expectedCash: 200,
      status: 'open',
    },
  });

  const tenantContextA = {
    organizationId: orgA.id,
    branchId: branchA.id,
    subscriptionStatus: 'ACTIVE',
    features: ['ALL'],
  };

  const tenantContextB = {
    organizationId: orgB.id,
    branchId: branchB.id,
    subscriptionStatus: 'ACTIVE',
    features: ['ALL'],
  };

  let createdApprovalIdA: string = '';

  try {
    // -------------------------------------------------------------
    // TEST GROUP 1: Classification Helper
    // -------------------------------------------------------------
    console.log('\n[1/10] Testing Variance Classification Helper...');
    
    assert.equal(classifyVariance(0), VARIANCE_CLASSIFICATION.WITHIN_TOLERANCE, '0 variance should be WITHIN_TOLERANCE');
    assert.equal(classifyVariance(4.5), VARIANCE_CLASSIFICATION.WITHIN_TOLERANCE, '4.5 variance should be WITHIN_TOLERANCE');
    assert.equal(classifyVariance(-12), VARIANCE_CLASSIFICATION.REQUIRES_REVIEW, '-12 variance should be REQUIRES_REVIEW');
    assert.equal(classifyVariance(45), VARIANCE_CLASSIFICATION.MATERIAL_VARIANCE, '45 variance should be MATERIAL_VARIANCE');
    console.log('✓ Variance classification logic verified.');

    // -------------------------------------------------------------
    // TEST GROUP 2: Financial Approval Request Creation
    // -------------------------------------------------------------
    console.log('\n[2/10] Testing Creation of Financial Approval Requests...');

    // 2.1: Reject request missing reason
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: cashierA1,
        body: { type: 'CASH_ADJUSTMENT', amount: 30 },
      });
      await createApprovalRequestHandler(req, res);
      assert.equal(getStatus(), 400, 'Creation without reason must fail with 400');
      assert.match(getJson().error, /reason is required/i);
    }

    // 2.2: Reject invalid approval type
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: cashierA1,
        body: { type: 'INVALID_TYPE', amount: 30, reason: 'Test' },
      });
      await createApprovalRequestHandler(req, res);
      assert.equal(getStatus(), 400, 'Creation with invalid type must fail with 400');
      assert.match(getJson().error, /Invalid approval type/i);
    }

    // 2.3: Successful creation of CASH_ADJUSTMENT approval
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: cashierA1,
        body: {
          type: 'CASH_ADJUSTMENT',
          amount: 75.5,
          reason: 'Petty cash purchase for emergency kitchen supplies',
          reasonCode: 'PETTY_CASH',
          shiftId: shiftA.id,
        },
      });
      await createApprovalRequestHandler(req, res);
      assert.equal(getStatus(), 201, 'Valid approval request creation should return 201');
      assert.equal(getJson().success, true);
      assert.equal(getJson().approval.status, 'PENDING');
      assert.equal(getJson().approval.amount, 75.5);
      assert.equal(getJson().approval.requesterId, cashierA1.id);

      createdApprovalIdA = getJson().approval.id;
    }

    // 2.4: Create DISCOUNT_OVERRIDE approval
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: cashierA1,
        body: {
          type: 'DISCOUNT_OVERRIDE',
          amount: 25,
          reason: 'VIP customer 25% discount override request',
          reasonCode: 'VIP_DISCOUNT',
        },
      });
      await createApprovalRequestHandler(req, res);
      assert.equal(getStatus(), 201);
      assert.equal(getJson().approval.type, 'DISCOUNT_OVERRIDE');
    }

    // 2.5: Create REFUND_APPROVAL approval
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: cashierA1,
        body: {
          type: 'REFUND_APPROVAL',
          amount: 110.0,
          reason: 'Customer returned cold order',
          reasonCode: 'CUSTOMER_REFUND',
        },
      });
      await createApprovalRequestHandler(req, res);
      assert.equal(getStatus(), 201);
      assert.equal(getJson().approval.type, 'REFUND_APPROVAL');
    }
    console.log('✓ Financial approval creation verified.');

    // -------------------------------------------------------------
    // TEST GROUP 3: Listing & Single Retrieval
    // -------------------------------------------------------------
    console.log('\n[3/10] Testing Approval Request Listing & Retrieval...');

    // 3.1: Get approval requests for Org A
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: managerA1,
        query: { status: 'PENDING' },
      });
      await getApprovalRequestsHandler(req, res);
      assert.equal(getStatus(), 200);
      assert.equal(getJson().success, true);
      assert.ok(Array.isArray(getJson().approvals));
      assert.ok(getJson().approvals.length >= 3);
    }

    // 3.2: Get approval by ID
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: managerA1,
        params: { id: createdApprovalIdA },
      });
      await getApprovalRequestByIdHandler(req, res);
      assert.equal(getStatus(), 200);
      assert.equal(getJson().approval.id, createdApprovalIdA);
      assert.equal(getJson().approval.requester.id, cashierA1.id);
    }
    console.log('✓ Retrieval and filtering verified.');

    // -------------------------------------------------------------
    // TEST GROUP 4: Segregation of Duties & Self-Approval Prevention
    // -------------------------------------------------------------
    console.log('\n[4/10] Testing Segregation of Duties Enforcement...');

    // 4.1: Manager attempts to request AND approve their own approval request
    let selfApprovalRequestId = '';
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: managerA1,
        body: {
          type: 'CASH_ADJUSTMENT',
          amount: 100,
          reason: 'Manager self-submitted petty cash request',
        },
      });
      await createApprovalRequestHandler(req, res);
      assert.equal(getStatus(), 201);
      selfApprovalRequestId = getJson().approval.id;
    }

    // 4.2: Manager attempts to approve their OWN request -> MUST FAIL 403
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: managerA1,
        params: { id: selfApprovalRequestId },
        path: `/api/approvals/${selfApprovalRequestId}/approve`,
        body: { pin: '1234' },
      });
      await processApprovalRequestHandler(req, res);
      assert.equal(getStatus(), 403, 'Requester approving own request MUST fail with 403 Forbidden');
      assert.equal(getJson().code, 'SEGREGATION_OF_DUTIES_VIOLATION');
      assert.match(getJson().error, /Requester cannot approve their own financial approval request/i);
    }
    console.log('✓ Segregation of duties strictly enforced.');

    // -------------------------------------------------------------
    // TEST GROUP 5: Processing Approvals & Status Transitions
    // -------------------------------------------------------------
    console.log('\n[5/10] Testing Approval Processing & PIN Verification...');

    // 5.1: Approve with invalid PIN -> fails 401
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: managerA1,
        params: { id: createdApprovalIdA },
        path: `/api/approvals/${createdApprovalIdA}/approve`,
        body: { pin: '9999' },
      });
      await processApprovalRequestHandler(req, res);
      assert.equal(getStatus(), 401, 'Invalid PIN must fail with 401');
      assert.match(getJson().error, /Invalid manager PIN/i);
    }

    // 5.2: Approve createdApprovalIdA with valid PIN by Manager Bob
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: managerA1,
        params: { id: createdApprovalIdA },
        path: `/api/approvals/${createdApprovalIdA}/approve`,
        body: { pin: '1234' },
      });
      await processApprovalRequestHandler(req, res);
      assert.equal(getStatus(), 200, 'Valid manager approval should succeed with 200');
      assert.equal(getJson().success, true);
      assert.equal(getJson().approval.status, 'APPROVED');
      assert.equal(getJson().approval.approverId, managerA1.id);
    }

    // 5.3: Concurrency protection — attempt double approval -> fails 400
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: managerA1,
        params: { id: createdApprovalIdA },
        path: `/api/approvals/${createdApprovalIdA}/approve`,
        body: { pin: '1234' },
      });
      await processApprovalRequestHandler(req, res);
      assert.equal(getStatus(), 400, 'Processing an already approved request must fail with 400');
      assert.match(getJson().error, /no longer pending/i);
    }

    // 5.4: Reject an approval request
    let approvalToRejectId = '';
    {
      const { req, res, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: cashierA1,
        body: { type: 'CASH_ADJUSTMENT', amount: 200, reason: 'Unjustified cash drop' },
      });
      await createApprovalRequestHandler(req, res);
      approvalToRejectId = getJson().approval.id;
    }

    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: managerA1,
        params: { id: approvalToRejectId },
        path: `/api/approvals/${approvalToRejectId}/reject`,
        body: { pin: '1234', rejectionReason: 'Insufficient documentation provided' },
      });
      await processApprovalRequestHandler(req, res);
      assert.equal(getStatus(), 200);
      assert.equal(getJson().approval.status, 'REJECTED');
      assert.equal(getJson().approval.rejectionReason, 'Insufficient documentation provided');
    }

    // 5.5: Cancel a pending approval request
    let approvalToCancelId = '';
    {
      const { req, res, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: cashierA1,
        body: { type: 'DISCOUNT_OVERRIDE', amount: 15, reason: 'Mistakenly requested' },
      });
      await createApprovalRequestHandler(req, res);
      approvalToCancelId = getJson().approval.id;
    }

    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: cashierA1,
        params: { id: approvalToCancelId },
      });
      await cancelApprovalRequestHandler(req, res);
      assert.equal(getStatus(), 200);
      assert.equal(getJson().approval.status, 'CANCELLED');
    }
    console.log('✓ Approval state machine & status transitions verified.');

    // -------------------------------------------------------------
    // TEST GROUP 6: Tenant Data Isolation
    // -------------------------------------------------------------
    console.log('\n[6/10] Testing Tenant Data Isolation for Approvals...');

    // 6.1: Manager in Org B attempts to access Org A's approval -> fails 404
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextB,
        user: managerB1,
        params: { id: createdApprovalIdA },
      });
      await getApprovalRequestByIdHandler(req, res);
      assert.equal(getStatus(), 404, 'Cross-tenant approval lookup must return 404');
    }

    // 6.2: Manager in Org B attempts to approve Org A's approval request -> fails 404
    {
      const { req, res, getStatus } = mockReqRes({
        tenant: tenantContextB,
        user: managerB1,
        params: { id: createdApprovalIdA },
        path: `/api/approvals/${createdApprovalIdA}/approve`,
        body: { pin: '1234' },
      });
      await processApprovalRequestHandler(req, res);
      assert.equal(getStatus(), 404, 'Cross-tenant approval processing must return 404');
    }
    console.log('✓ Tenant data isolation verified.');

    // -------------------------------------------------------------
    // TEST GROUP 7: Cash Movements & Threshold Controls
    // -------------------------------------------------------------
    console.log('\n[7/10] Testing Cash Movements & Threshold Controls...');

    // 7.1: Cash In <= $50 threshold -> succeeds directly
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: cashierA1,
        body: {
          shiftId: shiftA.id,
          movementType: 'CASH_IN',
          amount: 25.0,
          direction: 'IN',
          reason: 'Added $25 small change to till drawer',
        },
      });
      await createCashMovementHandler(req, res);
      assert.equal(getStatus(), 201, 'Cash movement <= threshold returns 201');
      assert.equal(getJson().requiresApproval, false);
      assert.equal(getJson().movement.amount, 25.0);
    }

    // 7.2: Cash Out > $50 threshold without manager PIN -> requires approval (returns 202)
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: cashierA1,
        body: {
          shiftId: shiftA.id,
          movementType: 'CASH_OUT',
          amount: 120.0,
          direction: 'OUT',
          reason: 'Paid vendor cash for urgent produce delivery',
        },
      });
      await createCashMovementHandler(req, res);
      assert.equal(getStatus(), 202, 'Cash movement > threshold without PIN returns 202 Accepted');
      assert.equal(getJson().requiresApproval, true);
      assert.ok(getJson().approval);
      assert.equal(getJson().approval.status, 'PENDING');
      assert.equal(getJson().approval.amount, 120.0);
    }

    // 7.3: Cash Out > $50 threshold WITH valid manager PIN -> processes directly
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: cashierA1,
        body: {
          shiftId: shiftA.id,
          movementType: 'CASH_OUT',
          amount: 80.0,
          direction: 'OUT',
          reason: 'Manager pre-authorized petty cash expense',
          managerPin: '1234',
        },
      });
      await createCashMovementHandler(req, res);
      assert.equal(getStatus(), 201);
      assert.equal(getJson().requiresApproval, false);
      assert.equal(getJson().movement.amount, 80.0);
    }

    // 7.4: List cash movements
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: managerA1,
        query: { shiftId: shiftA.id },
      });
      await getCashMovementsHandler(req, res);
      assert.equal(getStatus(), 200);
      assert.ok(Array.isArray(getJson().movements));
      assert.ok(getJson().movements.length >= 2);
    }
    console.log('✓ Cash movements & threshold logic verified.');

    // -------------------------------------------------------------
    // TEST GROUP 8: Spot Check Cash Audits & Variances
    // -------------------------------------------------------------
    console.log('\n[8/10] Testing Spot Check Cash Audits & Variance Classification...');

    // 8.1: Conduct spot check audit with exact expected cash -> WITHIN_TOLERANCE
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: managerA1,
        body: {
          shiftId: shiftA.id,
          actualCash: 220.5, // starting 200 + IN 75.5 (from approved 5.2) + IN 25 - OUT 80 = 220.5 expected
          notes: 'Regular mid-day cash count',
        },
      });
      await conductCashAuditHandler(req, res);
      assert.equal(getStatus(), 201);
      assert.equal(getJson().requiresApproval, false);
      assert.equal(getJson().audit.varianceClassification, 'WITHIN_TOLERANCE');
    }

    // 8.2: Conduct spot check audit with $30 cash shortage -> MATERIAL_VARIANCE
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: managerA1,
        body: {
          shiftId: shiftA.id,
          actualCash: 190.5, // Expected 220.5, actual 190.5 => variance -30
          notes: 'Unexplained cash shortage during random audit',
        },
      });
      await conductCashAuditHandler(req, res);
      assert.equal(getStatus(), 201);
      assert.equal(getJson().requiresApproval, true);
      assert.equal(getJson().audit.varianceClassification, 'MATERIAL_VARIANCE');
      assert.ok(getJson().approval);
      assert.equal(getJson().approval.type, 'CASH_AUDIT');
      assert.equal(getJson().approval.status, 'PENDING');
    }

    // 8.3: List cash audits
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: managerA1,
        query: { shiftId: shiftA.id },
      });
      await getCashAuditsHandler(req, res);
      assert.equal(getStatus(), 200);
      assert.ok(Array.isArray(getJson().audits));
      assert.ok(getJson().audits.length >= 2);
    }
    console.log('✓ Spot check cash audits verified.');

    // -------------------------------------------------------------
    // TEST GROUP 9: Shift Variance Resolution
    // -------------------------------------------------------------
    console.log('\n[9/10] Testing Shift Closing Variance Resolution...');

    // 9.1: Resolve variance with valid Manager PIN
    {
      const { req, res, getStatus, getJson } = mockReqRes({
        tenant: tenantContextA,
        user: cashierA1,
        body: {
          shiftId: shiftA.id,
          varianceAmount: -30.0,
          resolutionNote: 'Cash shortage investigated and written off as till training variance',
          managerPin: '1234',
        },
      });
      await resolveVarianceHandler(req, res);
      assert.equal(getStatus(), 200);
      assert.equal(getJson().success, true);
      assert.equal(getJson().resolution.type, 'VARIANCE_RESOLUTION');
      assert.equal(getJson().resolution.status, 'APPROVED');
    }
    console.log('✓ Shift variance resolution verified.');

    // -------------------------------------------------------------
    // TEST GROUP 10: Audit Log Verification
    // -------------------------------------------------------------
    console.log('\n[10/10] Verifying Audit Logs for Financial Control Actions...');

    const auditLogs = await prisma.auditLog.findMany({
      where: { organizationId: orgA.id },
      orderBy: { createdAt: 'desc' },
    });

    const actionTypes = auditLogs.map((a) => a.action);

    assert.ok(actionTypes.includes('APPROVAL_REQUESTED'), 'Audit log must record APPROVAL_REQUESTED');
    assert.ok(actionTypes.includes('APPROVAL_APPROVED'), 'Audit log must record APPROVAL_APPROVED');
    assert.ok(actionTypes.includes('APPROVAL_REJECTED'), 'Audit log must record APPROVAL_REJECTED');
    assert.ok(actionTypes.includes('APPROVAL_CANCELLED'), 'Audit log must record APPROVAL_CANCELLED');
    assert.ok(actionTypes.includes('CASH_MOVEMENT_CREATED'), 'Audit log must record CASH_MOVEMENT_CREATED');
    assert.ok(actionTypes.includes('CASH_AUDIT_CONDUCTED'), 'Audit log must record CASH_AUDIT_CONDUCTED');
    assert.ok(actionTypes.includes('VARIANCE_RESOLVED'), 'Audit log must record VARIANCE_RESOLVED');

    console.log(`✓ Audit log verified with ${auditLogs.length} financial control events recorded.`);

    console.log('\n=============================================================');
    console.log('🎉 ALL PHASE 26 FINANCIAL CONTROL TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('=============================================================\n');
  } finally {
    // Cleanup Test Data
    await prisma.cashAudit.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.cashMovement.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.financialApproval.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.shiftAudit.deleteMany({ where: { shift: { organizationId: { in: [orgA.id, orgB.id] } } } });
    await prisma.registerShift.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.branch.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  }
}

runPhase26Tests().catch((err) => {
  console.error('❌ Phase 26 Test Suite Failed:', err);
  process.exit(1);
});
