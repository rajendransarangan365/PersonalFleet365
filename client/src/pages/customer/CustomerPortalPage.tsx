import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin, Navigation, Car, Phone, MessageSquare, Shield,
  Clock, CheckCircle2, Star, Sparkles, AlertCircle, ExternalLink,
  ChevronRight, Radio, RefreshCw, Headphones, UserCheck, ArrowRight, LogOut
} from 'lucide-react';
import InAppCallModal from '../../components/InAppCallModal.js';
import InAppChatModal from '../../components/InAppChatModal.js';
import IncomingCallModal from '../../components/IncomingCallModal.js';
import LiveDemoPersonaBar from '../../components/LiveDemoPersonaBar.js';
import FleetLogo from '../../components/FleetLogo.js';
import { useContactsStore, type FleetContact } from '../../store/contacts.store.js';
import { apiGet, apiPost, apiPatch } from '../../services/api.js';
import { getSocket, registerCurrentUser } from '../../services/socket.client.js';
import { useAuthStore } from '../../store/auth.store.js';

// Pre-defined Indian commercial landmarks (Chennai)
const LANDMARKS = [
  { name: 'Chennai International Airport (MAA T1)', lat: 12.9941, lng: 80.1709 },
  { name: 'Puratchi Thalaivar Dr. MGR Central Railway Station', lat: 13.0827, lng: 80.2707 },
  { name: 'Tidel Park, OMR IT Corridor', lat: 12.9892, lng: 80.2483 },
  { name: 'Guindy Metro & Industrial Estate', lat: 13.0067, lng: 80.2023 },
  { name: 'Marina Beach Promenade, Triplicane', lat: 13.0500, lng: 80.2824 },
  { name: 'Anna Nagar Tower Park West', lat: 13.0850, lng: 80.2100 },
];

interface CabTier {
  id: string;
  name: string;
  category: string;
  model: string;
  ratePerKm: number;
  baseFare: number;
  etaMins: number;
  image: string;
}

const CAB_TIERS: CabTier[] = [
  {
    id: 'sedan_cng',
    name: 'Economy Tour S',
    category: 'Commercial Sedan (CNG)',
    model: 'Maruti Suzuki Tour S CNG',
    ratePerKm: 12,
    baseFare: 80,
    etaMins: 3,
    image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'ev_green',
    name: 'Green City EV',
    category: '100% Electric Taxi',
    model: 'Tata Tigor EV Green',
    ratePerKm: 14,
    baseFare: 90,
    etaMins: 4,
    image: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'premium_xl',
    name: 'Fleet Prime XL',
    category: '7-Seater Commercial SUV',
    model: 'Toyota Innova Crysta',
    ratePerKm: 22,
    baseFare: 150,
    etaMins: 6,
    image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=400&auto=format&fit=crop&q=80',
  },
];

export default function CustomerPortalPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { contacts } = useContactsStore();
  const drivers = contacts.filter((c) => c.role === 'driver');
  const telecallers = contacts.filter((c) => c.role === 'telecaller');

  // Customer Pickup & Dropoff State
  const [pickup, setPickup] = useState(LANDMARKS[0].name);
  const [dropoff, setDropoff] = useState(LANDMARKS[2].name);
  const [selectedTier, setSelectedTier] = useState<CabTier>(CAB_TIERS[0]);

  // Ride Lifecycle
  const [rideState, setRideState] = useState<'idle' | 'searching' | 'assigned' | 'arrived' | 'on_trip' | 'completed'>('idle');
  const [assignedDriver, setAssignedDriver] = useState<FleetContact | null>(null);
  const [currentBooking, setCurrentBooking] = useState<any>(null);
  const [rideOtp, setRideOtp] = useState('8492');
  const [currentSpeed, setCurrentSpeed] = useState(0);

  // Problem Reporting Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [issueText, setIssueText] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [reportedSuccess, setReportedSuccess] = useState(false);

  // In-App Calls & Chats
  const [activeCallContact, setActiveCallContact] = useState<FleetContact | null>(null);
  const [activeChatContact, setActiveChatContact] = useState<FleetContact | null>(null);
  const [isIncomingAnswered, setIsIncomingAnswered] = useState(false);

  // Estimated distance and fare calculation
  const estDistanceKm = 16.4;
  const estFare = Math.round(selectedTier.baseFare + estDistanceKm * selectedTier.ratePerKm);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Listen to Socket.IO for live driver assignments & updates
  useEffect(() => {
    registerCurrentUser();
    const socket = getSocket();

    const handleBookingUpdate = (updated: any) => {
      if (currentBooking && (updated.bookingId === currentBooking.bookingId || updated._id === currentBooking._id)) {
        setCurrentBooking(updated);
        if (updated.assignedDriverName) {
          setAssignedDriver({
            id: updated.assignedDriverId || 'drv-01',
            name: updated.assignedDriverName,
            role: 'driver' as const,
            phone: updated.assignedDriverPhone || '+91 98401 23456',
            vehiclePlate: updated.vehiclePlate || 'TN01BV4589',
            vehicleModel: updated.vehicleModel || selectedTier.model,
            status: 'online' as const,
            speedKmH: 52,
            rating: 4.9,
          });
        }
        if (updated.status === 'driver_assigned') {
          setRideState('assigned');
        } else if (updated.status === 'driver_arrived') {
          setRideState('arrived');
        } else if (updated.status === 'in_progress') {
          setRideState('on_trip');
        } else if (updated.status === 'completed') {
          setRideState('completed');
        }
      }
    };

    socket.on('booking:updated', handleBookingUpdate);
    socket.on('booking:driver_assigned', handleBookingUpdate);
    socket.on('booking:status_changed', handleBookingUpdate);

    return () => {
      socket.off('booking:updated', handleBookingUpdate);
      socket.off('booking:driver_assigned', handleBookingUpdate);
      socket.off('booking:status_changed', handleBookingUpdate);
    };
  }, [currentBooking, selectedTier]);

  // Handle Taxi Booking (Saves to real DB & broadcasts via socket)
  const handleBookRide = async () => {
    setRideState('searching');
    setReportedSuccess(false);

    try {
      const auth = useAuthStore.getState();
      const user = auth.user;
      const res = await apiPost<any>('/app/bookings', {
        customerId: (user as any)?.id || (user as any)?._id || 'cust-01',
        customerName: user?.displayName || 'Ananya Sharma (Passenger)',
        customerPhone: '+91 99620 12345',
        pickupLocation: pickup,
        dropoffLocation: dropoff,
        cabTier: selectedTier.id,
        cabTierName: selectedTier.name,
        vehicleModel: selectedTier.model,
        estimatedDistanceKm: estDistanceKm,
        estimatedFare: estFare,
        baseFare: selectedTier.baseFare,
      });

      setCurrentBooking(res);
      setRideOtp(res.otp);

      const socket = getSocket();
      socket.emit('booking:new', res);

      // If driver is immediately assigned by system
      if (res.assignedDriverName) {
        setAssignedDriver({
          id: res.assignedDriverId || 'drv-01',
          name: res.assignedDriverName,
          role: 'driver' as const,
          phone: res.assignedDriverPhone || '+91 98401 23456',
          vehiclePlate: res.vehiclePlate || 'TN01BV4589',
          vehicleModel: res.vehicleModel,
          status: 'online' as const,
          speedKmH: 52,
          rating: 4.9,
        });
        setRideState('assigned');
      }
    } catch (err) {
      console.error('Error creating real booking', err);
    }
  };

  // Report Problem to 24x7 Support Desk & Owner
  const handleReportProblem = async () => {
    if (!currentBooking || !issueText.trim()) return;
    setIsReporting(true);
    try {
      await apiPost(`/app/bookings/${currentBooking.bookingId || currentBooking._id}/report-issue`, {
        issueDetails: issueText.trim(),
      });
      setReportedSuccess(true);
      setTimeout(() => {
        setIsReportModalOpen(false);
        setIssueText('');
      }, 1500);
    } catch (err) {
      console.error('Error reporting problem', err);
    } finally {
      setIsReporting(false);
    }
  };

  const openGoogleMapsDirections = () => {
    const originParam = encodeURIComponent(pickup);
    const destParam = encodeURIComponent(dropoff);
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <FleetLogo size="sm" showText subtitle="Passenger Ride Portal" role="customer" />
        </div>

        <div className="flex items-center gap-2.5">
          {/* Helpline Telecaller button */}
          <button
            onClick={() => {
              const tel = telecallers[0] || {
                id: 'tel-01',
                name: 'Fleet 365 24x7 Helpline Desk',
                role: 'telecaller' as const,
                phone: '+91 1800 365 000',
                status: 'online' as const,
              };
              setActiveCallContact(tel);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition-all shadow-sm"
            title="Connect with 24x7 Customer Support Telecaller"
          >
            <Headphones className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">24x7 Helpline</span>
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 font-medium hidden md:inline bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                {user.displayName} ({((user as any).role || 'customer').replace('_', ' ')})
              </span>
              <button
                onClick={async () => {
                  await logout();
                  navigate('/auth/signin');
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 text-xs font-medium border border-slate-700 hover:border-rose-500/30 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <Link
              to="/auth/signin"
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/30 transition-colors shadow-sm"
            >
              Customer Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row relative">
        {/* Left Side: Booking & Ride Console */}
        <div className="w-full lg:w-[460px] xl:w-[500px] border-r border-slate-800 bg-slate-900/95 flex flex-col justify-between p-4 sm:p-6 space-y-6 z-20 overflow-y-auto">
          {/* Title */}
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Instant Taxi Dispatch Network</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Book Commercial Ride
            </h1>
            <p className="text-xs text-slate-400">
              Assigned to nearest verified taxi driver with zero surge & live GPS tracking.
            </p>
          </div>

          {/* Ride Booking Form or Active Ride Details */}
          {rideState === 'idle' && (
            <div className="space-y-4">
              {/* Pickup & Dropoff Inputs */}
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-3 relative">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] uppercase font-bold text-slate-400">Pickup Location</label>
                    <select
                      value={pickup}
                      onChange={(e) => setPickup(e.target.value)}
                      className="w-full bg-transparent text-xs sm:text-sm text-white font-medium focus:outline-none truncate"
                    >
                      {LANDMARKS.map((lm) => (
                        <option key={lm.name} value={lm.name} className="bg-slate-900 text-white">
                          {lm.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="h-px bg-slate-800 ml-6" />

                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500 ring-4 ring-rose-500/20 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] uppercase font-bold text-slate-400">Destination Dropoff</label>
                    <select
                      value={dropoff}
                      onChange={(e) => setDropoff(e.target.value)}
                      className="w-full bg-transparent text-xs sm:text-sm text-white font-medium focus:outline-none truncate"
                    >
                      {LANDMARKS.map((lm) => (
                        <option key={lm.name} value={lm.name} className="bg-slate-900 text-white">
                          {lm.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Cab Tier Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">
                  Select Commercial Vehicle Tier
                </label>
                <div className="space-y-2">
                  {CAB_TIERS.map((tier) => {
                    const isSelected = selectedTier.id === tier.id;
                    const fare = Math.round(tier.baseFare + estDistanceKm * tier.ratePerKm);

                    return (
                      <button
                        key={tier.id}
                        onClick={() => setSelectedTier(tier)}
                        className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-brand-500/15 border-brand-500 text-white shadow-lg shadow-brand-500/10'
                            : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-10 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center text-brand-400 font-bold overflow-hidden flex-shrink-0">
                            <Car className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-white">{tier.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                {tier.etaMins}m away
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">{tier.model}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-sm sm:text-base font-black text-brand-400 font-mono">
                            ₹{fare}
                          </span>
                          <p className="text-[10px] text-slate-500">₹{tier.ratePerKm}/km</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Booking CTA */}
              <button
                onClick={handleBookRide}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white font-bold text-sm sm:text-base shadow-xl shadow-brand-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Car className="w-5 h-5" />
                <span>Book {selectedTier.name} • ₹{estFare}</span>
              </button>
            </div>
          )}

          {/* Searching Status */}
          {rideState === 'searching' && (
            <div className="bg-slate-950/80 border border-brand-500/30 rounded-3xl p-6 text-center space-y-4 animate-pulse">
              <div className="w-16 h-16 rounded-full bg-brand-500/20 border-2 border-brand-400 mx-auto flex items-center justify-center text-brand-400">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Finding Nearest Taxi...</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Broadcasting trip request to roaming drivers near {pickup}
                </p>
              </div>
            </div>
          )}

          {/* Ride Assigned State */}
          {rideState !== 'idle' && rideState !== 'searching' && assignedDriver && (
            <div className="bg-slate-950/80 border border-emerald-500/40 rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Taxi Assigned & En Route</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Ride Start OTP</span>
                  <div className="text-base font-black font-mono text-amber-400 tracking-wider">
                    {rideOtp}
                  </div>
                </div>
              </div>

              {/* Driver Details Card */}
              <div className="flex items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {assignedDriver.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm sm:text-base flex items-center gap-1.5">
                      <span>{assignedDriver.name}</span>
                      <span className="text-xs text-amber-400 font-normal flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400" /> 4.9
                      </span>
                    </h4>
                    <p className="text-xs text-brand-400 font-mono font-semibold">
                      {assignedDriver.vehiclePlate}
                    </p>
                    <p className="text-xs text-slate-400">{assignedDriver.vehicleModel}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-400 block">Arriving in 3m</span>
                  <span className="text-[10px] text-slate-400 font-mono">1.2 km away</span>
                </div>
              </div>

              {/* Telemetry Bar */}
              <div className="grid grid-cols-3 gap-2 text-center bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Speed</span>
                  <span className="font-mono font-bold text-white">{currentSpeed} km/h</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Fare</span>
                  <span className="font-mono font-bold text-emerald-400">₹{estFare}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Distance</span>
                  <span className="font-mono font-bold text-cyan-400">{estDistanceKm} km</span>
                </div>
              </div>

              {/* Quick Actions: In-App VoIP Call & Chat */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  onClick={() => setActiveCallContact(assignedDriver)}
                  className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call Driver (In-App)</span>
                </button>

                <button
                  onClick={() => setActiveChatContact(assignedDriver)}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-white font-semibold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat Driver</span>
                </button>
              </div>

              {/* Navigate in Google Maps Button */}
              <button
                onClick={openGoogleMapsDirections}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-2 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-brand-400" />
                <span>Navigate using Google Maps</span>
              </button>

              {/* Report Problem / 24x7 Helpline Support Button */}
              <button
                onClick={() => setIsReportModalOpen(true)}
                className="w-full py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>🆘 Report Problem to 24x7 Support Team</span>
              </button>
            </div>
          )}

          {/* Safety & Helpline banner */}
          <div className="border-t border-slate-800 pt-4 text-xs text-slate-500 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>GPS tracked 24x7 with emergency helpline</span>
            </div>
            <button
              onClick={() => {
                const tel = telecallers[0];
                if (tel) setActiveCallContact(tel);
              }}
              className="text-cyan-400 hover:underline font-medium"
            >
              Contact Support
            </button>
          </div>
        </div>

        {/* Right Side: Free OpenStreetMap Leaflet View */}
        <div className="flex-1 relative min-h-[400px] lg:min-h-full bg-slate-950">
          <div ref={mapContainerRef} className="w-full h-full min-h-[450px] lg:min-h-screen z-10" />

          {/* Map Overlay Badge */}
          <div className="absolute top-4 right-4 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-xl flex items-center gap-2.5 text-xs text-slate-300">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold text-white">4 Taxis Roaming Live</span>
            <span className="text-slate-500 font-mono">OpenStreetMap</span>
          </div>
        </div>
      </div>

      {/* In-App VoIP Call Modal */}
      {activeCallContact && (
        <InAppCallModal
          isOpen={Boolean(activeCallContact)}
          onClose={() => {
            setActiveCallContact(null);
            setIsIncomingAnswered(false);
          }}
          targetContact={activeCallContact}
          callerName={activeCallContact.name}
          callerRole={activeCallContact.role}
          targetPhone={activeCallContact.phone}
          vehiclePlate={activeCallContact.vehiclePlate}
          isIncomingAnswered={isIncomingAnswered}
        />
      )}

      {/* In-App Chat Modal */}
      {activeChatContact && (
        <InAppChatModal
          isOpen={Boolean(activeChatContact)}
          onClose={() => setActiveChatContact(null)}
          contact={activeChatContact}
          onStartCall={(contact) => {
            setActiveCallContact(contact);
            setIsIncomingAnswered(false);
          }}
        />
      )}

      {/* Real Incoming Call Screen with Accept & Reject */}
      <IncomingCallModal
        onAccept={(session) => {
          setActiveCallContact({
            id: session.callerId,
            name: session.callerName,
            role: session.callerRole as any,
            phone: session.callerPhone,
            vehiclePlate: session.vehiclePlate,
            status: 'online',
          });
          setIsIncomingAnswered(true);
        }}
      />

      {/* 24x7 Customer Support Problem Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertCircle className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Report Ride Issue / Help</h3>
              </div>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {reportedSuccess ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center space-y-2 text-xs text-emerald-300">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="font-bold text-white text-sm">Issue Escalated Successfully</p>
                <p className="text-[11px] text-slate-300">
                  Fleet 365 24x7 Help Desk and the company Fleet Owner have been notified. A support agent will assist you shortly.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-300">
                  Please describe the problem you are facing with ride <b>#{currentBooking?.bookingId || 'Active'}</b>. Our support desk will intervene immediately:
                </p>

                <textarea
                  rows={3}
                  value={issueText}
                  onChange={(e) => setIssueText(e.target.value)}
                  placeholder="e.g. Driver is not moving, wrong pickup location, or fare dispute..."
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setIsReportModalOpen(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReportProblem}
                    disabled={!issueText.trim() || isReporting}
                    className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-rose-600/30 flex items-center justify-center gap-1.5"
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    <span>Send to Support</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Live Testing Persona Switcher Bar */}
      <LiveDemoPersonaBar />
    </div>
  );
}
