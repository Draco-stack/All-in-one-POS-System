import { Request, Response } from 'express';
import prisma from '../prisma';
import { logAuditEvent, AUDIT_ACTIONS } from '../auth/auditService';
import { assertResourceLimit } from '../billing/billingSystem';
import { sendTenantNotFound } from '../tenantHelper';

/**
 * PHASE 20: Production Restaurant Configuration & Advanced Menu Management Controller
 */

// ============================================================================
// 1. CATEGORY MANAGEMENT
// ============================================================================

export async function getCategories(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const { branchId, activeOnly } = req.query;

    const whereClause: any = {
      organizationId,
    };

    if (activeOnly === 'true') {
      whereClause.active = true;
    }

    if (branchId) {
      whereClause.OR = [
        { branchId: String(branchId) },
        { branchId: null },
      ];
    }

    const categories = await prisma.category.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return res.json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    console.error('[menuController.getCategories] Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve categories.' });
  }
}

export async function createCategory(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.user?.id;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const { title, description, icon, displayOrder, posVisible, kitchenRelevance, branchId } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Category title is required.' });
    }

    const sanitizedTitle = title.trim();
    const slug = sanitizedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check slug uniqueness within organization
    const existing = await prisma.category.findFirst({
      where: { organizationId, slug },
    });
    if (existing) {
      return res.status(409).json({ error: `Category '${sanitizedTitle}' already exists in this organization.` });
    }

    // Verify branch if provided
    let resolvedBranchId: string | null = null;
    if (branchId) {
      const branchMatch = await prisma.branch.findFirst({
        where: { id: String(branchId), organizationId },
      });
      if (branchMatch) resolvedBranchId = branchMatch.id;
    }

    const category = await prisma.category.create({
      data: {
        organizationId,
        branchId: resolvedBranchId,
        title: sanitizedTitle,
        slug,
        description: description ? String(description).trim() : null,
        icon: icon ? String(icon).trim() : null,
        displayOrder: Number(displayOrder) || 0,
        active: true,
        posVisible: posVisible !== undefined ? Boolean(posVisible) : true,
        kitchenRelevance: kitchenRelevance !== undefined ? Boolean(kitchenRelevance) : true,
      },
    });

    await logAuditEvent({
      organizationId,
      branchId: resolvedBranchId,
      userId,
      action: AUDIT_ACTIONS.CATEGORY_CREATED,
      entity: 'CATEGORY',
      entityId: category.id,
      metadata: { title: category.title, slug: category.slug },
    });

    const io = (req.app as any).get('io');
    if (io) io.to(`org_${organizationId}`).emit('categoryCreated', category);

    return res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      data: category,
    });
  } catch (error: any) {
    console.error('[menuController.createCategory] Error:', error);
    return res.status(500).json({ error: 'Failed to create category.' });
  }
}

export async function updateCategory(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const existingCategory = await prisma.category.findFirst({
      where: { id, organizationId },
    });
    if (!existingCategory) {
      return sendTenantNotFound(res, 'Category', id);
    }

    const { title, description, icon, displayOrder, active, posVisible, kitchenRelevance, updatedAt } = req.body;

    // Optimistic concurrency check if updatedAt is supplied
    if (updatedAt && new Date(updatedAt).getTime() !== new Date(existingCategory.updatedAt).getTime()) {
      return res.status(409).json({
        error: 'Category has been modified by another user. Please refresh and try again.',
      });
    }

    const dataToUpdate: any = {};
    if (title !== undefined && typeof title === 'string' && title.trim()) {
      dataToUpdate.title = title.trim();
      dataToUpdate.slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (description !== undefined) dataToUpdate.description = description ? String(description).trim() : null;
    if (icon !== undefined) dataToUpdate.icon = icon ? String(icon).trim() : null;
    if (displayOrder !== undefined) dataToUpdate.displayOrder = Number(displayOrder) || 0;
    if (active !== undefined) dataToUpdate.active = Boolean(active);
    if (posVisible !== undefined) dataToUpdate.posVisible = Boolean(posVisible);
    if (kitchenRelevance !== undefined) dataToUpdate.kitchenRelevance = Boolean(kitchenRelevance);

    const updatedCategory = await prisma.category.update({
      where: { id: existingCategory.id },
      data: dataToUpdate,
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.CATEGORY_UPDATED,
      entity: 'CATEGORY',
      entityId: updatedCategory.id,
      metadata: { changes: Object.keys(dataToUpdate) },
    });

    const io = (req.app as any).get('io');
    if (io) io.to(`org_${organizationId}`).emit('categoryUpdated', updatedCategory);

    return res.json({
      success: true,
      message: 'Category updated successfully.',
      data: updatedCategory,
    });
  } catch (error: any) {
    console.error('[menuController.updateCategory] Error:', error);
    return res.status(500).json({ error: 'Failed to update category.' });
  }
}

export async function reorderCategories(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.user?.id;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const { categoryOrders } = req.body; // Array of { id: string, displayOrder: number }
    if (!Array.isArray(categoryOrders)) {
      return res.status(400).json({ error: 'categoryOrders must be an array of { id, displayOrder }.' });
    }

    await prisma.$transaction(
      categoryOrders.map((item: { id: string; displayOrder: number }) =>
        prisma.category.updateMany({
          where: { id: item.id, organizationId },
          data: { displayOrder: Number(item.displayOrder) || 0 },
        })
      )
    );

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.CATEGORY_REORDERED,
      entity: 'CATEGORY',
      metadata: { count: categoryOrders.length },
    });

    return res.json({
      success: true,
      message: 'Categories reordered successfully.',
    });
  } catch (error: any) {
    console.error('[menuController.reorderCategories] Error:', error);
    return res.status(500).json({ error: 'Failed to reorder categories.' });
  }
}

export async function deleteCategory(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const category = await prisma.category.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
    });

    if (!category) {
      return sendTenantNotFound(res, 'Category', id);
    }

    // Safety check: Prevent deletion if active menu items reference this category
    const activeItemsCount = await prisma.menuItem.count({
      where: { categoryId: category.id, organizationId, archived: false },
    });

    if (activeItemsCount > 0) {
      return res.status(400).json({
        error: `Cannot delete category '${category.title}' because it contains ${activeItemsCount} active menu items. Please move or archive the menu items first.`,
      });
    }

    // Soft delete / de-activate category safely
    const archivedCategory = await prisma.category.update({
      where: { id: category.id },
      data: { active: false },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.CATEGORY_ARCHIVED,
      entity: 'CATEGORY',
      entityId: category.id,
      metadata: { title: category.title },
    });

    return res.json({
      success: true,
      message: `Category '${category.title}' archived successfully.`,
      data: archivedCategory,
    });
  } catch (error: any) {
    console.error('[menuController.deleteCategory] Error:', error);
    return res.status(500).json({ error: 'Failed to delete category.' });
  }
}

// ============================================================================
// 2. ADVANCED MENU ITEM MANAGEMENT
// ============================================================================

export async function getMenuItems(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const { categoryId, branchId, search, availableOnly, includeArchived } = req.query;

    const whereClause: any = {
      organizationId,
    };

    if (includeArchived !== 'true') {
      whereClause.archived = false;
    }

    if (availableOnly === 'true') {
      whereClause.available = true;
      whereClause.active = true;
    }

    if (categoryId) {
      whereClause.categoryId = String(categoryId);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { posName: { contains: term, mode: 'insensitive' } },
        { kitchenName: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
      ];
    }

    const menuItems = await prisma.menuItem.findMany({
      where: whereClause,
      include: {
        category: {
          select: { id: true, title: true, slug: true },
        },
        variants: {
          where: { active: true },
          orderBy: { displayOrder: 'asc' },
        },
        modifierGroups: {
          orderBy: { displayOrder: 'asc' },
          include: {
            modifierGroup: {
              include: {
                options: {
                  where: { active: true },
                  orderBy: { displayOrder: 'asc' },
                },
              },
            },
          },
        },
        branchOverrides: branchId ? {
          where: { branchId: String(branchId) },
        } : true,
      },
      orderBy: [
        { displayOrder: 'asc' },
        { title: 'asc' },
      ],
    });

    // Apply branch overrides if branchId provided
    const processedItems = menuItems.map((item: any) => {
      let finalPrice = item.price;
      let finalAvailable = item.available;
      let finalActive = item.active;
      let finalKitchenStation = item.kitchenStation;

      if (branchId && Array.isArray(item.branchOverrides) && item.branchOverrides.length > 0) {
        const override = item.branchOverrides[0];
        if (override.price !== null && override.price !== undefined) finalPrice = override.price;
        if (override.available !== undefined) finalAvailable = override.available;
        if (override.active !== undefined) finalActive = override.active;
        if (override.kitchenStation) finalKitchenStation = override.kitchenStation;
      }

      return {
        ...item,
        price: finalPrice,
        available: finalAvailable,
        active: finalActive,
        kitchenStation: finalKitchenStation,
      };
    });

    return res.json({
      success: true,
      data: processedItems,
    });
  } catch (error: any) {
    console.error('[menuController.getMenuItems] Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve menu items.' });
  }
}

export async function getMenuItem(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const { id } = req.params;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const menuItem = await prisma.menuItem.findFirst({
      where: { id, organizationId },
      include: {
        category: true,
        variants: {
          orderBy: { displayOrder: 'asc' },
        },
        modifierGroups: {
          orderBy: { displayOrder: 'asc' },
          include: {
            modifierGroup: {
              include: {
                options: {
                  orderBy: { displayOrder: 'asc' },
                },
              },
            },
          },
        },
        branchOverrides: true,
      },
    });

    if (!menuItem) {
      return sendTenantNotFound(res, 'MenuItem', id);
    }

    return res.json({
      success: true,
      data: menuItem,
    });
  } catch (error: any) {
    console.error('[menuController.getMenuItem] Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve menu item.' });
  }
}

export async function createMenuItem(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.user?.id;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const {
      title,
      posName,
      kitchenName,
      price,
      description,
      imageUrl,
      categoryId,
      categoryTitle,
      displayOrder,
      sku,
      active,
      available,
      preparationTime,
      kitchenStation,
      taxExempt,
      taxRate,
      variants, // Array of { name, posName, kitchenName, price, sku, displayOrder }
      modifierGroupIds, // Array of string IDs
    } = req.body;

    const itemTitle = (title || '').trim();
    if (!itemTitle) {
      return res.status(400).json({ error: 'Menu item title is required.' });
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ error: 'Price must be a valid non-negative number.' });
    }

    // Resolve Category ID within tenant
    let targetCategoryId = categoryId ? String(categoryId).trim() : '';
    if (targetCategoryId) {
      const catMatch = await prisma.category.findFirst({
        where: { id: targetCategoryId, organizationId },
      });
      if (!catMatch) {
        return res.status(404).json({ error: `Category ID '${targetCategoryId}' not found in organization.` });
      }
    } else if (categoryTitle) {
      const slug = String(categoryTitle).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let cat = await prisma.category.findFirst({
        where: { slug, organizationId },
      });
      if (!cat) {
        cat = await prisma.category.create({
          data: {
            organizationId,
            title: categoryTitle,
            slug,
            active: true,
          },
        });
      }
      targetCategoryId = cat.id;
    } else {
      let defaultCat = await prisma.category.findFirst({ where: { organizationId } });
      if (!defaultCat) {
        defaultCat = await prisma.category.create({
          data: { organizationId, title: 'General', slug: 'general', active: true },
        });
      }
      targetCategoryId = defaultCat.id;
    }

    // Execute within Prisma transaction with resource billing limits
    const createdItem = await prisma.$transaction(async (tx) => {
      await assertResourceLimit(tx, organizationId, 'menuItems');

      const newItem = await tx.menuItem.create({
        data: {
          organizationId,
          title: itemTitle,
          posName: posName ? String(posName).trim() : null,
          kitchenName: kitchenName ? String(kitchenName).trim() : null,
          price: numericPrice,
          description: description ? String(description).trim() : null,
          imageUrl: imageUrl ? String(imageUrl).trim() : '',
          categoryId: targetCategoryId,
          displayOrder: Number(displayOrder) || 0,
          sku: sku ? String(sku).trim() : null,
          active: active !== undefined ? Boolean(active) : true,
          available: available !== undefined ? Boolean(available) : true,
          archived: false,
          preparationTime: Number(preparationTime) || 10,
          kitchenStation: kitchenStation ? String(kitchenStation).trim() : 'Kitchen',
          taxExempt: Boolean(taxExempt),
          taxRate: taxRate !== undefined && taxRate !== null ? Number(taxRate) : null,
        },
      });

      // Add Variants if supplied
      if (Array.isArray(variants) && variants.length > 0) {
        await tx.menuItemVariant.createMany({
          data: variants.map((v: any, idx: number) => ({
            organizationId,
            menuItemId: newItem.id,
            name: String(v.name).trim(),
            posName: v.posName ? String(v.posName).trim() : null,
            kitchenName: v.kitchenName ? String(v.kitchenName).trim() : null,
            price: Number(v.price) || 0,
            sku: v.sku ? String(v.sku).trim() : null,
            displayOrder: typeof v.displayOrder === 'number' && !isNaN(v.displayOrder) ? v.displayOrder : idx,
            active: v.active !== undefined ? Boolean(v.active) : true,
          })),
        });
      }

      // Link Modifier Groups if supplied (strictly validating tenant ownership of modifier groups)
      if (Array.isArray(modifierGroupIds) && modifierGroupIds.length > 0) {
        const validGroups = await tx.modifierGroup.findMany({
          where: { id: { in: modifierGroupIds }, organizationId },
        });
        if (validGroups.length > 0) {
          await tx.menuItemModifierGroup.createMany({
            data: validGroups.map((g, idx) => ({
              organizationId,
              menuItemId: newItem.id,
              modifierGroupId: g.id,
              displayOrder: idx,
            })),
          });
        }
      }

      return newItem;
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.MENU_ITEM_CREATED,
      entity: 'MENU_ITEM',
      entityId: createdItem.id,
      metadata: { title: createdItem.title, price: createdItem.price },
    });

    const io = (req.app as any).get('io');
    if (io) io.to(`org_${organizationId}`).emit('menuItemCreated', createdItem);

    return res.status(201).json({
      success: true,
      message: 'Menu item created successfully.',
      data: createdItem,
    });
  } catch (error: any) {
    console.error('[menuController.createMenuItem] Error:', error);
    if (error.message && (error.message.includes('LIMIT_EXCEEDED') || error.message.includes('SUBSCRIPTION_RESTRICTED'))) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to create menu item.' });
  }
}

export async function updateMenuItem(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const existingItem = await prisma.menuItem.findFirst({
      where: { id, organizationId },
    });
    if (!existingItem) {
      return sendTenantNotFound(res, 'MenuItem', id);
    }

    const {
      title,
      posName,
      kitchenName,
      price,
      description,
      imageUrl,
      categoryId,
      displayOrder,
      sku,
      active,
      available,
      preparationTime,
      kitchenStation,
      taxExempt,
      taxRate,
      variants, // Full replacement array of variants
      modifierGroupIds, // Array of group IDs
      updatedAt,
    } = req.body;

    // Optimistic concurrency check
    if (updatedAt && new Date(updatedAt).getTime() !== new Date(existingItem.updatedAt).getTime()) {
      return res.status(409).json({
        error: 'Menu item has been updated by another user. Please refresh and try again.',
      });
    }

    const dataToUpdate: any = {};
    if (title !== undefined && typeof title === 'string' && title.trim()) {
      dataToUpdate.title = title.trim();
    }
    if (posName !== undefined) dataToUpdate.posName = posName ? String(posName).trim() : null;
    if (kitchenName !== undefined) dataToUpdate.kitchenName = kitchenName ? String(kitchenName).trim() : null;
    if (price !== undefined) {
      const numP = Number(price);
      if (isNaN(numP) || numP < 0) return res.status(400).json({ error: 'Price must be non-negative number.' });
      dataToUpdate.price = numP;
    }
    if (description !== undefined) dataToUpdate.description = description ? String(description).trim() : null;
    if (imageUrl !== undefined) dataToUpdate.imageUrl = String(imageUrl).trim();
    if (displayOrder !== undefined) dataToUpdate.displayOrder = Number(displayOrder) || 0;
    if (sku !== undefined) dataToUpdate.sku = sku ? String(sku).trim() : null;
    if (active !== undefined) dataToUpdate.active = Boolean(active);
    if (available !== undefined) dataToUpdate.available = Boolean(available);
    if (preparationTime !== undefined) dataToUpdate.preparationTime = Number(preparationTime) || 10;
    if (kitchenStation !== undefined) dataToUpdate.kitchenStation = kitchenStation ? String(kitchenStation).trim() : 'Kitchen';
    if (taxExempt !== undefined) dataToUpdate.taxExempt = Boolean(taxExempt);
    if (taxRate !== undefined) dataToUpdate.taxRate = taxRate !== null ? Number(taxRate) : null;

    if (categoryId) {
      const catMatch = await prisma.category.findFirst({
        where: { id: String(categoryId), organizationId },
      });
      if (catMatch) dataToUpdate.categoryId = catMatch.id;
    }

    const updatedItem = await prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.update({
        where: { id: existingItem.id },
        data: dataToUpdate,
      });

      // Update Variants if passed
      if (Array.isArray(variants)) {
        await tx.menuItemVariant.deleteMany({
          where: { menuItemId: item.id },
        });
        if (variants.length > 0) {
          await tx.menuItemVariant.createMany({
            data: variants.map((v: any, idx: number) => ({
              organizationId,
              menuItemId: item.id,
              name: String(v.name).trim(),
              posName: v.posName ? String(v.posName).trim() : null,
              kitchenName: v.kitchenName ? String(v.kitchenName).trim() : null,
              price: Number(v.price) || 0,
              sku: v.sku ? String(v.sku).trim() : null,
              displayOrder: typeof v.displayOrder === 'number' && !isNaN(v.displayOrder) ? v.displayOrder : idx,
              active: v.active !== undefined ? Boolean(v.active) : true,
            })),
          });
        }
      }

      // Update Modifier Groups if passed
      if (Array.isArray(modifierGroupIds)) {
        await tx.menuItemModifierGroup.deleteMany({
          where: { menuItemId: item.id },
        });
        if (modifierGroupIds.length > 0) {
          const validGroups = await tx.modifierGroup.findMany({
            where: { id: { in: modifierGroupIds }, organizationId },
          });
          if (validGroups.length > 0) {
            await tx.menuItemModifierGroup.createMany({
              data: validGroups.map((g, idx) => ({
                organizationId,
                menuItemId: item.id,
                modifierGroupId: g.id,
                displayOrder: idx,
              })),
            });
          }
        }
      }

      return item;
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.MENU_ITEM_UPDATED,
      entity: 'MENU_ITEM',
      entityId: updatedItem.id,
      metadata: { changes: Object.keys(dataToUpdate) },
    });

    const io = (req.app as any).get('io');
    if (io) io.to(`org_${organizationId}`).emit('menuItemUpdated', updatedItem);

    return res.json({
      success: true,
      message: 'Menu item updated successfully.',
      data: updatedItem,
    });
  } catch (error: any) {
    console.error('[menuController.updateMenuItem] Error:', error);
    return res.status(500).json({ error: 'Failed to update menu item.' });
  }
}

export async function toggleAvailability(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { available, active, branchId } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const menuItem = await prisma.menuItem.findFirst({
      where: { id, organizationId },
    });
    if (!menuItem) {
      return sendTenantNotFound(res, 'MenuItem', id);
    }

    if (branchId) {
      // Branch-specific availability toggle
      const branchMatch = await prisma.branch.findFirst({
        where: { id: String(branchId), organizationId },
      });
      if (!branchMatch) {
        return res.status(404).json({ error: 'Branch not found.' });
      }

      const override = await prisma.branchMenuItem.upsert({
        where: {
          branchId_menuItemId: { branchId: branchMatch.id, menuItemId: menuItem.id },
        },
        create: {
          organizationId,
          branchId: branchMatch.id,
          menuItemId: menuItem.id,
          available: available !== undefined ? Boolean(available) : true,
          active: active !== undefined ? Boolean(active) : true,
        },
        update: {
          available: available !== undefined ? Boolean(available) : undefined,
          active: active !== undefined ? Boolean(active) : undefined,
        },
      });

      await logAuditEvent({
        organizationId,
        branchId: branchMatch.id,
        userId,
        action: AUDIT_ACTIONS.AVAILABILITY_CHANGED,
        entity: 'MENU_ITEM',
        entityId: menuItem.id,
        metadata: { scope: 'BRANCH', available: override.available, active: override.active },
      });

      return res.json({
        success: true,
        message: `Availability updated for branch '${branchMatch.name}'.`,
        data: override,
      });
    }

    // Organization-wide availability toggle
    const updated = await prisma.menuItem.update({
      where: { id: menuItem.id },
      data: {
        available: available !== undefined ? Boolean(available) : menuItem.available,
        active: active !== undefined ? Boolean(active) : menuItem.active,
      },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.AVAILABILITY_CHANGED,
      entity: 'MENU_ITEM',
      entityId: menuItem.id,
      metadata: { scope: 'GLOBAL', available: updated.available, active: updated.active },
    });

    const io = (req.app as any).get('io');
    if (io) io.to(`org_${organizationId}`).emit('menuItemUpdated', updated);

    return res.json({
      success: true,
      message: 'Menu item availability toggled.',
      data: updated,
    });
  } catch (error: any) {
    console.error('[menuController.toggleAvailability] Error:', error);
    return res.status(500).json({ error: 'Failed to update availability.' });
  }
}

export async function bulkUpdateMenuItems(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.user?.id;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const { itemIds, action, targetCategoryId, availableState } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'itemIds array is required.' });
    }

    // Verify all itemIds belong strictly to this tenant organization
    const validItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds }, organizationId },
      select: { id: true },
    });
    const validIds = validItems.map((i) => i.id);

    if (validIds.length === 0) {
      return res.status(404).json({ error: 'No matching items found in organization.' });
    }

    let message = '';
    if (action === 'ARCHIVE') {
      await prisma.menuItem.updateMany({
        where: { id: { in: validIds } },
        data: { archived: true, active: false },
      });
      message = `Archived ${validIds.length} menu items.`;
    } else if (action === 'ACTIVATE') {
      await prisma.menuItem.updateMany({
        where: { id: { in: validIds } },
        data: { active: true, available: true, archived: false },
      });
      message = `Activated ${validIds.length} menu items.`;
    } else if (action === 'SET_AVAILABILITY') {
      await prisma.menuItem.updateMany({
        where: { id: { in: validIds } },
        data: { available: Boolean(availableState) },
      });
      message = `Set availability to ${Boolean(availableState)} for ${validIds.length} items.`;
    } else if (action === 'MOVE_CATEGORY') {
      if (!targetCategoryId) return res.status(400).json({ error: 'targetCategoryId is required for MOVE_CATEGORY action.' });
      const catMatch = await prisma.category.findFirst({
        where: { id: String(targetCategoryId), organizationId },
      });
      if (!catMatch) return res.status(404).json({ error: 'Target category not found.' });

      await prisma.menuItem.updateMany({
        where: { id: { in: validIds } },
        data: { categoryId: catMatch.id },
      });
      message = `Moved ${validIds.length} items to category '${catMatch.title}'.`;
    } else {
      return res.status(400).json({ error: 'Invalid bulk action specified.' });
    }

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.BULK_MENU_UPDATED,
      entity: 'MENU_ITEM',
      metadata: { action, count: validIds.length },
    });

    return res.json({
      success: true,
      message,
      affectedCount: validIds.length,
    });
  } catch (error: any) {
    console.error('[menuController.bulkUpdateMenuItems] Error:', error);
    return res.status(500).json({ error: 'Failed bulk menu operation.' });
  }
}

export async function archiveMenuItem(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const item = await prisma.menuItem.findFirst({
      where: { id, organizationId },
    });

    if (!item) {
      return sendTenantNotFound(res, 'MenuItem', id);
    }

    // Soft archive preserving historical orders
    const archivedItem = await prisma.menuItem.update({
      where: { id: item.id },
      data: { archived: true, active: false, available: false },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.MENU_ITEM_ARCHIVED,
      entity: 'MENU_ITEM',
      entityId: item.id,
      metadata: { title: item.title },
    });

    const io = (req.app as any).get('io');
    if (io) io.to(`org_${organizationId}`).emit('menuItemDeleted', { id: item.id, title: item.title });

    return res.json({
      success: true,
      message: `Menu item '${item.title}' archived successfully. Historical orders remain intact.`,
      data: archivedItem,
    });
  } catch (error: any) {
    console.error('[menuController.archiveMenuItem] Error:', error);
    return res.status(500).json({ error: 'Failed to archive menu item.' });
  }
}

// ============================================================================
// 3. REUSABLE MODIFIER GROUPS & OPTIONS
// ============================================================================

export async function getModifierGroups(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const groups = await prisma.modifierGroup.findMany({
      where: { organizationId, active: true },
      include: {
        options: {
          where: { active: true },
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: { menuItemLinks: true },
        },
      },
      orderBy: [
        { displayOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    return res.json({
      success: true,
      data: groups,
    });
  } catch (error: any) {
    console.error('[menuController.getModifierGroups] Error:', error);
    return res.status(500).json({ error: 'Failed to retrieve modifier groups.' });
  }
}

export async function createModifierGroup(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.user?.id;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const {
      name,
      posName,
      kitchenName,
      required,
      minSelections,
      maxSelections,
      multiSelect,
      displayOrder,
      options, // Array of { name, posName, kitchenName, price, displayOrder }
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Modifier group name is required.' });
    }

    const group = await prisma.modifierGroup.create({
      data: {
        organizationId,
        name: name.trim(),
        posName: posName ? String(posName).trim() : null,
        kitchenName: kitchenName ? String(kitchenName).trim() : null,
        required: Boolean(required),
        minSelections: Number(minSelections) || (required ? 1 : 0),
        maxSelections: Number(maxSelections) || 1,
        multiSelect: multiSelect !== undefined ? Boolean(multiSelect) : true,
        displayOrder: Number(displayOrder) || 0,
        active: true,
        options: Array.isArray(options) && options.length > 0 ? {
          create: options.map((opt: any, idx: number) => ({
            organizationId,
            name: String(opt.name).trim(),
            posName: opt.posName ? String(opt.posName).trim() : null,
            kitchenName: opt.kitchenName ? String(opt.kitchenName).trim() : null,
            price: Number(opt.price) || 0,
            displayOrder: typeof opt.displayOrder === 'number' && !isNaN(opt.displayOrder) ? opt.displayOrder : idx,
            active: true,
          })),
        } : undefined,
      },
      include: {
        options: true,
      },
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.MODIFIER_GROUP_CREATED,
      entity: 'MODIFIER_GROUP',
      entityId: group.id,
      metadata: { name: group.name, optionsCount: group.options.length },
    });

    return res.status(201).json({
      success: true,
      message: 'Modifier group created successfully.',
      data: group,
    });
  } catch (error: any) {
    console.error('[menuController.createModifierGroup] Error:', error);
    return res.status(500).json({ error: 'Failed to create modifier group.' });
  }
}

export async function updateModifierGroup(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const existingGroup = await prisma.modifierGroup.findFirst({
      where: { id, organizationId },
    });

    if (!existingGroup) {
      return sendTenantNotFound(res, 'ModifierGroup', id);
    }

    const {
      name,
      posName,
      kitchenName,
      required,
      minSelections,
      maxSelections,
      multiSelect,
      displayOrder,
      options, // Replacement options array
    } = req.body;

    const dataToUpdate: any = {};
    if (name !== undefined && typeof name === 'string' && name.trim()) dataToUpdate.name = name.trim();
    if (posName !== undefined) dataToUpdate.posName = posName ? String(posName).trim() : null;
    if (kitchenName !== undefined) dataToUpdate.kitchenName = kitchenName ? String(kitchenName).trim() : null;
    if (required !== undefined) dataToUpdate.required = Boolean(required);
    if (minSelections !== undefined) dataToUpdate.minSelections = Number(minSelections) || 0;
    if (maxSelections !== undefined) dataToUpdate.maxSelections = Number(maxSelections) || 1;
    if (multiSelect !== undefined) dataToUpdate.multiSelect = Boolean(multiSelect);
    if (displayOrder !== undefined) dataToUpdate.displayOrder = Number(displayOrder) || 0;

    const updatedGroup = await prisma.$transaction(async (tx) => {
      const g = await tx.modifierGroup.update({
        where: { id: existingGroup.id },
        data: dataToUpdate,
      });

      if (Array.isArray(options)) {
        await tx.modifierOption.deleteMany({
          where: { modifierGroupId: g.id },
        });
        if (options.length > 0) {
          await tx.modifierOption.createMany({
            data: options.map((opt: any, idx: number) => ({
              organizationId,
              modifierGroupId: g.id,
              name: String(opt.name).trim(),
              posName: opt.posName ? String(opt.posName).trim() : null,
              kitchenName: opt.kitchenName ? String(opt.kitchenName).trim() : null,
              price: Number(opt.price) || 0,
              displayOrder: typeof opt.displayOrder === 'number' && !isNaN(opt.displayOrder) ? opt.displayOrder : idx,
              active: true,
            })),
          });
        }
      }

      return tx.modifierGroup.findUnique({
        where: { id: g.id },
        include: { options: true },
      });
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.MODIFIER_GROUP_UPDATED,
      entity: 'MODIFIER_GROUP',
      entityId: existingGroup.id,
      metadata: { changes: Object.keys(dataToUpdate) },
    });

    return res.json({
      success: true,
      message: 'Modifier group updated successfully.',
      data: updatedGroup,
    });
  } catch (error: any) {
    console.error('[menuController.updateModifierGroup] Error:', error);
    return res.status(500).json({ error: 'Failed to update modifier group.' });
  }
}

export async function deleteModifierGroup(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const group = await prisma.modifierGroup.findFirst({
      where: { id, organizationId },
    });

    if (!group) {
      return sendTenantNotFound(res, 'ModifierGroup', id);
    }

    await prisma.$transaction([
      prisma.menuItemModifierGroup.deleteMany({
        where: { modifierGroupId: group.id },
      }),
      prisma.modifierOption.deleteMany({
        where: { modifierGroupId: group.id },
      }),
      prisma.modifierGroup.delete({
        where: { id: group.id },
      }),
    ]);

    await logAuditEvent({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.MODIFIER_GROUP_DELETED,
      entity: 'MODIFIER_GROUP',
      entityId: group.id,
      metadata: { name: group.name },
    });

    return res.json({
      success: true,
      message: `Modifier group '${group.name}' deleted successfully.`,
    });
  } catch (error: any) {
    console.error('[menuController.deleteModifierGroup] Error:', error);
    return res.status(500).json({ error: 'Failed to delete modifier group.' });
  }
}

// ============================================================================
// 4. BRANCH MENU CLONING & OVERRIDES
// ============================================================================

export async function cloneMenu(req: Request, res: Response): Promise<Response> {
  try {
    const organizationId = req.tenant?.organizationId;
    const userId = req.user?.id;
    if (!organizationId) {
      return res.status(400).json({ error: 'Tenant organization context required.' });
    }

    const { targetBranchId } = req.body;
    if (!targetBranchId) {
      return res.status(400).json({ error: 'targetBranchId is required for menu clone.' });
    }

    const targetBranch = await prisma.branch.findFirst({
      where: { id: String(targetBranchId), organizationId },
    });
    if (!targetBranch) {
      return res.status(404).json({ error: 'Target branch not found in organization.' });
    }

    // Perform menu clone in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch source global categories & items
      const sourceCategories = await tx.category.findMany({
        where: { organizationId, branchId: null },
      });

      const sourceItems = await tx.menuItem.findMany({
        where: { organizationId, branchId: null, archived: false },
        include: {
          variants: true,
          modifierGroups: {
            include: {
              modifierGroup: {
                include: {
                  options: true,
                },
              },
            },
          },
        },
      });

      let clonedCategoryCount = 0;
      let clonedItemCount = 0;

      // 2. Clone categories to branch scope if not present
      for (const cat of sourceCategories) {
        const branchCatSlug = `${cat.slug}-${targetBranch.slug || targetBranch.id.slice(-6)}`;
        const existingBranchCat = await tx.category.findFirst({
          where: { organizationId, slug: branchCatSlug },
        });
        if (!existingBranchCat) {
          await tx.category.create({
            data: {
              organizationId,
              branchId: targetBranch.id,
              title: cat.title,
              slug: branchCatSlug,
              description: cat.description,
              icon: cat.icon,
              displayOrder: cat.displayOrder,
              active: cat.active,
              posVisible: cat.posVisible,
              kitchenRelevance: cat.kitchenRelevance,
            },
          });
          clonedCategoryCount++;
        }
      }

      // 3. Upsert BranchMenuItem overrides for every item
      for (const item of sourceItems) {
        await tx.branchMenuItem.upsert({
          where: {
            branchId_menuItemId: { branchId: targetBranch.id, menuItemId: item.id },
          },
          create: {
            organizationId,
            branchId: targetBranch.id,
            menuItemId: item.id,
            price: item.price,
            available: item.available,
            active: item.active,
            kitchenStation: item.kitchenStation,
          },
          update: {
            price: item.price,
            available: item.available,
            active: item.active,
            kitchenStation: item.kitchenStation,
          },
        });
        clonedItemCount++;
      }

      return { clonedCategoryCount, clonedItemCount };
    });

    await logAuditEvent({
      organizationId,
      branchId: targetBranch.id,
      userId,
      action: AUDIT_ACTIONS.MENU_CLONED,
      entity: 'MENU',
      metadata: { targetBranchId: targetBranch.id, ...result },
    });

    return res.json({
      success: true,
      message: `Menu cloned successfully to branch '${targetBranch.name}'.`,
      data: result,
    });
  } catch (error: any) {
    console.error('[menuController.cloneMenu] Error:', error);
    return res.status(500).json({ error: 'Failed to clone menu.' });
  }
}
