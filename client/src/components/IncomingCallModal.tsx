import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Radio, Shield, Car, User } from 'lucide-react';
import { callSignaling, type CallSession } from '../services/callSignaling.js';

interface Props {
  onAccept: (session: CallSession) => void;
}

export default function IncomingCallModal({ onAccept }: Props) {
  const [session, setSession] = useState<CallSession | null>(null);

  useEffect(() => {
    const unsubscribe = callSignaling.subscribe((current) => {
      if (current && current.status === 'incoming') {
        setSession(current);
      } else {
        setSession(null);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!session) return null;

  const handleAnswer = () => {
    callSignaling.acceptCall();
    onAccept(session);
  };

  const handleDecline = () => {
    callSignaling.rejectCall();
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-3xl max-w-sm w-full p-6 shadow-2xl flex flex-col items-center text-center space-y-6 relative overflow-hidden">
        {/* Animated Radial Waves */}
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-20 -left-20 w-52 h-52 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

        {/* Incoming Header */}
        <div className="w-full flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Radio className="w-4 h-4 animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-[11px]">
              Incoming Fleet Call
            </span>
          </div>
          <span className="text-slate-500 font-mono text-[10px]">VoIP HD Voice</span>
        </div>

        {/* Caller Avatar with Triple Ring Pulse */}
        <div className="relative my-2">
          <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping scale-150" />
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping scale-125" style={{ animationDelay: '0.4s' }} />
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 flex items-center justify-center text-white text-3xl font-extrabold shadow-2xl border-4 border-slate-800 relative z-10">
            {session.callerName[0]?.toUpperCase() ?? 'F'}
          </div>
        </div>

        {/* Caller Details */}
        <div className="space-y-1 z-10">
          <h3 className="text-xl font-black text-white tracking-tight">
            {session.callerName}
          </h3>
          <p className="text-xs text-emerald-400 font-medium capitalize">
            {session.callerRole.replace('_', ' ')}
          </p>

          {session.vehiclePlate && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-brand-300 mt-1">
              <Car className="w-3.5 h-3.5 text-brand-400" />
              <span>{session.vehiclePlate}</span>
            </div>
          )}

          <p className="text-xs text-slate-400 font-mono pt-1">
            {session.callerPhone}
          </p>
          <div className="text-xs text-amber-400 font-medium animate-pulse pt-1">
            Ringing... Click Accept to connect
          </div>
        </div>

        {/* Action Controls: Green ACCEPT & Red DECLINE */}
        <div className="flex items-center justify-around w-full pt-4 border-t border-slate-800/80 z-10">
          {/* Decline / Reject Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={handleDecline}
              className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition-transform active:scale-95"
              title="Decline / Reject Call"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-xs font-semibold text-rose-400">Decline</span>
          </div>

          {/* Accept / Answer Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={handleAnswer}
              className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-xl shadow-emerald-500/50 transition-transform active:scale-95 animate-bounce"
              title="Accept / Answer Call"
            >
              <Phone className="w-7 h-7" />
            </button>
            <span className="text-xs font-semibold text-emerald-400">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
