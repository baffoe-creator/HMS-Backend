import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './labOrder.controller';

const router = Router();

const READ_ROLES = ['admin', 'clinician', 'lab_tech'] as const;

router.post('/', authenticate, authorize('clinician', 'admin'), controller.createHandler);
router.get('/:id', authenticate, authorize(...READ_ROLES), controller.getHandler);
router.patch(
  '/:id/status',
  authenticate,
  authorize('lab_tech', 'admin'),
  controller.updateStatusHandler,
);

export default router;
