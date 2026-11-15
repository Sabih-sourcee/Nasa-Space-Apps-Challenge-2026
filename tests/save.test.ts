import { describe, expect, it } from 'vitest';
import { CATALOG, DEMO_MISSIONS, missionAfter, missionStatus, nextMission } from '../src/sim/missions';
import { runScenario } from '../src/sim/outpost';
import { getScenario } from '../src/sim/outpostScenarios';
import { SAVE_KEYS, defaultSave, hintsOn, parseSave, serializeSave, type SaveData } from '../src/sim/save';
import { SOURCES, sourceById } from '../src/sim/sources';
import { DEMO_ROUTE, PLAYABLE, SCHEMA_VERSION } from '../src/sim/types';

const id = () => 'guest-test';

function midMissionSave(): SaveData {
  const save = defaultSave('guest-abc');
  save.settings.tier = 'middle';
  save.completed.E02 = { tier: 'middle', completions: 1, summary: 'ok' };
  save.completed.F01 = { tier: 'middle', completions: 2, summary: 'ok' };
  save.milestones = ['flight_ready'];
  const scn = getScenario('L02', 'middle');
  save.checkpoint = {
    missionId: 'L02', tier: 'middle', phase: 'outpost', flags: { pouch: true }, stats: { landingAttempts: 2 },
    outpost: runScenario(scn, [['air_full', 'lights_on']]),
  };
  return save;
}

describe('AT-06 save and resume', () => {
  it('round-trips profile, tier, objective phase and resource state', () => {
    const save = midMissionSave();
    const { save: loaded, notes } = parseSave(serializeSave(save), id);
    expect(notes).toEqual([]);
    expect(loaded).toEqual(save);
    expect(loaded.checkpoint?.outpost?.state.resources.battery).toBe(1);
    expect(loaded.checkpoint?.phase).toBe('outpost');
  });

  it('starts a guest profile when nothing is stored, with no personal details', () => {
    const { save } = parseSave(null, id);
    expect(save.profileId).toBe('guest-test');
    expect(Object.keys(save).sort()).toEqual(['checkpoint', 'completed', 'milestones', 'profileId', 'schemaVersion', 'settings']);
    expect(save.settings.tier).toBe('junior');
  });

  it('Judge Mode uses a separate storage key', () => {
    expect(SAVE_KEYS.judge).not.toBe(SAVE_KEYS.campaign);
  });
});

describe('FR-08 corrupt or incompatible saves', () => {
  it('unreadable JSON falls back to a fresh profile with a note', () => {
    const { save, notes } = parseSave('{not json', id);
    expect(save.completed).toEqual({});
    expect(notes.length).toBe(1);
  });

  it('a corrupt checkpoint falls back to the mission start and keeps completed missions', () => {
    const save = midMissionSave();
    const raw = JSON.parse(serializeSave(save));
    raw.checkpoint.outpost.state.resources.battery = 999;
    const { save: loaded, notes } = parseSave(JSON.stringify(raw), id);
    expect(loaded.completed.E02).toBeDefined();
    expect(loaded.completed.F01?.completions).toBe(2);
    expect(loaded.milestones).toEqual(['flight_ready']);
    expect(loaded.checkpoint).toEqual({ missionId: 'L02', tier: 'middle', phase: 'landing', flags: {}, stats: {}, outpost: null });
    expect(notes[0]).toMatch(/Completed missions are safe/);
  });

  it('an unknown phase or mission id is rejected', () => {
    const raw = JSON.parse(serializeSave(midMissionSave()));
    raw.checkpoint.phase = 'warp_drive';
    expect(parseSave(JSON.stringify(raw), id).save.checkpoint?.phase).toBe('landing');
    raw.checkpoint.missionId = 'Z99';
    const { save } = parseSave(JSON.stringify(raw), id);
    expect(save.checkpoint).toBeNull();
    expect(save.completed.E02).toBeDefined();
  });

  it('an incompatible schema version drops the checkpoint state but keeps progress', () => {
    const raw = JSON.parse(serializeSave(midMissionSave()));
    raw.schemaVersion = SCHEMA_VERSION + 1;
    const { save, notes } = parseSave(JSON.stringify(raw), id);
    expect(save.checkpoint?.phase).toBe('landing');
    expect(save.checkpoint?.outpost).toBeNull();
    expect(save.completed.F01).toBeDefined();
    expect(notes.length).toBe(1);
  });

  it('corrupt settings reset to defaults without touching progress', () => {
    const raw = JSON.parse(serializeSave(midMissionSave()));
    raw.settings = { tier: 'legendary' };
    const { save } = parseSave(JSON.stringify(raw), id);
    expect(save.settings.tier).toBe('junior');
    expect(save.completed.E02).toBeDefined();
  });
});

describe('campaign catalog and progression', () => {
  it('lists 20 missions across five worlds, eight of them playable', () => {
    expect(CATALOG.length).toBe(20);
    expect(new Set(CATALOG.map((m) => m.world)).size).toBe(5);
    expect(CATALOG.filter((m) => m.demo).map((m) => m.id)).toEqual(PLAYABLE);
    expect(Object.keys(DEMO_MISSIONS)).toEqual(PLAYABLE);
    expect(DEMO_ROUTE.length).toBe(5);
    expect(DEMO_ROUTE.every((id) => PLAYABLE.includes(id))).toBe(true);
  });

  it('S04 is an extra station mission: it needs S01 and does not block the Moon', () => {
    expect(missionStatus('S04', { E02: 1, F01: 1 }, false)).toBe('locked');
    expect(missionStatus('S04', { E02: 1, F01: 1, S01: 1 }, false)).toBe('available');
    expect(missionStatus('L02', { E02: 1, F01: 1, S01: 1 }, false)).toBe('available');
    expect(nextMission({ E02: 1, F01: 1, S01: 1 })).toBe('L02');
    expect(missionAfter('S04')).toBe('L02');
    expect(missionAfter('S01')).toBe('L02');
    expect(missionAfter('M04')).toBeNull();
  });

  it('has one playable mission per world', () => {
    expect(new Set(DEMO_ROUTE.map((idd) => DEMO_MISSIONS[idd].world)).size).toBe(5);
  });

  it('FR-01: completing a mission unlocks the next one', () => {
    expect(missionStatus('E02', {}, false)).toBe('available');
    expect(missionStatus('F01', {}, false)).toBe('locked');
    expect(missionStatus('F01', { E02: true }, false)).toBe('available');
    expect(missionStatus('E02', { E02: true }, false)).toBe('completed');
    expect(missionStatus('E01', {}, false)).toBe('planned');
    expect(nextMission({ E02: true, F01: true })).toBe('S01');
    expect(nextMission({ E02: 1, F01: 1, S01: 1, L02: 1, M04: 1 })).toBeNull();
  });

  it('Judge Mode opens every implemented mission and nothing else', () => {
    for (const m of CATALOG) {
      expect(missionStatus(m.id, {}, true)).toBe(m.demo ? 'available' : 'planned');
    }
  });

  it('FR-06: every playable mission defines entry, objectives, tiers, checkpoints, emergencies, success and retry', () => {
    for (const m of Object.values(DEMO_MISSIONS)) {
      expect(m.entry.length).toBeGreaterThan(5);
      expect(m.phases.length).toBeGreaterThan(1);
      for (const p of m.phases) { expect(p.objective).toBeTruthy(); expect(p.checkpoint).toBeTruthy(); }
      expect(Object.keys(m.tiers)).toEqual(['junior', 'middle', 'advanced']);
      expect(m.emergencies.length).toBeGreaterThan(0);
      for (const e of m.emergencies) {
        for (const field of [e.trigger, e.warning, e.symptoms, e.actions, e.effects, e.recovery, e.debrief]) {
          expect(field.length).toBeGreaterThan(10);
        }
      }
      expect(m.success).toBeTruthy();
      expect(m.retry).toBeTruthy();
    }
  });

  it('FR-10: every science note points at a bundled source', () => {
    for (const m of Object.values(DEMO_MISSIONS)) {
      expect(sourceById(m.science.sourceId)).toBeDefined();
      expect(sourceById(m.fact.sourceId)).toBeDefined();
    }
    for (const mission of ['L02', 'M04'] as const) {
      for (const ev of getScenario(mission, 'advanced').turns.flatMap((t) => t.events)) {
        if (ev.sourceId) expect(sourceById(ev.sourceId)).toBeDefined();
      }
    }
    const donki = sourceById('donki_alert');
    expect(donki?.kind).toBe('archived-record');
    expect(donki?.title).toMatch(/20260905-AL-007/);
    expect(SOURCES.every((s) => s.url.startsWith('https://'))).toBe(true);
  });

  it('hints default on for Junior only', () => {
    const s = defaultSave('x').settings;
    expect(hintsOn(s, 'junior')).toBe(true);
    expect(hintsOn(s, 'middle')).toBe(false);
    expect(hintsOn({ ...s, hints: 'on' }, 'advanced')).toBe(true);
  });
});
