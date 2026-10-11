import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { VehicleModel, AuditEventModel } from '../../models/index.js';
import { asyncHandler } from '../../middleware/validation.middleware.js';
import { logger } from '../../utils/logger.js';
import type { CreateVehicleInput } from '@fleetwise/shared';

// ─── List Vehicles ────────────────────────────────────────────────────────────

export const listVehicles = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const { page = 1, limit = 20, status, search } = req.query as {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  };

  const safeLimit = Math.min(Number(limit), 100);
  const safePage = Math.max(Number(page), 1);
  const skip = (safePage - 1) * safeLimit;

  const filter: Record<string, unknown> = {
    businessId: new Types.ObjectId(businessId),
    isActive: true,
  };

  if (status && ['active', 'available', 'assigned', 'in_service', 'breakdown', 'inactive', 'sold'].includes(status)) {
    filter['status'] = status;
  }

  if (search && typeof search === 'string' && search.length <= 50) {
    // Safe search — use regex on indexed fields only
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter['$or'] = [
      { registrationNumber: { $regex: safeSearch, $options: 'i' } },
      { make: { $regex: safeSearch, $options: 'i' } },
      { model: { $regex: safeSearch, $options: 'i' } },
    ];
  }

  const [vehicles, total] = await Promise.all([
    VehicleModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
    VehicleModel.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: vehicles,
    meta: { page: safePage, limit: safeLimit, total },
  });
});

// ─── Create Vehicle ───────────────────────────────────────────────────────────

export const createVehicle = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const body = req.body as CreateVehicleInput;

  // Check for duplicate registration in same business
  const duplicate = await VehicleModel.findOne({
    businessId: new Types.ObjectId(businessId),
    registrationNumber: body.registrationNumber,
  });

  if (duplicate) {
    res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE',
        message: 'A vehicle with this registration number already exists in your business',
      },
    });
    return;
  }

  const vehicle = await VehicleModel.create({
    ...body,
    businessId: new Types.ObjectId(businessId),
    purchaseDate: new Date(body.purchaseDate),
    purchasePrice: Types.Decimal128.fromString(String(body.purchasePrice)),
  });

  await AuditEventModel.create({
    businessId: new Types.ObjectId(businessId),
    actorUserId: new Types.ObjectId(req.userId!),
    eventType: 'vehicle.created',
    entityType: 'Vehicle',
    entityId: vehicle._id,
    afterSnapshot: { registrationNumber: vehicle.registrationNumber, make: vehicle.make, model: vehicle.model },
    ipAddress: req.ip,
  });

  logger.info('Vehicle created', { vehicleId: vehicle._id, businessId });

  res.status(201).json({ success: true, data: { vehicle } });
});

// ─── Get Vehicle ──────────────────────────────────────────────────────────────

export const getVehicle = asyncHandler(async (req: Request, res: Response) => {
  const { vehicleId } = req.params as { vehicleId: string };
  const businessId = req.businessId!;

  if (!Types.ObjectId.isValid(vehicleId)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid vehicle ID' } });
    return;
  }

  // Always filter by businessId to prevent IDOR
  const vehicle = await VehicleModel.findOne({
    _id: new Types.ObjectId(vehicleId),
    businessId: new Types.ObjectId(businessId),
    isActive: true,
  }).lean();

  if (!vehicle) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });
    return;
  }

  res.json({ success: true, data: { vehicle } });
});

// ─── Update Vehicle ───────────────────────────────────────────────────────────

export const updateVehicle = asyncHandler(async (req: Request, res: Response) => {
  const { vehicleId } = req.params as { vehicleId: string };
  const businessId = req.businessId!;

  if (!Types.ObjectId.isValid(vehicleId)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid vehicle ID' } });
    return;
  }

  const vehicle = await VehicleModel.findOne({
    _id: new Types.ObjectId(vehicleId),
    businessId: new Types.ObjectId(businessId),
    isActive: true,
  });

  if (!vehicle) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });
    return;
  }

  const before = { status: vehicle.status, currentOdometer: vehicle.currentOdometer };

  // Allowlisted fields only
  const allowed = [
    'make', 'model', 'variant', 'year', 'seatingCapacity', 'fuelType',
    'currentOdometer', 'status', 'assignedDriverId', 'insurance', 'permits', 'notes',
  ] as const;

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vehicle as any)[key] = req.body[key];
    }
  }

  // Validate odometer continuity
  if (req.body['currentOdometer'] !== undefined && req.body['currentOdometer'] < (before.currentOdometer ?? 0)) {
    res.status(422).json({
      success: false,
      error: { code: 'INVALID_ODOMETER', message: 'New odometer cannot be less than previous reading' },
    });
    return;
  }

  if (req.body['purchasePrice'] !== undefined) {
    vehicle.purchasePrice = Types.Decimal128.fromString(String(req.body['purchasePrice']));
  }

  await vehicle.save();

  await AuditEventModel.create({
    businessId: new Types.ObjectId(businessId),
    actorUserId: new Types.ObjectId(req.userId!),
    eventType: 'vehicle.updated',
    entityType: 'Vehicle',
    entityId: vehicle._id,
    beforeSnapshot: before,
    afterSnapshot: { status: vehicle.status, currentOdometer: vehicle.currentOdometer },
    ipAddress: req.ip,
  });

  res.json({ success: true, data: { vehicle } });
});

// ─── Deactivate Vehicle ───────────────────────────────────────────────────────

export const deactivateVehicle = asyncHandler(async (req: Request, res: Response) => {
  const { vehicleId } = req.params as { vehicleId: string };
  const businessId = req.businessId!;

  if (!Types.ObjectId.isValid(vehicleId)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid vehicle ID' } });
    return;
  }

  const vehicle = await VehicleModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(vehicleId),
      businessId: new Types.ObjectId(businessId),
      isActive: true,
    },
    { isActive: false, status: 'inactive' },
    { new: true },
  );

  if (!vehicle) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });
    return;
  }

  await AuditEventModel.create({
    businessId: new Types.ObjectId(businessId),
    actorUserId: new Types.ObjectId(req.userId!),
    eventType: 'vehicle.deactivated',
    entityType: 'Vehicle',
    entityId: vehicle._id,
    ipAddress: req.ip,
  });

  logger.info('Vehicle deactivated', { vehicleId, businessId });
  res.json({ success: true, data: { message: 'Vehicle deactivated successfully' } });
});
