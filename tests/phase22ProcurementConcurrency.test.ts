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
  let vendorId = '';
  let ingredientId = '';
  let poId = '';
  let poItemId = '';
  let receiptId = '';

  try {
    const testOrg = await prisma.organization.create({
      data: { name: 'Procurement Concurrency Org', status: 'ACTIVE', slug: 'proc-test-org-' + Math.random().toString(36).substring(7) },
    });
    orgId = testOrg.id;

    const branch = await prisma.branch.create({
      data: { organizationId: orgId, name: 'Concurrency Branch', slug: 'conc-branch-' + Math.random().toString(36).substring(7) },
    });
    branchId = branch.id;

    const owner = await prisma.user.create({
      data: { organizationId: orgId, branchId, name: 'Concurrency Owner', role: 'OWNER', pin: '1111' }
    });
    ownerToken = jwt.sign({ userId: owner.id, organizationId: orgId, role: 'OWNER', branchId }, JWT_SECRET);

    const vendor = await prisma.vendor.create({
      data: { organizationId: orgId, name: 'Concurrency Supplier' }
    });
    vendorId = vendor.id;

    const ingredient = await prisma.ingredient.create({
      data: {
        organizationId: orgId,
        branchId,
        name: 'Concurrency Flour',
        baseUnit: 'g',
        purchaseUnit: 'kg',
        conversionRatio: 1000,
        costPerPurchaseUnit: 5.0,
        costPerBaseUnit: 0.005,
        currentStock: 10000 // 10kg
      }
    });
    ingredientId = ingredient.id;

    const po = await prisma.purchaseOrder.create({
      data: {
        organizationId: orgId,
        branchId,
        vendorId,
        poNumber: 'PO-CONC-001',
        status: 'APPROVED',
        total: 50,
        items: {
          create: [{
            ingredientId,
            orderedQuantity: 10,
            remainingQuantity: 10,
            purchaseUnit: 'kg',
            conversionRatio: 1000,
            normalizedQuantity: 10000,
            unitCost: 5,
            totalCost: 50
          }]
        }
      },
      include: { items: true }
    });
    poId = po.id;
    poItemId = po.items[0].id;

    const receiptRes = await fetch(`${baseUrl}/api/portal/procurement/goods-receipts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
      body: JSON.stringify({
        purchaseOrderId: poId,
        items: [{
          purchaseOrderItemId: poItemId, receivedQuantity: 5, rejectedQuantity: 0
        }]
      })
    });
    const receiptBody = await receiptRes.json();
    receiptId = receiptBody.data.id;

    // Fire 5 concurrent finalization requests
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(fetch(`${baseUrl}/api/portal/procurement/goods-receipts/${receiptId}/finalize`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ownerToken}` },
      }));
    }

    const responses = await Promise.all(promises);
    const successes = responses.filter(r => r.ok);
    const conflicts = responses.filter(r => r.status === 409 || r.status === 400);

    assert(successes.length === 1, 'Exactly one concurrent request succeeded');
    assert(conflicts.length === 4, 'Other 4 requests failed safely (idempotent rejection)');

    const updatedIng = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
    assert(updatedIng?.currentStock === 15000, 'Inventory incremented exactly once');

    const movements = await prisma.stockMovement.findMany({
      where: { referenceId: receiptId, referenceType: 'GOODS_RECEIPT' }
    });
    assert(movements.length === 1, 'Stock Ledger recorded exactly one movement');

  } catch (err) {
    console.error(err);
    failed++;
  } finally {
    if (orgId) await prisma.organization.delete({ where: { id: orgId } });
    server.close();
    console.log(`\nProcurement Concurrency Testing Complete. Passed: ${passed}, Failed: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
