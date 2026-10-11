import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX,
  Radio, AlertTriangle, RefreshCw
} from 'lucide-react';
import {
  playTelephoneRingTone,
  playCallConnectedTone,
  requestMicrophoneAccess,
  type RingController
} from '../utils/audioAlerts.js';
import { callSignaling } from '../services/callSignaling.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  callerName?: string;
  callerRole?: string;
  targetPhone?: string;
  vehiclePlate?: string;
  isIncomingAnswered?: boolean;
}

export default function InAppCallModal({
  isOpen,
  onClose,
  callerName = 'Fleet Dispatch Manager',
  callerRole = 'Fleet Control Room',
  targetPhone = '+91 98401 23456',
  vehiclePlate,
  isIncomingAnswered = false,
}: Props) {
  const [callState, setCallState] = useState<'requesting_permission' | 'ringing' | 'connected' | 'ended'>(
    isIncomingAnswered ? 'connected' : 'requesting_permission'
  );
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [seconds, setSeconds] = useState(0);

  const ringRef = useRef<RingController | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);

  // Initialize Call & Microphone Access
  useEffect(() => {
    if (!isOpen) {
      cleanup();
      return;
    }

    if (isIncomingAnswered) {
      setCallState('connected');
      playCallConnectedTone();
      initPeerConnection();
      return;
    }

    setCallState('requesting_permission');
    setSeconds(0);
    setIsMuted(false);

    // Request real microphone permission
    const checkMicAndStart = async () => {
      const res = await requestMicrophoneAccess();
      if (res.granted && res.stream) {
        setMicGranted(true);
        setMicError(null);
        mediaStreamRef.current = res.stream;
        initPeerConnection();
        startRinging();
      } else {
        setMicGranted(false);
        setMicError(res.error || 'Microphone access denied by browser');
        startRinging();
      }
    };

    void checkMicAndStart();

    return () => {
      cleanup();
    };
  }, [isOpen, targetPhone, isIncomingAnswered]);

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
    if (ringRef.current) {
      ringRef.current.stop();
      ringRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (peerConnRef.current) {
      peerConnRef.current.close();
      peerConnRef.current = null;
    }
  };

  const startRinging = () => {
    setCallState('ringing');

    if (ringRef.current) {
      ringRef.current.stop();
    }
    ringRef.current = playTelephoneRingTone();

    // Auto-connect simulation after 3.5s for outgoing calls
    const connectTimer = setTimeout(() => {
      if (ringRef.current) {
        ringRef.current.stop();
        ringRef.current = null;
      }
      playCallConnectedTone();
      setCallState('connected');
      callSignaling.acceptCall();
    }, 3500);

    return () => clearTimeout(connectTimer);
  };

  const handleRetryMic = async () => {
    const res = await requestMicrophoneAccess();
    if (res.granted && res.stream) {
      setMicGranted(true);
      setMicError(null);
      mediaStreamRef.current = res.stream;
      initPeerConnection();
    } else {
      setMicGranted(false);
      setMicError(res.error || 'Please enable microphone access in your browser settings');
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
    setCallState('ended');
    callSignaling.endCall();
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
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-sm w-full p-6 shadow-2xl flex flex-col items-center text-center space-y-5 relative overflow-hidden">
        {/* Ambient Ringing Glow */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="w-full flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="font-semibold uppercase tracking-wider text-[10px]">Fleet HD Voice Call</span>
          </div>
          <span className="text-slate-500 font-mono text-[11px]">WebRTC / STUN</span>
        </div>

        {/* Caller Avatar */}
        <div className="relative mt-1">
          {callState === 'ringing' && (
            <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping scale-150" />
          )}
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-brand-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white text-3xl font-bold shadow-xl border-4 border-slate-800 relative z-10">
            {callerName[0]?.toUpperCase() ?? 'F'}
          </div>
        </div>

        {/* Caller Details */}
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">{callerName}</h3>
          <p className="text-xs text-slate-400 capitalize">{callerRole.replace('_', ' ')}</p>
          {vehiclePlate && (
            <p className="text-xs font-mono font-semibold text-brand-300">
              Vehicle: {vehiclePlate}
            </p>
          )}

          <div className="pt-1.5">
            {callState === 'ringing' ? (
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span className="text-xs font-medium text-amber-400">
                  Calling ({targetPhone})...
                </span>
              </div>
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

        {/* Microphone Permission Alert */}
        {micGranted === false && (
          <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-left space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Microphone Access Needed</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Browser microphone access was not permitted. Click retry below to enable audio.
            </p>
            <button
              onClick={handleRetryMic}
              className="mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Grant Mic Permission</span>
            </button>
          </div>
        )}

        {/* Sound Wave Animation */}
        {callState === 'connected' && (
          <div className="flex items-center justify-center gap-1.5 h-8">
            {[40, 75, 100, 60, 90, 45, 80, 50].map((h, i) => (
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
        <div className="flex items-center justify-center gap-4 w-full pt-2">
          {/* Mute button */}
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
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
            title={isSpeaker ? 'Speaker On' : 'Speaker Off'}
          >
            {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>

        {/* Regular Cellular Phone Fallback */}
        <div className="w-full pt-2 border-t border-slate-800/80">
          <a
            href={`tel:${targetPhone}`}
            className="text-xs text-slate-400 hover:text-emerald-300 flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Direct GSM Phone ({targetPhone})</span>
          </a>
        </div>
      </div>
    </div>
  );
}
