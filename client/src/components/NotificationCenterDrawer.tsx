import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, CheckCheck, Trash2, MapPin, Wrench, CreditCard,
  MessageSquare, AlertTriangle, ShieldCheck, ExternalLink, X, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../services/api.js';

export interface AppNotificationItem {
  id: string;
  type: 'trip' | 'maintenance' | 'emi' | 'chat' | 'speed' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

const DEFAULT_NOTIFICATIONS: AppNotificationItem[] = [
  {
    id: 'n-1',
    type: 'trip',
    title: 'New Trip Assigned',
    message: 'Pickup at Chennai Airport T1 to OMR IT Park (Vehicle: TN01BV4589 - Dzire Tour S)',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    read: false,
    actionUrl: '/driver-portal',
  },
  {
    id: 'n-2',
    type: 'chat',
    title: 'New Message from Fleet Manager',
    message: 'Kishore: "Please confirm passenger pickup time once they board."',
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    read: false,
    actionUrl: '/driver-portal',
  },
  {
    id: 'n-3',
    type: 'maintenance',
    title: 'Vehicle Maintenance Inspection',
    message: 'Innova Crysta TN09CD3312 reaches 50,000 km. Scheduled oil service recommended.',
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    read: false,
    actionUrl: '/maintenance',
  },
  {
    id: 'n-4',
    type: 'emi',
    title: 'Upcoming Loan EMI Reminder',
    message: 'Dzire Tour S loan EMI of ₹14,200 due on 15th October.',
    timestamp: new Date(Date.now() - 360 * 60 * 1000).toISOString(),
    read: true,
    actionUrl: '/finance',
  },
  {
    id: 'n-5',
    type: 'speed',
    title: 'Safe Driving Economy Alert',
    message: 'Average trip fuel efficiency 26.8 km/kg CNG maintained. Excellent driving economy!',
    timestamp: new Date(Date.now() - 720 * 60 * 1000).toISOString(),
    read: true,
    actionUrl: '/driver-portal',
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export default function NotificationCenterDrawer({ isOpen, onClose, onUnreadCountChange }: Props) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotificationItem[]>(() => {
    const saved = localStorage.getItem('fw_notifications');
    return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATIONS;
  });
  const [filter, setFilter] = useState<'all' | 'unread' | 'trips' | 'alerts'>('all');
  const [pushStatus, setPushStatus] = useState<NotificationPermission>('default');

  // Check push permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushStatus(Notification.permission);
    }
  }, []);

  // Sync to parent & storage
  useEffect(() => {
    const unread = notifications.filter((n) => !n.read).length;
    onUnreadCountChange?.(unread);
    localStorage.setItem('fw_notifications', JSON.stringify(notifications));
  }, [notifications, onUnreadCountChange]);

  // Fetch live notifications from server if available
  const fetchServerNotifications = useCallback(async () => {
    try {
      const res = await apiGet<AppNotificationItem[]>('/app/notifications');
      if (Array.isArray(res)) {
        setNotifications((prev) => {
          // Merge server notifications with local notifications
          const map = new Map<string, AppNotificationItem>();
          res.forEach((n) => map.set(n.id, n));
          prev.forEach((n) => {
            if (!map.has(n.id)) map.set(n.id, n);
          });
          return Array.from(map.values());
        });
      }
    } catch {
      // Offline fallback already loaded from storage
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchServerNotifications();
    }
  }, [isOpen, fetchServerNotifications]);

  const requestPushPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setPushStatus(perm);
        if (perm === 'granted') {
          new Notification('FleetWise Notifications Enabled', {
            body: 'You will now receive instant trip assignments, driver alerts, and EMI reminders.',
            icon: '/icons/icon-192.png',
          });
        }
      } catch (err) {
        console.warn('Failed to request push permission:', err);
      }
    }
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    void apiPost('/app/notifications/mark-read', {}).catch(() => {});
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const handleItemClick = (notif: AppNotificationItem) => {
    // Mark this one as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    void apiPost('/app/notifications/mark-read', { id: notif.id }).catch(() => {});
    onClose();
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'trips') return n.type === 'trip';
    if (filter === 'alerts') return n.type === 'maintenance' || n.type === 'emi' || n.type === 'speed';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-slate-900 border-l border-slate-700/80 h-full flex flex-col shadow-2xl animate-slide-in"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <span className="bg-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">Fleet dispatches, vehicle & loan alerts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Push Notification Opt-in Prompt */}
        {pushStatus !== 'granted' && (
          <div className="px-4 py-2.5 bg-gradient-to-r from-brand-950/40 to-slate-900 border-b border-brand-500/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-brand-300">
              <ShieldCheck className="w-4 h-4 text-brand-400 flex-shrink-0" />
              <span>Enable native push alerts for missed trips</span>
            </div>
            <button
              onClick={requestPushPermission}
              className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-semibold text-[11px] transition-colors"
            >
              Enable
            </button>
          </div>
        )}

        {/* Filter Pills & Actions */}
        <div className="px-4 py-2 border-b border-slate-800/80 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1">
            {(['all', 'unread', 'trips', 'alerts'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded-lg capitalize transition-colors font-medium text-[11px] ${
                  filter === tab
                    ? 'bg-brand-500 text-white font-semibold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark read</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-[11px] text-slate-500 hover:text-rose-400 flex items-center gap-1 font-medium"
                title="Clear all notifications"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredNotifications.length === 0 ? (
            <div className="py-16 text-center space-y-2 text-slate-500">
              <Bell className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm font-medium">No {filter !== 'all' ? filter : ''} notifications</p>
              <p className="text-xs text-slate-600">You are all caught up with your fleet updates!</p>
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const isTrip = n.type === 'trip';
              const isMaint = n.type === 'maintenance';
              const isEmi = n.type === 'emi';
              const isChat = n.type === 'chat';

              return (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 text-left ${
                    !n.read
                      ? 'bg-slate-800/80 border-brand-500/30 hover:bg-slate-800 shadow-sm'
                      : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800/40 opacity-80'
                  }`}
                >
                  {/* Icon indicator */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isTrip
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : isMaint
                      ? 'bg-amber-500/20 text-amber-400'
                      : isEmi
                      ? 'bg-blue-500/20 text-blue-400'
                      : isChat
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {isTrip && <MapPin className="w-4 h-4" />}
                    {isMaint && <Wrench className="w-4 h-4" />}
                    {isEmi && <CreditCard className="w-4 h-4" />}
                    {isChat && <MessageSquare className="w-4 h-4" />}
                    {!isTrip && !isMaint && !isEmi && !isChat && <AlertTriangle className="w-4 h-4" />}
                  </div>

                  {/* Text details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className={`text-xs font-semibold truncate ${!n.read ? 'text-white' : 'text-slate-300'}`}>
                        {n.title}
                      </h4>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                      <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-brand-400 flex items-center gap-0.5">
                        View details <ChevronRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
