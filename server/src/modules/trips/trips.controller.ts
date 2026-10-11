import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { TripModel, VehicleModel, AuditEventModel } from '../../models/index.js';
import { asyncHandler } from '../../middleware/validation.middleware.js';
import { logger } from '../../utils/logger.js';
import type { CreateTripInput } from '@fleetwise/shared';

// ─── List Trips ───────────────────────────────────────────────────────────────

export const listTrips = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const {
    page = 1,
    limit = 20,
    vehicleId,
    driverId,
    source,
    startDate,
    endDate,
  } = req.query as {
    page?: number;
    limit?: number;
    vehicleId?: string;
    driverId?: string;
    source?: string;
    startDate?: string;
    endDate?: string;
  };

  const safeLimit = Math.min(Number(limit), 100);
  const safePage = Math.max(Number(page), 1);
  const skip = (safePage - 1) * safeLimit;

  const filter: Record<string, unknown> = {
    businessId: new Types.ObjectId(businessId),
  };

  if (vehicleId && Types.ObjectId.isValid(vehicleId)) {
    filter['vehicleId'] = new Types.ObjectId(vehicleId);
  }

  if (driverId && Types.ObjectId.isValid(driverId)) {
    filter['driverId'] = new Types.ObjectId(driverId);
  }

  if (source) {
    filter['source'] = source;
  }

  if (startDate || endDate) {
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter['$gte'] = new Date(startDate);
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      dateFilter['$lte'] = eDate;
    }
    filter['date'] = dateFilter;
  }

  const [trips, total] = await Promise.all([
    TripModel.find(filter)
      .populate('vehicleId', 'registrationNumber make model')
      .populate('driverId', 'name phone')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    TripModel.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: trips,
    meta: { page: safePage, limit: safeLimit, total },
  });
});

// ─── Create Trip ──────────────────────────────────────────────────────────────

export const createTrip = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const userId = req.userId!;
  const body = req.body as CreateTripInput;

  // Verify vehicle belongs to business
  const vehicle = await VehicleModel.findOne({
    _id: new Types.ObjectId(body.vehicleId),
    businessId: new Types.ObjectId(businessId),
    isActive: true,
  });

  if (!vehicle) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Vehicle not found or inactive in this business' },
    });
    return;
  }

  // Calculate total Km if endOdometer provided
  let totalKm = 0;
  if (body.endOdometer && body.endOdometer >= body.startOdometer) {
    totalKm = body.endOdometer - body.startOdometer;
  }

  // Check idempotency key to prevent double posting
  const existingTrip = await TripModel.findOne({
    businessId: new Types.ObjectId(businessId),
    idempotencyKey: body.idempotencyKey,
  }).lean();

  if (existingTrip) {
    res.status(200).json({
      success: true,
      data: existingTrip,
      meta: { idempotentReplay: true },
    });
    return;
  }

  const trip = await TripModel.create({
    businessId: new Types.ObjectId(businessId),
    vehicleId: new Types.ObjectId(body.vehicleId),
    driverId: new Types.ObjectId(body.driverId),
    contractId: body.contractId ? new Types.ObjectId(body.contractId) : undefined,
    source: body.source,
    date: new Date(body.date),
    startTime: body.startTime,
    endTime: body.endTime,
    startOdometer: body.startOdometer,
    endOdometer: body.endOdometer,
    totalKm: totalKm || undefined,
    paidKm: totalKm || undefined,
    grossFare: Types.Decimal128.fromString(body.grossFare.toString()),
    incentives: Types.Decimal128.fromString((body.incentives ?? 0).toString()),
    reimbursements: Types.Decimal128.fromString((body.reimbursements ?? 0).toString()),
    platformCommission: Types.Decimal128.fromString((body.platformCommission ?? 0).toString()),
    tolls: Types.Decimal128.fromString((body.tolls ?? 0).toString()),
    parking: Types.Decimal128.fromString((body.parking ?? 0).toString()),
    otherTripExpenses: Types.Decimal128.fromString((body.otherTripExpenses ?? 0).toString()),
    paymentMethod: body.paymentMethod,
    idempotencyKey: body.idempotencyKey,
    notes: body.notes,
    createdBy: new Types.ObjectId(userId),
  });

  // Advance vehicle odometer if this trip is newer than current
  if (body.endOdometer && body.endOdometer > vehicle.currentOdometer) {
    await VehicleModel.updateOne(
      { _id: vehicle._id },
      { $set: { currentOdometer: body.endOdometer } }
    );
  }

  await AuditEventModel.create({
    businessId: new Types.ObjectId(businessId),
    userId: new Types.ObjectId(userId),
    action: 'trip.create',
    resourceType: 'trip',
    resourceId: trip._id,
    details: { grossFare: body.grossFare, source: body.source, totalKm },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(201).json({
    success: true,
    data: trip,
  });
});

// ─── Get Trip ─────────────────────────────────────────────────────────────────

export const getTrip = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const { tripId } = req.params;

  if (!tripId || !Types.ObjectId.isValid(tripId)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid trip ID' } });
    return;
  }

  const trip = await TripModel.findOne({
    _id: new Types.ObjectId(tripId),
    businessId: new Types.ObjectId(businessId),
  })
    .populate('vehicleId', 'registrationNumber make model')
    .populate('driverId', 'name phone')
    .lean();

  if (!trip) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } });
    return;
  }

  res.json({ success: true, data: trip });
});

// ─── Cancel Trip ──────────────────────────────────────────────────────────────

export const cancelTrip = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const userId = req.userId!;
  const { tripId } = req.params;

  if (!tripId || !Types.ObjectId.isValid(tripId)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid trip ID' } });
    return;
  }

  const trip = await TripModel.findOneAndUpdate(
    { _id: new Types.ObjectId(tripId), businessId: new Types.ObjectId(businessId) },
    { $set: { isCancelled: true, paymentStatus: 'cancelled' } },
    { new: true }
  );

  if (!trip) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } });
    return;
  }

  await AuditEventModel.create({
    businessId: new Types.ObjectId(businessId),
    userId: new Types.ObjectId(userId),
    action: 'trip.cancel',
    resourceType: 'trip',
    resourceId: trip._id,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: trip });
});
