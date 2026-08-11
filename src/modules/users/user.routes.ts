import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { updateUserStatusHandler } from './user.controller';

const router = Router();

router.patch('/:id/status', authenticate, authorize('admin'), updateUserStatusHandler);

export default router;
