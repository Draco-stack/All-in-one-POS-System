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
  console.log('STARTING PHASE 21: PRODUCTION INVENTORY & RECIPE AUDIT TESTS');
  console.log('================================================================');

  const port = 49210;
  server = app.listen(port);
  baseUrl = `http://localhost:${port}`;

  let tenantAOrgId = '';
  let tenantBOrgId = '';
  let tenantAToken = '';
  let tenantBToken = '';
  let tenantABranchId = '';
  let tenantBBranchId = '';

  try {
    // 0. Clean up existing test data
    await prisma.organization.deleteMany({
      where: { slug: { in: ['p21-test-org-a', 'p21-test-org-b'] } },
    });

    // Create Tenant A Organization
    const orgA = await prisma.organization.create({
      data: {
        name: 'Phase 21 Restaurant Alpha',
        slug: 'p21-test-org-a',
        status: 'ACTIVE',
      },
    });
    tenantAOrgId = orgA.id;

    await prisma.subscription.create({
      data: {
        organizationId: orgA.id,
        plan: 'BUSINESS',
        status: 'ACTIVE',
        endDate: new Date(Date.now() + 30 * 86400000),
      },
    });

    const branchA = await prisma.branch.create({
      data: {
        organizationId: orgA.id,
        name: 'Alpha Main Branch',
        slug: 'alpha-main',
        active: true,
      },
    });
    tenantABranchId = branchA.id;

    const passwordHash = await bcrypt.hash('OwnerPass123!', 10);
    const userA = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        branchId: branchA.id,
        name: 'Alpha Owner',
        username: 'alpha_owner_p21',
        pin: passwordHash,
        role: 'OWNER',
        active: true,
      },
    });

    tenantAToken = signTenantToken({
      userId: userA.id,
      username: userA.username,
      organizationId: orgA.id,
      branchId: branchA.id,
      role: 'OWNER',
      isPortalAccess: true,
    });

    // Create Tenant B Organization
    const orgB = await prisma.organization.create({
      data: {
        name: 'Phase 21 Restaurant Beta',
        slug: 'p21-test-org-b',
        status: 'ACTIVE',
      },
    });
    tenantBOrgId = orgB.id;

    await prisma.subscription.create({
      data: {
        organizationId: orgB.id,
        plan: 'BUSINESS',
        status: 'ACTIVE',
        endDate: new Date(Date.now() + 30 * 86400000),
      },
    });

    const branchB = await prisma.branch.create({
      data: {
        organizationId: orgB.id,
        name: 'Beta Main Branch',
        slug: 'beta-main',
        active: true,
      },
    });
    tenantBBranchId = branchB.id;

    const userB = await prisma.user.create({
      data: {
        organizationId: orgB.id,
        branchId: branchB.id,
        name: 'Beta Owner',
        username: 'beta_owner_p21',
        pin: passwordHash,
        role: 'OWNER',
        active: true,
      },
    });

    tenantBToken = signTenantToken({
      userId: userB.id,
      username: userB.username,
      organizationId: orgB.id,
      branchId: branchB.id,
      role: 'OWNER',
      isPortalAccess: true,
    });

    console.log('\n--- 1. INGREDIENT / INVENTORY CRUD TESTS ---');

    // Create Ingredient (Dough) in Org A with opening stock
    const createIngRes1 = await fetch(`${baseUrl}/api/portal/inventory/ingredients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantAToken}`,
      },
      body: JSON.stringify({
        name: 'Pizza Dough',
        code: 'sku-dough',
        category: 'Baking',
        baseUnit: 'g',
        purchaseUnit: 'kg',
        conversionRatio: 1000,
        costPerPurchaseUnit: 50, // -> costPerBaseUnit = 0.05
        minStock: 200,
        currentStock: 1000,
      }),
    });
    const ingData1 = await createIngRes1.json();
    assert(createIngRes1.status === 201 && ingData1.success, 'Pizza Dough ingredient created in Org A');
    assert(ingData1.data.costPerBaseUnit === 0.05, 'Dough costPerBaseUnit automatically calculated to 0.05');

    // Verify Opening Stock Movement ledger entry
    const doughId = ingData1.data.id;
    const movements = await prisma.stockMovement.findMany({
      where: { ingredientId: doughId },
    });
    assert(movements.length === 1 && movements[0].movementType === 'OPENING_STOCK', 'Opening stock movement registered for Dough');
    assert(movements[0].quantityDelta === 1000, 'Dough opening stock movement delta matches initial quantity (1000)');

    // Create another Ingredient (Cheese)
    const createIngRes2 = await fetch(`${baseUrl}/api/portal/inventory/ingredients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantAToken}`,
      },
      body: JSON.stringify({
        name: 'Mozzarella Cheese',
        code: 'sku-cheese',
        baseUnit: 'g',
        currentStock: 500,
      }),
    });
    const ingData2 = await createIngRes2.json();
    const cheeseId = ingData2.data.id;
    assert(createIngRes2.status === 201, 'Mozzarella Cheese ingredient created');

    // Try to create Ingredient with duplicate code "sku-dough" -> Expect Fail
    const failDupeCodeRes = await fetch(`${baseUrl}/api/portal/inventory/ingredients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantAToken}`,
      },
      body: JSON.stringify({
        name: 'Another Dough',
        code: 'sku-dough',
        baseUnit: 'g',
      }),
    });
    assert(failDupeCodeRes.status === 400, 'Duplicate ingredient code (SKU) rejected by server');

    // Update Ingredient description
    const updateIngRes = await fetch(`${baseUrl}/api/portal/inventory/ingredients/${doughId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantAToken}`,
      },
      body: JSON.stringify({
        description: 'Perfect Italian pizza dough',
        minStock: 300,
      }),
    });
    const updatedIngData = await updateIngRes.json();
    assert(updateIngRes.status === 200 && updatedIngData.data.minStock === 300, 'Ingredient minStock updated successfully');

    // Archive Ingredient (Cheese) -> non-destructive soft deletion
    const archiveIngRes = await fetch(`${baseUrl}/api/portal/inventory/ingredients/${cheeseId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tenantAToken}`,
      },
    });
    assert(archiveIngRes.status === 200, 'Cheese soft deleted (archived)');
    const archivedCheese = await prisma.ingredient.findUnique({ where: { id: cheeseId } });
    assert(archivedCheese?.archived === true && archivedCheese?.active === false, 'Cheese ingredient still in DB but archived/inactive');


    console.log('\n--- 2. RECIPE CREATION, COSTING & IDOR PROTECTION TESTS ---');

    // Create Menu Item in Org A
    const catRes = await prisma.category.create({
      data: { organizationId: tenantAOrgId, title: 'Pizzas', slug: 'pizzas' },
    });
    const itemA = await prisma.menuItem.create({
      data: {
        organizationId: tenantAOrgId,
        categoryId: catRes.id,
        title: 'Margherita Pizza',
        price: 15.00,
        active: true,
      },
    });

    const variantLarge = await prisma.menuItemVariant.create({
      data: {
        organizationId: tenantAOrgId,
        menuItemId: itemA.id,
        name: 'Large',
        price: 20.00,
      },
    });

    // Create ingredient in Tenant B (for IDOR attack testing)
    const ingB = await prisma.ingredient.create({
      data: {
        organizationId: tenantBOrgId,
        name: 'Secret Beta Mushroom',
        code: 'sku-mushroom',
        baseUnit: 'g',
      },
    });

    // Try to create Recipe using Tenant B's ingredient -> Expect 403 / Rejection
    const idorRecipeRes = await fetch(`${baseUrl}/api/portal/recipes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantAToken}`,
      },
      body: JSON.stringify({
        name: 'Hacked Recipe',
        menuItemId: itemA.id,
        items: [{ ingredientId: ingB.id, quantity: 100, unit: 'g' }],
      }),
    });
    assert(idorRecipeRes.status === 403, 'Recipe creation using cross-tenant ingredient rejected (IDOR blocked!)');

    // Create valid Recipe in Org A
    const validRecipeRes = await fetch(`${baseUrl}/api/portal/recipes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantAToken}`,
      },
      body: JSON.stringify({
        name: 'Standard Margherita Recipe',
        menuItemId: itemA.id,
        items: [{ ingredientId: doughId, quantity: 200, unit: 'g' }],
      }),
    });
    const validRecipeData = await validRecipeRes.json();
    assert(validRecipeRes.status === 201 && validRecipeData.success, 'Valid Margherita Recipe created');

    // Verify Server-Side Calculated Costing
    // Dough cost per base unit: 0.05. Quantity: 200g. Expected cost: 200 * 0.05 = 10.00.
    // Selling price: 15.00.
    // Expected foodCostPercentage = (10 / 15) * 100 = 66.67%
    // Expected grossMargin = 15 - 10 = 5.00
    assert(validRecipeData.data.recipeCost === 10.00, 'Server calculated exact recipe cost (10.00)');
    assert(validRecipeData.data.foodCostPercentage === 66.67, 'Server calculated exact Food Cost % (66.67%)');
    assert(validRecipeData.data.grossMargin === 5.00, 'Server calculated exact Gross Margin (5.00)');


    console.log('\n--- 3. IMMUTABLE RECIPE VERSIONING TESTS ---');

    // Create a new recipe for the same menu item Margherita Pizza -> versioning should increment and archive the old one
    const newRecipeRes = await fetch(`${baseUrl}/api/portal/recipes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantAToken}`,
      },
      body: JSON.stringify({
        name: 'Updated Margherita Recipe',
        menuItemId: itemA.id,
        items: [{ ingredientId: doughId, quantity: 150, unit: 'g' }], // reduce dough
      }),
    });
    const newRecipeData = await newRecipeRes.json();
    assert(newRecipeRes.status === 201 && newRecipeData.data.version === 2, 'New recipe version created (v2)');

    // Verify that the old recipe version is soft-archived
    const oldRecipe = await prisma.recipe.findUnique({ where: { id: validRecipeData.data.id } });
    assert(oldRecipe?.archived === true && oldRecipe?.active === false, 'Older recipe version successfully soft-archived and retired');


    console.log('\n--- 4. AUTOMATIC POS SALES INVENTORY CONSUMPTION TESTS ---');

    // Create an Order Draft (status DRAFT or PUNCHED) -> should NOT trigger consumption
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantAToken}`,
      },
      body: JSON.stringify({
        orderType: 'DINE_IN',
        paymentMethod: 'CASH',
        items: [
          {
            menuItemId: itemA.id,
            name: 'Margherita Pizza',
            price: 15.00,
            quantity: 2, // 2 pizzas = 2 * 150g dough = 300g dough
          },
        ],
      }),
    });
    const orderData = await orderRes.json();
    assert(orderRes.status === 200, 'Draft POS Order punched successfully');

    // Verify stock is untouched (draft state)
    let freshDough = await prisma.ingredient.findUnique({ where: { id: doughId } });
    assert(freshDough?.currentStock === 1000, 'Inventory stock level remains untouched for drafts / punched status');

    // Complete/Pay the order -> should trigger consumption
    const payRes = await fetch(`${baseUrl}/api/orders/${orderData.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantAToken}`,
      },
      body: JSON.stringify({
        amount: 30.00,
        method: 'CASH',
      }),
    });
    assert(payRes.status === 200, 'POS order process payment completed');

    // Verify stock deduction: 1000g initial - (2 pizzas * 150g dough) = 700g remaining
    freshDough = await prisma.ingredient.findUnique({ where: { id: doughId } });
    assert(freshDough?.currentStock === 700, 'Inventory consumed correctly: 1000g -> 700g (-300g)');

    // Verify stock movement was logged
    const consumptionMovement = await prisma.stockMovement.findFirst({
      where: { ingredientId: doughId, movementType: 'SALE_CONSUMPTION', referenceId: orderData.id },
    });
    assert(!!consumptionMovement, 'Sale consumption stock movement successfully logged in the ledger');
    assert(consumptionMovement?.quantityDelta === -300, 'Ledger movement records correct negative delta quantity (-300)');


    console.log('\n--- 5. CONSUMPTION IDEMPOTENCY (EXACTLY-ONCE PROCESSING) ---');

    // Attempt to double-trigger payment processing on the same order
    const doublePayRes = await fetch(`${baseUrl}/api/orders/${orderData.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantAToken}`,
      },
      body: JSON.stringify({
        amount: 30.00,
        method: 'CASH',
      }),
    });
    // It should skip consumption or succeed gracefully without deducting stock again
    freshDough = await prisma.ingredient.findUnique({ where: { id: doughId } });
    assert(freshDough?.currentStock === 700, 'Stock remains exactly 700g on duplicate completion events (Idempotency guaranteed!)');

    console.log('\n================================================================');
    console.log(`PHASE 21 AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');
  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    // Cleanup
    await prisma.organization.deleteMany({
      where: { slug: { in: ['p21-test-org-a', 'p21-test-org-b'] } },
    });
    if (server) server.close();
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
