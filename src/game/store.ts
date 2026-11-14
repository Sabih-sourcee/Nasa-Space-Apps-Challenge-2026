// Application state: screens, the guest profile, the active mission run and
// checkpoint saves. Simulation rules live in src/sim; this file only calls them.

import { create } from 'zustand';
import { DEMO_MISSIONS, missionAfter, missionStatus, nextMission, phaseIds } from '../sim/missions';
import { commitTurn, restoreCheckpoint, startRun, type ApplyResult, type OutpostRun } from '../sim/outpost';
import { getScenario } from '../sim/outpostScenarios';
import { SAVE_KEYS, defaultSave, parseSave, serializeSave, type Checkpoint, type SaveData, type Settings } from '../sim/save';
import type { DemoMissionId, Tier } from '../sim/types';
import { setAudioEnabled } from './audio';
import { hud } from './hud';
import { input } from './input';

export type Screen = 'home' | 'atlas' | 'briefing' | 'mission' | 'debrief' | 'credits';
export type Mode = 'campaign' | 'judge';

export interface MissionResult {
  missionId: DemoMissionId;
  tier: Tier;
  crewStatus: string;
  consequence: string;
  objectives: { label: string; done: boolean }[];
  stats: { label: string; value: string }[];
  outpost: OutpostRun | null;
  baseline: OutpostRun | null;
  milestone: string | null;
}

export interface MissionRun {
  missionId: DemoMissionId;
  tier: Tier;
  phase: string;
  flags: Record<string, boolean>;
  stats: Record<string, number>;
  /** Changes whenever the scene must be rebuilt from the checkpoint. */
  attempt: number;
  outpost: OutpostRun | null;
  replayBaseline: OutpostRun | null;
}

interface GameState {
  ready: boolean;
  mode: Mode;
  save: SaveData;
  notes: string[];
  screen: Screen;
  selected: DemoMissionId | null;
  run: MissionRun | null;
  result: MissionResult | null;
  paused: boolean;
  settingsOpen: boolean;
  storageOk: boolean;

  init: () => void;
  setMode: (mode: Mode) => void;
  go: (screen: Screen) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  openSettings: (open: boolean) => void;
  dismissNotes: () => void;
  openBriefing: (id: DemoMissionId) => void;
  startCampaign: () => void;
  startMission: (id: DemoMissionId) => void;
  startMissionAt: (id: DemoMissionId, phase: string) => void;
  resumeCheckpoint: () => boolean;
  setPhase: (phase: string, patch?: { flags?: Record<string, boolean>; stats?: Record<string, number> }) => void;
  setFlag: (flag: string, value: boolean) => void;
  bumpStat: (key: string, by?: number) => void;
  setStat: (key: string, value: number) => void;
  restartFromCheckpoint: () => void;
  restartMission: () => void;
  outpostCommit: (chosen: string[]) => ApplyResult | null;
  outpostRecover: () => void;
  completeMission: (result: Omit<MissionResult, 'missionId' | 'tier' | 'baseline' | 'milestone'>) => void;
  startReplay: (turnIndex: number) => void;
  continueAfterDebrief: () => void;
  setPaused: (paused: boolean) => void;
  quitToAtlas: () => void;
  resetProgress: () => void;
}

function makeId(): string {
  const bytes = new Uint8Array(6);
  try { crypto.getRandomValues(bytes); } catch { for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256); }
  return 'guest-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function readSlot(mode: Mode): { save: SaveData; notes: string[]; ok: boolean } {
  try {
    const raw = window.localStorage.getItem(SAVE_KEYS[mode]);
    const { save, notes } = parseSave(raw, makeId);
    return { save, notes, ok: true };
  } catch {
    return { save: defaultSave(makeId()), notes: ['This browser is blocking storage, so progress will not be saved after you close the page.'], ok: false };
  }
}

function writeSlot(mode: Mode, save: SaveData): boolean {
  try {
    window.localStorage.setItem(SAVE_KEYS[mode], serializeSave(save));
    return true;
  } catch {
    return false;
  }
}

function checkpointOf(run: MissionRun): Checkpoint {
  return {
    missionId: run.missionId, tier: run.tier, phase: run.phase,
    flags: { ...run.flags }, stats: { ...run.stats },
    outpost: run.outpost ? (JSON.parse(JSON.stringify(run.outpost)) as OutpostRun) : null,
  };
}

function runFrom(cp: Checkpoint, attempt: number): MissionRun {
  return {
    missionId: cp.missionId, tier: cp.tier, phase: cp.phase,
    flags: { ...cp.flags }, stats: { ...cp.stats }, attempt,
    outpost: cp.outpost ? (JSON.parse(JSON.stringify(cp.outpost)) as OutpostRun) : null,
    replayBaseline: null,
  };
}

let attemptCounter = 1;

export const useGame = create<GameState>((set, get) => {
  /** Save the campaign slot. Replays never overwrite the stored checkpoint. */
  const persist = (save: SaveData) => {
    const ok = writeSlot(get().mode, save);
    set({ save, storageOk: ok });
  };

  const saveCheckpoint = (run: MissionRun) => {
    if (run.replayBaseline) return;
    persist({ ...get().save, checkpoint: checkpointOf(run) });
  };

  const enterMission = (run: MissionRun) => {
    hud.reset();
    input.clear();
    input.setSuspended(false);
    set({ run, screen: 'mission', result: null, paused: false, selected: run.missionId });
  };

  return {
    ready: false,
    mode: 'campaign',
    save: defaultSave('guest-pending'),
    notes: [],
    screen: 'home',
    selected: null,
    run: null,
    result: null,
    paused: false,
    settingsOpen: false,
    storageOk: true,

    init: () => {
      if (get().ready) return;
      const slot = readSlot('campaign');
      setAudioEnabled(slot.save.settings.audio);
      set({ ready: true, save: slot.save, notes: slot.notes, storageOk: slot.ok });
      if (slot.ok) writeSlot('campaign', slot.save);
    },

    setMode: (mode) => {
      if (mode === get().mode) return;
      const slot = readSlot(mode);
      // Judge Mode keeps its own progress but follows the player's comfort settings.
      slot.save.settings = { ...get().save.settings };
      set({ mode, save: slot.save, notes: slot.notes, run: null, result: null, screen: 'atlas', paused: false });
      writeSlot(mode, slot.save);
    },

    go: (screen) => {
      hud.reset();
      input.setSuspended(false);
      set({ screen, paused: false });
    },

    updateSettings: (patch) => {
      const save = { ...get().save, settings: { ...get().save.settings, ...patch } };
      if (patch.audio !== undefined) setAudioEnabled(patch.audio);
      persist(save);
    },

    openSettings: (open) => set({ settingsOpen: open }),
    dismissNotes: () => set({ notes: [] }),

    openBriefing: (id) => {
      const status = missionStatus(id, get().save.completed, get().mode === 'judge');
      if (status === 'locked' || status === 'planned') return;
      set({ selected: id, screen: 'briefing' });
    },

    startCampaign: () => {
      const next = nextMission(get().save.completed) ?? 'E02';
      set({ selected: next, screen: 'briefing' });
    },

    startMission: (id) => {
      const status = missionStatus(id, get().save.completed, get().mode === 'judge');
      if (status === 'locked' || status === 'planned') return;
      // Difficulty changes apply here: at the next mission start or restart.
      const run: MissionRun = {
        missionId: id, tier: get().save.settings.tier, phase: phaseIds(id)[0],
        flags: {}, stats: {}, attempt: attemptCounter++, outpost: null, replayBaseline: null,
      };
      saveCheckpoint(run);
      enterMission(run);
    },

    startMissionAt: (id, phase) => {
      // Judge Mode only: jump straight to a later checkpoint for a short demo.
      if (get().mode !== 'judge' || !phaseIds(id).includes(phase)) return;
      get().startMission(id);
      if (phase !== phaseIds(id)[0]) get().setPhase(phase);
    },

    resumeCheckpoint: () => {
      const cp = get().save.checkpoint;
      if (!cp) return false;
      enterMission(runFrom(cp, attemptCounter++));
      return true;
    },

    setPhase: (phase, patch) => {
      const run = get().run;
      if (!run) return;
      const next: MissionRun = {
        ...run, phase,
        flags: { ...run.flags, ...(patch?.flags ?? {}) },
        stats: { ...run.stats, ...(patch?.stats ?? {}) },
      };
      if (phase === 'outpost' && !next.outpost && (run.missionId === 'L02' || run.missionId === 'M04')) {
        next.outpost = startRun(getScenario(run.missionId, run.tier));
      }
      // Drop any key presses left over from the previous phase (for example a held engine key).
      input.clear();
      set({ run: next });
      saveCheckpoint(next);
    },

    setFlag: (flag, value) => {
      const run = get().run;
      if (run) set({ run: { ...run, flags: { ...run.flags, [flag]: value } } });
    },

    bumpStat: (key, by = 1) => {
      const run = get().run;
      if (run) set({ run: { ...run, stats: { ...run.stats, [key]: (run.stats[key] ?? 0) + by } } });
    },

    setStat: (key, value) => {
      const run = get().run;
      if (run) set({ run: { ...run, stats: { ...run.stats, [key]: value } } });
    },

    restartFromCheckpoint: () => {
      const run = get().run;
      if (!run) return;
      if (run.replayBaseline) {
        // A replay restarts from the checkpoint it restored.
        const outpost = restoreCheckpoint(run.replayBaseline, run.stats.replayTurn ?? 0);
        enterMission({ ...run, outpost, attempt: attemptCounter++ });
        return;
      }
      const cp = get().save.checkpoint;
      if (cp && cp.missionId === run.missionId) {
        const restored = runFrom(cp, attemptCounter++);
        // Attempts made since the checkpoint still count toward the debrief.
        restored.stats = { ...restored.stats, restarts: (run.stats.restarts ?? 0) + 1 };
        enterMission(restored);
      } else {
        get().restartMission();
      }
    },

    restartMission: () => {
      const run = get().run;
      const id = run?.missionId ?? get().selected;
      if (id) get().startMission(id);
    },

    outpostCommit: (chosen) => {
      const run = get().run;
      if (!run || !run.outpost || (run.missionId !== 'L02' && run.missionId !== 'M04')) return null;
      const scn = getScenario(run.missionId, run.tier);
      const step = commitTurn(scn, run.outpost, chosen);
      if (!step.result.ok) return step.result;
      const next = { ...run, outpost: step.run };
      set({ run: next });
      // Critical outcomes are not saved: the stored checkpoint stays on the last safe turn.
      if (step.run.state.outcome !== 'critical') saveCheckpoint(next);
      return step.result;
    },

    outpostRecover: () => {
      const run = get().run;
      if (!run?.outpost?.state.critical) return;
      const outpost = restoreCheckpoint(run.outpost, run.outpost.state.critical.turn);
      const next = { ...run, outpost, stats: { ...run.stats, recoveries: (run.stats.recoveries ?? 0) + 1 } };
      set({ run: next });
      saveCheckpoint(next);
    },

    completeMission: (partial) => {
      const run = get().run;
      if (!run) return;
      const def = DEMO_MISSIONS[run.missionId];
      const save = get().save;
      const isReplay = !!run.replayBaseline;
      let milestone: string | null = null;
      if (!isReplay) {
        const prev = save.completed[run.missionId];
        const completed = {
          ...save.completed,
          [run.missionId]: { tier: run.tier, completions: (prev?.completions ?? 0) + 1, summary: partial.crewStatus },
        };
        const milestones = [...save.milestones];
        if (def.milestone && !milestones.includes(def.milestone.id)) {
          milestones.push(def.milestone.id);
          milestone = def.milestone.label;
        }
        persist({ ...save, completed, milestones, checkpoint: null });
      }
      hud.reset();
      input.setSuspended(false);
      set({
        result: { ...partial, missionId: run.missionId, tier: run.tier, baseline: run.replayBaseline, milestone },
        screen: 'debrief', paused: false,
      });
    },

    startReplay: (turnIndex) => {
      const result = get().result;
      if (!result?.outpost) return;
      // Compare against the first run unless the player is replaying a replay.
      const baseline = result.baseline ?? result.outpost;
      const outpost = restoreCheckpoint(baseline, turnIndex);
      enterMission({
        missionId: result.missionId, tier: result.tier, phase: 'outpost', flags: { replay: true }, stats: { replayTurn: turnIndex },
        attempt: attemptCounter++, outpost, replayBaseline: baseline,
      });
    },

    continueAfterDebrief: () => {
      const result = get().result;
      const next = result ? missionAfter(result.missionId) : null;
      if (next && missionStatus(next, get().save.completed, get().mode === 'judge') !== 'locked') {
        set({ selected: next, screen: 'briefing', run: null });
      } else {
        set({ screen: 'atlas', run: null });
      }
    },

    setPaused: (paused) => {
      input.clear();
      set({ paused });
    },

    quitToAtlas: () => {
      hud.reset();
      input.setSuspended(false);
      set({ screen: 'atlas', run: null, paused: false });
    },

    resetProgress: () => {
      const fresh = defaultSave(makeId());
      fresh.settings = { ...get().save.settings };
      persist(fresh);
      set({ run: null, result: null, screen: 'home', notes: [] });
    },
  };
});

export function callSign(profileId: string): string {
  return 'Trainee ' + profileId.replace('guest-', '').slice(0, 4).toUpperCase();
}
