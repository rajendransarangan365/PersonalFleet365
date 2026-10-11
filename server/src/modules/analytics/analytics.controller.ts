import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { VehicleModel, TripModel, ExpenseModel, DriverModel } from '../../models/index.js';
import { asyncHandler } from '../../middleware/validation.middleware.js';
import {
  generateFleetDepthAnalysis,
  generateSimulationAdvisor,
  chatWithFleetAI,
} from '../../services/ai.service.js';

// ─── Dashboard KPIs ───────────────────────────────────────────────────────────

export const getDashboardKpis = asyncHandler(async (req: Request, res: Response) => {
  const businessId = new Types.ObjectId(req.businessId!);

  // Current month date boundaries
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [
    totalVehicles,
    activeVehicles,
    totalDrivers,
    tripStats,
    expenseStats,
  ] = await Promise.all([
    VehicleModel.countDocuments({ businessId, isActive: true }),
    VehicleModel.countDocuments({ businessId, isActive: true, status: 'active' }),
    DriverModel.countDocuments({ businessId, isActive: true }),
    TripModel.aggregate([
      {
        $match: {
          businessId,
          date: { $gte: startOfMonth, $lte: endOfMonth },
          isCancelled: false,
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $toDouble: '$grossFare' } },
          totalCommission: { $sum: { $toDouble: '$platformCommission' } },
          totalKm: { $sum: '$totalKm' },
          tripCount: { $sum: 1 },
        },
      },
    ]),
    ExpenseModel.aggregate([
      {
        $match: {
          businessId,
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: { $toDouble: '$netAmount' } },
        },
      },
    ]),
  ]);

  const trips = tripStats[0] || { totalRevenue: 0, totalCommission: 0, totalKm: 0, tripCount: 0 };
  const netRevenue = trips.totalRevenue - trips.totalCommission;
  const totalExpenses = expenseStats[0]?.totalExpenses || 0;
  const netProfit = netRevenue - totalExpenses;

  res.json({
    success: true,
    data: {
      fleet: {
        totalVehicles,
        activeVehicles,
        inServiceVehicles: Math.max(0, totalVehicles - activeVehicles),
        totalDrivers,
      },
      monthToDate: {
        totalRevenue: trips.totalRevenue,
        netRevenue,
        totalExpenses,
        netProfit,
        totalKm: trips.totalKm || 0,
        tripCount: trips.tripCount,
        costPerKm: trips.totalKm > 0 ? Math.round(totalExpenses / trips.totalKm) : 0,
        revenuePerKm: trips.totalKm > 0 ? Math.round(netRevenue / trips.totalKm) : 0,
      },
    },
  });
});

// ─── Fleet Performance by Vehicle ─────────────────────────────────────────────

export const getFleetPerformance = asyncHandler(async (req: Request, res: Response) => {
  const businessId = new Types.ObjectId(req.businessId!);

  const performance = await VehicleModel.aggregate([
    { $match: { businessId, isActive: true } },
    {
      $lookup: {
        from: 'trips',
        let: { vId: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$vehicleId', '$$vId'] }, { $eq: ['$isCancelled', false] }] } } },
          {
            $group: {
              _id: null,
              revenue: { $sum: { $toDouble: '$grossFare' } },
              km: { $sum: '$totalKm' },
              trips: { $sum: 1 },
            },
          },
        ],
        as: 'tripStats',
      },
    },
    {
      $lookup: {
        from: 'expenses',
        let: { vId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$vehicleId', '$$vId'] } } },
          {
            $group: {
              _id: null,
              cost: { $sum: { $toDouble: '$netAmount' } },
            },
          },
        ],
        as: 'expenseStats',
      },
    },
    {
      $project: {
        registrationNumber: 1,
        make: 1,
        model: 1,
        status: 1,
        currentOdometer: 1,
        fuelType: 1,
        revenue: { $ifNull: [{ $arrayElemAt: ['$tripStats.revenue', 0] }, 0] },
        totalKm: { $ifNull: [{ $arrayElemAt: ['$tripStats.km', 0] }, 0] },
        tripCount: { $ifNull: [{ $arrayElemAt: ['$tripStats.trips', 0] }, 0] },
        totalExpenses: { $ifNull: [{ $arrayElemAt: ['$expenseStats.cost', 0] }, 0] },
      },
    },
  ]);

  res.json({ success: true, data: performance });
});

// ─── Monthly Revenue Trends ───────────────────────────────────────────────────

export const getRevenueTrends = asyncHandler(async (req: Request, res: Response) => {
  const businessId = new Types.ObjectId(req.businessId!);

  // Aggregation grouping trips and expenses by year-month for the last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [tripTrends, expenseTrends] = await Promise.all([
    TripModel.aggregate([
      {
        $match: {
          businessId,
          date: { $gte: sixMonthsAgo },
          isCancelled: false,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
          revenue: { $sum: { $toDouble: '$grossFare' } },
          commission: { $sum: { $toDouble: '$platformCommission' } },
          km: { $sum: '$totalKm' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    ExpenseModel.aggregate([
      {
        $match: {
          businessId,
          date: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
          expenses: { $sum: { $toDouble: '$netAmount' } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const trendsMap = new Map<string, { month: string; revenue: number; expenses: number; profit: number; km: number }>();

  for (const t of tripTrends) {
    const net = t.revenue - t.commission;
    trendsMap.set(t._id, { month: t._id, revenue: net, expenses: 0, profit: net, km: t.km || 0 });
  }

  for (const e of expenseTrends) {
    const existing = trendsMap.get(e._id) || { month: e._id, revenue: 0, expenses: 0, profit: 0, km: 0 };
    existing.expenses = e.expenses;
    existing.profit = existing.revenue - e.expenses;
    trendsMap.set(e._id, existing);
  }

  const trends = Array.from(trendsMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  res.json({ success: true, data: trends });
});

// ─── Gemini Free Tier AI Depth Analysis ───────────────────────────────────────

export const getAiDepthAnalysis = asyncHandler(async (req: Request, res: Response) => {
  const businessId = new Types.ObjectId(req.businessId!);

  // Fetch real fleet metrics for grounding the AI prompt
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [totalVehicles, activeVehicles, tripStats, expenseStats] = await Promise.all([
    VehicleModel.countDocuments({ businessId, isActive: true }),
    VehicleModel.countDocuments({ businessId, isActive: true, status: 'active' }),
    TripModel.aggregate([
      { $match: { businessId, date: { $gte: startOfMonth, $lte: endOfMonth }, isCancelled: false } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $toDouble: '$grossFare' } },
          totalCommission: { $sum: { $toDouble: '$platformCommission' } },
          totalKm: { $sum: '$totalKm' },
        },
      },
    ]),
    ExpenseModel.aggregate([
      { $match: { businessId, date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: null, totalExpenses: { $sum: { $toDouble: '$netAmount' } } } },
    ]),
  ]);

  const trips = tripStats[0] || { totalRevenue: 0, totalCommission: 0, totalKm: 0 };
  const netRevenue = trips.totalRevenue - trips.totalCommission;
  const totalExpenses = expenseStats[0]?.totalExpenses || 0;
  const totalKm = trips.totalKm || 0;

  // If new account with no trips yet, use body overrides or reasonable baseline
  const analysis = await generateFleetDepthAnalysis({
    fleetSize: totalVehicles || (req.body?.fleetSize ?? 4),
    activeVehicles: activeVehicles || (req.body?.activeVehicles ?? 3),
    monthlyRevenue: netRevenue || (req.body?.monthlyRevenue ?? 38400000), // paise
    monthlyExpenses: totalExpenses || (req.body?.monthlyExpenses ?? 19400000),
    monthlyProfit: (netRevenue - totalExpenses) || (req.body?.monthlyProfit ?? 19000000),
    totalKm: totalKm || (req.body?.totalKm ?? 12800),
    costPerKm: totalKm > 0 ? Math.round(totalExpenses / totalKm) : (req.body?.costPerKm ?? 820),
    revenuePerKm: totalKm > 0 ? Math.round(netRevenue / totalKm) : (req.body?.revenuePerKm ?? 2200),
  });

  res.json({
    success: true,
    data: {
      analysis,
      model: 'gemini-3.5-flash (Free Tier)',
      analyzedAt: new Date().toISOString(),
    },
  });
});

// ─── Gemini Free Tier Interactive Fleet AI Chat ───────────────────────────────

export const handleAiChat = asyncHandler(async (req: Request, res: Response) => {
  const { message, context } = req.body as { message: string; context?: Record<string, unknown> };

  if (!message || typeof message !== 'string') {
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Message is required' } });
    return;
  }

  const reply = await chatWithFleetAI(message, context);

  res.json({
    success: true,
    data: {
      reply,
      model: 'gemini-3.5-flash (Free Tier)',
    },
  });
});

// ─── Gemini Free Tier Simulation Advisor ──────────────────────────────────────

export const getAiSimulationAdvice = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;

  const advice = await generateSimulationAdvisor({
    vehicleModel: body.vehicleModel || 'Dzire Tour CNG',
    fuelType: body.fuelType || 'cng',
    onRoadPrice: body.onRoadPrice || 82000000,
    monthlyEmi: body.monthlyEmi || 2200000,
    monthlyRevenue: body.monthlyRevenue || 8580000,
    monthlyFuelCost: body.monthlyFuelCost || 1290000,
    monthlyNetProfit: body.monthlyNetProfit || 3200000,
    breakEvenTripsPerDay: body.breakEvenTripsPerDay || 1.4,
  });

  res.json({
    success: true,
    data: {
      advice,
      model: 'gemini-3.5-flash (Free Tier)',
    },
  });
});
