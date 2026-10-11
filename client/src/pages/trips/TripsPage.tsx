import React, { useState, useEffect } from 'react';
import {
  MapPin, Plus, Search, Filter, Calendar, IndianRupee,
  Navigation, CheckCircle2, Clock, X, ArrowUpRight, ShieldCheck
} from 'lucide-react';
import { apiGet, apiPost } from '../../services/api.js';
import { useAuthStore } from '../../store/auth.store.js';
import { formatINR } from '@fleetwise/shared';

interface TripItem {
  _id: string;
  vehicleRegistration: string;
  driverName: string;
  source: 'it_contract' | 'ola' | 'uber' | 'red_taxi' | 'private' | 'outstation' | 'other';
  date: string;
  startTime: string;
  startOdometer: number;
  endOdometer: number;
  totalKm: number;
  grossFare: number; // paise
  platformCommission: number; // paise
  tolls: number; // paise
  netEarnings: number; // paise
  paymentStatus: 'paid' | 'pending' | 'cancelled';
}

const mockTrips: TripItem[] = [
  {
    _id: 't1',
    vehicleRegistration: 'TN01BV4589',
    driverName: 'Karthik Raja',
    source: 'it_contract',
    date: '2026-10-11',
    startTime: '07:30',
    startOdometer: 42080,
    endOdometer: 42150,
    totalKm: 70,
    grossFare: 165000, // ₹1,650
    platformCommission: 0,
    tolls: 9500, // ₹95
    netEarnings: 155500,
    paymentStatus: 'paid',
  },
  {
    _id: 't2',
    vehicleRegistration: 'TN09CE2311',
    driverName: 'Senthil Kumar',
    source: 'uber',
    date: '2026-10-11',
    startTime: '08:45',
    startOdometer: 68350,
    endOdometer: 68400,
    totalKm: 50,
    grossFare: 112000, // ₹1,120
    platformCommission: 22400, // 20% commission
    tolls: 4500,
    netEarnings: 85100,
    paymentStatus: 'paid',
  },
  {
    _id: 't3',
    vehicleRegistration: 'TN02DF7812',
    driverName: 'Muthu Krishnan',
    source: 'ola',
    date: '2026-10-10',
    startTime: '14:15',
    startOdometer: 14120,
    endOdometer: 14200,
    totalKm: 80,
    grossFare: 184000, // ₹1,840
    platformCommission: 36800, // 20% commission
    tolls: 7000,
    netEarnings: 140200,
    paymentStatus: 'paid',
  },
  {
    _id: 't4',
    vehicleRegistration: 'TN10AK9944',
    driverName: 'Velmurugan',
    source: 'outstation',
    date: '2026-10-09',
    startTime: '06:00',
    startOdometer: 111650,
    endOdometer: 112000,
    totalKm: 350,
    grossFare: 520000, // ₹5,200
    platformCommission: 0,
    tolls: 38000,
    netEarnings: 482000,
    paymentStatus: 'paid',
  },
];

export default function TripsPage() {
  const { activeBusinessId } = useAuthStore();
  const [trips, setTrips] = useState<TripItem[]>(mockTrips);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [isLogTripOpen, setIsLogTripOpen] = useState(false);

  // New trip form state
  const [formData, setFormData] = useState({
    vehicleRegistration: 'TN01BV4589',
    driverName: 'Karthik Raja',
    source: 'it_contract' as TripItem['source'],
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    startOdometer: 42150,
    endOdometer: 42210,
    grossFareINR: 1500,
    platformCommissionINR: 0,
    tollsINR: 0,
  });

  const handleLogTrip = (e: React.FormEvent) => {
    e.preventDefault();
    const totalKm = Math.max(0, formData.endOdometer - formData.startOdometer);
    const grossFare = formData.grossFareINR * 100;
    const platformCommission = formData.platformCommissionINR * 100;
    const tolls = formData.tollsINR * 100;
    const netEarnings = grossFare - platformCommission - tolls;

    const newTrip: TripItem = {
      _id: 't_' + Date.now(),
      vehicleRegistration: formData.vehicleRegistration,
      driverName: formData.driverName,
      source: formData.source,
      date: formData.date,
      startTime: formData.startTime,
      startOdometer: formData.startOdometer,
      endOdometer: formData.endOdometer,
      totalKm,
      grossFare,
      platformCommission,
      tolls,
      netEarnings,
      paymentStatus: 'paid',
    };

    setTrips([newTrip, ...trips]);
    setIsLogTripOpen(false);
  };

  const filteredTrips = trips.filter((t) => {
    return sourceFilter === 'all' || t.source === sourceFilter;
  });

  const totalGross = filteredTrips.reduce((acc, t) => acc + t.grossFare, 0);
  const totalCommission = filteredTrips.reduce((acc, t) => acc + t.platformCommission, 0);
  const totalNet = filteredTrips.reduce((acc, t) => acc + t.netEarnings, 0);
  const totalKmRun = filteredTrips.reduce((acc, t) => acc + t.totalKm, 0);

  const getSourceBadge = (source: TripItem['source']) => {
    switch (source) {
      case 'it_contract':
        return <span className="badge badge-info">🏢 Corporate IT</span>;
      case 'ola':
        return <span className="badge bg-amber-950/60 text-amber-400 border border-amber-800/40">Ola Cabs</span>;
      case 'uber':
        return <span className="badge bg-slate-800 text-slate-200 border border-slate-700">Uber</span>;
      case 'outstation':
        return <span className="badge badge-success">Outstation Rental</span>;
      default:
        return <span className="badge bg-purple-950/60 text-purple-400 border border-purple-800/40">Private Trip</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <MapPin className="w-7 h-7 text-cyan-400" />
            Trip Management
          </h1>
          <p className="text-sm text-slate-400">
            Log journeys, audit odometer readings, track tolls, and calculate net earnings
          </p>
        </div>
        <button
          onClick={() => setIsLogTripOpen(true)}
          className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Log Journey
        </button>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 font-medium">Gross Fare</p>
          <p className="text-2xl font-bold text-white mt-1">{formatINR(totalGross)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 font-medium">Aggregator Cut</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">-{formatINR(totalCommission)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 font-medium">Net Take-Home</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatINR(totalNet)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 font-medium">Total Distance</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1">{totalKmRun} km</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1">
          {['all', 'it_contract', 'uber', 'ola', 'outstation'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSourceFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                sourceFilter === cat
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/50'
              }`}
            >
              {cat === 'all' ? 'All Channels' : cat.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Trips Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/60 text-xs text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-700/60">
              <tr>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Vehicle & Driver</th>
                <th className="py-3.5 px-4">Channel</th>
                <th className="py-3.5 px-4">Odometer</th>
                <th className="py-3.5 px-4">Distance</th>
                <th className="py-3.5 px-4 text-right">Gross Fare</th>
                <th className="py-3.5 px-4 text-right">Net Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredTrips.map((trip) => (
                <tr key={trip._id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-medium text-slate-200 block">{trip.date}</span>
                    <span className="text-xs text-slate-500">{trip.startTime}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-200 block">{trip.vehicleRegistration}</span>
                    <span className="text-xs text-slate-400">{trip.driverName}</span>
                  </td>
                  <td className="py-3 px-4">
                    {getSourceBadge(trip.source)}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-400">
                    {trip.startOdometer} → {trip.endOdometer}
                  </td>
                  <td className="py-3 px-4 font-semibold text-cyan-400">
                    {trip.totalKm} km
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-slate-300">
                    {formatINR(trip.grossFare)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-400">
                    {formatINR(trip.netEarnings)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Trip Modal */}
      {isLogTripOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card w-full max-w-lg p-6 relative border-slate-700 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsLogTripOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-cyan-400" />
              Log Journey Details
            </h2>
            <p className="text-xs text-slate-400 mb-5">Record trip revenue, tolls, and odometer continuity for payroll & tax.</p>

            <form onSubmit={handleLogTrip} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Vehicle Registration</label>
                  <input
                    type="text"
                    required
                    value={formData.vehicleRegistration}
                    onChange={(e) => setFormData({ ...formData, vehicleRegistration: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Driver In-Charge</label>
                  <input
                    type="text"
                    required
                    value={formData.driverName}
                    onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Trip Channel</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value as any })}
                    className="form-input"
                  >
                    <option value="it_contract">IT Contract</option>
                    <option value="uber">Uber</option>
                    <option value="ola">Ola</option>
                    <option value="outstation">Outstation</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Start Time</label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Start Odometer (km)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.startOdometer}
                    onChange={(e) => setFormData({ ...formData, startOdometer: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">End Odometer (km)</label>
                  <input
                    type="number"
                    min={formData.startOdometer}
                    required
                    value={formData.endOdometer}
                    onChange={(e) => setFormData({ ...formData, endOdometer: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Gross Fare (₹)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.grossFareINR}
                    onChange={(e) => setFormData({ ...formData, grossFareINR: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Platform Cut (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.platformCommissionINR}
                    onChange={(e) => setFormData({ ...formData, platformCommissionINR: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Toll Expenses (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.tollsINR}
                    onChange={(e) => setFormData({ ...formData, tollsINR: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Estimated Net Payout:</span>
                <span className="font-bold text-emerald-400 text-sm">
                  ₹{(formData.grossFareINR - formData.platformCommissionINR - formData.tollsINR).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLogTripOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Log Trip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
