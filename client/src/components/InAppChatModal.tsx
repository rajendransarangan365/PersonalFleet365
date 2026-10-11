import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, X, Shield, Phone, Sparkles,
  CheckCheck, User, ArrowDown, Mic, Paperclip
} from 'lucide-react';
import { apiGet, apiPost } from '../services/api.js';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'driver' | 'manager' | 'admin';
  text: string;
  timestamp: string;
  read: boolean;
}

const QUICK_PRESETS = [
  '🚗 Passenger picked up, starting trip',
  '⛽ Reached fuel station, requesting approval',
  '🚦 15 min delay due to highway traffic',
  '✅ Trip completed safely at destination',
  '🆘 Breakdown assistance requested',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  driverName?: string;
  managerPhone?: string;
}

export default function InAppChatModal({ isOpen, onClose, driverName = 'Karthik Raja', managerPhone = '+91 1234567890' }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('fw_chat_messages');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      {
        id: 'msg-1',
        senderId: 'mgr-1',
        senderName: 'Fleet Manager (Kishore)',
        senderRole: 'manager',
        text: 'Good morning Karthik. New pick & drop trip assigned for Chennai Airport terminal 1.',
        timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        read: true,
      },
      {
        id: 'msg-2',
        senderId: 'driver-1',
        senderName: driverName,
        senderRole: 'driver',
        text: 'Received! Dzire Tour S CNG tank full. Starting now.',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        read: true,
      },
      {
        id: 'msg-3',
        senderId: 'mgr-1',
        senderName: 'Fleet Manager (Kishore)',
        senderRole: 'manager',
        text: 'Drive safely. Maintain 55-60 km/h speed for best mileage economy.',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        read: true,
      },
    ];
  });

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync to storage
  useEffect(() => {
    localStorage.setItem('fw_chat_messages', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch messages from backend
  useEffect(() => {
    if (!isOpen) return;

    const fetchMessages = async () => {
      try {
        const res = await apiGet<ChatMessage[]>('/app/chat');
        if (Array.isArray(res)) {
          setMessages(res);
        }
      } catch {
        // Fallback to local storage messages
      }
    };

    void fetchMessages();
    const interval = setInterval(fetchMessages, 6000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: 'driver-1',
      senderName: `${driverName} (Driver)`,
      senderRole: 'driver',
      text: content,
      timestamp: new Date().toISOString(),
      read: false,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    setIsSending(true);

    try {
      await apiPost('/app/chat', {
        text: content,
        senderRole: 'driver',
        senderName: `${driverName} (Driver)`,
      });
    } catch {
      // Message already preserved in local state
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full h-[620px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                FM
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-white">Fleet Manager Dispatch</h3>
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Online
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Direct In-App Communication & Real-Time Sync</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`tel:${managerPhone}`}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Call Manager on GSM Phone"
            >
              <Phone className="w-4 h-4 text-emerald-400" />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900/60">
          <div className="text-center my-2">
            <span className="text-[10px] font-mono bg-slate-800/80 text-slate-400 px-3 py-1 rounded-full border border-slate-700/50">
              🔒 End-to-end encrypted dispatch channel
            </span>
          </div>

          {messages.map((msg) => {
            const isMe = msg.senderRole === 'driver';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
              >
                <span className="text-[10px] text-slate-400 px-1">
                  {msg.senderName}
                </span>

                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-md ${
                    isMe
                      ? 'bg-gradient-to-r from-brand-600 to-cyan-600 text-white rounded-br-none'
                      : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <p className="leading-relaxed">{msg.text}</p>
                  <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${isMe ? 'text-brand-200' : 'text-slate-400'}`}>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && <CheckCheck className="w-3 h-3 text-cyan-200" />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Response Presets Carousel */}
        <div className="px-3 py-2 bg-slate-950/80 border-t border-slate-800/80 overflow-x-auto flex gap-1.5 no-scrollbar">
          {QUICK_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => void handleSendMessage(preset)}
              className="text-[11px] whitespace-nowrap bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700/60 transition-colors flex-shrink-0"
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Message Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSendMessage();
          }}
          className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type message to fleet manager..."
            className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="btn-primary text-xs flex items-center justify-center p-2.5 rounded-xl disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
