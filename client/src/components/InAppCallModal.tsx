import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX,
  Radio, AlertTriangle, UserX,
} from 'lucide-react';
import {
  requestMicrophoneAccess,
} from '../utils/audioAlerts.js';
import { callSignaling, type CallSession } from '../services/callSignaling.js';
import { useAuthStore } from '../store/auth.store.js';
import type { FleetContact } from '../store/contacts.store.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetContact?: FleetContact | null;
  contact?: FleetContact | null;
  callerName?: string;
  callerRole?: string;
  targetPhone?: string;
  vehiclePlate?: string;
  isIncomingAnswered?: boolean;
}

export default function InAppCallModal({
  isOpen,
  onClose,
  targetContact,
  contact,
  callerName,
  callerRole,
  targetPhone,
  vehiclePlate,
  isIncomingAnswered = false,
}: Props) {
  const { user } = useAuthStore();
  const myUserId = (user as any)?.id || (user as any)?._id || 'owner-01';
  const myName = user?.displayName || 'Fleet Controller';
  const myRole = (user as any)?.role || 'fleet_owner';

  // Determine target contact and strictly prevent self-calling
  const rawContact = targetContact || contact;
  let resolvedTargetId = rawContact?.id || (callerRole === 'driver' ? 'drv-01' : 'owner-01');
  let resolvedTargetName = rawContact?.name || callerName || 'Sarangan (Fleet Owner)';
  let resolvedTargetRole = rawContact?.role || callerRole || 'fleet_owner';
  let resolvedTargetPhone = rawContact?.phone || targetPhone || '+91 98410 11223';
  let resolvedVehiclePlate = rawContact?.vehiclePlate || vehiclePlate;

  // SAFETY: You cannot call yourself. Auto-route to counterpart based on role.
  if (resolvedTargetId === myUserId || (rawContact && rawContact.id === myUserId)) {
    if (myRole === 'driver') {
      resolvedTargetId = 'owner-01';
      resolvedTargetName = 'Sarangan (Fleet Owner)';
      resolvedTargetRole = 'fleet_owner';
      resolvedTargetPhone = '+91 98410 11223';
      resolvedVehiclePlate = undefined;
    } else if (myRole === 'customer') {
      resolvedTargetId = 'tel-01';
      resolvedTargetName = 'Fleet 365 24x7 Helpline Desk';
      resolvedTargetRole = 'telecaller';
      resolvedTargetPhone = '+91 1800 365 000';
      resolvedVehiclePlate = undefined;
    } else {
      resolvedTargetId = 'drv-01';
      resolvedTargetName = 'Karthik Raja (Driver)';
      resolvedTargetRole = 'driver';
      resolvedTargetPhone = '+91 98401 23456';
      resolvedVehiclePlate = 'TN01BV4589';
    }
  }

  const [callSession, setCallSession] = useState<CallSession | null>(null);
  const [callState, setCallState] = useState<'calling' | 'ringing' | 'connected' | 'rejected' | 'ended' | 'offline' | 'incoming'>(
    isIncomingAnswered ? 'connected' : 'calling'
  );
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [seconds, setSeconds] = useState(0);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);

  // Subscribe to call signaling manager state
  useEffect(() => {
    const unsubscribe = callSignaling.subscribe((session) => {
      setCallSession(session);
      if (session) {
        setCallState(session.status);
      }
    });

    return () => unsubscribe();
  }, []);

  // Initialize Call & Microphone on Launch
  useEffect(() => {
    if (!isOpen) {
      cleanup();
      return;
    }

    const activeSession = callSignaling.getCurrentSession();
    if (isIncomingAnswered || activeSession?.status === 'connected') {
      setCallState('connected');
      initPeerConnection();
      return;
    }

    setSeconds(0);
    setIsMuted(false);
    setCallState('calling');

    // Request microphone access
    const checkMic = async () => {
      const res = await requestMicrophoneAccess();
      if (res.granted && res.stream) {
        setMicGranted(true);
        mediaStreamRef.current = res.stream;
        initPeerConnection();
      } else {
        setMicGranted(false);
      }
    };
    void checkMic();

    // Start outgoing call via signaling manager
    callSignaling.startCall({
      id: resolvedTargetId,
      name: resolvedTargetName,
      role: resolvedTargetRole,
      phone: resolvedTargetPhone,
      vehiclePlate: resolvedVehiclePlate,
    });

    return () => {
      cleanup();
    };
  }, [isOpen, isIncomingAnswered]);

  const initPeerConnection = () => {
    try {
      if (typeof RTCPeerConnection !== 'undefined') {
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        });
        peerConnRef.current = pc;

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => {
            pc.addTrack(track, mediaStreamRef.current!);
          });
        }
      }
    } catch {}
  };

  const cleanup = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (peerConnRef.current) {
      peerConnRef.current.close();
      peerConnRef.current = null;
    }
  };

  // Connected duration timer
  useEffect(() => {
    if (callState !== 'connected') return;

    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callState]);

  const handleEndCall = () => {
    cleanup();
    callSignaling.endCall(seconds);
    setCallState('ended');
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const displayName = callSession?.targetName || resolvedTargetName;
  const displayRole = (callSession?.targetRole || resolvedTargetRole).replace('_', ' ');
  const displayPhone = callSession?.targetPhone || resolvedTargetPhone;
  const displayPlate = callSession?.vehiclePlate || resolvedVehiclePlate;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl flex flex-col items-center text-center space-y-4 relative overflow-hidden">
        {/* Ambient Ringing Glow */}
        <div className={`absolute -top-24 -left-24 w-64 h-64 rounded-full blur-3xl pointer-events-none ${
          callState === 'offline' ? 'bg-rose-500/15' : 'bg-brand-500/10'
        }`} />
        <div className={`absolute -bottom-24 -right-24 w-64 h-64 rounded-full blur-3xl pointer-events-none ${
          callState === 'offline' ? 'bg-amber-500/15' : 'bg-emerald-500/10'
        }`} />

        {/* Top Header */}
        <div className="w-full flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="font-semibold uppercase tracking-wider text-[10px]">Fleet HD Voice Call</span>
          </div>
          <span className="text-slate-500 font-mono text-[11px]">Real-Time VoIP</span>
        </div>

        {/* Call Direction and Participants Banner */}
        <div className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-[11px]">
          <div className="text-left">
            <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">
              {callState === 'connected' ? 'Speaking With' : 'Calling Contact'}
            </span>
            <span className="text-white font-bold truncate block max-w-[125px]">{displayName}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">You</span>
            <span className="text-cyan-400 font-bold truncate block max-w-[125px]">{myName}</span>
          </div>
        </div>

        {/* Target Avatar */}
        <div className="relative mt-1">
          {callState === 'ringing' && (
            <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping scale-150" />
          )}
          {callState === 'calling' && (
            <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping scale-125" />
          )}
          <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-xl border-4 border-slate-800 relative z-10 ${
            callState === 'offline'
              ? 'bg-gradient-to-tr from-slate-700 to-slate-600'
              : 'bg-gradient-to-tr from-brand-600 via-indigo-600 to-cyan-500'
          }`}>
            {displayName[0]?.toUpperCase() ?? 'F'}
          </div>
        </div>

        {/* Target Details */}
        <div className="space-y-1 w-full">
          <h3 className="text-lg font-bold text-white truncate px-2">{displayName}</h3>
          <p className="text-xs text-slate-400 capitalize">{displayRole}</p>
          {displayPlate && (
            <p className="text-xs font-mono font-semibold text-brand-300">
              Vehicle: {displayPlate}
            </p>
          )}

          {/* Dynamic Status Display */}
          <div className="pt-2">
            {callState === 'offline' ? (
              <div className="bg-rose-500/15 border border-rose-500/30 rounded-xl p-3 text-left space-y-1.5 animate-fade-in">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
                  <UserX className="w-4 h-4 flex-shrink-0" />
                  <span>Contact is Currently Offline</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {callSession?.errorMessage || `${displayName} has not logged into the app. Please use regular GSM cellular call below.`}
                </p>
                <p className="text-[10px] text-amber-300 font-medium">
                  Direct cellular phone dial is available below:
                </p>
              </div>
            ) : callState === 'calling' ? (
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-medium text-cyan-400">
                  Connecting to common server...
                </span>
              </div>
            ) : callState === 'ringing' ? (
              <div className="flex items-center justify-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="text-xs font-medium text-amber-300">
                  Ringing device ({displayPhone})...
                </span>
              </div>
            ) : callState === 'connected' ? (
              <div className="flex items-center justify-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-base font-mono font-bold text-emerald-400">
                  {formatTimer(seconds)}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">Call Ended</span>
            )}
          </div>
        </div>

        {/* Microphone Permission Alert */}
        {micGranted === false && callState !== 'offline' && (
          <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-left text-xs text-amber-300">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Microphone Muted by Browser</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Please allow microphone access in browser settings for 2-way audio.</p>
          </div>
        )}

        {/* Sound Wave Animation when connected */}
        {callState === 'connected' && (
          <div className="flex items-center justify-center gap-1.5 h-8">
            {[35, 70, 95, 55, 85, 45, 80, 50].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-gradient-to-t from-emerald-500 to-cyan-400 rounded-full animate-pulse"
                style={{
                  height: `${isMuted ? 8 : h}%`,
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Call Controls */}
        <div className="flex items-center justify-center gap-4 w-full pt-1">
          {callState === 'connected' && (
            <button
              onClick={() => {
                setIsMuted((v) => {
                  const next = !v;
                  if (mediaStreamRef.current) {
                    mediaStreamRef.current.getAudioTracks().forEach((track) => {
                      track.enabled = !next;
                    });
                  }
                  return next;
                });
              }}
              className={`p-3.5 rounded-2xl border transition-all ${
                isMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}

          {/* End Call / Close Button */}
          <button
            onClick={handleEndCall}
            className="p-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/40 transition-transform active:scale-95 flex items-center justify-center"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          {callState === 'connected' && (
            <button
              onClick={() => setIsSpeaker((v) => !v)}
              className={`p-3.5 rounded-2xl border transition-all ${
                isSpeaker
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
              title={isSpeaker ? 'Speaker On' : 'Speaker Off'}
            >
              {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          )}
        </div>

        {/* Regular Cellular GSM Fallback */}
        <div className="w-full pt-2 border-t border-slate-800/80">
          <a
            href={`tel:${displayPhone}`}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-center gap-2 transition-colors font-semibold"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Direct GSM Phone Call ({displayPhone})</span>
          </a>
        </div>
      </div>
    </div>
  );
}
