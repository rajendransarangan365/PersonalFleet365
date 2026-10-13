import React, { useState } from 'react';
import {
  Users, PhoneIncoming, Car, Navigation, Shield, Check,
  Sparkles, Radio, PhoneCall, ChevronUp, ChevronDown
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.js';
import { callSignaling } from '../services/callSignaling.js';
import { useNavigate } from 'react-router-dom';

const DEMO_PERSONAS = [
  {
    id: 'owner-01',
    role: 'fleet_owner',
    name: 'Sarangan (Company Owner)',
    email: 'sarangan365@gmail.com',
    badge: '👑 Company Owner',
    path: '/dashboard',
    color: 'from-amber-500 to-yellow-600',
  },
  {
    id: 'mgr-01',
    role: 'fleet_manager',
    name: 'Kishore (Fleet Manager)',
    email: 'manager@fleetwise.in',
    badge: 'Operations Manager',
    path: '/dashboard',
    color: 'from-purple-500 to-indigo-600',
  },
  {
    id: 'drv-01',
    role: 'driver',
    name: 'Karthik Raja (Driver)',
    email: 'driver@fleetwise.in',
    badge: 'Driver (TN01BV4589)',
    path: '/driver-portal',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'cust-01',
    role: 'customer',
    name: 'Ananya (Customer Ride)',
    email: 'customer@fleetwise.in',
    badge: 'Passenger Portal',
    path: '/customer',
    color: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'tel-01',
    role: 'telecaller',
    name: 'Support & Call Center',
    email: 'support@fleetwise.in',
    badge: 'Support Desk 24x7',
    path: '/taxi-bookings',
    color: 'from-rose-500 to-pink-600',
  },
];

export default function LiveDemoPersonaBar() {
  const { user, setTokenAndUser } = useAuthStore();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSwitchPersona = (p: typeof DEMO_PERSONAS[0]) => {
    setTokenAndUser('demo_jwt_token_' + p.role, {
      id: p.id,
      email: p.email,
      displayName: p.name,
      role: p.role as any,
      isActive: true,
      emailVerified: true,
    } as any, [
      { businessId: 'demo_fleet_biz_01', role: p.role, permissions: [] },
    ]);

    // Force register with common Socket.IO server
    setTimeout(async () => {
      const { registerCurrentUser } = await import('../services/socket.client.js');
      registerCurrentUser();
    }, 100);

    navigate(p.path);
  };

  const handleSimulateIncomingCall = () => {
    const userRole = (user as any)?.role;
    let caller;
    if (userRole === 'driver') {
      caller = {
        name: 'Sarangan (Fleet Owner)',
        role: 'fleet_owner',
        phone: '+91 98410 11223',
      };
    } else if (userRole === 'customer') {
      caller = {
        name: 'Karthik Raja (Your Cab Driver)',
        role: 'driver',
        phone: '+91 98401 23456',
        vehiclePlate: 'TN01BV4589',
      };
    } else {
      caller = {
        name: 'Karthik Raja (Duty Driver)',
        role: 'driver',
        phone: '+91 98401 23456',
        vehiclePlate: 'TN01BV4589',
      };
    }

    callSignaling.triggerIncomingCall(caller);
  };

  return (
    <aside aria-label="Demo Persona Bar" className="fixed bottom-4 right-4 z-50">
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-2.5 max-w-xs sm:max-w-sm w-full transition-all text-xs">
        {/* Bar Header */}
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold text-white tracking-wide text-xs">
              Live Testing Suite
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Test Incoming Call Button */}
            <button
              onClick={handleSimulateIncomingCall}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-transform active:scale-95"
              title="Ring phone now to test Accept & Reject call screen"
            >
              <PhoneIncoming className="w-3.5 h-3.5" />
              <span>Ring Phone</span>
            </button>

            <button
              onClick={() => setIsExpanded((v) => !v)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isExpanded ? 'Collapse Personas' : 'Expand Personas'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expandable Switcher Body */}
        {isExpanded && (
          <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-2">
            <p className="text-[11px] text-slate-400">
              1-Click Switch Persona to test calling, booking & dispatch:
            </p>

            <div className="grid grid-cols-2 gap-1.5">
              {DEMO_PERSONAS.map((p) => {
                const isActive = (user as any)?.role === p.role;
                return (
                  <button
                    key={p.role}
                    onClick={() => handleSwitchPersona(p)}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'bg-brand-500/20 border-brand-500/50 text-white shadow-sm'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-[11px] truncate">{p.name.split(' ')[0]}</span>
                      {isActive && <Check className="w-3 h-3 text-emerald-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">{p.badge}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
