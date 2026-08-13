import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './icd.controller';

const router = Router();

const READ_ROLES = ['admin', 'clinician', 'lab_tech', 'pharmacy_tech', 'accountant', 'receptionist'] as const;

router.get('/:code', authenticate, authorize(...READ_ROLES), controller.lookupHandler);
router.get('/:code/versions', authenticate, authorize(...READ_ROLES), controller.versionsHandler);
router.post('/bump-version', authenticate, authorize('admin'), controller.bumpVersionHandler);

export default router;
