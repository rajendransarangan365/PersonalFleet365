import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX,
  Radio, AlertTriangle, UserX, Disc, Download, Play, Pause,
  CheckCircle2
} from 'lucide-react';
import { requestMicrophoneAccess } from '../utils/audioAlerts.js';
import { callSignaling, type CallSession } from '../services/callSignaling.js';
import { getSocket } from '../services/socket.client.js';
import { apiPost } from '../services/api.js';
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

  // SAFETY: Cannot call yourself. Auto-route to counterpart based on role.
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

  // Live Audio Visualization
  const [micLevels, setMicLevels] = useState<number[]>([15, 20, 25, 20, 15, 25, 30, 20]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Call Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [recordingSavedNotice, setRecordingSavedNotice] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);

  // WebRTC refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

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

  // WebRTC Signaling over Socket.IO
  useEffect(() => {
    const socket = getSocket();

    const handleWebRtcOffer = async (data: { senderUserId: string; offer: any; callId?: string }) => {
      if (!peerConnRef.current) return;
      try {
        await peerConnRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnRef.current.createAnswer();
        await peerConnRef.current.setLocalDescription(answer);

        socket.emit('webrtc:answer', {
          targetUserId: data.senderUserId,
          answer,
          callId: data.callId,
        });
      } catch (err) {
        console.warn('Error handling WebRTC offer', err);
      }
    };

    const handleWebRtcAnswer = async (data: { senderUserId: string; answer: any }) => {
      if (!peerConnRef.current) return;
      try {
        await peerConnRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (err) {
        console.warn('Error handling WebRTC answer', err);
      }
    };

    const handleWebRtcIceCandidate = async (data: { candidate: any }) => {
      if (!peerConnRef.current || !data.candidate) return;
      try {
        await peerConnRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.warn('Error adding ICE candidate', err);
      }
    };

    socket.on('webrtc:offer', handleWebRtcOffer);
    socket.on('webrtc:answer', handleWebRtcAnswer);
    socket.on('webrtc:ice_candidate', handleWebRtcIceCandidate);

    return () => {
      socket.off('webrtc:offer', handleWebRtcOffer);
      socket.off('webrtc:answer', handleWebRtcAnswer);
      socket.off('webrtc:ice_candidate', handleWebRtcIceCandidate);
    };
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
      void setupMicAndPeer();
      return;
    }

    setSeconds(0);
    setIsMuted(false);
    setCallState('calling');
    setRecordingUrl(null);
    setIsRecording(false);
    setRecordingSeconds(0);

    // Setup microphone
    void setupMicAndPeer();

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

  const setupMicAndPeer = async () => {
    const res = await requestMicrophoneAccess();
    if (res.granted && res.stream) {
      setMicGranted(true);
      mediaStreamRef.current = res.stream;
      initAudioVisualizer(res.stream);
      initPeerConnection(res.stream);
    } else {
      setMicGranted(false);
    }
  };

  const initAudioVisualizer = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevels = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Sample 8 points
        const step = Math.max(1, Math.floor(bufferLength / 8));
        const levels: number[] = [];
        for (let i = 0; i < 8; i++) {
          const val = dataArray[i * step] || 0;
          // Scale to 15% - 95%
          levels.push(Math.min(95, Math.max(15, Math.round((val / 255) * 85) + 15)));
        }
        setMicLevels(levels);
        animFrameRef.current = requestAnimationFrame(updateLevels);
      };

      animFrameRef.current = requestAnimationFrame(updateLevels);
    } catch (err) {
      console.warn('Audio visualizer not supported', err);
    }
  };

  const initPeerConnection = (stream: MediaStream) => {
    try {
      if (typeof RTCPeerConnection === 'undefined') return;

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      peerConnRef.current = pc;

      // Add local audio tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Receive remote audio tracks
      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      };

      // Send local ICE candidates to peer
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const socket = getSocket();
          socket.emit('webrtc:ice_candidate', {
            targetUserId: resolvedTargetId,
            candidate: event.candidate,
            callId: callSession?.callId,
          });
        }
      };
    } catch (err) {
      console.warn('WebRTC init error', err);
    }
  };

  // When call state becomes 'connected', initiate WebRTC offer if caller
  useEffect(() => {
    if (callState !== 'connected' || !peerConnRef.current) return;

    const startOfferNegotiation = async () => {
      try {
        const pc = peerConnRef.current;
        if (!pc) return;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const socket = getSocket();
        socket.emit('webrtc:offer', {
          targetUserId: resolvedTargetId,
          offer,
          callId: callSession?.callId,
        });
      } catch (err) {
        console.warn('Error creating WebRTC offer', err);
      }
    };

    if (callSession?.isCaller !== false) {
      void startOfferNegotiation();
    }
  }, [callState, resolvedTargetId, callSession]);

  // Connected duration timer
  useEffect(() => {
    if (callState !== 'connected') return;

    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callState]);

  // Recording timer
  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  // ─── Call Recording Controller ───────────────────────────────────────────
  const startRecording = () => {
    if (!mediaStreamRef.current) return;
    try {
      recordedChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
        setRecordingSavedNotice(true);

        // Convert to base64 to persist to database call log
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          saveRecordingToLog(base64Data);
        };
        reader.readAsDataURL(blob);
      };

      recorder.start(1000);
      setIsRecording(true);
      setRecordingSeconds(0);
    } catch (err) {
      console.warn('Failed to start call recording', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const saveRecordingToLog = async (base64Audio: string) => {
    const activeCallId = callSession?.callId || `call_${Date.now()}`;
    const socket = getSocket();

    socket.emit('call:save_recording', {
      callId: activeCallId,
      recordingUrl: base64Audio,
      duration: recordingSeconds,
    });

    try {
      await apiPost('/app/call/log', {
        callId: activeCallId,
        callerId: myUserId,
        callerName: myName,
        callerRole: myRole,
        targetId: resolvedTargetId,
        targetName: resolvedTargetName,
        targetRole: resolvedTargetRole,
        status: 'completed',
        durationSeconds: seconds,
        isRecorded: true,
        recordingUrl: base64Audio,
      });
    } catch {}
  };

  const toggleRecordingPlayback = () => {
    if (!recordingUrl) return;

    if (!playbackAudioRef.current) {
      const audio = new Audio(recordingUrl);
      playbackAudioRef.current = audio;
      audio.onended = () => setIsPlayingRecording(false);
    }

    if (isPlayingRecording) {
      playbackAudioRef.current.pause();
      setIsPlayingRecording(false);
    } else {
      playbackAudioRef.current.play().catch(() => {});
      setIsPlayingRecording(true);
    }
  };

  const handleEndCall = () => {
    if (isRecording) {
      stopRecording();
    }
    cleanup();
    callSignaling.endCall(seconds);

    // Save final call log to database
    const activeCallId = callSession?.callId || `call_${Date.now()}`;
    void apiPost('/app/call/log', {
      callId: activeCallId,
      callerId: myUserId,
      callerName: myName,
      callerRole: myRole,
      targetId: resolvedTargetId,
      targetName: resolvedTargetName,
      targetRole: resolvedTargetRole,
      status: 'completed',
      durationSeconds: seconds,
      isRecorded: Boolean(recordingUrl),
    });

    setCallState('ended');
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const cleanup = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current = null;
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
      {/* Hidden audio element to playback remote incoming audio stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

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
          <span className="text-slate-500 font-mono text-[11px]">Real-Time WebRTC</span>
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

        {/* Active Real-Time Mic Sound Wave Animation */}
        {callState === 'connected' && (
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 h-9 bg-slate-950/40 py-1 rounded-xl border border-slate-800">
              {micLevels.map((lvl, i) => (
                <div
                  key={i}
                  className={`w-1.5 rounded-full transition-all duration-75 ${
                    isMuted ? 'bg-slate-700' : 'bg-gradient-to-t from-emerald-500 to-cyan-400'
                  }`}
                  style={{
                    height: isMuted ? '6px' : `${lvl}%`,
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] text-slate-400 font-mono block">
              {isMuted ? 'Microphone Muted' : 'Mic Live Voice Activity'}
            </span>
          </div>
        )}

        {/* Call Voice Recording Status / Actions */}
        {callState === 'connected' && (
          <div className="w-full bg-slate-800/80 border border-slate-700/80 rounded-2xl p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Disc className={`w-4 h-4 ${isRecording ? 'text-rose-500 animate-spin' : 'text-slate-400'}`} />
                <span className="text-xs font-semibold text-white">
                  {isRecording ? `REC ${formatTimer(recordingSeconds)}` : 'Call Recording'}
                </span>
              </div>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shadow-sm ${
                  isRecording
                    ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                }`}
              >
                {isRecording ? 'Stop Recording' : 'Record Call'}
              </button>
            </div>

            {/* Playback preview for recorded audio */}
            {recordingUrl && (
              <div className="pt-1.5 border-t border-slate-700/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Call Audio Saved</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={toggleRecordingPlayback}
                    className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                    title={isPlayingRecording ? 'Pause' : 'Listen'}
                  >
                    {isPlayingRecording ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={recordingUrl}
                    download={`fleet_call_${callSession?.callId || Date.now()}.webm`}
                    className="p-1 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                    title="Download Audio File"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}
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
              onClick={() => {
                setIsSpeaker((v) => {
                  const next = !v;
                  if (remoteAudioRef.current) {
                    remoteAudioRef.current.muted = !next;
                  }
                  return next;
                });
              }}
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
