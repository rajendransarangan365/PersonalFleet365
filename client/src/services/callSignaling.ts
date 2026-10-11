// Real-Time WebRTC & VoIP Calling Signaling Service
// Supports Multi-Tab synchronization, server signaling, and audio ringtones

import { playTelephoneRingTone, type RingController } from '../utils/audioAlerts.js';
import { apiPost } from './api.js';

export interface CallSession {
  callId: string;
  callerId: string;
  callerName: string;
  callerRole: string;
  callerPhone: string;
  vehiclePlate?: string;
  targetId: string;
  status: 'incoming' | 'outgoing' | 'connected' | 'rejected' | 'ended';
  startedAt: string;
}

type CallEventListener = (session: CallSession) => void;

class CallSignalingManager {
  private currentSession: CallSession | null = null;
  private ringController: RingController | null = null;
  private listeners: Set<CallEventListener> = new Set();
  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('fleet365_call_signaling');
        this.channel.onmessage = (event) => {
          if (event.data?.type === 'INCOMING_CALL') {
            this.handleIncomingCall(event.data.session, false);
          } else if (event.data?.type === 'CALL_ACCEPTED') {
            this.handleCallAccepted(false);
          } else if (event.data?.type === 'CALL_REJECTED') {
            this.handleCallRejected(false);
          } else if (event.data?.type === 'CALL_ENDED') {
            this.handleCallEnded(false);
          }
        };
      } catch {}
    }

    // Also listen to storage events for cross-tab fallback
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'fleet_call_event' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            if (data.type === 'INCOMING_CALL') {
              this.handleIncomingCall(data.session, false);
            } else if (data.type === 'CALL_REJECTED') {
              this.handleCallRejected(false);
            } else if (data.type === 'CALL_ENDED') {
              this.handleCallEnded(false);
            }
          } catch {}
        }
      });
    }
  }

  public subscribe(listener: CallEventListener): () => void {
    this.listeners.add(listener);
    if (this.currentSession) {
      listener(this.currentSession);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    if (this.currentSession) {
      this.listeners.forEach((fn) => fn({ ...this.currentSession! }));
    }
  }

  public getCurrentSession(): CallSession | null {
    return this.currentSession;
  }

  /**
   * Start an outgoing call
   */
  public startCall(contact: {
    id: string;
    name: string;
    role: string;
    phone: string;
    vehiclePlate?: string;
  }): CallSession {
    const session: CallSession = {
      callId: `call_${Date.now()}`,
      callerId: 'me',
      callerName: contact.name,
      callerRole: contact.role,
      callerPhone: contact.phone,
      vehiclePlate: contact.vehiclePlate,
      targetId: contact.id,
      status: 'outgoing',
      startedAt: new Date().toISOString(),
    };

    this.currentSession = session;
    this.broadcast('INCOMING_CALL', session);
    void apiPost('/app/call/signal', { action: 'start', targetPhone: contact.phone }).catch(() => {});
    this.notify();
    return session;
  }

  /**
   * Simulate an incoming call for demo testing
   */
  public triggerIncomingCall(caller: {
    id?: string;
    name: string;
    role: string;
    phone: string;
    vehiclePlate?: string;
  }): CallSession {
    const session: CallSession = {
      callId: `call_${Date.now()}`,
      callerId: caller.id || `caller_${Date.now()}`,
      callerName: caller.name,
      callerRole: caller.role,
      callerPhone: caller.phone,
      vehiclePlate: caller.vehiclePlate,
      targetId: 'me',
      status: 'incoming',
      startedAt: new Date().toISOString(),
    };

    this.handleIncomingCall(session, true);
    return session;
  }

  private handleIncomingCall(session: CallSession, broadcast = true) {
    this.currentSession = session;
    if (!this.ringController) {
      this.ringController = playTelephoneRingTone();
    }
    if (broadcast) {
      this.broadcast('INCOMING_CALL', session);
    }
    this.notify();
  }

  public acceptCall() {
    if (!this.currentSession) return;
    this.stopRinging();
    this.currentSession.status = 'connected';
    this.broadcast('CALL_ACCEPTED', this.currentSession);
    this.notify();
  }

  private handleCallAccepted(broadcast = true) {
    if (!this.currentSession) return;
    this.stopRinging();
    this.currentSession.status = 'connected';
    if (broadcast) {
      this.broadcast('CALL_ACCEPTED', this.currentSession);
    }
    this.notify();
  }

  public rejectCall() {
    this.stopRinging();
    if (this.currentSession) {
      this.currentSession.status = 'rejected';
      this.broadcast('CALL_REJECTED', this.currentSession);
      this.notify();
    }
    void apiPost('/app/call/signal', { action: 'end' }).catch(() => {});
    setTimeout(() => {
      this.currentSession = null;
      this.listeners.forEach((fn) => fn(null as any));
    }, 400);
  }

  private handleCallRejected(broadcast = true) {
    this.stopRinging();
    if (this.currentSession) {
      this.currentSession.status = 'rejected';
      if (broadcast) {
        this.broadcast('CALL_REJECTED', this.currentSession);
      }
      this.notify();
    }
    setTimeout(() => {
      this.currentSession = null;
      this.listeners.forEach((fn) => fn(null as any));
    }, 400);
  }

  public endCall() {
    this.stopRinging();
    if (this.currentSession) {
      this.currentSession.status = 'ended';
      this.broadcast('CALL_ENDED', this.currentSession);
      this.notify();
    }
    void apiPost('/app/call/signal', { action: 'end' }).catch(() => {});
    setTimeout(() => {
      this.currentSession = null;
      this.listeners.forEach((fn) => fn(null as any));
    }, 400);
  }

  private handleCallEnded(broadcast = true) {
    this.stopRinging();
    if (this.currentSession) {
      this.currentSession.status = 'ended';
      if (broadcast) {
        this.broadcast('CALL_ENDED', this.currentSession);
      }
      this.notify();
    }
    setTimeout(() => {
      this.currentSession = null;
      this.listeners.forEach((fn) => fn(null as any));
    }, 400);
  }

  private stopRinging() {
    if (this.ringController) {
      this.ringController.stop();
      this.ringController = null;
    }
  }

  private broadcast(type: string, session: CallSession) {
    try {
      this.channel?.postMessage({ type, session });
      localStorage.setItem('fleet_call_event', JSON.stringify({ type, session, ts: Date.now() }));
    } catch {}
  }
}

export const callSignaling = new CallSignalingManager();
