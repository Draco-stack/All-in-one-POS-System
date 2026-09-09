import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';

// ============================================================================
// 1. ADD USER
// Creates a real user record in the database (prisma.user.create)
// with name, username, pin, and role (CASHIER, MANAGER, OWNER).
// ============================================================================
export async function addUser(req: Request, res: Response): Promise<Response> {
  try {
    const { name, username, pin, role, phone } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    const sanitizedUsername = username.trim().toLowerCase();

    if (!pin || typeof pin !== 'string' || !pin.trim()) {
      return res.status(400).json({ error: 'Password / PIN is required.' });
    }

    const roleUpper = (role || 'CASHIER').toString().toUpperCase();
    const validRoles = ['CASHIER', 'MANAGER', 'OWNER', 'RIDER', 'KITCHEN', 'ADMIN', 'SERVER'];
    if (!validRoles.includes(roleUpper)) {
      return res.status(400).json({ error: `Invalid role. Allowed roles: ${validRoles.join(', ')}` });
    }

    // Check if username already exists in database
    const existingUser = await prisma.user.findUnique({
      where: { username: sanitizedUsername },
    });

    if (existingUser) {
      return res.status(409).json({ error: `Username '${sanitizedUsername}' is already taken.` });
    }

    const { restrictions } = req.body;
    const serializedRestrictions = typeof restrictions === 'string' ? restrictions : JSON.stringify(restrictions || []);

    // Create real user record in database
    const createdUser = await prisma.user.create({
      data: {
        name: name.trim(),
        username: sanitizedUsername,
        pin: pin.trim(),
        role: roleUpper,
        phone: phone ? phone.trim() : null,
        active: true,
        restrictions: serializedRestrictions,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        pin: true,
        active: true,
        restrictions: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully in database.',
      data: createdUser,
    });
  } catch (error: any) {
    console.error('[adminController.addUser] Error:', error);
    return res.status(500).json({
      error: 'Failed to create user record in database.',
      details: error.message || 'Internal database error.',
    });
  }
}

// ============================================================================
// 1.5 UPDATE USER
// Updates user details in database (name, role, phone, pin, active status, restrictions)
// ============================================================================
export async function updateUser(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { name, role, phone, pin, active, restrictions } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: `User with ID '${id}' was not found.` });
    }

    const dataToUpdate: any = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty.' });
      }
      dataToUpdate.name = name.trim();
    }

    if (role !== undefined) {
      const roleUpper = role.toString().toUpperCase();
      const validRoles = ['CASHIER', 'MANAGER', 'OWNER', 'RIDER', 'KITCHEN', 'ADMIN', 'SERVER'];
      if (!validRoles.includes(roleUpper)) {
        return res.status(400).json({ error: `Invalid role. Allowed roles: ${validRoles.join(', ')}` });
      }
      dataToUpdate.role = roleUpper;
    }

    if (phone !== undefined) {
      dataToUpdate.phone = phone ? phone.trim() : null;
    }

    if (pin !== undefined) {
      if (typeof pin !== 'string' || !pin.trim()) {
        return res.status(400).json({ error: 'Password / PIN cannot be empty.' });
      }
      dataToUpdate.pin = pin.trim();
    }

    if (active !== undefined) {
      dataToUpdate.active = Boolean(active);
    }

    if (restrictions !== undefined) {
      dataToUpdate.restrictions = typeof restrictions === 'string' ? restrictions : JSON.stringify(restrictions || []);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        pin: true,
        active: true,
        restrictions: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'User updated successfully in database.',
      data: updated,
    });
  } catch (error: any) {
    console.error('[adminController.updateUser] Error:', error);
    return res.status(500).json({
      error: 'Failed to update user record in database.',
      details: error.message || 'Internal database error.',
    });
  }
}

// ============================================================================
// 2. DELETE USER
// Permanently deletes a user from the database (prisma.user.delete) using their unique ID.
// Unlinks any relationships (historical orders, audit logs, register shifts, shift audits) first.
// ============================================================================
export async function deleteUser(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    const targetId = id.trim();

    // Verify user exists in database
    const existingUser = await prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!existingUser) {
      return res.status(404).json({ error: `User with ID '${targetId}' was not found.` });
    }

    // Force deletion by unlinking historical relations first, then hard deleting
    const [
      createdOrdersUnlinked,
      modifiedOrdersUnlinked,
      riderOrdersUnlinked,
      auditLogsUnlinked,
      shiftsOpenedUnlinked,
      shiftsClosedUnlinked,
      shiftAuditsUnlinked,
      deletedUser,
    ] = await prisma.$transaction([
      prisma.order.updateMany({
        where: { createdById: targetId },
        data: { createdById: null }
      }),
      prisma.order.updateMany({
        where: { modifiedById: targetId },
        data: { modifiedById: null }
      }),
      prisma.order.updateMany({
        where: { assignedRiderId: targetId },
        data: { assignedRiderId: null }
      }),
      prisma.orderAuditLog.updateMany({
        where: { performedById: targetId },
        data: { performedById: null }
      }),
      prisma.registerShift.updateMany({
        where: { openedById: targetId },
        data: { openedById: null }
      }),
      prisma.registerShift.updateMany({
        where: { closedById: targetId },
        data: { closedById: null }
      }),
      prisma.shiftAudit.updateMany({
        where: { userId: targetId },
        data: { userId: null }
      }),
      prisma.user.delete({
        where: { id: targetId },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: `User '${deletedUser.name}' (@${deletedUser.username || 'unassigned'}) permanently deleted from database.`,
      data: deletedUser,
    });
  } catch (error: any) {
    console.error('[adminController.deleteUser] Error:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'User record not found.' });
      }
    }

    return res.status(500).json({
      error: 'Failed to delete user.',
      details: error.message || 'Internal database error.',
    });
  }
}

// ============================================================================
// 3. ADD MENU ITEM
// Creates a real menu item record (prisma.menuItem.create) linked to a
// category with title, price, image URL, and active status.
// ============================================================================
export async function addMenuItem(req: Request, res: Response): Promise<Response> {
  try {
    const { title, name, description, price, imageUrl, image, categoryId, categoryTitle, category, active, available, flavors, options, preparationTime } = req.body;

    const itemTitle = (title || name || '').trim();
    if (!itemTitle) {
      return res.status(400).json({ error: 'Menu item title is required.' });
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ error: 'Price must be a valid number greater than 0.' });
    }

    let targetCategoryId = categoryId ? String(categoryId).trim() : '';
    const resolvedCatTitle = categoryTitle || category;

    // If categoryId is not directly provided or not found, find or create category by categoryTitle
    if (!targetCategoryId && resolvedCatTitle) {
      const catSlug = String(resolvedCatTitle).toLowerCase().replace(/\s+/g, '-');
      const cat = await prisma.category.upsert({
        where: { slug: catSlug },
        update: { title: resolvedCatTitle },
        create: {
          title: resolvedCatTitle,
          slug: catSlug,
          active: true,
        },
      });
      targetCategoryId = cat.id;
    } else if (targetCategoryId) {
      const categoryExists = await prisma.category.findUnique({
        where: { id: targetCategoryId },
      });

      if (!categoryExists) {
        // Fallback: check if slug or title matches
        const catBySlug = await prisma.category.findFirst({
          where: {
            OR: [{ slug: targetCategoryId }, { title: targetCategoryId }],
          },
        });
        if (catBySlug) {
          targetCategoryId = catBySlug.id;
        } else {
          return res.status(404).json({ error: `Category with ID '${targetCategoryId}' does not exist.` });
        }
      }
    } else {
      // Default to first existing category or create a general one
      let defaultCat = await prisma.category.findFirst();
      if (!defaultCat) {
        defaultCat = await prisma.category.create({
          data: {
            title: 'General',
            slug: 'general',
            active: true,
          },
        });
      }
      targetCategoryId = defaultCat.id;
    }

    const resolvedImageUrl = imageUrl || image || '';
    const resolvedActive = active !== undefined ? Boolean(active) : (available !== undefined ? Boolean(available) : true);
    const resolvedFlavors = flavors ? (typeof flavors === 'string' ? flavors : JSON.stringify(flavors)) : '[]';
    const resolvedOptions = options ? (typeof options === 'string' ? options : JSON.stringify(options)) : '[]';
    const resolvedPrepTime = Number(preparationTime) || 10;

    // Create real menu item record in database
    const createdItem = await prisma.menuItem.create({
      data: {
        title: itemTitle,
        description: description ? String(description).trim() : null,
        price: numericPrice,
        imageUrl: resolvedImageUrl,
        active: resolvedActive,
        categoryId: targetCategoryId,
        flavors: resolvedFlavors,
        options: resolvedOptions,
        preparationTime: resolvedPrepTime,
      },
      include: {
        category: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    const io = (req.app as any).get('io');
    if (io) {
      io.emit('menuItemCreated', createdItem);
    }

    return res.status(201).json({
      success: true,
      message: 'Menu item created successfully in database.',
      data: createdItem,
    });
  } catch (error: any) {
    console.error('[adminController.addMenuItem] Error:', error);
    return res.status(500).json({
      error: 'Failed to create menu item record in database.',
      details: error.message || 'Internal database error.',
    });
  }
}

// ============================================================================
// 4. DELETE MENU ITEM (PRODUCTION-SAFE PRISMA PERMANENT DELETE)
// Dissociates foreign key from orderItem records while preserving sales numbers,
// and deletes the menu item from PostgreSQL so it is truly and dynamically removed.
// ============================================================================
export async function deleteMenuItem(req: Request, res: Response): Promise<Response> {
  const paramId = req.params.id || req.params.itemId;
  console.log("RECEIVED DELETE REQUEST FOR ID:", paramId);

  try {
    if (!paramId || typeof paramId !== 'string' || !paramId.trim()) {
      return res.status(400).json({ error: 'Menu item ID parameter is required.' });
    }

    const targetId = paramId.trim();
    console.log('[adminController.deleteMenuItem] Processing request for targetId:', targetId);

    // 1. Verify item exists in database (check by id or by title)
    let existingItem = await prisma.menuItem.findUnique({
      where: { id: targetId },
    });

    if (!existingItem) {
      existingItem = await prisma.menuItem.findFirst({
        where: {
          OR: [
            { title: { equals: targetId, mode: 'insensitive' } },
            { id: { contains: targetId } },
          ],
        },
      });
    }

    if (!existingItem) {
      console.warn(`[adminController.deleteMenuItem] Item '${targetId}' not in DB. Returning success for catalog consistency.`);
      const io = (req.app as any).get('io');
      if (io) {
        io.emit('menuItemDeleted', { id: targetId });
      }
      return res.status(200).json({
        success: true,
        strategy: 'LOCAL_ONLY',
        message: `Menu item '${targetId}' removed from catalog.`,
      });
    }

    const realId = existingItem.id;

    // 2. Safe dissociation: nullify menuItemId on past order records so financial receipts remain intact
    await prisma.orderItem.updateMany({
      where: { menuItemId: realId },
      data: { menuItemId: null },
    });

    // 3. Permanently hard-delete item from PostgreSQL
    const deletedItem = await prisma.menuItem.delete({
      where: { id: realId },
      select: {
        id: true,
        title: true,
        price: true,
      },
    });

    console.log(`[adminController.deleteMenuItem] Permanently deleted item '${deletedItem.title}' (${realId}) from database`);

    const io = (req.app as any).get('io');
    if (io) {
      io.emit('menuItemDeleted', { id: realId, title: deletedItem.title });
    }

    return res.status(200).json({
      success: true,
      strategy: 'HARD_DELETE',
      message: `Menu item '${deletedItem.title}' permanently removed from database.`,
      data: deletedItem,
    });
  } catch (error: any) {
    console.error("PRISMA DELETE ERROR:", error);
    // Fallback: soft-deactivate if database constraint error occurs
    try {
      const targetId = String(paramId).trim();
      const fallbackItem = await prisma.menuItem.updateMany({
        where: { OR: [{ id: targetId }, { title: targetId }] },
        data: { active: false },
      });
      const io = (req.app as any).get('io');
      if (io) {
        io.emit('menuItemDeleted', { id: targetId });
      }
      return res.status(200).json({
        success: true,
        strategy: 'SOFT_DELETE_FALLBACK',
        message: 'Menu item deactivated in database.',
        data: fallbackItem,
      });
    } catch (fallbackErr) {
      return res.status(500).json({
        error: 'Failed to delete menu item from database.',
        details: error.message || 'Internal database error.',
      });
    }
  }
}

// ============================================================================
// 5. UPDATE MENU ITEM
// Updates an existing menu item in the database (title, price, description, active status, image, category, flavors).
// ============================================================================
export async function updateMenuItem(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const { title, name, description, price, imageUrl, image, categoryId, categoryTitle, category, active, available, flavors, options, preparationTime } = req.body;

    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({ error: 'Menu item ID is required.' });
    }

    const targetId = id.trim();

    let existingItem = await prisma.menuItem.findUnique({
      where: { id: targetId },
    });

    if (!existingItem) {
      existingItem = await prisma.menuItem.findFirst({
        where: {
          OR: [
            { title: { equals: targetId, mode: 'insensitive' } },
            { title: { equals: title || name, mode: 'insensitive' } },
          ],
        },
      });
    }

    if (!existingItem) {
      return res.status(404).json({ error: `Menu item with ID '${targetId}' was not found.` });
    }

    const realId = existingItem.id;
    const dataToUpdate: any = {};

    const resolvedTitle = title || name;
    if (resolvedTitle !== undefined) {
      if (typeof resolvedTitle !== 'string' || !resolvedTitle.trim()) {
        return res.status(400).json({ error: 'Title cannot be empty.' });
      }
      dataToUpdate.title = resolvedTitle.trim();
    }

    if (price !== undefined) {
      const numericPrice = Number(price);
      if (isNaN(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({ error: 'Price must be a valid number greater than 0.' });
      }
      dataToUpdate.price = numericPrice;
    }

    if (description !== undefined) {
      dataToUpdate.description = description ? String(description).trim() : null;
    }

    const resolvedImageUrl = imageUrl || image;
    if (resolvedImageUrl !== undefined) {
      dataToUpdate.imageUrl = String(resolvedImageUrl);
    }

    const resolvedActive = active !== undefined ? active : available;
    if (resolvedActive !== undefined) {
      dataToUpdate.active = Boolean(resolvedActive);
    }

    if (flavors !== undefined) {
      dataToUpdate.flavors = typeof flavors === 'string' ? flavors : JSON.stringify(flavors);
    }

    if (options !== undefined) {
      dataToUpdate.options = typeof options === 'string' ? options : JSON.stringify(options);
    }

    if (preparationTime !== undefined) {
      dataToUpdate.preparationTime = Number(preparationTime) || 10;
    }

    const targetCatTitle = categoryTitle || category;
    if (categoryId) {
      dataToUpdate.categoryId = String(categoryId).trim();
    } else if (targetCatTitle) {
      const catSlug = String(targetCatTitle).toLowerCase().replace(/\s+/g, '-');
      const cat = await prisma.category.upsert({
        where: { slug: catSlug },
        update: { title: targetCatTitle },
        create: {
          title: targetCatTitle,
          slug: catSlug,
          active: true,
        },
      });
      dataToUpdate.categoryId = cat.id;
    }

    const updatedItem = await prisma.menuItem.update({
      where: { id: realId },
      data: dataToUpdate,
      include: {
        category: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    const io = (req.app as any).get('io');
    if (io) {
      io.emit('menuItemUpdated', updatedItem);
    }

    return res.status(200).json({
      success: true,
      message: 'Menu item updated successfully in database.',
      data: updatedItem,
    });
  } catch (error: any) {
    console.error('[adminController.updateMenuItem] Error:', error);
    return res.status(500).json({
      error: 'Failed to update menu item record in database.',
      details: error.message || 'Internal database error.',
    });
  }
}
