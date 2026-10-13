import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { logger } from '../utils/logger.js';

// ─── Zod request validation ───────────────────────────────────────────────────

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!schema || typeof schema.safeParse !== 'function') {
      return next();
    }

    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        if (!fields[path]) fields[path] = [];
        fields[path]!.push(issue.message);
      }

      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fields,
          correlationId: req.correlationId,
        },
      });
      return;
    }

    // Replace the request part with parsed (coerced, trimmed) values
    req[part] = result.data;
    next();
  };
}

// ─── Global error handler ─────────────────────────────────────────────────────

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const correlationId = req.correlationId;

  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', correlationId },
    });
    return;
  }

  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    correlationId,
    path: req.path,
    method: req.method,
  });

  // Never expose internal error details to clients in production
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message || 'An internal error occurred',
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      correlationId,
    },
  });
}

// ─── Not found handler ────────────────────────────────────────────────────────

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      correlationId: req.correlationId,
    },
  });
}

// ─── Async wrapper ────────────────────────────────────────────────────────────

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
