import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  MapPin, Play, Square, Navigation, Zap, Gauge,
  Clock, ShieldAlert, Phone, MessageSquare, Compass,
  CheckCircle2, AlertTriangle, Crosshair
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon URLs in Vite safely
try {
  if (typeof window !== 'undefined' && (L as any)?.Icon?.Default) {
    delete ((L as any).Icon.Default.prototype as any)._getIconUrl;
    (L as any).Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }
} catch {
  // Ignore in SSR / non-browser environments
}

function getCarIcon() {
  try {
    return L.divIcon({
      html: `<div style="background-color: #3b82f6; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(59, 130, 246, 0.7); border: 2px solid #ffffff;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 3c-.1.2-.1.4-.1.6v4.5c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
            </div>`,
      className: 'custom-car-pin',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  } catch {
    return undefined;
  }
}

interface GpsPoint {
  lat: number;
  lng: number;
  speed: number; // km/h
  timestamp: number;
}

interface GpsTripTrackerProps {
  vehicleRegistration?: string;
  driverName?: string;
  driverPhone?: string;
  managerPhone?: string;
  taskType?: 'pick_and_drop' | 'outstation' | 'regular';
  expectedMileage?: number; // km/unit
  fuelUnit?: string;
  onTripEnd?: (stats: {
    distanceKm: number;
    durationMinutes: number;
    avgSpeedKmH: number;
    topSpeedKmH: number;
    fuelConsumed: number;
  }) => void;
}

// Haversine distance in kilometers
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function GpsTripTracker({
  vehicleRegistration = 'TN01BV4589',
  driverName = 'Karthik Raja',
  driverPhone = '+919876543210',
  managerPhone = '+911234567890',
  taskType = 'pick_and_drop',
  expectedMileage = 26.5,
  fuelUnit = 'km/kg',
  onTripEnd,
}: GpsTripTrackerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const [isTracking, setIsTracking] = useState(false);
  const [currentCoord, setCurrentCoord] = useState<{ lat: number; lng: number }>({
    lat: 13.0827,
    lng: 80.2707, // Default Chennai center
  });
  const [speed, setSpeed] = useState<number>(0);
  const [topSpeed, setTopSpeed] = useState<number>(0);
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [simulatedMode, setSimulatedMode] = useState<boolean>(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = currentCoord.lat;
    const initialLng = currentCoord.lng;

    // Free OpenStreetMap Tile Layer
    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const carMarkerIcon = getCarIcon();
    const marker = L.marker([initialLat, initialLng], carMarkerIcon ? { icon: carMarkerIcon } : {}).addTo(map);
    marker.bindPopup(`<b>${vehicleRegistration}</b><br>Driver: ${driverName}`);

    // Path Polyline
    const polyline = L.polyline([], {
      color: '#3b82f6',
      weight: 5,
      opacity: 0.85,
      smoothFactor: 1,
    }).addTo(map);

    mapInstanceRef.current = map;
    markerRef.current = marker;
    polylineRef.current = polyline;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Timer for elapsed seconds
  useEffect(() => {
    let timer: any;
    if (isTracking) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTracking]);

  // Center Map on Current Position
  const handleRecenter = () => {
    if (mapInstanceRef.current && currentCoord) {
      mapInstanceRef.current.setView([currentCoord.lat, currentCoord.lng], 16, { animate: true });
    }
  };

  // Start Live Tracking via HTML5 Geolocation API
  const startTracking = () => {
    setIsTracking(true);
    setElapsedSeconds(0);
    setDistanceKm(0);
    setTopSpeed(0);
    setRouteCoordinates([]);

    if ('geolocation' in navigator) {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const speedKmh = position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0;
          const accuracy = Math.round(position.coords.accuracy);

          setGpsAccuracy(accuracy);
          setSpeed(speedKmh);
          if (speedKmh > topSpeed) setTopSpeed(speedKmh);

          setCurrentCoord({ lat, lng });

          // Update Leaflet marker and polyline
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          }

          setRouteCoordinates((prev) => {
            if (prev.length > 0) {
              const last = prev[prev.length - 1];
              const addedDist = calculateHaversineDistance(last[0], last[1], lat, lng);
              // Only add if movement exceeds 5 meters to prevent jitter
              if (addedDist > 0.005) {
                setDistanceKm((d) => Number((d + addedDist).toFixed(2)));
                const updated = [...prev, [lat, lng] as [number, number]];
                if (polylineRef.current) polylineRef.current.setLatLngs(updated);
                return updated;
              }
              return prev;
            } else {
              const updated = [[lat, lng] as [number, number]];
              if (polylineRef.current) polylineRef.current.setLatLngs(updated);
              return updated;
            }
          });

          if (mapInstanceRef.current) {
            mapInstanceRef.current.panTo([lat, lng]);
          }
        },
        (error) => {
          console.warn('GPS Geolocation error / permission denied. Activating simulated drive mode.', error.message);
          setSimulatedMode(true);
          startSimulation();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 1000,
        }
      );
      watchIdRef.current = id;
    } else {
      setSimulatedMode(true);
      startSimulation();
    }
  };

  // Realistic Simulation Mode for Desktop Testing & Demonstrations
  const simulationIntervalRef = useRef<any>(null);
  const startSimulation = () => {
    let currentLat = currentCoord.lat;
    let currentLng = currentCoord.lng;

    simulationIntervalRef.current = setInterval(() => {
      // Simulate forward movement in Chennai corridor
      currentLat += 0.00015 + (Math.random() - 0.5) * 0.00005;
      currentLng += 0.00018 + (Math.random() - 0.5) * 0.00005;
      const simSpeed = Math.floor(35 + Math.random() * 28); // 35 - 63 km/h

      setSpeed(simSpeed);
      setTopSpeed((prev) => Math.max(prev, simSpeed));
      setCurrentCoord({ lat: currentLat, lng: currentLng });
      setGpsAccuracy(12);

      if (markerRef.current) {
        markerRef.current.setLatLng([currentLat, currentLng]);
      }

      setRouteCoordinates((prev) => {
        const updated = [...prev, [currentLat, currentLng] as [number, number]];
        if (polylineRef.current) polylineRef.current.setLatLngs(updated);
        return updated;
      });

      setDistanceKm((prev) => Number((prev + 0.035).toFixed(2)));

      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo([currentLat, currentLng]);
      }
    }, 2000);
  };

  // Stop Trip Tracking
  const stopTracking = () => {
    setIsTracking(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    setSpeed(0);

    const durationMin = Math.round(elapsedSeconds / 60) || 1;
    const avgSpeed = distanceKm > 0 ? Math.round((distanceKm / (elapsedSeconds / 3600))) : 0;
    const fuelUsed = expectedMileage > 0 ? Number((distanceKm / expectedMileage).toFixed(2)) : 0;

    if (onTripEnd) {
      onTripEnd({
        distanceKm,
        durationMinutes: durationMin,
        avgSpeedKmH: avgSpeed,
        topSpeedKmH: topSpeed,
        fuelConsumed: fuelUsed,
      });
    }
  };

  // Formatting helpers
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    if (hrs > 0) return `${hrs}h ${m}m ${s}s`;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const avgSpeed = elapsedSeconds > 0 ? Math.round((distanceKm / (elapsedSeconds / 3600))) : 0;
  const estimatedFuelConsumed = expectedMileage > 0 ? (distanceKm / expectedMileage).toFixed(2) : '0';

  return (
    <div className="glass-card overflow-hidden flex flex-col border-slate-700 shadow-2xl">
      {/* Header Bar */}
      <div className="p-4 bg-slate-900/90 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <Navigation className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base">{vehicleRegistration}</h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                taskType === 'outstation' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {taskType === 'outstation' ? 'Outstation Duty' : 'Pick & Drop'}
              </span>
              {simulatedMode && (
                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30">
                  Simulated GPS
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Assigned Driver: <span className="text-slate-200 font-medium">{driverName}</span>
            </p>
          </div>
        </div>

        {/* Quick Contact Buttons (Free In-App Calling & Messaging) */}
        <div className="flex items-center gap-2">
          <a
            href={`tel:${managerPhone}`}
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 hover:text-emerald-400"
            title="Call Fleet Manager"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Call Manager</span>
          </a>
          <a
            href={`https://wa.me/${managerPhone.replace(/[^0-9]/g, '')}?text=Hello%20Manager,%20vehicle%20${vehicleRegistration}%20reporting%20duty.`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 hover:text-green-400"
            title="WhatsApp Fleet Manager"
          >
            <MessageSquare className="w-3.5 h-3.5 text-green-400" />
            <span className="hidden sm:inline">Message</span>
          </a>
          <button
            onClick={handleRecenter}
            className="btn-ghost p-2 text-slate-400 hover:text-white"
            title="Recenter Map"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live Map Box */}
      <div className="relative w-full h-80 sm:h-96 bg-slate-950">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Live Telemetry HUD */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/80 shadow-lg pointer-events-auto flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Live Speed</span>
              <span className="text-xl font-mono font-black text-white">{speed} <span className="text-xs text-slate-400 font-normal">km/h</span></span>
            </div>
          </div>
        </div>

        {/* Floating OpenStreetMap Attribution Notice */}
        <div className="absolute bottom-2 left-3 z-10 bg-slate-900/80 backdrop-blur px-2 py-0.5 rounded text-[10px] text-slate-400 border border-slate-800">
          🗺️ 100% Free OpenStreetMap GPS Engine
        </div>
      </div>

      {/* Live Driving Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-slate-900/60 border-t border-slate-800 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40">
          <div className="flex items-center gap-1 text-slate-400 mb-1">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Distance Traveled</span>
          </div>
          <p className="text-lg font-bold font-mono text-white">{distanceKm} <span className="text-xs font-normal text-slate-400">km</span></p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40">
          <div className="flex items-center gap-1 text-slate-400 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Trip Duration</span>
          </div>
          <p className="text-lg font-bold font-mono text-white">{formatTime(elapsedSeconds)}</p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40">
          <div className="flex items-center gap-1 text-slate-400 mb-1">
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
            <span>Avg / Top Speed</span>
          </div>
          <p className="text-lg font-bold font-mono text-white">
            {avgSpeed} <span className="text-xs text-slate-400 font-normal">/</span> {topSpeed} <span className="text-xs font-normal text-slate-400">km/h</span>
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40">
          <div className="flex items-center gap-1 text-slate-400 mb-1">
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span>Estimated Fuel Used</span>
          </div>
          <p className="text-lg font-bold font-mono text-white">
            {estimatedFuelConsumed} <span className="text-xs font-normal text-slate-400">units</span>
          </p>
        </div>
      </div>

      {/* Control Actions */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isTracking ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Tracking Active
            </span>
          ) : (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Trip Stopped
            </span>
          )}
        </div>

        <div>
          {!isTracking ? (
            <button
              onClick={startTracking}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 text-sm font-semibold shadow-lg shadow-brand-500/20"
            >
              <Play className="w-4 h-4 fill-current" />
              Start Trip Tracking
            </button>
          ) : (
            <button
              onClick={stopTracking}
              className="btn-danger flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20"
            >
              <Square className="w-4 h-4 fill-current" />
              End Trip & Save Stats
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
