import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { logger } from '../utils/logger.js';
import {
  ChatMessageModel,
  CallLogModel,
  TaxiBookingModel,
  DriverDutyModel,
  NotificationModel,
} from '../models/index.js';

export interface ConnectedUser {
  socketId: string;
  userId: string;
  displayName: string;
  role: string;
  phone?: string | undefined;
  vehiclePlate?: string | undefined;
  businessId?: string | undefined;
  status: 'online' | 'busy' | 'offline';
  connectedAt: Date;
}

let io: SocketIOServer | null = null;
const connectedUsers = new Map<string, ConnectedUser>(); // Key: userId
const socketToUserId = new Map<string, string>(); // Key: socketId -> userId

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  logger.info('🔌 Socket.IO signaling server initialized');

  io.on('connection', (socket: Socket) => {
    logger.info(`⚡ Socket client connected: ${socket.id}`);

    // ─── User Registration / Handshake ─────────────────────────────────────
    socket.on('user:register', async (userData: {
      userId: string;
      displayName: string;
      role: string;
      phone?: string;
      vehiclePlate?: string;
      businessId?: string;
    }) => {
      if (!userData?.userId) return;

      const userRecord: ConnectedUser = {
        socketId: socket.id,
        userId: userData.userId,
        displayName: userData.displayName || 'Fleet User',
        role: userData.role || 'user',
        phone: userData.phone,
        vehiclePlate: userData.vehiclePlate,
        businessId: userData.businessId || 'demo_fleet_biz_01',
        status: 'online',
        connectedAt: new Date(),
      };

      connectedUsers.set(userData.userId, userRecord);
      socketToUserId.set(socket.id, userData.userId);

      // Join rooms
      socket.join(`user:${userData.userId}`);
      socket.join(`role:${userData.role}`);
      if (userData.businessId) {
        socket.join(`business:${userData.businessId}`);
      }

      logger.info(`👤 User registered online: ${userData.displayName} (${userData.role}) [${userData.userId}]`);

      // If user is driver, update driver duty
      if (userData.role === 'driver') {
        try {
          await DriverDutyModel.findOneAndUpdate(
            { driverId: userData.userId },
            {
              driverName: userData.displayName,
              phone: userData.phone || '+91 98401 23456',
              vehiclePlate: userData.vehiclePlate || 'TN01BV4589',
              status: 'online',
              lastStatusChange: new Date(),
              offlineNotifiedToOwner: false,
              businessId: userData.businessId || 'demo_fleet_biz_01',
            },
            { upsert: true, new: true },
          );

          // Intimate owner/managers that driver is online
          io?.emit('driver:status_changed', {
            driverId: userData.userId,
            driverName: userData.displayName,
            vehiclePlate: userData.vehiclePlate || 'TN01BV4589',
            status: 'online',
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          logger.error('Error updating driver duty on connect', { err });
        }
      }

      // Broadcast updated online presence
      broadcastOnlineUsers();
    });

    // ─── Chat Message (Real DB & Live Delivery, NO Ghost Replies) ─────────
    socket.on('chat:send', async (msgData: {
      recipientId: string;
      recipientName?: string;
      recipientRole?: string;
      text: string;
      senderId?: string;
      senderName?: string;
      senderRole?: string;
      businessId?: string;
    }) => {
      const senderUserId = socketToUserId.get(socket.id) || msgData.senderId || 'anonymous';
      const senderInfo = connectedUsers.get(senderUserId);

      const senderName = senderInfo?.displayName || msgData.senderName || 'Fleet Operator';
      const senderRole = senderInfo?.role || msgData.senderRole || 'admin';
      const businessId = senderInfo?.businessId || msgData.businessId || 'demo_fleet_biz_01';

      if (!msgData.text || !msgData.text.trim()) return;

      const isRecipientOnline = isUserOnline(msgData.recipientId);

      let savedMsg;
      try {
        savedMsg = await ChatMessageModel.create({
          senderId: senderUserId,
          senderName,
          senderRole,
          recipientId: msgData.recipientId,
          recipientName: msgData.recipientName,
          recipientRole: msgData.recipientRole,
          text: msgData.text.trim(),
          read: isRecipientOnline,
          businessId,
        });
      } catch {
        // In-memory fallback
        savedMsg = {
          _id: `msg-${Date.now()}`,
          id: `msg-${Date.now()}`,
          senderId: senderUserId,
          senderName,
          senderRole,
          recipientId: msgData.recipientId,
          recipientName: msgData.recipientName,
          recipientRole: msgData.recipientRole,
          text: msgData.text.trim(),
          read: isRecipientOnline,
          businessId,
          createdAt: new Date(),
        };
      }

      // Acknowledge back to sender
      socket.emit('chat:sent', savedMsg);

      // Deliver to recipient if online
      // Deliver to recipient if online and not self
      if (isRecipientOnline && msgData.recipientId !== senderUserId) {
        io?.to(`user:${msgData.recipientId}`).emit('chat:receive', savedMsg);
      } else if (!isRecipientOnline) {
        logger.info(`Recipient ${msgData.recipientId} is offline. Message saved in DB as unread.`);
      }

      // If driver sent message, also notify owner & manager
      if (senderRole === 'driver') {
        const notif = {
          type: 'chat',
          title: `Message from Driver (${senderName})`,
          message: `${senderName}: "${msgData.text.slice(0, 60)}"`,
          timestamp: new Date().toISOString(),
          actionUrl: '/trips',
        };
        io?.to('role:fleet_owner').emit('notification:new', notif);
        io?.to('role:fleet_manager').emit('notification:new', notif);
      }
    });

    // ─── In-App VoIP Call Signaling (Strictly Online Only, NO Auto-Connect) ──
    socket.on('call:initiate', async (callData: {
      targetId: string;
      targetName: string;
      targetRole?: string;
      targetPhone?: string;
      vehiclePlate?: string;
      callerId?: string;
      callerName?: string;
      callerRole?: string;
      callerPhone?: string;
    }) => {
      const callerUserId = socketToUserId.get(socket.id) || callData.callerId || 'me';
      const callerInfo = connectedUsers.get(callerUserId);

      const callerName = callerInfo?.displayName || callData.callerName || 'Fleet Dispatcher';
      const callerRole = callerInfo?.role || callData.callerRole || 'fleet_owner';
      const callerPhone = callerInfo?.phone || callData.callerPhone || '+91 98410 11223';

      const targetUserId = callData.targetId;

      // Prevent calling self
      if (targetUserId === callerUserId) {
        logger.warn(`Call rejected: User ${callerUserId} attempted to call themselves.`);
        socket.emit('call:recipient_offline', {
          targetId: targetUserId,
          targetName: callData.targetName,
          targetPhone: callData.targetPhone,
          message: 'Cannot call yourself. Please select another contact or driver from the directory.',
        });
        return;
      }

      const targetUser = connectedUsers.get(targetUserId);

      // Check if target user is actually online
      if (!targetUser) {
        logger.warn(`Call rejected: target user ${targetUserId} (${callData.targetName}) is OFFLINE`);

        // Record failed call in DB
        try {
          await CallLogModel.create({
            callId: `call_${Date.now()}`,
            callerId: callerUserId,
            callerName,
            callerRole,
            callerPhone,
            targetId: targetUserId,
            targetName: callData.targetName,
            targetRole: callData.targetRole || 'driver',
            targetPhone: callData.targetPhone,
            vehiclePlate: callData.vehiclePlate,
            status: 'offline_failed',
            durationSeconds: 0,
            startedAt: new Date(),
            endedAt: new Date(),
          });
        } catch {}

        // Immediately inform caller that recipient is offline
        socket.emit('call:recipient_offline', {
          targetId: targetUserId,
          targetName: callData.targetName,
          targetPhone: callData.targetPhone,
          message: `${callData.targetName} is currently OFFLINE. Cannot establish in-app call.`,
        });
        return;
      }

      // Target IS online: Create session and ring target's device
      const callSession = {
        callId: `call_${Date.now()}`,
        callerId: callerUserId,
        callerName,
        callerRole,
        callerPhone,
        targetId: targetUserId,
        targetName: targetUser.displayName,
        targetRole: targetUser.role,
        targetPhone: targetUser.phone || callData.targetPhone,
        vehiclePlate: callData.vehiclePlate || targetUser.vehiclePlate,
        status: 'ringing',
        startedAt: new Date().toISOString(),
      };

      // Notify caller that target's phone is ringing
      socket.emit('call:ringing', callSession);

      // Ring target device
      io?.to(`user:${targetUserId}`).emit('call:incoming', callSession);
      logger.info(`📞 Ringing ${targetUser.displayName} (${targetUserId}) from ${callerName}`);
    });

    socket.on('call:accept', async (sessionData: { callId: string; callerId: string; targetId: string }) => {
      logger.info(`✅ Call accepted: ${sessionData.callId}`);
      io?.to(`user:${sessionData.callerId}`).emit('call:accepted', sessionData);
      io?.to(`user:${sessionData.targetId}`).emit('call:connected', sessionData);
    });

    socket.on('call:reject', async (sessionData: { callId: string; callerId: string; targetId: string }) => {
      logger.info(`❌ Call declined: ${sessionData.callId}`);
      io?.to(`user:${sessionData.callerId}`).emit('call:declined', {
        ...sessionData,
        message: 'Call declined by recipient.',
      });
      io?.to(`user:${sessionData.targetId}`).emit('call:ended', sessionData);
    });

    socket.on('call:end', async (sessionData: { callId: string; callerId: string; targetId: string; duration?: number }) => {
      logger.info(`📴 Call ended: ${sessionData.callId}`);
      io?.to(`user:${sessionData.callerId}`).emit('call:ended', sessionData);
      io?.to(`user:${sessionData.targetId}`).emit('call:ended', sessionData);

      try {
        await CallLogModel.findOneAndUpdate(
          { callId: sessionData.callId },
          {
            status: 'completed',
            durationSeconds: sessionData.duration || 0,
            endedAt: new Date(),
          },
          { upsert: true },
        );
      } catch {}
    });

    // WebRTC Signaling Relay (SDP Offer / Answer / ICE Candidates)
    socket.on('call:webrtc_signal', (payload: { targetUserId: string; signal: unknown }) => {
      if (payload.targetUserId) {
        io?.to(`user:${payload.targetUserId}`).emit('call:webrtc_signal', {
          senderSocketId: socket.id,
          signal: payload.signal,
        });
      }
    });

    // ─── Driver Duty Status (Online / Offline) & Owner Intimation ─────────
    socket.on('driver:set_status', async (dutyData: {
      driverId: string;
      driverName: string;
      status: 'online' | 'offline';
      vehiclePlate?: string;
      businessId?: string;
    }) => {
      const driverId = dutyData.driverId;
      const status = dutyData.status;
      const driverName = dutyData.driverName || 'Driver';
      const vehiclePlate = dutyData.vehiclePlate || 'TN01BV4589';
      const businessId = dutyData.businessId || 'demo_fleet_biz_01';

      logger.info(`🚦 Driver ${driverName} (${driverId}) changed duty status to: ${status.toUpperCase()}`);

      try {
        await DriverDutyModel.findOneAndUpdate(
          { driverId },
          {
            driverName,
            status,
            vehiclePlate,
            lastStatusChange: new Date(),
            offlineNotifiedToOwner: status === 'offline',
            businessId,
          },
          { upsert: true, new: true },
        );
      } catch (err) {
        logger.error('Error updating driver duty in DB', { err });
      }

      // If driver went OFFLINE, intimate the company owner and managers
      if (status === 'offline') {
        const alertMessage = `Driver ${driverName} (${vehiclePlate}) went OFFLINE. Vehicle is currently parked.`;

        try {
          await NotificationModel.create({
            businessId,
            type: 'driver_offline',
            title: '⚠️ Driver Went Offline',
            message: alertMessage,
            isRead: false,
          });
        } catch {}

        // Emit instant high-priority alert to Owner & Manager sockets
        const alertPayload = {
          type: 'driver_offline',
          driverId,
          driverName,
          vehiclePlate,
          status: 'offline',
          timestamp: new Date().toISOString(),
          title: '⚠️ Driver Went Offline',
          message: alertMessage,
        };

        io?.to('role:fleet_owner').emit('driver:offline_alert', alertPayload);
        io?.to('role:fleet_manager').emit('driver:offline_alert', alertPayload);
        io?.to(`business:${businessId}`).emit('driver:status_changed', alertPayload);
      } else {
        io?.emit('driver:status_changed', {
          driverId,
          driverName,
          vehiclePlate,
          status: 'online',
          timestamp: new Date().toISOString(),
        });
      }

      broadcastOnlineUsers();
    });

    // ─── Taxi Bookings (Ola / Uber Style Real-Time Broadcasts) ────────────
    socket.on('booking:new', async (bookingData: unknown) => {
      logger.info('🚕 New Taxi Booking created - broadcasting to Owner, Manager, Call Center & Drivers');
      io?.to('role:fleet_owner').emit('booking:broadcast', bookingData);
      io?.to('role:fleet_manager').emit('booking:broadcast', bookingData);
      io?.to('role:telecaller').emit('booking:broadcast', bookingData);
      io?.to('role:driver').emit('booking:broadcast', bookingData);
    });

    socket.on('booking:status_update', (updatedBooking: { id: string; status: string; customerId?: string; assignedDriverId?: string }) => {
      logger.info(`🚕 Booking status updated to: ${updatedBooking.status}`);
      io?.emit('booking:updated', updatedBooking);
    });

    socket.on('booking:problem_reported', (issueData: {
      bookingId: string;
      customerName: string;
      customerPhone: string;
      issueDetails: string;
      assignedDriverName?: string;
    }) => {
      logger.warn(`🆘 Taxi Booking Issue Reported on #${issueData.bookingId}: ${issueData.issueDetails}`);

      const alert = {
        type: 'booking_issue',
        title: `🆘 Customer Issue on #${issueData.bookingId}`,
        message: `${issueData.customerName} reported: "${issueData.issueDetails}". Call center intervention requested.`,
        bookingId: issueData.bookingId,
        timestamp: new Date().toISOString(),
      };

      io?.to('role:telecaller').emit('support:urgent_alert', alert);
      io?.to('role:fleet_owner').emit('support:urgent_alert', alert);
      io?.to('role:fleet_manager').emit('support:urgent_alert', alert);
    });

    // ─── Disconnect Handler ────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const userId = socketToUserId.get(socket.id);
      if (userId) {
        const user = connectedUsers.get(userId);
        if (user) {
          logger.info(`🔌 User disconnected: ${user.displayName} (${user.role})`);

          // If driver disconnected, intimate owner
          if (user.role === 'driver') {
            try {
              await DriverDutyModel.findOneAndUpdate(
                { driverId: userId },
                {
                  status: 'offline',
                  lastStatusChange: new Date(),
                  offlineNotifiedToOwner: true,
                },
              );

              const offlineAlert = {
                type: 'driver_offline',
                driverId: userId,
                driverName: user.displayName,
                vehiclePlate: user.vehiclePlate || 'TN01BV4589',
                status: 'offline',
                timestamp: new Date().toISOString(),
                title: '⚠️ Driver Disconnected (Offline)',
                message: `Driver ${user.displayName} closed application or disconnected. Marked OFFLINE.`,
              };

              io?.to('role:fleet_owner').emit('driver:offline_alert', offlineAlert);
              io?.to('role:fleet_manager').emit('driver:offline_alert', offlineAlert);
            } catch {}
          }

          connectedUsers.delete(userId);
        }
        socketToUserId.delete(socket.id);
        broadcastOnlineUsers();
      }
    });
  });

  return io;
}

export function getIo(): SocketIOServer | null {
  return io;
}

export function isUserOnline(userId: string): boolean {
  return connectedUsers.has(userId);
}

export function getOnlineUsers(): ConnectedUser[] {
  return Array.from(connectedUsers.values());
}

function broadcastOnlineUsers() {
  if (!io) return;
  const list = Array.from(connectedUsers.values()).map((u) => ({
    userId: u.userId,
    displayName: u.displayName,
    role: u.role,
    phone: u.phone,
    vehiclePlate: u.vehiclePlate,
    status: u.status,
  }));
  io.emit('users:online_list', list);
}
