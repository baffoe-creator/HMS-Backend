import { Router } from 'express';
import * as authController from './auth.controller';

const router = Router();

router.post('/login', authController.loginHandler);
router.post('/refresh', authController.refreshHandler);
router.post('/mfa/enroll', authController.mfaEnrollHandler);
router.post('/mfa/confirm', authController.mfaConfirmHandler);
router.post('/mfa/verify', authController.mfaVerifyHandler);

export default router;
