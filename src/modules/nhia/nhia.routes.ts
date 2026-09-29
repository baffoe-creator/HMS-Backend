import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './nhia.controller';

const router = Router();

const CLAIMS_ROLES = ['accountant', 'admin'] as const;

router.get(
  '/claims/:claimId/xml',
  authenticate,
  authorize(...CLAIMS_ROLES),
  controller.generateClaimXmlHandler,
);
router.get(
  '/claims/:claimId/validate',
  authenticate,
  authorize(...CLAIMS_ROLES),
  controller.validateClaimHandler,
);
router.post('/batches', authenticate, authorize(...CLAIMS_ROLES), controller.generateBatchXmlHandler);
router.post('/feedback', authenticate, authorize('admin'), controller.uploadFeedbackHandler);

export default router;
