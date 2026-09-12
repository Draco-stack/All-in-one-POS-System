/**
 * Phase 21 Concurrency and Exactly-Once Certification Tests
 */

import prisma from '../src/server/prisma';
import { signTenantToken } from '../src/server/auth/jwt';
import { app } from '../server'; // Import express app for tests
import { Server } from 'http';

async function runTests() {
  console.log('================================================================');
  console.log('STARTING PHASE 21: CONCURRENCY & RACE CONDITION AUDIT');
  console.log('================================================================\n');

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

  let server: Server;
  const PORT = 22232;
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    await new Promise<void>((resolve) => {
      server = app.listen(PORT, '127.0.0.1', () => resolve());
    });

    // Setup Tenant
    await prisma.organization.deleteMany({ where: { slug: 'concurrency-org' } });
    const org = await prisma.organization.create({
      data: { name: 'Concurrency Org', slug: 'concurrency-org', status: 'ACTIVE' },
    });
    
    await prisma.subscription.create({
      data: {
        organizationId: org.id,
        plan: 'BUSINESS',
        status: 'ACTIVE',
        endDate: new Date(Date.now() + 30 * 86400000),
      },
    });

    const branch = await prisma.branch.create({
      data: { organizationId: org.id, name: 'Main', slug: 'concurrency-main', active: true },
    });

    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        name: 'Concurrency Owner',
        username: 'concurrency_owner',
        pin: 'hash',
        role: 'OWNER',
        active: true,
      },
    });

    const token = signTenantToken({
      userId: user.id,
      username: user.username,
      organizationId: org.id,
      branchId: branch.id,
      role: 'OWNER',
      isPortalAccess: true,
    });

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // Setup Inventory
    const ingredient = await prisma.ingredient.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        name: 'Test Ingredient',
        code: 'TEST-ING',
        baseUnit: 'g',
        currentStock: 10000, // 10 kg
        costPerBaseUnit: 0.1,
      },
    });

    // Create a base MenuItem and Recipe
    const cat = await prisma.category.create({
      data: { organizationId: org.id, title: 'Tests', slug: 'tests' },
    });
    
    const menuItem = await prisma.menuItem.create({
      data: {
        organizationId: org.id,
        categoryId: cat.id,
        title: 'Concurrency Item',
        price: 15.00,
        active: true,
      },
    });

    const recipe = await prisma.recipe.create({
      data: {
        organizationId: org.id,
        menuItemId: menuItem.id,
        name: 'Concurrency Recipe',
        items: {
          create: [{ ingredientId: ingredient.id, quantity: 100, unit: 'g' }]
        }
      }
    });

    console.log('--- 1. CONCURRENT PAYMENT & STATUS (RACE CONDITION) ---');
    
    // Create an order
    let orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items: [{ menuItemId: menuItem.id, quantity: 1, price: 15.00, name: 'Concurrency Item' }],
        type: 'DINE_IN'
      })
    });
    const orderData = await orderRes.json();
    
    if (!orderData || !orderData.id) {
       console.error("Order creation failed:", orderData);
    }

    // Fire payment and status transitions simultaneously
    await Promise.all([
      fetch(`${baseUrl}/api/orders/${orderData.id}/pay`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount: 15.00, method: 'CASH' })
      }),
      fetch(`${baseUrl}/api/orders/${orderData.id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'COMPLETED' })
      }),
      fetch(`${baseUrl}/api/orders/${orderData.id}/pay`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount: 15.00, method: 'CASH' })
      })
    ]);

    const updatedIng = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    assert(updatedIng?.currentStock === 9900, 'Stock deducted exactly once for concurrent payment/status race (10000 -> 9900)');
    
    const movements = await prisma.stockMovement.count({
      where: { referenceId: orderData.id, movementType: 'SALE_CONSUMPTION' }
    });
    assert(movements === 1, 'Exactly one SALE_CONSUMPTION movement recorded in ledger');

    console.log('\n--- 2. CONCURRENT SALES (20 SIMULTANEOUS ORDERS) ---');
    const orderPromises = [];
    for (let i = 0; i < 20; i++) {
      orderPromises.push(
        fetch(`${baseUrl}/api/orders`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            items: [{ menuItemId: menuItem.id, quantity: 1, price: 15.00, name: 'Concurrency Item' }],
            type: 'DINE_IN'
          })
        }).then(res => res.json()).then(data => 
          fetch(`${baseUrl}/api/orders/${data.id}/pay`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ amount: 15.00, method: 'CASH' })
          })
        )
      );
    }
    await Promise.all(orderPromises);
    
    const finalIng = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    assert(finalIng?.currentStock === 7900, 'Stock correctly deducted for 20 concurrent sales (9900 - 2000 = 7900)');

    console.log('\n================================================================');
    console.log(`CONCURRENCY AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');
  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await prisma.organization.deleteMany({ where: { slug: 'concurrency-org' } });
    if (server) server.close();
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
