import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store.js';
import { getServerHostUrl } from './api.js';

let socket: Socket | null = null;
let currentRegisteredUserId: string | null = null;

export interface OnlineUserPresence {
  userId: string;
  displayName: string;
  role: string;
  phone?: string;
  vehiclePlate?: string;
  status: 'online' | 'busy' | 'offline';
}

type OnlineUsersListener = (users: OnlineUserPresence[]) => void;
type OfflineAlertListener = (alert: any) => void;

const onlineUsersListeners = new Set<OnlineUsersListener>();
const offlineAlertListeners = new Set<OfflineAlertListener>();
let onlineUsersList: OnlineUserPresence[] = [];

export function getSocket(): Socket {
  if (socket) return socket;

  let socketUrl = '';
  if (typeof window !== 'undefined') {
    const isCapacitor = Boolean(
      (window as any).Capacitor?.isNativePlatform?.() ||
      window.location.protocol === 'capacitor:'
    );

    if (isCapacitor) {
      const serverHost = getServerHostUrl();
      socketUrl = serverHost || 'http://10.0.2.2:5000';
    } else {
      // Browser: use current origin (Vite proxies /socket.io to backend :5000)
      const serverHost = getServerHostUrl();
      socketUrl = serverHost || window.location.origin;
    }
  }

  socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    // Register user with socket on connect
    registerCurrentUser();
  });

  socket.on('users:online_list', (users: OnlineUserPresence[]) => {
    onlineUsersList = users;
    onlineUsersListeners.forEach((fn) => fn(users));
  });

  socket.on('driver:offline_alert', (alert: any) => {
    offlineAlertListeners.forEach((fn) => fn(alert));
    // Trigger toast in app
    window.dispatchEvent(new CustomEvent('fleet:driver-offline', { detail: alert }));
  });

  socket.on('support:urgent_alert', (alert: any) => {
    window.dispatchEvent(new CustomEvent('fleet:support-alert', { detail: alert }));
  });

  socket.on('disconnect', () => {
    currentRegisteredUserId = null;
  });

  return socket;
}

export function registerCurrentUser() {
  if (!socket || !socket.connected) return;

  const authState = useAuthStore.getState();
  const user = authState.user;
  const activeBusinessId = authState.activeBusinessId || 'demo_fleet_biz_01';

  if (!user) return;

  const u = user as any;
  const userId = u.id || u._id || 'usr-guest';
  if (currentRegisteredUserId === userId) return;

  currentRegisteredUserId = userId;

  socket.emit('user:register', {
    userId,
    displayName: user.displayName || 'Fleet User',
    role: u.role || 'user',
    phone: u.phone || (u.role === 'driver' ? '+91 98401 23456' : '+91 98410 11223'),
    vehiclePlate: u.vehiclePlate || (u.role === 'driver' ? 'TN01BV4589' : undefined),
    businessId: activeBusinessId,
  });
}

export function isUserCurrentlyOnline(userId: string): boolean {
  return onlineUsersList.some((u) => u.userId === userId && u.status !== 'offline');
}

export function getCachedOnlineUsers(): OnlineUserPresence[] {
  return onlineUsersList;
}

export function subscribeToOnlineUsers(listener: OnlineUsersListener): () => void {
  onlineUsersListeners.add(listener);
  listener(onlineUsersList);
  return () => {
    onlineUsersListeners.delete(listener);
  };
}

export function subscribeToDriverOfflineAlerts(listener: OfflineAlertListener): () => void {
  offlineAlertListeners.add(listener);
  return () => {
    offlineAlertListeners.delete(listener);
  };
}
