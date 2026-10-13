import React, { useState, useEffect, useRef } from 'react';
import {
  Send, X, Phone, Users, Mic, Trash2, Play, Pause,
  Volume2, Radio
} from 'lucide-react';
import { apiGet, apiPost } from '../services/api.js';
import { playMessageChime, requestMicrophoneAccess } from '../utils/audioAlerts.js';
import { getSocket, isUserCurrentlyOnline, registerCurrentUser } from '../services/socket.client.js';
import { useAuthStore } from '../store/auth.store.js';
import { useContactsStore, type FleetContact } from '../store/contacts.store.js';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId?: string;
  recipientName?: string;
  recipientRole?: string;
  text: string;
  messageType?: 'text' | 'voice';
  audioUrl?: string;
  durationSec?: number;
  timestamp: string;
  read: boolean;
  contactId?: string;
}

const QUICK_PRESETS = [
  '🚗 Passenger picked up, starting trip',
  '⛽ Reached fuel station, approval requested',
  '🚦 10 min delay due to highway traffic',
  '✅ Trip completed safely at drop location',
  '🆘 Emergency support needed immediately',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contact?: FleetContact | null;
  driverName?: string;
  onStartCall?: (contact: FleetContact) => void;
}

// ─── WhatsApp Style Voice Note Player Component ─────────────────────────────
export function VoiceNoteBubble({
  audioUrl,
  durationSec = 0,
  isMe,
}: {
  audioUrl: string;
  durationSec?: number;
  isMe: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(Math.round(audio.duration));
      }
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const target = pos * duration;
    audioRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="flex items-center gap-3 py-1 px-1 min-w-[210px] sm:min-w-[240px]">
      <button
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md transition-all active:scale-95 flex-shrink-0 ${
          isMe
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-emerald-500 hover:bg-emerald-400 text-white'
        }`}
        title={isPlaying ? 'Pause' : 'Play Voice Note'}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col justify-center space-y-1">
        {/* Waveform / Scrubber bar */}
        <div
          onClick={handleSeek}
          className="h-3 w-full flex items-center gap-0.5 cursor-pointer relative group"
        >
          {/* Simulated audio frequency bars */}
          {[40, 75, 55, 90, 60, 80, 45, 95, 70, 50, 85, 60, 40, 75, 90, 55].map((h, i) => {
            const barProgress = (i / 16) * 100;
            const isFilled = progress >= barProgress;
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-colors ${
                  isFilled
                    ? isMe ? 'bg-white' : 'bg-emerald-400'
                    : isMe ? 'bg-white/30' : 'bg-slate-600'
                }`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>

        {/* Timers & Mic tag */}
        <div className="flex items-center justify-between text-[10px] font-mono leading-none">
          <span className={isMe ? 'text-white/80' : 'text-slate-400'}>
            {formatSecs(currentTime > 0 ? currentTime : duration)}
          </span>
          <div className="flex items-center gap-1">
            <Mic className={`w-3 h-3 ${isMe ? 'text-white/70' : 'text-emerald-400'}`} />
            <span className={isMe ? 'text-white/70' : 'text-slate-400 text-[9px]'}>Voice note</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InAppChatModal({
  isOpen,
  onClose,
  contact,
  driverName,
  onStartCall,
}: Props) {
  const { user } = useAuthStore();
  const { contacts } = useContactsStore();
  const myUserId = (user as any)?.id || (user as any)?._id || 'owner-01';
  const myRole = (user as any)?.role || 'fleet_owner';
  const myName = user?.displayName || 'Fleet Controller';

  // Filter contacts so the current logged-in user is NEVER a chat recipient
  const availableRecipients = contacts.filter(
    (c) => c.id !== myUserId && (!user?.email || c.email !== user.email)
  );

  // Auto-pick appropriate counterpart based on role
  const getDefaultCounterpart = (): FleetContact => {
    if (contact && contact.id !== myUserId && (!user?.email || contact.email !== user.email)) {
      return contact;
    }
    if (myRole === 'driver') {
      return availableRecipients.find((c) => c.id === 'owner-01' || c.role === 'manager')
        || availableRecipients.find((c) => c.role === 'telecaller')
        || { id: 'owner-01', name: 'Sarangan (Fleet Owner)', role: 'manager', phone: '+91 98410 11223', status: 'online' };
    }
    if (myRole === 'customer') {
      return availableRecipients.find((c) => c.id === 'tel-01' || c.role === 'telecaller')
        || availableRecipients.find((c) => c.role === 'driver')
        || { id: 'tel-01', name: 'Fleet 365 24x7 Helpline Desk', role: 'telecaller', phone: '+91 1800 365 000', status: 'online' };
    }
    return availableRecipients.find((c) => c.role === 'driver')
      || availableRecipients[0]
      || { id: 'drv-01', name: driverName || 'Karthik Raja', role: 'driver', phone: '+91 98401 23456', vehiclePlate: 'TN01BV4589', status: 'online' };
  };

  const [activeRecipient, setActiveRecipient] = useState<FleetContact>(getDefaultCounterpart);

  // Sync recipient when contact prop changes or modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (contact && contact.id !== myUserId && (!user?.email || contact.email !== user.email)) {
      setActiveRecipient(contact);
    } else {
      setActiveRecipient(getDefaultCounterpart());
    }
  }, [contact, myUserId, isOpen]);

  const contactId = activeRecipient.id;
  const contactName = activeRecipient.name;
  const contactRole = activeRecipient.role;
  const contactPhone = activeRecipient.phone;
  const contactPlate = activeRecipient.vehiclePlate;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecipientOnline, setIsRecipientOnline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice Note Recording State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check online status of recipient
  useEffect(() => {
    if (!isOpen) return;
    setIsRecipientOnline(isUserCurrentlyOnline(contactId));
  }, [isOpen, contactId]);

  // Load chat history from server database
  useEffect(() => {
    if (!isOpen) return;

    registerCurrentUser();

    const loadHistory = async () => {
      try {
        const res = await apiGet<ChatMessage[]>(`/app/chat?contactId=${contactId}&userId=${myUserId}`);
        if (Array.isArray(res) && res.length > 0) {
          setMessages(res);
        } else {
          setMessages([
            {
              id: 'init-1',
              senderId: contactId,
              senderName: contactName,
              senderRole: contactRole,
              text: `Fleet chat channel connected with ${contactName}. Text and WhatsApp-style voice notes are stored on the central server.`,
              timestamp: new Date().toISOString(),
              read: true,
            },
          ]);
        }
      } catch {
        const saved = localStorage.getItem(`fw_chat_${contactId}`);
        if (saved) {
          try {
            setMessages(JSON.parse(saved));
          } catch {}
        }
      }
    };

    void loadHistory();
  }, [isOpen, contactId, myUserId, contactName, contactRole]);

  // Real-time socket message delivery listener
  useEffect(() => {
    if (!isOpen) return;

    const socket = getSocket();

    const handleIncomingMessage = (newMsg: ChatMessage) => {
      if (newMsg.senderId === myUserId) return;

      if (newMsg.senderId === contactId || newMsg.recipientId === contactId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        playMessageChime();
      }
    };

    socket.on('chat:receive', handleIncomingMessage);
    socket.on('chat:sent', (sentMsg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });
    });

    return () => {
      socket.off('chat:receive', handleIncomingMessage);
    };
  }, [isOpen, contactId, myUserId]);

  // Scroll to bottom on new message and cache
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`fw_chat_${contactId}`, JSON.stringify(messages));
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, contactId]);

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // ─── Voice Note Recording Actions ──────────────────────────────────────────
  const startVoiceRecording = async () => {
    try {
      const res = await requestMicrophoneAccess();
      if (!res.granted || !res.stream) {
        alert('Microphone access is required to record voice notes.');
        return;
      }

      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(res.stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(250);
      setIsRecordingVoice(true);
      setVoiceSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setVoiceSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Could not start voice note recording', err);
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    audioChunksRef.current = [];
    setIsRecordingVoice(false);
    setVoiceSeconds(0);
  };

  const sendVoiceRecording = () => {
    if (!mediaRecorderRef.current) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const duration = voiceSeconds;

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result as string;
        void dispatchMessage({
          text: '🎤 Voice message',
          messageType: 'voice',
          audioUrl: base64Audio,
          durationSec: duration,
        });
      };
      reader.readAsDataURL(blob);
    };

    mediaRecorderRef.current.stop();
    setIsRecordingVoice(false);
    setVoiceSeconds(0);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content || isSending) return;

    setInputText('');
    await dispatchMessage({ text: content, messageType: 'text' });
  };

  const dispatchMessage = async (msgPayload: {
    text: string;
    messageType?: 'text' | 'voice';
    audioUrl?: string;
    durationSec?: number;
  }) => {
    setIsSending(true);

    const tempId = `msg-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: tempId,
      senderId: myUserId,
      senderName: myName,
      senderRole: myRole,
      recipientId: contactId,
      recipientName: contactName,
      text: msgPayload.text,
      messageType: msgPayload.messageType || 'text',
      audioUrl: msgPayload.audioUrl,
      durationSec: msgPayload.durationSec,
      timestamp: new Date().toISOString(),
      read: isRecipientOnline,
      contactId,
    };

    setMessages((prev) => [...prev, userMsg]);
    playMessageChime();

    try {
      const saved = await apiPost<ChatMessage>('/app/chat', {
        text: msgPayload.text,
        messageType: msgPayload.messageType || 'text',
        audioUrl: msgPayload.audioUrl,
        durationSec: msgPayload.durationSec,
        senderId: myUserId,
        senderName: myName,
        senderRole: myRole,
        recipientId: contactId,
        recipientName: contactName,
        recipientRole: contactRole,
      });

      if (saved && saved.id) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m)));
      }

      const socket = getSocket();
      socket.emit('chat:send', {
        recipientId: contactId,
        recipientName: contactName,
        recipientRole: contactRole,
        text: msgPayload.text,
        messageType: msgPayload.messageType || 'text',
        audioUrl: msgPayload.audioUrl,
        durationSec: msgPayload.durationSec,
        senderId: myUserId,
        senderName: myName,
        senderRole: myRole,
      });
    } catch {} finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl max-w-lg w-full h-[620px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Chat Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-800 bg-slate-900/95">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                {contactName[0]?.toUpperCase() ?? 'F'}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                  isRecipientOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
                title={isRecipientOnline ? 'Online on Server' : 'Offline'}
              />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2 truncate">
                <span className="truncate">{contactName}</span>
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                <span className="capitalize">{contactRole.replace('_', ' ')}</span>
                {contactPlate && (
                  <>
                    <span>•</span>
                    <span className="text-brand-400 font-mono font-semibold">{contactPlate}</span>
                  </>
                )}
                <span>•</span>
                <span className={isRecipientOnline ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                  {isRecipientOnline ? 'Online' : 'Offline'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Direct In-App VoIP Call Button */}
            {onStartCall && (
              <button
                onClick={() => {
                  onStartCall(activeRecipient);
                  onClose();
                }}
                className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-colors"
                title={`Call ${contactName} via In-App VoIP`}
              >
                <Phone className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sender & Recipient Switcher Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              To:
            </span>
            <select
              value={activeRecipient.id}
              onChange={(e) => {
                const found = availableRecipients.find((c) => c.id === e.target.value);
                if (found) setActiveRecipient(found);
              }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-semibold text-xs focus:outline-none focus:border-brand-500"
            >
              {availableRecipients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.role.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>
          <div className="text-right">
            <span className="text-slate-400 text-[11px]">From: </span>
            <span className="text-cyan-400 font-bold">{myName}</span>
            <span className="text-[10px] text-slate-500 ml-1">({myRole.replace('_', ' ')})</span>
          </div>
        </div>

        {/* Status banner if recipient is offline */}
        {!isRecipientOnline && (
          <div className="px-4 py-2 bg-slate-800/60 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Recipient is currently offline. Messages & voice notes are saved in DB and delivered on login.</span>
            <a href={`tel:${contactPhone}`} className="text-emerald-400 hover:underline flex items-center gap-1 ml-2 flex-shrink-0">
              <Phone className="w-3 h-3" /> Call GSM
            </a>
          </div>
        )}

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-950/50">
          {messages.map((msg) => {
            const isMe = msg.senderId === myUserId || msg.senderId === 'me';
            const isVoice = msg.messageType === 'voice' || Boolean(msg.audioUrl);

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
              >
                <span className="text-[10px] text-slate-500 px-1 font-mono">
                  {isMe ? 'You' : msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                    isMe
                      ? 'bg-brand-600 text-white rounded-br-sm'
                      : 'bg-slate-800 text-slate-200 border border-slate-700/80 rounded-bl-sm'
                  }`}
                >
                  {isVoice && msg.audioUrl ? (
                    <VoiceNoteBubble
                      audioUrl={msg.audioUrl}
                      durationSec={msg.durationSec}
                      isMe={isMe}
                    />
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Dispatch Presets */}
        <div className="px-3 py-2 border-t border-slate-800 bg-slate-900/70 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
          {QUICK_PRESETS.map((preset, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(preset)}
              className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700/60 whitespace-nowrap transition-colors flex-shrink-0"
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Bottom Input Area: Text Input OR WhatsApp Style Voice Recording Bar */}
        <div className="p-3 bg-slate-900 border-t border-slate-800">
          {isRecordingVoice ? (
            <div className="flex items-center justify-between gap-3 bg-slate-800/90 border border-rose-500/40 rounded-2xl px-4 py-2.5 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                <span className="text-xs font-semibold text-rose-400">
                  Recording Voice Note...
                </span>
                <span className="font-mono text-xs text-white font-bold ml-1">
                  {Math.floor(voiceSeconds / 60)}:{(voiceSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>

              {/* Animated visualizer bars */}
              <div className="flex items-center gap-1 h-5">
                {[40, 80, 50, 95, 60, 85].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-rose-400 rounded-full animate-pulse"
                    style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>

              {/* Discard & Send Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelVoiceRecording}
                  className="p-2 rounded-xl bg-slate-700 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Discard Voice Note"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={sendVoiceRecording}
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-transform active:scale-95"
                  title="Send WhatsApp-style Voice Note"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSendMessage();
                }}
                placeholder={`Message ${contactName}...`}
                className="flex-1 px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />

              {/* WhatsApp-Style Voice Record Button */}
              <button
                onClick={startVoiceRecording}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-emerald-600/20 text-slate-300 hover:text-emerald-400 border border-slate-700 hover:border-emerald-500/40 transition-all flex-shrink-0"
                title="Hold or Click to Record WhatsApp Voice Note"
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Send Button */}
              <button
                onClick={() => void handleSendMessage()}
                disabled={!inputText.trim() || isSending}
                className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white shadow-md shadow-brand-600/20 transition-all flex-shrink-0"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
