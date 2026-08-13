import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
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

router.post('/', authenticate, authorize('receptionist', 'admin'), controller.registerHandler);
router.post(
  '/emergency',
  authenticate,
  authorize('receptionist', 'admin', 'clinician'),
  controller.registerEmergencyHandler,
);
router.patch(
  '/:id/complete-emergency',
  authenticate,
  authorize('receptionist', 'admin'),
  controller.completeEmergencyHandler,
);
router.post(
  '/emergency/flag-overdue',
  authenticate,
  authorize('admin'),
  controller.flagOverdueEmergencyHandler,
);
router.post('/sync', authenticate, authorize('receptionist', 'admin'), controller.syncHandler);

router.get('/:id', authenticate, authorize(...READ_ROLES), controller.getHandler);
router.patch('/:id', authenticate, authorize('receptionist', 'admin'), controller.updateHandler);
router.delete('/:id', authenticate, authorize('admin'), controller.deleteHandler);

export default router;
