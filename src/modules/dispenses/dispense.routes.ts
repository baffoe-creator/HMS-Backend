import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './dispense.controller';

const router = Router();

router.post('/', authenticate, authorize('pharmacy_tech', 'admin'), controller.createHandler);

export default router;
