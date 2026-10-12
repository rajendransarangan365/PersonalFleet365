// ─── Core enumerations ────────────────────────────────────────────────────────

export type UserRole =
  | 'platform_admin'
  | 'business_owner'
  | 'fleet_manager'
  | 'accountant'
  | 'dispatcher'
  | 'driver'
  | 'auditor';

export type Permission =
  | 'vehicle.read'
  | 'vehicle.create'
  | 'vehicle.update'
  | 'vehicle.delete'
  | 'trip.read'
  | 'trip.create'
  | 'trip.update'
  | 'trip.cancel'
  | 'expense.read'
  | 'expense.create'
  | 'expense.approve'
  | 'finance.read'
  | 'finance.export'
  | 'maintenance.manage'
  | 'users.manage'
  | 'reports.view'
  | 'contract.read'
  | 'contract.create'
  | 'contract.update'
  | 'driver.read'
  | 'driver.create'
  | 'driver.update';

export type FuelType = 'petrol' | 'diesel' | 'cng' | 'hybrid' | 'electric';

export type VehicleStatus =
  | 'active'
  | 'available'
  | 'assigned'
  | 'in_service'
  | 'breakdown'
  | 'inactive'
  | 'sold';

export type TripSource =
  | 'it_contract'
  | 'ola'
  | 'uber'
  | 'red_taxi'
  | 'other_aggregator'
  | 'private'
  | 'outstation'
  | 'other';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'wallet' | 'other';

export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';

export type ExpenseCategory =
  // Trip expenses
  | 'toll'
  | 'highway_fee'
  | 'parking'
  | 'waiting_area_fee'
  | 'platform_commission'
  | 'trip_allowance'
  | 'cleaning_route'
  // Ownership expenses
  | 'insurance'
  | 'road_tax'
  | 'registration_permit'
  | 'fitness_certificate'
  | 'puc'
  | 'documentation'
  | 'parking_rent'
  | 'accessories'
  // Running expenses
  | 'fuel'
  | 'oil_filter'
  | 'tyre'
  | 'wheel_service'
  | 'brake'
  | 'battery'
  | 'suspension'
  | 'ac_electrical'
  | 'coolant'
  | 'scheduled_service'
  | 'unexpected_repair'
  | 'towing'
  // Business expenses
  | 'driver_wages'
  | 'mobile_data'
  | 'cleaning'
  | 'accounting'
  | 'payment_fees'
  | 'software'
  | 'loan_interest'
  | 'other';

export type FinancingType = 'cash' | 'loan' | 'lease' | 'rental';

export type ScenarioType = 'conservative' | 'expected' | 'optimistic';

export type NotificationType =
  | 'service_reminder'
  | 'document_expiry'
  | 'emi_due'
  | 'contract_expiry'
  | 'unpaid_invoice'
  | 'low_reserve'
  | 'high_maintenance'
  | 'negative_cashflow'
  | 'vehicle_downtime';

// ─── Base document interfaces ─────────────────────────────────────────────────

export interface BaseDocument {
  _id: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export interface TenantDocument extends BaseDocument {
  businessId: string;
}

// ─── User & auth ──────────────────────────────────────────────────────────────

export interface User extends BaseDocument {
  id?: string;
  email: string;
  displayName: string;
  role?: UserRole;
  phone?: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  isActive: boolean;
  lastLoginAt?: string;
}

export interface BusinessMembership extends TenantDocument {
  userId: string;
  role: UserRole;
  permissions: Permission[];
  invitedBy?: string;
  joinedAt?: string;
}

// ─── Business ─────────────────────────────────────────────────────────────────

export interface Business extends BaseDocument {
  name: string;
  ownerId: string;
  currency: string; // 'INR'
  region: string;   // 'TN' (Tamil Nadu)
  country: string;  // 'IN'
  subscriptionTier: 'free' | 'basic' | 'pro' | 'enterprise';
  settings: BusinessSettings;
  isActive: boolean;
}

export interface BusinessSettings {
  taxRates: Record<string, number>;
  fuelPrices: FuelPriceConfig;
  defaultMileage: Record<FuelType, number>;
  workingDaysPerMonth: number;
  emergencyReserveTarget: number;
}

export interface FuelPriceConfig {
  petrol: number;
  diesel: number;
  cng: number;
  electricity: number; // per kWh
  updatedAt: string;
}

// ─── Vehicle ──────────────────────────────────────────────────────────────────

export interface Vehicle extends TenantDocument {
  registrationNumber: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  seatingCapacity: number;
  fuelType: FuelType;
  purchaseDate: string;
  purchasePrice: number; // in paise (integer minor unit)
  currentOdometer: number;
  status: VehicleStatus;
  assignedDriverId?: string;
  insurance?: InsuranceInfo;
  permits?: PermitInfo[];
  loanId?: string;
  notes?: string;
}

export interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  expiryDate: string;
  premium: number;
}

export interface PermitInfo {
  type: string;
  number: string;
  expiryDate: string;
}

// ─── Driver ───────────────────────────────────────────────────────────────────

export interface Driver extends TenantDocument {
  userId?: string; // linked user account if they log in
  name: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string;
  isActive: boolean;
  assignedVehicleId?: string;
  joiningDate: string;
  monthlyWage?: number;
}

// ─── Contract ─────────────────────────────────────────────────────────────────

export interface Contract extends TenantDocument {
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

// ─── Trip ─────────────────────────────────────────────────────────────────────

export interface Trip extends TenantDocument {
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

// ─── Fuel entry ───────────────────────────────────────────────────────────────

export interface FuelEntry extends TenantDocument {
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

// ─── Expense ──────────────────────────────────────────────────────────────────

export interface Expense extends TenantDocument {
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

// ─── Maintenance ──────────────────────────────────────────────────────────────

export interface MaintenanceItem extends TenantDocument {
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

export interface ServiceRecord extends TenantDocument {
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

// ─── Vehicle loan ─────────────────────────────────────────────────────────────

export interface VehicleLoan extends TenantDocument {
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
  actualLenderEmi?: number; // override when lender EMI differs
}

// ─── Simulation ───────────────────────────────────────────────────────────────

export interface Simulation extends TenantDocument {
  name: string;
  description?: string;
  vehicleDetails: SimulationVehicleInput;
  financingDetails: SimulationFinancingInput;
  fuelDetails: SimulationFuelInput;
  contractDetails: SimulationContractInput;
  scenarios: SimulationScenario[];
  calculationVersion: string; // e.g. "1.0"
  savedAt: string;
}

export interface SimulationVehicleInput {
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

export interface SimulationFinancingInput {
  type: FinancingType;
  downPayment: number;
  loanPrincipal?: number;
  annualInterestRate?: number;
  tenureMonths?: number;
  processingFee?: number;
  balloonPayment?: number;
}

export interface SimulationFuelInput {
  unitPrice: number;
  realWorldEfficiency: number; // km/l or km/kWh
  cityHighwayMix: number; // 0-1 (fraction city)
  expectedPriceChangePercent?: number;
}

export interface SimulationContractInput {
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

export interface SimulationScenario extends BaseDocument {
  simulationId: string;
  type: ScenarioType;
  label: string;
  overrides: Partial<SimulationContractInput & SimulationFuelInput>;
  result?: SimulationResult;
}

export interface SimulationResult {
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

export interface MonthlyForecast {
  month: number; // 1-60
  revenue: number;
  expenses: number;
  cashFlow: number;
  outstandingLoan: number;
  cumulativeProfit: number;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification extends TenantDocument {
  userId?: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  entityType?: string;
  entityId?: string;
  scheduledFor?: string;
}

// ─── Audit event ──────────────────────────────────────────────────────────────

export interface AuditEvent extends TenantDocument {
  actorUserId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    correlationId?: string;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
    correlationId?: string;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
