import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { UserModel, RefreshTokenModel } from '../models/index.js';
import { logger } from '../utils/logger.js';
import type { IUser } from '../models/index.js';

// ─── Password hashing (Argon2id) ──────────────────────────────────────────────

export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

// ─── JWT tokens ───────────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub: string;     // userId
  email: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  family: string;
  type: 'refresh';
}

export function signAccessToken(userId: string, email: string): string {
  const payload: AccessTokenPayload = { sub: userId, email, type: 'access' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: 'fleetwise',
    audience: 'fleetwise-client',
  } as any);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'fleetwise',
    audience: 'fleetwise-client',
  }) as AccessTokenPayload;
}

export function signRefreshToken(userId: string, family: string): string {
  const payload: RefreshTokenPayload = { sub: userId, family, type: 'refresh' };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: 'fleetwise',
    audience: 'fleetwise-client',
  } as any);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: 'fleetwise',
    audience: 'fleetwise-client',
  }) as RefreshTokenPayload;
}

/** Hash a raw token before storing it (SHA-256 is sufficient for random tokens) */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/** Generate a cryptographically random URL-safe token */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

// ─── Refresh token rotation ───────────────────────────────────────────────────

const REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function issueRefreshToken(
  userId: string,
  family: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<string> {
  const rawToken = signRefreshToken(userId, family);
  const tokenHash = hashToken(rawToken);

  await RefreshTokenModel.create({
    userId: new Types.ObjectId(userId),
    tokenHash,
    family,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS),
    ipAddress,
    userAgent,
  });

  return rawToken;
}

export async function rotateRefreshToken(
  rawToken: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ accessToken: string; refreshToken: string; userId: string } | null> {
  let payload: RefreshTokenPayload;

  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const existingToken = await RefreshTokenModel.findOne({ tokenHash }).select('+tokenHash');

  if (!existingToken) {
    logger.warn('Refresh token not found — possible theft', { family: payload.family });
    return null;
  }

  if (existingToken.isRevoked) {
    // Reuse detected — revoke entire family
    logger.warn('Refresh token reuse detected — revoking family', { family: payload.family });
    await RefreshTokenModel.updateMany({ family: payload.family }, { isRevoked: true });
    return null;
  }

  if (existingToken.expiresAt < new Date()) {
    return null;
  }

  // Revoke old token
  existingToken.isRevoked = true;
  await existingToken.save();

  const user = await UserModel.findById(payload.sub);
  if (!user || !user.isActive) return null;

  // Issue new pair
  const newFamily = payload.family; // same family for rotation chain
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload.sub, user.email),
    issueRefreshToken(payload.sub, newFamily, ipAddress, userAgent),
  ]);

  return { accessToken, refreshToken, userId: payload.sub };
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await RefreshTokenModel.updateMany(
    { userId: new Types.ObjectId(userId), isRevoked: false },
    { isRevoked: true },
  );
}

// ─── Account lockout ──────────────────────────────────────────────────────────

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function recordFailedLogin(user: IUser): Promise<void> {
  const attempts = (user.failedLoginAttempts ?? 0) + 1;
  const update: Partial<IUser> = { failedLoginAttempts: attempts };

  if (attempts >= MAX_FAILED_ATTEMPTS) {
    update.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
    logger.warn('Account locked due to failed attempts', { userId: user._id });
  }

  await UserModel.updateOne({ _id: user._id }, update);
}

export function isAccountLocked(user: IUser): boolean {
  return !!(user.lockedUntil && user.lockedUntil > new Date());
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await UserModel.updateOne(
    { _id: userId },
    { failedLoginAttempts: 0, lockedUntil: undefined, lastLoginAt: new Date() },
  );
}
