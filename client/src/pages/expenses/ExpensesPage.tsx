import React, { useState } from 'react';
import {
  Fuel, Plus, IndianRupee, Wrench, Shield, AlertTriangle,
  Receipt, Filter, Calendar, X, Gauge, CheckCircle2
} from 'lucide-react';
import { formatINR } from '@fleetwise/shared';

interface ExpenseItem {
  _id: string;
  vehicleRegistration?: string;
  category: string;
  date: string;
  amount: number; // in paise
  vendor: string;
  paymentMethod: string;
}

interface FuelLogItem {
  _id: string;
  vehicleRegistration: string;
  date: string;
  odometer: number;
  fuelType: 'cng' | 'diesel' | 'petrol' | 'electric';
  quantity: number; // litres or kg
  ratePerUnit: number; // in paise
  totalAmount: number; // in paise
  mileageKmPerUnit?: number;
}

const mockExpenses: ExpenseItem[] = [
  {
    _id: 'e1',
    vehicleRegistration: 'TN01BV4589',
    category: 'scheduled_service',
    date: '2026-10-08',
    amount: 450000, // ₹4,500
    vendor: 'Maruti Authorized Service (TVS)',
    paymentMethod: 'upi',
  },
  {
    _id: 'e2',
    vehicleRegistration: 'TN09CE2311',
    category: 'tyre',
    date: '2026-10-05',
    amount: 1100000, // ₹11,000 (2 new tyres)
    vendor: 'MRF Tyre Zone',
    paymentMethod: 'card',
  },
  {
    _id: 'e3',
    vehicleRegistration: 'TN10AK9944',
    category: 'insurance',
    date: '2026-09-28',
    amount: 3200000, // ₹32,000 annual
    vendor: 'ICICI Lombard Commercial',
    paymentMethod: 'bank_transfer',
  },
  {
    _id: 'e4',
    category: 'driver_wages',
    date: '2026-10-01',
    amount: 2200000, // ₹22,000 monthly
    vendor: 'Karthik Raja (Driver)',
    paymentMethod: 'bank_transfer',
  },
];

const mockFuelLogs: FuelLogItem[] = [
  {
    _id: 'f1',
    vehicleRegistration: 'TN01BV4589',
    date: '2026-10-10',
    odometer: 42150,
    fuelType: 'cng',
    quantity: 8.5, // kg
    ratePerUnit: 8900, // ₹89 / kg
    totalAmount: 75650, // ₹756.50
    mileageKmPerUnit: 26.2,
  },
  {
    _id: 'f2',
    vehicleRegistration: 'TN09CE2311',
    date: '2026-10-09',
    odometer: 68350,
    fuelType: 'cng',
    quantity: 9.2,
    ratePerUnit: 8900,
    totalAmount: 81880,
    mileageKmPerUnit: 24.8,
  },
  {
    _id: 'f3',
    vehicleRegistration: 'TN10AK9944',
    date: '2026-10-08',
    odometer: 111800,
    fuelType: 'diesel',
    quantity: 42.0,
    ratePerUnit: 9400, // ₹94 / litre
    totalAmount: 394800, // ₹3,948
    mileageKmPerUnit: 14.5,
  },
];

export default function ExpensesPage() {
  const [activeTab, setActiveTab] = useState<'expenses' | 'fuel'>('expenses');
  const [expenses, setExpenses] = useState<ExpenseItem[]>(mockExpenses);
  const [fuelLogs, setFuelLogs] = useState<FuelLogItem[]>(mockFuelLogs);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);

  // New Expense form
  const [expenseForm, setExpenseForm] = useState({
    vehicleRegistration: 'TN01BV4589',
    category: 'scheduled_service',
    amountINR: 1500,
    vendor: '',
    paymentMethod: 'upi',
    date: new Date().toISOString().split('T')[0],
    tyreBrand: 'MRF ZVTS',
    tyreCount: 2,
    tyreOdometer: 42500,
  });

  // New Fuel form with Diesel AdBlue DEF
  const [fuelForm, setFuelForm] = useState({
    vehicleRegistration: 'TN01BV4589',
    fuelType: 'cng' as 'cng' | 'diesel' | 'petrol' | 'electric',
    odometer: 42250,
    quantity: 8.0,
    rateINR: 89,
    date: new Date().toISOString().split('T')[0],
    adBlueLitres: 0,
    adBlueRateINR: 75,
  });

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const vendorNote = expenseForm.category === 'tyre' 
      ? `${expenseForm.vendor || 'Tyre Centre'} (${expenseForm.tyreCount}x ${expenseForm.tyreBrand} @ ${expenseForm.tyreOdometer} km)`
      : expenseForm.vendor || 'General Vendor';
    const newExp: ExpenseItem = {
      _id: 'e_' + Date.now(),
      vehicleRegistration: expenseForm.vehicleRegistration,
      category: expenseForm.category,
      amount: expenseForm.amountINR * 100,
      vendor: vendorNote,
      paymentMethod: expenseForm.paymentMethod,
      date: expenseForm.date,
    };
    setExpenses([newExp, ...expenses]);
    setIsExpenseModalOpen(false);
  };

  const handleAddFuel = (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmount = Math.round(fuelForm.quantity * fuelForm.rateINR * 100);
    const newFuel: FuelLogItem = {
      _id: 'f_' + Date.now(),
      vehicleRegistration: fuelForm.vehicleRegistration,
      date: fuelForm.date,
      odometer: fuelForm.odometer,
      fuelType: fuelForm.fuelType,
      quantity: fuelForm.quantity,
      ratePerUnit: fuelForm.rateINR * 100,
      totalAmount,
      mileageKmPerUnit: 25.5,
    };
    setFuelLogs([newFuel, ...fuelLogs]);
    setIsFuelModalOpen(false);
  };

  const totalExpensePaise = expenses.reduce((acc, e) => acc + e.amount, 0);
  const totalFuelPaise = fuelLogs.reduce((acc, f) => acc + f.totalAmount, 0);

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'scheduled_service':
        return 'Periodic Service';
      case 'tyre':
        return 'Tyre Replacement';
      case 'insurance':
        return 'Insurance & Tax';
      case 'driver_wages':
        return 'Driver Wage';
      case 'fuel':
        return 'Fuel Refill';
      default:
        return category.replace('_', ' ');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Fuel className="w-7 h-7 text-amber-400" />
            Expenses & Fuel Log
          </h1>
          <p className="text-sm text-slate-400">
            Audit operational overheads, diesel/CNG efficiency, periodic maintenance, and spare costs
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'expenses' ? (
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Expense
            </button>
          ) : (
            <button
              onClick={() => setIsFuelModalOpen(true)}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Log Fuel Refill
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === 'expenses'
              ? 'text-brand-400 border-b-2 border-brand-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Operating Expenses ({formatINR(totalExpensePaise)})
        </button>
        <button
          onClick={() => setActiveTab('fuel')}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === 'fuel'
              ? 'text-amber-400 border-b-2 border-amber-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Fuel & Energy Logs ({formatINR(totalFuelPaise)})
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 font-medium">Total Operating Costs</p>
          <p className="text-2xl font-bold text-white mt-1">
            {formatINR(totalExpensePaise + totalFuelPaise)}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 font-medium">Monthly Fuel Spend</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{formatINR(totalFuelPaise)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 font-medium">Maintenance & Spares</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1">
            {formatINR(expenses.filter((e) => e.category === 'scheduled_service' || e.category === 'tyre').reduce((acc, e) => acc + e.amount, 0))}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 font-medium">Avg Fleet Mileage</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">21.8 km/kg</p>
        </div>
      </div>

      {/* Content based on Active Tab */}
      {activeTab === 'expenses' ? (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/60 text-xs text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-700/60">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Vehicle</th>
                  <th className="py-3.5 px-4">Vendor / Payee</th>
                  <th className="py-3.5 px-4">Mode</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {expenses.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-300 font-medium">{item.date}</td>
                    <td className="py-3 px-4">
                      <span className="badge bg-slate-800 text-slate-200 border border-slate-700 capitalize">
                        {getCategoryLabel(item.category)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-200 font-semibold">
                      {item.vehicleRegistration || 'Fleet Overhead'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">{item.vendor}</td>
                    <td className="py-3 px-4 uppercase text-xs text-slate-500 font-mono">
                      {item.paymentMethod}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-400">
                      {formatINR(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/60 text-xs text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-700/60">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Vehicle</th>
                  <th className="py-3.5 px-4">Odometer</th>
                  <th className="py-3.5 px-4">Quantity</th>
                  <th className="py-3.5 px-4">Unit Rate</th>
                  <th className="py-3.5 px-4">Economy</th>
                  <th className="py-3.5 px-4 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {fuelLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-300 font-medium">{log.date}</td>
                    <td className="py-3 px-4 text-slate-200 font-semibold">{log.vehicleRegistration}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-400">{log.odometer} km</td>
                    <td className="py-3 px-4 text-slate-300 font-semibold">
                      {log.quantity} {log.fuelType === 'cng' ? 'kg' : 'L'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      {formatINR(log.ratePerUnit)}
                    </td>
                    <td className="py-3 px-4 text-emerald-400 font-semibold text-xs">
                      {log.mileageKmPerUnit ? `${log.mileageKmPerUnit} km/unit` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-400">
                      {formatINR(log.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card w-full max-w-lg p-6 relative border-slate-700 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsExpenseModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-400" />
              Add Operating Expense
            </h2>
            <p className="text-xs text-slate-400 mb-5">Record repairs, insurance premiums, spare parts, or permits.</p>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Category</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="form-input"
                  >
                    <option value="scheduled_service">Periodic Service</option>
                    <option value="tyre">Tyre / Wheel</option>
                    <option value="insurance">Insurance & Tax</option>
                    <option value="unexpected_repair">Breakdown Repair</option>
                    <option value="driver_wages">Driver Wage</option>
                    <option value="other">Other Overhead</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Vehicle Registration</label>
                  <input
                    type="text"
                    value={expenseForm.vehicleRegistration}
                    onChange={(e) => setExpenseForm({ ...expenseForm, vehicleRegistration: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={expenseForm.amountINR}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amountINR: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    required
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              {expenseForm.category === 'tyre' && (
                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 space-y-3 animate-fade-in">
                  <div className="text-xs font-semibold text-slate-300">Tyre Replacement Details</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="form-label text-[11px]">Tyre Brand</label>
                      <select
                        value={expenseForm.tyreBrand}
                        onChange={(e) => setExpenseForm({ ...expenseForm, tyreBrand: e.target.value })}
                        className="form-input text-xs"
                      >
                        <option value="MRF ZVTS">MRF ZVTS</option>
                        <option value="Apollo Amazer">Apollo Amazer</option>
                        <option value="CEAT FuelSmarrt">CEAT FuelSmarrt</option>
                        <option value="JK Tyre Vectra">JK Tyre Vectra</option>
                        <option value="Bridgestone B290">Bridgestone B290</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label text-[11px]">Tyre Count</label>
                      <select
                        value={expenseForm.tyreCount}
                        onChange={(e) => setExpenseForm({ ...expenseForm, tyreCount: Number(e.target.value) })}
                        className="form-input text-xs"
                      >
                        <option value="1">1 Tyre</option>
                        <option value="2">2 Tyres (Front / Rear Pair)</option>
                        <option value="4">4 Tyres (Full Set)</option>
                        <option value="5">5 Tyres (With Spare)</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label text-[11px]">Odometer (km)</label>
                      <input
                        type="number"
                        value={expenseForm.tyreOdometer}
                        onChange={(e) => setExpenseForm({ ...expenseForm, tyreOdometer: Number(e.target.value) })}
                        className="form-input text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="form-label">Vendor / Workshop Name</label>
                <input
                  type="text"
                  placeholder="e.g. Bosch Car Service"
                  value={expenseForm.vendor}
                  onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Fuel Modal */}
      {isFuelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card w-full max-w-lg p-6 relative border-slate-700 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsFuelModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Fuel className="w-5 h-5 text-amber-400" />
              Log Fuel Refill
            </h2>
            <p className="text-xs text-slate-400 mb-5">Track fuel consumption and calculate real-world mileage.</p>

            <form onSubmit={handleAddFuel} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Vehicle Registration</label>
                  <input
                    type="text"
                    required
                    value={fuelForm.vehicleRegistration}
                    onChange={(e) => setFuelForm({ ...fuelForm, vehicleRegistration: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Fuel Type</label>
                  <select
                    value={fuelForm.fuelType}
                    onChange={(e) => setFuelForm({ ...fuelForm, fuelType: e.target.value as any })}
                    className="form-input"
                  >
                    <option value="cng">CNG (kg)</option>
                    <option value="diesel">Diesel (Litres)</option>
                    <option value="petrol">Petrol (Litres)</option>
                    <option value="electric">Electric (kWh)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Odometer (km)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={fuelForm.odometer}
                    onChange={(e) => setFuelForm({ ...fuelForm, odometer: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Quantity (L/kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={fuelForm.quantity}
                    onChange={(e) => setFuelForm({ ...fuelForm, quantity: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Rate / Unit (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    value={fuelForm.rateINR}
                    onChange={(e) => setFuelForm({ ...fuelForm, rateINR: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
              </div>

              {fuelForm.fuelType === 'diesel' && (
                <div className="p-3 bg-blue-950/20 border border-blue-500/30 rounded-xl space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-blue-300">Diesel Exhaust Fluid (AdBlue) Top-up</span>
                    <span className="text-[10px] text-slate-400">Optional BS6 DEF</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="form-label text-[11px]">AdBlue Litres</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={fuelForm.adBlueLitres}
                        onChange={(e) => setFuelForm({ ...fuelForm, adBlueLitres: Number(e.target.value) })}
                        className="form-input text-xs"
                        placeholder="e.g. 5.0"
                      />
                    </div>
                    <div>
                      <label className="form-label text-[11px]">AdBlue Rate (₹/L)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={fuelForm.adBlueRateINR}
                        onChange={(e) => setFuelForm({ ...fuelForm, adBlueRateINR: Number(e.target.value) })}
                        className="form-input text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 bg-slate-800/60 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Total Refill Amount:</span>
                <span className="font-bold text-amber-400 text-sm">
                  ₹{(fuelForm.quantity * fuelForm.rateINR + fuelForm.adBlueLitres * fuelForm.adBlueRateINR).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFuelModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Refill Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
