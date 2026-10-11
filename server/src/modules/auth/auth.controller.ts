import type { Request, Response } from 'express';
import crypto from 'crypto';
import { UserModel, BusinessMembershipModel, RefreshTokenModel } from '../../models/index.js';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllUserSessions,
  recordFailedLogin,
  isAccountLocked,
  clearFailedLogins,
  generateSecureToken,
  hashToken,
  verifyRefreshToken,
} from '../../services/auth.service.js';
import { logger } from '../../utils/logger.js';
import { asyncHandler } from '../../middleware/validation.middleware.js';
import { env } from '../../config/env.js';

// ─── Sign Up ──────────────────────────────────────────────────────────────────

export const signUp = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, displayName } = req.body as {
    email: string;
    password: string;
    displayName: string;
  };

  // Check if email already registered (do not reveal which field caused failure)
  const existing = await UserModel.findOne({ email });
  if (existing) {
    // Use same response as success to prevent email enumeration
    res.status(201).json({
      success: true,
      data: { message: 'If that email is new, a verification link has been sent.' },
    });
    return;
  }

  const passwordHash = await hashPassword(password);
  const verificationToken = generateSecureToken();
  const tokenHash = hashToken(verificationToken);

  const user = await UserModel.create({
    email,
    passwordHash,
    displayName,
    emailVerificationToken: tokenHash,
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
  });

  // TODO: send email in Phase 6 when email provider is configured
  logger.info('User registered', { userId: user._id, email: user.email });

  // In development, return token for easy testing
  if (env.NODE_ENV === 'development') {
    logger.debug('Email verification token (DEV ONLY)', { token: verificationToken });
  }

  res.status(201).json({
    success: true,
    data: {
      message: 'Account created. Please check your email to verify your account.',
      ...(env.NODE_ENV === 'development' ? { _devVerificationToken: verificationToken } : {}),
    },
  });
});

// ─── Verify Email ─────────────────────────────────────────────────────────────

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };

  if (!token || typeof token !== 'string') {
    res.status(400).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid verification link' } });
    return;
  }

  const tokenHash = hashToken(token);
  const user = await UserModel.findOne({
    emailVerificationToken: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user) {
    res.status(400).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired verification link' } });
    return;
  }

  await UserModel.updateOne(
    { _id: user._id },
    {
      emailVerified: true,
      $unset: { emailVerificationToken: 1, emailVerificationExpires: 1 },
    },
  );

  logger.info('Email verified', { userId: user._id });
  res.json({ success: true, data: { message: 'Email verified successfully. You can now sign in.' } });
});

// ─── Sign In ──────────────────────────────────────────────────────────────────

const GENERIC_AUTH_ERROR = {
  success: false,
  error: { code: 'AUTH_FAILED', message: 'Invalid email or password' },
};

export const signIn = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  const user = await UserModel.findOne({ email }).select(
    '+passwordHash +failedLoginAttempts +lockedUntil',
  );

  // Constant-time: still check password even if user not found (but discard result)
  const dummyHash =
    '$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy';
  const passwordHash = user?.passwordHash ?? dummyHash;
  const passwordMatch = await verifyPassword(passwordHash, password);

  if (!user || !passwordMatch) {
    if (user) await recordFailedLogin(user);
    res.status(401).json(GENERIC_AUTH_ERROR);
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ success: false, error: { code: 'ACCOUNT_DISABLED', message: 'Account is disabled' } });
    return;
  }

  if (isAccountLocked(user)) {
    res.status(429).json({
      success: false,
      error: { code: 'ACCOUNT_LOCKED', message: 'Account temporarily locked. Try again later.' },
    });
    return;
  }

  await clearFailedLogins(String(user._id));

  const userId = String(user._id);
  const family = crypto.randomBytes(16).toString('hex');
  const ipAddress = req.ip;
  const userAgent = req.get('user-agent');

  const [accessToken, refreshToken] = await Promise.all([
    Promise.resolve(signAccessToken(userId, user.email)),
    issueRefreshToken(userId, family, ipAddress, userAgent),
  ]);

  // Store refresh token in HttpOnly cookie
  res.cookie('fw_rt', refreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });

  // Get user's businesses
  const memberships = await BusinessMembershipModel.find({
    userId: user._id,
    isActive: true,
  }).select('businessId role');

  logger.info('User signed in', { userId });

  res.json({
    success: true,
    data: {
      accessToken,
      user: {
        _id: user._id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
      },
      businesses: memberships.map((m) => ({ businessId: m.businessId, role: m.role })),
    },
  });
});

// ─── Refresh Tokens ───────────────────────────────────────────────────────────

export const refreshTokens = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies['fw_rt'] as string | undefined;

  if (!rawToken) {
    res.status(401).json({ success: false, error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token missing' } });
    return;
  }

  const result = await rotateRefreshToken(rawToken, req.ip, req.get('user-agent'));

  if (!result) {
    res.clearCookie('fw_rt', { path: '/api/v1/auth' });
    res.status(401).json({ success: false, error: { code: 'TOKEN_INVALID', message: 'Session expired. Please sign in again.' } });
    return;
  }

  res.cookie('fw_rt', result.refreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });

  res.json({ success: true, data: { accessToken: result.accessToken } });
});

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export const signOut = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies['fw_rt'] as string | undefined;

  if (rawToken) {
    try {
      const payload = verifyRefreshToken(rawToken);
      await RefreshTokenModel.updateMany({ family: payload.family }, { isRevoked: true });
    } catch {
      // Token already invalid — still clear cookie
    }
  }

  res.clearCookie('fw_rt', { path: '/api/v1/auth' });
  logger.info('User signed out', { userId: req.userId });
  res.json({ success: true, data: { message: 'Signed out successfully' } });
});

// ─── Forgot Password ──────────────────────────────────────────────────────────

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };

  // Always return success to prevent email enumeration
  const GENERIC_RESPONSE = {
    success: true,
    data: { message: 'If that email is registered, a password reset link has been sent.' },
  };

  const user = await UserModel.findOne({ email });
  if (!user) {
    res.json(GENERIC_RESPONSE);
    return;
  }

  const resetToken = generateSecureToken();
  const tokenHash = hashToken(resetToken);

  await UserModel.updateOne(
    { _id: user._id },
    {
      passwordResetToken: tokenHash,
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  );

  // TODO: send email in Phase 6
  if (env.NODE_ENV === 'development') {
    logger.debug('Password reset token (DEV ONLY)', { token: resetToken, email });
  }

  res.json(GENERIC_RESPONSE);
});

// ─── Reset Password ───────────────────────────────────────────────────────────

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body as { token: string; password: string };

  const tokenHash = hashToken(token);
  const user = await UserModel.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    res.status(400).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset link' } });
    return;
  }

  const passwordHash = await hashPassword(password);

  await UserModel.updateOne(
    { _id: user._id },
    {
      passwordHash,
      $unset: { passwordResetToken: 1, passwordResetExpires: 1 },
    },
  );

  // Revoke all sessions after password reset
  await revokeAllUserSessions(String(user._id));

  logger.info('Password reset', { userId: user._id });
  res.json({ success: true, data: { message: 'Password reset successfully. Please sign in with your new password.' } });
});

// ─── Get Current User ─────────────────────────────────────────────────────────

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.userId).select(
    '_id email displayName emailVerified mfaEnabled isActive lastLoginAt createdAt',
  );

  if (!user) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const memberships = await BusinessMembershipModel.find({
    userId: user._id,
    isActive: true,
  })
    .populate('businessId', 'name currency region')
    .select('businessId role permissions joinedAt');

  res.json({
    success: true,
    data: {
      user,
      memberships,
    },
  });
});
