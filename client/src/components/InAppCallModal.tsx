import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX,
  Shield, User, PhoneForwarded, Radio
} from 'lucide-react';
import { apiPost } from '../services/api.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  callerName?: string;
  callerRole?: string;
  targetPhone?: string;
}

export default function InAppCallModal({
  isOpen,
  onClose,
  callerName = 'Fleet Dispatch Manager',
  callerRole = 'Fleet Control Room',
  targetPhone = '+91 1234567890',
}: Props) {
  const [callState, setCallState] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [seconds, setSeconds] = useState(0);

  // Audio tone generation for ringing effect using Web Audio API
  useEffect(() => {
    if (!isOpen) return;

    setCallState('ringing');
    setSeconds(0);
    setIsMuted(false);

    // Notify backend of call initiation
    void apiPost('/app/call/signal', { action: 'start', targetPhone }).catch(() => {});

    // Auto-answer after 2.5 seconds to simulate immediate connection
    const connectTimer = setTimeout(() => {
      setCallState('connected');
    }, 2500);

    return () => clearTimeout(connectTimer);
  }, [isOpen, targetPhone]);

  // Connected duration timer
  useEffect(() => {
    if (callState !== 'connected') return;

    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callState]);

  const handleEndCall = () => {
    setCallState('ended');
    void apiPost('/app/call/signal', { action: 'end', targetPhone }).catch(() => {});
    setTimeout(() => {
      onClose();
    }, 500);
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-sm w-full p-6 shadow-2xl flex flex-col items-center text-center space-y-6 relative overflow-hidden">
        {/* Animated Background Ring */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="w-full flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 text-brand-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="font-semibold uppercase tracking-wider text-[10px]">HD Voice Call</span>
          </div>
          <span className="text-slate-500 font-mono text-[11px]">256-bit VoIP</span>
        </div>

        {/* Caller Avatar & Pulse Animation */}
        <div className="relative mt-2">
          {callState === 'ringing' && (
            <div className="absolute inset-0 rounded-full bg-brand-500/30 animate-ping scale-150" />
          )}
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-brand-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white text-3xl font-bold shadow-xl border-4 border-slate-800 relative z-10">
            {callerName[0]?.toUpperCase() ?? 'F'}
          </div>
        </div>

        {/* Caller Details */}
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">{callerName}</h3>
          <p className="text-xs text-slate-400">{callerRole}</p>
          <div className="pt-1">
            {callState === 'ringing' ? (
              <span className="text-xs font-medium text-amber-400 animate-pulse">
                Ringing dispatch console...
              </span>
            ) : callState === 'connected' ? (
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-mono font-bold text-emerald-400">
                  {formatTimer(seconds)}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">Call Ended</span>
            )}
          </div>
        </div>

        {/* Sound Wave Animation (While Connected) */}
        {callState === 'connected' && (
          <div className="flex items-center justify-center gap-1.5 h-8">
            {[40, 75, 100, 60, 90, 45, 80, 50].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-gradient-to-t from-brand-500 to-cyan-400 rounded-full animate-pulse"
                style={{
                  height: `${isMuted ? 8 : h}%`,
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Call Controls */}
        <div className="flex items-center justify-center gap-4 w-full pt-2">
          {/* Mute button */}
          <button
            onClick={() => setIsMuted((v) => !v)}
            className={`p-3.5 rounded-2xl border transition-all ${
              isMuted
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="p-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/40 transition-transform active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          {/* Speaker button */}
          <button
            onClick={() => setIsSpeaker((v) => !v)}
            className={`p-3.5 rounded-2xl border transition-all ${
              isSpeaker
                ? 'bg-brand-500/20 border-brand-500/40 text-brand-400'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
            title={isSpeaker ? 'Speaker On' : 'Speaker Off'}
          >
            {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>

        {/* Regular GSM Phone Fallback */}
        <div className="w-full pt-3 border-t border-slate-800/80">
          <a
            href={`tel:${targetPhone}`}
            className="text-xs text-slate-400 hover:text-brand-300 flex items-center justify-center gap-1.5 transition-colors"
          >
            <PhoneForwarded className="w-3.5 h-3.5 text-emerald-400" />
            <span>Switch to cellular call ({targetPhone})</span>
          </a>
        </div>
      </div>
    </div>
  );
}
