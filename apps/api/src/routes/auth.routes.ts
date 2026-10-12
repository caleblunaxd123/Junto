import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';
import { authRateLimit } from '../middleware/authRateLimit';
import { z } from 'zod';
import { removeProfilePhoto, setProfilePhoto } from '../services/profilePhoto.service';

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
// Profile photo shown next to your messages and in your groups (base64 JPEG/PNG, up to 1 MB).
router.put('/me/foto', authMiddleware, async (req, res, next) => {
  try {
    const { imagen } = z.object({ imagen: z.string().min(1) }).strict().parse(req.body ?? {});
    res.json(await setProfilePhoto(req.user!.userId, imagen));
  } catch (error) { next(error); }
});
router.delete('/me/foto', authMiddleware, async (req, res, next) => {
  try { res.json(await removeProfilePhoto(req.user!.userId)); } catch (error) { next(error); }
});
router.get('/me/eliminacion', authMiddleware, authController.deletionSummary);
router.delete('/me', authMiddleware, authRateLimit, authController.deleteAccount);
router.put('/push-token', authMiddleware, authController.updatePushToken);
// Signing out of a phone: it must stop receiving this person's payment and comment notices.
router.delete('/push-token', authMiddleware, authController.clearPushToken);

// /verificar-celulares was removed: it told anyone which phone numbers have a JUNTO account.

export default router;
