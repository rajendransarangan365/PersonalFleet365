import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// ─── General API rate limiter ─────────────────────────────────────────────────

export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
  },
  skip: () => env.NODE_ENV === 'test',
});

// ─── Auth endpoints rate limiter (strict) ─────────────────────────────────────

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 sign-in attempts per 15 min per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again in 15 minutes.' },
  },
  skip: () => env.NODE_ENV === 'test',
});

// ─── Password reset limiter ───────────────────────────────────────────────────

export const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many reset requests. Try again in an hour.' },
  },
  skip: () => env.NODE_ENV === 'test',
});

// ─── Export / report limiter ──────────────────────────────────────────────────

export const exportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many export requests.' },
  },
  skip: () => env.NODE_ENV === 'test',
});
