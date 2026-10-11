import { z } from 'zod';

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ─── Auth schemas ─────────────────────────────────────────────────────────────

export const SignUpSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(128)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a digit')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
  displayName: z.string().min(2).max(100).trim(),
});

export const SignInSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  password: z.string().min(1).max(128),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(10).max(512),
  password: SignUpSchema.shape.password,
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: SignUpSchema.shape.password,
});

// ─── Business schemas ─────────────────────────────────────────────────────────

export const CreateBusinessSchema = z.object({
  name: z.string().min(2).max(200).trim(),
  region: z.string().max(10).default('TN'),
  country: z.string().max(5).default('IN'),
  settings: z
    .object({
      workingDaysPerMonth: z.number().int().min(1).max(31).default(25),
      emergencyReserveTarget: z.number().min(0).default(0),
    })
    .optional(),
});

export const UpdateBusinessSchema = CreateBusinessSchema.partial();

// ─── Vehicle schemas ──────────────────────────────────────────────────────────

export const VehicleRegistrationRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;

export const CreateVehicleSchema = z.object({
  registrationNumber: z
    .string()
    .min(6)
    .max(12)
    .trim()
    .toUpperCase()
    .regex(VehicleRegistrationRegex, 'Invalid registration number format'),
  make: z.string().min(1).max(100).trim(),
  model: z.string().min(1).max(100).trim(),
  variant: z.string().max(100).trim().default(''),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  seatingCapacity: z.number().int().min(1).max(60),
  fuelType: z.enum(['petrol', 'diesel', 'cng', 'hybrid', 'electric']),
  purchaseDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  purchasePrice: z.number().int().min(0).max(100_000_00000), // paise, max ₹1 crore
  currentOdometer: z.number().int().min(0).max(10_000_000),
  notes: z.string().max(1000).optional(),
});

export const UpdateVehicleSchema = CreateVehicleSchema.partial().omit({ registrationNumber: true });

// ─── Driver schemas ───────────────────────────────────────────────────────────

export const CreateDriverSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  licenseNumber: z.string().min(5).max(20).trim().toUpperCase(),
  licenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monthlyWage: z.number().int().min(0).optional(),
});

// ─── Trip schemas ─────────────────────────────────────────────────────────────

export const CreateTripSchema = z.object({
  vehicleId: z.string().length(24), // MongoDB ObjectId
  driverId: z.string().length(24),
  contractId: z.string().length(24).optional(),
  source: z.enum([
    'it_contract', 'ola', 'uber', 'red_taxi',
    'other_aggregator', 'private', 'outstation', 'other',
  ]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  startOdometer: z.number().int().min(0).max(10_000_000),
  endOdometer: z.number().int().min(0).max(10_000_000).optional(),
  grossFare: z.number().int().min(0).max(10_000_000), // paise
  incentives: z.number().int().min(0).max(10_000_000).default(0),
  reimbursements: z.number().int().min(0).max(10_000_000).default(0),
  platformCommission: z.number().int().min(0).max(10_000_000).default(0),
  tolls: z.number().int().min(0).max(10_000_000).default(0),
  parking: z.number().int().min(0).max(10_000_000).default(0),
  otherTripExpenses: z.number().int().min(0).max(10_000_000).default(0),
  paymentMethod: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'wallet', 'other']).optional(),
  idempotencyKey: z.string().min(10).max(100),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) =>
    data.endOdometer === undefined || data.endOdometer >= data.startOdometer,
  { message: 'End odometer must be >= start odometer', path: ['endOdometer'] },
);

// ─── Fuel entry schemas ───────────────────────────────────────────────────────

export const CreateFuelEntrySchema = z.object({
  vehicleId: z.string().length(24),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  odometer: z.number().int().min(0).max(10_000_000),
  fuelType: z.enum(['petrol', 'diesel', 'cng', 'hybrid', 'electric']),
  quantity: z.number().min(0.1).max(10000), // litres or kWh
  unitPrice: z.number().int().min(1).max(1_000_000), // paise per litre
  totalAmount: z.number().int().min(1).max(100_000_000), // paise
  stationName: z.string().max(200).optional(),
  isFullRefill: z.boolean(),
  paymentMethod: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'wallet', 'other']).optional(),
});

// ─── Expense schemas ──────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  'toll', 'highway_fee', 'parking', 'waiting_area_fee', 'platform_commission',
  'trip_allowance', 'cleaning_route', 'insurance', 'road_tax', 'registration_permit',
  'fitness_certificate', 'puc', 'documentation', 'parking_rent', 'accessories',
  'fuel', 'oil_filter', 'tyre', 'wheel_service', 'brake', 'battery', 'suspension',
  'ac_electrical', 'coolant', 'scheduled_service', 'unexpected_repair', 'towing',
  'driver_wages', 'mobile_data', 'cleaning', 'accounting', 'payment_fees',
  'software', 'loan_interest', 'other',
] as const;

export const CreateExpenseSchema = z.object({
  vehicleId: z.string().length(24).optional(),
  tripId: z.string().length(24).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().int().min(1).max(1_000_000_000), // paise
  reimbursedAmount: z.number().int().min(0).default(0),
  vendor: z.string().max(200).optional(),
  paymentMethod: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'wallet', 'other']).optional(),
  isRecurring: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
});

// ─── Simulation schemas ───────────────────────────────────────────────────────

export const SimulationVehicleInputSchema = z.object({
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  variant: z.string().max(100).default(''),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  fuelType: z.enum(['petrol', 'diesel', 'cng', 'hybrid', 'electric']),
  isNew: z.boolean(),
  onRoadPrice: z.number().int().min(100_00_00).max(10_00_00_000_00), // paise, min ₹1L
  registrationCost: z.number().int().min(0),
  insuranceCost: z.number().int().min(0),
  accessoriesCost: z.number().int().min(0).default(0),
  expectedResaleValue: z.number().int().min(0),
  ownershipPeriodYears: z.number().int().min(1).max(20),
  annualKm: z.number().int().min(1000).max(500_000),
});

export const SimulationFinancingInputSchema = z.object({
  type: z.enum(['cash', 'loan', 'lease', 'rental']),
  downPayment: z.number().int().min(0),
  loanPrincipal: z.number().int().min(0).optional(),
  annualInterestRate: z.number().min(0).max(50).optional(),
  tenureMonths: z.number().int().min(1).max(360).optional(),
  processingFee: z.number().int().min(0).optional(),
  balloonPayment: z.number().int().min(0).optional(),
});

export const SimulationContractInputSchema = z.object({
  payoutPerTrip: z.number().int().min(1).max(100_000_000),
  tripsPerDay: z.number().min(0.5).max(30),
  paidKmPerTrip: z.number().min(1).max(2000),
  includesReturnJourney: z.boolean(),
  emptyRunningKmPerDay: z.number().min(0).max(1000),
  workingDaysPerMonth: z.number().int().min(1).max(31),
  weeklyOffs: z.number().int().min(0).max(4),
  expectedCancellationPercent: z.number().min(0).max(100).default(0),
  platformCommissionPercent: z.number().min(0).max(100).default(0),
  tollsPerTrip: z.number().int().min(0).default(0),
  parkingPerTrip: z.number().int().min(0).default(0),
});

export const CreateSimulationSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  vehicleDetails: SimulationVehicleInputSchema,
  financingDetails: SimulationFinancingInputSchema,
  fuelDetails: z.object({
    unitPrice: z.number().int().min(1).max(1_000_000),
    realWorldEfficiency: z.number().min(0.1).max(1000),
    cityHighwayMix: z.number().min(0).max(1),
    expectedPriceChangePercent: z.number().min(-100).max(500).optional(),
  }),
  contractDetails: SimulationContractInputSchema,
});

// ─── Maintenance schemas ──────────────────────────────────────────────────────

export const CreateMaintenanceItemSchema = z.object({
  vehicleId: z.string().length(24),
  itemName: z.string().min(1).max(200),
  lastServiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lastServiceOdometer: z.number().int().min(0).optional(),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nextDueOdometer: z.number().int().min(0).optional(),
  intervalDays: z.number().int().min(1).optional(),
  intervalKm: z.number().int().min(1).optional(),
  estimatedCost: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type SignInInput = z.infer<typeof SignInSchema>;
export type CreateBusinessInput = z.infer<typeof CreateBusinessSchema>;
export type CreateVehicleInput = z.infer<typeof CreateVehicleSchema>;
export type CreateDriverInput = z.infer<typeof CreateDriverSchema>;
export type CreateTripInput = z.infer<typeof CreateTripSchema>;
export type CreateFuelEntryInput = z.infer<typeof CreateFuelEntrySchema>;
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type CreateSimulationInput = z.infer<typeof CreateSimulationSchema>;
export type CreateMaintenanceItemInput = z.infer<typeof CreateMaintenanceItemSchema>;
