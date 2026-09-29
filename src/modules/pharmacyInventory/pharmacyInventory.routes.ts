import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './pharmacyInventory.controller';

const router = Router();

router.post('/', authenticate, authorize('pharmacy_tech', 'admin'), controller.createHandler);
router.get('/low-stock', authenticate, authorize('pharmacy_tech', 'admin'), controller.lowStockHandler);
router.get('/:code', authenticate, authorize('pharmacy_tech', 'admin', 'clinician'), controller.getHandler);

export default router;
