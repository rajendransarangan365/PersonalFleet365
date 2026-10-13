import { Router } from 'express';
import { authLimiter, resetLimiter } from '../../middleware/rateLimit.middleware.js';
import { validate } from '../../middleware/validation.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  SignUpSchema,
  SignInSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '@fleetwise/shared';
import * as AuthController from './auth.controller.js';

const router = Router();

// Public routes
router.post('/signup', authLimiter, validate(SignUpSchema), AuthController.signUp);
router.post('/signin', authLimiter, validate(SignInSchema), AuthController.signIn);
router.post('/refresh', AuthController.refreshTokens);
router.post('/forgot-password', resetLimiter, validate(ForgotPasswordSchema), AuthController.forgotPassword);
router.post('/reset-password', resetLimiter, validate(ResetPasswordSchema), AuthController.resetPassword);
router.post('/send-otp', authLimiter, AuthController.sendOtp);
router.post('/verify-otp', authLimiter, AuthController.verifyOtpHandler);
router.post('/quick-onboarding', authLimiter, AuthController.quickOnboarding);
router.get('/verify-email', AuthController.verifyEmail);

// Protected routes
router.post('/signout', requireAuth, AuthController.signOut);
router.get('/me', requireAuth, AuthController.getMe);
router.post('/change-password', AuthController.changePassword);

export default router;
