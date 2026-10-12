export type PermissionStateStatus = 'granted' | 'prompt' | 'denied' | 'unsupported';

export interface FleetPermissionsState {
  microphone: PermissionStateStatus;
  location: PermissionStateStatus;
  notification: PermissionStateStatus;
  camera: PermissionStateStatus;
  lastChecked: number;
  allGranted: boolean;
}

type PermissionListener = (state: FleetPermissionsState) => void;

let currentState: FleetPermissionsState = {
  microphone: 'prompt',
  location: 'prompt',
  notification: 'prompt',
  camera: 'prompt',
  lastChecked: 0,
  allGranted: false,
};

const listeners = new Set<PermissionListener>();

function notify() {
  currentState.allGranted =
    currentState.microphone === 'granted' &&
    currentState.location === 'granted' &&
    currentState.notification === 'granted' &&
    currentState.camera === 'granted';

  listeners.forEach((fn) => fn({ ...currentState }));
}

/**
 * Check the current status of all 4 mandatory permissions
 */
export async function checkFleetPermissions(): Promise<FleetPermissionsState> {
  if (typeof window === 'undefined') return currentState;

  // 1. Microphone
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      currentState.microphone = status.state as PermissionStateStatus;
      status.onchange = () => {
        currentState.microphone = status.state as PermissionStateStatus;
        notify();
      };
    }
  } catch {
    // Some browsers don't support querying microphone directly
  }

  // 2. Location
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      currentState.location = status.state as PermissionStateStatus;
      status.onchange = () => {
        currentState.location = status.state as PermissionStateStatus;
        notify();
      };
    } else if (!('geolocation' in navigator)) {
      currentState.location = 'unsupported';
    }
  } catch {}

  // 3. Notification
  if ('Notification' in window) {
    currentState.notification =
      Notification.permission === 'granted'
        ? 'granted'
        : Notification.permission === 'denied'
        ? 'denied'
        : 'prompt';
  } else {
    currentState.notification = 'unsupported';
  }

  // 4. Camera
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
      currentState.camera = status.state as PermissionStateStatus;
      status.onchange = () => {
        currentState.camera = status.state as PermissionStateStatus;
        notify();
      };
    }
  } catch {}

  currentState.lastChecked = Date.now();
  notify();
  return { ...currentState };
}

/**
 * Request Microphone (for In-App VoIP Calls)
 */
export async function requestMicrophone(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    currentState.microphone = 'unsupported';
    notify();
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    currentState.microphone = 'granted';
    notify();
    return true;
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      currentState.microphone = 'denied';
    } else {
      currentState.microphone = 'prompt';
    }
    notify();
    return false;
  }
}

/**
 * Request Location (for Live GPS Tracking & Taxi Dispatch)
 */
export async function requestLocation(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    currentState.location = 'unsupported';
    notify();
    return false;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (_pos) => {
        currentState.location = 'granted';
        notify();
        resolve(true);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          currentState.location = 'denied';
        } else {
          currentState.location = 'prompt';
        }
        notify();
        resolve(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
}

/**
 * Request Push Notifications (for Incoming Call Ringers & Alerts)
 */
export async function requestNotification(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    currentState.notification = 'unsupported';
    notify();
    return false;
  }

  try {
    const perm = await Notification.requestPermission();
    currentState.notification = perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'prompt';
    notify();
    return perm === 'granted';
  } catch {
    return false;
  }
}

/**
 * Request Camera & File Access (for Vehicle Inspection Photos & Media Proof)
 */
export async function requestCamera(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    currentState.camera = 'unsupported';
    notify();
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    stream.getTracks().forEach((track) => track.stop());
    currentState.camera = 'granted';
    notify();
    return true;
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      currentState.camera = 'denied';
    } else {
      currentState.camera = 'prompt';
    }
    notify();
    return false;
  }
}

/**
 * Request All 4 Mandatory Permissions sequentially
 */
export async function requestAllFleetPermissions(): Promise<FleetPermissionsState> {
  await requestNotification();
  await requestMicrophone();
  await requestLocation();
  await requestCamera();
  return checkFleetPermissions();
}

/**
 * Subscribe to permission changes
 */
export function subscribeToFleetPermissions(listener: PermissionListener): () => void {
  listeners.add(listener);
  listener({ ...currentState });
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentFleetPermissions(): FleetPermissionsState {
  return { ...currentState };
}
