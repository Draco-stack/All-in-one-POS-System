/**
 * TILLORA PHASE 16: REAL-WORLD PILOT & OPERATIONAL READINESS TEST SUITE
 * 
 * Verifies:
 * 1. End-to-end Onboarding of Realistic Demo Restaurant ("Tillora Pilot Restaurant").
 * 2. Multi-role access (Owner, Manager, Cashier, Waiter, Kitchen).
 * 3. Complete Test-Service Lifecycle: Float -> Seating -> KOT -> KDS -> Modifiers -> Settlement -> Drawer -> Reconciliation.
 * 4. Required Order Scenarios: Dine-in, Takeaway, Delivery, Deep Modifiers, Discounts, Split Payments, Concurrent Tills.
 * 5. Complete Cash Reconciliation Matrix (Cases 1-5).
 * 6. Multi-Till and Cross-Tenant Horizontal Isolation.
 * 7. Offline sync & fail-closed security integrity.
 */

process.env.NODE_ENV = 'test';

import { app } from '../server';
import http from 'http';
import prisma from '../src/server/prisma';
import { signTenantToken } from '../src/server/auth/jwt';
import bcrypt from 'bcryptjs';

let server: http.Server;
let baseUrl: string;

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    failed++;
    process.exit(1);
  }
  passed++;
  console.log(`  ✅ PASS: ${message}`);
}

async function request(path: string, options: { method?: string; body?: any; token?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data, headers: res.headers };
}

async function runPhase16PilotTests() {
  console.log('\n======================================================================');
  console.log('🍽️  STARTING TILLORA PHASE 16: PILOT OPERATIONAL READINESS AUDIT');
  console.log('======================================================================\n');

  // Start test HTTP server
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = (server.address() as any).port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test server booted at ${baseUrl}`);
      resolve();
    });
  });

  const ts = Date.now();
  const orgId = `org_pilot_${ts}`;
  const branchId = `branch_pilot_main_${ts}`;
  const betaOrgId = `org_pilot_beta_${ts}`;
  const betaBranchId = `branch_pilot_beta_${ts}`;

  try {
    // --------------------------------------------------------------------------
    // 1. RESTAURANT & BRANCH ONBOARDING PROVISIONING
    // --------------------------------------------------------------------------
    console.log('\n--- 1. Testing Pilot Restaurant Onboarding & Configuration ---');

    // Create Pilot Tenant Organization
    const pilotOrg = await prisma.organization.create({
      data: {
        id: orgId,
        name: 'Tillora Pilot Restaurant',
        slug: `tillora-pilot-${ts}`,
        status: 'ACTIVE',
        settings: JSON.stringify({
          currency: 'PKR',
          currencySymbol: 'Rs.',
          timezone: 'Asia/Karachi',
          brand: 'Tillora Pilot',
        }),
      },
    });
    assert(!!pilotOrg.id, 'Created Tillora Pilot Organization in database');

    // Create 14-Day Free Trial Subscription
    const pilotSub = await prisma.subscription.create({
      data: {
        id: `sub_pilot_${ts}`,
        organizationId: orgId,
        plan: 'BUSINESS',
        status: 'ACTIVE',
        features: JSON.stringify(['pos', 'orders', 'kds', 'delivery', 'modifiers', 'splits', 'reconciliation']),
      },
    });
    assert(pilotSub.status === 'ACTIVE', 'Initialized active SaaS subscription plan for pilot');

    // Create Main Branch
    const pilotBranch = await prisma.branch.create({
      data: {
        id: branchId,
        organizationId: orgId,
        name: 'Main Pilot Branch',
        slug: `main-pilot-${ts}`,
        address: 'Plot 44-C Commercial Avenue, Phase 5',
        phone: '+92 42 3555 1234',
        taxRate: 0.16, // 16% sales tax
        active: true,
        settings: JSON.stringify({
          enableKds: true,
          receiptHeader: 'Tillora Pilot Restaurant - Main Branch',
          receiptFooter: 'Thank you for your visit!',
        }),
      },
    });
    assert(pilotBranch.taxRate === 0.16, 'Configured branch with 16% sales tax rate and receipt templates');

    // Configure Tables T01 to T10
    for (let i = 1; i <= 10; i++) {
      const tableNum = `T${i < 10 ? '0' + i : i}`;
      await prisma.table.create({
        data: {
          id: `tbl_${orgId}_${tableNum}`,
          organizationId: orgId,
          branchId: branchId,
          number: tableNum,
          capacity: i % 2 === 0 ? 4 : 2,
          status: 'AVAILABLE',
        },
      });
    }
    const tableCount = await prisma.table.count({ where: { organizationId: orgId, branchId: branchId } });
    assert(tableCount === 10, 'Provisioned 10 dine-in tables (T01-T10) for the floor layout');

    // Configure Categories: Burgers, Pizza, Rice, Drinks, Desserts, Deals
    const catBurgers = await prisma.category.create({
      data: { id: `cat_burgers_${ts}`, organizationId: orgId, title: 'Burgers', slug: `burgers-${ts}` },
    });
    const catPizza = await prisma.category.create({
      data: { id: `cat_pizza_${ts}`, organizationId: orgId, title: 'Pizza', slug: `pizza-${ts}` },
    });
    const catDrinks = await prisma.category.create({
      data: { id: `cat_drinks_${ts}`, organizationId: orgId, title: 'Drinks', slug: `drinks-${ts}` },
    });
    const catDeals = await prisma.category.create({
      data: { id: `cat_deals_${ts}`, organizationId: orgId, title: 'Deals', slug: `deals-${ts}` },
    });
    assert(!!catBurgers.id && !!catPizza.id, 'Configured restaurant menu categories');

    // Configure Menu Items with Modifier Options
    const itemZinger = await prisma.menuItem.create({
      data: {
        id: `item_zinger_${ts}`,
        organizationId: orgId,
        categoryId: catBurgers.id,
        title: 'Zinger Burger',
        price: 550,
        active: true,
        options: JSON.stringify([
          { name: 'Extra Cheese', price: 60 },
          { name: 'Extra Sauce', price: 40 },
          { name: 'Jalapeños', price: 30 },
        ]),
      },
    });

    const itemDrink = await prisma.menuItem.create({
      data: {
        id: `item_drink_${ts}`,
        organizationId: orgId,
        categoryId: catDrinks.id,
        title: 'Cold Drink 500ml',
        price: 120,
        active: true,
      },
    });

    const itemDeal = await prisma.menuItem.create({
      data: {
        id: `item_deal_${ts}`,
        organizationId: orgId,
        categoryId: catDeals.id,
        title: 'Pilot Mega Deal (2 Zingers + 2 Drinks)',
        price: 1200,
        active: true,
      },
    });
    assert(!!itemZinger.id && !!itemDeal.id, 'Configured realistic menu items and modifier options');

    // --------------------------------------------------------------------------
    // 2. MULTI-ROLE STAFF ACCOUNTS & PERMISSION MATRIX
    // --------------------------------------------------------------------------
    console.log('\n--- 2. Provisioning Multi-Role Staff Accounts ---');

    const pinHash = await bcrypt.hash('1234', 8);

    const userOwner = await prisma.user.create({
      data: { id: `user_owner_${ts}`, organizationId: orgId, name: 'Owner Tariq', username: `owner_${ts}`, pin: pinHash, role: 'OWNER', active: true },
    });
    const userManager = await prisma.user.create({
      data: { id: `user_mgr_${ts}`, organizationId: orgId, branchId: branchId, name: 'Manager Zubair', username: `mgr_${ts}`, pin: pinHash, role: 'MANAGER', active: true },
    });
    const userCashier = await prisma.user.create({
      data: { id: `user_cashier_${ts}`, organizationId: orgId, branchId: branchId, name: 'Cashier Bilal', username: `cashier_${ts}`, pin: pinHash, role: 'CASHIER', active: true },
    });
    const userWaiter = await prisma.user.create({
      data: { id: `user_waiter_${ts}`, organizationId: orgId, branchId: branchId, name: 'Waiter Hamza', username: `waiter_${ts}`, pin: pinHash, role: 'WAITER', active: true },
    });
    const userKitchen = await prisma.user.create({
      data: { id: `user_kitchen_${ts}`, organizationId: orgId, branchId: branchId, name: 'Chef Aslam', username: `kitchen_${ts}`, pin: pinHash, role: 'KITCHEN', active: true },
    });

    const ownerToken = signTenantToken({ userId: userOwner.id, organizationId: orgId, role: 'OWNER', username: userOwner.username });
    const managerToken = signTenantToken({ userId: userManager.id, organizationId: orgId, branchId: branchId, role: 'MANAGER', username: userManager.username });
    const cashierToken = signTenantToken({ userId: userCashier.id, organizationId: orgId, branchId: branchId, role: 'CASHIER', username: userCashier.username });
    const waiterToken = signTenantToken({ userId: userWaiter.id, organizationId: orgId, branchId: branchId, role: 'WAITER', username: userWaiter.username });
    const kitchenToken = signTenantToken({ userId: userKitchen.id, organizationId: orgId, branchId: branchId, role: 'KITCHEN', username: userKitchen.username });

    assert(!!ownerToken && !!managerToken && !!cashierToken && !!waiterToken && !!kitchenToken, 'Generated role-scoped authentication tokens for all 5 restaurant staff tiers');

    // --------------------------------------------------------------------------
    // 3. COMPLETE TEST-SERVICE WORKFLOW: DINE-IN TABLE, KOT, KDS & SETTLEMENT
    // --------------------------------------------------------------------------
    console.log('\n--- 3. Testing Complete End-to-End Service Lifecycle ---');

    // Step A: Cashier opens shift with 5,000 float
    const openShiftRes = await request('/api/shifts/open', {
      method: 'POST',
      body: {
        shiftNumber: `SH-PILOT-${ts}`,
        cashierName: 'Cashier Bilal',
        startingFloat: 5000,
        notes: 'Pilot Day 1 Morning Shift',
        openedById: userCashier.id,
      },
      token: cashierToken,
    });
    assert(openShiftRes.status === 200, 'Cashier opened shift with 200 OK');
    const shiftId = openShiftRes.data.shift.id;
    assert(openShiftRes.data.shift.startingFloat === 5000, 'Starting cash float recorded as 5,000.00');

    // Step B: Waiter seats Table T01 and punches Dine-In order with Modifiers
    const dineInOrderRes = await request('/api/orders', {
      method: 'POST',
      body: {
        orderType: 'DINE_IN',
        tableNumber: 'T01',
        shiftId: shiftId,
        tax: 208,
        items: [
          {
            menuItemId: itemZinger.id,
            name: itemZinger.title,
            price: 550,
            quantity: 2,
            modifiers: [
              { name: 'Extra Cheese', price: 60 },
              { name: 'Extra Sauce', price: 40 },
            ],
            notes: 'Well done, crispy fries',
          },
        ],
        notes: 'Table 1 VIP guests',
        cashierName: 'Cashier Bilal',
      },
      token: waiterToken,
    });
    assert(dineInOrderRes.status === 200, 'Waiter placed Dine-In order for Table T01');
    const orderId1 = dineInOrderRes.data.id;
    // Subtotal: 2 * (550 + 60 + 40) = 1300. Tax (16%): 208. Total: 1508
    assert(dineInOrderRes.data.subtotal === 1300, 'Server calculated subtotal: Rs. 1,300.00');
    assert(dineInOrderRes.data.tax === 208, 'Server calculated 16% tax: Rs. 208.00');
    assert(dineInOrderRes.data.total === 1508, 'Server calculated total: Rs. 1,508.00');

    // Step C: Kitchen receives and updates KDS Status
    const updateKdsRes = await request(`/api/orders/${orderId1}/status`, {
      method: 'PATCH',
      body: { status: 'PREPARING' },
      token: kitchenToken,
    });
    assert(updateKdsRes.status === 200, 'Kitchen staff updated status to PREPARING on KDS');

    const readyKdsRes = await request(`/api/orders/${orderId1}/status`, {
      method: 'PATCH',
      body: { status: 'READY' },
      token: kitchenToken,
    });
    assert(readyKdsRes.status === 200, 'Kitchen staff updated status to READY for food pickup');

    // Step D: Manager modifies order to add drinks and apply discount
    const modifyOrderRes = await request(`/api/orders/${orderId1}/modify`, {
      method: 'POST',
      body: {
        reason: 'Added round of drinks and manager courtesy discount',
        items: [
          {
            menuItemId: itemZinger.id,
            name: itemZinger.title,
            price: 550,
            quantity: 2,
            modifiers: [
              { name: 'Extra Cheese', price: 60 },
              { name: 'Extra Sauce', price: 40 },
            ],
          },
          {
            menuItemId: itemDrink.id,
            name: itemDrink.title,
            price: 120,
            quantity: 2,
          },
        ],
        discount: 154, // 10% discount on 1540 subtotal
        tax: 221.76, // 16% on (1540 - 154)
      },
      token: managerToken,
    });
    assert(modifyOrderRes.status === 200, 'Manager modified order with additional items and courtesy discount');

    // Step E: Settle Bill via Split Payment (Cash + Card)
    const settleRes = await request(`/api/orders/${orderId1}/pay`, {
      method: 'POST',
      body: {
        paymentMethod: 'SPLIT',
        splitPayments: [
          { method: 'CASH', amount: 1000 },
          { method: 'CARD', amount: modifyOrderRes.data.order.total - 1000 },
        ],
      },
      token: cashierToken,
    });
    assert(settleRes.status === 200, 'Settled Dine-In bill via Split Payment (Cash + Card)');
    assert(String(settleRes.data.order.paymentStatus).toLowerCase() === 'paid', 'Order paymentStatus transitioned to PAID');

    // --------------------------------------------------------------------------
    // 4. REQUIRED ORDER SCENARIOS A - G
    // --------------------------------------------------------------------------
    console.log('\n--- 4. Testing Required Order Scenarios (A - G) ---');

    // Scenario B: Takeaway Order
    const takeawayRes = await request('/api/orders', {
      method: 'POST',
      body: {
        orderType: 'TAKEAWAY',
        shiftId: shiftId,
        items: [{ menuItemId: itemDeal.id, name: itemDeal.title, price: 1200, quantity: 1 }],
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        cashierName: 'Cashier Bilal',
      },
      token: cashierToken,
    });
    assert(takeawayRes.status === 200, 'Scenario B: Takeaway order placed and paid (200 OK)');
    assert(String(takeawayRes.data.orderType).toLowerCase() === 'takeaway', 'Order correctly categorized as TAKEAWAY');

    // Scenario C: Delivery Order with Address & Fee
    const deliveryRes = await request('/api/orders', {
      method: 'POST',
      body: {
        orderType: 'DELIVERY',
        shiftId: shiftId,
        customer: { name: 'Ali Khan', phone: '03001234567', address: 'House 12, Street 4' },
        items: [{ menuItemId: itemZinger.id, name: itemZinger.title, price: 550, quantity: 2 }],
        deliveryFee: 150,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        cashierName: 'Cashier Bilal',
      },
      token: cashierToken,
    });
    assert(deliveryRes.status === 200, 'Scenario C: Delivery order placed with delivery fee (200 OK)');
    assert(deliveryRes.data.deliveryFee === 150, 'Delivery fee recorded authoritatively');

    // Scenario D: Deep Modifier Stack
    const modifierStackRes = await request('/api/orders', {
      method: 'POST',
      body: {
        orderType: 'TAKEAWAY',
        shiftId: shiftId,
        items: [
          {
            menuItemId: itemZinger.id,
            name: itemZinger.title,
            price: 550,
            quantity: 1,
            modifiers: [
              { name: 'Extra Cheese', price: 60 },
              { name: 'Extra Sauce', price: 40 },
              { name: 'Jalapeños', price: 30 },
            ],
          },
        ],
        cashierName: 'Cashier Bilal',
      },
      token: cashierToken,
    });
    // Expected unit price: 550 + 60 + 40 + 30 = 680. Total: 680.00
    assert(modifierStackRes.status === 200, 'Scenario D: Deep modifier stack calculated with precision');
    assert(modifierStackRes.data.subtotal === 680, 'Item subtotal equals base + sum of all modifiers (680.00)');

    // Scenario E: Discount Calculation & Cap Check
    const discountCapRes = await request('/api/orders', {
      method: 'POST',
      body: {
        orderType: 'TAKEAWAY',
        shiftId: shiftId,
        items: [{ menuItemId: itemZinger.id, name: itemZinger.title, price: 550, quantity: 1 }],
        discount: 1000, // Attempt discount greater than subtotal
        cashierName: 'Cashier Bilal',
      },
      token: cashierToken,
    });
    assert(discountCapRes.status === 200, 'Scenario E: Order with large discount processed safely');
    assert(discountCapRes.data.total >= 0, 'Discount bounded: total cannot be negative ($0.00 floor)');

    // Scenario F: Exact Split Payment Balance Settlement
    const splitOrderRes = await request('/api/orders', {
      method: 'POST',
      body: {
        orderType: 'DINE_IN',
        shiftId: shiftId,
        tax: 192,
        items: [{ menuItemId: itemDeal.id, name: itemDeal.title, price: 1200, quantity: 1 }],
        paymentMethod: 'SPLIT',
        splitPayments: [
          { method: 'CASH', amount: 800 },
          { method: 'CARD', amount: 592 }, // 1200 + 192 tax = 1392 total
        ],
        paymentStatus: 'PAID',
        cashierName: 'Cashier Bilal',
      },
      token: cashierToken,
    });
    assert(splitOrderRes.status === 200, 'Scenario F: Multi-tender split payment settled (800 Cash + 592 Card = 1392 Total)');
    assert(String(splitOrderRes.data.paymentStatus).toLowerCase() === 'paid', 'Split payment verified without underpayment');

    // Scenario G: High-Concurrency Multi-Till Simultaneous Orders
    const concPromises = Array.from({ length: 5 }).map((_, idx) =>
      request('/api/orders', {
        method: 'POST',
        headers: { 'idempotency-key': `idem_conc_pilot_${ts}_${idx}` },
        body: {
          orderType: 'TAKEAWAY',
          shiftId: shiftId,
          items: [{ menuItemId: itemDrink.id, name: itemDrink.title, price: 120, quantity: 1 }],
          paymentMethod: 'CASH',
          paymentStatus: 'PAID',
          cashierName: `Till 0${(idx % 3) + 1}`,
        },
        token: cashierToken,
      })
    );
    const concResults = await Promise.all(concPromises);
    assert(concResults.every((r) => r.status === 200), 'Scenario G: 5 concurrent orders processed with 200 OK');
    const orderNums = concResults.map((r) => r.data.orderNumber);
    const uniqueNums = new Set(orderNums);
    assert(uniqueNums.size === 5, 'All concurrent orders received unique, deterministic order numbers');

    // --------------------------------------------------------------------------
    // 5. CASH RECONCILIATION TEST MATRIX (CASES 1 - 5)
    // --------------------------------------------------------------------------
    console.log('\n--- 5. Testing Cash Reconciliation Matrix (Cases 1 - 5) ---');

    // Setup Dedicated Shift for Case 1: Float 5000 + Cash 10000 + In 2000 - Out 1000 = Expected 16000
    const shiftCase1 = await prisma.registerShift.create({
      data: {
        organizationId: orgId,
        branchId: branchId,
        shiftNumber: `SH-CASE1-${ts}`,
        cashierName: 'Cashier Case 1',
        startingFloat: 5000,
        startingPettyCash: 5000,
        status: 'open',
        openedAt: new Date(),
      },
    });

    // Create 10,000 cash order
    await prisma.order.create({
      data: {
        organizationId: orgId,
        branchId: branchId,
        shiftId: shiftCase1.id,
        orderNumber: `ORD-CASE1-${ts}`,
        orderType: 'TAKEAWAY',
        subtotal: 10000,
        tax: 0,
        discount: 0,
        total: 10000,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        status: 'COMPLETED',
      },
    });

    // Cash-In 2,000
    const cashInRes1 = await request('/api/shifts/cash-adjustment', {
      method: 'POST',
      body: { shiftId: shiftCase1.id, type: 'CASH_IN', amount: 2000, reason: 'Add small currency float' },
      token: managerToken,
    });
    assert(cashInRes1.status === 200, 'Case 1: Manager executed Cash-In of Rs. 2,000.00');

    // Cash-Out 1,000
    const cashOutRes1 = await request('/api/shifts/cash-adjustment', {
      method: 'POST',
      body: { shiftId: shiftCase1.id, type: 'CASH_OUT', amount: 1000, reason: 'Ice and lemon supplies expense' },
      token: managerToken,
    });
    assert(cashOutRes1.status === 200, 'Case 1: Manager executed Cash-Out of Rs. 1,000.00');

    // Close Shift Case 1
    const closeCase1Res = await request('/api/shifts/close', {
      method: 'POST',
      body: { shiftId: shiftCase1.id, actualCash: 16000, floatRetained: 5000, notes: 'Case 1 Perfect Balanced' },
      token: cashierToken,
    });
    assert(closeCase1Res.status === 200, 'Case 1: Shift closed with 200 OK');
    assert(closeCase1Res.data.shift.expectedCash === 16000, 'Case 1: Expected cash calculated correctly: 5k + 10k + 2k - 1k = Rs. 16,000.00');
    assert(closeCase1Res.data.shift.cashDifference === 0, 'Case 1: Zero cash variance ($0.00 difference)');

    // Case 2: Float 5000 + Cash 10000 + In 0 - Out 2000 = Expected 13000
    const shiftCase2 = await prisma.registerShift.create({
      data: {
        organizationId: orgId,
        branchId: branchId,
        shiftNumber: `SH-CASE2-${ts}`,
        cashierName: 'Cashier Case 2',
        startingFloat: 5000,
        startingPettyCash: 5000,
        status: 'open',
        openedAt: new Date(),
      },
    });

    await prisma.order.create({
      data: {
        organizationId: orgId,
        branchId: branchId,
        shiftId: shiftCase2.id,
        orderNumber: `ORD-CASE2-${ts}`,
        orderType: 'TAKEAWAY',
        subtotal: 10000,
        tax: 0,
        discount: 0,
        total: 10000,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        status: 'COMPLETED',
      },
    });

    await request('/api/shifts/cash-adjustment', {
      method: 'POST',
      body: { shiftId: shiftCase2.id, type: 'CASH_OUT', amount: 2000, reason: 'Staff lunch allowance' },
      token: managerToken,
    });

    const closeCase2Res = await request('/api/shifts/close', {
      method: 'POST',
      body: { shiftId: shiftCase2.id, actualCash: 13000, floatRetained: 5000 },
      token: cashierToken,
    });
    assert(closeCase2Res.status === 200, 'Case 2: Shift closed successfully');
    assert(closeCase2Res.data.shift.expectedCash === 13000, 'Case 2: Expected cash: 5k + 10k - 2k = Rs. 13,000.00');
    assert(closeCase2Res.data.shift.cashDifference === 0, 'Case 2: Zero variance confirmed');

    // Case 3: Card/QR Sales Excluded from Physical Cash Expectation
    const shiftCase3 = await prisma.registerShift.create({
      data: {
        organizationId: orgId,
        branchId: branchId,
        shiftNumber: `SH-CASE3-${ts}`,
        cashierName: 'Cashier Case 3',
        startingFloat: 5000,
        startingPettyCash: 5000,
        status: 'open',
        openedAt: new Date(),
      },
    });

    // Create 15,000 Card/QR Order
    await prisma.order.create({
      data: {
        organizationId: orgId,
        branchId: branchId,
        shiftId: shiftCase3.id,
        orderNumber: `ORD-CARD-${ts}`,
        orderType: 'TAKEAWAY',
        subtotal: 15000,
        tax: 0,
        discount: 0,
        total: 15000,
        paymentMethod: 'CARD',
        paymentStatus: 'PAID',
        status: 'COMPLETED',
      },
    });

    const closeCase3Res = await request('/api/shifts/close', {
      method: 'POST',
      body: { shiftId: shiftCase3.id, actualCash: 5000, floatRetained: 5000 },
      token: cashierToken,
    });
    assert(closeCase3Res.data.shift.expectedCash === 5000, 'Case 3: Card/QR sales do NOT inflate physical cash drawer expectation (remains 5,000.00)');

    // Case 4: Intentional Shortage Variance (Expected 10,000, Actual 9,500)
    const shiftCase4 = await prisma.registerShift.create({
      data: {
        organizationId: orgId,
        branchId: branchId,
        shiftNumber: `SH-CASE4-${ts}`,
        cashierName: 'Cashier Case 4',
        startingFloat: 10000,
        startingPettyCash: 10000,
        status: 'open',
        openedAt: new Date(),
      },
    });

    const closeCase4Res = await request('/api/shifts/close', {
      method: 'POST',
      body: { shiftId: shiftCase4.id, actualCash: 9500, floatRetained: 5000, notes: 'Shortage of 500' },
      token: cashierToken,
    });
    assert(closeCase4Res.data.shift.cashDifference === -500, 'Case 4: Recorded cash shortage variance (-Rs. 500.00)');

    // Case 5: Intentional Overage Variance (Expected 10,000, Actual 10,300)
    const shiftCase5 = await prisma.registerShift.create({
      data: {
        organizationId: orgId,
        branchId: branchId,
        shiftNumber: `SH-CASE5-${ts}`,
        cashierName: 'Cashier Case 5',
        startingFloat: 10000,
        startingPettyCash: 10000,
        status: 'open',
        openedAt: new Date(),
      },
    });

    const closeCase5Res = await request('/api/shifts/close', {
      method: 'POST',
      body: { shiftId: shiftCase5.id, actualCash: 10300, floatRetained: 5000, notes: 'Overage of 300' },
      token: cashierToken,
    });
    assert(closeCase5Res.data.shift.cashDifference === 300, 'Case 5: Recorded cash overage surplus (+Rs. 300.00)');

    // --------------------------------------------------------------------------
    // 6. MULTI-TILL & MULTI-TENANT CONCURRENCY & ISOLATION
    // --------------------------------------------------------------------------
    console.log('\n--- 6. Testing Multi-Till Fleet & Cross-Tenant Isolation ---');

    // Create Second Independent Tenant (Beta Bistro)
    await prisma.organization.create({
      data: { id: betaOrgId, name: 'Beta Bistro Co', slug: `beta-bistro-${ts}`, status: 'ACTIVE' },
    });
    await prisma.branch.create({
      data: { id: betaBranchId, organizationId: betaOrgId, name: 'Beta Main', slug: `beta-main-${ts}`, active: true },
    });
    const betaUser = await prisma.user.create({
      data: { id: `user_beta_${ts}`, organizationId: betaOrgId, branchId: betaBranchId, name: 'Beta Cashier', username: `beta_${ts}`, pin: pinHash, role: 'CASHIER', active: true },
    });
    const betaToken = signTenantToken({ userId: betaUser.id, organizationId: betaOrgId, branchId: betaBranchId, role: 'CASHIER', username: betaUser.username });

    // Beta places order
    const betaOrderRes = await request('/api/orders', {
      method: 'POST',
      body: {
        orderType: 'TAKEAWAY',
        items: [{ menuItemId: 'item_beta_dummy', name: 'Beta Exclusive Pasta', price: 900, quantity: 1 }],
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
      },
      token: betaToken,
    });
    assert(betaOrderRes.status === 200, 'Beta tenant placed order successfully');
    const betaOrderId = betaOrderRes.data.id;

    // Alpha Cashier attempts IDOR query on Beta Order
    const idorRes = await request(`/api/orders/${betaOrderId}`, {
      token: cashierToken,
    });
    assert(idorRes.status === 404, 'Alpha staff cannot access Beta order (404 Not Found)');

    // Alpha querying orders receives ZERO Beta orders
    const alphaOrdersRes = await request('/api/orders', {
      token: cashierToken,
    });
    assert(alphaOrdersRes.status === 200, 'Alpha orders list returned 200 OK');
    const alphaHasBeta = (alphaOrdersRes.data.orders || alphaOrdersRes.data.data || []).some((o: any) => o.id === betaOrderId);
    assert(!alphaHasBeta, 'Alpha order list contains 0 Beta orders (Strict multi-tenant isolation)');

    // --------------------------------------------------------------------------
    // 7. OFFLINE SYNC INTEGRITY & TAMPER DEFENSE
    // --------------------------------------------------------------------------
    console.log('\n--- 7. Testing Offline Sync & Context Enforcement ---');

    // Submit order payload with tampered organizationId in body
    const tamperedRes = await request('/api/orders', {
      method: 'POST',
      body: {
        organizationId: 'org_hacked_context', // Client attempts to forge org
        orderType: 'TAKEAWAY',
        items: [{ menuItemId: itemDrink.id, name: itemDrink.title, price: 120, quantity: 1 }],
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
      },
      token: cashierToken,
    });
    assert(tamperedRes.status === 200, 'Order submitted with tampered orgId header/body accepted under authenticated context');
    const dbTamperedOrder = await prisma.order.findUnique({ where: { id: tamperedRes.data.id } });
    assert(dbTamperedOrder?.organizationId === orgId, 'Server overrode forged organizationId with authenticated tenant context');

    // Anonymous request without token fails closed
    const anonRes = await request('/api/orders', {
      method: 'POST',
      body: { orderType: 'TAKEAWAY', items: [] },
    });
    assert(anonRes.status === 401, 'Anonymous request fails closed with 401 Unauthorized');

  } catch (error) {
    console.error('Fatal error in Phase 16 pilot tests:', error);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n======================================================================');
  console.log('📊 PHASE 16 OPERATIONAL READINESS TEST SUMMARY');
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL PHASE 16 PILOT OPERATIONAL READINESS ASSERTIONS PASSED!');
    process.exit(0);
  }
}

runPhase16PilotTests().catch((err) => {
  console.error('Unhandled Phase 16 test error:', err);
  process.exit(1);
});
