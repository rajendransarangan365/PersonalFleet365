import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { DriverModel, AuditEventModel } from '../../models/index.js';
import { asyncHandler } from '../../middleware/validation.middleware.js';
import type { CreateDriverInput } from '@fleetwise/shared';

// ─── List Drivers ─────────────────────────────────────────────────────────────

export const listDrivers = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const { page = 1, limit = 20, activeOnly = 'true' } = req.query as {
    page?: number;
    limit?: number;
    activeOnly?: string;
  };

  const safeLimit = Math.min(Number(limit), 100);
  const safePage = Math.max(Number(page), 1);
  const skip = (safePage - 1) * safeLimit;

  const filter: Record<string, unknown> = {
    businessId: new Types.ObjectId(businessId),
  };

  if (activeOnly === 'true') {
    filter['isActive'] = true;
  }

  const [drivers, total] = await Promise.all([
    DriverModel.find(filter)
      .populate('assignedVehicleId', 'registrationNumber make model')
      .sort({ name: 1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    DriverModel.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: drivers,
    meta: { page: safePage, limit: safeLimit, total },
  });
});

// ─── Create Driver ────────────────────────────────────────────────────────────

export const createDriver = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const userId = req.userId!;
  const body = req.body as CreateDriverInput;

  // Check unique license number per business
  const existing = await DriverModel.findOne({
    businessId: new Types.ObjectId(businessId),
    licenseNumber: body.licenseNumber.toUpperCase(),
  });

  if (existing) {
    res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'Driver with this license number already exists in this business' },
    });
    return;
  }

  const driver = await DriverModel.create({
    businessId: new Types.ObjectId(businessId),
    name: body.name.trim(),
    phone: body.phone.trim(),
    licenseNumber: body.licenseNumber.toUpperCase(),
    licenseExpiry: new Date(body.licenseExpiry),
    joiningDate: new Date(body.joiningDate),
    monthlyWage: body.monthlyWage ? Types.Decimal128.fromString(body.monthlyWage.toString()) : undefined,
  });

  await AuditEventModel.create({
    businessId: new Types.ObjectId(businessId),
    userId: new Types.ObjectId(userId),
    action: 'driver.create',
    resourceType: 'driver',
    resourceId: driver._id,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, data: driver });
});

// ─── Get Driver ───────────────────────────────────────────────────────────────

export const getDriver = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const { driverId } = req.params;

  if (!driverId || !Types.ObjectId.isValid(driverId)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid driver ID' } });
    return;
  }

  const driver = await DriverModel.findOne({
    _id: new Types.ObjectId(driverId),
    businessId: new Types.ObjectId(businessId),
  })
    .populate('assignedVehicleId', 'registrationNumber make model')
    .lean();

  if (!driver) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Driver not found' } });
    return;
  }

  res.json({ success: true, data: driver });
});

// ─── Update Driver ───────────────────────────────────────────────────────────

export const updateDriver = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const { driverId } = req.params;
  const updateData = req.body;

  if (!driverId || !Types.ObjectId.isValid(driverId)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid driver ID' } });
    return;
  }

  const allowedUpdates: Record<string, unknown> = {};
  if (updateData.name) allowedUpdates['name'] = updateData.name;
  if (updateData.phone) allowedUpdates['phone'] = updateData.phone;
  if (updateData.licenseExpiry) allowedUpdates['licenseExpiry'] = new Date(updateData.licenseExpiry);
  if (typeof updateData.isActive === 'boolean') allowedUpdates['isActive'] = updateData.isActive;
  if (updateData.assignedVehicleId !== undefined) {
    allowedUpdates['assignedVehicleId'] = updateData.assignedVehicleId
      ? new Types.ObjectId(updateData.assignedVehicleId)
      : undefined;
  }
  if (updateData.monthlyWage !== undefined) {
    allowedUpdates['monthlyWage'] = Types.Decimal128.fromString(updateData.monthlyWage.toString());
  }

  const driver = await DriverModel.findOneAndUpdate(
    { _id: new Types.ObjectId(driverId), businessId: new Types.ObjectId(businessId) },
    { $set: allowedUpdates },
    { new: true }
  ).lean();

  if (!driver) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Driver not found' } });
    return;
  }

  res.json({ success: true, data: driver });
});
