import { Router } from 'express';
import { authenticate, requirePlatformAdmin } from '../middleware/auth';
import {
  getPlatformOverview,
  getOrganizations,
  getOrganizationDetail,
  updateOrganizationStatus,
  extendOrganizationTrial,
  getPlatformUsers,
  updatePlatformUserStatus,
  getPlatformSubscriptions,
  updateSubscriptionPlan,
  getPlatformAuditLogs,
  getPlatformHealth,
  triggerSubscriptionReminders,
  getPlatformReminderLogs,
} from '../controllers/platformAdminController';

const router = Router();

// ============================================================================
// STRICT SECURITY BOUNDARY:
// All platform-admin routes require active authentication + PLATFORM_ADMIN / EXECUTIVE_ADMIN role.
// Restaurant-level users (OWNER, MANAGER, CASHIER) are strictly rejected with 403 Forbidden.
// ============================================================================
router.use(authenticate);
router.use(requirePlatformAdmin);

router.get('/overview', getPlatformOverview);
router.get('/organizations', getOrganizations);
router.get('/organizations/:id', getOrganizationDetail);
router.patch('/organizations/:id/status', updateOrganizationStatus);
router.post('/organizations/:id/extend-trial', extendOrganizationTrial);
router.get('/users', getPlatformUsers);
router.patch('/users/:id/status', updatePlatformUserStatus);
router.get('/subscriptions', getPlatformSubscriptions);
router.patch('/subscriptions/:id/plan', updateSubscriptionPlan);
router.post('/subscriptions/trigger-reminders', triggerSubscriptionReminders);
router.get('/subscriptions/reminder-logs', getPlatformReminderLogs);
router.get('/audit-logs', getPlatformAuditLogs);
router.get('/health', getPlatformHealth);

export default router;
