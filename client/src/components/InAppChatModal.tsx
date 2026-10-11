import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, X, Shield, Phone, Sparkles,
  CheckCheck, User, ArrowDown, Mic, Paperclip, Volume2, Car
} from 'lucide-react';
import { apiGet, apiPost } from '../services/api.js';
import { playMessageChime } from '../utils/audioAlerts.js';
import type { FleetContact } from '../store/contacts.store.js';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'driver' | 'manager' | 'admin' | 'customer' | 'telecaller';
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
  const contactName = contact?.name || driverName || 'Fleet Dispatch Manager';
  const contactRole = contact?.role || 'manager';
  const contactId = contact?.id || 'mgr-01';

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(`fw_chat_${contactId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [
      {
        id: 'msg-init-1',
        senderId: contactId,
        senderName: contactName,
        senderRole: contactRole as any,
        text: `Hello, this is ${contactName}. How can I assist you with the fleet schedule?`,
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        read: true,
        contactId,
      },
    ];
  });

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync to storage
  useEffect(() => {
    localStorage.setItem(`fw_chat_${contactId}`, JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, contactId]);

  // Periodically poll for updates & play chime on new message
  useEffect(() => {
    if (!isOpen) return;

    const fetchMessages = async () => {
      try {
        const res = await apiGet<ChatMessage[]>('/app/chat');
        if (Array.isArray(res) && res.length > 0) {
          setMessages((prev) => {
            const newMsgs = res.filter((m) => !prev.some((p) => p.id === m.id));
            if (newMsgs.length > 0) {
              playMessageChime();
              return [...prev, ...newMsgs];
            }
            return prev;
          });
        }
      } catch {}
    };

    void fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content || isSending) return;

    setIsSending(true);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: 'me',
      senderName: 'You',
      senderRole: 'admin',
      text: content,
      timestamp: new Date().toISOString(),
      read: true,
      contactId,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    playMessageChime();

    try {
      await apiPost('/app/chat', {
        text: content,
        senderRole: 'admin',
        senderName: 'Fleet Controller',
        contactId,
      });
    } catch {}

    // Simulate smart auto-reply from driver or manager after 1.8 seconds
    setTimeout(() => {
      let reply = 'Message acknowledged. Updating system status.';
      if (content.toLowerCase().includes('pickup') || content.toLowerCase().includes('starting')) {
        reply = 'Copy that! GPS tracker is broadcasting route. Safe driving!';
      } else if (content.toLowerCase().includes('fuel')) {
        reply = 'Fuel expense noted. Please upload the fuel pump slip photo.';
      } else if (content.toLowerCase().includes('traffic')) {
        reply = 'Passenger notified about delay. Take the bypass flyover if clear.';
      } else if (content.toLowerCase().includes('emergency') || content.toLowerCase().includes('sos')) {
        reply = 'Alert triggered! Telecaller support desk is dialling your mobile now.';
      }

      const autoReply: ChatMessage = {
        id: `msg-reply-${Date.now()}`,
        senderId: contactId,
        senderName: contactName,
        senderRole: contactRole as any,
        text: reply,
        timestamp: new Date().toISOString(),
        read: false,
        contactId,
      };

      setMessages((prev) => [...prev, autoReply]);
      playMessageChime();
      setIsSending(false);
    }, 1800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl max-w-lg w-full h-[600px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Chat Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                {contactName[0]?.toUpperCase() ?? 'F'}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
            </div>

            <div>
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                {contactName}
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <span className="capitalize">{contactRole.replace('_', ' ')}</span>
                {contact?.vehiclePlate && (
                  <>
                    <span>•</span>
                    <span className="text-brand-400 font-mono font-semibold">{contact.vehiclePlate}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Direct Call Button inside Chat */}
            {onStartCall && contact && (
              <button
                onClick={() => {
                  onStartCall(contact);
                  onClose();
                }}
                className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-colors"
                title={`Call ${contactName} via in-app VoIP`}
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

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-950/40">
          {messages.map((msg) => {
            const isMe = msg.senderId === 'me' || msg.senderRole === 'admin';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
              >
                <span className="text-[10px] text-slate-500 px-1 font-mono">
                  {msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
        <div className="px-3 py-2 border-t border-slate-800 bg-slate-900/60 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
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
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
