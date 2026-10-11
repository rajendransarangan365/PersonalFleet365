import React, { useState, useEffect } from 'react';
import {
  Car, UserCheck, Phone, MessageSquare, Shield,
  Navigation, CheckCircle2, Clock, AlertTriangle,
  ChevronRight, Calendar, Fuel, Droplet, ArrowRight,
  ExternalLink, Sparkles, MapPin
} from 'lucide-react';
import GpsTripTracker from '../../components/GpsTripTracker.js';
import VehiclePhotoGalleryModal from '../../components/VehiclePhotoGalleryModal.js';
import InAppChatModal from '../../components/InAppChatModal.js';
import InAppCallModal from '../../components/InAppCallModal.js';
import { useAuthStore } from '../../store/auth.store.js';
import { apiGet } from '../../services/api.js';

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

export default function DriverPortalPage() {
  const { user } = useAuthStore();
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

  const [activeTask, setActiveTask] = useState<'pick_and_drop' | 'outstation'>('pick_and_drop');
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [completedTripStats, setCompletedTripStats] = useState<any>(null);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Driver Welcome Banner */}
      <div className="glass-card p-5 border-slate-700/80 bg-gradient-to-r from-slate-900 via-slate-900 to-brand-950/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-emerald-500/20">
            {user?.displayName?.[0]?.toUpperCase() ?? 'D'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Driver Console</h1>
              <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active on Duty
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Welcome, <span className="text-slate-200 font-semibold">{user?.displayName ?? 'Karthik Raja'}</span> | Mobile: +91 98765 43210
            </p>
          </div>
        </div>

        {/* Manager Quick Dispatch Support */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCallModalOpen(true)}
            className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-2 text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700"
            title="Start In-App VoIP Call with Manager"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>In-App Call</span>
          </button>
          <button
            onClick={() => setIsChatModalOpen(true)}
            className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-2 text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700"
            title="Open Live Chat Thread"
          >
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span>Chat Manager</span>
          </button>
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

          {/* Assigned Tasks from Owner / Manager */}
          <div className="glass-card p-5 border-slate-700/80">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Assigned Tasks from Owner
            </h2>

            <div className="space-y-3">
              <div
                onClick={() => setActiveTask('pick_and_drop')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  activeTask === 'pick_and_drop'
                    ? 'bg-brand-500/10 border-brand-500/40 text-white'
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-white">✈️ Airport Pick & Drop</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                    ₹650 Fare
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Pickup: T2 Arrival, Terminal 2 → Destination: OMR IT Park (4 Passengers)
                </p>
              </div>

              <div
                onClick={() => setActiveTask('outstation')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  activeTask === 'outstation'
                    ? 'bg-purple-500/10 border-purple-500/40 text-white'
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-white">🛣️ Outstation Trip (Puducherry)</span>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono">
                    ₹3,400 Fare
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Round trip 310 km | Tolls paid by guest | Stay overnight allowance ₹500
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Free OpenStreetMap GPS Trip Tracker */}
        <div className="lg:col-span-2 space-y-6">
          <GpsTripTracker
            vehicleRegistration={vehicle.registrationNumber}
            driverName={user?.displayName ?? 'Karthik Raja'}
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
              <p className="text-[11px] text-slate-400 mt-3">
                Telemetry log automatically uploaded to FleetWise central database for Owner audit.
              </p>
            </div>
          )}
        </div>
      </div>

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
        driverName={user?.displayName || 'Karthik Raja'}
      />

      {/* In-App Voice Call Modal */}
      <InAppCallModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        callerName="Fleet Manager (Kishore)"
        callerRole="Dispatch & Telemetry Control"
      />
    </div>
  );
}
