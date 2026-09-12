import express from 'express';
import http from 'http';
import prisma from '../src/server/prisma';
import jwt from 'jsonwebtoken';
import { roundMoney, isValidStatusTransition } from '../src/server/financialHelper';
import { app } from '../server';

const JWT_SECRET = process.env.JWT_SECRET || 'tillora-development-secret-key-change-in-production';

function makeToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runPhase5Tests() {
  console.log('====================================================');
  console.log('💰 RUNNING PHASE 5 FINANCIAL INTEGRITY & CONCURRENCY TESTS');
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

  // Setup local server for testing Express app endpoints
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  async function apiRequest(
    path: string,
    options: { method?: string; body?: any; headers?: Record<string, string> } = {}
  ) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let json: any = {};
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, body: json };
  }

  let orgA: any;
  let orgB: any;
  let branchA: any;
  let branchB: any;
  let userA_Cashier: any;
  let userA_Manager: any;
  let userB_Manager: any;
  let menuItemA1: any;
  let menuItemA2: any;
  let tokenA_Cashier: string;
  let tokenA_Manager: string;
  let tokenB_Manager: string;

  try {
    // --------------------------------------------------------------------------
    // SETUP TEST ENVIRONMENT
    // --------------------------------------------------------------------------
    orgA = await prisma.organization.create({
      data: { name: 'P5 Financial Org A', slug: `p5-org-a-${Date.now()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: 'P5 Financial Org B', slug: `p5-org-b-${Date.now()}` },
    });

    branchA = await prisma.branch.create({
      data: { organizationId: orgA.id, name: 'Main Branch A', slug: `bra-${Date.now()}` },
    });
    branchB = await prisma.branch.create({
      data: { organizationId: orgB.id, name: 'Main Branch B', slug: `brb-${Date.now()}` },
    });

    userA_Cashier = await prisma.user.create({
      data: { organizationId: orgA.id, branchId: branchA.id, name: 'Alice Cashier', username: `cashier_a_${Date.now()}`, pin: '$2a$10$e8Za3L', role: 'CASHIER' },
    });
    userA_Manager = await prisma.user.create({
      data: { organizationId: orgA.id, branchId: branchA.id, name: 'Bob Manager', username: `manager_a_${Date.now()}`, pin: '$2a$10$e8Za3L', role: 'MANAGER' },
    });
    userB_Manager = await prisma.user.create({
      data: { organizationId: orgB.id, branchId: branchB.id, name: 'Charlie Manager', username: `manager_b_${Date.now()}`, pin: '$2a$10$e8Za3L', role: 'MANAGER' },
    });

    const catA = await prisma.category.create({
      data: { organizationId: orgA.id, title: 'Mains', slug: `mains-${Date.now()}` },
    });

    menuItemA1 = await prisma.menuItem.create({
      data: {
        organizationId: orgA.id,
        categoryId: catA.id,
        title: 'DB Price Burger',
        price: 12.50,
        active: true,
      },
    });

    menuItemA2 = await prisma.menuItem.create({
      data: {
        organizationId: orgA.id,
        categoryId: catA.id,
        title: 'DB Price Fries',
        price: 4.25,
        active: true,
      },
    });

    tokenA_Cashier = makeToken({ userId: userA_Cashier.id, organizationId: orgA.id, branchId: branchA.id, role: 'CASHIER' });
    tokenA_Manager = makeToken({ userId: userA_Manager.id, organizationId: orgA.id, branchId: branchA.id, role: 'MANAGER' });
    tokenB_Manager = makeToken({ userId: userB_Manager.id, organizationId: orgB.id, branchId: branchB.id, role: 'MANAGER' });

    const headersA_Cashier = { Authorization: `Bearer ${tokenA_Cashier}`, 'x-organization-id': orgA.id, 'x-branch-id': branchA.id };
    const headersA_Manager = { Authorization: `Bearer ${tokenA_Manager}`, 'x-organization-id': orgA.id, 'x-branch-id': branchA.id };
    const headersB_Manager = { Authorization: `Bearer ${tokenB_Manager}`, 'x-organization-id': orgB.id, 'x-branch-id': branchB.id };

    // --------------------------------------------------------------------------
    // 1. SERVER-AUTHORITATIVE CALCULATIONS
    // --------------------------------------------------------------------------
    console.log('1. Testing Server-Authoritative Calculations & Price Enforcement...');

    // 1.1 Client manipulated subtotal/total
    const resManip = await apiRequest('/api/orders', {
      method: 'POST',
      headers: headersA_Cashier,
      body: {
        orderNumber: `P5-ORD-MANIP-${Date.now()}`,
        items: [
          { menuItemId: menuItemA1.id, name: 'Manipulated Burger', price: 0.01, quantity: 2 }, // DB price $12.50
          { menuItemId: menuItemA2.id, name: 'Manipulated Fries', price: 0.00, quantity: 1 },  // DB price $4.25
        ],
        subtotal: 0.01,
        tax: 1.00,
        total: 1.01,
      },
    });

    assert(resManip.status === 200, 'Order creation accepts order and recalculates totals');
    assert(resManip.body.subtotal === 29.25, `Calculated DB subtotal 29.25 (got ${resManip.body.subtotal})`);
    assert(resManip.body.total === 30.25, `Calculated DB total 30.25 (got ${resManip.body.total})`);

    // 1.2 Invalid negative quantity rejection
    const resNegQty = await apiRequest('/api/orders', {
      method: 'POST',
      headers: headersA_Cashier,
      body: {
        items: [{ menuItemId: menuItemA1.id, name: 'Burger', price: 12.50, quantity: -5 }],
      },
    });
    assert(resNegQty.status === 400, 'Rejects negative item quantity with 400 Bad Request');

    // 1.3 Invalid negative price rejection
    const resNegPrice = await apiRequest('/api/orders', {
      method: 'POST',
      headers: headersA_Cashier,
      body: {
        items: [{ name: 'Custom Item', price: -100, quantity: 1 }],
      },
    });
    assert(resNegPrice.status === 400, 'Rejects negative item price with 400 Bad Request');

    // 1.4 Oversized discount capped
    const resDiscount = await apiRequest('/api/orders', {
      method: 'POST',
      headers: headersA_Cashier,
      body: {
        orderNumber: `P5-DISC-${Date.now()}`,
        items: [{ menuItemId: menuItemA1.id, name: 'Burger', price: 12.50, quantity: 1 }],
        discount: 9999.00,
      },
    });
    assert(resDiscount.status === 200, 'Oversized discount processed');
    assert(resDiscount.body.total === 0, 'Total capped at 0 without negative balance');

    // --------------------------------------------------------------------------
    // 2. MONETARY PRECISION & ROUNDING
    // --------------------------------------------------------------------------
    console.log('\n2. Testing Monetary Precision & Rounding Rules...');

    assert(roundMoney(10.005) === 10.01, 'Half-up rounding 10.005 -> 10.01');
    assert(roundMoney(10.004) === 10.00, 'Half-down rounding 10.004 -> 10.00');
    assert(roundMoney(0.1 + 0.2) === 0.30, 'Floating point fix 0.1 + 0.2 -> 0.30');
    assert(roundMoney(null) === 0, 'Null money converts to 0');

    const resRound = await apiRequest('/api/orders', {
      method: 'POST',
      headers: headersA_Cashier,
      body: {
        orderNumber: `P5-ROUND-${Date.now()}`,
        items: [{ name: 'Bulk Item', price: 3.33, quantity: 3 }], // 9.99
        tax: 0.824, // 0.82
        tip: 1.505, // 1.51
      },
    });
    assert(resRound.body.subtotal === 9.99, 'Subtotal rounded to 9.99');
    assert(resRound.body.tax === 0.82, 'Tax rounded to 0.82');
    assert(resRound.body.tip === 1.51, 'Tip rounded to 1.51');
    assert(resRound.body.total === 12.32, 'Exact total sum 12.32');

    // --------------------------------------------------------------------------
    // 3. FINANCIAL IDEMPOTENCY & CONCURRENCY
    // --------------------------------------------------------------------------
    console.log('\n3. Testing Idempotency & Concurrency Hardening...');

    const idempotencyKey = `IDEM-KEY-${Date.now()}`;
    const resIdem1 = await apiRequest('/api/orders', {
      method: 'POST',
      headers: { ...headersA_Cashier, 'idempotency-key': idempotencyKey },
      body: {
        orderNumber: idempotencyKey,
        items: [{ menuItemId: menuItemA1.id, name: 'Burger', price: 12.50, quantity: 1 }],
      },
    });
    assert(resIdem1.status === 200, 'Initial order creation succeeded');

    // Replay with same idempotency key
    const resIdem2 = await apiRequest('/api/orders', {
      method: 'POST',
      headers: { ...headersA_Cashier, 'idempotency-key': idempotencyKey },
      body: {
        orderNumber: idempotencyKey,
        items: [{ menuItemId: menuItemA1.id, name: 'Burger', price: 12.50, quantity: 1 }],
      },
    });
    assert(resIdem2.status === 200, 'Replay returned 200 OK');
    assert(resIdem2.body.id === resIdem1.body.id, 'Idempotency returned identical order ID');

    // Cross-Tenant Idempotency Key Isolation
    const resIdemOrgB = await apiRequest('/api/orders', {
      method: 'POST',
      headers: { ...headersB_Manager, 'idempotency-key': idempotencyKey },
      body: {
        orderNumber: idempotencyKey,
        items: [{ name: 'Org B Distinct Item', price: 15.00, quantity: 1 }],
      },
    });
    assert(resIdemOrgB.status === 200, 'Org B created distinct order with same key');
    assert(resIdemOrgB.body.id !== resIdem1.body.id, 'Org B order ID is distinct from Org A');

    // Concurrent order payment attempts
    const payOrderRes = await apiRequest('/api/orders', {
      method: 'POST',
      headers: headersA_Cashier,
      body: {
        orderNumber: `P5-PAY-CONCUR-${Date.now()}`,
        items: [{ menuItemId: menuItemA1.id, name: 'Burger', price: 12.50, quantity: 1 }],
      },
    });
    const payOrderId = payOrderRes.body.id;

    const [pay1, pay2, pay3] = await Promise.all([
      apiRequest(`/api/orders/${payOrderId}/pay`, { method: 'POST', headers: headersA_Cashier, body: { amount: 12.50, method: 'CASH' } }),
      apiRequest(`/api/orders/${payOrderId}/pay`, { method: 'POST', headers: headersA_Cashier, body: { amount: 12.50, method: 'CASH' } }),
      apiRequest(`/api/orders/${payOrderId}/pay`, { method: 'POST', headers: headersA_Cashier, body: { amount: 12.50, method: 'CASH' } }),
    ]);
    assert([pay1.status, pay2.status, pay3.status].every((s) => s === 200), 'Concurrent payments process safely with 200 OK');

    // Concurrent shift close
    const shiftRes = await apiRequest('/api/shifts/open', {
      method: 'POST',
      headers: headersA_Cashier,
      body: { cashierName: 'Alice', startingFloat: 100.00 },
    });
    const shiftId = shiftRes.body.shift.id;

    const [close1, close2] = await Promise.all([
      apiRequest('/api/shifts/close', { method: 'POST', headers: headersA_Cashier, body: { shiftId, actualCash: 100.00 } }),
      apiRequest('/api/shifts/close', { method: 'POST', headers: headersA_Cashier, body: { shiftId, actualCash: 100.00 } }),
    ]);
    const closeStatuses = [close1.status, close2.status];
    assert(closeStatuses.includes(200), 'One shift close succeeded with 200 OK');
    assert(closeStatuses.includes(409) || closeStatuses.includes(404), 'Concurrent shift close rejected with 409 Conflict');

    // --------------------------------------------------------------------------
    // 4. ORDER STATE MACHINE VALIDATION
    // --------------------------------------------------------------------------
    console.log('\n4. Testing Order State Machine Rules...');

    assert(isValidStatusTransition('PUNCHED', 'COMPLETED').allowed, 'Allowed: PUNCHED -> COMPLETED');
    assert(isValidStatusTransition('COMPLETED', 'REFUNDED').allowed, 'Allowed: COMPLETED -> REFUNDED');
    assert(!isValidStatusTransition('CANCELLED', 'COMPLETED').allowed, 'Forbidden: CANCELLED -> COMPLETED');
    assert(!isValidStatusTransition('REFUNDED', 'PUNCHED').allowed, 'Forbidden: REFUNDED -> PUNCHED');

    // Attempt modify on CANCELLED order
    const cancelOrdRes = await apiRequest('/api/orders', {
      method: 'POST',
      headers: headersA_Cashier,
      body: {
        orderNumber: `P5-CANCEL-STATE-${Date.now()}`,
        items: [{ menuItemId: menuItemA1.id, name: 'Burger', price: 12.50, quantity: 1 }],
      },
    });
    const cancelOrdId = cancelOrdRes.body.id;

    await apiRequest(`/api/orders/${cancelOrdId}/cancel`, {
      method: 'POST',
      headers: headersA_Manager,
      body: { reason: 'Test Cancel State' },
    });

    const resBadModify = await apiRequest(`/api/orders/${cancelOrdId}/modify`, {
      method: 'POST',
      headers: headersA_Manager,
      body: { items: [{ name: 'Item', price: 10, quantity: 1 }] },
    });
    assert(resBadModify.status === 400, 'Rejects modification of CANCELLED order');

    // --------------------------------------------------------------------------
    // 5. REFUNDS, CANCELLATIONS & AUDIT TRAIL
    // --------------------------------------------------------------------------
    console.log('\n5. Testing Refunds, Cancellations & Audit Trail...');

    const custPhone = `555${Math.floor(100000 + Math.random() * 900000)}`;
    const refundOrdRes = await apiRequest('/api/orders', {
      method: 'POST',
      headers: headersA_Cashier,
      body: {
        orderNumber: `P5-REFUND-FULL-${Date.now()}`,
        items: [{ menuItemId: menuItemA1.id, name: 'Burger', price: 12.50, quantity: 2 }], // $25.00
        customer: { name: 'Customer Refund', phone: custPhone },
      },
    });
    const refundOrdId = refundOrdRes.body.id;
    const custId = refundOrdRes.body.customer?.id || refundOrdRes.body.customerId;

    await apiRequest(`/api/orders/${refundOrdId}/pay`, {
      method: 'POST',
      headers: headersA_Cashier,
      body: { amount: 25.00 },
    });

    let custBefore = await prisma.customer.findUnique({ where: { id: custId } });
    assert(custBefore?.totalSpent === 25.00, 'Customer totalSpent updated to 25.00');

    const refundExecRes = await apiRequest(`/api/orders/${refundOrdId}/refund`, {
      method: 'POST',
      headers: headersA_Manager,
      body: { reason: 'Food quality return', amount: 25.00 },
    });
    assert(refundExecRes.status === 200, 'Manager refund executed successfully');
    assert(refundExecRes.body.order.status === 'refunded', 'Order status updated to refunded');

    let custAfter = await prisma.customer.findUnique({ where: { id: custId } });
    assert(custAfter?.totalSpent === 0, 'Customer totalSpent decremented back to 0 on refund');

    const auditRef = await prisma.auditLog.findFirst({
      where: { action: 'REFUNDED', userId: userA_Manager.id },
    });
    assert(!!auditRef, 'Refund audit log created');

    // Non-manager refund attempt
    const resBadRefundAuth = await apiRequest(`/api/orders/${refundOrdId}/refund`, {
      method: 'POST',
      headers: headersA_Cashier,
      body: { reason: 'Cashier attempt' },
    });
    assert(resBadRefundAuth.status === 403, 'Cashier forbidden from issuing refund (403)');

    // Excess refund amount attempt
    const resExcessRefund = await apiRequest(`/api/orders/${refundOrdId}/refund`, {
      method: 'POST',
      headers: headersA_Manager,
      body: { amount: 5000.00 },
    });
    assert(resExcessRefund.status === 400, 'Rejects refund amount exceeding order total');

    // --------------------------------------------------------------------------
    // 6. SHIFT RECONCILIATION & CASH ADJUSTMENTS
    // --------------------------------------------------------------------------
    console.log('\n6. Testing Shift Reconciliation & Cash Adjustments...');

    const reconShiftRes = await apiRequest('/api/shifts/open', {
      method: 'POST',
      headers: headersA_Cashier,
      body: { cashierName: 'Alice', startingFloat: 100.00 },
    });
    const reconShiftId = reconShiftRes.body.shift.id;

    const ordShiftSales = await apiRequest('/api/orders', {
      method: 'POST',
      headers: headersA_Cashier,
      body: {
        orderNumber: `P5-SHIFT-SALES-${Date.now()}`,
        shiftId: reconShiftId,
        items: [{ menuItemId: menuItemA1.id, name: 'Burger', price: 12.50, quantity: 2 }],
      },
    });
    await apiRequest(`/api/orders/${ordShiftSales.body.id}/pay`, {
      method: 'POST',
      headers: headersA_Cashier,
      body: { amount: 25.00, method: 'CASH' },
    });

    const shiftCloseRes = await apiRequest('/api/shifts/close', {
      method: 'POST',
      headers: headersA_Cashier,
      body: { shiftId: reconShiftId, actualCash: 120.00 },
    });
    assert(shiftCloseRes.status === 200, 'Shift closed cleanly');
    assert(shiftCloseRes.body.shift.cashSales === 25.00, 'Tally cash sales $25.00');
    assert(shiftCloseRes.body.shift.expectedCash === 125.00, 'Expected cash $125.00');
    assert(shiftCloseRes.body.shift.actualCash === 120.00, 'Actual cash $120.00');
    assert(shiftCloseRes.body.shift.cashDifference === -5.00, 'Shortage variance -$5.00 calculated');

    // Cash Adjustment (Pay-In)
    const activeShiftRes = await apiRequest('/api/shifts/open', {
      method: 'POST',
      headers: headersA_Cashier,
      body: { cashierName: 'Alice', startingFloat: 50.00 },
    });
    const activeShiftId = activeShiftRes.body.shift.id;

    const cashAdjRes = await apiRequest('/api/shifts/cash-adjustment', {
      method: 'POST',
      headers: headersA_Manager,
      body: { shiftId: activeShiftId, amount: 20.00, type: 'PAY_IN', reason: 'Change float coins' },
    });
    assert(cashAdjRes.status === 200, 'Cash adjustment pay-in succeeded');
    assert(cashAdjRes.body.shift.startingPettyCash === 70.00, 'Updated petty cash float');

    const cashAdjAudit = await prisma.auditLog.findFirst({
      where: { action: 'CASH_ADJUSTMENT', entityId: activeShiftId },
    });
    assert(!!cashAdjAudit, 'Cash adjustment audit log recorded');

    // Rejects cash adjustment without reason
    const badCashAdj = await apiRequest('/api/shifts/cash-adjustment', {
      method: 'POST',
      headers: headersA_Manager,
      body: { shiftId: activeShiftId, amount: 10.00, type: 'PAY_IN', reason: '' },
    });
    assert(badCashAdj.status === 400, 'Rejects cash adjustment without reason');

    // --------------------------------------------------------------------------
    // 7. CROSS-TENANT FINANCIAL ISOLATION (IDOR DEFENSE)
    // --------------------------------------------------------------------------
    console.log('\n7. Testing Cross-Tenant Financial Isolation (IDOR Defense)...');

    const orgA_Order = await apiRequest('/api/orders', {
      method: 'POST',
      headers: headersA_Cashier,
      body: {
        orderNumber: `P5-TEN-A-${Date.now()}`,
        items: [{ menuItemId: menuItemA1.id, name: 'Burger', price: 12.50, quantity: 1 }],
      },
    });
    const orderA_Id = orgA_Order.body.id;

    // Org B manager attempts refund on Org A order
    const idorRefund = await apiRequest(`/api/orders/${orderA_Id}/refund`, {
      method: 'POST',
      headers: headersB_Manager,
      body: { reason: 'IDOR attack refund' },
    });
    assert(idorRefund.status === 404, 'IDOR refund attempt returned 404 Not Found');

    // Org B manager attempts modify on Org A order
    const idorModify = await apiRequest(`/api/orders/${orderA_Id}/modify`, {
      method: 'POST',
      headers: headersB_Manager,
      body: { items: [{ name: 'Free Item', price: 0, quantity: 1 }] },
    });
    assert(idorModify.status === 404, 'IDOR modify attempt returned 404 Not Found');

    // Org B manager attempts to close Org A shift
    const idorShiftClose = await apiRequest('/api/shifts/close', {
      method: 'POST',
      headers: headersB_Manager,
      body: { shiftId: activeShiftId, actualCash: 0 },
    });
    assert(idorShiftClose.status === 404, 'IDOR shift close attempt returned 404 Not Found');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    server.close();
    // Cleanup test data
    try {
      await prisma.orderItem.deleteMany({ where: { order: { organizationId: { in: [orgA?.id, orgB?.id].filter(Boolean) } } } });
      await prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgA?.id, orgB?.id].filter(Boolean) } } });
      await prisma.shiftAudit.deleteMany({ where: { shift: { organizationId: { in: [orgA?.id, orgB?.id].filter(Boolean) } } } });
      await prisma.order.deleteMany({ where: { organizationId: { in: [orgA?.id, orgB?.id].filter(Boolean) } } });
      await prisma.registerShift.deleteMany({ where: { organizationId: { in: [orgA?.id, orgB?.id].filter(Boolean) } } });
      await prisma.customer.deleteMany({ where: { organizationId: { in: [orgA?.id, orgB?.id].filter(Boolean) } } });
      await prisma.menuItem.deleteMany({ where: { organizationId: { in: [orgA?.id, orgB?.id].filter(Boolean) } } });
      await prisma.category.deleteMany({ where: { organizationId: { in: [orgA?.id, orgB?.id].filter(Boolean) } } });
      await prisma.user.deleteMany({ where: { organizationId: { in: [orgA?.id, orgB?.id].filter(Boolean) } } });
      await prisma.branch.deleteMany({ where: { organizationId: { in: [orgA?.id, orgB?.id].filter(Boolean) } } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgA?.id, orgB?.id].filter(Boolean) } } });
    } catch {}

    console.log('\n====================================================');
    console.log(`📊 PHASE 5 FINANCIAL TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runPhase5Tests();
