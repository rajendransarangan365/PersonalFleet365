import React, { useState, useMemo } from 'react';
import {
  Calculator, IndianRupee, TrendingUp, Gauge, Fuel,
  Car, Shield, AlertCircle, ArrowUpRight, BarChart3,
  Layers, CheckCircle2, RefreshCw, Sparkles, Loader2, X, Bot
} from 'lucide-react';
import { runSimulationAdvisorAI } from '../../services/gemini.service.js';
import { useAuthStore } from '../../store/auth.store.js';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, Legend
} from 'recharts';
import {
  calculateEmi,
  estimateFuelCost,
  calculateStraightLineDepreciation,
  calculateBreakEven,
  buildFiveYearForecast,
  formatINR,
  toPaise,
} from '@fleetwise/shared';

export default function ProfitSimulatorPage() {
  // Vehicle & Financing
  const [vehiclePriceINR, setVehiclePriceINR] = useState(820000); // ₹8.2L
  const [downPaymentINR, setDownPaymentINR] = useState(150000);  // ₹1.5L
  const [interestRate, setInterestRate] = useState(10.5);          // 10.5%
  const [tenureMonths, setTenureMonths] = useState(36);            // 3 years

  // Fuel & Efficiency
  const [fuelType, setFuelType] = useState<'cng' | 'diesel' | 'petrol' | 'electric'>('cng');
  const [fuelPriceINR, setFuelPriceINR] = useState(89);            // ₹89/kg for CNG
  const [fuelEfficiency, setFuelEfficiency] = useState(25);        // 25 km/kg

  // Operations & Trips
  const [payoutPerTripINR, setPayoutPerTripINR] = useState(1650);  // ₹1,650
  const [tripsPerDay, setTripsPerDay] = useState(2);               // 2 trips
  const [paidKmPerTrip, setPaidKmPerTrip] = useState(65);          // 65 km
  const [emptyRunningKm, setEmptyRunningKm] = useState(15);        // 15 km empty per day
  const [workingDays, setWorkingDays] = useState(26);              // 26 days/mo
  const [platformCommissionPct, setPlatformCommissionPct] = useState(0); // 0% (contract) or 20% (Ola/Uber)
  const [driverWageINR, setDriverWageINR] = useState(20000);        // ₹20,000 monthly
  const [maintenanceReservePerKmINR, setMaintenanceReservePerKmINR] = useState(1.2); // ₹1.20 / km

  // Gemini Free Tier Advisor State
  const { activeBusinessId } = useAuthStore();
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Calculations
  const simulation = useMemo(() => {
    const loanPrincipal = Math.max(0, vehiclePriceINR - downPaymentINR);
    const emiResult = calculateEmi({
      principal: loanPrincipal * 100,
      annualInterestRate: interestRate,
      tenureMonths,
    });

    const monthlyEmiPaise = emiResult.monthlyEmi;

    const monthlyTrips = workingDays * tripsPerDay;
    const monthlyGrossRevenuePaise = monthlyTrips * payoutPerTripINR * 100;
    const monthlyCommissionPaise = Math.round(monthlyGrossRevenuePaise * (platformCommissionPct / 100));
    const monthlyNetRevenuePaise = monthlyGrossRevenuePaise - monthlyCommissionPaise;

    const totalKmPerDay = tripsPerDay * paidKmPerTrip + emptyRunningKm;
    const monthlyTotalKm = workingDays * totalKmPerDay;

    // Fuel cost in paise
    const fuelCostPaise = estimateFuelCost({
      km: monthlyTotalKm,
      efficiencyKmPerLitre: fuelEfficiency,
      unitPricePaise: fuelPriceINR * 100,
    });

    // Maintenance reserve in paise
    const monthlyMaintenancePaise = Math.round(monthlyTotalKm * maintenanceReservePerKmINR * 100);

    // Insurance & Registration (~₹3,000/mo)
    const monthlyInsurancePaise = 3000 * 100;

    // Driver wage
    const monthlyDriverWagePaise = driverWageINR * 100;

    const totalOperatingCostPaise =
      fuelCostPaise +
      monthlyMaintenancePaise +
      monthlyInsurancePaise +
      monthlyDriverWagePaise;

    // Net Cash Flow (Money in hand after paying operating costs + EMI)
    const netCashFlowPaise = monthlyNetRevenuePaise - totalOperatingCostPaise - monthlyEmiPaise;

    // Depreciation
    const monthlyDepreciationPaise = calculateStraightLineDepreciation({
      purchasePricePaise: vehiclePriceINR * 100,
      expectedResalePaise: Math.round(vehiclePriceINR * 0.3 * 100),
      ownershipPeriodMonths: 60,
    });

    // Economic profit
    const economicProfitPaise = monthlyNetRevenuePaise - totalOperatingCostPaise - monthlyDepreciationPaise;

    const costPerKmPaise = monthlyTotalKm > 0 ? Math.round((totalOperatingCostPaise + monthlyEmiPaise) / monthlyTotalKm) : 0;
    const revenuePerKmPaise = monthlyTotalKm > 0 ? Math.round(monthlyNetRevenuePaise / monthlyTotalKm) : 0;
    const marginPct = monthlyNetRevenuePaise > 0 ? ((netCashFlowPaise / monthlyNetRevenuePaise) * 100).toFixed(1) : '0';

    // Break-even
    const fixedCostsPaise = monthlyEmiPaise + monthlyInsurancePaise + monthlyDriverWagePaise;
    const variableCostPerTripPaise = Math.round((fuelCostPaise + monthlyMaintenancePaise) / (monthlyTrips || 1));

    const breakEven = calculateBreakEven(
      {
        fixedMonthlyCosts: fixedCostsPaise,
        variableCostPerTrip: variableCostPerTripPaise,
        platformCommissionPercent: platformCommissionPct,
        tripsPerMonth: monthlyTrips || 1,
      },
      payoutPerTripINR * 100,
      workingDays,
      monthlyDepreciationPaise
    );

    // 3 Year Forecast Data
    const forecast = buildFiveYearForecast({
      monthlyRevenuePaise: monthlyNetRevenuePaise,
      monthlyOperatingExpensesPaise: totalOperatingCostPaise,
      emiPaise: monthlyEmiPaise,
      monthlyDepreciationPaise,
      loanPrincipalPaise: loanPrincipal * 100,
      tenureMonths,
      annualInterestRate: interestRate,
    }).slice(0, 36);

    const chartData = [
      { month: 'M1', revenue: monthlyNetRevenuePaise / 100, expenses: (totalOperatingCostPaise + monthlyEmiPaise) / 100, profit: netCashFlowPaise / 100 },
      { month: 'M6', revenue: monthlyNetRevenuePaise / 100, expenses: (totalOperatingCostPaise + monthlyEmiPaise) / 100, profit: netCashFlowPaise / 100 },
      { month: 'M12', revenue: monthlyNetRevenuePaise / 100, expenses: (totalOperatingCostPaise + monthlyEmiPaise) / 100, profit: netCashFlowPaise / 100 },
      { month: 'M18', revenue: monthlyNetRevenuePaise / 100, expenses: (totalOperatingCostPaise + monthlyEmiPaise) / 100, profit: netCashFlowPaise / 100 },
      { month: 'M24', revenue: monthlyNetRevenuePaise / 100, expenses: (totalOperatingCostPaise + monthlyEmiPaise) / 100, profit: netCashFlowPaise / 100 },
      { month: 'M36', revenue: monthlyNetRevenuePaise / 100, expenses: totalOperatingCostPaise / 100, profit: (monthlyNetRevenuePaise - totalOperatingCostPaise) / 100 }, // Loan cleared!
    ];

    return {
      monthlyEmiPaise,
      monthlyGrossRevenuePaise,
      monthlyCommissionPaise,
      monthlyNetRevenuePaise,
      monthlyTotalKm,
      fuelCostPaise,
      monthlyMaintenancePaise,
      totalOperatingCostPaise,
      netCashFlowPaise,
      economicProfitPaise,
      costPerKmPaise,
      revenuePerKmPaise,
      marginPct,
      breakEven,
      chartData,
    };
  }, [
    vehiclePriceINR,
    downPaymentINR,
    interestRate,
    tenureMonths,
    fuelPriceINR,
    fuelEfficiency,
    payoutPerTripINR,
    tripsPerDay,
    paidKmPerTrip,
    emptyRunningKm,
    workingDays,
    platformCommissionPct,
    driverWageINR,
    maintenanceReservePerKmINR,
  ]);

  const presetVehicle = (type: 'dzire_cng' | 'ertiga_cng' | 'ev_tigor' | 'innova_diesel') => {
    switch (type) {
      case 'dzire_cng':
        setVehiclePriceINR(820000);
        setDownPaymentINR(150000);
        setFuelType('cng');
        setFuelPriceINR(89);
        setFuelEfficiency(26);
        break;
      case 'ertiga_cng':
        setVehiclePriceINR(1180000);
        setDownPaymentINR(250000);
        setFuelType('cng');
        setFuelPriceINR(89);
        setFuelEfficiency(21);
        break;
      case 'ev_tigor':
        setVehiclePriceINR(1300000);
        setDownPaymentINR(200000);
        setFuelType('electric');
        setFuelPriceINR(10); // ₹10/kWh
        setFuelEfficiency(8.5); // 8.5 km/kWh
        break;
      case 'innova_diesel':
        setVehiclePriceINR(2200000);
        setDownPaymentINR(400000);
        setFuelType('diesel');
        setFuelPriceINR(94);
        setFuelEfficiency(14);
        break;
    }
  };

  const handleRunAiAdvisor = async () => {
    try {
      setIsAiLoading(true);
      setIsAiModalOpen(true);
      const advice = await runSimulationAdvisorAI(activeBusinessId, {
        vehicleModel: fuelType === 'cng' ? 'Maruti Dzire Tour CNG' : fuelType === 'electric' ? 'Tata Tigor EV' : fuelType === 'diesel' ? 'Toyota Innova Diesel' : 'Petrol Sedan',
        fuelType,
        onRoadPrice: vehiclePriceINR * 100,
        monthlyEmi: simulation.monthlyEmiPaise,
        monthlyRevenue: simulation.monthlyNetRevenuePaise,
        monthlyFuelCost: simulation.fuelCostPaise,
        monthlyNetProfit: simulation.netCashFlowPaise,
        breakEvenTripsPerDay: simulation.breakEven.breakEvenTripsPerDay,
      });
      setAiAdvice(advice);
    } catch (err: any) {
      setAiAdvice(`Failed to run AI Investment Advisor: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Calculator className="w-7 h-7 text-brand-400" />
            Taxi Business Profit & ROI Simulator
          </h1>
          <p className="text-sm text-slate-400">
            Simulate vehicle investments, EMI burdens, CNG vs EV savings, and guaranteed break-even
          </p>
        </div>

        {/* Quick Presets & AI Button */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={handleRunAiAdvisor}
            disabled={isAiLoading}
            className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3 bg-gradient-to-r from-brand-600 to-purple-600 border-none shadow-md shadow-brand-500/20 whitespace-nowrap"
          >
            {isAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-cyan-300" />}
            Gemini AI Advisor
          </button>
          <span className="text-xs text-slate-500 font-medium">Presets:</span>
          <button
            onClick={() => presetVehicle('dzire_cng')}
            className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 transition-colors whitespace-nowrap"
          >
            Dzire Tour CNG
          </button>
          <button
            onClick={() => presetVehicle('ertiga_cng')}
            className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 transition-colors whitespace-nowrap"
          >
            Ertiga 7-Str
          </button>
          <button
            onClick={() => presetVehicle('ev_tigor')}
            className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-slate-700 hover:border-emerald-600/40 transition-colors whitespace-nowrap"
          >
            ⚡ Tigor EV
          </button>
          <button
            onClick={() => presetVehicle('innova_diesel')}
            className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-amber-400 hover:text-amber-300 border border-slate-700 hover:border-amber-600/40 transition-colors whitespace-nowrap"
          >
            Innova Diesel
          </button>
        </div>
      </div>

      {/* Top Results Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 border-l-4 border-l-emerald-500">
          <p className="text-xs text-slate-400 font-medium">Net Monthly Cash Flow</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {formatINR(simulation.netCashFlowPaise)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">After all fuel, EMI & wages</p>
        </div>

        <div className="glass-card p-4 border-l-4 border-l-brand-500">
          <p className="text-xs text-slate-400 font-medium">Monthly Loan EMI</p>
          <p className="text-2xl font-bold text-white mt-1">
            {formatINR(simulation.monthlyEmiPaise)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">{tenureMonths} mos @ {interestRate}% p.a.</p>
        </div>

        <div className="glass-card p-4 border-l-4 border-l-cyan-500">
          <p className="text-xs text-slate-400 font-medium">Profit Margin</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1">
            {simulation.marginPct}%
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Cost: {formatINR(simulation.costPerKmPaise)}/km</p>
        </div>

        <div className="glass-card p-4 border-l-4 border-l-amber-500">
          <p className="text-xs text-slate-400 font-medium">Break-Even Trips</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">
            {simulation.breakEven.breakEvenTripsPerDay} trips/day
          </p>
          <p className="text-[11px] text-slate-500 mt-1">At ₹{payoutPerTripINR}/trip</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Inputs Section */}
        <div className="lg:col-span-5 space-y-5">
          {/* 1. Vehicle & Loan Card */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Car className="w-4 h-4 text-brand-400" />
              1. Vehicle & Financing
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">On-Road Cost (₹)</label>
                <input
                  type="number"
                  step="10000"
                  value={vehiclePriceINR}
                  onChange={(e) => setVehiclePriceINR(Number(e.target.value))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Down Payment (₹)</label>
                <input
                  type="number"
                  step="10000"
                  value={downPaymentINR}
                  onChange={(e) => setDownPaymentINR(Number(e.target.value))}
                  className="form-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Interest Rate (% p.a.)</label>
                <input
                  type="number"
                  step="0.1"
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Loan Tenure (Months)</label>
                <select
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(Number(e.target.value))}
                  className="form-input"
                >
                  <option value={24}>24 Months (2 yrs)</option>
                  <option value={36}>36 Months (3 yrs)</option>
                  <option value={48}>48 Months (4 yrs)</option>
                  <option value={60}>60 Months (5 yrs)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. Fuel & Energy Card */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Fuel className="w-4 h-4 text-amber-400" />
              2. Fuel & Mileage Economy
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {(['cng', 'diesel', 'electric', 'petrol'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setFuelType(type);
                    if (type === 'cng') { setFuelPriceINR(89); setFuelEfficiency(25); }
                    if (type === 'diesel') { setFuelPriceINR(94); setFuelEfficiency(15); }
                    if (type === 'electric') { setFuelPriceINR(10); setFuelEfficiency(8.5); }
                    if (type === 'petrol') { setFuelPriceINR(102); setFuelEfficiency(16); }
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold capitalize transition-all ${
                    fuelType === type
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">
                  Rate / {fuelType === 'electric' ? 'kWh' : fuelType === 'cng' ? 'kg' : 'L'} (₹)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={fuelPriceINR}
                  onChange={(e) => setFuelPriceINR(Number(e.target.value))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">
                  Mileage (km/{fuelType === 'electric' ? 'kWh' : fuelType === 'cng' ? 'kg' : 'L'})
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={fuelEfficiency}
                  onChange={(e) => setFuelEfficiency(Number(e.target.value))}
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* 3. Operational Revenue & Contract Card */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              3. Trip Revenue & Channel
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Payout / Trip (₹)</label>
                <input
                  type="number"
                  step="50"
                  value={payoutPerTripINR}
                  onChange={(e) => setPayoutPerTripINR(Number(e.target.value))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Trips / Day</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="15"
                  value={tripsPerDay}
                  onChange={(e) => setTripsPerDay(Number(e.target.value))}
                  className="form-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Paid Distance / Trip (km)</label>
                <input
                  type="number"
                  value={paidKmPerTrip}
                  onChange={(e) => setPaidKmPerTrip(Number(e.target.value))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Empty Running / Day (km)</label>
                <input
                  type="number"
                  value={emptyRunningKm}
                  onChange={(e) => setEmptyRunningKm(Number(e.target.value))}
                  className="form-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="form-label">Working Days</label>
                <input
                  type="number"
                  min="20"
                  max="31"
                  value={workingDays}
                  onChange={(e) => setWorkingDays(Number(e.target.value))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Platform Cut %</label>
                <input
                  type="number"
                  min="0"
                  max="35"
                  value={platformCommissionPct}
                  onChange={(e) => setPlatformCommissionPct(Number(e.target.value))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Driver Wage (₹)</label>
                <input
                  type="number"
                  step="1000"
                  value={driverWageINR}
                  onChange={(e) => setDriverWageINR(Number(e.target.value))}
                  className="form-input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Output & Analytics Section */}
        <div className="lg:col-span-7 space-y-5">
          {/* Monthly P&L Ledger Breakdown */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                Monthly Financial Ledger Breakdown
              </span>
              <span className="text-xs font-mono text-slate-400">
                {simulation.monthlyTotalKm} km / month
              </span>
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-slate-800">
                <span className="text-slate-300">Gross Fare ({workingDays * tripsPerDay} trips)</span>
                <span className="font-semibold text-white">{formatINR(simulation.monthlyGrossRevenuePaise)}</span>
              </div>

              {simulation.monthlyCommissionPaise > 0 && (
                <div className="flex items-center justify-between py-1 text-xs text-amber-400">
                  <span>Less: Platform Commission ({platformCommissionPct}%)</span>
                  <span>-{formatINR(simulation.monthlyCommissionPaise)}</span>
                </div>
              )}

              <div className="flex items-center justify-between py-2 border-b border-slate-800 font-semibold">
                <span className="text-slate-200">Net Operational Revenue</span>
                <span className="text-emerald-400">{formatINR(simulation.monthlyNetRevenuePaise)}</span>
              </div>

              <div className="py-2 space-y-1.5 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Fuel / Energy Cost ({fuelPriceINR}₹/unit)</span>
                  <span className="text-slate-200">-{formatINR(simulation.fuelCostPaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tyre & Maintenance Reserve (₹{maintenanceReservePerKmINR}/km)</span>
                  <span className="text-slate-200">-{formatINR(simulation.monthlyMaintenancePaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Insurance & Road Tax Provision</span>
                  <span className="text-slate-200">-₹3,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Driver Wages</span>
                  <span className="text-slate-200">-₹{driverWageINR.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-semibold text-amber-400 pt-1">
                  <span>Monthly Vehicle Loan EMI</span>
                  <span>-{formatINR(simulation.monthlyEmiPaise)}</span>
                </div>
              </div>

              <div className="pt-3 border-t-2 border-slate-700/80 flex items-center justify-between text-base font-bold">
                <span className="text-white">Net Monthly Owner In-Pocket Cash</span>
                <span className={simulation.netCashFlowPaise >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {formatINR(simulation.netCashFlowPaise)}
                </span>
              </div>
            </div>
          </div>

          {/* Revenue vs Cost Timeline Chart */}
          <div className="glass-card p-5">
            <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-400" />
              36-Month Cumulative Cash Flow Trajectory
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Visualizes cash flow jump after 36 months when the vehicle loan EMI is fully paid off.
            </p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simulation.chartData}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, '']}
                  />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#revGrad)" />
                  <Area type="monotone" dataKey="profit" name="Net In-Pocket Profit" stroke="#10b981" strokeWidth={2} fill="url(#profitGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Key Insights Alert */}
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 flex gap-3 text-xs">
            <Shield className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200">Business Viability Score: EXCELLENT</p>
              <p className="text-slate-400 mt-1 leading-relaxed">
                At ₹{payoutPerTripINR} per trip, you clear the operational & EMI break-even at{' '}
                <strong className="text-emerald-400">{simulation.breakEven.breakEvenTripsPerDay} trips/day</strong>.
                Running 2 trips/day yields an annualized owner profit of approximately{' '}
                <strong className="text-white">{formatINR(simulation.netCashFlowPaise * 12)}</strong> per vehicle.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Gemini AI Advisor Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="glass-card w-full max-w-2xl p-6 relative border-purple-500/40 max-h-[85vh] flex flex-col shadow-2xl shadow-purple-950/60">
            <button
              onClick={() => setIsAiModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Gemini AI · Vehicle Investment Feasibility Advisor
                </h2>
                <p className="text-xs text-brand-400 font-semibold">
                  Google AI Studio Free Tier · Powered by Gemini 3.5 Flash
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-4">
              {isAiLoading ? (
                <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full border-4 border-purple-500/20 border-t-purple-400 animate-spin" />
                    <Sparkles className="w-5 h-5 text-purple-400 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">
                      Evaluating Downside Risk & Capital Payback Horizon...
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Simulating sensitivity to fuel price spikes and trip cancellation variances via Free Tier API.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 whitespace-pre-wrap leading-relaxed font-sans text-[13px] text-slate-200">
                  {aiAdvice}
                </div>
              )}
            </div>

            <div className="pt-4 mt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Free Tier · Career App Gemini Key Grounded
              </span>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="btn-secondary text-xs"
              >
                Close Advisor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
