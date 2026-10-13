import React, { useState } from 'react';
import {
  X, User, Mail, Phone, Shield, Building, KeyRound,
  LogOut, Check, Sparkles, Navigation, Car, Crown,
  Briefcase, Headphones, ExternalLink, ShieldCheck
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.js';
import { useNavigate } from 'react-router-dom';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPasswordChange?: () => void;
}

const PERSONA_OPTIONS = [
  {
    role: 'fleet_owner',
    name: 'Sarangan (Company Owner)',
    email: 'sarangan365@gmail.com',
    badge: '👑 Company Owner',
    target: '/dashboard',
    color: 'from-amber-600 via-brand-600 to-indigo-600',
    description: 'Full access to all 12 modules, staff management & finance',
  },
  {
    role: 'fleet_manager',
    name: 'Kishore M. (Operations Manager)',
    email: 'manager@fleetwise.in',
    badge: '💼 Operations Manager',
    target: '/dashboard',
    color: 'from-purple-600 to-indigo-500',
    description: 'Vehicle maintenance, trip dispatch & driver duty monitoring',
  },
  {
    role: 'driver',
    name: 'Karthik Raja',
    email: 'driver@fleetwise.in',
    badge: '🚕 Duty Driver (TN01BV4589)',
    target: '/driver-portal',
    color: 'from-emerald-600 to-teal-500',
    description: 'Driver Console, live trip GPS tracking & passenger rides',
  },
  {
    role: 'customer',
    name: 'Ananya Sharma',
    email: 'customer@fleetwise.in',
    badge: '👤 Passenger Ride Account',
    target: '/bookings',
    color: 'from-amber-500 to-orange-500',
    description: 'Taxi booking portal, ride OTP & digital receipts',
  },
  {
    role: 'telecaller',
    name: 'Fleet 365 24x7 Helpline Support',
    email: 'telecaller@fleetwise.in',
    badge: '🎧 Dispatch Telecaller',
    target: '/taxi-bookings',
    color: 'from-cyan-600 to-blue-500',
    description: 'Customer dispute resolution & driver dispatch helpline',
  },
];

export default function UserProfileModal({
  isOpen,
  onClose,
  onOpenPasswordChange,
}: UserProfileModalProps) {
  const navigate = useNavigate();
  const { user, activeBusinessId, setTokenAndUser, logout } = useAuthStore();
  const [copiedEmail, setCopiedEmail] = useState(false);

  if (!isOpen) return null;

  const userRole = (user as any)?.role || 'fleet_owner';
  const displayName = user?.displayName || 'Fleet User';
  const email = user?.email || 'user@fleetwise.in';
  const phone = (user as any)?.phone || '+91 98410 11223';

  const handleSwitchPersona = (p: typeof PERSONA_OPTIONS[0]) => {
    setTokenAndUser('demo_jwt_token_' + p.role, {
      id: `usr_${p.role}_01`,
      email: p.email,
      displayName: p.name,
      role: p.role as any,
      isActive: true,
      emailVerified: true,
    } as any, [
      { businessId: activeBusinessId || 'biz_01', role: p.role, permissions: [] },
    ]);

    setTimeout(async () => {
      const { registerCurrentUser } = await import('../services/socket.client.js');
      registerCurrentUser();
    }, 100);

    onClose();
    navigate(p.target);
  };

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/auth/signin');
  };

  const getRoleHeaderBadge = () => {
    switch (userRole) {
      case 'driver':
        return { label: 'Duty Driver', icon: Navigation, bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case 'customer':
        return { label: 'Passenger Customer', icon: Car, bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
      case 'telecaller':
      case 'support':
        return { label: 'Helpline Telecaller', icon: Headphones, bg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };
      case 'fleet_manager':
      case 'operations_manager':
        return { label: 'Operations Manager', icon: Briefcase, bg: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
      case 'fleet_owner':
      case 'business_owner':
      default:
        return { label: 'Fleet Owner (Admin)', icon: Crown, bg: 'bg-brand-500/20 text-brand-300 border-brand-500/30' };
    }
  };

  const roleMeta = getRoleHeaderBadge();
  const RoleIcon = roleMeta.icon;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">User Account & Profile</h3>
              <p className="text-xs text-slate-400">Authenticated Fleet OS Identity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Identity Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/80 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white text-2xl font-black shadow-xl border-2 border-slate-700 flex-shrink-0">
              {displayName[0]?.toUpperCase() ?? 'U'}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-white text-base truncate">{displayName}</h4>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleMeta.bg}`}>
                  <RoleIcon className="w-3 h-3" />
                  <span>{roleMeta.label}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>{email}</span>
              </p>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>{phone}</span>
              </p>
            </div>
          </div>

          {/* Account Details Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Role Boundary</span>
              <span className="font-semibold text-slate-200 capitalize">{userRole.replace('_', ' ')}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Access Scope</span>
              <span className="font-semibold text-emerald-400">
                {userRole === 'fleet_owner' ? 'All 12 Modules (Full OS)' : userRole === 'driver' ? 'Driver Console Only' : userRole === 'customer' ? 'Customer Rides Only' : 'Assigned Role Scope'}
              </span>
            </div>
          </div>

          {/* Security & Password Action */}
          <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <div>
                <p className="text-xs font-bold text-white">Security & Password</p>
                <p className="text-[11px] text-slate-400">Update account credentials</p>
              </div>
            </div>
            {onOpenPasswordChange && (
              <button
                onClick={() => {
                  onClose();
                  onOpenPasswordChange();
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200 transition-colors"
              >
                Change Password
              </button>
            )}
          </div>

          {/* Fast Switch Role (For Live Pair Testing) */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                Switch Persona & Role
              </span>
              <span className="text-[10px] text-slate-500">1-Click Live Role Test</span>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {PERSONA_OPTIONS.map((p) => {
                const isActive = userRole === p.role;
                return (
                  <button
                    key={p.role}
                    onClick={() => handleSwitchPersona(p)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isActive
                        ? 'bg-brand-500/20 border-brand-500/50 shadow-sm'
                        : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{p.badge}</span>
                        {isActive && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{p.description}</p>
                    </div>
                    {isActive ? (
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 ml-2" />
                    ) : (
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Close
          </button>

          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
