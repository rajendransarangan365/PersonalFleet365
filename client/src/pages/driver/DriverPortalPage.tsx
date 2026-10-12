import React, { useState, useEffect } from 'react';
import {
  Car, UserCheck, Phone, MessageSquare, Shield,
  Navigation, CheckCircle2, Clock, AlertTriangle,
  ChevronRight, Calendar, Fuel, Droplet, ArrowRight,
  ExternalLink, Sparkles, MapPin, Power, Check, Radio,
  KeyRound, DollarSign, User, AlertCircle
} from 'lucide-react';
import GpsTripTracker from '../../components/GpsTripTracker.js';
import VehiclePhotoGalleryModal from '../../components/VehiclePhotoGalleryModal.js';
import InAppChatModal from '../../components/InAppChatModal.js';
import InAppCallModal from '../../components/InAppCallModal.js';
import { useAuthStore } from '../../store/auth.store.js';
import { apiGet, apiPatch, apiPost } from '../../services/api.js';
import { getSocket, registerCurrentUser } from '../../services/socket.client.js';
import type { FleetContact } from '../../store/contacts.store.js';

interface AssignedVehicleData {
  _id: string;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  fuelType: 'cng' | 'diesel' | 'electric' | 'petrol';
  seatingCapacity: number;
  currentOdometer: number;
  mileageConfig?: {
    claimedMileage: number;
    expectedMileage: number;
    adBlueRequired?: boolean;
    adBlueLitersPer1000Km?: number;
    unit: string;
  };
  photos?: {
    front?: { url: string };
    back?: { url: string };
    left?: { url: string };
    right?: { url: string };
  };
}

interface TaxiBooking {
  _id?: string;
  id?: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
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
  vehiclePlate?: string;
  supportStatus?: string;
  createdAt: string;
}

export default function DriverPortalPage() {
  const { user } = useAuthStore();
  const driverId = (user as any)?.id || (user as any)?._id || 'drv-01';
  const driverName = user?.displayName || 'Karthik Raja';

  const [vehicle, setVehicle] = useState<AssignedVehicleData>({
    _id: 'v_assigned_demo',
    registrationNumber: 'TN01BV4589',
    make: 'Maruti Suzuki',
    model: 'Dzire Tour S (CNG)',
    year: 2023,
    fuelType: 'cng',
    seatingCapacity: 4,
    currentOdometer: 42150,
    mileageConfig: {
      claimedMileage: 31.12,
      expectedMileage: 26.5,
      adBlueRequired: false,
      unit: 'km/kg',
    },
    photos: {
      front: { url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80' },
      back: { url: 'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=600&q=80' },
    },
  });

  // Duty Status (Online / Offline)
  const [dutyStatus, setDutyStatus] = useState<'online' | 'offline'>('online');
  const [isUpdatingDuty, setIsUpdatingDuty] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  // Active bookings list
  const [bookings, setBookings] = useState<TaxiBooking[]>([]);
  const [selectedOtpBooking, setSelectedOtpBooking] = useState<TaxiBooking | null>(null);
  const [inputOtp, setInputOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  const [activeTask, setActiveTask] = useState<'pick_and_drop' | 'outstation'>('pick_and_drop');
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [activeCallContact, setActiveCallContact] = useState<FleetContact | null>(null);
  const [activeChatContact, setActiveChatContact] = useState<FleetContact | null>(null);
  const [completedTripStats, setCompletedTripStats] = useState<any>(null);

  // Register with socket on mount
  useEffect(() => {
    registerCurrentUser();
    loadBookings();

    const socket = getSocket();

    const handleBookingUpdate = (updated: any) => {
      setBookings((prev) => {
        const idx = prev.findIndex((b) => b.bookingId === updated.bookingId || b._id === updated._id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...updated };
          return next;
        }
        return [updated, ...prev];
      });
    };

    socket.on('booking:broadcast', handleBookingUpdate);
    socket.on('booking:updated', handleBookingUpdate);

    return () => {
      socket.off('booking:broadcast', handleBookingUpdate);
      socket.off('booking:updated', handleBookingUpdate);
    };
  }, []);

  const loadBookings = async () => {
    try {
      const res = await apiGet<{ data: TaxiBooking[] } | TaxiBooking[]>('/app/bookings');
      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      setBookings(list);
    } catch {}
  };

  // Toggle Driver Online / Offline Duty
  const handleToggleDuty = async () => {
    const nextStatus = dutyStatus === 'online' ? 'offline' : 'online';
    setIsUpdatingDuty(true);
    setOfflineNotice(null);

    try {
      await apiPost('/app/drivers/status', {
        driverId,
        driverName,
        phone: '+91 98401 23456',
        vehiclePlate: vehicle.registrationNumber,
        status: nextStatus,
      });

      const socket = getSocket();
      socket.emit('driver:set_status', {
        driverId,
        driverName,
        status: nextStatus,
        vehiclePlate: vehicle.registrationNumber,
      });

      setDutyStatus(nextStatus);

      if (nextStatus === 'offline') {
        setOfflineNotice(`You are now OFFLINE. The company Fleet Owner has been intimating about your offline status.`);
      }
    } catch (err) {
      console.error('Error toggling duty status', err);
    } finally {
      setIsUpdatingDuty(false);
    }
  };

  // Accept a booking
  const handleAcceptBooking = async (booking: TaxiBooking) => {
    try {
      const updated = await apiPatch<TaxiBooking>(`/app/bookings/${booking.bookingId || booking._id}/assign`, {
        assignedDriverId: driverId,
        assignedDriverName: driverName,
        assignedDriverPhone: '+91 98401 23456',
        vehiclePlate: vehicle.registrationNumber,
      });

      setBookings((prev) => prev.map((b) => (b.bookingId === booking.bookingId ? updated : b)));
    } catch (err) {
      console.error('Error accepting booking', err);
    }
  };

  // Update ride status (arrived / completed)
  const handleUpdateStatus = async (booking: TaxiBooking, newStatus: string) => {
    try {
      const updated = await apiPatch<TaxiBooking>(`/app/bookings/${booking.bookingId || booking._id}/status`, {
        status: newStatus,
      });

      setBookings((prev) => prev.map((b) => (b.bookingId === booking.bookingId ? updated : b)));
    } catch (err) {
      console.error('Error updating booking status', err);
    }
  };

  // Start ride with customer OTP verification
  const handleVerifyOtpAndStart = async () => {
    if (!selectedOtpBooking) return;
    setOtpError(null);

    if (inputOtp.trim() !== selectedOtpBooking.otp) {
      setOtpError(`Incorrect OTP! Ask passenger for the 4-digit Ride OTP displayed on their screen.`);
      return;
    }

    try {
      const updated = await apiPatch<TaxiBooking>(`/app/bookings/${selectedOtpBooking.bookingId || selectedOtpBooking._id}/status`, {
        status: 'in_progress',
        otp: inputOtp.trim(),
      });

      setBookings((prev) => prev.map((b) => (b.bookingId === selectedOtpBooking.bookingId ? updated : b)));
      setSelectedOtpBooking(null);
      setInputOtp('');
    } catch (err: any) {
      setOtpError(err.message || 'Failed to verify OTP');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Driver Welcome Banner & Duty Toggle */}
      <div className="glass-card p-5 border-slate-700/80 bg-gradient-to-r from-slate-900 via-slate-900 to-brand-950/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg transition-all ${
            dutyStatus === 'online'
              ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-emerald-500/20'
              : 'bg-gradient-to-br from-slate-600 to-slate-700'
          }`}>
            {driverName[0]?.toUpperCase() ?? 'D'}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-white">Driver Console</h1>
              {dutyStatus === 'online' ? (
                <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active on Duty (Online)
                </span>
              ) : (
                <span className="bg-rose-500/20 text-rose-400 text-xs px-2.5 py-0.5 rounded-full border border-rose-500/30 flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Off Duty (Offline)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Welcome, <span className="text-slate-200 font-semibold">{driverName}</span> | Vehicle: <span className="text-brand-300 font-mono font-bold">{vehicle.registrationNumber}</span>
            </p>
          </div>
        </div>

        {/* Duty Toggle Button & Quick Support */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Duty Switch Button */}
          <button
            onClick={handleToggleDuty}
            disabled={isUpdatingDuty}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 ${
              dutyStatus === 'online'
                ? 'bg-rose-600/90 hover:bg-rose-600 text-white shadow-rose-600/30 border border-rose-500'
                : 'bg-emerald-600/90 hover:bg-emerald-600 text-white shadow-emerald-600/30 border border-emerald-500'
            }`}
            title="Toggle Duty Status (Online / Offline)"
          >
            <Power className="w-4 h-4" />
            <span>{dutyStatus === 'online' ? 'Go Offline (Off Duty)' : 'Go Online (Start Duty)'}</span>
          </button>

          <button
            onClick={() => {
              setActiveCallContact({
                id: 'owner-01',
                name: 'Sarangan (Fleet Owner)',
                role: 'manager' as any,
                phone: '+91 98410 11223',
                status: 'online',
              });
              setIsCallModalOpen(true);
            }}
            className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-2 text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700"
            title="Start In-App VoIP Call with Fleet Owner"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Call Owner</span>
          </button>

          <button
            onClick={() => {
              setActiveChatContact({
                id: 'owner-01',
                name: 'Sarangan (Fleet Owner)',
                role: 'manager' as any,
                phone: '+91 98410 11223',
                status: 'online',
              });
              setIsChatModalOpen(true);
            }}
            className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-2 text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700"
            title="Open Live Chat Thread with Owner"
          >
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span>Chat Owner</span>
          </button>
        </div>
      </div>

      {/* Offline Alert Intimation Notice */}
      {offlineNotice && (
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-amber-200 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <span>{offlineNotice}</span>
          </div>
          <button
            onClick={() => setOfflineNotice(null)}
            className="text-amber-400 hover:text-white font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── LIVE OLA/UBER STYLE TAXI RIDES SECTION ─── */}
      <div className="glass-card p-5 border-slate-700/80 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-0.5">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Live Ola/Uber Style Taxi Dispatch Feed</span>
            </div>
            <h2 className="text-base font-bold text-white">Passenger Ride Bookings</h2>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
            {bookings.length} Bookings
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookings.map((booking) => {
            const isAssignedToMe = booking.assignedDriverId === driverId;
            const isPending = booking.status === 'pending';

            return (
              <div
                key={booking.bookingId || booking._id}
                className={`p-4 rounded-2xl border transition-all space-y-3.5 ${
                  booking.status === 'in_progress'
                    ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                    : isAssignedToMe
                    ? 'bg-brand-950/20 border-brand-500/40'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white">#{booking.bookingId}</span>
                    <span className="text-[10px] text-slate-400">{booking.cabTierName}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    booking.status === 'in_progress'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : booking.status === 'driver_assigned'
                      ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                      : booking.status === 'completed'
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {booking.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Customer Info */}
                <div className="flex items-center justify-between text-xs py-1 border-y border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-600/20 text-cyan-300 flex items-center justify-center font-bold text-xs">
                      {booking.customerName[0]}
                    </div>
                    <div>
                      <span className="font-bold text-white block">{booking.customerName}</span>
                      <span className="text-[10px] text-slate-400">{booking.customerPhone}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setActiveCallContact({
                          id: booking.customerId,
                          name: booking.customerName,
                          role: 'customer' as any,
                          phone: booking.customerPhone,
                          status: 'online',
                        });
                        setIsCallModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                      title="Call Passenger"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setActiveChatContact({
                          id: booking.customerId,
                          name: booking.customerName,
                          role: 'customer' as any,
                          phone: booking.customerPhone,
                          status: 'online',
                        });
                        setIsChatModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                      title="Chat Passenger"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Route */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
                    <span className="text-slate-300 truncate" title={booking.pickupLocation}>
                      <b>Pickup:</b> {booking.pickupLocation}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400 mt-1 flex-shrink-0" />
                    <span className="text-slate-300 truncate" title={booking.dropoffLocation}>
                      <b>Drop:</b> {booking.dropoffLocation}
                    </span>
                  </div>
                </div>

                {/* Fare & OTP */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Est. Fare</span>
                    <span className="text-sm font-extrabold text-emerald-400">₹{booking.estimatedFare}</span>
                  </div>

                  {booking.status === 'in_progress' ? (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Trip Ongoing
                    </span>
                  ) : booking.status === 'driver_assigned' ? (
                    <div className="text-right">
                      <span className="text-[10px] text-amber-400 block font-semibold">Ask Customer OTP</span>
                      <span className="text-xs font-mono font-bold text-slate-400">••••</span>
                    </div>
                  ) : null}
                </div>

                {/* Action Buttons */}
                <div className="pt-2">
                  {isPending ? (
                    <button
                      onClick={() => handleAcceptBooking(booking)}
                      className="w-full py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/30 transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept Taxi Ride</span>
                    </button>
                  ) : isAssignedToMe && booking.status === 'driver_assigned' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleUpdateStatus(booking, 'driver_arrived')}
                        className="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                      >
                        Reached Pickup
                      </button>
                      <button
                        onClick={() => setSelectedOtpBooking(booking)}
                        className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Enter OTP</span>
                      </button>
                    </div>
                  ) : isAssignedToMe && booking.status === 'driver_arrived' ? (
                    <button
                      onClick={() => setSelectedOtpBooking(booking)}
                      className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Enter Customer OTP to Start Trip</span>
                    </button>
                  ) : isAssignedToMe && booking.status === 'in_progress' ? (
                    <button
                      onClick={() => handleUpdateStatus(booking, 'completed')}
                      className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Complete Trip (Collect ₹{booking.estimatedFare})</span>
                    </button>
                  ) : (
                    <div className="text-center text-[11px] text-slate-500 py-1">
                      Assigned to {booking.assignedDriverName || 'Driver'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Left Vehicle Details & Handover Condition, Right Task & GPS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Assigned Vehicle Details & Handover Proofs */}
        <div className="space-y-6">
          <div className="glass-card p-5 border-slate-700/80">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Car className="w-4 h-4 text-brand-400" />
                Assigned Fleet Car
              </h2>
              <span className="text-xs font-bold font-mono text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-lg border border-brand-500/20">
                {vehicle.registrationNumber}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Make & Model</span>
                <span className="font-semibold text-white">{vehicle.make} {vehicle.model}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Fuel Type</span>
                <span className="font-semibold uppercase text-emerald-400">{vehicle.fuelType}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Passenger Capacity</span>
                <span className="font-semibold text-white">{vehicle.seatingCapacity} Passengers</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Company Claimed Mileage</span>
                <span className="font-semibold text-slate-300">{vehicle.mileageConfig?.claimedMileage} {vehicle.mileageConfig?.unit}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Target Driving Economy</span>
                <span className="font-semibold text-cyan-400">{vehicle.mileageConfig?.expectedMileage} {vehicle.mileageConfig?.unit}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Starting Odometer</span>
                <span className="font-semibold text-white">{vehicle.currentOdometer.toLocaleString('en-IN')} km</span>
              </div>
            </div>

            {/* Handover Inspection Proofs Button */}
            <div className="mt-5 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Handover Proof Photos</span>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                  4-Angle Cloudinary Verified
                </span>
              </div>
              <button
                onClick={() => setIsPhotoModalOpen(true)}
                className="w-full btn-secondary text-xs flex items-center justify-center gap-2 py-2.5 hover:border-brand-500/40"
              >
                <Shield className="w-3.5 h-3.5 text-brand-400" />
                <span>View / Verify 4 Condition Proofs</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Free OpenStreetMap GPS Trip Tracker */}
        <div className="lg:col-span-2 space-y-6">
          <GpsTripTracker
            vehicleRegistration={vehicle.registrationNumber}
            driverName={driverName}
            taskType={activeTask}
            expectedMileage={vehicle.mileageConfig?.expectedMileage ?? 26.5}
            fuelUnit={vehicle.mileageConfig?.unit ?? 'km/kg'}
            onTripEnd={(stats) => {
              setCompletedTripStats(stats);
            }}
          />

          {/* Trip Completion Card */}
          {completedTripStats && (
            <div className="glass-card p-5 border-emerald-500/40 bg-emerald-950/20 animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Trip Completed Successfully!</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Total Distance</span>
                  <span className="text-base font-bold text-emerald-400">{completedTripStats.distanceKm} km</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Trip Duration</span>
                  <span className="text-base font-bold text-white">{completedTripStats.durationMinutes} min</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Top Speed</span>
                  <span className="text-base font-bold text-cyan-400">{completedTripStats.topSpeedKmH} km/h</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Fuel Consumed</span>
                  <span className="text-base font-bold text-amber-400">{completedTripStats.fuelConsumed} kg</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ride OTP Input Modal */}
      {selectedOtpBooking && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Enter Passenger Ride OTP</h3>
              </div>
              <button
                onClick={() => setSelectedOtpBooking(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Ask passenger <b>{selectedOtpBooking.customerName}</b> for their 4-digit Ride OTP to start trip:
            </p>

            <input
              type="text"
              maxLength={4}
              value={inputOtp}
              onChange={(e) => setInputOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 4591"
              className="w-full text-center text-2xl font-mono font-black tracking-widest py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
            />

            {otpError && (
              <p className="text-xs text-rose-400 font-medium">{otpError}</p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedOtpBooking(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyOtpAndStart}
                disabled={inputOtp.length < 4}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-emerald-600/30"
              >
                Start Trip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4-Angle Handover Condition Modal */}
      {isPhotoModalOpen && (
        <VehiclePhotoGalleryModal
          isOpen={isPhotoModalOpen}
          onClose={() => setIsPhotoModalOpen(false)}
          vehicleId={vehicle._id}
          registrationNumber={vehicle.registrationNumber}
          initialPhotos={vehicle.photos}
          userRole="driver"
        />
      )}

      {/* In-App Live Chat Modal */}
      <InAppChatModal
        isOpen={isChatModalOpen}
        onClose={() => setIsChatModalOpen(false)}
        contact={activeChatContact}
        driverName={driverName}
        onStartCall={(c) => {
          setActiveCallContact(c);
          setIsCallModalOpen(true);
        }}
      />

      {/* In-App Voice Call Modal */}
      <InAppCallModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        targetContact={activeCallContact}
        callerName={activeCallContact?.name || 'Sarangan (Fleet Owner)'}
        callerRole={activeCallContact?.role || 'Fleet Control'}
        targetPhone={activeCallContact?.phone || '+91 98410 11223'}
      />
    </div>
  );
}
