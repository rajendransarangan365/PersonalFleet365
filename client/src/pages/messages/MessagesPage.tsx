import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Phone, Search, Users, Mic, Send, Trash2,
  Clock, CheckCheck, Play, Pause, Download, Radio, Volume2,
  PhoneIncoming, PhoneOutgoing, PhoneMissed, Disc, AlertCircle
} from 'lucide-react';
import { apiGet, apiPost } from '../../services/api.js';
import { getSocket, isUserCurrentlyOnline, registerCurrentUser } from '../../services/socket.client.js';
import { playMessageChime, requestMicrophoneAccess } from '../../utils/audioAlerts.js';
import { useAuthStore } from '../../store/auth.store.js';
import { useContactsStore, type FleetContact } from '../../store/contacts.store.js';
import InAppCallModal from '../../components/InAppCallModal.js';
import { VoiceNoteBubble, type ChatMessage } from '../../components/InAppChatModal.js';

interface ConversationItem {
  counterpartId: string;
  counterpartName: string;
  counterpartRole: string;
  lastMessage: {
    id: string;
    text: string;
    messageType: 'text' | 'voice';
    durationSec?: number;
    timestamp: string;
    isMe: boolean;
  };
  unreadCount: number;
}

interface CallLogItem {
  id: string;
  callId: string;
  callerId: string;
  callerName: string;
  callerRole: string;
  callerPhone?: string;
  targetId: string;
  targetName: string;
  targetRole: string;
  targetPhone?: string;
  vehiclePlate?: string;
  status: 'completed' | 'missed' | 'rejected' | 'offline_failed';
  durationSeconds: number;
  isRecorded?: boolean;
  recordingUrl?: string;
  startedAt: string;
}

const QUICK_PRESETS = [
  '🚗 Passenger picked up, starting trip',
  '⛽ Reached fuel station, approval requested',
  '🚦 10 min delay due to highway traffic',
  '✅ Trip completed safely at drop location',
  '🆘 Emergency support needed immediately',
];

export default function MessagesPage() {
  const { user } = useAuthStore();
  const { contacts } = useContactsStore();
  const myUserId = (user as any)?.id || (user as any)?._id || 'owner-01';
  const myName = user?.displayName || 'Fleet Controller';
  const myRole = (user as any)?.role || 'fleet_owner';

  const [activeTab, setActiveTab] = useState<'chats' | 'calls'>('chats');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [callLogs, setCallLogs] = useState<CallLogItem[]>([]);
  const [selectedContact, setSelectedContact] = useState<FleetContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Voice Note Recording
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // In-App Calling modal
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callTarget, setCallTarget] = useState<FleetContact | null>(null);

  // Playback for recorded call voice
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const callAudioRef = useRef<HTMLAudioElement | null>(null);

  // Filter available contacts to exclude self
  const availableContacts = contacts.filter(
    (c) => c.id !== myUserId && (!user?.email || c.email !== user.email)
  );

  // 1. Initial Load of Real Conversations and Call Logs from MongoDB
  const loadConversations = async () => {
    try {
      const res = await apiGet<ConversationItem[]>(`/app/chat/conversations?userId=${myUserId}`);
      if (Array.isArray(res)) {
        setConversations(res);
      }
    } catch {}
  };

  const loadCallLogs = async () => {
    try {
      const res = await apiGet<CallLogItem[]>(`/app/call/logs?userId=${myUserId}`);
      if (Array.isArray(res)) {
        setCallLogs(res);
      }
    } catch {}
  };

  useEffect(() => {
    registerCurrentUser();
    void loadConversations();
    void loadCallLogs();
  }, [myUserId]);

  // Set default selected contact on mount
  useEffect(() => {
    if (!selectedContact && availableContacts.length > 0) {
      // Pick first conversation counterpart or first contact
      if (conversations.length > 0) {
        const firstConvo = conversations[0];
        const match = availableContacts.find((c) => c.id === firstConvo.counterpartId);
        if (match) {
          setSelectedContact(match);
          return;
        }
      }
      setSelectedContact(availableContacts[0]);
    }
  }, [availableContacts, conversations, selectedContact]);

  // 2. Load Messages when Selected Contact Changes
  useEffect(() => {
    if (!selectedContact) return;

    setLoadingMessages(true);
    const loadThread = async () => {
      try {
        const res = await apiGet<ChatMessage[]>(
          `/app/chat?contactId=${selectedContact.id}&userId=${myUserId}`
        );
        if (Array.isArray(res)) {
          setMessages(res);
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };

    void loadThread();
  }, [selectedContact, myUserId]);

  // 3. Socket Live Message Receiver
  useEffect(() => {
    const socket = getSocket();

    const handleIncomingMessage = (newMsg: ChatMessage) => {
      if (newMsg.senderId === myUserId) return;

      // Update current open thread if sender matches
      if (selectedContact && (newMsg.senderId === selectedContact.id || newMsg.recipientId === selectedContact.id)) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        playMessageChime();
      }

      // Refresh conversations list to update snippet & unread count
      void loadConversations();
    };

    const handleSentAck = (sentMsg: ChatMessage) => {
      if (selectedContact && (sentMsg.recipientId === selectedContact.id || sentMsg.senderId === selectedContact.id)) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === sentMsg.id)) return prev;
          return [...prev, sentMsg];
        });
      }
      void loadConversations();
    };

    socket.on('chat:receive', handleIncomingMessage);
    socket.on('chat:sent', handleSentAck);

    return () => {
      socket.off('chat:receive', handleIncomingMessage);
      socket.off('chat:sent', handleSentAck);
    };
  }, [selectedContact, myUserId]);

  // Auto-scroll message list to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. Send Message (Text & Voice)
  const handleSendMessage = async (textToSend?: string) => {
    if (!selectedContact) return;
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
    if (!selectedContact) return;
    setIsSending(true);

    const tempId = `msg-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: tempId,
      senderId: myUserId,
      senderName: myName,
      senderRole: myRole,
      recipientId: selectedContact.id,
      recipientName: selectedContact.name,
      text: msgPayload.text,
      messageType: msgPayload.messageType || 'text',
      audioUrl: msgPayload.audioUrl,
      durationSec: msgPayload.durationSec,
      timestamp: new Date().toISOString(),
      read: isUserCurrentlyOnline(selectedContact.id),
      contactId: selectedContact.id,
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
        recipientId: selectedContact.id,
        recipientName: selectedContact.name,
        recipientRole: selectedContact.role,
      });

      if (saved && saved.id) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m)));
      }

      const socket = getSocket();
      socket.emit('chat:send', {
        recipientId: selectedContact.id,
        recipientName: selectedContact.name,
        recipientRole: selectedContact.role,
        text: msgPayload.text,
        messageType: msgPayload.messageType || 'text',
        audioUrl: msgPayload.audioUrl,
        durationSec: msgPayload.durationSec,
        senderId: myUserId,
        senderName: myName,
        senderRole: myRole,
      });

      void loadConversations();
    } catch {} finally {
      setIsSending(false);
    }
  };

  // 5. Voice Note Recording
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
      console.warn('Could not record voice note', err);
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

  // Call Audio Playback
  const togglePlayCallRecording = (callId: string, url?: string) => {
    if (!url) return;

    if (playingCallId === callId) {
      callAudioRef.current?.pause();
      setPlayingCallId(null);
      return;
    }

    if (callAudioRef.current) {
      callAudioRef.current.pause();
    }

    const audio = new Audio(url);
    callAudioRef.current = audio;
    setPlayingCallId(callId);

    audio.onended = () => setPlayingCallId(null);
    audio.play().catch(() => setPlayingCallId(null));
  };

  const filteredContacts = availableContacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(searchQuery))
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row bg-slate-950 text-slate-100 overflow-hidden">
      {/* ─── Left Sidebar: Conversations & Call History ─── */}
      <div className="w-full md:w-80 lg:w-96 border-r border-slate-800 bg-slate-900/90 flex flex-col flex-shrink-0">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand-400" />
              <span>Communications</span>
            </h1>
            <p className="text-xs text-slate-400">Live MongoDB Chat & VoIP Calling</p>
          </div>
        </div>

        {/* Tab Switcher: Chats vs Call Logs */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-slate-800/80">
          <button
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'chats'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chats ({conversations.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('calls');
              void loadCallLogs();
            }}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'calls'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Call Logs ({callLogs.length})</span>
          </button>
        </div>

        {/* Search Contacts Bar */}
        {activeTab === 'chats' && (
          <div className="p-3 border-b border-slate-800/80">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff, drivers, helpline..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        )}

        {/* List Content */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {activeTab === 'chats' ? (
            filteredContacts.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No contacts found matching "{searchQuery}"
              </div>
            ) : (
              filteredContacts.map((c) => {
                const isOnline = isUserCurrentlyOnline(c.id);
                const isSelected = selectedContact?.id === c.id;
                const convo = conversations.find((item) => item.counterpartId === c.id);

                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedContact(c)}
                    className={`w-full p-3.5 flex items-center gap-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-brand-500/15 border-l-4 border-brand-500'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Avatar with live online badge */}
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow">
                        {c.name[0]?.toUpperCase() ?? 'F'}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                          isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                        }`}
                        title={isOnline ? 'Online on Server' : 'Offline'}
                      />
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className="text-xs font-bold text-white truncate max-w-[140px]">
                          {c.name}
                        </h4>
                        {convo?.lastMessage?.timestamp && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(convo.lastMessage.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-slate-400 truncate max-w-[170px] flex items-center gap-1">
                          {convo?.lastMessage ? (
                            convo.lastMessage.messageType === 'voice' ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <Mic className="w-3 h-3" /> Voice note ({convo.lastMessage.durationSec || 0}s)
                              </span>
                            ) : (
                              <span>{convo.lastMessage.text}</span>
                            )
                          ) : (
                            <span className="capitalize text-slate-500">{c.role.replace('_', ' ')}</span>
                          )}
                        </p>

                        {convo && convo.unreadCount > 0 && (
                          <span className="w-4 h-4 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {convo.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )
          ) : (
            /* Call Logs List */
            callLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs space-y-2">
                <Phone className="w-8 h-8 mx-auto text-slate-600 opacity-50" />
                <p>No call logs recorded yet.</p>
                <p className="text-[11px] text-slate-600">Start a VoIP call to test recording and logging.</p>
              </div>
            ) : (
              callLogs.map((log) => {
                const isCaller = log.callerId === myUserId;
                const counterpartName = isCaller ? log.targetName : log.callerName;
                const counterpartRole = isCaller ? log.targetRole : log.callerRole;

                return (
                  <div key={log.id} className="p-3.5 hover:bg-slate-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {log.status === 'completed' ? (
                          isCaller ? (
                            <PhoneOutgoing className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <PhoneIncoming className="w-4 h-4 text-cyan-400" />
                          )
                        ) : (
                          <PhoneMissed className="w-4 h-4 text-rose-400" />
                        )}
                        <div>
                          <h4 className="text-xs font-bold text-white">{counterpartName}</h4>
                          <span className="text-[10px] text-slate-400 capitalize">
                            {counterpartRole.replace('_', ' ')} • {log.status}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                        {new Date(log.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                      <span className="text-[11px] text-slate-400 font-mono">
                        Duration: {Math.floor(log.durationSeconds / 60)}:{(log.durationSeconds % 60).toString().padStart(2, '0')}
                      </span>

                      {/* Play call recording if available */}
                      {log.isRecorded && log.recordingUrl && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => togglePlayCallRecording(log.id, log.recordingUrl)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-1.5 transition-colors"
                          >
                            {playingCallId === log.id ? (
                              <>
                                <Pause className="w-3 h-3" />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3" />
                                <span>Play Recording</span>
                              </>
                            )}
                          </button>
                          <a
                            href={log.recordingUrl}
                            download={`fleet_call_${log.callId}.webm`}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                            title="Download Audio"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>

      {/* ─── Right Panel: Active Conversation View ─── */}
      {selectedContact ? (
        <div className="flex-1 flex flex-col bg-slate-950 min-w-0">
          {/* Top Bar of Active Chat */}
          <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow flex-shrink-0">
                {selectedContact.name[0]?.toUpperCase() ?? 'F'}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-white text-sm truncate">{selectedContact.name}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                  <span className="capitalize">{selectedContact.role.replace('_', ' ')}</span>
                  {selectedContact.vehiclePlate && (
                    <>
                      <span>•</span>
                      <span className="text-brand-300 font-mono font-semibold">{selectedContact.vehiclePlate}</span>
                    </>
                  )}
                  <span>•</span>
                  <span className={isUserCurrentlyOnline(selectedContact.id) ? 'text-emerald-400' : 'text-slate-500'}>
                    {isUserCurrentlyOnline(selectedContact.id) ? 'Online' : 'Offline'}
                  </span>
                </p>
              </div>
            </div>

            {/* Direct Voice Calling Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* In-App VoIP Call Button */}
              <button
                onClick={() => {
                  setCallTarget(selectedContact);
                  setCallModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title={`Call ${selectedContact.name} via WebRTC VoIP`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">VoIP HD Call</span>
              </button>

              {/* Direct Cellular Phone Fallback */}
              {selectedContact.phone && (
                <a
                  href={`tel:${selectedContact.phone}`}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-colors"
                  title={`Dial cellular phone: ${selectedContact.phone}`}
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-950/70">
            {loadingMessages ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 text-center p-6">
                <MessageSquare className="w-10 h-10 text-slate-700" />
                <p className="text-sm font-semibold text-slate-400">No messages yet with {selectedContact.name}</p>
                <p className="text-xs text-slate-600 max-w-sm">
                  Send a text message or a WhatsApp-style voice note below to start real-time communication.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
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
                      className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
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
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Dispatch Presets */}
          <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/60 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
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

          {/* Bottom Input Area: Text or WhatsApp-style Voice Recording */}
          <div className="p-3 sm:p-4 bg-slate-900/90 border-t border-slate-800">
            {isRecordingVoice ? (
              <div className="flex items-center justify-between gap-3 bg-slate-800/90 border border-rose-500/40 rounded-2xl px-4 py-2.5 animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xs font-semibold text-rose-400">
                    Recording WhatsApp Voice Note...
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
                    title="Send Voice Note"
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
                  placeholder={`Message ${selectedContact.name}...`}
                  className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />

                {/* WhatsApp-Style Voice Record Button */}
                <button
                  onClick={startVoiceRecording}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-emerald-600/20 text-slate-300 hover:text-emerald-400 border border-slate-700 hover:border-emerald-500/40 transition-all flex-shrink-0"
                  title="Record WhatsApp Voice Note"
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
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
          Select a contact to view communications
        </div>
      )}

      {/* In-App VoIP Call Modal */}
      {callModalOpen && (
        <InAppCallModal
          isOpen={callModalOpen}
          onClose={() => setCallModalOpen(false)}
          targetContact={callTarget}
        />
      )}
    </div>
  );
}
