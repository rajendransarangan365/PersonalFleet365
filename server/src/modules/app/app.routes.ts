import { Router, Request, Response } from 'express';
import versionData from '../../version.json';
import {
  ChatMessageModel,
  CallLogModel,
  TaxiBookingModel,
  DriverDutyModel,
  NotificationModel,
  UserModel,
  BusinessMembershipModel,
  BusinessModel,
} from '../../models/index.js';
import { hashPassword } from '../../services/auth.service.js';
import { getIo, isUserOnline, getOnlineUsers } from '../../services/socket.service.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /api/v1/app/version
 * Application version and APK update checking
 */
router.get('/version', (req: Request, res: Response) => {
  const clientVersion = req.query.clientVersion as string | undefined;
  const currentServerVersion = (versionData.version as string) || '1.0.0';

  let hasUpdate = false;
  if (clientVersion && clientVersion !== currentServerVersion) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Real-time Online Users Presence
// ─────────────────────────────────────────────────────────────────────────────

router.get('/online-users', (_req: Request, res: Response) => {
  const online = getOnlineUsers();
  res.json({
    success: true,
    data: online,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Chat Messages (Saved in Database, Real socket delivery, NO Ghost Replies)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/chat', async (req: Request, res: Response) => {
  try {
    const { contactId, userId } = req.query as { contactId?: string; userId?: string };

    let query: any = {};
    if (contactId && userId) {
      query = {
        $or: [
          { senderId: userId, recipientId: contactId },
          { senderId: contactId, recipientId: userId },
        ],
      };
    } else if (contactId) {
      query = {
        $or: [
          { recipientId: contactId },
          { senderId: contactId },
        ],
      };
    }

    const messages = await ChatMessageModel.find(query)
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      data: messages.map((m) => ({
        id: String(m._id),
        senderId: m.senderId,
        senderName: m.senderName,
        senderRole: m.senderRole,
        recipientId: m.recipientId,
        recipientName: m.recipientName,
        text: m.text,
        timestamp: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
        read: m.read,
      })),
    });
  } catch (err) {
    logger.error('Error fetching chat messages', { err });
    res.json({ success: true, data: [] });
  }
});

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const {
      text,
      senderId = 'owner-01',
      senderRole = 'fleet_owner',
      senderName = 'Fleet Owner (Sarangan)',
      recipientId = 'drv-01',
      recipientName = 'Karthik Raja (Driver)',
      recipientRole = 'driver',
      businessId = 'demo_fleet_biz_01',
    } = req.body as {
      text: string;
      senderId?: string;
      senderRole?: string;
      senderName?: string;
      recipientId?: string;
      recipientName?: string;
      recipientRole?: string;
      businessId?: string;
    };

    if (!text || !text.trim()) {
      res.status(400).json({ success: false, message: 'Message text is required' });
      return;
    }

    const recipientOnline = isUserOnline(recipientId);

    const newMsg = await ChatMessageModel.create({
      senderId,
      senderName,
      senderRole,
      recipientId,
      recipientName,
      recipientRole,
      text: text.trim(),
      read: recipientOnline,
      businessId,
    });

    const formatted = {
      id: String(newMsg._id),
      senderId: newMsg.senderId,
      senderName: newMsg.senderName,
      senderRole: newMsg.senderRole,
      recipientId: newMsg.recipientId,
      recipientName: newMsg.recipientName,
      text: newMsg.text,
      timestamp: new Date(newMsg.createdAt).toISOString(),
      read: newMsg.read,
      isRecipientOnline: recipientOnline,
    };

    // Socket real-time delivery
    const io = getIo();
    if (io) {
      if (recipientOnline) {
        io.to(`user:${recipientId}`).emit('chat:receive', formatted);
      }
      io.to(`user:${senderId}`).emit('chat:sent', formatted);

      // If driver sent message, create notification for owner
      if (senderRole === 'driver') {
        const notif = await NotificationModel.create({
          businessId,
          type: 'chat',
          title: `Message from Driver (${senderName})`,
          message: `${senderName}: "${newMsg.text.slice(0, 50)}${newMsg.text.length > 50 ? '...' : ''}"`,
          isRead: false,
        });

        io.to('role:fleet_owner').emit('notification:new', notif);
        io.to('role:fleet_manager').emit('notification:new', notif);
      }
    }

    res.status(201).json({ success: true, data: formatted });
  } catch (err) {
    logger.error('Error saving chat message', { err });
    res.status(500).json({ success: false, message: 'Failed to send chat message' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// In-App Calls & Signaling
// ─────────────────────────────────────────────────────────────────────────────

router.post('/call/signal', async (req: Request, res: Response) => {
  const { action, callerId = 'owner-01', callerName = 'Fleet Owner', callerRole = 'fleet_owner', targetId, targetName = 'Driver', targetPhone } = req.body;

  const targetOnline = targetId ? isUserOnline(targetId) : false;

  if (action === 'start' && targetId && !targetOnline) {
    res.json({
      success: true,
      data: {
        action: 'offline_fail',
        status: 'offline',
        isTargetOnline: false,
        message: `${targetName} is currently OFFLINE. Cannot establish in-app call.`,
        targetPhone,
      },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      action,
      status: action === 'start' ? 'ringing' : 'idle',
      isTargetOnline: targetOnline,
      callerId,
      callerName,
      callerRole,
      targetId,
      targetPhone: targetPhone || '+91 98401 23456',
    },
  });
});

router.get('/call/logs', async (_req: Request, res: Response) => {
  try {
    const logs = await CallLogModel.find().sort({ startedAt: -1 }).limit(50).lean();
    res.json({ success: true, data: logs });
  } catch {
    res.json({ success: true, data: [] });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Driver Duty Status (Online / Offline) & Owner Intimation
// ─────────────────────────────────────────────────────────────────────────────

router.get('/drivers/status', async (_req: Request, res: Response) => {
  try {
    let drivers = await DriverDutyModel.find().lean();
    if (drivers.length === 0) {
      // Seed default driver state
      drivers = [
        {
          driverId: 'drv-01',
          driverName: 'Karthik Raja',
          phone: '+91 98401 23456',
          vehiclePlate: 'TN01BV4589',
          status: 'online',
          lastStatusChange: new Date(),
          offlineNotifiedToOwner: false,
          businessId: 'demo_fleet_biz_01',
        } as any,
        {
          driverId: 'drv-02',
          driverName: 'Suresh Kumar',
          phone: '+91 98402 34567',
          vehiclePlate: 'TN09CE2311',
          status: 'online',
          lastStatusChange: new Date(),
          offlineNotifiedToOwner: false,
          businessId: 'demo_fleet_biz_01',
        } as any,
      ];
    }
    res.json({ success: true, data: drivers });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});

router.post('/drivers/status', async (req: Request, res: Response) => {
  try {
    const {
      driverId = 'drv-01',
      driverName = 'Karthik Raja',
      phone = '+91 98401 23456',
      vehiclePlate = 'TN01BV4589',
      status = 'online',
      businessId = 'demo_fleet_biz_01',
    } = req.body;

    const updated = await DriverDutyModel.findOneAndUpdate(
      { driverId },
      {
        driverName,
        phone,
        vehiclePlate,
        status,
        lastStatusChange: new Date(),
        offlineNotifiedToOwner: status === 'offline',
        businessId,
      },
      { upsert: true, new: true },
    );

    const io = getIo();
    if (io) {
      if (status === 'offline') {
        const notifTitle = '⚠️ Driver Went Offline';
        const notifMsg = `Driver ${driverName} (${vehiclePlate}) went OFFLINE. Vehicle is currently parked.`;

        await NotificationModel.create({
          businessId,
          type: 'driver_offline',
          title: notifTitle,
          message: notifMsg,
          isRead: false,
        });

        const alertPayload = {
          type: 'driver_offline',
          driverId,
          driverName,
          vehiclePlate,
          status: 'offline',
          timestamp: new Date().toISOString(),
          title: notifTitle,
          message: notifMsg,
        };

        io.to('role:fleet_owner').emit('driver:offline_alert', alertPayload);
        io.to('role:fleet_manager').emit('driver:offline_alert', alertPayload);
        io.to(`business:${businessId}`).emit('driver:status_changed', alertPayload);
      } else {
        io.emit('driver:status_changed', {
          driverId,
          driverName,
          vehiclePlate,
          status: 'online',
          timestamp: new Date().toISOString(),
        });
      }
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('Error updating driver status', { err });
    res.status(500).json({ success: false, message: 'Failed to update driver status' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Taxi Bookings (Ola/Uber Style with Support Desk & Multi-Role Visibility)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/bookings', async (req: Request, res: Response) => {
  try {
    const { status, customerId, driverId, supportStatus } = req.query as {
      status?: string;
      customerId?: string;
      driverId?: string;
      supportStatus?: string;
    };

    const filter: any = {};
    if (status && status !== 'all') filter.status = status;
    if (customerId) filter.customerId = customerId;
    if (driverId) filter.assignedDriverId = driverId;
    if (supportStatus) filter.supportStatus = supportStatus;

    let bookings = await TaxiBookingModel.find(filter).sort({ createdAt: -1 }).limit(100).lean();

    if (bookings.length === 0) {
      // Seed initial realistic commercial taxi bookings if database is empty
      const initialBookings = [
        {
          bookingId: 'BK-84920',
          customerId: 'cust-01',
          customerName: 'Ananya Sharma',
          customerPhone: '+91 99620 12345',
          pickupLocation: 'Chennai International Airport (MAA T1)',
          dropoffLocation: 'Tidel Park, OMR IT Corridor',
          cabTier: 'sedan_cng',
          cabTierName: 'Economy Tour S CNG',
          vehicleModel: 'Maruti Suzuki Tour S CNG',
          estimatedDistanceKm: 16.4,
          estimatedFare: 277,
          baseFare: 80,
          otp: '4591',
          status: 'in_progress',
          assignedDriverId: 'drv-01',
          assignedDriverName: 'Karthik Raja',
          assignedDriverPhone: '+91 98401 23456',
          vehiclePlate: 'TN01BV4589',
          supportStatus: 'normal',
          businessId: 'demo_fleet_biz_01',
          createdAt: new Date(Date.now() - 18 * 60 * 1000),
          updatedAt: new Date(),
        },
        {
          bookingId: 'BK-84918',
          customerId: 'cust-02',
          customerName: 'Arvind Swaminathan',
          customerPhone: '+91 98840 98765',
          pickupLocation: 'Puratchi Thalaivar Dr. MGR Central Railway Station',
          dropoffLocation: 'Guindy Metro & Industrial Estate',
          cabTier: 'ev_green',
          cabTierName: 'Green City EV',
          vehicleModel: 'Tata Tigor EV Green',
          estimatedDistanceKm: 12.8,
          estimatedFare: 269,
          baseFare: 90,
          otp: '7823',
          status: 'driver_assigned',
          assignedDriverId: 'drv-03',
          assignedDriverName: 'Vijay Anand',
          assignedDriverPhone: '+91 98403 45678',
          vehiclePlate: 'TN02DF7812',
          supportStatus: 'normal',
          businessId: 'demo_fleet_biz_01',
          createdAt: new Date(Date.now() - 32 * 60 * 1000),
          updatedAt: new Date(),
        },
        {
          bookingId: 'BK-84915',
          customerId: 'cust-03',
          customerName: 'Kavitha Ramachandran',
          customerPhone: '+91 98411 22334',
          pickupLocation: 'Anna Nagar Tower Park West',
          dropoffLocation: 'Marina Beach Promenade, Triplicane',
          cabTier: 'premium_xl',
          cabTierName: 'Fleet Prime XL',
          vehicleModel: 'Toyota Innova Crysta',
          estimatedDistanceKm: 14.2,
          estimatedFare: 462,
          baseFare: 150,
          otp: '3190',
          status: 'completed',
          assignedDriverId: 'drv-04',
          assignedDriverName: 'Ramesh Babu',
          assignedDriverPhone: '+91 98404 56789',
          vehiclePlate: 'TN10AK9944',
          supportStatus: 'resolved',
          businessId: 'demo_fleet_biz_01',
          createdAt: new Date(Date.now() - 95 * 60 * 1000),
          updatedAt: new Date(),
        },
      ];

      try {
        await TaxiBookingModel.insertMany(initialBookings);
        bookings = await TaxiBookingModel.find(filter).sort({ createdAt: -1 }).lean();
      } catch {
        bookings = initialBookings as any;
      }
    }

    res.json({
      success: true,
      data: bookings,
      totalCount: bookings.length,
      activeCount: bookings.filter((b) => ['pending', 'driver_assigned', 'driver_arrived', 'in_progress'].includes(b.status)).length,
      supportIssueCount: bookings.filter((b) => b.supportStatus === 'support_needed').length,
    });
  } catch (err) {
    logger.error('Error fetching taxi bookings', { err });
    res.status(500).json({ success: false, message: 'Failed to fetch taxi bookings' });
  }
});

router.post('/bookings', async (req: Request, res: Response) => {
  try {
    const {
      customerId = 'cust-01',
      customerName = 'Passenger',
      customerPhone = '+91 99620 12345',
      customerEmail,
      pickupLocation,
      dropoffLocation,
      pickupCoords,
      dropoffCoords,
      cabTier = 'sedan_cng',
      cabTierName = 'Economy Tour S CNG',
      vehicleModel = 'Maruti Suzuki Tour S CNG',
      estimatedDistanceKm = 15,
      estimatedFare = 260,
      baseFare = 80,
      businessId = 'demo_fleet_biz_01',
    } = req.body;

    if (!pickupLocation || !dropoffLocation) {
      res.status(400).json({ success: false, message: 'Pickup and dropoff locations are required' });
      return;
    }

    const bookingId = `BK-${Math.floor(10000 + Math.random() * 90000)}`;
    const otp = String(Math.floor(1000 + Math.random() * 9000));

    const newBooking = await TaxiBookingModel.create({
      bookingId,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      pickupLocation,
      dropoffLocation,
      pickupCoords,
      dropoffCoords,
      cabTier,
      cabTierName,
      vehicleModel,
      estimatedDistanceKm,
      estimatedFare,
      baseFare,
      otp,
      status: 'pending',
      supportStatus: 'normal',
      businessId,
    });

    const io = getIo();
    if (io) {
      io.to('role:fleet_owner').emit('booking:broadcast', newBooking);
      io.to('role:fleet_manager').emit('booking:broadcast', newBooking);
      io.to('role:telecaller').emit('booking:broadcast', newBooking);
      io.to('role:driver').emit('booking:broadcast', newBooking);
    }

    res.status(201).json({ success: true, data: newBooking });
  } catch (err) {
    logger.error('Error creating taxi booking', { err });
    res.status(500).json({ success: false, message: 'Failed to create taxi booking' });
  }
});

router.patch('/bookings/:id/assign', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ success: false, message: 'Booking ID is required' });
      return;
    }
    const {
      assignedDriverId = 'drv-01',
      assignedDriverName = 'Karthik Raja',
      assignedDriverPhone = '+91 98401 23456',
      vehiclePlate = 'TN01BV4589',
    } = req.body;

    const booking = await TaxiBookingModel.findOneAndUpdate(
      { $or: [{ _id: id.length === 24 ? id : null }, { bookingId: id }] },
      {
        assignedDriverId,
        assignedDriverName,
        assignedDriverPhone,
        vehiclePlate,
        status: 'driver_assigned',
        updatedAt: new Date(),
      },
      { new: true },
    );

    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    const io = getIo();
    if (io) {
      io.emit('booking:updated', booking);
      io.to(`user:${booking.customerId}`).emit('booking:driver_assigned', booking);
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    logger.error('Error assigning driver to booking', { err });
    res.status(500).json({ success: false, message: 'Failed to assign driver' });
  }
});

router.patch('/bookings/:id/status', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ success: false, message: 'Booking ID is required' });
      return;
    }
    const { status, otp } = req.body as { status: string; otp?: string };

    const existing = await TaxiBookingModel.findOne({
      $or: [{ _id: id.length === 24 ? id : null }, { bookingId: id }],
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    // Verify OTP when starting trip
    if (status === 'in_progress' && otp && otp !== existing.otp) {
      res.status(400).json({ success: false, message: 'Invalid 4-digit Ride OTP provided by customer' });
      return;
    }

    existing.status = status as any;
    existing.updatedAt = new Date();
    await existing.save();

    const io = getIo();
    if (io) {
      io.emit('booking:updated', existing);
      io.to(`user:${existing.customerId}`).emit('booking:status_changed', existing);
    }

    res.json({ success: true, data: existing });
  } catch (err) {
    logger.error('Error updating booking status', { err });
    res.status(500).json({ success: false, message: 'Failed to update booking status' });
  }
});

// Report Problem from Customer / Driver to Support Team & Owner
router.post('/bookings/:id/report-issue', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ success: false, message: 'Booking ID is required' });
      return;
    }
    const { issueDetails } = req.body as { issueDetails: string };

    const booking = await TaxiBookingModel.findOneAndUpdate(
      { $or: [{ _id: id.length === 24 ? id : null }, { bookingId: id }] },
      {
        issueReported: true,
        issueDetails: issueDetails || 'Customer requested call center dispute support.',
        supportStatus: 'support_needed',
        updatedAt: new Date(),
      },
      { new: true },
    );

    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    const alert = {
      type: 'booking_issue',
      title: `🆘 Customer Issue on #${booking.bookingId}`,
      message: `${booking.customerName} (${booking.customerPhone}): "${booking.issueDetails}". Immediate support intervention requested.`,
      bookingId: booking.bookingId,
      customerId: booking.customerId,
      customerPhone: booking.customerPhone,
      timestamp: new Date().toISOString(),
    };

    const io = getIo();
    if (io) {
      io.to('role:telecaller').emit('support:urgent_alert', alert);
      io.to('role:fleet_owner').emit('support:urgent_alert', alert);
      io.to('role:fleet_manager').emit('support:urgent_alert', alert);
      io.emit('booking:updated', booking);
    }

    // Save notification
    await NotificationModel.create({
      businessId: booking.businessId,
      type: 'system',
      title: alert.title,
      message: alert.message,
      isRead: false,
    });

    res.json({ success: true, data: booking });
  } catch (err) {
    logger.error('Error reporting booking issue', { err });
    res.status(500).json({ success: false, message: 'Failed to report issue' });
  }
});

// Resolve Dispute by Call Center or Owner
router.patch('/bookings/:id/resolve-issue', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ success: false, message: 'Booking ID is required' });
      return;
    }
    const { resolutionNotes } = req.body as { resolutionNotes: string };

    const booking = await TaxiBookingModel.findOneAndUpdate(
      { $or: [{ _id: id.length === 24 ? id : null }, { bookingId: id }] },
      {
        supportStatus: 'resolved',
        supportResolutionNotes: resolutionNotes || 'Resolved by Call Center telecaller.',
        updatedAt: new Date(),
      },
      { new: true },
    );

    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    const io = getIo();
    if (io) {
      io.emit('booking:updated', booking);
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    logger.error('Error resolving booking issue', { err });
    res.status(500).json({ success: false, message: 'Failed to resolve issue' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Notifications Center
// ─────────────────────────────────────────────────────────────────────────────

router.get('/notifications', async (_req: Request, res: Response) => {
  try {
    const notifications = await NotificationModel.find().sort({ createdAt: -1 }).limit(30).lean();
    res.json({
      success: true,
      data: notifications.map((n) => ({
        id: String(n._id),
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
        read: n.isRead,
      })),
      unreadCount: notifications.filter((n) => !n.isRead).length,
    });
  } catch {
    res.json({ success: true, data: [], unreadCount: 0 });
  }
});

router.post('/notifications/mark-read', async (req: Request, res: Response) => {
  try {
    const { id } = req.body as { id?: string };
    if (id) {
      await NotificationModel.findByIdAndUpdate(id, { isRead: true });
    } else {
      await NotificationModel.updateMany({ isRead: false }, { isRead: true });
    }
    const unread = await NotificationModel.countDocuments({ isRead: false });
    res.json({ success: true, unreadCount: unread });
  } catch {
    res.json({ success: true, unreadCount: 0 });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Staff & Role Management (Drivers, Managers, Telecallers, Customers)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/staff', async (_req: Request, res: Response) => {
  try {
    const users = await UserModel.find().select('displayName email phone role isActive createdAt').lean();
    res.json({ success: true, data: users });
  } catch (err) {
    logger.error('Error fetching staff', { err });
    res.status(500).json({ success: false, message: 'Failed to fetch staff' });
  }
});

router.post('/staff', async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      phone,
      password = 'Password@123',
      role = 'driver',
      vehiclePlate,
      vehicleModel,
      businessId,
    } = req.body;

    if (!name || !email) {
      res.status(400).json({ success: false, message: 'Name and email are required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    let existingUser = await UserModel.findOne({ email: normalizedEmail });
    if (existingUser) {
      existingUser.displayName = name;
      existingUser.role = role;
      if (phone) existingUser.phone = phone;
      if (password) existingUser.passwordHash = await hashPassword(password);
      await existingUser.save();
    } else {
      const passwordHash = await hashPassword(password);
      existingUser = await UserModel.create({
        email: normalizedEmail,
        passwordHash,
        displayName: name,
        phone: phone || '',
        role,
        isActive: true,
        emailVerified: true,
      });
    }

    // Attach membership if business exists
    const targetBusiness = businessId
      ? await BusinessModel.findById(businessId)
      : await BusinessModel.findOne();

    if (targetBusiness) {
      await BusinessMembershipModel.findOneAndUpdate(
        { businessId: targetBusiness._id, userId: existingUser._id },
        {
          businessId: targetBusiness._id,
          userId: existingUser._id,
          role,
          permissions: ['*'],
          isActive: true,
        },
        { upsert: true, new: true },
      );
    }

    // If driver, register in DriverDutyModel
    if (role === 'driver') {
      await DriverDutyModel.findOneAndUpdate(
        { driverId: String(existingUser._id) },
        {
          driverId: String(existingUser._id),
          driverName: name,
          phone: phone || '+91 98401 23456',
          vehiclePlate: vehiclePlate || 'TN01BV4589',
          status: 'online',
          lastSeenAt: new Date(),
        },
        { upsert: true },
      );
    }

    res.status(201).json({
      success: true,
      data: {
        id: String(existingUser._id),
        name: existingUser.displayName,
        email: existingUser.email,
        phone: existingUser.phone,
        role: existingUser.role,
        tempPassword: password,
      },
    });
  } catch (err) {
    logger.error('Error creating staff member', { err });
    res.status(500).json({ success: false, message: 'Failed to create staff member' });
  }
});

export default router;
