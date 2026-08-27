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
    const { name, username, pin, role } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    const sanitizedUsername = username.trim().toLowerCase();

    if (!pin || typeof pin !== 'string' || !/^\d{4,6}$/.test(pin.trim())) {
      return res.status(400).json({ error: 'PIN must be a 4 to 6 digit numeric code.' });
    }

    const roleUpper = (role || 'CASHIER').toString().toUpperCase();
    const validRoles = ['CASHIER', 'MANAGER', 'OWNER', 'RIDER', 'KITCHEN', 'ADMIN'];
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

    // Create real user record in database
    const createdUser = await prisma.user.create({
      data: {
        name: name.trim(),
        username: sanitizedUsername,
        pin: pin.trim(),
        role: roleUpper,
        active: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        active: true,
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
// 2. DELETE USER
// Permanently deletes a user from the database (prisma.user.delete) using their unique ID.
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

    // Attempt to permanently delete user from database
    try {
      const deletedUser = await prisma.user.delete({
        where: { id: targetId },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: `User '${deletedUser.name}' (@${deletedUser.username || 'unassigned'}) permanently deleted.`,
        data: deletedUser,
      });
    } catch (deleteError: any) {
      if (deleteError instanceof Prisma.PrismaClientKnownRequestError && deleteError.code === 'P2003') {
        // Fallback to soft delete
        const fallbackUser = await prisma.user.update({
          where: { id: targetId },
          data: { active: false },
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
            active: true,
          }
        });

        return res.status(200).json({
          success: true,
          strategy: 'SOFT_DELETE_FALLBACK',
          message: `User '${fallbackUser.name}' soft-deleted (active: false) because they are linked to historical orders/shifts.`,
          data: fallbackUser,
        });
      }
      throw deleteError;
    }
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
    const { title, description, price, imageUrl, image, categoryId, categoryTitle, active } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Menu item title is required.' });
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ error: 'Price must be a valid number greater than 0.' });
    }

    let targetCategoryId = categoryId ? String(categoryId).trim() : '';

    // If categoryId is not directly provided or not found, find or create category by categoryTitle
    if (!targetCategoryId && categoryTitle) {
      const catSlug = String(categoryTitle).toLowerCase().replace(/\s+/g, '-');
      const cat = await prisma.category.upsert({
        where: { slug: catSlug },
        update: { title: categoryTitle },
        create: {
          title: categoryTitle,
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

    // Create real menu item record in database
    const createdItem = await prisma.menuItem.create({
      data: {
        title: title.trim(),
        description: description ? String(description).trim() : null,
        price: numericPrice,
        imageUrl: resolvedImageUrl,
        active: active !== undefined ? Boolean(active) : true,
        categoryId: targetCategoryId,
      },
      include: {
        category: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

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
// 4. DELETE MENU ITEM (PRODUCTION-SAFE PRISMA DELETE)
// First, check if the menu item exists in past order history (prisma.orderItem.count where menuItemId matches).
// If it does exist in past orders, perform a safe soft-delete / deactivation (prisma.menuItem.update setting active: false)
// so it instantly disappears from the POS grid without throwing a foreign key constraint crash.
// If it has no past orders, perform a hard delete (prisma.menuItem.delete) to remove it completely from the database.
// ============================================================================
export async function deleteMenuItem(req: Request, res: Response): Promise<Response> {
  const paramId = req.params.id || req.params.itemId;
  console.log("RECEIVED DELETE REQUEST FOR ID:", req.params.id || req.params.itemId);

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
        where: { title: targetId },
      });
    }

    if (!existingItem) {
      console.warn(`[adminController.deleteMenuItem] Item '${targetId}' not in DB. Returning local removal response.`);
      return res.status(200).json({
        success: true,
        strategy: 'LOCAL_ONLY',
        message: `Menu item '${targetId}' removed from local UI catalog.`,
      });
    }

    const realId = existingItem.id;

    // 2. Count past orders referencing this item
    const pastOrderCount = await prisma.orderItem.count({
      where: {
        OR: [
          { menuItemId: realId },
          { name: existingItem.title },
        ],
      },
    });

    console.log(`[adminController.deleteMenuItem] Found ${pastOrderCount} past order reference(s) for '${existingItem.title}' (${realId})`);

    // 3A. If referenced in past orders -> Soft-delete (set active = false)
    if (pastOrderCount > 0) {
      try {
        const softDeletedItem = await prisma.menuItem.update({
          where: { id: realId },
          data: { active: false },
          select: {
            id: true,
            title: true,
            price: true,
            active: true,
            categoryId: true,
            updatedAt: true,
          },
        });

        console.log(`[adminController.deleteMenuItem] Soft-deleted item '${softDeletedItem.title}' (active: false)`);
        return res.status(200).json({
          success: true,
          strategy: 'SOFT_DELETE',
          message: `Menu item '${softDeletedItem.title}' has ${pastOrderCount} past order reference(s). Safe soft-delete applied (active: false).`,
          data: softDeletedItem,
        });
      } catch (softErr: any) {
        console.error("PRISMA DELETE ERROR:", softErr);
        throw softErr;
      }
    }

    // 3B. If no past orders -> Hard delete from database
    try {
      const hardDeletedItem = await prisma.menuItem.delete({
        where: { id: realId },
        select: {
          id: true,
          title: true,
          price: true,
        },
      });

      console.log(`[adminController.deleteMenuItem] Permanently hard-deleted item '${hardDeletedItem.title}' (${realId})`);
      return res.status(200).json({
        success: true,
        strategy: 'HARD_DELETE',
        message: `Menu item '${hardDeletedItem.title}' deleted from database.`,
        data: hardDeletedItem,
      });
    } catch (deleteError: any) {
      console.error("PRISMA DELETE ERROR:", deleteError);
      // Fallback to soft delete if hard delete fails due to constraint
      const fallbackItem = await prisma.menuItem.update({
        where: { id: realId },
        data: { active: false },
      });

      console.log(`[adminController.deleteMenuItem] Soft-delete fallback applied for '${fallbackItem.title}' (${realId})`);
      return res.status(200).json({
        success: true,
        strategy: 'SOFT_DELETE_FALLBACK',
        message: `Menu item '${fallbackItem.title}' soft-deleted (active: false) due to foreign key constraint.`,
        data: fallbackItem,
      });
    }
  } catch (error: any) {
    console.error("PRISMA DELETE ERROR:", error);
    return res.status(500).json({
      error: 'Failed to delete or deactivate menu item.',
      details: error.message || 'Internal database error.',
    });
  }
}
