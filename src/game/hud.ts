// HUD state. Scenes push values here a few times per second; the HUD component
// renders them. Keeping this separate stops React re-rendering on every frame.

import { create } from 'zustand';
import { playCue, speak } from './audio';

export interface Meter {
  id: string;
  label: string;
  value: number;
  max: number;
  text: string;
  status: 'ok' | 'caution' | 'low';
  note?: string;
}

export interface Readout {
  label: string; value: string; status?: 'ok' | 'caution' | 'low'; note?: string;
  /** Always shown, even when it needs no attention: a checklist line that has been ticked. */
  keep?: boolean;
}

export interface Warning { title: string; text: string; level: 'info' | 'caution' | 'alert'; sourceId?: string }

export type TouchLayout = 'none' | 'walk' | 'flight' | 'drift';

export interface HudState {
  objective: string;
  distance: number | null;
  prompt: string | null;
  hint: string | null;
  meters: Meter[];
  readouts: Readout[];
  warning: Warning | null;
  caption: string | null;
  labels: string[];
  touch: TouchLayout;
  /** Names for the action keys. `move` renames the W A S D keys (for example "Move arm"). */
  touchLabels: { primary: string; use: string; brake?: string; recover?: string; move?: string };
  crosshair: boolean;
}

const EMPTY: HudState = {
  objective: '', distance: null, prompt: null, hint: null, meters: [], readouts: [], warning: null,
  caption: null, labels: [], touch: 'none', touchLabels: { primary: 'Jump', use: 'Use' }, crosshair: false,
};

function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

export const useHud = create<HudState>(() => ({ ...EMPTY }));

export const hud = {
  set(patch: Partial<HudState>): void {
    const cur = useHud.getState();
    const next: Partial<HudState> = {};
    let changed = false;
    for (const k of Object.keys(patch) as (keyof HudState)[]) {
      if (!same(cur[k], patch[k])) { (next as Record<string, unknown>)[k] = patch[k]; changed = true; }
    }
    if (changed) useHud.setState(next);
  },
  reset(): void {
    useHud.setState({ ...EMPTY });
  },
  /** Raise a labelled warning: text, a visual signal, a sound cue, speech and a caption. */
  warn(w: Warning | null): void {
    const cur = useHud.getState().warning;
    if (same(cur, w)) return;
    useHud.setState({ warning: w, caption: w ? `${w.title}. ${w.text}` : null });
    if (w) {
      playCue(w.level === 'alert' ? 'alert' : w.level === 'caution' ? 'caution' : 'ok');
      speak(`${w.title}. ${w.text}`);
    }
  },
  say(text: string | null): void {
    if (useHud.getState().caption === text) return;
    useHud.setState({ caption: text });
    if (text) speak(text);
  },
};
