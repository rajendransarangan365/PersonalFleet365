import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/auth.service.js';
import { UserModel, BusinessMembershipModel } from '../models/index.js';
import { logger } from '../utils/logger.js';
import type { Permission } from '@fleetwise/shared';

// ─── Extend Express Request ───────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      businessId?: string;
      userPermissions?: Permission[];
      userRole?: string;
      correlationId?: string;
    }
  }
}

// ─── Correlation ID middleware ────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';

export function correlationId(req: Request, _res: Response, next: NextFunction): void {
  req.correlationId = uuidv4();
  next();
}

// ─── JWT authentication middleware ────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required', correlationId: req.correlationId },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch (err) {
    logger.debug('Invalid access token', { error: err, correlationId: req.correlationId });
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token', correlationId: req.correlationId },
    });
  }
}

// ─── Business membership middleware ───────────────────────────────────────────

/**
 * Resolves the businessId from either:
 *   1. req.params.businessId  (explicit in URL)
 *   2. req.headers['x-business-id']  (header from client switcher)
 *
 * Verifies the authenticated user has an active membership in that business.
 * Sets req.businessId, req.userRole and req.userPermissions on success.
 */
export async function requireBusinessMembership(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const businessId = (req.params['businessId'] ?? req.headers['x-business-id']) as string | undefined;

  if (!businessId || !/^[a-f\d]{24}$/i.test(businessId)) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_BUSINESS', message: 'Business context required', correlationId: req.correlationId },
    });
    return;
  }

  try {
    const membership = await BusinessMembershipModel.findOne({
      businessId,
      userId: req.userId,
      isActive: true,
    });

    if (!membership) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied', correlationId: req.correlationId },
      });
      return;
    }

    req.businessId = businessId;
    req.userRole = membership.role;
    req.userPermissions = membership.permissions as Permission[];
    next();
  } catch (err) {
    logger.error('Membership check failed', { error: err, correlationId: req.correlationId });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred', correlationId: req.correlationId },
    });
  }
}

// ─── Permission check ─────────────────────────────────────────────────────────

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const perms = req.userPermissions ?? [];
    const role = req.userRole ?? '';

    // business_owner has all permissions by definition
    if (role === 'business_owner' || role === 'platform_admin') {
      next();
      return;
    }

    if (!perms.includes(permission)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Permission '${permission}' required`,
          correlationId: req.correlationId,
        },
      });
      return;
    }

    next();
  };
}

// ─── User is active check ─────────────────────────────────────────────────────

export async function requireActiveUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  const user = await UserModel.findById(req.userId).select('isActive emailVerified');
  if (!user || !user.isActive) {
    res.status(403).json({ success: false, error: { code: 'ACCOUNT_DISABLED', message: 'Account is disabled' } });
    return;
  }

  next();
}
