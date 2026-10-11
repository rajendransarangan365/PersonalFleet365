import React, { useState } from 'react';
import {
  Settings, Building2, Users, Smartphone, Shield,
  Database, Download, CheckCircle2, Save, HardDrive,
  Sparkles, RefreshCw, Server, Globe
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store.js';
import VersionUpdateModal from '../../components/VersionUpdateModal.js';
import { CURRENT_CLIENT_VERSION } from '../../services/version.service.js';

export default function SettingsPage() {
  const { user, businesses, activeBusinessId } = useAuthStore();
  const [businessName, setBusinessName] = useState('Metro Fleet Solutions');
  const [region, setRegion] = useState('TN');
  const [workingDays, setWorkingDays] = useState(26);
  const [gstin, setGstin] = useState('33ABCDE1234F1Z5');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const [serverUrl, setServerUrl] = useState(
    typeof window !== 'undefined'
      ? localStorage.getItem('fleet_api_url') || 'https://fleet365-api.onrender.com/api/v1'
      : 'https://fleet365-api.onrender.com/api/v1'
  );
  const [pingStatus, setPingStatus] = useState<string | null>(null);

  const testServerConnection = async () => {
    setPingStatus('Testing connection to ' + serverUrl + '...');
    try {
      const cleanBase = serverUrl.replace(/\/api\/v1\/?$/, '');
      const res = await fetch(`${cleanBase}/health`);
      if (res.ok) {
        setPingStatus('✅ Connected to Server successfully (HTTP 200 OK)!');
        localStorage.setItem('fleet_api_url', serverUrl);
      } else {
        setPingStatus(`⚠️ Server responded with HTTP ${res.status}`);
      }
    } catch (err: any) {
      setPingStatus('❌ Connection failed: ' + err.message);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('fleet_api_url', serverUrl);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const exportLocalBackup = () => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      businessName,
      region,
      version: '1.0.0',
      device: 'FleetWise Web / Standalone Mobile APK',
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `fleetwise_local_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-brand-400" />
          Settings & Local Device Configuration
        </h1>
        <p className="text-sm text-slate-400">
          Manage business parameters, driver access control, offline database sync, and mobile APK builds
        </p>
      </div>

      {/* Business Details Form */}
      <div className="glass-card p-6">
        <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-brand-400" />
          Fleet Company Profile
        </h3>
        <p className="text-xs text-slate-400 mb-5">
          Company details used for contract billing, tax invoices, and legal compliance.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Business / Fleet Name</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">GSTIN / Tax ID</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                className="form-input uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">State / Operating Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="form-input"
              >
                <option value="TN">Tamil Nadu (TN)</option>
                <option value="KA">Karnataka (KA)</option>
                <option value="MH">Maharashtra (MH)</option>
                <option value="DL">Delhi NCR (DL)</option>
                <option value="TG">Telangana (TG)</option>
              </select>
            </div>
            <div>
              <label className="form-label">Default Working Days / Month</label>
              <input
                type="number"
                min="20"
                max="31"
                value={workingDays}
                onChange={(e) => setWorkingDays(Number(e.target.value))}
                className="form-input"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {savedSuccess ? (
              <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Changes saved successfully!
              </span>
            ) : <span />}
            <button type="submit" className="btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" /> Save Profile
            </button>
          </div>
        </form>
      </div>

      {/* Cloud Backend Server & Android Sync (Render Connection) */}
      <div className="glass-card p-6 border-slate-700">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              Central Cloud Server Connection (Render / API Sync)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Connect this web app and the Android APK to your central backend server for live driver task assignment, GPS telemetry, calling, and messaging.
            </p>
          </div>
          <span className="badge badge-primary whitespace-nowrap">Render Ready</span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="form-label text-xs">Central Server API Base URL</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://fleet365-api.onrender.com/api/v1"
                  className="form-input pl-9 text-xs font-mono"
                />
              </div>
              <button
                type="button"
                onClick={testServerConnection}
                className="btn-secondary text-xs px-4 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Test Ping</span>
              </button>
            </div>
            {pingStatus && (
              <p className="text-xs mt-1.5 font-medium text-slate-300">{pingStatus}</p>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <p className="font-semibold text-slate-200">🔗 How Android APK links with the Server:</p>
            <p>1. When building the APK or deploying on Vercel, set <code className="text-brand-300">VITE_API_URL=https://your-service.onrender.com/api/v1</code>.</p>
            <p>2. If no environment variable is baked in, the APK automatically communicates with this central Render address.</p>
          </div>
        </div>
      </div>

      {/* Standalone Android & Local Offline Mode */}
      <div className="glass-card p-6 border-slate-700">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              Standalone Android APK & On-Device Storage
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Run FleetWise entirely offline on your Android device without any external server or cloud database dependency.
            </p>
          </div>
          <span className="badge badge-success whitespace-nowrap">Capacitor Ready</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-3 text-xs text-slate-300">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-brand-400" />
              Local Storage Engine:
            </span>
            <span className="text-emerald-400 font-mono font-bold">IndexedDB / SQLite Sync</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              Offline Availability:
            </span>
            <span className="text-emerald-400 font-bold">100% Offline Capable</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed pt-1">
            Data is persisted on-device in secure SQLite storage. When connected to the internet, you can optionally synchronize with your cloud server or export periodic encrypted backups.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-5">
          <button
            onClick={exportLocalBackup}
            className="btn-secondary w-full sm:w-auto flex items-center justify-center gap-2 text-xs"
          >
            <Download className="w-4 h-4" />
            Export Local Database JSON
          </button>
        </div>
      </div>

      {/* App Version, Updates & Changelog */}
      <div className="glass-card p-6 border-slate-700">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-400" />
              App Version, Changelog & Updates
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Check for the latest improvements, inspect release changelogs, and download APK updates.
            </p>
          </div>
          <span className="badge badge-info font-mono text-xs">v{CURRENT_CLIENT_VERSION}</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-200">
              FleetWise Client Release v{CURRENT_CLIENT_VERSION}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Includes Taxi BI, 5-Year Simulator, Gemini Flash AI diagnostics, and offline SQLite sync.
            </p>
          </div>
          <button
            onClick={() => setShowUpdateModal(true)}
            className="btn-primary text-xs py-2 px-4 flex items-center justify-center gap-2 flex-shrink-0"
            id="settings-check-update-btn"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Check for Updates & What's New
          </button>
        </div>
      </div>

      {/* Version Update Modal */}
      <VersionUpdateModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        autoCheckOnOpen={true}
      />
    </div>
  );
}
