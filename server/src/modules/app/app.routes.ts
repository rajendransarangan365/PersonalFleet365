import { Router, Request, Response } from 'express';
import versionData from '../../version.json';

const router = Router();

/**
 * GET /api/v1/app/version
 * Public endpoint returning current application version, changelog, and APK download links.
 */
router.get('/version', (req: Request, res: Response) => {
  const clientVersion = req.query.clientVersion as string | undefined;
  const currentServerVersion = (versionData.version as string) || '1.0.0';

  let hasUpdate = false;
  if (clientVersion && clientVersion !== currentServerVersion) {
    // Simple semver check
    const [cMajor = 0, cMinor = 0, cPatch = 0] = clientVersion.split('.').map(Number);
    const [sMajor = 0, sMinor = 0, sPatch = 0] = currentServerVersion.split('.').map(Number);

    if (
      sMajor > cMajor ||
      (sMajor === cMajor && sMinor > cMinor) ||
      (sMajor === cMajor && sMinor === cMinor && sPatch > cPatch)
    ) {
      hasUpdate = true;
    }
  }

  res.json({
    ...versionData,
    clientReportedVersion: clientVersion ?? null,
    hasUpdate,
    serverTimestamp: new Date().toISOString(),
  });
});

/**
 * In-memory / persisted stores for active real-time app interactions
 */
interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'driver' | 'manager' | 'admin';
  text: string;
  timestamp: string;
  read: boolean;
}

interface AppNotification {
  id: string;
  type: 'trip' | 'maintenance' | 'emi' | 'chat' | 'speed' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    senderId: 'mgr-1',
    senderName: 'Fleet Manager (Kishore)',
    senderRole: 'manager',
    text: 'Good morning Karthik. New pick & drop assigned for Chennai Airport terminal 1 at 10:30 AM.',
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    read: true,
  },
  {
    id: 'msg-2',
    senderId: 'driver-1',
    senderName: 'Karthik Raja',
    senderRole: 'driver',
    text: 'Received! Dzire Tour CNG tank full. Starting now.',
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    read: true,
  },
  {
    id: 'msg-3',
    senderId: 'mgr-1',
    senderName: 'Fleet Manager (Kishore)',
    senderRole: 'manager',
    text: 'Drive safely. Maintain optimal 55-60 km/h speed for best mileage economy.',
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    read: true,
  },
];

const mockNotifications: AppNotification[] = [
  {
    id: 'notif-1',
    type: 'trip',
    title: 'New Trip Assigned',
    message: 'Pickup at Chennai Airport T1 to OMR IT Park (TN01BV4589)',
    timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    read: false,
    actionUrl: '/driver-portal',
  },
  {
    id: 'notif-2',
    type: 'maintenance',
    title: 'Service Due Soon',
    message: 'Vehicle TN01BV4589 is at 42,150 km. Engine oil inspection recommended in 350 km.',
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    read: false,
    actionUrl: '/maintenance',
  },
  {
    id: 'notif-3',
    type: 'emi',
    title: 'Monthly EMI Due Reminder',
    message: 'HDFC Car Loan EMI of ₹14,200 due on 15th Oct.',
    timestamp: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    read: true,
    actionUrl: '/finance',
  },
  {
    id: 'notif-4',
    type: 'chat',
    title: 'New Dispatch Message',
    message: 'Fleet Manager: Please confirm pickup time when passenger arrives.',
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    read: false,
    actionUrl: '/driver-portal',
  },
];

// GET /api/v1/app/notifications
router.get('/notifications', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: mockNotifications,
    unreadCount: mockNotifications.filter((n) => !n.read).length,
  });
});

// POST /api/v1/app/notifications/mark-read
router.post('/notifications/mark-read', (req: Request, res: Response) => {
  const { id } = req.body as { id?: string };
  if (id) {
    const notif = mockNotifications.find((n) => n.id === id);
    if (notif) notif.read = true;
  } else {
    mockNotifications.forEach((n) => (n.read = true));
  }
  res.json({ success: true, unreadCount: mockNotifications.filter((n) => !n.read).length });
});

// GET /api/v1/app/chat
router.get('/chat', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: mockChatMessages,
  });
});

// POST /api/v1/app/chat
router.post('/chat', (req: Request, res: Response) => {
  const { text, senderRole, senderName } = req.body as { text: string; senderRole?: 'driver' | 'manager'; senderName?: string };
  if (!text || !text.trim()) {
    res.status(400).json({ success: false, message: 'Message text is required' });
    return;
  }

  const newMsg: ChatMessage = {
    id: `msg-${Date.now()}`,
    senderId: senderRole === 'driver' ? 'driver-1' : 'mgr-1',
    senderName: senderName || (senderRole === 'driver' ? 'Karthik Raja (Driver)' : 'Fleet Manager'),
    senderRole: senderRole || 'driver',
    text: text.trim(),
    timestamp: new Date().toISOString(),
    read: false,
  };

  mockChatMessages.push(newMsg);

  // If driver sent message, also generate a manager notification
  if (newMsg.senderRole === 'driver') {
    mockNotifications.unshift({
      id: `notif-${Date.now()}`,
      type: 'chat',
      title: 'New Message from Driver',
      message: `${newMsg.senderName}: "${newMsg.text.slice(0, 50)}${newMsg.text.length > 50 ? '...' : ''}"`,
      timestamp: new Date().toISOString(),
      read: false,
      actionUrl: '/driver-portal',
    });
  }

  res.status(201).json({ success: true, data: newMsg });
});

// POST /api/v1/app/call/signal
router.post('/call/signal', (req: Request, res: Response) => {
  const { action, callerRole, targetPhone } = req.body as { action: 'start' | 'end' | 'ping'; callerRole?: string; targetPhone?: string };
  res.json({
    success: true,
    data: {
      action,
      status: action === 'start' ? 'ringing' : 'idle',
      callerRole: callerRole || 'driver',
      targetPhone: targetPhone || '+91 1234567890',
      connectedAt: action === 'start' ? new Date().toISOString() : null,
      channelId: 'fleet-channel-secure-01',
    },
  });
});

export default router;
