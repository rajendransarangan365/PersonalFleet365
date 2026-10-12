import React, { useState, useEffect } from 'react';
import {
  Car, User, Phone, MessageSquare, Shield, Clock,
  CheckCircle2, AlertTriangle, AlertCircle, RefreshCw,
  Search, Filter, ExternalLink, KeyRound, Headphones,
  Check, X, ChevronRight, UserCheck, Radio, Sparkles
} from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../../services/api.js';
import { getSocket, subscribeToOnlineUsers, type OnlineUserPresence } from '../../services/socket.client.js';
import InAppCallModal from '../../components/InAppCallModal.js';
import InAppChatModal from '../../components/InAppChatModal.js';
import type { FleetContact } from '../../store/contacts.store.js';
import { useAuthStore } from '../../store/auth.store.js';

interface TaxiBooking {
  _id?: string;
  id?: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  pickupLocation: string;
  dropoffLocation: string;
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
  createdAt: string;
}

const AVAILABLE_DRIVERS = [
  { id: 'drv-01', name: 'Karthik Raja', phone: '+91 98401 23456', vehiclePlate: 'TN01BV4589', model: 'Tour S CNG' },
  { id: 'drv-02', name: 'Suresh Kumar', phone: '+91 98402 34567', vehiclePlate: 'TN09CE2311', model: 'Aura CNG' },
  { id: 'drv-03', name: 'Vijay Anand', phone: '+91 98403 45678', vehiclePlate: 'TN02DF7812', model: 'Tigor EV Green' },
  { id: 'drv-04', name: 'Ramesh Babu', phone: '+91 98404 56789', vehiclePlate: 'TN10AK9944', model: 'Innova Crysta' },
];

export default function TaxiBookingsPage() {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<TaxiBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'issues' | 'completed'>('all');

  // Modals for Call and Chat
  const [activeCallContact, setActiveCallContact] = useState<FleetContact | null>(null);
  const [activeChatContact, setActiveChatContact] = useState<FleetContact | null>(null);

  // Assign Driver Modal
  const [assignModalBooking, setAssignModalBooking] = useState<TaxiBooking | null>(null);

  // Resolve Issue Modal
  const [resolveModalBooking, setResolveModalBooking] = useState<TaxiBooking | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  // Online drivers from socket
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserPresence[]>([]);

  useEffect(() => {
    void loadBookings();

    const unsubscribe = subscribeToOnlineUsers((users) => {
      setOnlineUsers(users);
    });

    const socket = getSocket();

    const handleBookingBroadcast = (booking: TaxiBooking) => {
      setBookings((prev) => {
        const idx = prev.findIndex((b) => b.bookingId === booking.bookingId || b._id === booking._id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...booking };
          return next;
        }
        return [booking, ...prev];
      });
    };

    socket.on('booking:broadcast', handleBookingBroadcast);
    socket.on('booking:updated', handleBookingBroadcast);
    socket.on('support:urgent_alert', (alert: any) => {
      void loadBookings();
    });

    return () => {
      unsubscribe();
      socket.off('booking:broadcast', handleBookingBroadcast);
      socket.off('booking:updated', handleBookingBroadcast);
    };
  }, []);

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const res = await apiGet<{ data: TaxiBooking[] } | TaxiBooking[]>('/app/bookings');
      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      setBookings(list);
    } catch (err) {
      console.error('Error loading bookings', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignDriver = async (driver: typeof AVAILABLE_DRIVERS[0]) => {
    if (!assignModalBooking) return;
    try {
      const updated = await apiPatch<TaxiBooking>(`/app/bookings/${assignModalBooking.bookingId || assignModalBooking._id}/assign`, {
        assignedDriverId: driver.id,
        assignedDriverName: driver.name,
        assignedDriverPhone: driver.phone,
        vehiclePlate: driver.vehiclePlate,
      });

      setBookings((prev) => prev.map((b) => (b.bookingId === assignModalBooking.bookingId ? updated : b)));
      setAssignModalBooking(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveIssue = async () => {
    if (!resolveModalBooking) return;
    setIsResolving(true);
    try {
      const updated = await apiPatch<TaxiBooking>(`/app/bookings/${resolveModalBooking.bookingId || resolveModalBooking._id}/resolve-issue`, {
        resolutionNotes: resolutionNotes || 'Resolved by Fleet Support Team.',
      });

      setBookings((prev) => prev.map((b) => (b.bookingId === resolveModalBooking.bookingId ? updated : b)));
      setResolveModalBooking(null);
      setResolutionNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsResolving(false);
    }
  };

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.bookingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customerPhone.includes(searchTerm) ||
      (b.assignedDriverName && b.assignedDriverName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.vehiclePlate && b.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'active') {
      return ['driver_assigned', 'driver_arrived', 'in_progress'].includes(b.status);
    }
    if (statusFilter === 'pending') {
      return b.status === 'pending';
    }
    if (statusFilter === 'issues') {
      return b.supportStatus === 'support_needed' || b.issueReported;
    }
    if (statusFilter === 'completed') {
      return b.status === 'completed';
    }
    return true;
  });

  const activeRidesCount = bookings.filter((b) => ['driver_assigned', 'driver_arrived', 'in_progress'].includes(b.status)).length;
  const pendingCount = bookings.filter((b) => b.status === 'pending').length;
  const issuesCount = bookings.filter((b) => b.supportStatus === 'support_needed' || b.issueReported).length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="glass-card p-5 border-slate-700/80 bg-gradient-to-r from-slate-900 via-slate-900 to-brand-950/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Commercial Dispatch & Customer Support Control Room</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span>Taxi Bookings & Dispatch Center</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              Ola / Uber Architecture
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-role visibility for <b>Fleet Owner</b>, <b>Manager</b>, and <b>24x7 Call Center Helpline Support Desk</b>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadBookings()}
            className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-2 text-slate-300 hover:text-white"
            title="Refresh Live Bookings"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Refresh</span>
          </button>

          <a
            href="/customer"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/30 flex items-center gap-1.5 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Customer Booking View</span>
          </a>
        </div>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => setStatusFilter('all')}
          className={`glass-card p-4 border cursor-pointer transition-all ${
            statusFilter === 'all' ? 'border-brand-500 bg-brand-500/10' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-xs text-slate-400 block mb-1">Total Bookings</span>
          <span className="text-2xl font-black text-white font-mono">{bookings.length}</span>
        </div>

        <div
          onClick={() => setStatusFilter('active')}
          className={`glass-card p-4 border cursor-pointer transition-all ${
            statusFilter === 'active' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Active Rides</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <span className="text-2xl font-black text-emerald-400 font-mono">{activeRidesCount}</span>
        </div>

        <div
          onClick={() => setStatusFilter('pending')}
          className={`glass-card p-4 border cursor-pointer transition-all ${
            statusFilter === 'pending' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-xs text-slate-400 block mb-1">Pending Dispatch</span>
          <span className="text-2xl font-black text-amber-400 font-mono">{pendingCount}</span>
        </div>

        <div
          onClick={() => setStatusFilter('issues')}
          className={`glass-card p-4 border cursor-pointer transition-all ${
            issuesCount > 0 ? 'border-rose-500 bg-rose-500/10 animate-pulse' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-rose-300 font-bold">Support Escalations</span>
            {issuesCount > 0 && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
          </div>
          <span className="text-2xl font-black text-rose-400 font-mono">{issuesCount}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search booking #, customer, phone, driver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar text-xs">
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active Rides' },
            { id: 'pending', label: 'Pending Dispatch' },
            { id: 'issues', label: `Disputes (${issuesCount})`, highlight: issuesCount > 0 },
            { id: 'completed', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-brand-500 text-white shadow-sm'
                  : tab.highlight
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-cyan-400" />
            <p className="text-xs">Connecting to central dispatch database...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="glass-card p-12 text-center text-slate-400 space-y-2">
            <Car className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-white">No taxi bookings found</p>
            <p className="text-xs text-slate-500">Try adjusting your search criteria or create a ride from the customer portal.</p>
          </div>
        ) : (
          filteredBookings.map((b) => {
            const hasIssue = b.supportStatus === 'support_needed' || b.issueReported;

            return (
              <div
                key={b.bookingId || b._id}
                className={`glass-card p-4 sm:p-5 border transition-all space-y-4 ${
                  hasIssue
                    ? 'border-rose-500/60 bg-rose-950/15 shadow-lg shadow-rose-950/20'
                    : b.status === 'in_progress'
                    ? 'border-emerald-500/40 bg-emerald-950/10'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-black text-white">#{b.bookingId}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                      {b.cabTierName}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status Badge */}
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      b.status === 'in_progress'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
                        : b.status === 'driver_assigned'
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                        : b.status === 'driver_arrived'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                        : b.status === 'completed'
                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}>
                      {b.status.replace('_', ' ')}
                    </span>

                    {/* Support Issue Flag */}
                    {hasIssue && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Support Dispute Escalated</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Dispute Alert Bar if customer reported a problem */}
                {hasIssue && (
                  <div className="bg-rose-500/20 border border-rose-500/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-rose-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-bold text-white block">Customer Problem Reported:</span>
                        <p className="text-[11px] text-rose-200 mt-0.5">{b.issueDetails || 'Dispute escalated to support desk.'}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => setResolveModalBooking(b)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-md transition-all flex-shrink-0"
                    >
                      Resolve Dispute
                    </button>
                  </div>
                )}

                {/* Main 3 Columns: Route, Passenger, Driver */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Column 1: Route & Fare */}
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Pickup</span>
                        <span className="text-white font-medium">{b.pickupLocation}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400 mt-1 flex-shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Dropoff</span>
                        <span className="text-white font-medium">{b.dropoffLocation}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                      <span className="text-slate-400">{b.estimatedDistanceKm} km</span>
                      <span className="font-extrabold text-emerald-400 text-sm font-mono">₹{b.estimatedFare}</span>
                      <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        OTP: {b.otp}
                      </span>
                    </div>
                  </div>

                  {/* Column 2: Passenger Details with 1-Click Call & Chat */}
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2.5">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Passenger Info</span>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-cyan-600/20 text-cyan-300 font-bold flex items-center justify-center text-sm">
                        {b.customerName[0]}
                      </div>
                      <div>
                        <span className="font-bold text-white block">{b.customerName}</span>
                        <span className="text-slate-400 font-mono text-[11px]">{b.customerPhone}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                      <button
                        onClick={() => {
                          setActiveCallContact({
                            id: b.customerId,
                            name: b.customerName,
                            role: 'customer' as any,
                            phone: b.customerPhone,
                            status: 'online',
                          });
                        }}
                        className="flex-1 py-1.5 px-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                        title="Call Customer via VoIP"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call Customer</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveChatContact({
                            id: b.customerId,
                            name: b.customerName,
                            role: 'customer' as any,
                            phone: b.customerPhone,
                            status: 'online',
                          });
                        }}
                        className="flex-1 py-1.5 px-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                        title="Chat Customer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat Customer</span>
                      </button>
                    </div>
                  </div>

                  {/* Column 3: Assigned Driver with 1-Click Call & Chat / Reassign */}
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Assigned Fleet Driver</span>
                      <button
                        onClick={() => setAssignModalBooking(b)}
                        className="text-[10px] text-cyan-400 hover:underline font-bold"
                      >
                        {b.assignedDriverName ? 'Change Driver' : 'Assign Driver'}
                      </button>
                    </div>

                    {b.assignedDriverName ? (
                      <>
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-brand-600/20 text-brand-300 font-bold flex items-center justify-center text-sm">
                            {b.assignedDriverName[0]}
                          </div>
                          <div>
                            <span className="font-bold text-white block">{b.assignedDriverName}</span>
                            <span className="text-brand-300 font-mono text-[11px]">{b.vehiclePlate}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                          <button
                            onClick={() => {
                              setActiveCallContact({
                                id: b.assignedDriverId || 'drv-01',
                                name: b.assignedDriverName || 'Driver',
                                role: 'driver' as any,
                                phone: b.assignedDriverPhone || '+91 98401 23456',
                                vehiclePlate: b.vehiclePlate,
                                status: 'online',
                              });
                            }}
                            className="flex-1 py-1.5 px-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                            title="Call Driver via VoIP"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call Driver</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveChatContact({
                                id: b.assignedDriverId || 'drv-01',
                                name: b.assignedDriverName || 'Driver',
                                role: 'driver' as any,
                                phone: b.assignedDriverPhone || '+91 98401 23456',
                                vehiclePlate: b.vehiclePlate,
                                status: 'online',
                              });
                            }}
                            className="flex-1 py-1.5 px-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                            title="Chat Driver"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat Driver</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="py-2 text-center">
                        <button
                          onClick={() => setAssignModalBooking(b)}
                          className="w-full py-2 bg-brand-600/80 hover:bg-brand-600 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Dispatch / Assign Driver</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Assign Driver Modal */}
      {assignModalBooking && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Assign Driver to #{assignModalBooking.bookingId}
                </h3>
              </div>
              <button
                onClick={() => setAssignModalBooking(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Select verified commercial taxi driver for pickup at <b>{assignModalBooking.pickupLocation}</b>:
            </p>

            <div className="space-y-2">
              {AVAILABLE_DRIVERS.map((d) => (
                <div
                  key={d.id}
                  onClick={() => handleAssignDriver(d)}
                  className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 hover:border-brand-500 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                      {d.name[0]}
                    </div>
                    <div>
                      <span className="font-bold text-white block">{d.name}</span>
                      <span className="text-slate-400 font-mono text-[11px]">{d.vehiclePlate} ({d.model})</span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-[11px]">
                    Assign
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Resolve Issue Modal */}
      {resolveModalBooking && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Resolve Dispute for #{resolveModalBooking.bookingId}
                </h3>
              </div>
              <button
                onClick={() => setResolveModalBooking(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl text-xs space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Customer Complaint</span>
              <p className="text-white font-medium">{resolveModalBooking.issueDetails}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Resolution Actions & Notes (telecaller resolution log):
              </label>
              <textarea
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="e.g. Telecaller contacted passenger and driver. Route verified, fare adjusted and customer satisfied."
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setResolveModalBooking(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveIssue}
                disabled={isResolving}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30"
              >
                Mark Dispute Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App VoIP Call Modal */}
      {activeCallContact && (
        <InAppCallModal
          isOpen={Boolean(activeCallContact)}
          onClose={() => setActiveCallContact(null)}
          targetContact={activeCallContact}
          callerName={activeCallContact.name}
          callerRole={activeCallContact.role}
          targetPhone={activeCallContact.phone}
          vehiclePlate={activeCallContact.vehiclePlate}
        />
      )}

      {/* In-App Live Chat Modal */}
      {activeChatContact && (
        <InAppChatModal
          isOpen={Boolean(activeChatContact)}
          onClose={() => setActiveChatContact(null)}
          contact={activeChatContact}
          onStartCall={(c) => setActiveCallContact(c)}
        />
      )}
    </div>
  );
}
