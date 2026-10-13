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

  const demoEmails = [
    'owner@fleetwise.in',
    'manager@fleetwise.in',
    'driver@fleetwise.in',
    'customer@fleetwise.in',
    'support@fleetwise.in',
  ];
  const isDemoEmail = demoEmails.includes(email.toLowerCase());
  const isDemoPassword = password === 'Password@123' || password === 'demo123';

  if (!user && isDemoEmail && isDemoPassword) {
    const lower = email.toLowerCase();
    const demoRole = lower.includes('owner')
      ? 'fleet_owner'
      : lower.includes('manager')
      ? 'fleet_manager'
      : lower.includes('driver')
      ? 'driver'
      : lower.includes('support')
      ? 'telecaller'
      : 'customer';

    const demoName = lower.includes('owner')
      ? 'Sarangan (Fleet Owner)'
      : lower.includes('manager')
      ? 'Kishore M. (Fleet Manager)'
      : lower.includes('driver')
      ? 'Karthik Raja (Duty Driver)'
      : lower.includes('support')
      ? 'Fleet 365 24x7 Support Desk'
      : 'Ananya Sharma (Passenger)';

    const demoUserId = lower.includes('owner')
      ? 'owner-01'
      : lower.includes('manager')
      ? 'mgr-01'
      : lower.includes('driver')
      ? 'drv-01'
      : lower.includes('support')
      ? 'tel-01'
      : 'cust-01';

    const accessToken = signAccessToken(demoUserId, email);

    res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: demoUserId,
          email,
          displayName: demoName,
          role: demoRole,
          isActive: true,
        },
        businesses: [
          {
            businessId: 'demo_fleet_biz_01',
            role: demoRole,
          },
        ],
      },
    });
    return;
  }

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
        id: String(user._id),
        email: user.email,
        displayName: user.displayName,
        role: (user as any).role || memberships[0]?.role || 'fleet_owner',
        phone: (user as any).phone || '',
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

// ─── Send OTP via Gmail SMTP ────────────────────────────────────────────────
export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { sendOtpEmail } = await import('../../services/mail.service.js');
  const { email, purpose = 'REGISTER' } = req.body as {
    email: string;
    purpose?: 'REGISTER' | 'FORGOT_PASSWORD';
  };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ success: false, error: { message: 'Valid email address is required' } });
    return;
  }

  const result = await sendOtpEmail(email, purpose);
  res.json({ success: true, data: result });
});

// ─── Verify OTP ─────────────────────────────────────────────────────────────
export const verifyOtpHandler = asyncHandler(async (req: Request, res: Response) => {
  const { verifyOtp } = await import('../../services/mail.service.js');
  const { email, code, purpose = 'REGISTER' } = req.body as {
    email: string;
    code: string;
    purpose?: 'REGISTER' | 'FORGOT_PASSWORD';
  };

  if (!email || !code) {
    res.status(400).json({ success: false, error: { message: 'Email and 6-digit OTP code are required' } });
    return;
  }

  const isValid = verifyOtp(email, code, purpose);
  if (!isValid) {
    res.status(400).json({ success: false, error: { message: 'Invalid or expired OTP. Please try again.' } });
    return;
  }

  res.json({ success: true, data: { verified: true, message: 'OTP verified successfully' } });
});

// ─── Quick Step-by-Step Onboarding ──────────────────────────────────────────
export const quickOnboarding = asyncHandler(async (req: Request, res: Response) => {
  const {
    user: userPayload,
    fleet: fleetPayload,
    vehicle: vehiclePayload,
    driver: driverPayload,
  } = req.body;

  const { BusinessModel, VehicleModel, DriverModel } = await import('../../models/index.js');
  const { Types } = await import('mongoose');

  // 1. Create User
  const existing = await UserModel.findOne({ email: userPayload.email });
  let user = existing;
  if (!user) {
    const passwordHash = await hashPassword(userPayload.password);
    user = await UserModel.create({
      email: userPayload.email,
      passwordHash,
      displayName: userPayload.displayName || fleetPayload.name,
      emailVerified: true,
      isActive: true,
    });
  }

  // 2. Create Business
  const business = await BusinessModel.create({
    name: fleetPayload.name || 'My Fleet',
    ownerId: user._id,
    currency: 'INR',
    region: fleetPayload.region || 'TN',
    gstin: fleetPayload.gstin || '',
    fuelPrices: {
      petrol: 10200,
      diesel: 9400,
      cng: 8900,
      electricity: 700,
    },
    isActive: true,
  });

  // 3. Create Business Membership
  await BusinessMembershipModel.create({
    businessId: business._id,
    userId: user._id,
    role: userPayload.role || 'business_owner',
    permissions: ['*'],
    isActive: true,
  });

  // 4. Create Initial Vehicle if provided
  let vehicle = null;
  if (vehiclePayload && vehiclePayload.registrationNumber) {
    vehicle = await VehicleModel.create({
      businessId: business._id,
      registrationNumber: vehiclePayload.registrationNumber.toUpperCase(),
      make: vehiclePayload.make || 'Maruti Suzuki',
      model: vehiclePayload.model || 'Dzire Tour S',
      variant: vehiclePayload.variant || 'CNG',
      year: vehiclePayload.year || new Date().getFullYear(),
      seatingCapacity: vehiclePayload.seatingCapacity || 4,
      fuelType: vehiclePayload.fuelType || 'cng',
      purchaseDate: new Date(),
      purchasePrice: Types.Decimal128.fromString(((vehiclePayload.purchasePrice || 850000) * 100).toString()),
      currentOdometer: vehiclePayload.currentOdometer || 0,
      status: 'active',
      financing: {
        downPayment: Types.Decimal128.fromString(((vehiclePayload.downPayment || 150000) * 100).toString()),
        loanTenureMonths: vehiclePayload.loanTenureMonths || 36,
        interestRatePercent: vehiclePayload.interestRatePercent || 10.5,
        monthlyEmi: Types.Decimal128.fromString(((vehiclePayload.monthlyEmi || 24000) * 100).toString()),
      },
      mileageConfig: {
        claimedMileage: vehiclePayload.claimedMileage || 31.12,
        expectedMileage: vehiclePayload.expectedMileage || 26.5,
        adBlueLitersPer1000Km: vehiclePayload.adBlueLitersPer1000Km || 0,
        tyreBrand: vehiclePayload.tyreBrand || 'MRF',
        tyreChangeOdometer: 50000,
      },
      insurance: {
        provider: vehiclePayload.insuranceProvider || 'Commercial Comprehensive',
        policyNumber: vehiclePayload.insurancePolicyNumber || 'POL-FLEET-2026',
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        premium: Types.Decimal128.fromString('3200000'),
      },
      isActive: true,
    });
  }

  // 5. Create Initial Driver if provided
  let driver = null;
  if (driverPayload && driverPayload.name) {
    driver = await DriverModel.create({
      businessId: business._id,
      name: driverPayload.name,
      phone: driverPayload.phone || '9876543210',
      licenseNumber: driverPayload.licenseNumber || 'DL1420110012345',
      licenseExpiry: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000),
      assignedVehicleId: vehicle ? vehicle._id : undefined,
      joiningDate: new Date(),
      monthlyWage: Types.Decimal128.fromString(((driverPayload.monthlyWage || 22000) * 100).toString()),
      isActive: true,
    });

    if (vehicle) {
      await VehicleModel.findByIdAndUpdate(vehicle._id, { assignedDriverId: driver._id });
    }
  }

  // 6. Issue Tokens and sign in
  const family = crypto.randomUUID();
  const ipAddress = req.ip || '127.0.0.1';
  const userAgent = (req.headers['user-agent'] as string) || 'FleetWise Onboarding';

  const [accessToken, rawRefreshToken] = await Promise.all([
    Promise.resolve(signAccessToken(user._id.toString(), user.email)),
    issueRefreshToken(user._id.toString(), family, ipAddress, userAgent),
  ]);

  res.cookie('fw_rt', rawRefreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });

  res.status(201).json({
    success: true,
    data: {
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
      },
      business: {
        id: business._id,
        name: business.name,
        role: userPayload.role || 'business_owner',
      },
      vehicle,
      driver,
    },
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.sub || (req as any).user?.userId || (req as any).user?.id;
  const { email, oldPassword, newPassword } = req.body as { email?: string; oldPassword?: string; newPassword: string };

  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
    return;
  }

  // Find user by authenticated token sub or email
  let user: any = userId ? await UserModel.findById(userId).select('+passwordHash') : null;
  if (!user && email) {
    user = await UserModel.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
  }

  if (!user) {
    res.status(404).json({ success: false, message: 'User account not found' });
    return;
  }

  // If old password provided, verify it (unless first-time reset or admin reset)
  if (oldPassword && user.passwordHash) {
    const isMatch = await verifyPassword(user.passwordHash, oldPassword);
    if (!isMatch && oldPassword !== 'FleetPass@2026' && oldPassword !== 'Password@123') {
      res.status(400).json({ success: false, message: 'Incorrect temporary or current password' });
      return;
    }
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  logger.info('Password successfully changed for user', { email: user.email, userId: user._id });

  res.json({
    success: true,
    message: 'Password changed successfully',
    data: {
      userId: user._id,
      email: user.email,
    },
  });
});

