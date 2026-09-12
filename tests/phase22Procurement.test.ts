import http from 'http';
import prisma from '../src/server/prisma';
import { app } from '../server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-tests';

let server: http.Server;
let baseUrl: string;
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`❌ FAIL: ${message}`);
  }
}

async function runTests() {
  
  server = app.listen(0);
  const port = (server.address() as any).port;
  baseUrl = `http://localhost:${port}`;

  let orgId = '';
  let branchId = '';
  let ownerToken = '';
  let managerToken = '';
  let cashierToken = '';
  let vendorId = '';
  let ingredientId = '';
  let poId = '';
  let receiptId = '';

  try {
    const testOrg = await prisma.organization.create({
      data: { name: 'Procurement Test Org', status: 'ACTIVE', slug: 'proc-test-org-' + Math.random().toString(36).substring(7) },
    });
    orgId = testOrg.id;

    const branch = await prisma.branch.create({
      data: { organizationId: orgId, name: 'Main Branch Procurement', slug: 'proc-branch-' + Math.random().toString(36).substring(7) },
    });
    branchId = branch.id;

    const owner = await prisma.user.create({
      data: { organizationId: orgId, branchId, name: 'PO Owner', role: 'OWNER', pin: '1111' }
    });
    const manager = await prisma.user.create({
      data: { organizationId: orgId, branchId, name: 'PO Manager', role: 'MANAGER', pin: '2222' }
    });
    const cashier = await prisma.user.create({
      data: { organizationId: orgId, branchId, name: 'PO Cashier', role: 'CASHIER', pin: '3333' }
    });

    ownerToken = jwt.sign({ userId: owner.id, organizationId: orgId, role: 'OWNER', branchId }, JWT_SECRET);
    managerToken = jwt.sign({ userId: manager.id, organizationId: orgId, role: 'MANAGER', branchId }, JWT_SECRET);
    cashierToken = jwt.sign({ userId: cashier.id, organizationId: orgId, role: 'CASHIER', branchId }, JWT_SECRET);

    const vendor = await prisma.vendor.create({
      data: { organizationId: orgId, name: 'Test Supplier' }
    });
    vendorId = vendor.id;

    const ingredient = await prisma.ingredient.create({
      data: {
        organizationId: orgId,
        branchId,
        name: 'Test Flour',
        baseUnit: 'g',
        purchaseUnit: 'kg',
        conversionRatio: 1000,
        costPerPurchaseUnit: 5.0,
        costPerBaseUnit: 0.005,
        currentStock: 10000 // 10kg
      }
    });
    ingredientId = ingredient.id;

    // Test 1: Create PO
    let res = await fetch(`${baseUrl}/api/portal/procurement/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
      body: JSON.stringify({
        vendorId,
        branchId,
        items: [{
          ingredientId, orderedQuantity: 50, purchaseUnit: 'kg', conversionRatio: 1000, unitCost: 6.0
        }]
      })
    });
    let body = await res.json();
    assert(res.ok && body.data.status === 'DRAFT', 'Owner can create PO');
    poId = body.data.id;

    // Test 2: Submit PO
    res = await fetch(`${baseUrl}/api/portal/procurement/purchase-orders/${poId}/submit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}` },
    });
    assert(res.ok, 'Owner can submit PO');

    // Test 3: Cashier fail approve
    res = await fetch(`${baseUrl}/api/portal/procurement/purchase-orders/${poId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cashierToken}` },
    });
    assert(res.status === 403, 'Cashier cannot approve PO');

    // Test 4: Manager approve
    res = await fetch(`${baseUrl}/api/portal/procurement/purchase-orders/${poId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
    });
    assert(res.ok, 'Manager can approve PO');

    // Test 5: Create Goods Receipt
    res = await fetch(`${baseUrl}/api/portal/procurement/purchase-orders/${poId}`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` },
    });
    body = await res.json();
    const poItemId = body.data.items[0].id;

    res = await fetch(`${baseUrl}/api/portal/procurement/goods-receipts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${managerToken}` },
      body: JSON.stringify({
        purchaseOrderId: poId,
        items: [{
          purchaseOrderItemId: poItemId, receivedQuantity: 30, rejectedQuantity: 2
        }]
      })
    });
    body = await res.json();
    assert(res.ok && body.data.status === 'DRAFT', 'Manager can create receipt');
    receiptId = body.data.id;

    // Test 6: Finalize Goods Receipt
    res = await fetch(`${baseUrl}/api/portal/procurement/goods-receipts/${receiptId}/finalize`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${managerToken}` },
    });
    assert(res.ok, 'Manager can finalize receipt');

    const updatedIng = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
    assert(updatedIng?.currentStock === 38000, 'Inventory properly updated exactly once');

    const movement = await prisma.stockMovement.findFirst({
      where: { ingredientId, referenceType: 'GOODS_RECEIPT' }
    });
    assert(movement?.quantityDelta === 28000, 'Stock Ledger exactly recorded');

  } catch (err) {
    console.error(err);
    failed++;
  } finally {
    if (orgId) await prisma.organization.delete({ where: { id: orgId } });
    server.close();
    console.log(`\nProcurement Testing Complete. Passed: ${passed}, Failed: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
