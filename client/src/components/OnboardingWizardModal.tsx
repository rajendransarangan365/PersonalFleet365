import React, { useState } from 'react';
import {
  Truck, Car, IndianRupee, Shield, User,
  CheckCircle2, ChevronRight, ChevronLeft, X,
  Mail, Phone, Lock, Sparkles, AlertCircle, Droplet,
  Gauge, HelpCircle
} from 'lucide-react';
import {
  INDIAN_COMMERCIAL_VEHICLES,
  type IndianVehiclePreset
} from '../data/indianVehicles.js';
import { apiPost } from '../services/api.js';
import { useAuthStore } from '../store/auth.store.js';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function OnboardingWizardModal({
  isOpen,
  onClose,
  onSuccess,
}: OnboardingWizardModalProps) {
  const { setTokenAndUser } = useAuthStore();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // OTP Verification state
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpVerified, setOtpVerified] = useState<boolean>(false);
  const [sendingOtp, setSendingOtp] = useState<boolean>(false);

  // Form State
  const [form, setForm] = useState({
    // Step 1: Fleet & Owner Profile
    fleetName: 'Chennai Prime Cabs',
    fleetCity: 'Chennai',
    fleetState: 'Tamil Nadu',
    numberOfCars: 1,
    ownerName: 'Sarangan R',
    ownerEmail: 'sarangan365@gmail.com',
    ownerPhone: '+919876543210',
    ownerPassword: 'Password@123',

    // Step 2: Vehicle Selection
    selectedPresetId: 'dzire_tour_s',
    customRegNumber: 'TN01BV4589',
    make: 'Maruti Suzuki',
    model: 'Dzire Tour S',
    fuelType: 'cng' as 'cng' | 'diesel' | 'electric' | 'petrol',
    seatingCapacity: 4,
    isPassenger: true,

    // Step 3: Financing & Insurance
    onRoadPrice: 850000,
    downPayment: 150000,
    tenureMonths: 36,
    interestRate: 10.5,
    calculatedMonthlyEmi: 22750,
    insuranceProvider: 'ICICI Lombard Commercial',
    insurancePolicyNumber: 'POL-COMM-9921',
    insuranceExpiryDate: '2027-10-15',

    // Step 4: Mileage, AdBlue & Tyres
    claimedMileage: 31.12,
    expectedMileage: 26.5,
    unit: 'km/kg',
    adBlueRequired: false,
    adBlueLitersPer1000Km: 0,
    tyreBrand: 'MRF ZVTS',
    tyreWarrantyKm: 50000,

    // Step 5: Driver Assignment
    driverName: 'Karthik Raja',
    driverPhone: '+919876543210',
    driverLicenseNumber: 'TN0120200004921',
    hasOwnVehicle: false,
  });

  if (!isOpen) return null;

  // Auto calculate EMI when loan values change
  const calculateEmi = (price: number, down: number, tenure: number, annualRate: number) => {
    const principal = Math.max(0, price - down);
    if (principal === 0 || tenure === 0) return 0;
    const monthlyRate = annualRate / (12 * 100);
    const emi =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) /
      (Math.pow(1 + monthlyRate, tenure) - 1);
    return Math.round(emi);
  };

  const handlePresetSelect = (preset: IndianVehiclePreset) => {
    const emi = calculateEmi(
      preset.onRoadPriceINR,
      preset.defaultDownPaymentINR,
      preset.defaultTenureMonths,
      preset.defaultInterestRate
    );

    setForm((prev) => ({
      ...prev,
      selectedPresetId: preset.id,
      make: preset.make,
      model: preset.model,
      fuelType: preset.fuelType,
      seatingCapacity: preset.seatingCapacity,
      isPassenger: preset.category !== 'cargo',
      onRoadPrice: preset.onRoadPriceINR,
      downPayment: preset.defaultDownPaymentINR,
      tenureMonths: preset.defaultTenureMonths,
      interestRate: preset.defaultInterestRate,
      calculatedMonthlyEmi: emi,
      claimedMileage: preset.claimedMileage,
      expectedMileage: preset.expectedMileage,
      unit: preset.unit,
      adBlueRequired: preset.adBlueRequired,
      adBlueLitersPer1000Km: preset.adBlueLitersPer1000Km || 0,
    }));
  };

  // Recalculate EMI whenever price/down payment/tenure/interest change
  const handleFinanceChange = (field: string, val: number) => {
    const updated = { ...form, [field]: val };
    const emi = calculateEmi(
      field === 'onRoadPrice' ? val : updated.onRoadPrice,
      field === 'downPayment' ? val : updated.downPayment,
      field === 'tenureMonths' ? val : updated.tenureMonths,
      field === 'interestRate' ? val : updated.interestRate
    );
    setForm({ ...updated, calculatedMonthlyEmi: emi });
  };

  // Send OTP via Gmail SMTP
  const handleSendOtp = async () => {
    setErrorMsg(null);
    setSendingOtp(true);
    try {
      await apiPost('/auth/send-otp', {
        email: form.ownerEmail,
        purpose: 'registration',
      });
      setOtpSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send OTP to email. Check SMTP server configuration.');
    } finally {
      setSendingOtp(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await apiPost('/auth/verify-otp', {
        email: form.ownerEmail,
        code: otpCode,
        purpose: 'registration',
      });
      setOtpVerified(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // Submit complete onboarding payload
  const handleSubmitOnboarding = async () => {
    setErrorMsg(null);
    setLoading(true);

    try {
      const payload = {
        fleetProfile: {
          businessName: form.fleetName,
          city: form.fleetCity,
          state: form.fleetState,
          numberOfVehicles: Number(form.numberOfCars),
        },
        userProfile: {
          displayName: form.ownerName,
          email: form.ownerEmail,
          phone: form.ownerPhone,
          password: form.ownerPassword,
          role: 'owner',
        },
        vehicleDetails: {
          registrationNumber: form.customRegNumber.toUpperCase(),
          make: form.make,
          model: form.model,
          fuelType: form.fuelType,
          seatingCapacity: Number(form.seatingCapacity),
          isPassenger: form.isPassenger,
          currentOdometer: 1000,
          purchasePriceINR: Number(form.onRoadPrice),
          financing: {
            onRoadCostINR: Number(form.onRoadPrice),
            downPaymentINR: Number(form.downPayment),
            loanTenureMonths: Number(form.tenureMonths),
            interestRatePercent: Number(form.interestRate),
            monthlyEmiINR: Number(form.calculatedMonthlyEmi),
          },
          insurance: {
            provider: form.insuranceProvider,
            policyNumber: form.insurancePolicyNumber,
            renewalDate: form.insuranceExpiryDate,
          },
          mileageConfig: {
            claimedMileage: Number(form.claimedMileage),
            expectedMileage: Number(form.expectedMileage),
            unit: form.unit,
            adBlueRequired: form.adBlueRequired,
            adBlueLitersPer1000Km: Number(form.adBlueLitersPer1000Km),
            tyreBrand: form.tyreBrand,
            tyreWarrantyKm: Number(form.tyreWarrantyKm),
          },
        },
        driverDetails: {
          fullName: form.driverName,
          phone: form.driverPhone,
          licenseNumber: form.driverLicenseNumber,
          hasOwnVehicle: form.hasOwnVehicle,
        },
      };

      const res = await apiPost<any>('/auth/quick-onboarding', payload);

      if (res.accessToken && res.user) {
        setTokenAndUser(res.accessToken, res.user, [
          {
            businessId: res.business?._id || 'biz_new',
            role: 'owner',
            permissions: [],
          },
        ]);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Onboarding failed. Please review your entries.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, title: 'Fleet Profile' },
    { num: 2, title: 'Indian Car Model' },
    { num: 3, title: 'Financing & Insurance' },
    { num: 4, title: 'Mileage & Tyres' },
    { num: 5, title: 'Driver & Verification' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="glass-card w-full max-w-4xl max-h-[92vh] flex flex-col border-slate-700 shadow-2xl relative">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                FleetWise Fast Onboarding Wizard
                <span className="text-[10px] bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full border border-brand-500/30">
                  Step {currentStep} of 5
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Setup your fleet company, commercial car, loan EMI, mileage benchmarks & driver.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Progress Bar */}
        <div className="px-6 py-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between overflow-x-auto gap-2">
          {steps.map((s) => (
            <div
              key={s.num}
              onClick={() => s.num < currentStep && setCurrentStep(s.num)}
              className={`flex items-center gap-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                currentStep === s.num
                  ? 'text-brand-400 font-bold'
                  : currentStep > s.num
                  ? 'text-emerald-400'
                  : 'text-slate-500'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  currentStep === s.num
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/40'
                    : currentStep > s.num
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {currentStep > s.num ? '✓' : s.num}
              </div>
              <span className="hidden sm:inline">{s.title}</span>
              {s.num < 5 && <ChevronRight className="w-3.5 h-3.5 text-slate-700 ml-1" />}
            </div>
          ))}
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* STEP 1: Fleet & Owner Profile */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Truck className="w-4 h-4 text-brand-400" />
                Fleet Profile & Owner Credentials
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Fleet / Company Name</label>
                  <input
                    type="text"
                    required
                    value={form.fleetName}
                    onChange={(e) => setForm({ ...form, fleetName: e.target.value })}
                    className="form-input"
                    placeholder="e.g. Chennai Prime Cabs"
                  />
                </div>

                <div>
                  <label className="form-label">Fleet Size (Number of Cars)</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={form.numberOfCars}
                    onChange={(e) => setForm({ ...form, numberOfCars: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    value={form.fleetCity}
                    onChange={(e) => setForm({ ...form, fleetCity: e.target.value })}
                    className="form-input"
                    placeholder="e.g. Chennai, Bangalore, Delhi"
                  />
                </div>

                <div>
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    value={form.fleetState}
                    onChange={(e) => setForm({ ...form, fleetState: e.target.value })}
                    className="form-input"
                    placeholder="e.g. Tamil Nadu, Karnataka"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Fleet Owner Full Name</label>
                  <input
                    type="text"
                    required
                    value={form.ownerName}
                    onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Owner Mobile (for WhatsApp alerts)</label>
                  <input
                    type="tel"
                    required
                    value={form.ownerPhone}
                    onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Owner Email (Gmail for SMTP OTP)</label>
                  <input
                    type="email"
                    required
                    value={form.ownerEmail}
                    onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    required
                    value={form.ownerPassword}
                    onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Indian Commercial Car Preset Selector */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Car className="w-4 h-4 text-brand-400" />
                  Select Indian Commercial Vehicle Model
                </h3>
                <span className="text-xs text-slate-400">Pre-loaded commercial specs & pricing</span>
              </div>

              {/* Vehicle Preset Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {INDIAN_COMMERCIAL_VEHICLES.map((preset) => {
                  const isSelected = form.selectedPresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className={`glass-card p-3.5 border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                        isSelected
                          ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/20'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                      }`}
                    >
                      <div>
                        <div className="h-28 rounded-lg overflow-hidden mb-2.5 relative bg-slate-950">
                          <img
                            src={preset.imageUrl}
                            alt={preset.name}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur px-2 py-0.5 rounded text-[10px] uppercase font-bold text-emerald-400 border border-slate-700">
                            {preset.fuelType}
                          </span>
                        </div>

                        <h4 className="font-bold text-white text-xs leading-snug">{preset.name}</h4>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{preset.description}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] flex items-center justify-between">
                        <span className="text-slate-400">Capacity: <strong className="text-white">{preset.seatingCapacity} Pax</strong></span>
                        <span className="font-bold text-cyan-400 font-mono">₹{(preset.onRoadPriceINR / 100000).toFixed(1)}L</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Registration Number & Passenger Count */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Vehicle Registration Number</label>
                  <input
                    type="text"
                    required
                    value={form.customRegNumber}
                    onChange={(e) => setForm({ ...form, customRegNumber: e.target.value.toUpperCase() })}
                    className="form-input uppercase tracking-wider font-semibold font-mono"
                    placeholder="TN01BV4589"
                  />
                </div>

                <div>
                  <label className="form-label">Passenger Capacity (Seats)</label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={form.seatingCapacity}
                    onChange={(e) => setForm({ ...form, seatingCapacity: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Vehicle Category</label>
                  <select
                    value={form.isPassenger ? 'passenger' : 'cargo'}
                    onChange={(e) => setForm({ ...form, isPassenger: e.target.value === 'passenger' })}
                    className="form-input"
                  >
                    <option value="passenger">Passenger Commercial (Taxi/Cab)</option>
                    <option value="cargo">Goods / Cargo Commercial</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Down Payment, EMI & Insurance Details */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-emerald-400" />
                Vehicle Down Payment, Loan EMI & Insurance
              </h3>

              {/* Live EMI Calculator Summary Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-400 block">Monthly Loan EMI Commitment</span>
                  <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                    ₹{form.calculatedMonthlyEmi.toLocaleString('en-IN')} <span className="text-xs text-slate-400 font-normal">/ month</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Principal Loan Amount: ₹{(form.onRoadPrice - form.downPayment).toLocaleString('en-IN')} at {form.interestRate}% for {form.tenureMonths} months
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Down Payment Paid</span>
                  <span className="text-lg font-bold text-white font-mono">₹{form.downPayment.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Loan & EMI Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="form-label">On-Road Vehicle Cost (₹)</label>
                  <input
                    type="number"
                    min="100000"
                    step="10000"
                    value={form.onRoadPrice}
                    onChange={(e) => handleFinanceChange('onRoadPrice', Number(e.target.value))}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Down Payment (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={form.downPayment}
                    onChange={(e) => handleFinanceChange('downPayment', Number(e.target.value))}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Loan Tenure (Months)</label>
                  <select
                    value={form.tenureMonths}
                    onChange={(e) => handleFinanceChange('tenureMonths', Number(e.target.value))}
                    className="form-input"
                  >
                    <option value="24">24 Months (2 Yrs)</option>
                    <option value="36">36 Months (3 Yrs)</option>
                    <option value="48">48 Months (4 Yrs)</option>
                    <option value="60">60 Months (5 Yrs)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Interest Rate (% p.a.)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="5"
                    max="24"
                    value={form.interestRate}
                    onChange={(e) => handleFinanceChange('interestRate', Number(e.target.value))}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Insurance Details */}
              <div className="pt-3 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  Commercial Insurance Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="form-label">Insurance Provider</label>
                    <input
                      type="text"
                      value={form.insuranceProvider}
                      onChange={(e) => setForm({ ...form, insuranceProvider: e.target.value })}
                      className="form-input"
                      placeholder="e.g. ICICI Lombard / Tata AIG"
                    />
                  </div>

                  <div>
                    <label className="form-label">Policy Number</label>
                    <input
                      type="text"
                      value={form.insurancePolicyNumber}
                      onChange={(e) => setForm({ ...form, insurancePolicyNumber: e.target.value })}
                      className="form-input font-mono"
                      placeholder="POL-12345"
                    />
                  </div>

                  <div>
                    <label className="form-label">Policy Expiry / Renewal Date</label>
                    <input
                      type="date"
                      value={form.insuranceExpiryDate}
                      onChange={(e) => setForm({ ...form, insuranceExpiryDate: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Claimed vs Real Mileage, Diesel AdBlue & Tyres */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                Mileage Benchmarks, Fuel, Diesel AdBlue & Tyres
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Fuel Type</label>
                  <select
                    value={form.fuelType}
                    onChange={(e) => setForm({ ...form, fuelType: e.target.value as any })}
                    className="form-input uppercase font-semibold"
                  >
                    <option value="cng">CNG (kg)</option>
                    <option value="diesel">Diesel (Litres)</option>
                    <option value="electric">Electric EV (kWh / Charge)</option>
                    <option value="petrol">Petrol (Litres)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Company Claimed Mileage (ARAI)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={form.claimedMileage}
                      onChange={(e) => setForm({ ...form, claimedMileage: Number(e.target.value) })}
                      className="form-input pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                      {form.unit}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="form-label">Real-World Fleet Target Mileage</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={form.expectedMileage}
                      onChange={(e) => setForm({ ...form, expectedMileage: Number(e.target.value) })}
                      className="form-input pr-16 text-cyan-400 font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                      {form.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Diesel AdBlue Section */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Droplet className="w-4 h-4 text-blue-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Diesel Exhaust Fluid (AdBlue) Tracking</h4>
                      <p className="text-[11px] text-slate-400">Required for BS6 Commercial Diesel vehicles (e.g. Innova Crysta, Tata Ace Diesel)</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.adBlueRequired}
                      onChange={(e) => setForm({ ...form, adBlueRequired: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {form.adBlueRequired && (
                  <div className="pt-2 border-t border-slate-800 flex items-center gap-4 animate-fade-in">
                    <div className="flex-1">
                      <label className="form-label">AdBlue Consumption (Litres per 1000 km)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.adBlueLitersPer1000Km || 1.2}
                        onChange={(e) => setForm({ ...form, adBlueLitersPer1000Km: Number(e.target.value) })}
                        className="form-input"
                      />
                    </div>
                    <div className="text-xs text-slate-400 max-w-xs">
                      Average commercial rate: ₹60 - ₹80 per litre. Tracks DEF expense in driver fuel settlements.
                    </div>
                  </div>
                )}
              </div>

              {/* Tyres Management */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Fitted Tyre Brand & Spec</label>
                  <input
                    type="text"
                    value={form.tyreBrand}
                    onChange={(e) => setForm({ ...form, tyreBrand: e.target.value })}
                    className="form-input"
                    placeholder="e.g. MRF ZVTS / Apollo Amazer / CEAT FuelSmarrt"
                  />
                </div>

                <div>
                  <label className="form-label">Tyre Warranty Odometer Benchmark (km)</label>
                  <input
                    type="number"
                    step="5000"
                    value={form.tyreWarrantyKm}
                    onChange={(e) => setForm({ ...form, tyreWarrantyKm: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Driver Assignment & Gmail SMTP OTP Verification */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                Assign Driver & Verify Profile via Gmail SMTP
              </h3>

              {/* Driver Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Assigned Driver Full Name</label>
                  <input
                    type="text"
                    required
                    value={form.driverName}
                    onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                    className="form-input"
                    placeholder="e.g. Karthik Raja"
                  />
                </div>

                <div>
                  <label className="form-label">Driver Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={form.driverPhone}
                    onChange={(e) => setForm({ ...form, driverPhone: e.target.value })}
                    className="form-input"
                    placeholder="+919876543210"
                  />
                </div>

                <div>
                  <label className="form-label">Commercial Driving License (DL)</label>
                  <input
                    type="text"
                    required
                    value={form.driverLicenseNumber}
                    onChange={(e) => setForm({ ...form, driverLicenseNumber: e.target.value.toUpperCase() })}
                    className="form-input font-mono"
                    placeholder="TN0120200004921"
                  />
                </div>
              </div>

              {/* Driver Vehicle Possession */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-white block">Vehicle Allocation Model</span>
                  <span className="text-slate-400">
                    {form.hasOwnVehicle
                      ? 'Driver brings own commercial vehicle (Driver-Cum-Owner model)'
                      : 'Fleet provides vehicle to driver (Company fleet handover)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, hasOwnVehicle: !form.hasOwnVehicle })}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Switch: {form.hasOwnVehicle ? 'Driver Owned' : 'Fleet Provided'}
                </button>
              </div>

              {/* Gmail SMTP OTP Verification Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-brand-950/40 via-slate-900 to-slate-900 border border-brand-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-brand-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Gmail SMTP Security Verification</h4>
                      <p className="text-[11px] text-slate-400">
                        Sends a 6-digit OTP to <strong className="text-brand-300">{form.ownerEmail}</strong> via Gmail server
                      </p>
                    </div>
                  </div>

                  {!otpVerified ? (
                    <button
                      type="button"
                      disabled={sendingOtp}
                      onClick={handleSendOtp}
                      className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{otpSent ? 'Resend OTP' : 'Send Gmail OTP'}</span>
                    </button>
                  ) : (
                    <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Email Verified
                    </span>
                  )}
                </div>

                {otpSent && !otpVerified && (
                  <div className="pt-3 border-t border-slate-800 flex items-center gap-3 animate-fade-in">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      className="form-input max-w-xs font-mono text-center tracking-widest text-lg font-bold"
                    />
                    <button
                      type="button"
                      disabled={loading || otpCode.length < 6}
                      onClick={handleVerifyOtp}
                      className="btn-primary text-xs px-4 py-2.5"
                    >
                      Verify OTP
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            className="btn-secondary text-xs flex items-center gap-1 px-4 py-2 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-3">
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1))}
                className="btn-primary text-xs flex items-center gap-1 px-5 py-2 font-semibold shadow-lg shadow-brand-500/20"
              >
                Next Step
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleSubmitOnboarding}
                className="btn-primary text-xs flex items-center gap-2 px-6 py-2.5 font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Creating Fleet...' : 'Complete Fleet Onboarding'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
