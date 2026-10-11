import React, { useState, useEffect } from 'react';
import { Sparkles, X, ArrowRight, Smartphone } from 'lucide-react';
import {
  CURRENT_CLIENT_VERSION,
  hasUnseenChangelog,
  markChangelogSeen,
  isAndroidApp
} from '../services/version.service.js';

interface VersionUpdateToastProps {
  onOpenModal: () => void;
}

export default function VersionUpdateToast({ onOpenModal }: VersionUpdateToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const isMobile = isAndroidApp();

  useEffect(() => {
    // Check after a brief delay so it doesn't distract immediately on first render
    const timer = setTimeout(() => {
      if (hasUnseenChangelog(CURRENT_CLIENT_VERSION)) {
        setIsVisible(true);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    markChangelogSeen(CURRENT_CLIENT_VERSION);
  };

  const handleView = () => {
    setIsVisible(false);
    markChangelogSeen(CURRENT_CLIENT_VERSION);
    onOpenModal();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 z-40 max-w-sm w-full animate-slide-in">
      <div className="p-4 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-brand-500/30 shadow-2xl shadow-brand-500/10 text-white relative overflow-hidden">
        {/* Subtle accent glow */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0 text-brand-400">
            <Sparkles className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-bold text-white tracking-tight">
                FleetWise v{CURRENT_CLIENT_VERSION}
              </span>
              <span className="badge badge-info text-[9px] py-0 px-1.5 font-mono">
                {isMobile ? 'APK Live' : "What's New"}
              </span>
            </div>
            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
              New release available with AI diagnostics, offline local database sync, and profit simulator improvements.
            </p>
          </div>

          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3.5 flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={handleDismiss}
            className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1"
          >
            Later
          </button>
          <button
            onClick={handleView}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <span>View Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
