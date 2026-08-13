import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './prescription.controller';

const router = Router();

router.post('/', authenticate, authorize('clinician', 'admin'), controller.createHandler);

export default router;
