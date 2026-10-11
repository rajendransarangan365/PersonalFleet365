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
import { z } from "zod";
var PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1e3).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});
var SignUpSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  password: z.string().min(10, "Password must be at least 10 characters").max(128).regex(/[A-Z]/, "Must contain an uppercase letter").regex(/[a-z]/, "Must contain a lowercase letter").regex(/[0-9]/, "Must contain a digit").regex(/[^A-Za-z0-9]/, "Must contain a special character"),
  displayName: z.string().min(2).max(100).trim()
});
var SignInSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  password: z.string().min(1).max(128)
});
var ForgotPasswordSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim()
});
var ResetPasswordSchema = z.object({
  token: z.string().min(10).max(512),
  password: SignUpSchema.shape.password
});
var ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: SignUpSchema.shape.password
});
var CreateBusinessSchema = z.object({
  name: z.string().min(2).max(200).trim(),
  region: z.string().max(10).default("TN"),
  country: z.string().max(5).default("IN"),
  settings: z.object({
    workingDaysPerMonth: z.number().int().min(1).max(31).default(25),
    emergencyReserveTarget: z.number().min(0).default(0)
  }).optional()
});
var UpdateBusinessSchema = CreateBusinessSchema.partial();
var VehicleRegistrationRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
var CreateVehicleSchema = z.object({
  registrationNumber: z.string().min(6).max(12).trim().toUpperCase().regex(VehicleRegistrationRegex, "Invalid registration number format"),
  make: z.string().min(1).max(100).trim(),
  model: z.string().min(1).max(100).trim(),
  variant: z.string().max(100).trim().default(""),
  year: z.number().int().min(1990).max((/* @__PURE__ */ new Date()).getFullYear() + 1),
  seatingCapacity: z.number().int().min(1).max(60),
  fuelType: z.enum(["petrol", "diesel", "cng", "hybrid", "electric"]),
  purchaseDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  purchasePrice: z.number().int().min(0).max(1e10),
  // paise, max ₹1 crore
  currentOdometer: z.number().int().min(0).max(1e7),
  notes: z.string().max(1e3).optional()
});
var UpdateVehicleSchema = CreateVehicleSchema.partial().omit({ registrationNumber: true });
var CreateDriverSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  licenseNumber: z.string().min(5).max(20).trim().toUpperCase(),
  licenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monthlyWage: z.number().int().min(0).optional()
});
var CreateTripSchema = z.object({
  vehicleId: z.string().length(24),
  // MongoDB ObjectId
  driverId: z.string().length(24),
  contractId: z.string().length(24).optional(),
  source: z.enum([
    "it_contract",
    "ola",
    "uber",
    "red_taxi",
    "other_aggregator",
    "private",
    "outstation",
    "other"
  ]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  startOdometer: z.number().int().min(0).max(1e7),
  endOdometer: z.number().int().min(0).max(1e7).optional(),
  grossFare: z.number().int().min(0).max(1e7),
  // paise
  incentives: z.number().int().min(0).max(1e7).default(0),
  reimbursements: z.number().int().min(0).max(1e7).default(0),
  platformCommission: z.number().int().min(0).max(1e7).default(0),
  tolls: z.number().int().min(0).max(1e7).default(0),
  parking: z.number().int().min(0).max(1e7).default(0),
  otherTripExpenses: z.number().int().min(0).max(1e7).default(0),
  paymentMethod: z.enum(["cash", "upi", "card", "bank_transfer", "wallet", "other"]).optional(),
  idempotencyKey: z.string().min(10).max(100),
  notes: z.string().max(1e3).optional()
}).refine(
  (data) => data.endOdometer === void 0 || data.endOdometer >= data.startOdometer,
  { message: "End odometer must be >= start odometer", path: ["endOdometer"] }
);
var CreateFuelEntrySchema = z.object({
  vehicleId: z.string().length(24),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  odometer: z.number().int().min(0).max(1e7),
  fuelType: z.enum(["petrol", "diesel", "cng", "hybrid", "electric"]),
  quantity: z.number().min(0.1).max(1e4),
  // litres or kWh
  unitPrice: z.number().int().min(1).max(1e6),
  // paise per litre
  totalAmount: z.number().int().min(1).max(1e8),
  // paise
  stationName: z.string().max(200).optional(),
  isFullRefill: z.boolean(),
  paymentMethod: z.enum(["cash", "upi", "card", "bank_transfer", "wallet", "other"]).optional()
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
var CreateExpenseSchema = z.object({
  vehicleId: z.string().length(24).optional(),
  tripId: z.string().length(24).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().int().min(1).max(1e9),
  // paise
  reimbursedAmount: z.number().int().min(0).default(0),
  vendor: z.string().max(200).optional(),
  paymentMethod: z.enum(["cash", "upi", "card", "bank_transfer", "wallet", "other"]).optional(),
  isRecurring: z.boolean().default(false),
  notes: z.string().max(1e3).optional()
});
var SimulationVehicleInputSchema = z.object({
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  variant: z.string().max(100).default(""),
  year: z.number().int().min(1990).max((/* @__PURE__ */ new Date()).getFullYear() + 1),
  fuelType: z.enum(["petrol", "diesel", "cng", "hybrid", "electric"]),
  isNew: z.boolean(),
  onRoadPrice: z.number().int().min(1e6).max(1e10),
  // paise, min ₹1L
  registrationCost: z.number().int().min(0),
  insuranceCost: z.number().int().min(0),
  accessoriesCost: z.number().int().min(0).default(0),
  expectedResaleValue: z.number().int().min(0),
  ownershipPeriodYears: z.number().int().min(1).max(20),
  annualKm: z.number().int().min(1e3).max(5e5)
});
var SimulationFinancingInputSchema = z.object({
  type: z.enum(["cash", "loan", "lease", "rental"]),
  downPayment: z.number().int().min(0),
  loanPrincipal: z.number().int().min(0).optional(),
  annualInterestRate: z.number().min(0).max(50).optional(),
  tenureMonths: z.number().int().min(1).max(360).optional(),
  processingFee: z.number().int().min(0).optional(),
  balloonPayment: z.number().int().min(0).optional()
});
var SimulationContractInputSchema = z.object({
  payoutPerTrip: z.number().int().min(1).max(1e8),
  tripsPerDay: z.number().min(0.5).max(30),
  paidKmPerTrip: z.number().min(1).max(2e3),
  includesReturnJourney: z.boolean(),
  emptyRunningKmPerDay: z.number().min(0).max(1e3),
  workingDaysPerMonth: z.number().int().min(1).max(31),
  weeklyOffs: z.number().int().min(0).max(4),
  expectedCancellationPercent: z.number().min(0).max(100).default(0),
  platformCommissionPercent: z.number().min(0).max(100).default(0),
  tollsPerTrip: z.number().int().min(0).default(0),
  parkingPerTrip: z.number().int().min(0).default(0)
});
var CreateSimulationSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1e3).optional(),
  vehicleDetails: SimulationVehicleInputSchema,
  financingDetails: SimulationFinancingInputSchema,
  fuelDetails: z.object({
    unitPrice: z.number().int().min(1).max(1e6),
    realWorldEfficiency: z.number().min(0.1).max(1e3),
    cityHighwayMix: z.number().min(0).max(1),
    expectedPriceChangePercent: z.number().min(-100).max(500).optional()
  }),
  contractDetails: SimulationContractInputSchema
});
var CreateMaintenanceItemSchema = z.object({
  vehicleId: z.string().length(24),
  itemName: z.string().min(1).max(200),
  lastServiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lastServiceOdometer: z.number().int().min(0).optional(),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nextDueOdometer: z.number().int().min(0).optional(),
  intervalDays: z.number().int().min(1).optional(),
  intervalKm: z.number().int().min(1).optional(),
  estimatedCost: z.number().int().min(0).optional(),
  notes: z.string().max(1e3).optional()
});
export {
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
};
