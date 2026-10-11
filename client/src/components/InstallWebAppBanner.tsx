import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, CheckCircle2, Share } from 'lucide-react';
import FleetLogo from './FleetLogo.js';

export default function InstallWebAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    // Check for iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setInstalledSuccess(true);
      setIsInstallable(false);
      setTimeout(() => setIsDismissed(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosGuide(true);
    }
  };

  if (isDismissed) return null;
  if (!isInstallable && !isIos && !installedSuccess) return null;

  return (
    <>
      {/* Floating Bottom Install Banner */}
      <div className="fixed bottom-16 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-slide-in">
        <div className="glass-card p-3.5 sm:p-4 border-brand-500/40 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/80 flex items-center justify-between gap-3">
          {/* Logo & Text */}
          <div className="flex items-center gap-3 min-w-0">
            <FleetLogo size="sm" showText={false} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                  Install Fleet365 Web App
                </h4>
                <span className="text-[9px] bg-brand-500/20 text-brand-300 px-1.5 py-0.5 rounded font-semibold uppercase">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {installedSuccess ? 'App installed successfully!' : 'Fast access & 100% offline-ready'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!installedSuccess ? (
              <button
                onClick={handleInstallClick}
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 font-bold shadow-md shadow-brand-500/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            )}

            <button
              onClick={() => setIsDismissed(true)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Installation Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card p-6 max-w-sm w-full text-center relative border-slate-700">
            <button
              onClick={() => setShowIosGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <FleetLogo size="lg" className="justify-center mb-3" />
            <h3 className="text-base font-bold text-white mb-2">Install Fleet365 on iOS</h3>
            <p className="text-xs text-slate-400 mb-4">
              To install this Web App on your iPhone or iPad home screen:
            </p>
            <div className="p-3 bg-slate-800/80 rounded-xl text-left text-xs space-y-2 text-slate-300 border border-slate-700/60">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-[10px]">1</span>
                <span>Tap the Safari <strong>Share</strong> button <Share className="w-3.5 h-3.5 inline text-brand-400" /></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-[10px]">2</span>
                <span>Scroll down and select <strong>"Add to Home Screen"</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-[10px]">3</span>
                <span>Tap <strong>Add</strong> at the top right</span>
              </div>
            </div>
            <button
              onClick={() => setShowIosGuide(false)}
              className="btn-primary w-full text-xs py-2 mt-4"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
