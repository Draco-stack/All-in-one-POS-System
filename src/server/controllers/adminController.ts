import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { resolveTenantContext, sendTenantNotFound } from '../tenantHelper';
import { revokeAllUserSessions } from '../auth/sessionService';
import { assertResourceLimit } from '../billing/billingSystem';

// ============================================================================
// 1. ADD USER
// Creates a real user record in the database scoped strictly to req.tenant
// with name, username, pin, and role (CASHIER, MANAGER, OWNER, etc.).
// ============================================================================
export async function addUser(req: Request, res: Response): Promise<Response> {
  try {
    const tenant = await resolveTenantContext(req);
    const { name, username, pin, role, phone, branchId } = req.body;

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

    // Check if username already exists in database FOR THIS TENANT
    const existingUser = await prisma.user.findFirst({
      where: {
        organizationId: tenant.organizationId,
        username: sanitizedUsername,
      },
    });

    if (existingUser) {
      return res.status(409).json({ error: `Username '${sanitizedUsername}' is already taken in this organization.` });
    }

    // Validate optional branchId belongs to tenant organization
    let resolvedBranchId = tenant.branchId || null;
    if (branchId) {
      const branchMatch = await prisma.branch.findFirst({
        where: { id: String(branchId), organizationId: tenant.organizationId },
      });
      if (branchMatch) {
        resolvedBranchId = branchMatch.id;
      }
    }

    const { restrictions } = req.body;
    const serializedRestrictions = typeof restrictions === 'string' ? restrictions : JSON.stringify(restrictions || []);

    // Securely hash PIN
    const hashedPin = pin.trim().startsWith('$2') ? pin.trim() : await bcrypt.hash(pin.trim(), 10);

    // Create real user record in database scoped to tenant organization under transaction
    const createdUser = await prisma.$transaction(async (tx) => {
      await assertResourceLimit(tx, tenant.organizationId, 'users');
      return await tx.user.create({
        data: {
          organizationId: tenant.organizationId,
          branchId: resolvedBranchId,
          name: name.trim(),
          username: sanitizedUsername,
          pin: hashedPin,
          role: roleUpper,
          phone: phone ? phone.trim() : null,
          active: true,
          restrictions: serializedRestrictions,
        },
        select: {
          id: true,
          organizationId: true,
          branchId: true,
          name: true,
          username: true,
          role: true,
          phone: true,
          active: true,
          restrictions: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully in database.',
      data: createdUser,
    });
  } catch (error: any) {
    console.error('[adminController.addUser] Error:', error);
    if (error.message && (error.message.includes('LIMIT_EXCEEDED') || error.message.includes('SUBSCRIPTION_RESTRICTED'))) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({
      error: 'Failed to create user record in database.',
      details: error.message || 'Internal database error.',
    });
  }
}

// ============================================================================
// 1.5 UPDATE USER
// Updates user details in database (name, role, phone, pin, active status, restrictions)
// strictly scoped to the tenant organization.
// ============================================================================
export async function updateUser(req: Request, res: Response): Promise<Response> {
  try {
    const tenant = await resolveTenantContext(req);
    const { id } = req.params;
    const { name, role, phone, pin, active, restrictions, branchId } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    const targetId = id.trim();

    // IDOR Hardening: Only find user belonging to this tenant organization
    const existingUser = await prisma.user.findFirst({
      where: {
        id: targetId,
        organizationId: tenant.organizationId,
      },
    });

    if (!existingUser) {
      return sendTenantNotFound(res, 'User', targetId);
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
      dataToUpdate.pin = pin.trim().startsWith('$2') ? pin.trim() : await bcrypt.hash(pin.trim(), 10);
    }

    if (active !== undefined) {
      dataToUpdate.active = Boolean(active);
    }

    if (branchId !== undefined) {
      if (branchId) {
        const branchMatch = await prisma.branch.findFirst({
          where: { id: String(branchId), organizationId: tenant.organizationId },
        });
        if (branchMatch) {
          dataToUpdate.branchId = branchMatch.id;
        }
      } else {
        dataToUpdate.branchId = null;
      }
    }

    if (restrictions !== undefined) {
      dataToUpdate.restrictions = typeof restrictions === 'string' ? restrictions : JSON.stringify(restrictions || []);
    }

    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: dataToUpdate,
      select: {
        id: true,
        organizationId: true,
        branchId: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        active: true,
        restrictions: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    if (pin !== undefined) {
      await revokeAllUserSessions(existingUser.id, tenant.organizationId);
    }

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
// Permanently deletes a user from the database strictly scoped to the tenant organization.
// Unlinks any relationships (historical orders, audit logs, register shifts, shift audits) first.
// ============================================================================
export async function deleteUser(req: Request, res: Response): Promise<Response> {
  try {
    const tenant = await resolveTenantContext(req);
    const { id } = req.params;

    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    const targetId = id.trim();

    // IDOR Hardening: Verify user exists and belongs to the requesting tenant organization
    const existingUser = await prisma.user.findFirst({
      where: {
        id: targetId,
        organizationId: tenant.organizationId,
      },
    });

    if (!existingUser) {
      return sendTenantNotFound(res, 'User', targetId);
    }

    // Unlink relationships and delete user in transaction
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
        where: { createdById: targetId, organizationId: tenant.organizationId },
        data: { createdById: null },
      }),
      prisma.order.updateMany({
        where: { modifiedById: targetId, organizationId: tenant.organizationId },
        data: { modifiedById: null },
      }),
      prisma.order.updateMany({
        where: { assignedRiderId: targetId, organizationId: tenant.organizationId },
        data: { assignedRiderId: null },
      }),
      prisma.orderAuditLog.updateMany({
        where: { performedById: targetId },
        data: { performedById: null },
      }),
      prisma.registerShift.updateMany({
        where: { openedById: targetId, organizationId: tenant.organizationId },
        data: { openedById: null },
      }),
      prisma.registerShift.updateMany({
        where: { closedById: targetId, organizationId: tenant.organizationId },
        data: { closedById: null },
      }),
      prisma.shiftAudit.updateMany({
        where: { userId: targetId },
        data: { userId: null },
      }),
      prisma.user.delete({
        where: { id: existingUser.id },
        select: {
          id: true,
          organizationId: true,
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
// category strictly scoped to the tenant organization.
// ============================================================================
export async function addMenuItem(req: Request, res: Response): Promise<Response> {
  try {
    const tenant = await resolveTenantContext(req);
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

    // Resolve or create category strictly within tenant organization
    if (!targetCategoryId && resolvedCatTitle) {
      const catSlug = String(resolvedCatTitle).toLowerCase().replace(/\s+/g, '-');
      let cat = await prisma.category.findFirst({
        where: {
          organizationId: tenant.organizationId,
          slug: catSlug,
        },
      });
      if (!cat) {
        cat = await prisma.category.create({
          data: {
            organizationId: tenant.organizationId,
            title: resolvedCatTitle,
            slug: catSlug,
            active: true,
          },
        });
      } else {
        cat = await prisma.category.update({
          where: { id: cat.id },
          data: { title: resolvedCatTitle },
        });
      }
      targetCategoryId = cat.id;
    } else if (targetCategoryId) {
      const categoryExists = await prisma.category.findFirst({
        where: {
          id: targetCategoryId,
          organizationId: tenant.organizationId,
        },
      });

      if (!categoryExists) {
        // Fallback: check if slug or title matches in same organization
        const catBySlug = await prisma.category.findFirst({
          where: {
            organizationId: tenant.organizationId,
            OR: [{ slug: targetCategoryId }, { title: targetCategoryId }],
          },
        });
        if (catBySlug) {
          targetCategoryId = catBySlug.id;
        } else {
          return res.status(404).json({ error: `Category with ID '${targetCategoryId}' does not exist in this organization.` });
        }
      }
    } else {
      // Default to first existing category in tenant or create one
      let defaultCat = await prisma.category.findFirst({
        where: { organizationId: tenant.organizationId },
      });
      if (!defaultCat) {
        defaultCat = await prisma.category.create({
          data: {
            organizationId: tenant.organizationId,
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

    // Create menu item record in database scoped to tenant organization under transaction
    const createdItem = await prisma.$transaction(async (tx) => {
      await assertResourceLimit(tx, tenant.organizationId, 'menuItems');
      return await tx.menuItem.create({
        data: {
          organizationId: tenant.organizationId,
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
    if (error.message && (error.message.includes('LIMIT_EXCEEDED') || error.message.includes('SUBSCRIPTION_RESTRICTED'))) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({
      error: 'Failed to create menu item record in database.',
      details: error.message || 'Internal database error.',
    });
  }
}

// ============================================================================
// 4. DELETE MENU ITEM (TENANT-ISOLATED PERMANENT DELETE)
// Dissociates foreign key from orderItem records while preserving sales numbers,
// and deletes the menu item strictly scoped to tenant organization.
// ============================================================================
export async function deleteMenuItem(req: Request, res: Response): Promise<Response> {
  const paramId = req.params.id || req.params.itemId;

  try {
    const tenant = await resolveTenantContext(req);

    if (!paramId || typeof paramId !== 'string' || !paramId.trim()) {
      return res.status(400).json({ error: 'Menu item ID parameter is required.' });
    }

    const targetId = paramId.trim();

    // 1. Verify item exists strictly in this tenant organization
    let existingItem = await prisma.menuItem.findFirst({
      where: {
        id: targetId,
        organizationId: tenant.organizationId,
      },
    });

    if (!existingItem) {
      existingItem = await prisma.menuItem.findFirst({
        where: {
          organizationId: tenant.organizationId,
          OR: [
            { title: { equals: targetId, mode: 'insensitive' } },
            { id: { contains: targetId } },
          ],
        },
      });
    }

    if (!existingItem) {
      return sendTenantNotFound(res, 'MenuItem', targetId);
    }

    const realId = existingItem.id;

    // 2. Safe dissociation: nullify menuItemId on past order records
    await prisma.orderItem.updateMany({
      where: { menuItemId: realId },
      data: { menuItemId: null },
    });

    // 3. Permanently hard-delete item from PostgreSQL
    const deletedItem = await prisma.menuItem.delete({
      where: { id: realId },
      select: {
        id: true,
        organizationId: true,
        title: true,
        price: true,
      },
    });

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
    console.error('PRISMA DELETE ERROR:', error);
    return res.status(500).json({
      error: 'Failed to delete menu item from database.',
      details: error.message || 'Internal database error.',
    });
  }
}

// ============================================================================
// 5. UPDATE MENU ITEM
// Updates an existing menu item in the database strictly scoped to tenant organization.
// ============================================================================
export async function updateMenuItem(req: Request, res: Response): Promise<Response> {
  try {
    const tenant = await resolveTenantContext(req);
    const { id } = req.params;
    const { title, name, description, price, imageUrl, image, categoryId, categoryTitle, category, active, available, flavors, options, preparationTime } = req.body;

    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({ error: 'Menu item ID is required.' });
    }

    const targetId = id.trim();

    let existingItem = await prisma.menuItem.findFirst({
      where: {
        id: targetId,
        organizationId: tenant.organizationId,
      },
    });

    if (!existingItem) {
      existingItem = await prisma.menuItem.findFirst({
        where: {
          organizationId: tenant.organizationId,
          OR: [
            { title: { equals: targetId, mode: 'insensitive' } },
            { title: { equals: title || name, mode: 'insensitive' } },
          ],
        },
      });
    }

    if (!existingItem) {
      return sendTenantNotFound(res, 'MenuItem', targetId);
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
      const catMatch = await prisma.category.findFirst({
        where: { id: String(categoryId).trim(), organizationId: tenant.organizationId },
      });
      if (catMatch) {
        dataToUpdate.categoryId = catMatch.id;
      }
    } else if (targetCatTitle) {
      const catSlug = String(targetCatTitle).toLowerCase().replace(/\s+/g, '-');
      let cat = await prisma.category.findFirst({
        where: { slug: catSlug, organizationId: tenant.organizationId },
      });
      if (!cat) {
        cat = await prisma.category.create({
          data: {
            organizationId: tenant.organizationId,
            title: targetCatTitle,
            slug: catSlug,
            active: true,
          },
        });
      } else {
        cat = await prisma.category.update({
          where: { id: cat.id },
          data: { title: targetCatTitle },
        });
      }
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

