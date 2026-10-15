import type { Vector3 } from 'three';

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!context) {
    try {
      context = new AudioContext();
    } catch {
      return null;
    }
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** Unlocks audio; call from a user gesture such as the "enter MR" click. */
export function unlockAudio(): void {
  audio();
}

/** Moves the listener with the player's head so positional sounds come from the right place. */
export function setListener(position: Vector3, forward: Vector3, up: Vector3): void {
  const ctx = context;
  if (!ctx) return;
  const l = ctx.listener;
  if (l.positionX) {
    l.positionX.value = position.x;
    l.positionY.value = position.y;
    l.positionZ.value = position.z;
    l.forwardX.value = forward.x;
    l.forwardY.value = forward.y;
    l.forwardZ.value = forward.z;
    l.upX.value = up.x;
    l.upY.value = up.y;
    l.upZ.value = up.z;
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** decay;
  return buffer;
}

/** Synthesized blaster shot: a falling saw tone. */
export function playShot(): void {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(1100, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.14);
  gain.gain.setValueAtTime(0.16, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  osc.connect(gain);
  osc.start(t);
  osc.stop(t + 0.17);
}

/** Short soft click for wrist-panel buttons. */
export function playClick(): void {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(1800, t);
  gain.gain.setValueAtTime(0.08, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  osc.connect(gain);
  osc.start(t);
  osc.stop(t + 0.06);
}

/** Wet impact on a creature; `heavy` for the killing blow or a bite. */
export function playImpact(heavy: boolean): void {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, heavy ? 0.6 : 0.25, 2);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = heavy ? 420 : 1200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(heavy ? 0.5 : 0.3, t);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(t);
}

/** Positional sound at a point in the room, e.g. a rift cracking open on a wall. */
export function playAt(kind: 'rift', position: Vector3): void {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const panner = new PannerNode(ctx, {
    panningModel: 'HRTF',
    distanceModel: 'inverse',
    refDistance: 1,
    positionX: position.x,
    positionY: position.y,
    positionZ: position.z,
  });
  panner.connect(ctx.destination);
  if (kind === 'rift') {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, 1.1, 1.2);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.exponentialRampToValueAtTime(900, t + 0.25);
    filter.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.7, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    source.start(t);
  }
}
