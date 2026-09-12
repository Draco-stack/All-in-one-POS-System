import { Router } from 'express';
import { authenticate, requireTenant, requirePermission } from '../middleware/auth';
import { requireCustomerPortalAccess } from '../middleware/subscriptionMiddleware';
import { RESTAURANT_PERMISSIONS } from '../auth/permissions';
import {
  getPortalOverview,
  getPortalSubscription,
  upgradePortalSubscription,
  getPortalRestaurant,
  updatePortalRestaurant,
  getPortalTeam,
  getPortalStaffById,
  getPortalDevices,
  getPortalSessions,
  revokePortalSession,
  getPortalBranches,
  createPortalBranch,
  updatePortalBranch,
  deletePortalBranch,
  createPortalStaff,
  updatePortalStaff,
  deletePortalStaff,
  getPortalMenu,
  createPortalCategory,
  updatePortalCategory,
  deletePortalCategory,
  createPortalMenuItem,
  updatePortalMenuItem,
  deletePortalMenuItem,
  getPortalTables,
  createPortalTable,
  updatePortalTable,
  deletePortalTable,
  getPortalKitchen,
  getPortalInventory,
  adjustPortalInventory,
  createPortalIngredient,
  updatePortalIngredient,
  archivePortalIngredient,
  getPortalOrders,
  getPortalShifts,
  getPortalCustomers,
  getPortalVendors,
  createPortalVendor,
  updatePortalVendor,
  deletePortalVendor,
  getPortalReports,
  getPortalRecipes,
  createPortalRecipe,
  deletePortalRecipe,
  getPortalWaste,
  createPortalWaste,
  getPortalTransfers,
  createPortalTransfer,
  getPortalCounts,
  createPortalCount,
} from '../controllers/portalController';
import {
  getOnboardingState,
  checkOnboardingReadiness,
  startOnboarding,
  setServiceModel,
  executeTestOrder,
  completeOnboarding,
} from '../controllers/onboardingController';
import { 
  createPurchaseOrder, 
  getPurchaseOrders, 
  getPurchaseOrder, 
  submitPurchaseOrder, 
  approvePurchaseOrder, 
  createGoodsReceipt, 
  finalizeGoodsReceipt 
} from '../controllers/procurementController';
import {
  createApprovalRequestHandler,
  getApprovalRequestsHandler,
  getApprovalRequestByIdHandler,
  processApprovalRequestHandler,
  cancelApprovalRequestHandler,
  createCashMovementHandler,
  getCashMovementsHandler,
  conductCashAuditHandler,
  getCashAuditsHandler,
  resolveVarianceHandler,
} from '../controllers/financialApprovalController';

const router = Router();

// ============================================================================
// CUSTOMER / RESTAURANT OWNER PORTAL ROUTES (Phase 24 Matrix Enforcement)
// Enforces tenant isolation, verified tenant context, and role-based permissions.
// ============================================================================
router.use(authenticate);
router.use(requireTenant);
router.use(requireCustomerPortalAccess);

// Phase 19 Onboarding & Readiness Routes
router.get('/onboarding', getOnboardingState);
router.get('/onboarding/readiness', checkOnboardingReadiness);
router.post('/onboarding/start', requirePermission(RESTAURANT_PERMISSIONS.SETTINGS_UPDATE), startOnboarding);
router.post('/onboarding/service-model', requirePermission(RESTAURANT_PERMISSIONS.SETTINGS_UPDATE), setServiceModel);
router.post('/onboarding/test-order', requirePermission(RESTAURANT_PERMISSIONS.ORDERS_CREATE), executeTestOrder);
router.post('/onboarding/complete', requirePermission(RESTAURANT_PERMISSIONS.SETTINGS_UPDATE), completeOnboarding);

// Overview & Profile
router.get('/overview', requirePermission(RESTAURANT_PERMISSIONS.ORGANIZATION_VIEW), getPortalOverview);
router.get('/subscription', requirePermission(RESTAURANT_PERMISSIONS.ORGANIZATION_VIEW), getPortalSubscription);
router.post('/subscription/upgrade', requirePermission(RESTAURANT_PERMISSIONS.ORGANIZATION_UPDATE), upgradePortalSubscription);
router.get('/restaurant', requirePermission(RESTAURANT_PERMISSIONS.ORGANIZATION_VIEW), getPortalRestaurant);
router.put('/restaurant', requirePermission(RESTAURANT_PERMISSIONS.ORGANIZATION_UPDATE), updatePortalRestaurant);
router.put('/settings', requirePermission(RESTAURANT_PERMISSIONS.ORGANIZATION_UPDATE), updatePortalRestaurant);
router.get('/team', requirePermission(RESTAURANT_PERMISSIONS.STAFF_VIEW), getPortalTeam);
router.get('/devices', requirePermission(RESTAURANT_PERMISSIONS.DEVICES_VIEW), getPortalDevices);
router.get('/sessions', requirePermission(RESTAURANT_PERMISSIONS.AUDIT_VIEW), getPortalSessions);
router.post('/sessions/revoke', requirePermission(RESTAURANT_PERMISSIONS.STAFF_UPDATE), revokePortalSession);

// Branch Management
router.get('/branches', requirePermission(RESTAURANT_PERMISSIONS.BRANCH_VIEW), getPortalBranches);
router.post('/branches', requirePermission(RESTAURANT_PERMISSIONS.BRANCH_CREATE), createPortalBranch);
router.put('/branches/:branchId', requirePermission(RESTAURANT_PERMISSIONS.BRANCH_UPDATE), updatePortalBranch);
router.patch('/branches/:branchId', requirePermission(RESTAURANT_PERMISSIONS.BRANCH_UPDATE), updatePortalBranch);
router.delete('/branches/:branchId', requirePermission(RESTAURANT_PERMISSIONS.BRANCH_DEACTIVATE), deletePortalBranch);

// Staff Management
router.get('/staff', requirePermission(RESTAURANT_PERMISSIONS.STAFF_VIEW), getPortalTeam);
router.get('/staff/:userId', requirePermission(RESTAURANT_PERMISSIONS.STAFF_VIEW), getPortalStaffById);
router.post('/staff', requirePermission(RESTAURANT_PERMISSIONS.STAFF_CREATE), createPortalStaff);
router.put('/staff/:userId', requirePermission(RESTAURANT_PERMISSIONS.STAFF_UPDATE), updatePortalStaff);
router.patch('/staff/:userId', requirePermission(RESTAURANT_PERMISSIONS.STAFF_UPDATE), updatePortalStaff);
router.delete('/staff/:userId', requirePermission(RESTAURANT_PERMISSIONS.STAFF_DISABLE), deletePortalStaff);

// Menu & Category Management
router.get('/menu', requirePermission(RESTAURANT_PERMISSIONS.MENU_VIEW), getPortalMenu);
router.post('/categories', requirePermission(RESTAURANT_PERMISSIONS.CATEGORIES_MANAGE), createPortalCategory);
router.put('/categories/:id', requirePermission(RESTAURANT_PERMISSIONS.CATEGORIES_MANAGE), updatePortalCategory);
router.delete('/categories/:id', requirePermission(RESTAURANT_PERMISSIONS.CATEGORIES_MANAGE), deletePortalCategory);
router.post('/menu-items', requirePermission(RESTAURANT_PERMISSIONS.PRODUCTS_MANAGE), createPortalMenuItem);
router.put('/menu-items/:id', requirePermission(RESTAURANT_PERMISSIONS.PRODUCTS_MANAGE), updatePortalMenuItem);
router.delete('/menu-items/:id', requirePermission(RESTAURANT_PERMISSIONS.PRODUCTS_MANAGE), deletePortalMenuItem);

// Tables & Floor Management
router.get('/tables', requirePermission(RESTAURANT_PERMISSIONS.TABLES_VIEW), getPortalTables);
router.post('/tables', requirePermission(RESTAURANT_PERMISSIONS.TABLES_MANAGE), createPortalTable);
router.put('/tables/:id', requirePermission(RESTAURANT_PERMISSIONS.TABLES_MANAGE), updatePortalTable);
router.delete('/tables/:id', requirePermission(RESTAURANT_PERMISSIONS.TABLES_MANAGE), deletePortalTable);

// Kitchen Management
router.get('/kitchen', requirePermission(RESTAURANT_PERMISSIONS.KDS_VIEW), getPortalKitchen);

// Inventory Management
router.get('/inventory', requirePermission(RESTAURANT_PERMISSIONS.INVENTORY_VIEW), getPortalInventory);
router.post('/inventory/adjust', requirePermission(RESTAURANT_PERMISSIONS.INVENTORY_ADJUST), adjustPortalInventory);
router.post('/inventory/ingredients', requirePermission(RESTAURANT_PERMISSIONS.INVENTORY_MANAGE), createPortalIngredient);
router.put('/inventory/ingredients/:id', requirePermission(RESTAURANT_PERMISSIONS.INVENTORY_MANAGE), updatePortalIngredient);
router.delete('/inventory/ingredients/:id', requirePermission(RESTAURANT_PERMISSIONS.INVENTORY_MANAGE), archivePortalIngredient);

// Phase 21 Advanced Inventory and Food Cost Control Routes
router.get('/recipes', requirePermission(RESTAURANT_PERMISSIONS.RECIPE_VIEW), getPortalRecipes);
router.post('/recipes', requirePermission(RESTAURANT_PERMISSIONS.RECIPE_CREATE), createPortalRecipe);
router.delete('/recipes/:id', requirePermission(RESTAURANT_PERMISSIONS.RECIPE_ARCHIVE), deletePortalRecipe);

router.get('/waste', requirePermission(RESTAURANT_PERMISSIONS.INVENTORY_WASTE), getPortalWaste);
router.post('/waste', requirePermission(RESTAURANT_PERMISSIONS.INVENTORY_WASTE), createPortalWaste);

router.get('/transfers', requirePermission(RESTAURANT_PERMISSIONS.INVENTORY_TRANSFER), getPortalTransfers);
router.post('/transfers', requirePermission(RESTAURANT_PERMISSIONS.INVENTORY_TRANSFER), createPortalTransfer);

router.get('/counts', requirePermission(RESTAURANT_PERMISSIONS.INVENTORY_RECONCILE), getPortalCounts);
router.post('/counts', requirePermission(RESTAURANT_PERMISSIONS.INVENTORY_RECONCILE), createPortalCount);

// Orders & Shifts Management
router.get('/orders', requirePermission(RESTAURANT_PERMISSIONS.ORDERS_VIEW), getPortalOrders);
router.get('/shifts', requirePermission(RESTAURANT_PERMISSIONS.SHIFTS_VIEW), getPortalShifts);

// Customers & Vendors
router.get('/customers', requirePermission(RESTAURANT_PERMISSIONS.CUSTOMERS_VIEW), getPortalCustomers);
router.get('/vendors', requirePermission(RESTAURANT_PERMISSIONS.VENDOR_VIEW), getPortalVendors);
router.post('/vendors', requirePermission(RESTAURANT_PERMISSIONS.VENDOR_CREATE), createPortalVendor);
router.put('/vendors/:id', requirePermission(RESTAURANT_PERMISSIONS.VENDOR_UPDATE), updatePortalVendor);
router.delete('/vendors/:id', requirePermission(RESTAURANT_PERMISSIONS.VENDOR_UPDATE), deletePortalVendor);

// Business Intelligence Reports
router.get('/reports', requirePermission(RESTAURANT_PERMISSIONS.REPORTS_VIEW), getPortalReports);

// Procurement & Purchasing
router.get('/procurement/purchase-orders', requirePermission(RESTAURANT_PERMISSIONS.PROCUREMENT_VIEW), getPurchaseOrders);
router.post('/procurement/purchase-orders', requirePermission(RESTAURANT_PERMISSIONS.PROCUREMENT_CREATE), createPurchaseOrder);
router.get('/procurement/purchase-orders/:id', requirePermission(RESTAURANT_PERMISSIONS.PROCUREMENT_VIEW), getPurchaseOrder);
router.post('/procurement/purchase-orders/:id/submit', requirePermission(RESTAURANT_PERMISSIONS.PROCUREMENT_CREATE), submitPurchaseOrder);
router.post('/procurement/purchase-orders/:id/approve', requirePermission(RESTAURANT_PERMISSIONS.PROCUREMENT_APPROVE), approvePurchaseOrder);

router.post('/procurement/goods-receipts', requirePermission(RESTAURANT_PERMISSIONS.PROCUREMENT_RECEIVE), createGoodsReceipt);
router.post('/procurement/goods-receipts/:id/finalize', requirePermission(RESTAURANT_PERMISSIONS.PROCUREMENT_RECEIVE), finalizeGoodsReceipt);

// Financial Approvals & Exception Controls (Phase 26)
router.get('/approvals', requirePermission(RESTAURANT_PERMISSIONS.APPROVALS_VIEW), getApprovalRequestsHandler);
router.post('/approvals', createApprovalRequestHandler);
router.get('/approvals/:id', requirePermission(RESTAURANT_PERMISSIONS.APPROVALS_VIEW), getApprovalRequestByIdHandler);
router.post('/approvals/:id/approve', requirePermission(RESTAURANT_PERMISSIONS.APPROVALS_APPROVE), processApprovalRequestHandler);
router.post('/approvals/:id/reject', requirePermission(RESTAURANT_PERMISSIONS.APPROVALS_APPROVE), processApprovalRequestHandler);
router.post('/approvals/:id/process', requirePermission(RESTAURANT_PERMISSIONS.APPROVALS_APPROVE), processApprovalRequestHandler);
router.post('/approvals/:id/cancel', cancelApprovalRequestHandler);

// Cash Movements & Audits
router.get('/cash/movements', getCashMovementsHandler);
router.post('/cash/movements', createCashMovementHandler);
router.get('/cash/audits', getCashAuditsHandler);
router.post('/cash/audit', requirePermission(RESTAURANT_PERMISSIONS.CASH_AUDIT), conductCashAuditHandler);
router.post('/cash/variance-resolution', requirePermission(RESTAURANT_PERMISSIONS.APPROVALS_APPROVE), resolveVarianceHandler);

export default router;
