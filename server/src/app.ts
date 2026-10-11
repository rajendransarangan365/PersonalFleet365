import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import morgan from 'morgan';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { correlationId } from './middleware/auth.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/validation.middleware.js';
import { generalLimiter } from './middleware/rateLimit.middleware.js';

// Route modules
import authRoutes from './modules/auth/auth.routes.js';
import businessRoutes from './modules/businesses/businesses.routes.js';
import vehicleRoutes from './modules/vehicles/vehicles.routes.js';
import tripRoutes from './modules/trips/trips.routes.js';
import expenseRoutes from './modules/expenses/expenses.routes.js';
import driverRoutes from './modules/drivers/drivers.routes.js';
import simulationRoutes from './modules/simulations/simulations.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import appRoutes from './modules/app/app.routes.js';

export function createApp() {
  const app = express();

  // ─── Trust proxy (for Render / cloud deployments) ──────────────────────────
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // ─── Security headers ──────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
        },
      },
      hsts: env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ─── CORS ──────────────────────────────────────────────────────────────────
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl) in dev
        if (!origin && env.NODE_ENV !== 'production') return callback(null, true);
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS: Origin ${origin} not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Business-Id', 'X-Correlation-Id'],
      exposedHeaders: ['X-Correlation-Id'],
      maxAge: 600, // 10 min preflight cache
    }),
  );

  // ─── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // ─── MongoDB operator injection prevention ─────────────────────────────────
  app.use(mongoSanitize({
    onSanitize: ({ req, key }) => {
      logger.warn('MongoDB injection attempt blocked', { key, ip: req.ip });
    },
  }));

  // ─── Compression ───────────────────────────────────────────────────────────
  app.use(compression());

  // ─── Request logging ───────────────────────────────────────────────────────
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      stream: { write: (msg: string) => logger.http(msg.trim()) },
    }));
  }

  // ─── Correlation ID ────────────────────────────────────────────────────────
  app.use(correlationId);

  // ─── Response header: correlation ID ──────────────────────────────────────
  app.use((req, res, next) => {
    res.setHeader('X-Correlation-Id', req.correlationId ?? '');
    next();
  });

  // ─── Rate limiting ─────────────────────────────────────────────────────────
  app.use('/api', generalLimiter);

  // ─── Health check ──────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
  });

  // ─── API Routes ────────────────────────────────────────────────────────────
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/businesses', businessRoutes);
  app.use('/api/v1/app', appRoutes);

  // Nested vehicle routes under businesses
  app.use('/api/v1/businesses/:businessId/vehicles', vehicleRoutes);
  app.use('/api/v1/businesses/:businessId/trips', tripRoutes);
  app.use('/api/v1/businesses/:businessId/expenses', expenseRoutes);
  app.use('/api/v1/businesses/:businessId/drivers', driverRoutes);
  app.use('/api/v1/businesses/:businessId/simulations', simulationRoutes);
  app.use('/api/v1/businesses/:businessId/analytics', analyticsRoutes);

  // ─── Error handlers ────────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
