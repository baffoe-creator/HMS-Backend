import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sensitiveOperationLimiter } from '../../middleware/rateLimiter';
import * as controller from './patient.controller';

const router = Router();

const READ_ROLES = [
  'admin',
  'receptionist',
  'clinician',
  'lab_tech',
  'pharmacy_tech',
  'accountant',
] as const;

// Every route in this router requires auth, so authenticate runs once here
// instead of per-route. This also fixes Phase 7.2's sensitiveOperationLimiter:
// mounted at app.ts level (before this router), it always saw req.user as
// undefined and silently fell back to IP-keyed limiting. Running it here,
// after authenticate, gives it a populated req.user to key on.
router.use(authenticate, sensitiveOperationLimiter);

router.post('/', authorize('receptionist', 'admin'), controller.registerHandler);
router.post(
  '/emergency',
  authorize('receptionist', 'admin', 'clinician'),
  controller.registerEmergencyHandler,
);
router.patch(
  '/:id/complete-emergency',
  authorize('receptionist', 'admin'),
  controller.completeEmergencyHandler,
);
router.post(
  '/emergency/flag-overdue',
  authorize('admin'),
  controller.flagOverdueEmergencyHandler,
);
router.post('/sync', authorize('receptionist', 'admin'), controller.syncHandler);

router.get('/:id', authorize(...READ_ROLES), controller.getHandler);
router.patch('/:id', authorize('receptionist', 'admin'), controller.updateHandler);
router.delete('/:id', authorize('admin'), controller.deleteHandler);

export default router;