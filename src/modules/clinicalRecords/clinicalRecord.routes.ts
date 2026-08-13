import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './clinicalRecord.controller';

const router = Router();

const READ_ROLES = ['admin', 'clinician', 'lab_tech', 'pharmacy_tech'] as const;

// Step 3.2 gate: write access is clinician-only (plus admin for support/correction).
router.post('/', authenticate, authorize('clinician', 'admin'), controller.createHandler);
router.get('/:id', authenticate, authorize(...READ_ROLES), controller.getHandler);
router.get(
  '/patient/:patientId',
  authenticate,
  authorize(...READ_ROLES),
  controller.patientHistoryHandler,
);

export default router;
