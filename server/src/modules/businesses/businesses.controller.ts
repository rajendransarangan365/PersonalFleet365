import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { BusinessModel, BusinessMembershipModel, AuditEventModel } from '../../models/index.js';
import { asyncHandler } from '../../middleware/validation.middleware.js';
import { logger } from '../../utils/logger.js';

// Default permissions per role
const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  business_owner: [
    'vehicle.read', 'vehicle.create', 'vehicle.update', 'vehicle.delete',
    'trip.read', 'trip.create', 'trip.update', 'trip.cancel',
    'expense.read', 'expense.create', 'expense.approve',
    'finance.read', 'finance.export',
    'maintenance.manage', 'users.manage', 'reports.view',
    'contract.read', 'contract.create', 'contract.update',
    'driver.read', 'driver.create', 'driver.update',
  ],
  fleet_manager: [
    'vehicle.read', 'vehicle.update',
    'trip.read', 'trip.create', 'trip.update', 'trip.cancel',
    'expense.read', 'expense.create',
    'maintenance.manage', 'reports.view',
    'contract.read', 'driver.read', 'driver.update',
  ],
  accountant: [
    'expense.read', 'expense.create', 'expense.approve',
    'finance.read', 'finance.export', 'reports.view',
    'trip.read', 'vehicle.read', 'contract.read',
  ],
  dispatcher: [
    'trip.read', 'trip.create', 'trip.update', 'trip.cancel',
    'vehicle.read', 'driver.read', 'contract.read',
  ],
  driver: [
    'trip.read', 'trip.create', 'trip.update',
  ],
  auditor: [
    'vehicle.read', 'trip.read', 'expense.read', 'finance.read', 'reports.view',
    'contract.read', 'driver.read',
  ],
};

// ─── Create Business ──────────────────────────────────────────────────────────

export const createBusiness = asyncHandler(async (req: Request, res: Response) => {
  const { name, region = 'TN', country = 'IN', settings } = req.body as {
    name: string;
    region?: string;
    country?: string;
    settings?: { workingDaysPerMonth?: number; emergencyReserveTarget?: number };
  };

  const business = await BusinessModel.create({
    name,
    ownerId: new Types.ObjectId(req.userId!),
    region,
    country,
    settings: {
      workingDaysPerMonth: settings?.workingDaysPerMonth ?? 25,
      emergencyReserveTarget: settings?.emergencyReserveTarget ?? 0,
    },
  });

  // Create owner membership
  await BusinessMembershipModel.create({
    businessId: business._id,
    userId: new Types.ObjectId(req.userId!),
    role: 'business_owner',
    permissions: ROLE_DEFAULT_PERMISSIONS['business_owner'],
    joinedAt: new Date(),
  });

  // Audit log
  await AuditEventModel.create({
    actorUserId: new Types.ObjectId(req.userId!),
    eventType: 'business.created',
    entityType: 'Business',
    entityId: business._id,
    afterSnapshot: { name, region, country },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  logger.info('Business created', { businessId: business._id, userId: req.userId });

  res.status(201).json({ success: true, data: { business } });
});

// ─── List My Businesses ───────────────────────────────────────────────────────

export const listMyBusinesses = asyncHandler(async (req: Request, res: Response) => {
  const memberships = await BusinessMembershipModel.find({
    userId: new Types.ObjectId(req.userId!),
    isActive: true,
  })
    .populate('businessId')
    .select('businessId role permissions joinedAt');

  res.json({
    success: true,
    data: {
      businesses: memberships
        .filter((m) => m.businessId) // populated
        .map((m) => ({
          business: m.businessId,
          role: m.role,
          permissions: m.permissions,
          joinedAt: m.joinedAt,
        })),
    },
  });
});

// ─── Get Business ─────────────────────────────────────────────────────────────

export const getBusiness = asyncHandler(async (req: Request, res: Response) => {
  const { businessId } = req.params as { businessId: string };

  // Verify membership
  const membership = await BusinessMembershipModel.findOne({
    businessId: new Types.ObjectId(businessId),
    userId: new Types.ObjectId(req.userId!),
    isActive: true,
  });

  if (!membership) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
    return;
  }

  const business = await BusinessModel.findById(businessId);
  if (!business || !business.isActive) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Business not found' } });
    return;
  }

  res.json({ success: true, data: { business, role: membership.role, permissions: membership.permissions } });
});

// ─── Update Business ──────────────────────────────────────────────────────────

export const updateBusiness = asyncHandler(async (req: Request, res: Response) => {
  const { businessId } = req.params as { businessId: string };

  // Only business_owner can update
  const membership = await BusinessMembershipModel.findOne({
    businessId: new Types.ObjectId(businessId),
    userId: new Types.ObjectId(req.userId!),
    role: 'business_owner',
    isActive: true,
  });

  if (!membership) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the business owner can update settings' } });
    return;
  }

  const business = await BusinessModel.findById(businessId);
  if (!business) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Business not found' } });
    return;
  }

  const before = business.toObject();

  // Allowlist updates
  const { name, region, country, settings } = req.body as {
    name?: string;
    region?: string;
    country?: string;
    settings?: { workingDaysPerMonth?: number; emergencyReserveTarget?: number };
  };

  if (name !== undefined) business.name = name;
  if (region !== undefined) business.region = region;
  if (country !== undefined) business.country = country;
  if (settings?.workingDaysPerMonth !== undefined) {
    business.settings.workingDaysPerMonth = settings.workingDaysPerMonth;
  }
  if (settings?.emergencyReserveTarget !== undefined) {
    business.settings.emergencyReserveTarget = settings.emergencyReserveTarget;
  }

  await business.save();

  await AuditEventModel.create({
    businessId: new Types.ObjectId(businessId),
    actorUserId: new Types.ObjectId(req.userId!),
    eventType: 'business.updated',
    entityType: 'Business',
    entityId: business._id,
    beforeSnapshot: { name: before.name, region: before.region },
    afterSnapshot: { name: business.name, region: business.region },
    ipAddress: req.ip,
  });

  res.json({ success: true, data: { business } });
});

export { ROLE_DEFAULT_PERMISSIONS };
