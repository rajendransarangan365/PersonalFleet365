"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CALCULATION_VERSION: () => CALCULATION_VERSION,
  ChangePasswordSchema: () => ChangePasswordSchema,
  CreateBusinessSchema: () => CreateBusinessSchema,
  CreateDriverSchema: () => CreateDriverSchema,
  CreateExpenseSchema: () => CreateExpenseSchema,
  CreateFuelEntrySchema: () => CreateFuelEntrySchema,
  CreateMaintenanceItemSchema: () => CreateMaintenanceItemSchema,
  CreateSimulationSchema: () => CreateSimulationSchema,
  CreateTripSchema: () => CreateTripSchema,
  CreateVehicleSchema: () => CreateVehicleSchema,
  ForgotPasswordSchema: () => ForgotPasswordSchema,
  PaginationSchema: () => PaginationSchema,
  ResetPasswordSchema: () => ResetPasswordSchema,
  SignInSchema: () => SignInSchema,
  SignUpSchema: () => SignUpSchema,
  SimulationContractInputSchema: () => SimulationContractInputSchema,
  SimulationFinancingInputSchema: () => SimulationFinancingInputSchema,
  SimulationVehicleInputSchema: () => SimulationVehicleInputSchema,
  UpdateBusinessSchema: () => UpdateBusinessSchema,
  UpdateVehicleSchema: () => UpdateVehicleSchema,
  VehicleRegistrationRegex: () => VehicleRegistrationRegex,
  buildFiveYearForecast: () => buildFiveYearForecast,
  calculateBreakEven: () => calculateBreakEven,
  calculateEconomicProfit: () => calculateEconomicProfit,
  calculateEmi: () => calculateEmi,
  calculateMileage: () => calculateMileage,
  calculateMonthlyCashFlow: () => calculateMonthlyCashFlow,
  calculateOperatingProfit: () => calculateOperatingProfit,
  calculateStraightLineDepreciation: () => calculateStraightLineDepreciation,
  calculateTco: () => calculateTco,
  calculateTripContribution: () => calculateTripContribution,
  calculateTripRevenue: () => calculateTripRevenue,
  costPerKm: () => costPerKm,
  estimateFuelCost: () => estimateFuelCost,
  formatINR: () => formatINR,
  fromPaise: () => fromPaise,
  toPaise: () => toPaise
});
module.exports = __toCommonJS(index_exports);

// src/financial/calculations.ts
var toPaise = (inr) => Math.round(inr * 100);
var fromPaise = (paise) => paise / 100;
var formatINR = (paise) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
}).format(fromPaise(paise));
function calculateEmi(input) {
  const { principal, annualInterestRate, tenureMonths, processingFee = 0, balloonPayment = 0 } = input;
  if (annualInterestRate === 0) {
    const monthlyEmi2 = Math.round(principal / tenureMonths);
    const totalPayable2 = monthlyEmi2 * tenureMonths + balloonPayment;
    const schedule2 = buildZeroInterestSchedule(principal, monthlyEmi2, tenureMonths, balloonPayment);
    return {
      monthlyEmi: monthlyEmi2,
      totalPayable: totalPayable2,
      totalInterest: 0,
      effectiveRate: 0,
      amortizationSchedule: schedule2
    };
  }
  const r = annualInterestRate / 12 / 100;
  const n = tenureMonths;
  const raisedFactor = Math.pow(1 + r, n);
  const monthlyEmi = Math.round(principal * r * raisedFactor / (raisedFactor - 1));
  const schedule = [];
  let balance = principal;
  for (let month = 1; month <= n; month++) {
    const interest = Math.round(balance * r);
    const principalPart = monthlyEmi - interest;
    const closing = Math.max(0, balance - principalPart);
    schedule.push({
      month,
      openingBalance: balance,
      interest,
      principal: principalPart,
      emi: monthlyEmi,
      closingBalance: closing
    });
    balance = closing;
  }
  const totalPayable = monthlyEmi * n + balloonPayment;
  const totalInterest = totalPayable - principal - balloonPayment + processingFee;
  const effectiveRate = processingFee > 0 ? annualInterestRate * (1 + processingFee / principal) : annualInterestRate;
  return { monthlyEmi, totalPayable, totalInterest, effectiveRate, amortizationSchedule: schedule };
}
function buildZeroInterestSchedule(principal, monthlyEmi, n, balloonPayment) {
  const schedule = [];
  let balance = principal;
  for (let month = 1; month <= n; month++) {
    const isLast = month === n;
    const emi = isLast ? monthlyEmi + balloonPayment : monthlyEmi;
    const closing = Math.max(0, balance - monthlyEmi);
    schedule.push({
      month,
      openingBalance: balance,
      interest: 0,
      principal: monthlyEmi,
      emi,
      closingBalance: closing
    });
    balance = closing;
  }
  return schedule;
}
function estimateFuelCost(input) {
  const { km, efficiencyKmPerLitre, unitPricePaise } = input;
  if (efficiencyKmPerLitre <= 0) throw new RangeError("Efficiency must be positive");
  const litres = km / efficiencyKmPerLitre;
  return Math.round(litres * unitPricePaise);
}
function calculateMileage(startOdometer, endOdometer, litresRefilled) {
  const km = endOdometer - startOdometer;
  if (km <= 0 || litresRefilled <= 0) return null;
  return km / litresRefilled;
}
function calculateTripRevenue(input) {
  const grossRevenue = input.grossFare + input.incentives + input.reimbursements;
  const netRevenue = grossRevenue - input.platformCommission;
  return { grossRevenue, netRevenue };
}
function calculateTripContribution(input) {
  const totalCost = input.fuelCostAllocated + input.tolls + input.parking + input.otherDirectCosts;
  return input.netRevenue - totalCost;
}
function calculateMonthlyCashFlow(input) {
  return input.cashReceipts - input.operatingExpenses - input.emiAmount - input.capitalExpenditure - input.otherCashOutflows;
}
function calculateOperatingProfit(input) {
  return input.netRevenue - input.operatingExpenses;
}
function calculateEconomicProfit(input) {
  return input.netRevenue - input.operatingExpenses - input.monthlyDepreciation - input.interestExpense - input.otherExpenses;
}
function calculateStraightLineDepreciation(input) {
  const total = input.purchasePricePaise - input.expectedResalePaise;
  return Math.round(total / input.ownershipPeriodMonths);
}
function calculateBreakEven(input, currentPayoutPerTrip, workingDaysPerMonth, monthlyDepreciation) {
  const commissionFactor = 1 - input.platformCommissionPercent / 100;
  const cashBreakEvenPerTrip = Math.round(
    input.fixedMonthlyCosts / input.tripsPerMonth / commissionFactor + input.variableCostPerTrip / commissionFactor
  );
  const economicBreakEvenPerTrip = Math.round(
    (input.fixedMonthlyCosts + monthlyDepreciation) / input.tripsPerMonth / commissionFactor + input.variableCostPerTrip / commissionFactor
  );
  const breakEvenTripsPerDay = parseFloat(
    (cashBreakEvenPerTrip / (currentPayoutPerTrip * commissionFactor || 1) * (workingDaysPerMonth > 0 ? 1 : 0)).toFixed(2)
  );
  const margin = currentPayoutPerTrip * commissionFactor - cashBreakEvenPerTrip;
  return { cashBreakEvenPerTrip, economicBreakEvenPerTrip, breakEvenTripsPerDay, margin };
}
function costPerKm(totalCostPaise, totalKm) {
  if (totalKm <= 0) return 0;
  return Math.round(totalCostPaise / totalKm);
}
function calculateTco(input) {
  const grossCost = input.purchasePricePaise + input.totalFinancingCostPaise + input.totalEnergyCostPaise + input.totalMaintenancePaise + input.totalInsurancePermitsPaise + input.otherCostsPaise;
  const netProceedsFromSale = Math.max(0, input.expectedResalePaise - input.remainingLoanPaise);
  return grossCost - netProceedsFromSale;
}
function buildFiveYearForecast(input) {
  const months = 60;
  const emiResult = calculateEmi({
    principal: input.loanPrincipalPaise,
    annualInterestRate: input.annualInterestRate,
    tenureMonths: input.tenureMonths
  });
  const forecast = [];
  let cumulativeProfit = 0;
  for (let month = 1; month <= months; month++) {
    const row = emiResult.amortizationSchedule[month - 1];
    const emi = row ? input.emiPaise : 0;
    const interest = row ? row.interest : 0;
    const outstandingLoan = row ? row.closingBalance : 0;
    const revenue = input.monthlyRevenuePaise;
    const expenses = input.monthlyOperatingExpensesPaise + emi;
    const cashFlow = revenue - expenses;
    const economicProfit = revenue - input.monthlyOperatingExpensesPaise - input.monthlyDepreciationPaise - interest;
    cumulativeProfit += economicProfit;
    forecast.push({ month, revenue, expenses, cashFlow, outstandingLoan, cumulativeProfit });
  }
  return forecast;
}
var CALCULATION_VERSION = "1.0";

// src/schemas/index.ts
var import_zod = require("zod");
var PaginationSchema = import_zod.z.object({
  page: import_zod.z.coerce.number().int().min(1).max(1e3).default(1),
  limit: import_zod.z.coerce.number().int().min(1).max(100).default(20),
  sortBy: import_zod.z.string().max(50).optional(),
  sortOrder: import_zod.z.enum(["asc", "desc"]).default("desc")
});
var SignUpSchema = import_zod.z.object({
  email: import_zod.z.string().email().max(255).toLowerCase().trim(),
  password: import_zod.z.string().min(10, "Password must be at least 10 characters").max(128).regex(/[A-Z]/, "Must contain an uppercase letter").regex(/[a-z]/, "Must contain a lowercase letter").regex(/[0-9]/, "Must contain a digit").regex(/[^A-Za-z0-9]/, "Must contain a special character"),
  displayName: import_zod.z.string().min(2).max(100).trim()
});
var SignInSchema = import_zod.z.object({
  email: import_zod.z.string().email().max(255).toLowerCase().trim(),
  password: import_zod.z.string().min(1).max(128)
});
var ForgotPasswordSchema = import_zod.z.object({
  email: import_zod.z.string().email().max(255).toLowerCase().trim()
});
var ResetPasswordSchema = import_zod.z.object({
  token: import_zod.z.string().min(10).max(512),
  password: SignUpSchema.shape.password
});
var ChangePasswordSchema = import_zod.z.object({
  currentPassword: import_zod.z.string().min(1).max(128),
  newPassword: SignUpSchema.shape.password
});
var CreateBusinessSchema = import_zod.z.object({
  name: import_zod.z.string().min(2).max(200).trim(),
  region: import_zod.z.string().max(10).default("TN"),
  country: import_zod.z.string().max(5).default("IN"),
  settings: import_zod.z.object({
    workingDaysPerMonth: import_zod.z.number().int().min(1).max(31).default(25),
    emergencyReserveTarget: import_zod.z.number().min(0).default(0)
  }).optional()
});
var UpdateBusinessSchema = CreateBusinessSchema.partial();
var VehicleRegistrationRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
var CreateVehicleSchema = import_zod.z.object({
  registrationNumber: import_zod.z.string().min(6).max(12).trim().toUpperCase().regex(VehicleRegistrationRegex, "Invalid registration number format"),
  make: import_zod.z.string().min(1).max(100).trim(),
  model: import_zod.z.string().min(1).max(100).trim(),
  variant: import_zod.z.string().max(100).trim().default(""),
  year: import_zod.z.number().int().min(1990).max((/* @__PURE__ */ new Date()).getFullYear() + 1),
  seatingCapacity: import_zod.z.number().int().min(1).max(60),
  fuelType: import_zod.z.enum(["petrol", "diesel", "cng", "hybrid", "electric"]),
  purchaseDate: import_zod.z.string().datetime({ offset: true }).or(import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  purchasePrice: import_zod.z.number().int().min(0).max(1e10),
  // paise, max ₹1 crore
  currentOdometer: import_zod.z.number().int().min(0).max(1e7),
  notes: import_zod.z.string().max(1e3).optional()
});
var UpdateVehicleSchema = CreateVehicleSchema.partial().omit({ registrationNumber: true });
var CreateDriverSchema = import_zod.z.object({
  name: import_zod.z.string().min(2).max(100).trim(),
  phone: import_zod.z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  licenseNumber: import_zod.z.string().min(5).max(20).trim().toUpperCase(),
  licenseExpiry: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  joiningDate: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monthlyWage: import_zod.z.number().int().min(0).optional()
});
var CreateTripSchema = import_zod.z.object({
  vehicleId: import_zod.z.string().length(24),
  // MongoDB ObjectId
  driverId: import_zod.z.string().length(24),
  contractId: import_zod.z.string().length(24).optional(),
  source: import_zod.z.enum([
    "it_contract",
    "ola",
    "uber",
    "red_taxi",
    "other_aggregator",
    "private",
    "outstation",
    "other"
  ]),
  date: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: import_zod.z.string().regex(/^\d{2}:\d{2}$/),
  endTime: import_zod.z.string().regex(/^\d{2}:\d{2}$/).optional(),
  startOdometer: import_zod.z.number().int().min(0).max(1e7),
  endOdometer: import_zod.z.number().int().min(0).max(1e7).optional(),
  grossFare: import_zod.z.number().int().min(0).max(1e7),
  // paise
  incentives: import_zod.z.number().int().min(0).max(1e7).default(0),
  reimbursements: import_zod.z.number().int().min(0).max(1e7).default(0),
  platformCommission: import_zod.z.number().int().min(0).max(1e7).default(0),
  tolls: import_zod.z.number().int().min(0).max(1e7).default(0),
  parking: import_zod.z.number().int().min(0).max(1e7).default(0),
  otherTripExpenses: import_zod.z.number().int().min(0).max(1e7).default(0),
  paymentMethod: import_zod.z.enum(["cash", "upi", "card", "bank_transfer", "wallet", "other"]).optional(),
  idempotencyKey: import_zod.z.string().min(10).max(100),
  notes: import_zod.z.string().max(1e3).optional()
}).refine(
  (data) => data.endOdometer === void 0 || data.endOdometer >= data.startOdometer,
  { message: "End odometer must be >= start odometer", path: ["endOdometer"] }
);
var CreateFuelEntrySchema = import_zod.z.object({
  vehicleId: import_zod.z.string().length(24),
  date: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  odometer: import_zod.z.number().int().min(0).max(1e7),
  fuelType: import_zod.z.enum(["petrol", "diesel", "cng", "hybrid", "electric"]),
  quantity: import_zod.z.number().min(0.1).max(1e4),
  // litres or kWh
  unitPrice: import_zod.z.number().int().min(1).max(1e6),
  // paise per litre
  totalAmount: import_zod.z.number().int().min(1).max(1e8),
  // paise
  stationName: import_zod.z.string().max(200).optional(),
  isFullRefill: import_zod.z.boolean(),
  paymentMethod: import_zod.z.enum(["cash", "upi", "card", "bank_transfer", "wallet", "other"]).optional()
});
var EXPENSE_CATEGORIES = [
  "toll",
  "highway_fee",
  "parking",
  "waiting_area_fee",
  "platform_commission",
  "trip_allowance",
  "cleaning_route",
  "insurance",
  "road_tax",
  "registration_permit",
  "fitness_certificate",
  "puc",
  "documentation",
  "parking_rent",
  "accessories",
  "fuel",
  "oil_filter",
  "tyre",
  "wheel_service",
  "brake",
  "battery",
  "suspension",
  "ac_electrical",
  "coolant",
  "scheduled_service",
  "unexpected_repair",
  "towing",
  "driver_wages",
  "mobile_data",
  "cleaning",
  "accounting",
  "payment_fees",
  "software",
  "loan_interest",
  "other"
];
var CreateExpenseSchema = import_zod.z.object({
  vehicleId: import_zod.z.string().length(24).optional(),
  tripId: import_zod.z.string().length(24).optional(),
  date: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: import_zod.z.enum(EXPENSE_CATEGORIES),
  amount: import_zod.z.number().int().min(1).max(1e9),
  // paise
  reimbursedAmount: import_zod.z.number().int().min(0).default(0),
  vendor: import_zod.z.string().max(200).optional(),
  paymentMethod: import_zod.z.enum(["cash", "upi", "card", "bank_transfer", "wallet", "other"]).optional(),
  isRecurring: import_zod.z.boolean().default(false),
  notes: import_zod.z.string().max(1e3).optional()
});
var SimulationVehicleInputSchema = import_zod.z.object({
  make: import_zod.z.string().min(1).max(100),
  model: import_zod.z.string().min(1).max(100),
  variant: import_zod.z.string().max(100).default(""),
  year: import_zod.z.number().int().min(1990).max((/* @__PURE__ */ new Date()).getFullYear() + 1),
  fuelType: import_zod.z.enum(["petrol", "diesel", "cng", "hybrid", "electric"]),
  isNew: import_zod.z.boolean(),
  onRoadPrice: import_zod.z.number().int().min(1e6).max(1e10),
  // paise, min ₹1L
  registrationCost: import_zod.z.number().int().min(0),
  insuranceCost: import_zod.z.number().int().min(0),
  accessoriesCost: import_zod.z.number().int().min(0).default(0),
  expectedResaleValue: import_zod.z.number().int().min(0),
  ownershipPeriodYears: import_zod.z.number().int().min(1).max(20),
  annualKm: import_zod.z.number().int().min(1e3).max(5e5)
});
var SimulationFinancingInputSchema = import_zod.z.object({
  type: import_zod.z.enum(["cash", "loan", "lease", "rental"]),
  downPayment: import_zod.z.number().int().min(0),
  loanPrincipal: import_zod.z.number().int().min(0).optional(),
  annualInterestRate: import_zod.z.number().min(0).max(50).optional(),
  tenureMonths: import_zod.z.number().int().min(1).max(360).optional(),
  processingFee: import_zod.z.number().int().min(0).optional(),
  balloonPayment: import_zod.z.number().int().min(0).optional()
});
var SimulationContractInputSchema = import_zod.z.object({
  payoutPerTrip: import_zod.z.number().int().min(1).max(1e8),
  tripsPerDay: import_zod.z.number().min(0.5).max(30),
  paidKmPerTrip: import_zod.z.number().min(1).max(2e3),
  includesReturnJourney: import_zod.z.boolean(),
  emptyRunningKmPerDay: import_zod.z.number().min(0).max(1e3),
  workingDaysPerMonth: import_zod.z.number().int().min(1).max(31),
  weeklyOffs: import_zod.z.number().int().min(0).max(4),
  expectedCancellationPercent: import_zod.z.number().min(0).max(100).default(0),
  platformCommissionPercent: import_zod.z.number().min(0).max(100).default(0),
  tollsPerTrip: import_zod.z.number().int().min(0).default(0),
  parkingPerTrip: import_zod.z.number().int().min(0).default(0)
});
var CreateSimulationSchema = import_zod.z.object({
  name: import_zod.z.string().min(1).max(200),
  description: import_zod.z.string().max(1e3).optional(),
  vehicleDetails: SimulationVehicleInputSchema,
  financingDetails: SimulationFinancingInputSchema,
  fuelDetails: import_zod.z.object({
    unitPrice: import_zod.z.number().int().min(1).max(1e6),
    realWorldEfficiency: import_zod.z.number().min(0.1).max(1e3),
    cityHighwayMix: import_zod.z.number().min(0).max(1),
    expectedPriceChangePercent: import_zod.z.number().min(-100).max(500).optional()
  }),
  contractDetails: SimulationContractInputSchema
});
var CreateMaintenanceItemSchema = import_zod.z.object({
  vehicleId: import_zod.z.string().length(24),
  itemName: import_zod.z.string().min(1).max(200),
  lastServiceDate: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lastServiceOdometer: import_zod.z.number().int().min(0).optional(),
  nextDueDate: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nextDueOdometer: import_zod.z.number().int().min(0).optional(),
  intervalDays: import_zod.z.number().int().min(1).optional(),
  intervalKm: import_zod.z.number().int().min(1).optional(),
  estimatedCost: import_zod.z.number().int().min(0).optional(),
  notes: import_zod.z.string().max(1e3).optional()
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CALCULATION_VERSION,
  ChangePasswordSchema,
  CreateBusinessSchema,
  CreateDriverSchema,
  CreateExpenseSchema,
  CreateFuelEntrySchema,
  CreateMaintenanceItemSchema,
  CreateSimulationSchema,
  CreateTripSchema,
  CreateVehicleSchema,
  ForgotPasswordSchema,
  PaginationSchema,
  ResetPasswordSchema,
  SignInSchema,
  SignUpSchema,
  SimulationContractInputSchema,
  SimulationFinancingInputSchema,
  SimulationVehicleInputSchema,
  UpdateBusinessSchema,
  UpdateVehicleSchema,
  VehicleRegistrationRegex,
  buildFiveYearForecast,
  calculateBreakEven,
  calculateEconomicProfit,
  calculateEmi,
  calculateMileage,
  calculateMonthlyCashFlow,
  calculateOperatingProfit,
  calculateStraightLineDepreciation,
  calculateTco,
  calculateTripContribution,
  calculateTripRevenue,
  costPerKm,
  estimateFuelCost,
  formatINR,
  fromPaise,
  toPaise
});
