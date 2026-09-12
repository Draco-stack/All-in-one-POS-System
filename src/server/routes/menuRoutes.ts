import { Router } from 'express';
import { authenticate, requireTenant } from '../middleware/auth';
import { requireCustomerPortalAccess } from '../middleware/subscriptionMiddleware';
import {
  getCategories,
  createCategory,
  updateCategory,
  reorderCategories,
  deleteCategory,
  getMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  toggleAvailability,
  bulkUpdateMenuItems,
  archiveMenuItem,
  getModifierGroups,
  createModifierGroup,
  updateModifierGroup,
  deleteModifierGroup,
  cloneMenu,
} from '../controllers/menuController';

const router = Router();

// Protect all menu management routes with tenant authentication and customer portal entitlements
router.use(authenticate);
router.use(requireTenant);
router.use(requireCustomerPortalAccess);

// Category Routes
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/reorder', reorderCategories);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Menu Item Routes
router.get('/items', getMenuItems);
router.get('/items/:id', getMenuItem);
router.post('/items', createMenuItem);
router.put('/items/:id', updateMenuItem);
router.patch('/items/:id/availability', toggleAvailability);
router.post('/items/bulk', bulkUpdateMenuItems);
router.delete('/items/:id', archiveMenuItem);

// Modifier Group Routes
router.get('/modifier-groups', getModifierGroups);
router.post('/modifier-groups', createModifierGroup);
router.put('/modifier-groups/:id', updateModifierGroup);
router.delete('/modifier-groups/:id', deleteModifierGroup);

// Menu Clone Route
router.post('/clone', cloneMenu);

export default router;
