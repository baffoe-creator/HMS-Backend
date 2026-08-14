import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './roomBed.controller';

const router = Router();

const ADMIT_ROLES = ['receptionist', 'clinician', 'admin'] as const;
const READ_ROLES = ['receptionist', 'clinician', 'lab_tech', 'admin'] as const;

router.get('/:id', authenticate, authorize(...READ_ROLES), controller.getHandler);
router.post('/:id/admit', authenticate, authorize(...ADMIT_ROLES), controller.admitHandler);
router.post('/:id/discharge', authenticate, authorize(...ADMIT_ROLES), controller.dischargeHandler);

export default router;
