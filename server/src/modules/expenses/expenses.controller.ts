import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ExpenseModel, FuelEntryModel, VehicleModel, AuditEventModel } from '../../models/index.js';
import { asyncHandler } from '../../middleware/validation.middleware.js';
import type { CreateExpenseInput, CreateFuelEntryInput } from '@fleetwise/shared';

// ─── List Expenses ────────────────────────────────────────────────────────────

export const listExpenses = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const {
    page = 1,
    limit = 20,
    vehicleId,
    category,
    startDate,
    endDate,
  } = req.query as {
    page?: number;
    limit?: number;
    vehicleId?: string;
    category?: string;
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

  if (category) {
    filter['category'] = category;
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

  const [expenses, total] = await Promise.all([
    ExpenseModel.find(filter)
      .populate('vehicleId', 'registrationNumber make model')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    ExpenseModel.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: expenses,
    meta: { page: safePage, limit: safeLimit, total },
  });
});

// ─── Create Expense ───────────────────────────────────────────────────────────

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const userId = req.userId!;
  const body = req.body as CreateExpenseInput;

  const netAmountPaise = Math.max(0, body.amount - (body.reimbursedAmount ?? 0));

  const expense = await ExpenseModel.create({
    businessId: new Types.ObjectId(businessId),
    vehicleId: body.vehicleId ? new Types.ObjectId(body.vehicleId) : undefined,
    tripId: body.tripId ? new Types.ObjectId(body.tripId) : undefined,
    date: new Date(body.date),
    category: body.category,
    amount: Types.Decimal128.fromString(body.amount.toString()),
    reimbursedAmount: Types.Decimal128.fromString((body.reimbursedAmount ?? 0).toString()),
    netAmount: Types.Decimal128.fromString(netAmountPaise.toString()),
    vendor: body.vendor,
    paymentMethod: body.paymentMethod,
    isRecurring: body.isRecurring ?? false,
    notes: body.notes,
    createdBy: new Types.ObjectId(userId),
  });

  await AuditEventModel.create({
    businessId: new Types.ObjectId(businessId),
    userId: new Types.ObjectId(userId),
    action: 'expense.create',
    resourceType: 'expense',
    resourceId: expense._id,
    details: { amount: body.amount, category: body.category },
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, data: expense });
});

// ─── Get Single Expense ───────────────────────────────────────────────────────

export const getExpense = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const { expenseId } = req.params;

  if (!expenseId || !Types.ObjectId.isValid(expenseId)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid expense ID' } });
    return;
  }

  const expense = await ExpenseModel.findOne({
    _id: new Types.ObjectId(expenseId),
    businessId: new Types.ObjectId(businessId),
  })
    .populate('vehicleId', 'registrationNumber make model')
    .lean();

  if (!expense) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Expense not found' } });
    return;
  }

  res.json({ success: true, data: expense });
});

// ─── Expense Summary ──────────────────────────────────────────────────────────

export const getExpenseSummary = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;

  const summary = await ExpenseModel.aggregate([
    { $match: { businessId: new Types.ObjectId(businessId) } },
    {
      $group: {
        _id: '$category',
        totalAmount: { $sum: { $toDouble: '$netAmount' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);

  res.json({ success: true, data: summary });
});

// ─── List Fuel Entries ────────────────────────────────────────────────────────

export const listFuelEntries = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const { vehicleId, page = 1, limit = 20 } = req.query as {
    vehicleId?: string;
    page?: number;
    limit?: number;
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

  const [fuelEntries, total] = await Promise.all([
    FuelEntryModel.find(filter)
      .populate('vehicleId', 'registrationNumber make model')
      .sort({ date: -1, odometer: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    FuelEntryModel.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: fuelEntries,
    meta: { page: safePage, limit: safeLimit, total },
  });
});

// ─── Create Fuel Entry ────────────────────────────────────────────────────────

export const createFuelEntry = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const body = req.body as CreateFuelEntryInput;

  const vehicle = await VehicleModel.findOne({
    _id: new Types.ObjectId(body.vehicleId),
    businessId: new Types.ObjectId(businessId),
  });

  if (!vehicle) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });
    return;
  }

  const fuelEntry = await FuelEntryModel.create({
    businessId: new Types.ObjectId(businessId),
    vehicleId: new Types.ObjectId(body.vehicleId),
    date: new Date(body.date),
    odometer: body.odometer,
    fuelType: body.fuelType,
    quantity: body.quantity,
    unitPrice: Types.Decimal128.fromString(body.unitPrice.toString()),
    totalAmount: Types.Decimal128.fromString(body.totalAmount.toString()),
    stationName: body.stationName,
    isFullRefill: body.isFullRefill,
    paymentMethod: body.paymentMethod,
  });

  if (body.odometer > vehicle.currentOdometer) {
    await VehicleModel.updateOne(
      { _id: vehicle._id },
      { $set: { currentOdometer: body.odometer } }
    );
  }

  res.status(201).json({ success: true, data: fuelEntry });
});
