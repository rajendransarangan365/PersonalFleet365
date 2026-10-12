import React, { useState, useEffect, useRef } from 'react';
import {
  Send, X, Phone, Users
} from 'lucide-react';
import { apiGet, apiPost } from '../services/api.js';
import { playMessageChime } from '../utils/audioAlerts.js';
import { getSocket, isUserCurrentlyOnline, registerCurrentUser } from '../services/socket.client.js';
import { useAuthStore } from '../store/auth.store.js';
import { useContactsStore, type FleetContact } from '../store/contacts.store.js';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId?: string;
  recipientName?: string;
  text: string;
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
              text: `Fleet chat channel connected with ${contactName}. Messages are stored on the central server.`,
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
      // Ignore self-echoes
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

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content || isSending) return;

    setIsSending(true);

    const tempId = `msg-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: tempId,
      senderId: myUserId,
      senderName: myName,
      senderRole: myRole,
      recipientId: contactId,
      recipientName: contactName,
      text: content,
      timestamp: new Date().toISOString(),
      read: isRecipientOnline,
      contactId,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    playMessageChime();

    try {
      const saved = await apiPost<ChatMessage>('/app/chat', {
        text: content,
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
        text: content,
        senderId: myUserId,
        senderName: myName,
        senderRole: myRole,
      });
    } catch {
      // Message remains in state
    } finally {
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

        {/* Clear Sender & Recipient Bar (Never text yourself) */}
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
            <span>Recipient is currently offline. Messages are saved to the database and will be delivered upon login.</span>
            <a href={`tel:${contactPhone}`} className="text-emerald-400 hover:underline flex items-center gap-1 ml-2 flex-shrink-0">
              <Phone className="w-3 h-3" /> Call GSM
            </a>
          </div>
        )}

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-950/50">
          {messages.map((msg) => {
            const isMe = msg.senderId === myUserId || msg.senderId === 'me';
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
                  {msg.text}
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

        {/* Chat Input Field */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
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
          <button
            onClick={() => void handleSendMessage()}
            disabled={!inputText.trim() || isSending}
            className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white shadow-md shadow-brand-600/20 transition-all flex-shrink-0"
            title="Send Real Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
