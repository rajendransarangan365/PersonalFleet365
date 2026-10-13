import React, { useState, useEffect, useRef } from 'react';
import {
  Car, UserCheck, Phone, MessageSquare, Shield,
  Navigation, CheckCircle2, Clock, AlertTriangle,
  ChevronRight, Calendar, Fuel, Droplet, ArrowRight,
  ExternalLink, Sparkles, MapPin, Power, Check, Radio,
  KeyRound, DollarSign, User, AlertCircle, Compass,
  Layers, Volume2, VolumeX, CreditCard, Award, QrCode
} from 'lucide-react';
import InAppChatModal from '../../components/InAppChatModal.js';
import InAppCallModal from '../../components/InAppCallModal.js';
import DigitalIdCardModal from '../../components/DigitalIdCardModal.js';
import { useAuthStore } from '../../store/auth.store.js';
import { apiGet, apiPatch, apiPost } from '../../services/api.js';
import { getSocket, registerCurrentUser } from '../../services/socket.client.js';
import type { FleetContact } from '../../store/contacts.store.js';

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
  paymentMode?: 'UPI / GPay' | 'Cash' | 'Card' | 'Wallet';
}

// Synthesize pleasant sound chime for incoming bookings
function playBookingChime() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.45);
  } catch {
    // AudioContext might be muted or not allowed without user interaction
  }
}

export default function DriverPortalPage() {
  const { user } = useAuthStore();
  const driverId = (user as any)?.id || (user as any)?._id || 'drv-01';
  const driverName = user?.displayName || 'Bala';
  const vehiclePlate = 'TN01BV4589';
  const vehicleModel = 'Maruti Suzuki Tour S (CNG)';

  // Navigation tab: 'radar' or 'earnings'
  const [activeTab, setActiveTab] = useState<'radar' | 'earnings'>('radar');

  // Duty Status (Online / Offline)
  const [dutyStatus, setDutyStatus] = useState<'online' | 'offline'>('online');
  const [isUpdatingDuty, setIsUpdatingDuty] = useState(false);
  const [radarRangeKm, setRadarRangeKm] = useState<number>(5);

  // Live Location State
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 13.0827, lng: 80.2707 });
  const [accuracy, setAccuracy] = useState<number>(4);
  const [speed, setSpeed] = useState<number>(34);

  // Bookings list & Active ride
  const [bookings, setBookings] = useState<TaxiBooking[]>([]);
  const [activeBooking, setActiveBooking] = useState<TaxiBooking | null>(null);
  const [incomingRadarBooking, setIncomingRadarBooking] = useState<TaxiBooking | null>(null);

  // Customer OTP Verification
  const [inputOtp, setInputOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Modals
  const [isIdCardOpen, setIsIdCardOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [activeContact, setActiveContact] = useState<FleetContact | null>(null);

  // Track driver geolocation
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setAccuracy(Math.round(pos.coords.accuracy));
          if (pos.coords.speed !== null) {
            setSpeed(Math.round((pos.coords.speed || 0) * 3.6));
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Socket & Bookings initialization
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

      // If new pending booking arrives and driver is online with no active ride
      if (updated.status === 'pending' && dutyStatus === 'online') {
        playBookingChime();
        setIncomingRadarBooking(updated);
      }
    };

    socket.on('booking:broadcast', handleBookingUpdate);
    socket.on('booking:updated', handleBookingUpdate);

    return () => {
      socket.off('booking:broadcast', handleBookingUpdate);
      socket.off('booking:updated', handleBookingUpdate);
    };
  }, [dutyStatus]);

  const loadBookings = async () => {
    try {
      const res = await apiGet<{ data: TaxiBooking[] } | TaxiBooking[]>('/app/bookings');
      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      setBookings(list);

      // Check if driver already has an assigned or ongoing booking
      const assigned = list.find(
        (b) =>
          (b.assignedDriverId === driverId || b.vehiclePlate === vehiclePlate) &&
          ['driver_assigned', 'driver_arrived', 'in_progress'].includes(b.status)
      );

      if (assigned) {
        setActiveBooking(assigned);
      } else {
        // Look for the newest pending order within radar
        const pending = list.find((b) => b.status === 'pending');
        if (pending && dutyStatus === 'online') {
          setIncomingRadarBooking(pending);
        }
      }
    } catch {}
  };

  // Toggle Online / Offline Duty
  const handleToggleDuty = async () => {
    const nextStatus = dutyStatus === 'online' ? 'offline' : 'online';
    setIsUpdatingDuty(true);

    try {
      await apiPost('/app/drivers/status', {
        driverId,
        driverName,
        phone: '+91 98401 23456',
        vehiclePlate,
        status: nextStatus,
        location: coords,
      });

      const socket = getSocket();
      socket.emit('driver:set_status', {
        driverId,
        driverName,
        status: nextStatus,
        vehiclePlate,
        coords,
      });

      setDutyStatus(nextStatus);
      if (nextStatus === 'offline') {
        setIncomingRadarBooking(null);
      } else {
        loadBookings();
      }
    } catch (err) {
      console.error('Error toggling duty status', err);
    } finally {
      setIsUpdatingDuty(false);
    }
  };

  // Accept a booking from radar
  const handleAcceptBooking = async (booking: TaxiBooking) => {
    try {
      const updated = await apiPatch<TaxiBooking>(`/app/bookings/${booking.bookingId || booking._id}/assign`, {
        assignedDriverId: driverId,
        assignedDriverName: driverName,
        assignedDriverPhone: '+91 98401 23456',
        vehiclePlate,
      });

      setActiveBooking(updated);
      setIncomingRadarBooking(null);
      setBookings((prev) => prev.map((b) => (b.bookingId === booking.bookingId ? updated : b)));
    } catch (err) {
      console.error('Error accepting booking', err);
    }
  };

  // Decline / Ignore booking from radar
  const handleIgnoreBooking = () => {
    setIncomingRadarBooking(null);
  };

  // Update ride status (arrived / completed)
  const handleUpdateStatus = async (newStatus: 'driver_arrived' | 'completed') => {
    if (!activeBooking) return;

    try {
      const updated = await apiPatch<TaxiBooking>(`/app/bookings/${activeBooking.bookingId || activeBooking._id}/status`, {
        status: newStatus,
      });

      if (newStatus === 'completed') {
        setActiveBooking(null);
      } else {
        setActiveBooking(updated);
      }

      setBookings((prev) => prev.map((b) => (b.bookingId === activeBooking.bookingId ? updated : b)));
    } catch (err) {
      console.error('Error updating booking status', err);
    }
  };

  // Verify Customer OTP and start trip
  const handleVerifyOtpAndStart = async () => {
    if (!activeBooking) return;
    setOtpError(null);

    if (inputOtp.trim() !== activeBooking.otp) {
      setOtpError('Incorrect OTP! Please ask customer for the 4-digit Ride Security OTP on their phone.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const updated = await apiPatch<TaxiBooking>(`/app/bookings/${activeBooking.bookingId || activeBooking._id}/status`, {
        status: 'in_progress',
        otp: inputOtp.trim(),
      });

      setActiveBooking(updated);
      setInputOtp('');
      setBookings((prev) => prev.map((b) => (b.bookingId === activeBooking.bookingId ? updated : b)));
    } catch (err: any) {
      setOtpError(err.message || 'Failed to verify OTP');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Launch real external Google Maps turn-by-turn navigation
  const handleOpenGoogleMaps = (destinationAddress: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${coords.lat},${coords.lng}&destination=${encodeURIComponent(destinationAddress)}&travelmode=driving`;
    window.open(url, '_blank');
  };

  // Completed trips for Wallet & Earning view
  const completedTrips = bookings.filter((b) => b.status === 'completed');
  const todayEarnings = completedTrips.reduce((acc, curr) => acc + (curr.estimatedFare || 0), 0) + 1850;

  return (
    <div className="p-3 sm:p-5 max-w-4xl mx-auto space-y-4 animate-fade-in pb-24">
      {/* ─── DRIVER APP TOP COMMAND BAR ─── */}
      <div className="glass-card p-4 sm:p-5 border-slate-800 bg-slate-900/95 shadow-xl flex items-center justify-between gap-3">
        {/* Driver identity */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg ${
              dutyStatus === 'online'
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20'
                : 'bg-slate-700 text-slate-300'
            }`}>
              {driverName[0]?.toUpperCase() ?? 'B'}
            </div>
            {dutyStatus === 'online' && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-900 rounded-full animate-pulse" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-white">Hi, {driverName}</h1>
              <span className="text-[10px] font-mono font-bold bg-slate-800 px-2 py-0.5 rounded text-emerald-400 border border-slate-700">
                {vehiclePlate}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {vehicleModel} • <span className="text-emerald-400 font-semibold">{dutyStatus === 'online' ? 'Active on Duty' : 'Offline'}</span>
            </p>
          </div>
        </div>

        {/* Action Controls: Duty Switch & ID Card */}
        <div className="flex items-center gap-2">
          {/* Digital ID Card & Driving Licence Button */}
          <button
            onClick={() => setIsIdCardOpen(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            title="View Driving Licence & Official Smart ID Card"
          >
            <Award className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">ID Card & DL</span>
          </button>

          {/* Big Tactile Duty Switch */}
          <button
            onClick={handleToggleDuty}
            disabled={isUpdatingDuty}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all active:scale-95 ${
              dutyStatus === 'online'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 font-extrabold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{dutyStatus === 'online' ? 'ONLINE' : 'OFFLINE'}</span>
          </button>
        </div>
      </div>

      {/* ─── TAB NAVIGATION SWITCHER (Radar vs My Earnings) ─── */}
      <div className="flex items-center justify-between gap-2 p-1 bg-slate-900/90 border border-slate-800 rounded-2xl text-xs">
        <button
          onClick={() => setActiveTab('radar')}
          className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'radar'
              ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Radar & Trips</span>
          {activeBooking && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('earnings')}
          className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'earnings'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>My Earnings (₹{todayEarnings})</span>
        </button>
      </div>

      {/* ─── TAB CONTENT: RADAR & TRIPS ─── */}
      {activeTab === 'radar' && (
        <div className="space-y-4">
          {/* If Driver is Offline */}
          {dutyStatus === 'offline' && (
            <div className="glass-card p-8 border-slate-800 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Power className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-white">You Are Currently Offline</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Switch to <b>ONLINE</b> to share your live GPS location and begin receiving nearby ride bookings within your radar.
              </p>
              <button
                onClick={handleToggleDuty}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"
              >
                Go Online & Start Duty
              </button>
            </div>
          )}

          {/* If Driver is Online & Has NO Active Ride: Show Radar Scanner */}
          {dutyStatus === 'online' && !activeBooking && (
            <div className="glass-card p-6 border-slate-800 bg-slate-900/90 relative overflow-hidden space-y-6">
              {/* Radar Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-slate-200 font-bold">GPS Location Sharing:</span>
                  <span className="text-emerald-400 font-mono font-bold">LIVE TELEMETRY</span>
                  <span className="text-slate-500 font-mono">({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px]">Radar Radius:</span>
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    {[3, 5, 10].map((r) => (
                      <button
                        key={r}
                        onClick={() => setRadarRangeKm(r)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          radarRangeKm === r
                            ? 'bg-brand-500 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {r} km
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ─── RADAR ANIMATION DISPLAY (Identical to reference screenshot 2) ─── */}
              <div className="relative w-72 h-72 sm:w-80 sm:h-80 mx-auto flex items-center justify-center my-4">
                {/* Outer Concentric Dotted Circles */}
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-500/30 animate-pulse" />
                <div className="absolute inset-8 rounded-full border border-dashed border-cyan-500/40" />
                <div className="absolute inset-16 rounded-full border border-cyan-500/20" />
                <div className="absolute inset-24 rounded-full border border-cyan-500/30" />

                {/* Radar Sweep Effect */}
                <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0_300deg,rgba(6,182,212,0.25)_360deg)] animate-radar-sweep pointer-events-none" />

                {/* Radar Ripple Waves */}
                <div className="absolute w-28 h-28 rounded-full border border-cyan-400/50 animate-radar-ripple pointer-events-none" />
                <div className="absolute w-44 h-44 rounded-full border border-cyan-400/30 animate-radar-ripple pointer-events-none" style={{ animationDelay: '1s' }} />

                {/* Driver's Car in Center */}
                <div className="relative z-10 w-16 h-16 rounded-full bg-slate-950 border-2 border-cyan-400 shadow-2xl shadow-cyan-500/40 flex items-center justify-center">
                  <Car className="w-8 h-8 text-cyan-400" />
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-950 rounded-full" />
                </div>

                {/* Nearby Simulated Booking Pin inside Radar */}
                {incomingRadarBooking && (
                  <div className="absolute top-12 right-12 z-20 flex flex-col items-center animate-bounce">
                    <div className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black shadow-lg">
                      ₹{incomingRadarBooking.estimatedFare}
                    </div>
                    <MapPin className="w-6 h-6 text-emerald-400 fill-emerald-400" />
                  </div>
                )}
              </div>

              {/* Radar Status Subtitle */}
              <div className="text-center space-y-1">
                <p className="text-xs font-bold text-slate-200">
                  {incomingRadarBooking
                    ? `1 Ride Request Found Within ${radarRangeKm} km Radar`
                    : `Scanning for passenger ride bookings within ${radarRangeKm} km...`}
                </p>
                <p className="text-[11px] text-slate-400">
                  Speed: <span className="font-mono text-cyan-400">{speed} km/h</span> • Telemetry Accuracy: <span className="font-mono text-emerald-400">±{accuracy}m</span>
                </p>
              </div>

              {/* ─── INCOMING BOOKING CARD (Bottom Sheet Style from Reference Image 2) ─── */}
              {incomingRadarBooking && (
                <div className="bg-slate-950 border-2 border-brand-500/60 rounded-3xl p-5 shadow-2xl space-y-4 animate-slide-in">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold">
                      <Sparkles className="w-4 h-4 animate-spin" />
                      <span>Hey! {incomingRadarBooking.customerName} wants to ride with you</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">#BK-{incomingRadarBooking.bookingId}</span>
                  </div>

                  {/* Customer, Fare & Distance Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-brand-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                        {incomingRadarBooking.customerName[0]}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">{incomingRadarBooking.customerName}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <span>{incomingRadarBooking.paymentMode || 'UPI / GPay'}</span>
                          <span>•</span>
                          <span className="text-cyan-400 font-bold">{incomingRadarBooking.estimatedDistanceKm} km</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xl font-black text-emerald-400">₹{incomingRadarBooking.estimatedFare}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">Guaranteed Fare</span>
                    </div>
                  </div>

                  {/* Route Timeline: Pickup to Drop */}
                  <div className="space-y-3 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 text-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="w-3 h-3 rounded-full bg-cyan-400 mt-1 flex-shrink-0 shadow-sm shadow-cyan-400/50" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-cyan-400 block">Pickup Location</span>
                        <span className="text-slate-200 font-semibold">{incomingRadarBooking.pickupLocation}</span>
                      </div>
                    </div>

                    <div className="w-0.5 h-4 bg-slate-700 ml-1.5" />

                    <div className="flex items-start gap-2.5">
                      <div className="w-3 h-3 rounded-sm bg-rose-400 mt-1 flex-shrink-0 shadow-sm shadow-rose-400/50" />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-rose-400 block">Destination Drop</span>
                        <span className="text-slate-200 font-semibold">{incomingRadarBooking.dropoffLocation}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: Ignore & Accept (Image 2 format) */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={handleIgnoreBooking}
                      className="py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-800 transition-all active:scale-95"
                    >
                      Ignore
                    </button>

                    <button
                      onClick={() => handleAcceptBooking(incomingRadarBooking)}
                      className="py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-xl shadow-cyan-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Accept Ride</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── ACTIVE TRIP RIDE STATUS & MAPS FOR NAVIGATION ─── */}
          {activeBooking && (
            <div className="glass-card p-5 sm:p-6 border-slate-800 bg-slate-900/95 space-y-5 animate-slide-in">
              {/* Trip Header & Status Pills */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold tracking-wider">ACTIVE PASSENGER RIDE</span>
                  <h2 className="text-base font-black text-white">Trip #{activeBooking.bookingId}</h2>
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide ${
                  activeBooking.status === 'in_progress'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
                    : activeBooking.status === 'driver_arrived'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
                }`}>
                  {activeBooking.status === 'driver_assigned' ? 'Heading to Pickup' : activeBooking.status.replace('_', ' ')}
                </span>
              </div>

              {/* ─── LIVE NAVIGATION MAP CONTAINER ─── */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 h-56 sm:h-64 flex flex-col justify-between p-4 shadow-inner">
                {/* SVG Route Visualization Map Background */}
                <div className="absolute inset-0 opacity-30 pointer-events-none">
                  <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#334155" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                    {/* Glowing Route Polyline */}
                    <path
                      d="M 50 160 Q 150 70 250 110 T 380 60"
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray="8 4"
                    />
                  </svg>
                </div>

                {/* Top Overlay: Turn-by-Turn Instruction */}
                <div className="relative z-10 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                      <Navigation className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Turn-by-Turn Navigation</span>
                      <span className="text-white font-bold">
                        {activeBooking.status === 'in_progress' ? `Head to Drop: ${activeBooking.dropoffLocation}` : `Head to Pickup: ${activeBooking.pickupLocation}`}
                      </span>
                    </div>
                  </div>

                  {/* Open in Real Google Maps Navigation Button */}
                  <button
                    onClick={() => handleOpenGoogleMaps(
                      activeBooking.status === 'in_progress' ? activeBooking.dropoffLocation : activeBooking.pickupLocation
                    )}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all whitespace-nowrap"
                  >
                    <span>Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                {/* Bottom Overlay: Live Vehicle Speed & Telemetry */}
                <div className="relative z-10 flex items-center justify-between text-xs text-slate-300 bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800">
                  <span>Car: <b className="text-white">{vehiclePlate}</b></span>
                  <span>Speed: <b className="text-cyan-400">{speed} km/h</b></span>
                  <span>Distance Left: <b className="text-emerald-400">{activeBooking.estimatedDistanceKm} km</b></span>
                </div>
              </div>

              {/* Customer Contact Card & In-App Calling / Voice Chat */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-brand-600 flex items-center justify-center text-white font-bold text-sm">
                    {activeBooking.customerName[0]}
                  </div>
                  <div>
                    <span className="text-xs font-black text-white block">{activeBooking.customerName}</span>
                    <span className="text-[11px] text-slate-400">{activeBooking.customerPhone}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* VoIP Audio Call Button */}
                  <button
                    onClick={() => {
                      setActiveContact({
                        id: activeBooking.customerId,
                        name: activeBooking.customerName,
                        role: 'customer' as any,
                        phone: activeBooking.customerPhone,
                        status: 'online',
                      });
                      setIsCallModalOpen(true);
                    }}
                    className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold"
                    title="In-App VoIP Voice Call Passenger"
                  >
                    <Phone className="w-4 h-4 animate-pulse" />
                    <span className="hidden sm:inline">Call</span>
                  </button>

                  {/* WhatsApp Voice Chat Button */}
                  <button
                    onClick={() => {
                      setActiveContact({
                        id: activeBooking.customerId,
                        name: activeBooking.customerName,
                        role: 'customer' as any,
                        phone: activeBooking.customerPhone,
                        status: 'online',
                      });
                      setIsChatModalOpen(true);
                    }}
                    className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold"
                    title="In-App Voice Chat Passenger"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="hidden sm:inline">Chat</span>
                  </button>
                </div>
              </div>

              {/* ─── TRIP RIDE ACTIONS BASED ON LIFECYCLE ─── */}
              {activeBooking.status === 'driver_assigned' && (
                <button
                  onClick={() => handleUpdateStatus('driver_arrived')}
                  className="w-full py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm shadow-xl shadow-cyan-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  <span>I Have Reached Pickup Location</span>
                </button>
              )}

              {activeBooking.status === 'driver_arrived' && (
                <div className="p-4 rounded-2xl bg-slate-950 border-2 border-emerald-500/40 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <KeyRound className="w-4 h-4" />
                    <span>Ask Passenger for 4-Digit Ride Security OTP</span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Verify the 4-digit OTP shown on passenger's screen to unlock engine and begin trip.
                  </p>

                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      maxLength={4}
                      value={inputOtp}
                      onChange={(e) => setInputOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 4-digit OTP"
                      className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-center font-mono font-black text-lg text-white tracking-widest focus:border-emerald-500 focus:outline-none"
                    />

                    <button
                      onClick={handleVerifyOtpAndStart}
                      disabled={isVerifyingOtp || inputOtp.length !== 4}
                      className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                    >
                      Start Ride
                    </button>
                  </div>

                  {otpError && (
                    <p className="text-xs text-rose-400 font-bold">{otpError}</p>
                  )}
                </div>
              )}

              {activeBooking.status === 'in_progress' && (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-300">Fare to Collect upon arrival:</span>
                    <span className="text-base font-black text-emerald-400">₹{activeBooking.estimatedFare}</span>
                  </div>

                  <button
                    onClick={() => handleUpdateStatus('completed')}
                    className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                    <span>Complete Trip & Collect ₹{activeBooking.estimatedFare}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB CONTENT: MY EARNINGS & WALLET (Image 2 format) ─── */}
      {activeTab === 'earnings' && (
        <div className="space-y-4 animate-fade-in">
          {/* Total Earnings Card (Image 2 right screenshot) */}
          <div className="rounded-3xl p-6 bg-gradient-to-br from-cyan-400 to-teal-500 text-slate-950 shadow-2xl relative overflow-hidden space-y-2">
            <div className="absolute top-2 right-4 text-5xl opacity-20">💰</div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-900/80">Total Driver Earnings</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">₹ 15,784.00</h2>
            <div className="flex items-center gap-3 pt-2 text-xs font-bold text-slate-900/90">
              <span>Today: ₹{todayEarnings}.00</span>
              <span>•</span>
              <span>8 Trips Completed</span>
              <span>•</span>
              <span>Rating: 4.9 ⭐</span>
            </div>
          </div>

          {/* Wallet Trips Feed */}
          <div className="glass-card p-5 border-slate-800 bg-slate-900/95 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Recent Wallet Rides</h3>

            <div className="space-y-2.5">
              {[
                { name: 'Bill Stephens', fare: 60, time: 'Today • 12:36 pm', id: '#56421215', avatar: 'B' },
                { name: 'Ada Perez', fare: 115, time: 'Yesterday • 05:20 pm', id: '#564511135', avatar: 'A' },
                { name: 'Tillie Kelly', fare: 75, time: '12-Oct • 02:06 pm', id: '#87156445', avatar: 'T' },
                { name: 'Lucile Sharp', fare: 112, time: '12-Oct • 11:56 am', id: '#987154515', avatar: 'L' },
                { name: 'Terry Greene', fare: 74, time: '11-Oct • 09:45 am', id: '#981545466', avatar: 'T' },
                { name: 'Brian Rivera', fare: 220, time: '10-Oct • 08:12 pm', id: '#715564644', avatar: 'B' },
                { name: 'Gabriel Carr', fare: 184, time: '10-Oct • 04:00 pm', id: '#894194545', avatar: 'G' },
              ].map((trip, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 text-white font-bold flex items-center justify-center text-xs">
                      {trip.avatar}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{trip.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">{trip.id} • {trip.time}</p>
                    </div>
                  </div>

                  <span className="text-sm font-black text-emerald-400">₹ {trip.fare}.00</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── DIGITAL ID CARD & DRIVING LICENCE MODAL ─── */}
      <DigitalIdCardModal
        isOpen={isIdCardOpen}
        onClose={() => setIsIdCardOpen(false)}
        initialRole="driver"
      />

      {/* ─── IN-APP VOIP VOICE CALL MODAL ─── */}
      {isCallModalOpen && activeContact && (
        <InAppCallModal
          isOpen={isCallModalOpen}
          contact={activeContact}
          onClose={() => {
            setIsCallModalOpen(false);
            setActiveContact(null);
          }}
        />
      )}

      {/* ─── IN-APP WHATSAPP-STYLE VOICE CHAT MODAL ─── */}
      {isChatModalOpen && activeContact && (
        <InAppChatModal
          isOpen={isChatModalOpen}
          contact={activeContact}
          onClose={() => {
            setIsChatModalOpen(false);
            setActiveContact(null);
          }}
        />
      )}
    </div>
  );
}
