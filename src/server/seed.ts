import prisma from './prisma';
import { INITIAL_CATEGORIES, INITIAL_MENU_ITEMS } from '../data/mockData';

export const DEFAULT_ORG_ID = 'org_tillora_flagship';
export const DEFAULT_ORG_NAME = 'Tillora Flagship';
export const DEFAULT_ORG_SLUG = 'tillora-flagship';

export const DEFAULT_BRANCH_ID = 'branch_main_flagship';
export const DEFAULT_BRANCH_NAME = 'Main Branch';
export const DEFAULT_BRANCH_SLUG = 'main-branch';

export async function seedDatabaseIfNeeded() {
  try {
    // 0. Ensure Root Default Tenant Organization Exists
    let defaultOrg = await prisma.organization.findUnique({
      where: { slug: DEFAULT_ORG_SLUG },
    });

    if (!defaultOrg) {
      console.log('[Seed] Creating default tenant organization: Tillora Flagship...');
      defaultOrg = await prisma.organization.create({
        data: {
          id: DEFAULT_ORG_ID,
          name: DEFAULT_ORG_NAME,
          slug: DEFAULT_ORG_SLUG,
          status: 'ACTIVE',
          settings: JSON.stringify({
            currency: 'PKR',
            currencySymbol: 'Rs.',
            timezone: 'Asia/Karachi',
            brand: 'Tillora',
          }),
        },
      });
    }

    // Ensure Default Branch Exists under Default Organization
    let defaultBranch = await prisma.branch.findFirst({
      where: { organizationId: defaultOrg.id, slug: DEFAULT_BRANCH_SLUG },
    });

    if (!defaultBranch) {
      console.log('[Seed] Creating default branch: Main Branch...');
      defaultBranch = await prisma.branch.create({
        data: {
          id: DEFAULT_BRANCH_ID,
          organizationId: defaultOrg.id,
          name: DEFAULT_BRANCH_NAME,
          slug: DEFAULT_BRANCH_SLUG,
          address: 'Main Commercial Plaza, Lahore',
          phone: '+92 42 111 222 333',
          taxRate: 0.16,
          printerIp: '192.168.1.200',
          printerPort: 9100,
          active: true,
          settings: JSON.stringify({
            enableKds: true,
            receiptHeader: 'Tillora Flagship - Main Branch',
            receiptFooter: 'Thank you for dining with us!',
          }),
        },
      });
    }

    // Ensure Default Subscription Exists
    const subCount = await prisma.subscription.count({
      where: { organizationId: defaultOrg.id },
    });

    if (subCount === 0) {
      await prisma.subscription.create({
        data: {
          id: 'sub_tillora_flagship',
          organizationId: defaultOrg.id,
          plan: 'BUSINESS',
          status: 'ACTIVE',
          features: JSON.stringify([
            'pos',
            'orders',
            'inventory',
            'analytics',
            'kds',
            'delivery',
            'audit_logs',
            'offline_sync',
          ]),
        },
      });
    }

    // Ensure Default POS Device Exists
    const deviceCount = await prisma.device.count({
      where: { organizationId: defaultOrg.id },
    });

    if (deviceCount === 0) {
      await prisma.device.create({
        data: {
          id: 'dev_pos_counter_01',
          organizationId: defaultOrg.id,
          branchId: defaultBranch.id,
          deviceIdentifier: 'POS-COUNTER-01',
          name: 'Main Counter Register 1',
          deviceType: 'POS',
          status: 'ACTIVE',
          lastSeenAt: new Date(),
        },
      });
    }

    // Safe Backfill: Ensure all legacy single-tenant records belong to Default Organization & Branch
    await prisma.user.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id, branchId: defaultBranch.id },
    });

    await prisma.customer.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });

    await prisma.category.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });

    await prisma.menuItem.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });

    await prisma.order.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id, branchId: defaultBranch.id },
    });

    await prisma.registerShift.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id, branchId: defaultBranch.id },
    });

    await prisma.table.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id, branchId: defaultBranch.id },
    });

    await prisma.outlet.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });

    // 1. Seed Default Users with Deterministic IDs
    const defaultUsers = [
      {
        id: 'user-admin-1',
        organizationId: defaultOrg.id,
        branchId: defaultBranch.id,
        name: 'Admin Manager',
        username: 'admin',
        pin: '1234',
        role: 'OWNER',
        active: true,
      },
      {
        id: 'user-manager-1',
        organizationId: defaultOrg.id,
        branchId: defaultBranch.id,
        name: 'Store Manager',
        username: 'manager',
        pin: '2222',
        role: 'MANAGER',
        active: true,
      },
      {
        id: 'user-cashier-1',
        organizationId: defaultOrg.id,
        branchId: defaultBranch.id,
        name: 'Cashier One',
        username: 'cashier',
        pin: '3333',
        role: 'CASHIER',
        active: true,
      },
      {
        id: 'user-cashier-2',
        organizationId: defaultOrg.id,
        branchId: defaultBranch.id,
        name: 'Sana Malik',
        username: 'cashier2',
        pin: '4444',
        role: 'CASHIER',
        active: true,
      },
      {
        id: 'user-rider-1',
        organizationId: defaultOrg.id,
        branchId: defaultBranch.id,
        name: 'Carlos Rodriguez',
        username: 'rider_carlos',
        pin: '6666',
        role: 'RIDER',
        active: true,
      },
      {
        id: 'user-rider-2',
        organizationId: defaultOrg.id,
        branchId: defaultBranch.id,
        name: 'Samir Khan',
        username: 'rider_samir',
        pin: '7777',
        role: 'RIDER',
        active: true,
      },
      {
        id: 'user-rider-3',
        organizationId: defaultOrg.id,
        branchId: defaultBranch.id,
        name: 'Marcus Vance',
        username: 'rider_marcus',
        pin: '8888',
        role: 'RIDER',
        active: true,
      },
      {
        id: 'user-server-1',
        organizationId: defaultOrg.id,
        branchId: defaultBranch.id,
        name: 'Ali Raza',
        username: 'server_ali',
        pin: '4444',
        role: 'SERVER',
        active: true,
      },
    ];

    console.log('[Seed] Synchronizing default users...');
    for (const u of defaultUsers) {
      // Clean up any user that might have the same username but a different ID to avoid unique constraint violations
      await prisma.user.deleteMany({
        where: {
          username: u.username,
          id: { not: u.id },
          organizationId: u.organizationId
        }
      });

      await prisma.user.upsert({
        where: { id: u.id },
        update: {
          pin: u.pin,
          role: u.role,
          active: true,
          username: u.username,
          organizationId: u.organizationId,
          branchId: u.branchId,
        },
        create: u,
      });
    }

    // Ensure default servers exist if missing
    const serverCount = await prisma.user.count({ where: { organizationId: defaultOrg.id, role: 'SERVER' } });
    if (serverCount === 0) {
      console.log('[Seed] Seeding default server user...');
      await prisma.user.create({
        data: {
          organizationId: defaultOrg.id,
          branchId: defaultBranch.id,
          name: 'Ali Raza',
          username: 'server_ali',
          pin: '4444',
          role: 'SERVER',
          active: true,
        },
      });
    }

    // Seed default Tables if missing
    const tableCount = await prisma.table.count({ where: { organizationId: defaultOrg.id } });
    if (tableCount === 0) {
      console.log('[Seed] Seeding default tables...');
      await prisma.table.createMany({
        data: [
          { organizationId: defaultOrg.id, branchId: defaultBranch.id, number: 'Table 1', capacity: 2 },
          { organizationId: defaultOrg.id, branchId: defaultBranch.id, number: 'Table 2', capacity: 4 },
          { organizationId: defaultOrg.id, branchId: defaultBranch.id, number: 'Table 3', capacity: 4 },
          { organizationId: defaultOrg.id, branchId: defaultBranch.id, number: 'Table 4', capacity: 6 },
          { organizationId: defaultOrg.id, branchId: defaultBranch.id, number: 'Table 5', capacity: 8 },
        ],
      });
    }

    // 2. Seed Categories & Menu Items (Auto-migrates if old menu is detected)
    const hasNewMenu = await prisma.menuItem.findFirst({
      where: { organizationId: defaultOrg.id, title: 'BBQ Pizza (Small)' },
    });

    if (!hasNewMenu) {
      console.log('[Seed] Checking menu catalog for Tillora Flagship...');
    }

    const categoryCount = await prisma.category.count({ where: { organizationId: defaultOrg.id } });
    if (categoryCount === 0) {
      console.log('[Seed] Seeding categories & menu items...');
      const categoryMap = new Map<string, string>();

      for (const cat of INITIAL_CATEGORIES) {
        if (cat.id === 'all') continue;
        const createdCat = await prisma.category.create({
          data: {
            organizationId: defaultOrg.id,
            title: cat.name,
            slug: cat.id,
            active: true,
          },
        });
        categoryMap.set(cat.id, createdCat.id);
      }

      for (const item of INITIAL_MENU_ITEMS) {
        const categoryId = categoryMap.get(item.category);
        if (!categoryId) continue;

        await prisma.menuItem.create({
          data: {
            organizationId: defaultOrg.id,
            title: item.name,
            description: item.description || '',
            price: item.price,
            imageUrl: item.image || '',
            categoryId: categoryId,
            active: item.available !== false,
            preparationTime: item.preparationTimeMinutes || 10,
            flavors: JSON.stringify(item.flavors || []),
          },
        });
      }
    }

    // 3. Seed Default Outlets / Branches if none exist
    const branchCount = await prisma.branch.count({ where: { organizationId: defaultOrg.id } });
    if (branchCount <= 1) {
      console.log('[Seed] Seeding additional default branches for multi-branch demonstration...');
      const additionalBranches = [
        { name: 'Gulberg Branch', slug: 'gulberg-branch', address: 'Main Boulevard, Gulberg III, Lahore' },
        { name: 'DHA Phase 5', slug: 'dha-phase-5', address: 'Commercial Plaza, Phase 5, DHA, Lahore' },
        { name: 'F-7 Islamabad', slug: 'f7-islamabad', address: 'Jinnah Super Market, F-7, Islamabad' },
      ];

      for (const b of additionalBranches) {
        const existing = await prisma.branch.findFirst({
          where: { organizationId: defaultOrg.id, slug: b.slug },
        });
        if (!existing) {
          await prisma.branch.create({
            data: {
              organizationId: defaultOrg.id,
              name: b.name,
              slug: b.slug,
              address: b.address,
              phone: '+92 42 111 222 333',
              taxRate: 0.16,
              active: true,
            },
          });
        }
      }
    }

    console.log('[Seed] Database seed check and multi-tenant setup completed.');
  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
  }
}

