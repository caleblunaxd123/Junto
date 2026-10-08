import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';
import { authRateLimit } from '../middleware/authRateLimit';

const router = Router();
router.use((req, res, next) => req.method === 'POST' && !['/refresh', '/logout'].includes(req.path) ? authRateLimit(req, res, next) : next());

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.google);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.get('/me', authMiddleware, authController.me);
router.patch('/me', authMiddleware, authController.updateProfile);
router.get('/me/eliminacion', authMiddleware, authController.deletionSummary);
router.delete('/me', authMiddleware, authRateLimit, authController.deleteAccount);
router.put('/push-token', authMiddleware, authController.updatePushToken);

// /verificar-celulares was removed: it told anyone which phone numbers have a JUNTO account.

export default router;
