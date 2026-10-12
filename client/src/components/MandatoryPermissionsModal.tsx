import React, { useState, useEffect } from 'react';
import {
  Mic, MapPin, Bell, Camera, ShieldCheck, AlertCircle, CheckCircle2,
  Lock, X, Sparkles, RefreshCw, ChevronRight, Smartphone, Shield
} from 'lucide-react';
import {
  checkFleetPermissions,
  requestMicrophone,
  requestLocation,
  requestNotification,
  requestCamera,
  requestAllFleetPermissions,
  subscribeToFleetPermissions,
  type FleetPermissionsState,
  type PermissionStateStatus
} from '../services/permissions.service.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isMandatoryPrompt?: boolean;
}

export default function MandatoryPermissionsModal({
  isOpen,
  onClose,
  isMandatoryPrompt = false,
}: Props) {
  const [permissions, setPermissions] = useState<FleetPermissionsState>({
    microphone: 'prompt',
    location: 'prompt',
    notification: 'prompt',
    camera: 'prompt',
    lastChecked: 0,
    allGranted: false,
  });

  const [requestingItem, setRequestingItem] = useState<string | null>(null);
  const [isRequestingAll, setIsRequestingAll] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void checkFleetPermissions();
    }

    const unsubscribe = subscribeToFleetPermissions((state) => {
      setPermissions(state);
    });

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGrantAll = async () => {
    setIsRequestingAll(true);
    try {
      await requestAllFleetPermissions();
    } finally {
      setIsRequestingAll(false);
    }
  };

  const handleGrantSingle = async (key: 'microphone' | 'location' | 'notification' | 'camera') => {
    setRequestingItem(key);
    try {
      if (key === 'microphone') await requestMicrophone();
      if (key === 'location') await requestLocation();
      if (key === 'notification') await requestNotification();
      if (key === 'camera') await requestCamera();
      await checkFleetPermissions();
    } finally {
      setRequestingItem(null);
    }
  };

  const getStatusBadge = (status: PermissionStateStatus) => {
    switch (status) {
      case 'granted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Granted</span>
          </span>
        );
      case 'denied':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Blocked</span>
          </span>
        );
      case 'unsupported':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <span>Unsupported</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
            <span>Action Required</span>
          </span>
        );
    }
  };

  const countGranted = [
    permissions.microphone,
    permissions.location,
    permissions.notification,
    permissions.camera,
  ].filter((s) => s === 'granted').length;

  const isAndroid = typeof window !== 'undefined' && Boolean(
    (window as any).Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' ||
    navigator.userAgent.toLowerCase().includes('android')
  );

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl flex flex-col space-y-5 relative overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-brand-400">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Fleet Operating System Permissions
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Mandatory Device Permissions
            </h2>
            <p className="text-xs text-slate-400">
              {isAndroid
                ? 'Required for Android APK background ringing, driver GPS tracking, and HD VoIP calls.'
                : 'Grant browser permissions to enable real-time VoIP audio calls, GPS ride dispatch, and alerts.'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0"
            title="Close / Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 relative z-10 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <span>Permission Status</span>
              <span className="text-brand-400 font-mono font-bold">({countGranted}/4 Allowed)</span>
            </span>
            <span className={`text-[11px] font-bold ${countGranted === 4 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {countGranted === 4 ? 'Ready for Full Fleet Operations' : 'Setup Incomplete'}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 via-cyan-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${(countGranted / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Permission Item Cards */}
        <div className="space-y-3 relative z-10">
          {/* 1. Microphone */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex-shrink-0 mt-0.5">
                <Mic className="w-5 h-5 text-brand-400" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">Microphone (HD Voice Calls)</h4>
                  {getStatusBadge(permissions.microphone)}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Required for crystal-clear two-way In-App VoIP audio calling between Owner, Driver Karthik Raja, and Customers.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end flex-shrink-0">
              {permissions.microphone !== 'granted' ? (
                <button
                  onClick={() => void handleGrantSingle('microphone')}
                  disabled={requestingItem === 'microphone'}
                  className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  {requestingItem === 'microphone' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>Allow Mic</span>
                </button>
              ) : (
                <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Active
                </span>
              )}
            </div>
          </div>

          {/* 2. Geolocation / Location */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex-shrink-0 mt-0.5">
                <MapPin className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">GPS Location (Taxi Dispatch)</h4>
                  {getStatusBadge(permissions.location)}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Required for real-time Ola/Uber passenger pickup calculation, driver navigation, and vehicle location telemetry.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end flex-shrink-0">
              {permissions.location !== 'granted' ? (
                <button
                  onClick={() => void handleGrantSingle('location')}
                  disabled={requestingItem === 'location'}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  {requestingItem === 'location' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                  <span>Allow GPS</span>
                </button>
              ) : (
                <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Active
                </span>
              )}
            </div>
          </div>

          {/* 3. Push Notifications */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex-shrink-0 mt-0.5">
                <Bell className="w-5 h-5 text-amber-400" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">Notifications (Ringers & Alerts)</h4>
                  {getStatusBadge(permissions.notification)}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Required to ring your phone for incoming calls, intimate owner when driver goes offline, and notify taxi ride bookings.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end flex-shrink-0">
              {permissions.notification !== 'granted' ? (
                <button
                  onClick={() => void handleGrantSingle('notification')}
                  disabled={requestingItem === 'notification'}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  {requestingItem === 'notification' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                  <span>Allow Alerts</span>
                </button>
              ) : (
                <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Active
                </span>
              )}
            </div>
          </div>

          {/* 4. Camera & File Media Access */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex-shrink-0 mt-0.5">
                <Camera className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">Camera & File Media Access</h4>
                  {getStatusBadge(permissions.camera)}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Required for uploading vehicle condition inspection photos, odometer meter proof, and customer dispute attachments.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end flex-shrink-0">
              {permissions.camera !== 'granted' ? (
                <button
                  onClick={() => void handleGrantSingle('camera')}
                  disabled={requestingItem === 'camera'}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  {requestingItem === 'camera' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  <span>Allow Camera</span>
                </button>
              ) : (
                <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Browser / Android Settings Advice if Blocked */}
        {(permissions.microphone === 'denied' ||
          permissions.location === 'denied' ||
          permissions.notification === 'denied' ||
          permissions.camera === 'denied') && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <Lock className="w-4 h-4" />
              <span>Permission Blocked in Browser / System Settings</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              One or more permissions were previously blocked. To enable them:
              <br />
              <b>In Chrome/Edge</b>: Click the tune/lock icon 🔒 on the left side of the address bar URL, set permissions to <b>Allow</b>, and refresh the page.
              <br />
              <b>In Android Phone</b>: Open <i>Settings ➔ Apps ➔ FleetWise ➔ Permissions</i> and toggle on Microphone, Location, Notifications & Camera.
            </p>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800 relative z-10">
          <button
            onClick={() => void checkFleetPermissions()}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 py-2 px-3 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-Check Status</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {countGranted < 4 ? (
              <button
                onClick={handleGrantAll}
                disabled={isRequestingAll}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white text-xs font-bold shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                {isRequestingAll ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Prompting Device Permissions...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Grant All 4 Permissions (1-Click)</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>All Permissions Active — Continue</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
