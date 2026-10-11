import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Navigation, Car, Phone, MessageSquare, Shield,
  Clock, CheckCircle2, Star, Sparkles, AlertCircle, ExternalLink,
  ChevronRight, Radio, RefreshCw, Headphones, UserCheck, ArrowRight
} from 'lucide-react';
import InAppCallModal from '../../components/InAppCallModal.js';
import InAppChatModal from '../../components/InAppChatModal.js';
import FleetLogo from '../../components/FleetLogo.js';
import { useContactsStore, type FleetContact } from '../../store/contacts.store.js';

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
  const [rideOtp, setRideOtp] = useState('8492');
  const [currentSpeed, setCurrentSpeed] = useState(0);

  // In-App Calls & Chats
  const [activeCallContact, setActiveCallContact] = useState<FleetContact | null>(null);
  const [activeChatContact, setActiveChatContact] = useState<FleetContact | null>(null);

  // Estimated distance and fare calculation
  const estDistanceKm = 16.4;
  const estFare = Math.round(selectedTier.baseFare + estDistanceKm * selectedTier.ratePerKm);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Initialize Free OpenStreetMap via Leaflet
  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;

      try {
        const L = await import('leaflet');

        // Fix leaflet default icon URLs
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
        }

        const map = L.map(mapContainerRef.current).setView([13.0067, 80.2200], 12);
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        // Pickup Marker
        L.marker([12.9941, 80.1709])
          .addTo(map)
          .bindPopup(`<b>Pickup:</b> ${pickup}`)
          .openPopup();

        // Dropoff Marker
        L.marker([12.9892, 80.2483])
          .addTo(map)
          .bindPopup(`<b>Dropoff:</b> ${dropoff}`);

        // Roaming Taxis with live animated coordinates
        const taxiPositions = [
          { lat: 12.998, lng: 80.180, plate: 'TN01BV4589', name: 'Tour S CNG', speed: 52 },
          { lat: 13.010, lng: 80.215, plate: 'TN09CE2311', name: 'Aura CNG', speed: 46 },
          { lat: 12.985, lng: 80.230, plate: 'TN02DF7812', name: 'Tigor EV', speed: 38 },
          { lat: 13.030, lng: 80.245, plate: 'TN10AK9944', name: 'Innova Crysta', speed: 0 },
        ];

        taxiPositions.forEach((taxi) => {
          const taxiIcon = L.divIcon({
            className: 'custom-taxi-marker',
            html: `
              <div style="background: #0f172a; border: 2px solid #06b6d4; border-radius: 9999px; padding: 4px; box-shadow: 0 4px 12px rgba(6,182,212,0.5); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; color: #22d3ee;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.1 2 11.5 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          const m = L.marker([taxi.lat, taxi.lng], { icon: taxiIcon })
            .addTo(map)
            .bindPopup(`
              <div style="font-family: sans-serif; font-size: 12px; color: #0f172a;">
                <b>🚕 ${taxi.plate}</b><br/>
                ${taxi.name}<br/>
                <b>Speed:</b> ${taxi.speed} km/h (Live GPS)
              </div>
            `);
          markersRef.current.push(m);
        });
      } catch (err) {
        console.error('Error rendering Leaflet map:', err);
      }
    };

    void initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [pickup, dropoff]);

  // Handle Taxi Booking
  const handleBookRide = () => {
    setRideState('searching');

    setTimeout(() => {
      const nearestDriver = drivers[0] || {
        id: 'drv-01',
        name: 'Karthik Raja',
        role: 'driver' as const,
        phone: '+91 98401 23456',
        vehiclePlate: 'TN01BV4589',
        vehicleModel: selectedTier.model,
        status: 'on_trip' as const,
        speedKmH: 52,
        rating: 4.9,
      };

      setAssignedDriver(nearestDriver);
      setRideOtp(String(Math.floor(1000 + Math.random() * 9000)));
      setCurrentSpeed(52);
      setRideState('assigned');
    }, 2400);
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
          <FleetLogo size="sm" showText subtitle="Passenger Cab Booking" />
        </div>

        <div className="flex items-center gap-2">
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
            <span className="hidden sm:inline">24x7 Helpline Support</span>
          </button>

          <a
            href="/dashboard"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
          >
            Owner Portal
          </a>
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
          onClose={() => setActiveCallContact(null)}
          callerName={activeCallContact.name}
          callerRole={activeCallContact.role}
          targetPhone={activeCallContact.phone}
          vehiclePlate={activeCallContact.vehiclePlate}
        />
      )}

      {/* In-App Chat Modal */}
      {activeChatContact && (
        <InAppChatModal
          isOpen={Boolean(activeChatContact)}
          onClose={() => setActiveChatContact(null)}
          contact={activeChatContact}
          onStartCall={(contact) => setActiveCallContact(contact)}
        />
      )}
    </div>
  );
}
