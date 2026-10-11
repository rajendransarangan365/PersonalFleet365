import React, { useState, useEffect } from 'react';
import {
  X, Sparkles, Download, CheckCircle2, RefreshCw, ExternalLink,
  Smartphone, ShieldAlert, Cpu, ArrowUpRight, Zap, Check
} from 'lucide-react';
import {
  type VersionInfo,
  getVersionInfo,
  CURRENT_CLIENT_VERSION,
  CURRENT_BUILD_NUMBER,
  isAndroidApp,
  markChangelogSeen,
  compareVersions
} from '../services/version.service.js';

interface VersionUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoCheckOnOpen?: boolean;
}

export default function VersionUpdateModal({
  isOpen,
  onClose,
  autoCheckOnOpen = false,
}: VersionUpdateModalProps) {
  const [loading, setLoading] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);
  const [checkStatusMessage, setCheckStatusMessage] = useState<string | null>(null);

  const fetchUpdates = async (isManual = false) => {
    setLoading(true);
    setCheckStatusMessage(null);
    try {
      const data = await getVersionInfo();
      setVersionInfo(data);
      if (isManual) {
        const isNewer = compareVersions(data.latestVersion || data.version, CURRENT_CLIENT_VERSION) > 0;
        if (isNewer) {
          setCheckStatusMessage(`New version v${data.latestVersion} is available!`);
        } else {
          setCheckStatusMessage('You are running the latest version of FleetWise.');
        }
      }
    } catch {
      setCheckStatusMessage('Unable to reach update server. Showing offline changelog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      markChangelogSeen(CURRENT_CLIENT_VERSION);
      if (!versionInfo || autoCheckOnOpen) {
        fetchUpdates(false);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentChangelog = versionInfo?.changelog?.[selectedVersionIndex] || versionInfo?.changelog?.[0];
  const isRunningOnMobile = isAndroidApp();
  const hasNewerVersion = versionInfo
    ? compareVersions(versionInfo.latestVersion || versionInfo.version, CURRENT_CLIENT_VERSION) > 0
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-in">
        {/* Header with gradient bar */}
        <div className="h-1.5 bg-gradient-to-r from-brand-500 via-cyan-500 to-indigo-500 w-full" />

        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/20 to-cyan-500/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0 text-brand-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  What's New in FleetWise
                </h2>
                <span className="badge badge-info text-[11px] font-mono">
                  v{CURRENT_CLIENT_VERSION}
                </span>
                {isRunningOnMobile && (
                  <span className="badge badge-success text-[10px] flex items-center gap-1">
                    <Smartphone className="w-3 h-3" /> Android APK
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Changelog, system improvements, and APK update manager
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status & Update Banner */}
        <div className="bg-slate-950/60 px-6 py-3 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            {hasNewerVersion ? (
              <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                <ArrowUpRight className="w-4 h-4" />
                Update Available: v{versionInfo?.latestVersion}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Up to date: v{CURRENT_CLIENT_VERSION}
              </span>
            )}
            {checkStatusMessage && (
              <span className="text-slate-400 border-l border-slate-700 pl-2">
                {checkStatusMessage}
              </span>
            )}
          </div>

          <button
            onClick={() => fetchUpdates(true)}
            disabled={loading}
            className="btn-ghost text-xs py-1 px-2.5 flex items-center gap-1.5 hover:text-brand-400"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : ''}`} />
            {loading ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Release Title & Highlights */}
          {currentChangelog && (
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-brand-400" />
                  {currentChangelog.title}
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  {currentChangelog.date}
                </span>
              </div>
              {currentChangelog.highlights && (
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentChangelog.highlights}
                </p>
              )}
            </div>
          )}

          {/* Categorized Improvements */}
          {currentChangelog?.categories && (
            <div className="space-y-4">
              {/* Features */}
              {currentChangelog.categories.features?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> New Features & Intelligence
                  </h4>
                  <ul className="space-y-1.5">
                    {currentChangelog.categories.features.map((item, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-brand-400 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mobile / APK Improvements */}
              {currentChangelog.categories.mobile?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5" /> Mobile App & Standalone APK
                  </h4>
                  <ul className="space-y-1.5">
                    {currentChangelog.categories.mobile.map((item, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Performance & Improvements */}
              {currentChangelog.categories.improvements?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" /> System & Engine Enhancements
                  </h4>
                  <ul className="space-y-1.5">
                    {currentChangelog.categories.improvements.map((item, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Fixes */}
              {currentChangelog.categories.fixes?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" /> Bug Fixes & Refinements
                  </h4>
                  <ul className="space-y-1.5">
                    {currentChangelog.categories.fixes.map((item, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            Build #{versionInfo?.buildNumber || CURRENT_BUILD_NUMBER} • Git Tagged
          </div>

          <div className="flex items-center gap-2.5">
            {versionInfo?.apkDownloadUrl && (
              <a
                href={versionInfo.apkDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download Standalone APK
              </a>
            )}

            {versionInfo?.githubReleaseUrl && (
              <a
                href={versionInfo.githubReleaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Releases
              </a>
            )}

            <button
              onClick={onClose}
              className="btn-ghost text-xs py-2 px-3"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
