import { useEffect, useMemo, useRef } from 'react';
import { playCue } from '../game/audio';
import { hud } from '../game/hud';
import { useGame } from '../game/store';
import { GRAVITY_PRESETS, makeWalker, type CircleCollider, type WalkEnv, type WalkerState } from '../sim/movement';
import { hintsOn } from '../sim/save';
import type { Tier } from '../sim/types';
import { ObjectiveMarker } from '../three/Scenery';
import type { HeightFn } from '../three/terrain';
import { WalkerRig, type Interactable } from '../three/WalkerRig';

export interface EvaTask {
  id: string;
  objective: string;
  prompt: string;
  hint: string;
  x: number;
  z: number;
  r?: number;
}

export interface SuitState { o2: number; battery: number; time: number; jumps: number; lastAirtime: number; distance: number }

export function makeSuit(): SuitState {
  return { o2: 100, battery: 100, time: 0, jumps: 0, lastAirtime: 0, distance: 0 };
}

const O2_RATE: Record<Tier, number> = { junior: 0.1, middle: 0.16, advanced: 0.22 };
const BATTERY_RATE: Record<Tier, number> = { junior: 0.06, middle: 0.08, advanced: 0.1 };

/**
 * Third-person surface work shared by the Moon and Mars. Tasks are completed in
 * order by walking to each one and pressing E. Suit oxygen and battery drain at
 * a fixed rate per simulated second, so the same walk always costs the same.
 */
export function EvaWalker({ world, tier, height, start, tasks, index, onTask, carrying, suit, colliders, bounds, onOxygenOut, extraReadouts, lowVisibility = false }: {
  world: 'moon' | 'mars'; tier: Tier; height: HeightFn; start: { x: number; z: number };
  tasks: EvaTask[]; index: number; onTask: (id: string) => void; carrying: boolean;
  suit: React.MutableRefObject<SuitState>; colliders: CircleCollider[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  onOxygenOut: () => void; extraReadouts?: () => { label: string; value: string; status?: 'ok' | 'caution' | 'low'; note?: string }[];
  lowVisibility?: boolean;
}) {
  const settings = useGame((s) => s.save.settings);
  const hints = hintsOn(settings, tier);
  const preset = GRAVITY_PRESETS[world];
  const walker = useRef<WalkerState>(makeWalker(start.x, start.z, Math.PI, height(start.x, start.z)));
  const tick = useRef(0);
  const lowWarned = useRef(false);
  const out = useRef(false);
  const task = tasks[index];

  const env = useMemo<WalkEnv>(() => ({ preset, ground: height, circles: colliders, boxes: [], bounds, radius: 0.4 }), [preset, height, colliders, bounds]);

  useEffect(() => {
    hud.set({
      objective: task ? task.objective : 'Surface work complete',
      touch: 'walk', touchLabels: { primary: 'Jump', use: 'Use' },
      hint: hints && task ? task.hint : null,
    });
  }, [task, hints]);

  const interactables = (): Interactable[] => (task ? [{ id: task.id, x: task.x, z: task.z, r: task.r ?? 2.4, label: task.prompt, enabled: true }] : []);

  const onStep = (s: WalkerState, dt: number) => {
    const st = suit.current;
    if (!out.current) {
      st.time += dt;
      st.o2 = Math.max(0, st.o2 - O2_RATE[tier] * dt);
      st.battery = Math.max(0, st.battery - BATTERY_RATE[tier] * dt);
      st.jumps = s.jumps;
      st.distance = s.distance;
      if (s.lastAirtime > 0) st.lastAirtime = s.lastAirtime;
      if (st.o2 <= 0) { out.current = true; playCue('fail'); onOxygenOut(); }
      if (st.o2 < 25 && !lowWarned.current) {
        lowWarned.current = true;
        hud.warn({ title: 'SUIT OXYGEN LOW', text: 'Finish up and head for the habitat airlock.', level: 'caution' });
      }
    }
    if (tick.current++ % 6 !== 0) return;
    hud.set({
      distance: task ? Math.hypot(task.x - s.x, task.z - s.z) : null,
      meters: [
        { id: 'o2', label: 'Suit oxygen', value: st.o2, max: 100, text: `${Math.round(st.o2)}%`, status: st.o2 < 25 ? 'low' : st.o2 < 50 ? 'caution' : 'ok' },
        { id: 'battery', label: 'Suit battery', value: st.battery, max: 100, text: `${Math.round(st.battery)}%`, status: st.battery < 25 ? 'low' : st.battery < 50 ? 'caution' : 'ok' },
      ],
      readouts: [
        { label: 'Gravity', value: `${preset.label} ${world === 'moon' ? '0.17' : '0.38'} g`, note: `${preset.g} m/s²` },
        { label: 'Last jump airtime', value: st.lastAirtime ? `${st.lastAirtime.toFixed(2)} s` : 'not yet', note: 'Earth: about 0.6 s' },
        { label: 'Suit pressure', value: '4.3 psi', status: 'ok' },
        ...(extraReadouts?.() ?? []),
      ],
    });
  };

  return (
    <>
      {task && <ObjectiveMarker x={task.x} z={task.z} y={height(task.x, task.z)} color={lowVisibility ? '#ffe14d' : '#4de3ff'} radius={1.3} />}
      <WalkerRig
        env={() => env} state={walker} interactables={interactables}
        onInteract={(id) => { playCue('ok'); onTask(id); }}
        onStep={onStep} carrying={carrying} cameraOffset={[0, 3.6, 9]}
      />
    </>
  );
}
