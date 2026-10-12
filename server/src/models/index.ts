import { Schema, model, Document, Types } from 'mongoose';

// ─── User ─────────────────────────────────────────────────────────────────────

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  displayName: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  mfaEnabled: boolean;
  mfaSecret?: string;
  role?: string;
  phone?: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, default: 'fleet_owner' },
    phone: { type: String, default: '' },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, select: false },
    isActive: { type: Boolean, default: true },
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    lockedUntil: Date,
    lastLoginAt: Date,
  },
  {
    timestamps: true,
    collection: 'users',
  },
);

// Prevent exposing sensitive fields
UserSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.passwordHash;
    delete ret.mfaSecret;
    delete ret.emailVerificationToken;
    delete ret.passwordResetToken;
    return ret;
  },
});

export const UserModel = model<IUser>('User', UserSchema);

// ─── Refresh Token ────────────────────────────────────────────────────────────

export interface IRefreshToken extends Document {
  userId: Types.ObjectId;
  tokenHash: string; // hashed — never store raw JWT
  family: string;   // for rotation + reuse detection
  isRevoked: boolean;
  expiresAt: Date;
  createdAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    family: { type: String, required: true, index: true },
    isRevoked: { type: Boolean, default: false, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index
    ipAddress: String,
    userAgent: { type: String, maxlength: 500 },
  },
  { timestamps: true, collection: 'refreshTokens' },
);

export const RefreshTokenModel = model<IRefreshToken>('RefreshToken', RefreshTokenSchema);

// ─── Business ─────────────────────────────────────────────────────────────────

export interface IBusiness extends Document {
  name: string;
  ownerId: Types.ObjectId;
  currency: string;
  region: string;
  country: string;
  subscriptionTier: 'free' | 'basic' | 'pro' | 'enterprise';
  settings: {
    workingDaysPerMonth: number;
    emergencyReserveTarget: number;
    fuelPrices: {
      petrol: number;
      diesel: number;
      cng: number;
      electricity: number;
      updatedAt: Date;
    };
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    currency: { type: String, default: 'INR', maxlength: 5 },
    region: { type: String, default: 'TN', maxlength: 10 },
    country: { type: String, default: 'IN', maxlength: 5 },
    subscriptionTier: {
      type: String,
      enum: ['free', 'basic', 'pro', 'enterprise'],
      default: 'free',
    },
    settings: {
      workingDaysPerMonth: { type: Number, default: 25, min: 1, max: 31 },
      emergencyReserveTarget: { type: Number, default: 0, min: 0 },
      fuelPrices: {
        petrol: { type: Number, default: 10500, min: 0 },   // paise
        diesel: { type: Number, default: 9200, min: 0 },
        cng: { type: Number, default: 8900, min: 0 },
        electricity: { type: Number, default: 700, min: 0 }, // per kWh in paise
        updatedAt: { type: Date, default: Date.now },
      },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'businesses' },
);

export const BusinessModel = model<IBusiness>('Business', BusinessSchema);

// ─── Business Membership ──────────────────────────────────────────────────────

export interface IBusinessMembership extends Document {
  businessId: Types.ObjectId;
  userId: Types.ObjectId;
  role: string;
  permissions: string[];
  invitedBy?: Types.ObjectId;
  inviteToken?: string;
  inviteExpires?: Date;
  joinedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessMembershipSchema = new Schema<IBusinessMembership>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: {
      type: String,
      enum: [
        'platform_admin', 'business_owner', 'fleet_owner', 'fleet_manager', 'operations_manager',
        'accountant', 'dispatcher', 'telecaller', 'support', 'driver', 'customer', 'auditor',
      ],
      required: true,
    },
    permissions: [{ type: String, maxlength: 50 }],
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    inviteToken: { type: String, select: false },
    inviteExpires: Date,
    joinedAt: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'businessMemberships' },
);

// Unique: one membership per user per business
BusinessMembershipSchema.index({ businessId: 1, userId: 1 }, { unique: true });

export const BusinessMembershipModel = model<IBusinessMembership>(
  'BusinessMembership',
  BusinessMembershipSchema,
);

// ─── Vehicle ──────────────────────────────────────────────────────────────────

export interface IVehicle {
  businessId: Types.ObjectId;
  registrationNumber: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  seatingCapacity: number;
  fuelType: string;
  purchaseDate: Date;
  purchasePrice: Types.Decimal128; // paise as Decimal128 for precise storage
  currentOdometer: number;
  status: string;
  assignedDriverId?: Types.ObjectId;
  loanId?: Types.ObjectId;
  insurance?: {
    provider: string;
    policyNumber: string;
    expiryDate: Date;
    premium: Types.Decimal128;
  };
  permits: Array<{
    type: string;
    number: string;
    expiryDate: Date;
  }>;
  photos?: {
    front?: { url: string; publicId: string; uploadedAt: Date };
    back?: { url: string; publicId: string; uploadedAt: Date };
    left?: { url: string; publicId: string; uploadedAt: Date };
    right?: { url: string; publicId: string; uploadedAt: Date };
  };
  financing?: {
    downPayment: Types.Decimal128;
    loanTenureMonths: number;
    interestRatePercent: number;
    monthlyEmi: Types.Decimal128;
  };
  mileageConfig?: {
    claimedMileage: number;
    expectedMileage: number;
    adBlueLitersPer1000Km?: number;
    tyreBrand?: string;
    tyreChangeOdometer?: number;
  };
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleSchema = new Schema<IVehicle>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 12,
    },
    make: { type: String, required: true, trim: true, maxlength: 100 },
    model: { type: String, required: true, trim: true, maxlength: 100 },
    variant: { type: String, trim: true, maxlength: 100, default: '' },
    year: { type: Number, required: true, min: 1990 },
    seatingCapacity: { type: Number, required: true, min: 1, max: 60 },
    fuelType: {
      type: String,
      enum: ['petrol', 'diesel', 'cng', 'hybrid', 'electric'],
      required: true,
    },
    purchaseDate: { type: Date, required: true },
    purchasePrice: { type: Schema.Types.Decimal128, required: true },
    currentOdometer: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['active', 'available', 'assigned', 'in_service', 'breakdown', 'inactive', 'sold'],
      default: 'active',
    },
    assignedDriverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
    loanId: { type: Schema.Types.ObjectId, ref: 'VehicleLoan' },
    insurance: {
      provider: { type: String, maxlength: 200 },
      policyNumber: { type: String, maxlength: 100 },
      expiryDate: Date,
      premium: Schema.Types.Decimal128,
    },
    permits: [
      {
        type: { type: String, maxlength: 100 },
        number: { type: String, maxlength: 50 },
        expiryDate: Date,
      },
    ],
    photos: {
      front: { url: String, publicId: String, uploadedAt: Date },
      back: { url: String, publicId: String, uploadedAt: Date },
      left: { url: String, publicId: String, uploadedAt: Date },
      right: { url: String, publicId: String, uploadedAt: Date },
    },
    financing: {
      downPayment: Schema.Types.Decimal128,
      loanTenureMonths: Number,
      interestRatePercent: Number,
      monthlyEmi: Schema.Types.Decimal128,
    },
    mileageConfig: {
      claimedMileage: Number,
      expectedMileage: Number,
      adBlueLitersPer1000Km: Number,
      tyreBrand: String,
      tyreChangeOdometer: Number,
    },
    notes: { type: String, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'vehicles' },
);

// Unique registration per business
VehicleSchema.index({ businessId: 1, registrationNumber: 1 }, { unique: true });
VehicleSchema.index({ businessId: 1, status: 1 });

export const VehicleModel = model<IVehicle>('Vehicle', VehicleSchema);

// ─── Driver ───────────────────────────────────────────────────────────────────

export interface IDriver extends Document {
  businessId: Types.ObjectId;
  userId?: Types.ObjectId;
  name: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: Date;
  isActive: boolean;
  assignedVehicleId?: Types.ObjectId;
  joiningDate: Date;
  monthlyWage?: Types.Decimal128;
  createdAt: Date;
  updatedAt: Date;
}

const DriverSchema = new Schema<IDriver>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, maxlength: 15 },
    licenseNumber: { type: String, required: true, uppercase: true, maxlength: 20 },
    licenseExpiry: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    assignedVehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
    joiningDate: { type: Date, required: true },
    monthlyWage: Schema.Types.Decimal128,
  },
  { timestamps: true, collection: 'drivers' },
);

DriverSchema.index({ businessId: 1, licenseNumber: 1 }, { unique: true });

export const DriverModel = model<IDriver>('Driver', DriverSchema);

// ─── Vehicle Loan ─────────────────────────────────────────────────────────────

export interface IVehicleLoan extends Document {
  businessId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  lenderName: string;
  principal: Types.Decimal128;
  downPayment: Types.Decimal128;
  annualInterestRate: number;
  tenureMonths: number;
  processingFee: Types.Decimal128;
  emiAmount: Types.Decimal128;
  actualLenderEmi?: Types.Decimal128;
  startDate: Date;
  balloonPayment?: Types.Decimal128;
  outstandingBalance: Types.Decimal128;
  isSettled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleLoanSchema = new Schema<IVehicleLoan>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    lenderName: { type: String, required: true, maxlength: 200 },
    principal: { type: Schema.Types.Decimal128, required: true },
    downPayment: { type: Schema.Types.Decimal128, required: true },
    annualInterestRate: { type: Number, required: true, min: 0, max: 50 },
    tenureMonths: { type: Number, required: true, min: 1, max: 360 },
    processingFee: { type: Schema.Types.Decimal128, default: 0 },
    emiAmount: { type: Schema.Types.Decimal128, required: true },
    actualLenderEmi: Schema.Types.Decimal128,
    startDate: { type: Date, required: true },
    balloonPayment: Schema.Types.Decimal128,
    outstandingBalance: { type: Schema.Types.Decimal128, required: true },
    isSettled: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'vehicleLoans' },
);

export const VehicleLoanModel = model<IVehicleLoan>('VehicleLoan', VehicleLoanSchema);

// ─── Contract ─────────────────────────────────────────────────────────────────

export interface IContract extends Document {
  businessId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  driverId?: Types.ObjectId;
  companyName: string;
  contractReference: string;
  startDate: Date;
  endDate: Date;
  payoutPerTrip: Types.Decimal128;
  tripsPerDay: number;
  paidKmPerTrip: number;
  includesReturnJourney: boolean;
  waitingChargePerHour?: Types.Decimal128;
  overtimeRate?: Types.Decimal128;
  tollReimbursed: boolean;
  parkingReimbursed: boolean;
  guaranteedTripsPerMonth?: number;
  paymentCycleDays: number;
  deductionsPolicy?: string;
  status: 'active' | 'expired' | 'terminated' | 'draft';
  createdAt: Date;
  updatedAt: Date;
}

const ContractSchema = new Schema<IContract>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
    companyName: { type: String, required: true, maxlength: 200 },
    contractReference: { type: String, required: true, maxlength: 100 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    payoutPerTrip: { type: Schema.Types.Decimal128, required: true },
    tripsPerDay: { type: Number, required: true, min: 0.5, max: 30 },
    paidKmPerTrip: { type: Number, required: true, min: 1 },
    includesReturnJourney: { type: Boolean, default: false },
    waitingChargePerHour: Schema.Types.Decimal128,
    overtimeRate: Schema.Types.Decimal128,
    tollReimbursed: { type: Boolean, default: false },
    parkingReimbursed: { type: Boolean, default: false },
    guaranteedTripsPerMonth: Number,
    paymentCycleDays: { type: Number, default: 30, min: 1 },
    deductionsPolicy: { type: String, maxlength: 2000 },
    status: {
      type: String,
      enum: ['active', 'expired', 'terminated', 'draft'],
      default: 'draft',
    },
  },
  { timestamps: true, collection: 'contracts' },
);

ContractSchema.index({ businessId: 1, status: 1 });
ContractSchema.index({ businessId: 1, endDate: 1 });

export const ContractModel = model<IContract>('Contract', ContractSchema);

// ─── Trip ─────────────────────────────────────────────────────────────────────

export interface ITrip extends Document {
  businessId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  driverId: Types.ObjectId;
  contractId?: Types.ObjectId;
  source: string;
  date: Date;
  startTime: string;
  endTime?: string;
  startOdometer: number;
  endOdometer?: number;
  totalKm?: number;
  paidKm?: number;
  emptyKm?: number;
  grossFare: Types.Decimal128;
  incentives: Types.Decimal128;
  reimbursements: Types.Decimal128;
  platformCommission: Types.Decimal128;
  tolls: Types.Decimal128;
  parking: Types.Decimal128;
  otherTripExpenses: Types.Decimal128;
  paymentStatus: string;
  paymentMethod?: string;
  idempotencyKey: string;
  receiptUrl?: string;
  notes?: string;
  isCancelled: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TripSchema = new Schema<ITrip>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
    source: {
      type: String,
      enum: ['it_contract', 'ola', 'uber', 'red_taxi', 'other_aggregator', 'private', 'outstation', 'other'],
      required: true,
    },
    date: { type: Date, required: true },
    startTime: { type: String, required: true, maxlength: 5 },
    endTime: { type: String, maxlength: 5 },
    startOdometer: { type: Number, required: true, min: 0 },
    endOdometer: { type: Number, min: 0 },
    totalKm: { type: Number, min: 0 },
    paidKm: { type: Number, min: 0 },
    emptyKm: { type: Number, min: 0 },
    grossFare: { type: Schema.Types.Decimal128, required: true },
    incentives: { type: Schema.Types.Decimal128, default: 0 },
    reimbursements: { type: Schema.Types.Decimal128, default: 0 },
    platformCommission: { type: Schema.Types.Decimal128, default: 0 },
    tolls: { type: Schema.Types.Decimal128, default: 0 },
    parking: { type: Schema.Types.Decimal128, default: 0 },
    otherTripExpenses: { type: Schema.Types.Decimal128, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'overdue', 'cancelled'],
      default: 'pending',
    },
    paymentMethod: String,
    idempotencyKey: { type: String, required: true, maxlength: 100 },
    receiptUrl: { type: String, maxlength: 1000 },
    notes: { type: String, maxlength: 1000 },
    isCancelled: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'trips' },
);

// Idempotency: prevent duplicate trip submissions
TripSchema.index({ businessId: 1, idempotencyKey: 1 }, { unique: true });
TripSchema.index({ businessId: 1, date: 1 });
TripSchema.index({ businessId: 1, vehicleId: 1, date: 1 });
TripSchema.index({ businessId: 1, driverId: 1, date: 1 });

export const TripModel = model<ITrip>('Trip', TripSchema);

// ─── Fuel Entry ───────────────────────────────────────────────────────────────

export interface IFuelEntry extends Document {
  businessId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  date: Date;
  odometer: number;
  fuelType: string;
  quantity: number;
  unitPrice: Types.Decimal128;
  totalAmount: Types.Decimal128;
  stationName?: string;
  isFullRefill: boolean;
  paymentMethod?: string;
  receiptUrl?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FuelEntrySchema = new Schema<IFuelEntry>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    date: { type: Date, required: true },
    odometer: { type: Number, required: true, min: 0 },
    fuelType: {
      type: String,
      enum: ['petrol', 'diesel', 'cng', 'hybrid', 'electric'],
      required: true,
    },
    quantity: { type: Number, required: true, min: 0.1 },
    unitPrice: { type: Schema.Types.Decimal128, required: true },
    totalAmount: { type: Schema.Types.Decimal128, required: true },
    stationName: { type: String, maxlength: 200 },
    isFullRefill: { type: Boolean, required: true },
    paymentMethod: String,
    receiptUrl: { type: String, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'fuelEntries' },
);

FuelEntrySchema.index({ businessId: 1, vehicleId: 1, date: -1 });

export const FuelEntryModel = model<IFuelEntry>('FuelEntry', FuelEntrySchema);

// ─── Expense ──────────────────────────────────────────────────────────────────

export interface IExpense extends Document {
  businessId: Types.ObjectId;
  vehicleId?: Types.ObjectId;
  tripId?: Types.ObjectId;
  date: Date;
  category: string;
  amount: Types.Decimal128;
  reimbursedAmount: Types.Decimal128;
  netAmount: Types.Decimal128;
  vendor?: string;
  paymentMethod?: string;
  isRecurring: boolean;
  recurringSchedule?: string;
  receiptUrl?: string;
  notes?: string;
  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
    date: { type: Date, required: true },
    category: { type: String, required: true, maxlength: 50 },
    amount: { type: Schema.Types.Decimal128, required: true },
    reimbursedAmount: { type: Schema.Types.Decimal128, default: 0 },
    netAmount: { type: Schema.Types.Decimal128, required: true },
    vendor: { type: String, maxlength: 200 },
    paymentMethod: String,
    isRecurring: { type: Boolean, default: false },
    recurringSchedule: { type: String, maxlength: 100 },
    receiptUrl: { type: String, maxlength: 1000 },
    notes: { type: String, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'expenses' },
);

ExpenseSchema.index({ businessId: 1, date: -1 });
ExpenseSchema.index({ businessId: 1, vehicleId: 1, date: -1 });
ExpenseSchema.index({ businessId: 1, category: 1 });

export const ExpenseModel = model<IExpense>('Expense', ExpenseSchema);

// ─── Maintenance Item ─────────────────────────────────────────────────────────

export interface IMaintenanceItem extends Document {
  businessId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  itemName: string;
  lastServiceDate?: Date;
  lastServiceOdometer?: number;
  nextDueDate?: Date;
  nextDueOdometer?: number;
  intervalDays?: number;
  intervalKm?: number;
  estimatedCost?: Types.Decimal128;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MaintenanceItemSchema = new Schema<IMaintenanceItem>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    itemName: { type: String, required: true, maxlength: 200 },
    lastServiceDate: Date,
    lastServiceOdometer: { type: Number, min: 0 },
    nextDueDate: Date,
    nextDueOdometer: { type: Number, min: 0 },
    intervalDays: { type: Number, min: 1 },
    intervalKm: { type: Number, min: 1 },
    estimatedCost: Schema.Types.Decimal128,
    notes: { type: String, maxlength: 1000 },
  },
  { timestamps: true, collection: 'maintenanceItems' },
);

MaintenanceItemSchema.index({ businessId: 1, vehicleId: 1, nextDueDate: 1 });

export const MaintenanceItemModel = model<IMaintenanceItem>(
  'MaintenanceItem',
  MaintenanceItemSchema,
);

// ─── Audit Event ──────────────────────────────────────────────────────────────

export interface IAuditEvent extends Document {
  businessId?: Types.ObjectId;
  actorUserId: Types.ObjectId;
  eventType: string;
  entityType: string;
  entityId: Types.ObjectId;
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditEventSchema = new Schema<IAuditEvent>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    eventType: { type: String, required: true, maxlength: 100 },
    entityType: { type: String, required: true, maxlength: 100 },
    entityId: { type: Schema.Types.ObjectId, required: true },
    beforeSnapshot: Schema.Types.Mixed,
    afterSnapshot: Schema.Types.Mixed,
    ipAddress: { type: String, maxlength: 45 },
    userAgent: { type: String, maxlength: 500 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'auditEvents',
  },
);

// Audit events are immutable — no updates allowed
AuditEventSchema.index({ businessId: 1, createdAt: -1 });
AuditEventSchema.index({ entityType: 1, entityId: 1 });
// 2 year TTL for audit events
AuditEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 3600 });

export const AuditEventModel = model<IAuditEvent>('AuditEvent', AuditEventSchema);

// ─── Notification ─────────────────────────────────────────────────────────────

export interface INotification extends Document {
  businessId: any;
  userId?: any;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  entityType?: string;
  entityId?: any;
  scheduledFor?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    businessId: { type: Schema.Types.Mixed, required: true, index: true },
    userId: { type: Schema.Types.Mixed },
    type: { type: String, required: true, maxlength: 50 },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 2000 },
    isRead: { type: Boolean, default: false },
    entityType: { type: String, maxlength: 50 },
    entityId: Schema.Types.ObjectId,
    scheduledFor: Date,
  },
  { timestamps: true, collection: 'notifications' },
);

NotificationSchema.index({ businessId: 1, userId: 1, isRead: 1 });

export const NotificationModel = model<INotification>('Notification', NotificationSchema);

// ─── Simulation ───────────────────────────────────────────────────────────────

export interface ISimulation extends Document {
  businessId: Types.ObjectId;
  name: string;
  description?: string;
  vehicleDetails: Record<string, unknown>;
  financingDetails: Record<string, unknown>;
  fuelDetails: Record<string, unknown>;
  contractDetails: Record<string, unknown>;
  scenarios: Array<{
    type: string;
    label: string;
    overrides: Record<string, unknown>;
    result?: Record<string, unknown>;
  }>;
  calculationVersion: string;
  savedAt: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SimulationSchema = new Schema<ISimulation>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    vehicleDetails: { type: Schema.Types.Mixed, required: true },
    financingDetails: { type: Schema.Types.Mixed, required: true },
    fuelDetails: { type: Schema.Types.Mixed, required: true },
    contractDetails: { type: Schema.Types.Mixed, required: true },
    scenarios: [Schema.Types.Mixed],
    calculationVersion: { type: String, required: true, default: '1.0' },
    savedAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'simulations' },
);

export const SimulationModel = model<ISimulation>('Simulation', SimulationSchema);

// ─── Chat Message ─────────────────────────────────────────────────────────────

export interface IChatMessage extends Document {
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string;
  recipientName?: string;
  recipientRole?: string;
  text: string;
  read: boolean;
  businessId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    senderId: { type: String, required: true, index: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, required: true },
    recipientId: { type: String, required: true, index: true },
    recipientName: String,
    recipientRole: String,
    text: { type: String, required: true },
    read: { type: Boolean, default: false },
    businessId: { type: String, default: 'demo_fleet_biz_01' },
  },
  { timestamps: true, collection: 'chatMessages' },
);

ChatMessageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });

export const ChatMessageModel = model<IChatMessage>('ChatMessage', ChatMessageSchema);

// ─── Call Log ─────────────────────────────────────────────────────────────────

export interface ICallLog extends Document {
  callId: string;
  callerId: string;
  callerName: string;
  callerRole: string;
  callerPhone?: string;
  targetId: string;
  targetName: string;
  targetRole: string;
  targetPhone?: string;
  vehiclePlate?: string;
  status: 'completed' | 'missed' | 'rejected' | 'offline_failed';
  durationSeconds: number;
  startedAt: Date;
  endedAt?: Date;
  businessId?: string;
}

const CallLogSchema = new Schema<ICallLog>(
  {
    callId: { type: String, required: true, unique: true },
    callerId: { type: String, required: true, index: true },
    callerName: { type: String, required: true },
    callerRole: { type: String, required: true },
    callerPhone: String,
    targetId: { type: String, required: true, index: true },
    targetName: { type: String, required: true },
    targetRole: { type: String, required: true },
    targetPhone: String,
    vehiclePlate: String,
    status: {
      type: String,
      enum: ['completed', 'missed', 'rejected', 'offline_failed'],
      default: 'completed',
    },
    durationSeconds: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    endedAt: Date,
    businessId: { type: String, default: 'demo_fleet_biz_01' },
  },
  { timestamps: true, collection: 'callLogs' },
);

export const CallLogModel = model<ICallLog>('CallLog', CallLogSchema);

// ─── Taxi Booking ─────────────────────────────────────────────────────────────

export interface ITaxiBooking extends Document {
  bookingId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupCoords?: { lat: number; lng: number };
  dropoffCoords?: { lat: number; lng: number };
  cabTier: string;
  cabTierName: string;
  vehicleModel: string;
  estimatedDistanceKm: number;
  estimatedFare: number;
  baseFare: number;
  otp: string;
  status: 'pending' | 'driver_assigned' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled';
  assignedDriverId?: string;
  assignedDriverName?: string;
  assignedDriverPhone?: string;
  vehiclePlate?: string;
  issueReported?: boolean;
  issueDetails?: string;
  supportStatus?: 'normal' | 'support_needed' | 'resolved';
  supportResolutionNotes?: string;
  businessId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TaxiBookingSchema = new Schema<ITaxiBooking>(
  {
    bookingId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: String,
    pickupLocation: { type: String, required: true },
    dropoffLocation: { type: String, required: true },
    pickupCoords: { lat: Number, lng: Number },
    dropoffCoords: { lat: Number, lng: Number },
    cabTier: { type: String, required: true },
    cabTierName: { type: String, required: true },
    vehicleModel: { type: String, required: true },
    estimatedDistanceKm: { type: Number, required: true },
    estimatedFare: { type: Number, required: true },
    baseFare: { type: Number, required: true },
    otp: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'driver_assigned', 'driver_arrived', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    assignedDriverId: { type: String, index: true },
    assignedDriverName: String,
    assignedDriverPhone: String,
    vehiclePlate: String,
    issueReported: { type: Boolean, default: false },
    issueDetails: String,
    supportStatus: {
      type: String,
      enum: ['normal', 'support_needed', 'resolved'],
      default: 'normal',
      index: true,
    },
    supportResolutionNotes: String,
    businessId: { type: String, default: 'demo_fleet_biz_01', index: true },
  },
  { timestamps: true, collection: 'taxiBookings' },
);

TaxiBookingSchema.index({ businessId: 1, createdAt: -1 });

export const TaxiBookingModel = model<ITaxiBooking>('TaxiBooking', TaxiBookingSchema);

// ─── Driver Duty Status ───────────────────────────────────────────────────────

export interface IDriverDuty extends Document {
  driverId: string;
  driverName: string;
  phone: string;
  vehiclePlate: string;
  status: 'online' | 'offline' | 'on_trip';
  lastStatusChange: Date;
  offlineNotifiedToOwner: boolean;
  businessId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DriverDutySchema = new Schema<IDriverDuty>(
  {
    driverId: { type: String, required: true, unique: true, index: true },
    driverName: { type: String, required: true },
    phone: { type: String, required: true },
    vehiclePlate: { type: String, required: true },
    status: {
      type: String,
      enum: ['online', 'offline', 'on_trip'],
      default: 'online',
      index: true,
    },
    lastStatusChange: { type: Date, default: Date.now },
    offlineNotifiedToOwner: { type: Boolean, default: false },
    businessId: { type: String, default: 'demo_fleet_biz_01' },
  },
  { timestamps: true, collection: 'driverDuties' },
);

export const DriverDutyModel = model<IDriverDuty>('DriverDuty', DriverDutySchema);

