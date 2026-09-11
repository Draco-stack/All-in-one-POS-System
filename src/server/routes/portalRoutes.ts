import { Router } from 'express';
import { authenticate, requireTenant } from '../middleware/auth';
import { requireCustomerPortalAccess } from '../middleware/subscriptionMiddleware';
import {
  getPortalOverview,
  getPortalSubscription,
  upgradePortalSubscription,
  getPortalRestaurant,
  getPortalTeam,
  getPortalDevices,
  getPortalSessions,
  revokePortalSession,
} from '../controllers/portalController';

const router = Router();

// ============================================================================
// CUSTOMER / RESTAURANT OWNER PORTAL ROUTES
// Enforces tenant isolation, verified tenant context, and administrative authorization.
// ============================================================================
router.use(authenticate);
router.use(requireTenant);
router.use(requireCustomerPortalAccess);

router.get('/overview', getPortalOverview);
router.get('/subscription', getPortalSubscription);
router.post('/subscription/upgrade', upgradePortalSubscription);
router.get('/restaurant', getPortalRestaurant);
router.get('/team', getPortalTeam);
router.get('/devices', getPortalDevices);
router.get('/sessions', getPortalSessions);
router.post('/sessions/revoke', revokePortalSession);

export default router;
