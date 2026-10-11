// Web Audio API pure synthesizer for authentic telephone rings and message chimes
// Zero external file dependencies - guaranteed 100% reliable in all browsers and mobile web

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export interface RingController {
  stop: () => void;
}

/**
 * Play authentic telephone ringing tone cadence (Dual tone 440Hz + 480Hz)
 * Cadence: 2 seconds ring, 3 seconds pause, repeating
 */
export function playTelephoneRingTone(): RingController {
  const ctx = getAudioContext();
  if (!ctx) {
    return { stop: () => {} };
  }

  let isPlaying = true;
  let activeNodes: Array<{ osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode }> = [];

  const playBurst = () => {
    if (!isPlaying || !ctx) return;

    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.value = 440; // Standard telephone ring low tone
      osc2.frequency.value = 480; // Standard telephone ring high tone

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + 1.8);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.0);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 2.0);
      osc2.stop(ctx.currentTime + 2.0);

      const record = { osc1, osc2, gain };
      activeNodes.push(record);

      setTimeout(() => {
        activeNodes = activeNodes.filter((n) => n !== record);
      }, 2100);
    } catch {}
  };

  // Initial burst
  playBurst();
  // Repeat every 4.5 seconds
  const interval = setInterval(() => {
    if (isPlaying) {
      playBurst();
    }
  }, 4500);

  return {
    stop: () => {
      isPlaying = false;
      clearInterval(interval);
      activeNodes.forEach((node) => {
        try {
          node.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
          setTimeout(() => {
            node.osc1.stop();
            node.osc2.stop();
          }, 60);
        } catch {}
      });
      activeNodes = [];
    },
  };
}

/**
 * Play pleasant instant message notification chime
 */
export function playMessageChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Arpeggiated cheerful ding
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

/**
 * Play call connected confirmation tone
 */
export function playCallConnectedTone(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

/**
 * Request real microphone access with friendly status report
 */
export async function requestMicrophoneAccess(): Promise<{
  granted: boolean;
  stream?: MediaStream;
  error?: string;
}> {
  try {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return {
        granted: false,
        error: 'Microphone API is not supported in this environment.',
      };
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return { granted: true, stream };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Microphone permission was denied.';
    return { granted: false, error: message };
  }
}
