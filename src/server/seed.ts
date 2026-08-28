import prisma from './prisma';
import { INITIAL_CATEGORIES, INITIAL_MENU_ITEMS } from '../data/mockData';

export async function seedDatabaseIfNeeded() {
  try {
    // 1. Seed Default Users if none exist
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('[Seed] Seeding default users...');
      await prisma.user.createMany({
        data: [
          {
            name: 'Admin Manager',
            username: 'admin',
            pin: '1234',
            role: 'OWNER',
            active: true,
          },
          {
            name: 'Store Manager',
            username: 'manager',
            pin: '2222',
            role: 'MANAGER',
            active: true,
          },
          {
            name: 'Cashier One',
            username: 'cashier',
            pin: '3333',
            role: 'CASHIER',
            active: true,
          },
          {
            name: 'Carlos Rodriguez',
            username: 'rider_carlos',
            pin: '6666',
            role: 'RIDER',
            active: true,
          },
          {
            name: 'Samir Khan',
            username: 'rider_samir',
            pin: '7777',
            role: 'RIDER',
            active: true,
          },
          {
            name: 'Marcus Vance',
            username: 'rider_marcus',
            pin: '8888',
            role: 'RIDER',
            active: true,
          },
          {
            name: 'Ali Raza',
            username: 'server_ali',
            pin: '4444',
            role: 'SERVER',
            active: true,
          },
        ],
      });
    } else {
      // Ensure default riders exist if missing
      const riderCount = await prisma.user.count({ where: { role: 'RIDER' } });
      if (riderCount === 0) {
        await prisma.user.createMany({
          data: [
            {
              name: 'Carlos Rodriguez',
              username: 'rider_carlos',
              pin: '6666',
              role: 'RIDER',
              active: true,
            },
            {
              name: 'Samir Khan',
              username: 'rider_samir',
              pin: '7777',
              role: 'RIDER',
              active: true,
            },
            {
              name: 'Marcus Vance',
              username: 'rider_marcus',
              pin: '8888',
              role: 'RIDER',
              active: true,
            },
          ],
        });
      }
    }

    // Ensure default servers exist if missing
    const serverCount = await prisma.user.count({ where: { role: 'SERVER' } });
    if (serverCount === 0) {
      console.log('[Seed] Seeding default server user...');
      await prisma.user.create({
        data: {
          name: 'Ali Raza',
          username: 'server_ali',
          pin: '4444',
          role: 'SERVER',
          active: true,
        },
      });
    }

    // Seed default Tables if missing
    const tableCount = await prisma.table.count();
    if (tableCount === 0) {
      console.log('[Seed] Seeding default tables...');
      await prisma.table.createMany({
        data: [
          { number: 'Table 1', capacity: 2 },
          { number: 'Table 2', capacity: 4 },
          { number: 'Table 3', capacity: 4 },
          { number: 'Table 4', capacity: 6 },
          { number: 'Table 5', capacity: 8 },
        ],
      });
    }

    // 2. Seed Categories & Menu Items if none exist
    const categoryCount = await prisma.category.count();
    if (categoryCount === 0) {
      console.log('[Seed] Seeding categories & menu items...');
      const categoryMap = new Map<string, string>();

      for (const cat of INITIAL_CATEGORIES) {
        if (cat.id === 'all') continue;
        const createdCat = await prisma.category.create({
          data: {
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
    const outletCount = await prisma.outlet.count();
    if (outletCount === 0) {
      console.log('[Seed] Seeding default outlets...');
      await prisma.outlet.createMany({
        data: [
          { name: 'Gulberg Branch' },
          { name: 'DHA Phase 5' },
          { name: 'F-7 Islamabad' },
          { name: 'Mall of Lahore' },
        ],
      });
    }

    console.log('[Seed] Database seed check completed.');
  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
  }
}
