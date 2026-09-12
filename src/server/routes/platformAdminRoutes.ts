import { Router } from 'express';
import { authenticate, requirePlatformAdmin } from '../middleware/auth';
import {
  getPlatformOverview,
  getOrganizations,
  getOrganizationDetail,
  updateOrganizationStatus,
  updateOrganizationDetails,
  extendOrganizationTrial,
  getPlatformUsers,
  createPlatformUser,
  updatePlatformUser,
  deletePlatformUser,
  resetPlatformUserPassword,
  revokePlatformUserSessions,
  updatePlatformUserStatus,
  getPlatformBranches,
  createPlatformBranch,
  updatePlatformBranch,
  deletePlatformBranch,
  getPlatformDevices,
  revokePlatformDevice,
  reactivatePlatformDevice,
  deletePlatformDevice,
  getPlatformSubscriptions,
  updateSubscriptionPlan,
  triggerSubscriptionReminders,
  getPlatformReminderLogs,
  getPlatformAuditLogs,
  getPlatformHealth,
  getPlatformOrders,
  getPlatformCustomers,
  getPlatformShifts,
  searchPlatform,
  startSupportSession,
  endSupportSession,
} from '../controllers/platformAdminController';

const router = Router();

// ============================================================================
// STRICT SECURITY BOUNDARY:
// All platform-admin routes require active authentication + PLATFORM_ADMIN / EXECUTIVE_ADMIN role.
// Restaurant-level users (OWNER, MANAGER, CASHIER) are strictly rejected with 403 Forbidden.
// ============================================================================
router.use(authenticate);
router.use(requirePlatformAdmin);

// Overview & Health
router.get('/overview', getPlatformOverview);
router.get('/health', getPlatformHealth);

// Global Platform Search
router.get('/search', searchPlatform);

// Organizations
router.get('/organizations', getOrganizations);
router.get('/organizations/:id', getOrganizationDetail);
router.patch('/organizations/:id', updateOrganizationDetails);
router.patch('/organizations/:id/status', updateOrganizationStatus);
router.post('/organizations/:id/extend-trial', extendOrganizationTrial);

// Branches across all organizations
router.get('/branches', getPlatformBranches);
router.post('/branches', createPlatformBranch);
router.patch('/branches/:id', updatePlatformBranch);
router.delete('/branches/:id', deletePlatformBranch);

// Users across all organizations & platform
router.get('/users', getPlatformUsers);
router.post('/users', createPlatformUser);
router.patch('/users/:id', updatePlatformUser);
router.delete('/users/:id', deletePlatformUser);
router.patch('/users/:id/status', updatePlatformUserStatus);
router.post('/users/:id/reset-password', resetPlatformUserPassword);
router.post('/users/:id/revoke-sessions', revokePlatformUserSessions);

// Devices (POS, KDS, Tablets) across all restaurants
router.get('/devices', getPlatformDevices);
router.post('/devices/:id/revoke', revokePlatformDevice);
router.post('/devices/:id/reactivate', reactivatePlatformDevice);
router.delete('/devices/:id', deletePlatformDevice);

// Subscriptions & Billing
router.get('/subscriptions', getPlatformSubscriptions);
router.patch('/subscriptions/:id/plan', updateSubscriptionPlan);
router.post('/subscriptions/trigger-reminders', triggerSubscriptionReminders);
router.get('/subscriptions/reminder-logs', getPlatformReminderLogs);

// Operational Visibility (Read-Only Support / Debugging)
router.get('/orders', getPlatformOrders);
router.get('/customers', getPlatformCustomers);
router.get('/shifts', getPlatformShifts);

// Audited Support Viewing Sessions ("View as Restaurant")
router.post('/support-session/start', startSupportSession);
router.post('/support-session/end', endSupportSession);

// Platform Audit Logs
router.get('/audit-logs', getPlatformAuditLogs);

export default router;

