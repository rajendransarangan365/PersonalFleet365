import { z } from 'zod';

type UserRole = 'platform_admin' | 'business_owner' | 'fleet_manager' | 'accountant' | 'dispatcher' | 'driver' | 'auditor';
type Permission = 'vehicle.read' | 'vehicle.create' | 'vehicle.update' | 'vehicle.delete' | 'trip.read' | 'trip.create' | 'trip.update' | 'trip.cancel' | 'expense.read' | 'expense.create' | 'expense.approve' | 'finance.read' | 'finance.export' | 'maintenance.manage' | 'users.manage' | 'reports.view' | 'contract.read' | 'contract.create' | 'contract.update' | 'driver.read' | 'driver.create' | 'driver.update';
type FuelType = 'petrol' | 'diesel' | 'cng' | 'hybrid' | 'electric';
type VehicleStatus = 'active' | 'available' | 'assigned' | 'in_service' | 'breakdown' | 'inactive' | 'sold';
type TripSource = 'it_contract' | 'ola' | 'uber' | 'red_taxi' | 'other_aggregator' | 'private' | 'outstation' | 'other';
type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'wallet' | 'other';
type PaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
type ExpenseCategory = 'toll' | 'highway_fee' | 'parking' | 'waiting_area_fee' | 'platform_commission' | 'trip_allowance' | 'cleaning_route' | 'insurance' | 'road_tax' | 'registration_permit' | 'fitness_certificate' | 'puc' | 'documentation' | 'parking_rent' | 'accessories' | 'fuel' | 'oil_filter' | 'tyre' | 'wheel_service' | 'brake' | 'battery' | 'suspension' | 'ac_electrical' | 'coolant' | 'scheduled_service' | 'unexpected_repair' | 'towing' | 'driver_wages' | 'mobile_data' | 'cleaning' | 'accounting' | 'payment_fees' | 'software' | 'loan_interest' | 'other';
type FinancingType = 'cash' | 'loan' | 'lease' | 'rental';
type ScenarioType = 'conservative' | 'expected' | 'optimistic';
type NotificationType = 'service_reminder' | 'document_expiry' | 'emi_due' | 'contract_expiry' | 'unpaid_invoice' | 'low_reserve' | 'high_maintenance' | 'negative_cashflow' | 'vehicle_downtime';
interface BaseDocument {
    _id: string;
    createdAt: string;
    updatedAt: string;
}
interface TenantDocument extends BaseDocument {
    businessId: string;
}
interface User extends BaseDocument {
    email: string;
    displayName: string;
    emailVerified: boolean;
    mfaEnabled: boolean;
    isActive: boolean;
    lastLoginAt?: string;
}
interface BusinessMembership extends TenantDocument {
    userId: string;
    role: UserRole;
    permissions: Permission[];
    invitedBy?: string;
    joinedAt?: string;
}
interface Business extends BaseDocument {
    name: string;
    ownerId: string;
    currency: string;
    region: string;
    country: string;
    subscriptionTier: 'free' | 'basic' | 'pro' | 'enterprise';
    settings: BusinessSettings;
    isActive: boolean;
}
interface BusinessSettings {
    taxRates: Record<string, number>;
    fuelPrices: FuelPriceConfig;
    defaultMileage: Record<FuelType, number>;
    workingDaysPerMonth: number;
    emergencyReserveTarget: number;
}
interface FuelPriceConfig {
    petrol: number;
    diesel: number;
    cng: number;
    electricity: number;
    updatedAt: string;
}
interface Vehicle extends TenantDocument {
    registrationNumber: string;
    make: string;
    model: string;
    variant: string;
    year: number;
    seatingCapacity: number;
    fuelType: FuelType;
    purchaseDate: string;
    purchasePrice: number;
    currentOdometer: number;
    status: VehicleStatus;
    assignedDriverId?: string;
    insurance?: InsuranceInfo;
    permits?: PermitInfo[];
    loanId?: string;
    notes?: string;
}
interface InsuranceInfo {
    provider: string;
    policyNumber: string;
    expiryDate: string;
    premium: number;
}
interface PermitInfo {
    type: string;
    number: string;
    expiryDate: string;
}
interface Driver extends TenantDocument {
    userId?: string;
    name: string;
    phone: string;
    licenseNumber: string;
    licenseExpiry: string;
    isActive: boolean;
    assignedVehicleId?: string;
    joiningDate: string;
    monthlyWage?: number;
}
interface Contract extends TenantDocument {
    companyName: string;
    contractReference: string;
    vehicleId: string;
    driverId?: string;
    startDate: string;
    endDate: string;
    payoutPerTrip: number;
    tripsPerDay: number;
    paidKmPerTrip: number;
    includesReturnJourney: boolean;
    waitingChargePerHour?: number;
    overtimeRate?: number;
    tollReimbursed: boolean;
    parkingReimbursed: boolean;
    guaranteedTripsPerMonth?: number;
    paymentCycleDays: number;
    deductionsPolicy?: string;
    status: 'active' | 'expired' | 'terminated' | 'draft';
}
interface Trip extends TenantDocument {
    vehicleId: string;
    driverId: string;
    contractId?: string;
    source: TripSource;
    date: string;
    startTime: string;
    endTime?: string;
    startOdometer: number;
    endOdometer?: number;
    totalKm?: number;
    paidKm?: number;
    emptyKm?: number;
    grossFare: number;
    incentives: number;
    reimbursements: number;
    platformCommission: number;
    tolls: number;
    parking: number;
    otherTripExpenses: number;
    paymentStatus: PaymentStatus;
    paymentMethod?: PaymentMethod;
    idempotencyKey: string;
    notes?: string;
    receiptUrl?: string;
}
interface FuelEntry extends TenantDocument {
    vehicleId: string;
    date: string;
    odometer: number;
    fuelType: FuelType;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    stationName?: string;
    isFullRefill: boolean;
    paymentMethod?: PaymentMethod;
    receiptUrl?: string;
}
interface Expense extends TenantDocument {
    vehicleId?: string;
    tripId?: string;
    date: string;
    category: ExpenseCategory;
    amount: number;
    reimbursedAmount: number;
    netAmount: number;
    vendor?: string;
    paymentMethod?: PaymentMethod;
    isRecurring: boolean;
    recurringSchedule?: string;
    receiptUrl?: string;
    notes?: string;
    createdBy: string;
    approvedBy?: string;
}
interface MaintenanceItem extends TenantDocument {
    vehicleId: string;
    itemName: string;
    lastServiceDate?: string;
    lastServiceOdometer?: number;
    nextDueDate?: string;
    nextDueOdometer?: number;
    intervalDays?: number;
    intervalKm?: number;
    estimatedCost?: number;
    notes?: string;
}
interface ServiceRecord extends TenantDocument {
    vehicleId: string;
    maintenanceItemId?: string;
    date: string;
    odometer: number;
    description: string;
    actualCost: number;
    workshop?: string;
    invoiceUrl?: string;
    warranty?: string;
}
interface VehicleLoan extends TenantDocument {
    vehicleId: string;
    lenderName: string;
    principal: number;
    downPayment: number;
    annualInterestRate: number;
    tenureMonths: number;
    processingFee: number;
    emiAmount: number;
    startDate: string;
    balloonPayment?: number;
    outstandingBalance: number;
    isSettled: boolean;
    actualLenderEmi?: number;
}
interface Simulation extends TenantDocument {
    name: string;
    description?: string;
    vehicleDetails: SimulationVehicleInput;
    financingDetails: SimulationFinancingInput;
    fuelDetails: SimulationFuelInput;
    contractDetails: SimulationContractInput;
    scenarios: SimulationScenario[];
    calculationVersion: string;
    savedAt: string;
}
interface SimulationVehicleInput {
    make: string;
    model: string;
    variant: string;
    year: number;
    fuelType: FuelType;
    isNew: boolean;
    onRoadPrice: number;
    registrationCost: number;
    insuranceCost: number;
    accessoriesCost: number;
    expectedResaleValue: number;
    ownershipPeriodYears: number;
    annualKm: number;
}
interface SimulationFinancingInput {
    type: FinancingType;
    downPayment: number;
    loanPrincipal?: number;
    annualInterestRate?: number;
    tenureMonths?: number;
    processingFee?: number;
    balloonPayment?: number;
}
interface SimulationFuelInput {
    unitPrice: number;
    realWorldEfficiency: number;
    cityHighwayMix: number;
    expectedPriceChangePercent?: number;
}
interface SimulationContractInput {
    payoutPerTrip: number;
    tripsPerDay: number;
    paidKmPerTrip: number;
    includesReturnJourney: boolean;
    emptyRunningKmPerDay: number;
    workingDaysPerMonth: number;
    weeklyOffs: number;
    expectedCancellationPercent: number;
    platformCommissionPercent?: number;
    tollsPerTrip?: number;
    parkingPerTrip?: number;
}
interface SimulationScenario extends BaseDocument {
    simulationId: string;
    type: ScenarioType;
    label: string;
    overrides: Partial<SimulationContractInput & SimulationFuelInput>;
    result?: SimulationResult;
}
interface SimulationResult {
    monthlyRevenue: number;
    operatingExpenses: number;
    emi: number;
    cashFlow: number;
    operatingProfit: number;
    economicProfit: number;
    breakEvenPayoutPerTrip: number;
    breakEvenTripsPerDay: number;
    costPerTotalKm: number;
    costPerPaidKm: number;
    paybackMonths: number;
    fiveYearForecast: MonthlyForecast[];
}
interface MonthlyForecast {
    month: number;
    revenue: number;
    expenses: number;
    cashFlow: number;
    outstandingLoan: number;
    cumulativeProfit: number;
}
interface Notification extends TenantDocument {
    userId?: string;
    type: NotificationType;
    title: string;
    message: string;
    isRead: boolean;
    entityType?: string;
    entityId?: string;
    scheduledFor?: string;
}
interface AuditEvent extends TenantDocument {
    actorUserId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    beforeSnapshot?: Record<string, unknown>;
    afterSnapshot?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}
interface ApiResponse<T> {
    success: true;
    data: T;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        correlationId?: string;
    };
}
interface ApiError {
    success: false;
    error: {
        code: string;
        message: string;
        fields?: Record<string, string[]>;
        correlationId?: string;
    };
}
type ApiResult<T> = ApiResponse<T> | ApiError;
interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

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
/** Convert INR (float) to paise (integer) */
declare const toPaise: (inr: number) => number;
/** Convert paise (integer) to INR (float, 2dp) */
declare const fromPaise: (paise: number) => number;
/** Format INR for display */
declare const formatINR: (paise: number) => string;
interface EmiInput {
    principal: number;
    annualInterestRate: number;
    tenureMonths: number;
    processingFee?: number;
    balloonPayment?: number;
}
interface EmiResult {
    monthlyEmi: number;
    totalPayable: number;
    totalInterest: number;
    effectiveRate: number;
    amortizationSchedule: AmortizationRow[];
}
interface AmortizationRow {
    month: number;
    openingBalance: number;
    interest: number;
    principal: number;
    emi: number;
    closingBalance: number;
}
/**
 * Calculate standard EMI using reducing-balance formula:
 *   EMI = P × r × (1 + r)^n / ((1 + r)^n − 1)
 * where r = monthly interest rate (annual / 12 / 100)
 */
declare function calculateEmi(input: EmiInput): EmiResult;
interface FuelCostInput {
    km: number;
    efficiencyKmPerLitre: number;
    unitPricePaise: number;
}
/** Estimated fuel cost in paise for a given distance */
declare function estimateFuelCost(input: FuelCostInput): number;
/** km/l from two odometer readings and quantity refilled */
declare function calculateMileage(startOdometer: number, endOdometer: number, litresRefilled: number): number | null;
interface TripRevenueInput {
    grossFare: number;
    incentives: number;
    reimbursements: number;
    platformCommission: number;
}
interface TripRevenueResult {
    grossRevenue: number;
    netRevenue: number;
}
declare function calculateTripRevenue(input: TripRevenueInput): TripRevenueResult;
interface TripContributionInput {
    netRevenue: number;
    fuelCostAllocated: number;
    tolls: number;
    parking: number;
    otherDirectCosts: number;
}
declare function calculateTripContribution(input: TripContributionInput): number;
interface MonthlyCashFlowInput {
    cashReceipts: number;
    operatingExpenses: number;
    emiAmount: number;
    capitalExpenditure: number;
    otherCashOutflows: number;
}
declare function calculateMonthlyCashFlow(input: MonthlyCashFlowInput): number;
interface OperatingProfitInput {
    netRevenue: number;
    operatingExpenses: number;
}
declare function calculateOperatingProfit(input: OperatingProfitInput): number;
interface EconomicProfitInput {
    netRevenue: number;
    operatingExpenses: number;
    monthlyDepreciation: number;
    interestExpense: number;
    otherExpenses: number;
}
declare function calculateEconomicProfit(input: EconomicProfitInput): number;
interface DepreciationInput {
    purchasePricePaise: number;
    expectedResalePaise: number;
    ownershipPeriodMonths: number;
}
declare function calculateStraightLineDepreciation(input: DepreciationInput): number;
interface BreakEvenInput {
    fixedMonthlyCosts: number;
    variableCostPerTrip: number;
    platformCommissionPercent: number;
    tripsPerMonth: number;
}
interface BreakEvenResult {
    cashBreakEvenPerTrip: number;
    economicBreakEvenPerTrip: number;
    breakEvenTripsPerDay: number;
    margin: number;
}
declare function calculateBreakEven(input: BreakEvenInput, currentPayoutPerTrip: number, workingDaysPerMonth: number, monthlyDepreciation: number): BreakEvenResult;
declare function costPerKm(totalCostPaise: number, totalKm: number): number;
interface TcoInput {
    purchasePricePaise: number;
    totalFinancingCostPaise: number;
    totalEnergyCostPaise: number;
    totalMaintenancePaise: number;
    totalInsurancePermitsPaise: number;
    otherCostsPaise: number;
    expectedResalePaise: number;
    remainingLoanPaise: number;
}
declare function calculateTco(input: TcoInput): number;
interface ForecastInput {
    monthlyRevenuePaise: number;
    monthlyOperatingExpensesPaise: number;
    emiPaise: number;
    monthlyDepreciationPaise: number;
    loanPrincipalPaise: number;
    tenureMonths: number;
    annualInterestRate: number;
}
declare function buildFiveYearForecast(input: ForecastInput): {
    month: number;
    revenue: number;
    expenses: number;
    cashFlow: number;
    outstandingLoan: number;
    cumulativeProfit: number;
}[];
declare const CALCULATION_VERSION = "1.0";

declare const PaginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    sortBy?: string | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
declare const SignUpSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    displayName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    displayName: string;
}, {
    email: string;
    password: string;
    displayName: string;
}>;
declare const SignInSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
declare const ForgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
declare const ResetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    token: string;
}, {
    password: string;
    token: string;
}>;
declare const ChangePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword: string;
    newPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
}>;
declare const CreateBusinessSchema: z.ZodObject<{
    name: z.ZodString;
    region: z.ZodDefault<z.ZodString>;
    country: z.ZodDefault<z.ZodString>;
    settings: z.ZodOptional<z.ZodObject<{
        workingDaysPerMonth: z.ZodDefault<z.ZodNumber>;
        emergencyReserveTarget: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        workingDaysPerMonth: number;
        emergencyReserveTarget: number;
    }, {
        workingDaysPerMonth?: number | undefined;
        emergencyReserveTarget?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    region: string;
    country: string;
    settings?: {
        workingDaysPerMonth: number;
        emergencyReserveTarget: number;
    } | undefined;
}, {
    name: string;
    region?: string | undefined;
    country?: string | undefined;
    settings?: {
        workingDaysPerMonth?: number | undefined;
        emergencyReserveTarget?: number | undefined;
    } | undefined;
}>;
declare const UpdateBusinessSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    country: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    settings: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        workingDaysPerMonth: z.ZodDefault<z.ZodNumber>;
        emergencyReserveTarget: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        workingDaysPerMonth: number;
        emergencyReserveTarget: number;
    }, {
        workingDaysPerMonth?: number | undefined;
        emergencyReserveTarget?: number | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    region?: string | undefined;
    country?: string | undefined;
    settings?: {
        workingDaysPerMonth: number;
        emergencyReserveTarget: number;
    } | undefined;
}, {
    name?: string | undefined;
    region?: string | undefined;
    country?: string | undefined;
    settings?: {
        workingDaysPerMonth?: number | undefined;
        emergencyReserveTarget?: number | undefined;
    } | undefined;
}>;
declare const VehicleRegistrationRegex: RegExp;
declare const CreateVehicleSchema: z.ZodObject<{
    registrationNumber: z.ZodString;
    make: z.ZodString;
    model: z.ZodString;
    variant: z.ZodDefault<z.ZodString>;
    year: z.ZodNumber;
    seatingCapacity: z.ZodNumber;
    fuelType: z.ZodEnum<["petrol", "diesel", "cng", "hybrid", "electric"]>;
    purchaseDate: z.ZodUnion<[z.ZodString, z.ZodString]>;
    purchasePrice: z.ZodNumber;
    currentOdometer: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    registrationNumber: string;
    make: string;
    model: string;
    variant: string;
    year: number;
    seatingCapacity: number;
    fuelType: "petrol" | "diesel" | "cng" | "hybrid" | "electric";
    purchaseDate: string;
    purchasePrice: number;
    currentOdometer: number;
    notes?: string | undefined;
}, {
    registrationNumber: string;
    make: string;
    model: string;
    year: number;
    seatingCapacity: number;
    fuelType: "petrol" | "diesel" | "cng" | "hybrid" | "electric";
    purchaseDate: string;
    purchasePrice: number;
    currentOdometer: number;
    variant?: string | undefined;
    notes?: string | undefined;
}>;
declare const UpdateVehicleSchema: z.ZodObject<Omit<{
    registrationNumber: z.ZodOptional<z.ZodString>;
    make: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    variant: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    year: z.ZodOptional<z.ZodNumber>;
    seatingCapacity: z.ZodOptional<z.ZodNumber>;
    fuelType: z.ZodOptional<z.ZodEnum<["petrol", "diesel", "cng", "hybrid", "electric"]>>;
    purchaseDate: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
    purchasePrice: z.ZodOptional<z.ZodNumber>;
    currentOdometer: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "registrationNumber">, "strip", z.ZodTypeAny, {
    make?: string | undefined;
    model?: string | undefined;
    variant?: string | undefined;
    year?: number | undefined;
    seatingCapacity?: number | undefined;
    fuelType?: "petrol" | "diesel" | "cng" | "hybrid" | "electric" | undefined;
    purchaseDate?: string | undefined;
    purchasePrice?: number | undefined;
    currentOdometer?: number | undefined;
    notes?: string | undefined;
}, {
    make?: string | undefined;
    model?: string | undefined;
    variant?: string | undefined;
    year?: number | undefined;
    seatingCapacity?: number | undefined;
    fuelType?: "petrol" | "diesel" | "cng" | "hybrid" | "electric" | undefined;
    purchaseDate?: string | undefined;
    purchasePrice?: number | undefined;
    currentOdometer?: number | undefined;
    notes?: string | undefined;
}>;
declare const CreateDriverSchema: z.ZodObject<{
    name: z.ZodString;
    phone: z.ZodString;
    licenseNumber: z.ZodString;
    licenseExpiry: z.ZodString;
    joiningDate: z.ZodString;
    monthlyWage: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    phone: string;
    licenseNumber: string;
    licenseExpiry: string;
    joiningDate: string;
    monthlyWage?: number | undefined;
}, {
    name: string;
    phone: string;
    licenseNumber: string;
    licenseExpiry: string;
    joiningDate: string;
    monthlyWage?: number | undefined;
}>;
declare const CreateTripSchema: z.ZodEffects<z.ZodObject<{
    vehicleId: z.ZodString;
    driverId: z.ZodString;
    contractId: z.ZodOptional<z.ZodString>;
    source: z.ZodEnum<["it_contract", "ola", "uber", "red_taxi", "other_aggregator", "private", "outstation", "other"]>;
    date: z.ZodString;
    startTime: z.ZodString;
    endTime: z.ZodOptional<z.ZodString>;
    startOdometer: z.ZodNumber;
    endOdometer: z.ZodOptional<z.ZodNumber>;
    grossFare: z.ZodNumber;
    incentives: z.ZodDefault<z.ZodNumber>;
    reimbursements: z.ZodDefault<z.ZodNumber>;
    platformCommission: z.ZodDefault<z.ZodNumber>;
    tolls: z.ZodDefault<z.ZodNumber>;
    parking: z.ZodDefault<z.ZodNumber>;
    otherTripExpenses: z.ZodDefault<z.ZodNumber>;
    paymentMethod: z.ZodOptional<z.ZodEnum<["cash", "upi", "card", "bank_transfer", "wallet", "other"]>>;
    idempotencyKey: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    parking: number;
    date: string;
    vehicleId: string;
    driverId: string;
    source: "it_contract" | "ola" | "uber" | "red_taxi" | "other_aggregator" | "private" | "outstation" | "other";
    startTime: string;
    startOdometer: number;
    grossFare: number;
    incentives: number;
    reimbursements: number;
    platformCommission: number;
    tolls: number;
    otherTripExpenses: number;
    idempotencyKey: string;
    notes?: string | undefined;
    contractId?: string | undefined;
    endTime?: string | undefined;
    endOdometer?: number | undefined;
    paymentMethod?: "other" | "cash" | "upi" | "card" | "bank_transfer" | "wallet" | undefined;
}, {
    date: string;
    vehicleId: string;
    driverId: string;
    source: "it_contract" | "ola" | "uber" | "red_taxi" | "other_aggregator" | "private" | "outstation" | "other";
    startTime: string;
    startOdometer: number;
    grossFare: number;
    idempotencyKey: string;
    parking?: number | undefined;
    notes?: string | undefined;
    contractId?: string | undefined;
    endTime?: string | undefined;
    endOdometer?: number | undefined;
    incentives?: number | undefined;
    reimbursements?: number | undefined;
    platformCommission?: number | undefined;
    tolls?: number | undefined;
    otherTripExpenses?: number | undefined;
    paymentMethod?: "other" | "cash" | "upi" | "card" | "bank_transfer" | "wallet" | undefined;
}>, {
    parking: number;
    date: string;
    vehicleId: string;
    driverId: string;
    source: "it_contract" | "ola" | "uber" | "red_taxi" | "other_aggregator" | "private" | "outstation" | "other";
    startTime: string;
    startOdometer: number;
    grossFare: number;
    incentives: number;
    reimbursements: number;
    platformCommission: number;
    tolls: number;
    otherTripExpenses: number;
    idempotencyKey: string;
    notes?: string | undefined;
    contractId?: string | undefined;
    endTime?: string | undefined;
    endOdometer?: number | undefined;
    paymentMethod?: "other" | "cash" | "upi" | "card" | "bank_transfer" | "wallet" | undefined;
}, {
    date: string;
    vehicleId: string;
    driverId: string;
    source: "it_contract" | "ola" | "uber" | "red_taxi" | "other_aggregator" | "private" | "outstation" | "other";
    startTime: string;
    startOdometer: number;
    grossFare: number;
    idempotencyKey: string;
    parking?: number | undefined;
    notes?: string | undefined;
    contractId?: string | undefined;
    endTime?: string | undefined;
    endOdometer?: number | undefined;
    incentives?: number | undefined;
    reimbursements?: number | undefined;
    platformCommission?: number | undefined;
    tolls?: number | undefined;
    otherTripExpenses?: number | undefined;
    paymentMethod?: "other" | "cash" | "upi" | "card" | "bank_transfer" | "wallet" | undefined;
}>;
declare const CreateFuelEntrySchema: z.ZodObject<{
    vehicleId: z.ZodString;
    date: z.ZodString;
    odometer: z.ZodNumber;
    fuelType: z.ZodEnum<["petrol", "diesel", "cng", "hybrid", "electric"]>;
    quantity: z.ZodNumber;
    unitPrice: z.ZodNumber;
    totalAmount: z.ZodNumber;
    stationName: z.ZodOptional<z.ZodString>;
    isFullRefill: z.ZodBoolean;
    paymentMethod: z.ZodOptional<z.ZodEnum<["cash", "upi", "card", "bank_transfer", "wallet", "other"]>>;
}, "strip", z.ZodTypeAny, {
    fuelType: "petrol" | "diesel" | "cng" | "hybrid" | "electric";
    date: string;
    vehicleId: string;
    odometer: number;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    isFullRefill: boolean;
    paymentMethod?: "other" | "cash" | "upi" | "card" | "bank_transfer" | "wallet" | undefined;
    stationName?: string | undefined;
}, {
    fuelType: "petrol" | "diesel" | "cng" | "hybrid" | "electric";
    date: string;
    vehicleId: string;
    odometer: number;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    isFullRefill: boolean;
    paymentMethod?: "other" | "cash" | "upi" | "card" | "bank_transfer" | "wallet" | undefined;
    stationName?: string | undefined;
}>;
declare const CreateExpenseSchema: z.ZodObject<{
    vehicleId: z.ZodOptional<z.ZodString>;
    tripId: z.ZodOptional<z.ZodString>;
    date: z.ZodString;
    category: z.ZodEnum<["toll", "highway_fee", "parking", "waiting_area_fee", "platform_commission", "trip_allowance", "cleaning_route", "insurance", "road_tax", "registration_permit", "fitness_certificate", "puc", "documentation", "parking_rent", "accessories", "fuel", "oil_filter", "tyre", "wheel_service", "brake", "battery", "suspension", "ac_electrical", "coolant", "scheduled_service", "unexpected_repair", "towing", "driver_wages", "mobile_data", "cleaning", "accounting", "payment_fees", "software", "loan_interest", "other"]>;
    amount: z.ZodNumber;
    reimbursedAmount: z.ZodDefault<z.ZodNumber>;
    vendor: z.ZodOptional<z.ZodString>;
    paymentMethod: z.ZodOptional<z.ZodEnum<["cash", "upi", "card", "bank_transfer", "wallet", "other"]>>;
    isRecurring: z.ZodDefault<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date: string;
    category: "other" | "toll" | "highway_fee" | "parking" | "waiting_area_fee" | "platform_commission" | "trip_allowance" | "cleaning_route" | "insurance" | "road_tax" | "registration_permit" | "fitness_certificate" | "puc" | "documentation" | "parking_rent" | "accessories" | "fuel" | "oil_filter" | "tyre" | "wheel_service" | "brake" | "battery" | "suspension" | "ac_electrical" | "coolant" | "scheduled_service" | "unexpected_repair" | "towing" | "driver_wages" | "mobile_data" | "cleaning" | "accounting" | "payment_fees" | "software" | "loan_interest";
    amount: number;
    reimbursedAmount: number;
    isRecurring: boolean;
    notes?: string | undefined;
    vehicleId?: string | undefined;
    paymentMethod?: "other" | "cash" | "upi" | "card" | "bank_transfer" | "wallet" | undefined;
    tripId?: string | undefined;
    vendor?: string | undefined;
}, {
    date: string;
    category: "other" | "toll" | "highway_fee" | "parking" | "waiting_area_fee" | "platform_commission" | "trip_allowance" | "cleaning_route" | "insurance" | "road_tax" | "registration_permit" | "fitness_certificate" | "puc" | "documentation" | "parking_rent" | "accessories" | "fuel" | "oil_filter" | "tyre" | "wheel_service" | "brake" | "battery" | "suspension" | "ac_electrical" | "coolant" | "scheduled_service" | "unexpected_repair" | "towing" | "driver_wages" | "mobile_data" | "cleaning" | "accounting" | "payment_fees" | "software" | "loan_interest";
    amount: number;
    notes?: string | undefined;
    vehicleId?: string | undefined;
    paymentMethod?: "other" | "cash" | "upi" | "card" | "bank_transfer" | "wallet" | undefined;
    tripId?: string | undefined;
    reimbursedAmount?: number | undefined;
    vendor?: string | undefined;
    isRecurring?: boolean | undefined;
}>;
declare const SimulationVehicleInputSchema: z.ZodObject<{
    make: z.ZodString;
    model: z.ZodString;
    variant: z.ZodDefault<z.ZodString>;
    year: z.ZodNumber;
    fuelType: z.ZodEnum<["petrol", "diesel", "cng", "hybrid", "electric"]>;
    isNew: z.ZodBoolean;
    onRoadPrice: z.ZodNumber;
    registrationCost: z.ZodNumber;
    insuranceCost: z.ZodNumber;
    accessoriesCost: z.ZodDefault<z.ZodNumber>;
    expectedResaleValue: z.ZodNumber;
    ownershipPeriodYears: z.ZodNumber;
    annualKm: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    make: string;
    model: string;
    variant: string;
    year: number;
    fuelType: "petrol" | "diesel" | "cng" | "hybrid" | "electric";
    isNew: boolean;
    onRoadPrice: number;
    registrationCost: number;
    insuranceCost: number;
    accessoriesCost: number;
    expectedResaleValue: number;
    ownershipPeriodYears: number;
    annualKm: number;
}, {
    make: string;
    model: string;
    year: number;
    fuelType: "petrol" | "diesel" | "cng" | "hybrid" | "electric";
    isNew: boolean;
    onRoadPrice: number;
    registrationCost: number;
    insuranceCost: number;
    expectedResaleValue: number;
    ownershipPeriodYears: number;
    annualKm: number;
    variant?: string | undefined;
    accessoriesCost?: number | undefined;
}>;
declare const SimulationFinancingInputSchema: z.ZodObject<{
    type: z.ZodEnum<["cash", "loan", "lease", "rental"]>;
    downPayment: z.ZodNumber;
    loanPrincipal: z.ZodOptional<z.ZodNumber>;
    annualInterestRate: z.ZodOptional<z.ZodNumber>;
    tenureMonths: z.ZodOptional<z.ZodNumber>;
    processingFee: z.ZodOptional<z.ZodNumber>;
    balloonPayment: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "cash" | "loan" | "lease" | "rental";
    downPayment: number;
    annualInterestRate?: number | undefined;
    tenureMonths?: number | undefined;
    processingFee?: number | undefined;
    balloonPayment?: number | undefined;
    loanPrincipal?: number | undefined;
}, {
    type: "cash" | "loan" | "lease" | "rental";
    downPayment: number;
    annualInterestRate?: number | undefined;
    tenureMonths?: number | undefined;
    processingFee?: number | undefined;
    balloonPayment?: number | undefined;
    loanPrincipal?: number | undefined;
}>;
declare const SimulationContractInputSchema: z.ZodObject<{
    payoutPerTrip: z.ZodNumber;
    tripsPerDay: z.ZodNumber;
    paidKmPerTrip: z.ZodNumber;
    includesReturnJourney: z.ZodBoolean;
    emptyRunningKmPerDay: z.ZodNumber;
    workingDaysPerMonth: z.ZodNumber;
    weeklyOffs: z.ZodNumber;
    expectedCancellationPercent: z.ZodDefault<z.ZodNumber>;
    platformCommissionPercent: z.ZodDefault<z.ZodNumber>;
    tollsPerTrip: z.ZodDefault<z.ZodNumber>;
    parkingPerTrip: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    workingDaysPerMonth: number;
    payoutPerTrip: number;
    tripsPerDay: number;
    paidKmPerTrip: number;
    includesReturnJourney: boolean;
    emptyRunningKmPerDay: number;
    weeklyOffs: number;
    expectedCancellationPercent: number;
    platformCommissionPercent: number;
    tollsPerTrip: number;
    parkingPerTrip: number;
}, {
    workingDaysPerMonth: number;
    payoutPerTrip: number;
    tripsPerDay: number;
    paidKmPerTrip: number;
    includesReturnJourney: boolean;
    emptyRunningKmPerDay: number;
    weeklyOffs: number;
    expectedCancellationPercent?: number | undefined;
    platformCommissionPercent?: number | undefined;
    tollsPerTrip?: number | undefined;
    parkingPerTrip?: number | undefined;
}>;
declare const CreateSimulationSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    vehicleDetails: z.ZodObject<{
        make: z.ZodString;
        model: z.ZodString;
        variant: z.ZodDefault<z.ZodString>;
        year: z.ZodNumber;
        fuelType: z.ZodEnum<["petrol", "diesel", "cng", "hybrid", "electric"]>;
        isNew: z.ZodBoolean;
        onRoadPrice: z.ZodNumber;
        registrationCost: z.ZodNumber;
        insuranceCost: z.ZodNumber;
        accessoriesCost: z.ZodDefault<z.ZodNumber>;
        expectedResaleValue: z.ZodNumber;
        ownershipPeriodYears: z.ZodNumber;
        annualKm: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        make: string;
        model: string;
        variant: string;
        year: number;
        fuelType: "petrol" | "diesel" | "cng" | "hybrid" | "electric";
        isNew: boolean;
        onRoadPrice: number;
        registrationCost: number;
        insuranceCost: number;
        accessoriesCost: number;
        expectedResaleValue: number;
        ownershipPeriodYears: number;
        annualKm: number;
    }, {
        make: string;
        model: string;
        year: number;
        fuelType: "petrol" | "diesel" | "cng" | "hybrid" | "electric";
        isNew: boolean;
        onRoadPrice: number;
        registrationCost: number;
        insuranceCost: number;
        expectedResaleValue: number;
        ownershipPeriodYears: number;
        annualKm: number;
        variant?: string | undefined;
        accessoriesCost?: number | undefined;
    }>;
    financingDetails: z.ZodObject<{
        type: z.ZodEnum<["cash", "loan", "lease", "rental"]>;
        downPayment: z.ZodNumber;
        loanPrincipal: z.ZodOptional<z.ZodNumber>;
        annualInterestRate: z.ZodOptional<z.ZodNumber>;
        tenureMonths: z.ZodOptional<z.ZodNumber>;
        processingFee: z.ZodOptional<z.ZodNumber>;
        balloonPayment: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "cash" | "loan" | "lease" | "rental";
        downPayment: number;
        annualInterestRate?: number | undefined;
        tenureMonths?: number | undefined;
        processingFee?: number | undefined;
        balloonPayment?: number | undefined;
        loanPrincipal?: number | undefined;
    }, {
        type: "cash" | "loan" | "lease" | "rental";
        downPayment: number;
        annualInterestRate?: number | undefined;
        tenureMonths?: number | undefined;
        processingFee?: number | undefined;
        balloonPayment?: number | undefined;
        loanPrincipal?: number | undefined;
    }>;
    fuelDetails: z.ZodObject<{
        unitPrice: z.ZodNumber;
        realWorldEfficiency: z.ZodNumber;
        cityHighwayMix: z.ZodNumber;
        expectedPriceChangePercent: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        unitPrice: number;
        realWorldEfficiency: number;
        cityHighwayMix: number;
        expectedPriceChangePercent?: number | undefined;
    }, {
        unitPrice: number;
        realWorldEfficiency: number;
        cityHighwayMix: number;
        expectedPriceChangePercent?: number | undefined;
    }>;
    contractDetails: z.ZodObject<{
        payoutPerTrip: z.ZodNumber;
        tripsPerDay: z.ZodNumber;
        paidKmPerTrip: z.ZodNumber;
        includesReturnJourney: z.ZodBoolean;
        emptyRunningKmPerDay: z.ZodNumber;
        workingDaysPerMonth: z.ZodNumber;
        weeklyOffs: z.ZodNumber;
        expectedCancellationPercent: z.ZodDefault<z.ZodNumber>;
        platformCommissionPercent: z.ZodDefault<z.ZodNumber>;
        tollsPerTrip: z.ZodDefault<z.ZodNumber>;
        parkingPerTrip: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        workingDaysPerMonth: number;
        payoutPerTrip: number;
        tripsPerDay: number;
        paidKmPerTrip: number;
        includesReturnJourney: boolean;
        emptyRunningKmPerDay: number;
        weeklyOffs: number;
        expectedCancellationPercent: number;
        platformCommissionPercent: number;
        tollsPerTrip: number;
        parkingPerTrip: number;
    }, {
        workingDaysPerMonth: number;
        payoutPerTrip: number;
        tripsPerDay: number;
        paidKmPerTrip: number;
        includesReturnJourney: boolean;
        emptyRunningKmPerDay: number;
        weeklyOffs: number;
        expectedCancellationPercent?: number | undefined;
        platformCommissionPercent?: number | undefined;
        tollsPerTrip?: number | undefined;
        parkingPerTrip?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    vehicleDetails: {
        make: string;
        model: string;
        variant: string;
        year: number;
        fuelType: "petrol" | "diesel" | "cng" | "hybrid" | "electric";
        isNew: boolean;
        onRoadPrice: number;
        registrationCost: number;
        insuranceCost: number;
        accessoriesCost: number;
        expectedResaleValue: number;
        ownershipPeriodYears: number;
        annualKm: number;
    };
    financingDetails: {
        type: "cash" | "loan" | "lease" | "rental";
        downPayment: number;
        annualInterestRate?: number | undefined;
        tenureMonths?: number | undefined;
        processingFee?: number | undefined;
        balloonPayment?: number | undefined;
        loanPrincipal?: number | undefined;
    };
    fuelDetails: {
        unitPrice: number;
        realWorldEfficiency: number;
        cityHighwayMix: number;
        expectedPriceChangePercent?: number | undefined;
    };
    contractDetails: {
        workingDaysPerMonth: number;
        payoutPerTrip: number;
        tripsPerDay: number;
        paidKmPerTrip: number;
        includesReturnJourney: boolean;
        emptyRunningKmPerDay: number;
        weeklyOffs: number;
        expectedCancellationPercent: number;
        platformCommissionPercent: number;
        tollsPerTrip: number;
        parkingPerTrip: number;
    };
    description?: string | undefined;
}, {
    name: string;
    vehicleDetails: {
        make: string;
        model: string;
        year: number;
        fuelType: "petrol" | "diesel" | "cng" | "hybrid" | "electric";
        isNew: boolean;
        onRoadPrice: number;
        registrationCost: number;
        insuranceCost: number;
        expectedResaleValue: number;
        ownershipPeriodYears: number;
        annualKm: number;
        variant?: string | undefined;
        accessoriesCost?: number | undefined;
    };
    financingDetails: {
        type: "cash" | "loan" | "lease" | "rental";
        downPayment: number;
        annualInterestRate?: number | undefined;
        tenureMonths?: number | undefined;
        processingFee?: number | undefined;
        balloonPayment?: number | undefined;
        loanPrincipal?: number | undefined;
    };
    fuelDetails: {
        unitPrice: number;
        realWorldEfficiency: number;
        cityHighwayMix: number;
        expectedPriceChangePercent?: number | undefined;
    };
    contractDetails: {
        workingDaysPerMonth: number;
        payoutPerTrip: number;
        tripsPerDay: number;
        paidKmPerTrip: number;
        includesReturnJourney: boolean;
        emptyRunningKmPerDay: number;
        weeklyOffs: number;
        expectedCancellationPercent?: number | undefined;
        platformCommissionPercent?: number | undefined;
        tollsPerTrip?: number | undefined;
        parkingPerTrip?: number | undefined;
    };
    description?: string | undefined;
}>;
declare const CreateMaintenanceItemSchema: z.ZodObject<{
    vehicleId: z.ZodString;
    itemName: z.ZodString;
    lastServiceDate: z.ZodOptional<z.ZodString>;
    lastServiceOdometer: z.ZodOptional<z.ZodNumber>;
    nextDueDate: z.ZodOptional<z.ZodString>;
    nextDueOdometer: z.ZodOptional<z.ZodNumber>;
    intervalDays: z.ZodOptional<z.ZodNumber>;
    intervalKm: z.ZodOptional<z.ZodNumber>;
    estimatedCost: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    vehicleId: string;
    itemName: string;
    notes?: string | undefined;
    lastServiceDate?: string | undefined;
    lastServiceOdometer?: number | undefined;
    nextDueDate?: string | undefined;
    nextDueOdometer?: number | undefined;
    intervalDays?: number | undefined;
    intervalKm?: number | undefined;
    estimatedCost?: number | undefined;
}, {
    vehicleId: string;
    itemName: string;
    notes?: string | undefined;
    lastServiceDate?: string | undefined;
    lastServiceOdometer?: number | undefined;
    nextDueDate?: string | undefined;
    nextDueOdometer?: number | undefined;
    intervalDays?: number | undefined;
    intervalKm?: number | undefined;
    estimatedCost?: number | undefined;
}>;
type SignUpInput = z.infer<typeof SignUpSchema>;
type SignInInput = z.infer<typeof SignInSchema>;
type CreateBusinessInput = z.infer<typeof CreateBusinessSchema>;
type CreateVehicleInput = z.infer<typeof CreateVehicleSchema>;
type CreateDriverInput = z.infer<typeof CreateDriverSchema>;
type CreateTripInput = z.infer<typeof CreateTripSchema>;
type CreateFuelEntryInput = z.infer<typeof CreateFuelEntrySchema>;
type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
type CreateSimulationInput = z.infer<typeof CreateSimulationSchema>;
type CreateMaintenanceItemInput = z.infer<typeof CreateMaintenanceItemSchema>;

export { type AmortizationRow, type ApiError, type ApiResponse, type ApiResult, type AuditEvent, type BaseDocument, type BreakEvenInput, type BreakEvenResult, type Business, type BusinessMembership, type BusinessSettings, CALCULATION_VERSION, ChangePasswordSchema, type Contract, type CreateBusinessInput, CreateBusinessSchema, type CreateDriverInput, CreateDriverSchema, type CreateExpenseInput, CreateExpenseSchema, type CreateFuelEntryInput, CreateFuelEntrySchema, type CreateMaintenanceItemInput, CreateMaintenanceItemSchema, type CreateSimulationInput, CreateSimulationSchema, type CreateTripInput, CreateTripSchema, type CreateVehicleInput, CreateVehicleSchema, type DepreciationInput, type Driver, type EconomicProfitInput, type EmiInput, type EmiResult, type Expense, type ExpenseCategory, type FinancingType, type ForecastInput, ForgotPasswordSchema, type FuelCostInput, type FuelEntry, type FuelPriceConfig, type FuelType, type InsuranceInfo, type MaintenanceItem, type MonthlyCashFlowInput, type MonthlyForecast, type Notification, type NotificationType, type OperatingProfitInput, type PaginationParams, PaginationSchema, type PaymentMethod, type PaymentStatus, type Permission, type PermitInfo, ResetPasswordSchema, type ScenarioType, type ServiceRecord, type SignInInput, SignInSchema, type SignUpInput, SignUpSchema, type Simulation, type SimulationContractInput, SimulationContractInputSchema, type SimulationFinancingInput, SimulationFinancingInputSchema, type SimulationFuelInput, type SimulationResult, type SimulationScenario, type SimulationVehicleInput, SimulationVehicleInputSchema, type TcoInput, type TenantDocument, type Trip, type TripContributionInput, type TripRevenueInput, type TripRevenueResult, type TripSource, UpdateBusinessSchema, UpdateVehicleSchema, type User, type UserRole, type Vehicle, type VehicleLoan, VehicleRegistrationRegex, type VehicleStatus, buildFiveYearForecast, calculateBreakEven, calculateEconomicProfit, calculateEmi, calculateMileage, calculateMonthlyCashFlow, calculateOperatingProfit, calculateStraightLineDepreciation, calculateTco, calculateTripContribution, calculateTripRevenue, costPerKm, estimateFuelCost, formatINR, fromPaise, toPaise };
