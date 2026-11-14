// Optional audio. Everything is synthesised, so there are no sound files to
// load or credit. Spoken alerts always have a caption (see hud.ts).

let ctx: AudioContext | null = null;
let enabled = false;

export function setAudioEnabled(on: boolean): void {
  enabled = on;
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

function tone(freq: number, start: number, duration: number, type: OscillatorType, gain: number): void {
  const ac = context();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ac.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export type Cue = 'click' | 'ok' | 'alert' | 'caution' | 'fail' | 'complete';

export function playCue(cue: Cue): void {
  switch (cue) {
    case 'click': tone(660, 0, 0.07, 'triangle', 0.06); break;
    case 'ok': tone(660, 0, 0.12, 'sine', 0.08); tone(990, 0.1, 0.18, 'sine', 0.08); break;
    case 'caution': tone(520, 0, 0.18, 'square', 0.04); tone(520, 0.28, 0.18, 'square', 0.04); break;
    case 'alert': tone(740, 0, 0.16, 'square', 0.05); tone(560, 0.2, 0.16, 'square', 0.05); tone(740, 0.4, 0.16, 'square', 0.05); break;
    case 'fail': tone(300, 0, 0.3, 'sawtooth', 0.04); tone(220, 0.25, 0.4, 'sawtooth', 0.04); break;
    case 'complete': tone(523, 0, 0.15, 'sine', 0.08); tone(659, 0.14, 0.15, 'sine', 0.08); tone(784, 0.28, 0.3, 'sine', 0.08); break;
  }
}

/** Speak an alert aloud when audio is on. The caller shows the same text as a caption. */
export function speak(text: string): void {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
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
