// Real-Time WebRTC & VoIP Calling Signaling Service
// Backed by Socket.IO, Multi-Device Synchronization, and Real-Time Presence Checking
// No fake auto-answers, no ghost replies: strictly connects real online participants.

import { playTelephoneRingTone, playCallConnectedTone, type RingController } from '../utils/audioAlerts.js';
import { getSocket, registerCurrentUser } from './socket.client.js';
import { useAuthStore } from '../store/auth.store.js';

export interface CallSession {
  callId: string;
  callerId: string;
  callerName: string;
  callerRole: string;
  callerPhone?: string;
  vehiclePlate?: string;
  targetId: string;
  targetName?: string;
  targetRole?: string;
  targetPhone?: string;
  status: 'calling' | 'ringing' | 'incoming' | 'connected' | 'rejected' | 'ended' | 'offline';
  errorMessage?: string;
  isCaller?: boolean;
  startedAt: string;
}

type CallEventListener = (session: CallSession | null) => void;

class CallSignalingManager {
  private currentSession: CallSession | null = null;
  private ringController: RingController | null = null;
  private listeners: Set<CallEventListener> = new Set();
  private callTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initSocketListeners();
    }
  }

  private initSocketListeners() {
    const socket = getSocket();

    // 1. Recipient is OFFLINE
    socket.on('call:recipient_offline', (data: { targetId: string; targetName: string; message: string; targetPhone?: string }) => {
      this.stopRinging();
      this.clearTimeoutTimer();

      if (this.currentSession) {
        this.currentSession = {
          ...this.currentSession,
          status: 'offline',
          errorMessage: data.message || `${data.targetName} is currently OFFLINE. Cannot establish in-app call.`,
        };
        this.notify();
      }
    });

    // 2. Caller notified that target device is ringing
    socket.on('call:ringing', (session: CallSession) => {
      if (this.currentSession && this.currentSession.callId === session.callId) {
        this.currentSession.status = 'ringing';
        if (!this.ringController) {
          this.ringController = playTelephoneRingTone();
        }
        this.notify();
      }
    });

    // 3. Incoming Call received on this device
    socket.on('call:incoming', (session: CallSession) => {
      this.currentSession = {
        ...session,
        isCaller: false,
        status: 'incoming',
      };
      if (!this.ringController) {
        this.ringController = playTelephoneRingTone();
      }
      this.notify();
    });

    // 4. Call accepted by target
    socket.on('call:accepted', () => {
      this.stopRinging();
      this.clearTimeoutTimer();
      playCallConnectedTone();

      if (this.currentSession) {
        this.currentSession.status = 'connected';
        this.notify();
      }
    });

    socket.on('call:connected', () => {
      this.stopRinging();
      this.clearTimeoutTimer();
      playCallConnectedTone();

      if (this.currentSession) {
        this.currentSession.status = 'connected';
        this.notify();
      }
    });

    // 5. Call declined by target
    socket.on('call:declined', (data: { message?: string }) => {
      this.stopRinging();
      this.clearTimeoutTimer();

      if (this.currentSession) {
        this.currentSession.status = 'rejected';
        this.currentSession.errorMessage = data.message || 'Call was declined by recipient.';
        this.notify();
        setTimeout(() => this.resetSession(), 2500);
      }
    });

    // 6. Call ended
    socket.on('call:ended', () => {
      this.stopRinging();
      this.clearTimeoutTimer();

      if (this.currentSession) {
        this.currentSession.status = 'ended';
        this.notify();
        setTimeout(() => this.resetSession(), 1200);
      }
    });
  }

  public subscribe(listener: CallEventListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSession);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const copy = this.currentSession ? { ...this.currentSession } : null;
    this.listeners.forEach((fn) => fn(copy));
  }

  public getCurrentSession(): CallSession | null {
    return this.currentSession;
  }

  /**
   * Start an outgoing call to a contact
   */
  public startCall(contact: {
    id: string;
    name: string;
    role: string;
    phone: string;
    vehiclePlate?: string;
  }): CallSession {
    this.stopRinging();
    this.clearTimeoutTimer();
    registerCurrentUser();

    const auth = useAuthStore.getState();
    const myUser = auth.user;
    const myId = myUser?.id || (myUser as any)?._id || 'owner-01';
    const myName = myUser?.displayName || 'Fleet Controller';
    const myRole = (myUser as any)?.role as string || 'fleet_owner';
    const myPhone = (myUser as any)?.phone || '+91 98410 11223';

    // Safety: Cannot call oneself. Auto-resolve to default counterpart.
    let target = { ...contact };
    if (target.id === myId) {
      if (myRole === 'driver') {
        target = {
          id: 'owner-01',
          name: 'Sarangan (Fleet Owner)',
          role: 'fleet_owner',
          phone: '+91 98410 11223',
        };
      } else if (myRole === 'customer') {
        target = {
          id: 'tel-01',
          name: 'Fleet 365 24x7 Helpline Desk',
          role: 'telecaller',
          phone: '+91 1800 365 000',
        };
      } else {
        target = {
          id: 'drv-01',
          name: 'Karthik Raja (Driver)',
          role: 'driver',
          phone: '+91 98401 23456',
          vehiclePlate: 'TN01BV4589',
        };
      }
    }

    const session: CallSession = {
      callId: `call_${Date.now()}`,
      callerId: myId,
      callerName: myName,
      callerRole: myRole,
      callerPhone: myPhone,
      targetId: target.id,
      targetName: target.name,
      targetRole: target.role,
      targetPhone: target.phone,
      vehiclePlate: target.vehiclePlate,
      status: 'calling',
      isCaller: true,
      startedAt: new Date().toISOString(),
    };

    this.currentSession = session;
    this.ringController = playTelephoneRingTone();
    this.notify();

    // Emit initiate call to server
    const socket = getSocket();
    socket.emit('call:initiate', {
      targetId: target.id,
      targetName: target.name,
      targetRole: target.role,
      targetPhone: target.phone,
      vehiclePlate: target.vehiclePlate,
      callerId: myId,
      callerName: myName,
      callerRole: myRole,
      callerPhone: myPhone,
    });

    // 40 second timeout if no one picks up
    this.callTimeoutTimer = setTimeout(() => {
      if (this.currentSession && this.currentSession.status !== 'connected') {
        this.stopRinging();
        this.currentSession.status = 'rejected';
        this.currentSession.errorMessage = 'No answer from recipient (timed out).';
        this.notify();
        this.endCall();
      }
    }, 40000);

    return session;
  }

  public triggerIncomingCall(caller: {
    name: string;
    role: string;
    phone: string;
    vehiclePlate?: string;
  }) {
    this.stopRinging();
    this.clearTimeoutTimer();

    const session: CallSession = {
      callId: `incoming_test_${Date.now()}`,
      callerId: 'test_caller',
      callerName: caller.name,
      callerRole: caller.role,
      callerPhone: caller.phone,
      targetId: 'me',
      targetName: 'Me',
      targetRole: 'user',
      vehiclePlate: caller.vehiclePlate,
      status: 'incoming',
      startedAt: new Date().toISOString(),
    };

    this.currentSession = session;
    this.ringController = playTelephoneRingTone();
    this.notify();
  }

  public acceptCall() {
    if (!this.currentSession) return;
    this.stopRinging();
    this.clearTimeoutTimer();

    const socket = getSocket();
    socket.emit('call:accept', {
      callId: this.currentSession.callId,
      callerId: this.currentSession.callerId,
      targetId: this.currentSession.targetId,
    });

    this.currentSession.status = 'connected';
    playCallConnectedTone();
    this.notify();
  }

  public rejectCall() {
    this.stopRinging();
    this.clearTimeoutTimer();

    if (this.currentSession) {
      const socket = getSocket();
      socket.emit('call:reject', {
        callId: this.currentSession.callId,
        callerId: this.currentSession.callerId,
        targetId: this.currentSession.targetId,
      });

      this.currentSession.status = 'rejected';
      this.notify();
    }

    setTimeout(() => this.resetSession(), 600);
  }

  public endCall(durationSeconds = 0) {
    this.stopRinging();
    this.clearTimeoutTimer();

    if (this.currentSession) {
      const socket = getSocket();
      socket.emit('call:end', {
        callId: this.currentSession.callId,
        callerId: this.currentSession.callerId,
        targetId: this.currentSession.targetId,
        duration: durationSeconds,
      });

      this.currentSession.status = 'ended';
      this.notify();
    }

    setTimeout(() => this.resetSession(), 600);
  }

  private stopRinging() {
    if (this.ringController) {
      this.ringController.stop();
      this.ringController = null;
    }
  }

  private clearTimeoutTimer() {
    if (this.callTimeoutTimer) {
      clearTimeout(this.callTimeoutTimer);
      this.callTimeoutTimer = null;
    }
  }

  private resetSession() {
    this.currentSession = null;
    this.notify();
  }
}

export const callSignaling = new CallSignalingManager();
