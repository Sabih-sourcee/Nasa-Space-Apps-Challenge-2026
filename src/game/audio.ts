// Sound. Everything is synthesised, so there are no sound files to load or
// credit. Sound effects and spoken alerts have separate switches, and spoken
// alerts always have a caption (see hud.ts). The whole game works muted.

let ctx: AudioContext | null = null;
let enabled = false;
let speech = false;

export function setAudioEnabled(on: boolean): void {
  enabled = on;
}

export function setSpeechEnabled(on: boolean): void {
  speech = on;
  if (!on && typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

function context(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType, gain: number, slideTo?: number): void {
  const ac = context();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  const t0 = ac.currentTime + start;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export type Cue = 'click' | 'select' | 'ok' | 'alert' | 'caution' | 'fail' | 'complete' | 'start' | 'star' | 'badge' | 'checkpoint';

/** Play a short interface sound. `step` raises the pitch for a run of the same cue (the stars). */
export function playCue(cue: Cue, step = 0): void {
  switch (cue) {
    case 'click': tone(620, 0, 0.06, 'triangle', 0.06); tone(930, 0.03, 0.06, 'triangle', 0.035); break;
    case 'select': tone(520, 0, 0.07, 'sine', 0.06); tone(780, 0.05, 0.09, 'sine', 0.05); break;
    case 'ok': tone(660, 0, 0.12, 'sine', 0.08); tone(990, 0.1, 0.18, 'sine', 0.08); break;
    case 'caution': tone(520, 0, 0.18, 'square', 0.04); tone(520, 0.28, 0.18, 'square', 0.04); break;
    case 'alert': tone(740, 0, 0.16, 'square', 0.05); tone(560, 0.2, 0.16, 'square', 0.05); tone(740, 0.4, 0.16, 'square', 0.05); break;
    case 'fail': tone(300, 0, 0.3, 'sawtooth', 0.04); tone(220, 0.25, 0.4, 'sawtooth', 0.04); break;
    case 'complete': tone(523, 0, 0.15, 'sine', 0.08); tone(659, 0.14, 0.15, 'sine', 0.08); tone(784, 0.28, 0.3, 'sine', 0.08); break;
    case 'start': tone(220, 0, 0.5, 'sawtooth', 0.03, 880); tone(440, 0.12, 0.42, 'sine', 0.06, 1320); break;
    case 'star': {
      const f = [784, 988, 1175][Math.max(0, Math.min(2, step))];
      tone(f, 0, 0.16, 'triangle', 0.09); tone(f * 2, 0.06, 0.3, 'sine', 0.06);
      break;
    }
    case 'badge': tone(523, 0, 0.14, 'triangle', 0.07); tone(784, 0.13, 0.14, 'triangle', 0.07); tone(1047, 0.26, 0.42, 'sine', 0.08); break;
    case 'checkpoint': tone(880, 0, 0.09, 'sine', 0.06); tone(1175, 0.09, 0.2, 'sine', 0.06); break;
  }
}

/** Speak an alert aloud when spoken alerts are on. The caller shows the same text as a caption. */
export function speak(text: string): void {
  if (!speech || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* speech is optional */
  }
}
