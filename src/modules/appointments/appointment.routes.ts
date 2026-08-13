import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './appointment.controller';

const router = Router();

router.post('/', authenticate, authorize('receptionist', 'admin'), controller.bookHandler);
router.get(
  '/availability',
  authenticate,
  authorize('receptionist', 'admin', 'clinician'),
  controller.availabilityHandler,
);

export default router;
