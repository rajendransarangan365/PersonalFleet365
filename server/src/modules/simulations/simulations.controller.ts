import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { SimulationModel, AuditEventModel } from '../../models/index.js';
import { asyncHandler } from '../../middleware/validation.middleware.js';
import {
  calculateEmi,
  estimateFuelCost,
  calculateStraightLineDepreciation,
  calculateBreakEven,
  buildFiveYearForecast,
  CALCULATION_VERSION,
} from '@fleetwise/shared';

// Helper to compute simulation result object
function computeSimulationResult(body: any) {
  const { vehicleDetails, financingDetails, fuelDetails, contractDetails } = body;

  // 1. Financing
  const loanPrincipal = financingDetails.loanPrincipal || Math.max(0, vehicleDetails.onRoadPrice - (financingDetails.downPayment || 0));
  const tenureMonths = financingDetails.tenureMonths || 36;
  const annualInterestRate = financingDetails.annualInterestRate || 10.5;

  const emiData = calculateEmi({
    principal: loanPrincipal,
    annualInterestRate,
    tenureMonths,
    processingFee: financingDetails.processingFee || 0,
    balloonPayment: financingDetails.balloonPayment || 0,
  });

  const monthlyEmi = financingDetails.type === 'cash' ? 0 : emiData.monthlyEmi;

  // 2. Revenue calculation
  const workingDays = contractDetails.workingDaysPerMonth || 26;
  const tripsPerDay = contractDetails.tripsPerDay || 2;
  const monthlyTrips = workingDays * tripsPerDay;
  const cancellationRate = (contractDetails.expectedCancellationPercent || 0) / 100;
  const effectiveMonthlyTrips = monthlyTrips * (1 - cancellationRate);

  const grossTripRevenue = contractDetails.payoutPerTrip || 0;
  const monthlyGrossRevenue = Math.round(effectiveMonthlyTrips * grossTripRevenue);
  const platformCommissionRate = (contractDetails.platformCommissionPercent || 0) / 100;
  const monthlyPlatformCommission = Math.round(monthlyGrossRevenue * platformCommissionRate);
  const monthlyNetRevenue = monthlyGrossRevenue - monthlyPlatformCommission;

  // 3. Operational Costs (Fuel & Direct expenses)
  const kmPerTrip = (contractDetails.paidKmPerTrip || 0) + (contractDetails.emptyRunningKmPerDay || 0) / tripsPerDay;
  const monthlyTotalKm = Math.round(effectiveMonthlyTrips * kmPerTrip);

  const efficiency = fuelDetails.realWorldEfficiency || 15;
  const unitFuelPrice = fuelDetails.unitPrice || 9600; // in paise
  const monthlyFuelCost = estimateFuelCost({
    km: monthlyTotalKm,
    efficiencyKmPerLitre: efficiency,
    unitPricePaise: unitFuelPrice,
  });

  const monthlyTolls = Math.round(effectiveMonthlyTrips * (contractDetails.tollsPerTrip || 0));
  const monthlyParking = Math.round(effectiveMonthlyTrips * (contractDetails.parkingPerTrip || 0));

  // 4. Vehicle maintenance & ownership
  const ownershipMonths = (vehicleDetails.ownershipPeriodYears || 5) * 12;
  const monthlyDepreciation = calculateStraightLineDepreciation({
    purchasePricePaise: vehicleDetails.onRoadPrice,
    expectedResalePaise: vehicleDetails.expectedResaleValue || 0,
    ownershipPeriodMonths: ownershipMonths,
  });

  const monthlyInsurance = Math.round((vehicleDetails.insuranceCost || 0) / 12);
  const monthlyRegistrationTaxes = Math.round((vehicleDetails.registrationCost || 0) / 12);
  // Tire & maintenance reserve ~ ₹1.20 per km
  const monthlyMaintenanceReserve = Math.round(monthlyTotalKm * 120);

  const totalMonthlyOperatingCost =
    monthlyFuelCost +
    monthlyTolls +
    monthlyParking +
    monthlyInsurance +
    monthlyRegistrationTaxes +
    monthlyMaintenanceReserve;

  // 5. Profitability & Cash Flow
  const monthlyNetCashFlow = monthlyNetRevenue - totalMonthlyOperatingCost - monthlyEmi;
  const monthlyEconomicProfit = monthlyNetRevenue - totalMonthlyOperatingCost - monthlyDepreciation;

  // 6. Break-even analysis
  const fixedMonthlyCosts = monthlyEmi + monthlyInsurance + monthlyRegistrationTaxes;
  const variableCostPerTrip = Math.round((monthlyFuelCost + monthlyTolls + monthlyParking) / (effectiveMonthlyTrips || 1));

  const breakEven = calculateBreakEven(
    {
      fixedMonthlyCosts,
      variableCostPerTrip,
      platformCommissionPercent: contractDetails.platformCommissionPercent || 0,
      tripsPerMonth: effectiveMonthlyTrips || 1,
    },
    grossTripRevenue,
    workingDays,
    monthlyDepreciation
  );

  // 7. Five Year Forecast
  const forecast = buildFiveYearForecast({
    monthlyRevenuePaise: monthlyNetRevenue,
    monthlyOperatingExpensesPaise: totalMonthlyOperatingCost,
    emiPaise: monthlyEmi,
    monthlyDepreciationPaise: monthlyDepreciation,
    loanPrincipalPaise: loanPrincipal,
    tenureMonths,
    annualInterestRate,
  });

  return {
    summary: {
      monthlyGrossRevenue,
      monthlyNetRevenue,
      monthlyFuelCost,
      monthlyEmi,
      totalMonthlyOperatingCost,
      monthlyDepreciation,
      monthlyNetCashFlow,
      monthlyEconomicProfit,
      costPerKmPaise: monthlyTotalKm > 0 ? Math.round((totalMonthlyOperatingCost + monthlyEmi) / monthlyTotalKm) : 0,
      revenuePerKmPaise: monthlyTotalKm > 0 ? Math.round(monthlyNetRevenue / monthlyTotalKm) : 0,
      netProfitMarginPercent: monthlyNetRevenue > 0 ? parseFloat(((monthlyNetCashFlow / monthlyNetRevenue) * 100).toFixed(2)) : 0,
      monthlyTotalKm,
      effectiveMonthlyTrips: Math.round(effectiveMonthlyTrips),
    },
    emiDetails: {
      monthlyEmi,
      totalPayable: emiData.totalPayable,
      totalInterest: emiData.totalInterest,
      effectiveRate: emiData.effectiveRate,
    },
    breakEven,
    forecast: forecast.slice(0, 36), // first 3 years detailed
  };
}

// ─── Instant Simulation Run (No persistence required) ─────────────────────────

export const runInstantSimulation = asyncHandler(async (req: Request, res: Response) => {
  const result = computeSimulationResult(req.body);
  res.json({ success: true, data: result });
});

// ─── List Saved Simulations ───────────────────────────────────────────────────

export const listSimulations = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;

  const simulations = await SimulationModel.find({
    businessId: new Types.ObjectId(businessId),
  })
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: simulations });
});

// ─── Create & Save Simulation ─────────────────────────────────────────────────

export const createSimulation = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const userId = req.userId!;
  const body = req.body;

  const result = computeSimulationResult(body);

  const simulation = await SimulationModel.create({
    businessId: new Types.ObjectId(businessId),
    name: body.name,
    description: body.description,
    vehicleDetails: body.vehicleDetails,
    financingDetails: body.financingDetails,
    fuelDetails: body.fuelDetails,
    contractDetails: body.contractDetails,
    scenarios: [
      {
        type: 'base',
        label: 'Base Scenario',
        overrides: {},
        result,
      },
    ],
    calculationVersion: CALCULATION_VERSION,
    createdBy: new Types.ObjectId(userId),
  });

  await AuditEventModel.create({
    businessId: new Types.ObjectId(businessId),
    userId: new Types.ObjectId(userId),
    action: 'simulation.create',
    resourceType: 'simulation',
    resourceId: simulation._id,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, data: simulation, result });
});

// ─── Get Simulation ───────────────────────────────────────────────────────────

export const getSimulation = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const { simulationId } = req.params;

  if (!simulationId || !Types.ObjectId.isValid(simulationId)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid simulation ID' } });
    return;
  }

  const simulation = await SimulationModel.findOne({
    _id: new Types.ObjectId(simulationId),
    businessId: new Types.ObjectId(businessId),
  }).lean();

  if (!simulation) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Simulation not found' } });
    return;
  }

  res.json({ success: true, data: simulation });
});

// ─── Delete Simulation ────────────────────────────────────────────────────────

export const deleteSimulation = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.businessId!;
  const { simulationId } = req.params;

  if (!simulationId || !Types.ObjectId.isValid(simulationId)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid simulation ID' } });
    return;
  }

  const result = await SimulationModel.deleteOne({
    _id: new Types.ObjectId(simulationId),
    businessId: new Types.ObjectId(businessId),
  });

  if (result.deletedCount === 0) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Simulation not found' } });
    return;
  }

  res.json({ success: true, message: 'Simulation deleted successfully' });
});
