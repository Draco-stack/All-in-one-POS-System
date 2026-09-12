import { Router } from 'express';
import { authenticate, requireTenant, requirePermission } from '../middleware/auth';
import { requireActiveSubscription } from '../middleware/subscriptionMiddleware';
import { RESTAURANT_PERMISSIONS } from '../auth/permissions';
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

router.use(authenticate);
router.use(requireTenant);
router.use(requireActiveSubscription);

// Approval Requests
router.post('/approvals', createApprovalRequestHandler);
router.get('/approvals', getApprovalRequestsHandler);
router.get('/approvals/:id', getApprovalRequestByIdHandler);
router.post('/approvals/:id/approve', requirePermission(RESTAURANT_PERMISSIONS.APPROVALS_APPROVE), processApprovalRequestHandler);
router.post('/approvals/:id/reject', requirePermission(RESTAURANT_PERMISSIONS.APPROVALS_APPROVE), processApprovalRequestHandler);
router.post('/approvals/:id/process', requirePermission(RESTAURANT_PERMISSIONS.APPROVALS_APPROVE), processApprovalRequestHandler);
router.post('/approvals/:id/cancel', cancelApprovalRequestHandler);

// Cash Movements & Audits
router.post('/cash/movements', createCashMovementHandler);
router.post('/cash/in', createCashMovementHandler);
router.post('/cash/out', createCashMovementHandler);
router.get('/cash/movements', getCashMovementsHandler);
router.post('/cash/audit', requirePermission(RESTAURANT_PERMISSIONS.CASH_AUDIT), conductCashAuditHandler);
router.get('/cash/audits', getCashAuditsHandler);
router.post('/cash/variance-resolution', requirePermission(RESTAURANT_PERMISSIONS.APPROVALS_APPROVE), resolveVarianceHandler);

export default router;
