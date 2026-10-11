import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle, Server, ExternalLink } from 'lucide-react';
import { getApiBaseUrl, getServerHostUrl } from '../services/api.js';

export type ServerStatus = 'connected' | 'checking' | 'disconnected';

export default function ServerStatusIndicator() {
  const [status, setStatus] = useState<ServerStatus>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState(() => localStorage.getItem('fleet_api_url') || '');

  const checkConnection = useCallback(async () => {
    setStatus('checking');
    const start = performance.now();
    const base = getApiBaseUrl();
    const healthUrl = base.endsWith('/api/v1') ? `${base.replace(/\/api\/v1$/, '')}/health` : `${base}/health`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
      }).catch(async () => {
        // Fallback check to /api/v1/app/version if /health is not exposed directly
        return await fetch(`${base}/app/version`, { signal: controller.signal });
      });

      clearTimeout(timeoutId);

      if (res && res.ok) {
        const ping = Math.round(performance.now() - start);
        setLatency(ping);
        setStatus('connected');
        setLastChecked(new Date());
      } else {
        setStatus('disconnected');
        setLatency(null);
      }
    } catch {
      setStatus('disconnected');
      setLatency(null);
    }
  }, []);

  useEffect(() => {
    void checkConnection();
    const interval = setInterval(checkConnection, 15_000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  const handleSaveCustomUrl = () => {
    if (customUrl.trim()) {
      localStorage.setItem('fleet_api_url', customUrl.trim());
    } else {
      localStorage.removeItem('fleet_api_url');
    }
    window.location.reload();
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-mono font-medium transition-all"
        title="Check Server Connection & API Status"
        id="server-status-pill"
      >
        {status === 'connected' ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-emerald-400 font-sans font-semibold">Live</span>
            {latency !== null && <span className="text-slate-400 text-[11px] hidden sm:inline">({latency}ms)</span>}
          </>
        ) : status === 'checking' ? (
          <>
            <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
            <span className="text-amber-400 font-sans font-medium">Connecting...</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-rose-400 font-sans font-medium">Offline</span>
          </>
        )}
      </button>

      {/* Diagnostics / Server Config Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-brand-400" />
                <h3 className="text-base font-bold text-white">Central Server Connectivity</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Current State Summary */}
            <div className={`p-4 rounded-xl border flex items-center gap-3 ${
              status === 'connected'
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                : status === 'checking'
                ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
            }`}>
              {status === 'connected' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
              ) : status === 'checking' ? (
                <RefreshCw className="w-6 h-6 text-amber-400 flex-shrink-0 animate-spin" />
              ) : (
                <AlertCircle className="w-6 h-6 text-rose-400 flex-shrink-0" />
              )}
              <div>
                <p className="font-semibold text-sm">
                  {status === 'connected'
                    ? 'Connected to FleetWise API'
                    : status === 'checking'
                    ? 'Connecting to Server...'
                    : 'Backend Server Unreachable'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {status === 'connected'
                    ? `Ping: ${latency}ms latency | Real-time chat & calls active`
                    : 'Make sure your Render backend has finished starting up.'}
                </p>
              </div>
            </div>

            {/* Target Backend Endpoint */}
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-400 font-medium">Active API Endpoint:</label>
              <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-mono break-all flex items-center justify-between">
                <span>{getApiBaseUrl()}</span>
                {getApiBaseUrl().startsWith('http') && (
                  <a
                    href={`${getApiBaseUrl().replace(/\/api\/v1$/, '')}/health`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-400 hover:text-brand-300 ml-2"
                    title="Open Health in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Custom Backend URL Override */}
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-400 font-medium">
                Change API URL (Optional, for Local/Self-Hosted testing):
              </label>
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="e.g. https://fleet365-api.onrender.com/api/v1"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => { void checkConnection(); }}
                className="btn-secondary text-xs flex items-center gap-1 px-3 py-2 text-slate-300 hover:text-white"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Test Ping Now</span>
              </button>
              <button
                onClick={handleSaveCustomUrl}
                className="btn-primary text-xs px-4 py-2"
              >
                Save & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
