/**
 * FleetWise Financial Calculation Engine v1.0
 *
 * All monetary values are in paise (1 INR = 100 paise) stored as integers
 * to avoid floating-point accumulation errors in ledger balances.
 *
 * Helper: toPaise(amount: number) and fromPaise(paise: number).
 * Intermediate calculations use regular numbers; only final ledger values
 * are rounded via Math.round before storage.
 */

// ─── Currency helpers ─────────────────────────────────────────────────────────

/** Convert INR (float) to paise (integer) */
export const toPaise = (inr: number): number => Math.round(inr * 100);

/** Convert paise (integer) to INR (float, 2dp) */
export const fromPaise = (paise: number): number => paise / 100;

/** Format INR for display */
export const formatINR = (paise: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(fromPaise(paise));

// ─── EMI calculation ──────────────────────────────────────────────────────────

export interface EmiInput {
  principal: number;       // in paise
  annualInterestRate: number; // e.g. 8.5 for 8.5%
  tenureMonths: number;
  processingFee?: number;  // in paise
  balloonPayment?: number; // in paise, if applicable
}

export interface EmiResult {
  monthlyEmi: number;      // in paise
  totalPayable: number;    // in paise (EMI × months + balloon)
  totalInterest: number;   // in paise
  effectiveRate: number;   // effective annual rate after fees
  amortizationSchedule: AmortizationRow[];
}

export interface AmortizationRow {
  month: number;
  openingBalance: number;  // paise
  interest: number;        // paise
  principal: number;       // paise
  emi: number;             // paise
  closingBalance: number;  // paise
}

/**
 * Calculate standard EMI using reducing-balance formula:
 *   EMI = P × r × (1 + r)^n / ((1 + r)^n − 1)
 * where r = monthly interest rate (annual / 12 / 100)
 */
export function calculateEmi(input: EmiInput): EmiResult {
  const { principal, annualInterestRate, tenureMonths, processingFee = 0, balloonPayment = 0 } = input;

  // Zero-interest loan
  if (annualInterestRate === 0) {
    const monthlyEmi = Math.round(principal / tenureMonths);
    const totalPayable = monthlyEmi * tenureMonths + balloonPayment;
    const schedule = buildZeroInterestSchedule(principal, monthlyEmi, tenureMonths, balloonPayment);
    return {
      monthlyEmi,
      totalPayable,
      totalInterest: 0,
      effectiveRate: 0,
      amortizationSchedule: schedule,
    };
  }

  const r = annualInterestRate / 12 / 100;
  const n = tenureMonths;
  const raisedFactor = Math.pow(1 + r, n);
  const monthlyEmi = Math.round((principal * r * raisedFactor) / (raisedFactor - 1));

  const schedule: AmortizationRow[] = [];
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
      closingBalance: closing,
    });

    balance = closing;
  }

  const totalPayable = monthlyEmi * n + balloonPayment;
  const totalInterest = totalPayable - principal - balloonPayment + processingFee;

  // Effective rate approximation (includes processing fee)
  const effectiveRate =
    processingFee > 0
      ? annualInterestRate * (1 + processingFee / principal)
      : annualInterestRate;

  return { monthlyEmi, totalPayable, totalInterest, effectiveRate, amortizationSchedule: schedule };
}

function buildZeroInterestSchedule(
  principal: number,
  monthlyEmi: number,
  n: number,
  balloonPayment: number,
): AmortizationRow[] {
  const schedule: AmortizationRow[] = [];
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
      closingBalance: closing,
    });
    balance = closing;
  }
  return schedule;
}

// ─── Fuel calculations ────────────────────────────────────────────────────────

export interface FuelCostInput {
  km: number;
  efficiencyKmPerLitre: number;  // km/l (for EV: km per kWh)
  unitPricePaise: number;        // price per litre or per kWh in paise
}

/** Estimated fuel cost in paise for a given distance */
export function estimateFuelCost(input: FuelCostInput): number {
  const { km, efficiencyKmPerLitre, unitPricePaise } = input;
  if (efficiencyKmPerLitre <= 0) throw new RangeError('Efficiency must be positive');
  const litres = km / efficiencyKmPerLitre;
  return Math.round(litres * unitPricePaise);
}

/** km/l from two odometer readings and quantity refilled */
export function calculateMileage(
  startOdometer: number,
  endOdometer: number,
  litresRefilled: number,
): number | null {
  const km = endOdometer - startOdometer;
  if (km <= 0 || litresRefilled <= 0) return null;
  return km / litresRefilled;
}

// ─── Trip financials ──────────────────────────────────────────────────────────

export interface TripRevenueInput {
  grossFare: number;           // paise
  incentives: number;          // paise
  reimbursements: number;      // paise (tolls + parking paid by customer)
  platformCommission: number;  // paise
}

export interface TripRevenueResult {
  grossRevenue: number;  // paise
  netRevenue: number;    // paise (after commission and deductions)
}

export function calculateTripRevenue(input: TripRevenueInput): TripRevenueResult {
  const grossRevenue = input.grossFare + input.incentives + input.reimbursements;
  const netRevenue = grossRevenue - input.platformCommission;
  return { grossRevenue, netRevenue };
}

export interface TripContributionInput {
  netRevenue: number;        // paise
  fuelCostAllocated: number; // paise (estimated for this trip)
  tolls: number;             // paise (non-reimbursed)
  parking: number;           // paise (non-reimbursed)
  otherDirectCosts: number;  // paise
}

export function calculateTripContribution(input: TripContributionInput): number {
  const totalCost =
    input.fuelCostAllocated +
    input.tolls +
    input.parking +
    input.otherDirectCosts;
  return input.netRevenue - totalCost;
}

// ─── Monthly / periodic financials ────────────────────────────────────────────

export interface MonthlyCashFlowInput {
  cashReceipts: number;          // paise
  operatingExpenses: number;     // paise
  emiAmount: number;             // paise
  capitalExpenditure: number;    // paise
  otherCashOutflows: number;     // paise
}

export function calculateMonthlyCashFlow(input: MonthlyCashFlowInput): number {
  return (
    input.cashReceipts -
    input.operatingExpenses -
    input.emiAmount -
    input.capitalExpenditure -
    input.otherCashOutflows
  );
}

export interface OperatingProfitInput {
  netRevenue: number;        // paise
  operatingExpenses: number; // paise (excluding depreciation and financing)
}

export function calculateOperatingProfit(input: OperatingProfitInput): number {
  return input.netRevenue - input.operatingExpenses;
}

export interface EconomicProfitInput {
  netRevenue: number;          // paise
  operatingExpenses: number;   // paise
  monthlyDepreciation: number; // paise
  interestExpense: number;     // paise
  otherExpenses: number;       // paise
}

export function calculateEconomicProfit(input: EconomicProfitInput): number {
  return (
    input.netRevenue -
    input.operatingExpenses -
    input.monthlyDepreciation -
    input.interestExpense -
    input.otherExpenses
  );
}

// ─── Depreciation ─────────────────────────────────────────────────────────────

export interface DepreciationInput {
  purchasePricePaise: number;
  expectedResalePaise: number;
  ownershipPeriodMonths: number;
}

export function calculateStraightLineDepreciation(input: DepreciationInput): number {
  const total = input.purchasePricePaise - input.expectedResalePaise;
  return Math.round(total / input.ownershipPeriodMonths);
}

// ─── Break-even ───────────────────────────────────────────────────────────────

export interface BreakEvenInput {
  fixedMonthlyCosts: number;        // paise (EMI interest + insurance / 12 + permits / 12 + depreciation)
  variableCostPerTrip: number;      // paise (fuel per trip + tolls + parking)
  platformCommissionPercent: number; // e.g. 20 for 20%
  tripsPerMonth: number;
}

export interface BreakEvenResult {
  cashBreakEvenPerTrip: number;     // paise
  economicBreakEvenPerTrip: number; // paise (includes depreciation)
  breakEvenTripsPerDay: number;
  margin: number; // paise above break-even per trip at current payout
}

export function calculateBreakEven(
  input: BreakEvenInput,
  currentPayoutPerTrip: number,
  workingDaysPerMonth: number,
  monthlyDepreciation: number,
): BreakEvenResult {
  const commissionFactor = 1 - input.platformCommissionPercent / 100;

  // Cash break-even: cover only cash expenses (no depreciation)
  const cashBreakEvenPerTrip = Math.round(
    input.fixedMonthlyCosts / input.tripsPerMonth / commissionFactor +
    input.variableCostPerTrip / commissionFactor,
  );

  // Economic break-even: include monthly depreciation
  const economicBreakEvenPerTrip = Math.round(
    (input.fixedMonthlyCosts + monthlyDepreciation) / input.tripsPerMonth / commissionFactor +
    input.variableCostPerTrip / commissionFactor,
  );

  const breakEvenTripsPerDay = parseFloat(
    (cashBreakEvenPerTrip / (currentPayoutPerTrip * commissionFactor || 1) *
      (workingDaysPerMonth > 0 ? 1 : 0)).toFixed(2),
  );

  const margin = currentPayoutPerTrip * commissionFactor - cashBreakEvenPerTrip;

  return { cashBreakEvenPerTrip, economicBreakEvenPerTrip, breakEvenTripsPerDay, margin };
}

// ─── Cost per kilometre ───────────────────────────────────────────────────────

export function costPerKm(totalCostPaise: number, totalKm: number): number {
  if (totalKm <= 0) return 0;
  return Math.round(totalCostPaise / totalKm);
}

// ─── Total cost of ownership ──────────────────────────────────────────────────

export interface TcoInput {
  purchasePricePaise: number;
  totalFinancingCostPaise: number;  // total interest + fees
  totalEnergyCostPaise: number;
  totalMaintenancePaise: number;
  totalInsurancePermitsPaise: number;
  otherCostsPaise: number;
  expectedResalePaise: number;
  remainingLoanPaise: number;
}

export function calculateTco(input: TcoInput): number {
  const grossCost =
    input.purchasePricePaise +
    input.totalFinancingCostPaise +
    input.totalEnergyCostPaise +
    input.totalMaintenancePaise +
    input.totalInsurancePermitsPaise +
    input.otherCostsPaise;

  const netProceedsFromSale = Math.max(0, input.expectedResalePaise - input.remainingLoanPaise);

  return grossCost - netProceedsFromSale;
}

// ─── Five-year ownership forecast ─────────────────────────────────────────────

export interface ForecastInput {
  monthlyRevenuePaise: number;
  monthlyOperatingExpensesPaise: number;
  emiPaise: number;
  monthlyDepreciationPaise: number;
  loanPrincipalPaise: number;
  tenureMonths: number;
  annualInterestRate: number;
}

export function buildFiveYearForecast(input: ForecastInput) {
  const months = 60;
  const emiResult = calculateEmi({
    principal: input.loanPrincipalPaise,
    annualInterestRate: input.annualInterestRate,
    tenureMonths: input.tenureMonths,
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

// ─── Calculation version ──────────────────────────────────────────────────────
export const CALCULATION_VERSION = '1.0';
