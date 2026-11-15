// Local save format. No names, emails or personal details: a guest profile is
// just a random id. Parsing is defensive: every part is validated on its own so
// a corrupt checkpoint never destroys campaign progress (FR-08).

import { DEMO_MISSIONS, phaseIds } from './missions';
import { RES_BOUNDS, RES_KEYS, type OutpostRun, type OutpostState } from './outpost';
import { scenarioById } from './outpostScenarios';
import { PLAYABLE, SCHEMA_VERSION, isDemoMission, isTier, type DemoMissionId, type MissionId, type Tier } from './types';

export interface Settings {
  tier: Tier;
  reducedMotion: boolean;
  /** Sound effects. */
  audio: boolean;
  /** Spoken alerts (speech synthesis). Separate from sound effects. */
  speech: boolean;
  captions: boolean;
  graphics: 'low' | 'high';
  hints: 'auto' | 'on' | 'off';
}

/** `stars` is the best rating so far. Records saved before ratings existed have none. */
/** `flags` are story facts later missions read, for example whether the spare battery was latched aboard the ship. */
export interface MissionRecord { tier: Tier; completions: number; summary: string; stars?: 1 | 2 | 3; flags?: Record<string, boolean> }

export interface Checkpoint {
  missionId: DemoMissionId;
  tier: Tier;
  phase: string;
  flags: Record<string, boolean>;
  stats: Record<string, number>;
  outpost: OutpostRun | null;
}

export interface SaveData {
  schemaVersion: number;
  profileId: string;
  settings: Settings;
  completed: Partial<Record<MissionId, MissionRecord>>;
  milestones: string[];
  checkpoint: Checkpoint | null;
}

export const DEFAULT_SETTINGS: Settings = {
  tier: 'junior', reducedMotion: false, audio: true, speech: false, captions: true, graphics: 'high', hints: 'auto',
};

export function hintsOn(settings: Settings, tier: Tier): boolean {
  if (settings.hints === 'on') return true;
  if (settings.hints === 'off') return false;
  return tier === 'junior';
}

export function defaultSave(profileId: string): SaveData {
  return { schemaVersion: SCHEMA_VERSION, profileId, settings: { ...DEFAULT_SETTINGS }, completed: {}, milestones: [], checkpoint: null };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseSettings(v: unknown): Settings | null {
  if (!isObj(v)) return null;
  if (!isTier(v.tier)) return null;
  // Saves written before sound effects and speech were split had one "audio"
  // switch, off by default. Those players get the new default (effects on) and
  // keep speech only if they had turned the old switch on.
  const legacy = typeof v.speech !== 'boolean';
  return {
    tier: v.tier,
    reducedMotion: v.reducedMotion === true,
    audio: legacy ? true : v.audio === true,
    speech: legacy ? v.audio === true : v.speech === true,
    captions: v.captions !== false,
    graphics: v.graphics === 'low' ? 'low' : 'high',
    hints: v.hints === 'on' || v.hints === 'off' ? v.hints : 'auto',
  };
}

function validOutpostState(v: unknown, scenarioId: string): v is OutpostState {
  if (!isObj(v)) return false;
  if (v.schemaVersion !== SCHEMA_VERSION || v.scenarioId !== scenarioId) return false;
  const scn = scenarioById(scenarioId);
  if (!scn) return false;
  if (typeof v.turn !== 'number' || v.turn < 0 || v.turn > scn.turns.length) return false;
  if (!isObj(v.resources) || !isObj(v.flags)) return false;
  for (const k of RES_KEYS) {
    const n = (v.resources as Record<string, unknown>)[k];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < RES_BOUNDS[k].min || n > RES_BOUNDS[k].max) return false;
  }
  if (!Array.isArray(v.firedEvents) || !Array.isArray(v.pending) || !Array.isArray(v.inbox) || !Array.isArray(v.history)) return false;
  if (v.outcome !== 'active' && v.outcome !== 'success' && v.outcome !== 'critical') return false;
  return true;
}

function parseOutpost(v: unknown, missionId: DemoMissionId, tier: Tier): OutpostRun | null {
  if (!isObj(v)) return null;
  const expected = `${missionId}-${tier}`;
  if (v.scenarioId !== expected) return null;
  if (!Array.isArray(v.snapshots) || !Array.isArray(v.decisions) || v.snapshots.length === 0) return null;
  if (!v.snapshots.every((s) => validOutpostState(s, expected))) return null;
  if (!validOutpostState(v.state, expected)) return null;
  if (!v.decisions.every((d) => Array.isArray(d) && d.every((x) => typeof x === 'string'))) return null;
  return v as unknown as OutpostRun;
}

export function parseCheckpoint(v: unknown): Checkpoint | null {
  if (!isObj(v)) return null;
  if (!isDemoMission(v.missionId) || !isTier(v.tier)) return null;
  if (typeof v.phase !== 'string' || !phaseIds(v.missionId).includes(v.phase)) return null;
  const flags: Record<string, boolean> = {};
  if (isObj(v.flags)) for (const [k, f] of Object.entries(v.flags)) if (typeof f === 'boolean') flags[k] = f;
  const stats: Record<string, number> = {};
  if (isObj(v.stats)) for (const [k, n] of Object.entries(v.stats)) if (typeof n === 'number' && Number.isFinite(n)) stats[k] = n;
  let outpost: OutpostRun | null = null;
  if (v.outpost != null) {
    outpost = parseOutpost(v.outpost, v.missionId, v.tier);
    if (!outpost) return null; // resource state cannot be trusted: reject the whole checkpoint
  }
  return { missionId: v.missionId, tier: v.tier, phase: v.phase, flags, stats, outpost };
}

export interface ParseResult { save: SaveData; notes: string[] }

/**
 * Read a stored save. Anything unreadable falls back on its own:
 *  - corrupt settings -> defaults
 *  - corrupt checkpoint -> the mission restarts from its first checkpoint, campaign progress is kept
 *  - unreadable file or wrong schema -> fresh guest profile
 */
export function parseSave(raw: string | null, makeId: () => string): ParseResult {
  const notes: string[] = [];
  if (raw == null) return { save: defaultSave(makeId()), notes };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    notes.push('The saved game could not be read, so a new guest profile was started.');
    return { save: defaultSave(makeId()), notes };
  }
  if (!isObj(data)) {
    notes.push('The saved game was not recognised, so a new guest profile was started.');
    return { save: defaultSave(makeId()), notes };
  }
  const profileId = typeof data.profileId === 'string' && data.profileId.length > 0 ? data.profileId : makeId();
  const save = defaultSave(profileId);

  const settings = parseSettings(data.settings);
  if (settings) save.settings = settings;
  else notes.push('Settings were reset to their defaults.');

  if (isObj(data.completed)) {
    for (const id of PLAYABLE) {
      const rec = data.completed[id];
      if (isObj(rec) && isTier(rec.tier)) {
        save.completed[id] = {
          tier: rec.tier,
          completions: typeof rec.completions === 'number' && rec.completions > 0 ? Math.floor(rec.completions) : 1,
          summary: typeof rec.summary === 'string' ? rec.summary : '',
          ...(rec.stars === 1 || rec.stars === 2 || rec.stars === 3 ? { stars: rec.stars } : {}),
          ...(isObj(rec.flags) ? { flags: Object.fromEntries(Object.entries(rec.flags).filter(([, f]) => typeof f === 'boolean')) as Record<string, boolean> } : {}),
        };
      }
    }
  }
  if (Array.isArray(data.milestones)) {
    const known = Object.values(DEMO_MISSIONS).map((m) => m.milestone?.id).filter(Boolean);
    save.milestones = data.milestones.filter((m): m is string => typeof m === 'string' && known.includes(m));
  }

  if (data.checkpoint != null) {
    const compatible = data.schemaVersion === SCHEMA_VERSION;
    const cp = compatible ? parseCheckpoint(data.checkpoint) : null;
    if (cp) {
      save.checkpoint = cp;
    } else {
      // Fall back to the latest valid mission start while keeping campaign progress.
      const raw = data.checkpoint;
      if (isObj(raw) && isDemoMission(raw.missionId)) {
        const tier = isTier(raw.tier) ? raw.tier : save.settings.tier;
        save.checkpoint = { missionId: raw.missionId, tier, phase: phaseIds(raw.missionId)[0], flags: {}, stats: {}, outpost: null };
        notes.push(`The checkpoint in ${DEMO_MISSIONS[raw.missionId].title} could not be restored. The mission will start from its beginning. Completed missions are safe.`);
      } else {
        notes.push('A saved checkpoint could not be restored. Completed missions are safe.');
      }
    }
  }
  return { save, notes };
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save);
}

export const SAVE_KEYS = { campaign: 'beyondEarth.campaign.v1', judge: 'beyondEarth.judge.v1' } as const;
