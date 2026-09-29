import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './billing.controller';

const router = Router();

const BILLING_ROLES = ['accountant', 'receptionist', 'admin'] as const;

router.post('/', authenticate, authorize(...BILLING_ROLES), controller.createHandler);
router.get('/:id', authenticate, authorize(...BILLING_ROLES), controller.getHandler);

export default router;
