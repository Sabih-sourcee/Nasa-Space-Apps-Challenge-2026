import { describe, expect, it } from 'vitest';
import { ORBIT_ALTITUDE } from '../src/sim/flight';
import { BOOSTER_SEP_ALT, CORE_SEP_ALT, ORBIT_ALT, enginePower, separationCall, stackPitch, stackState } from '../src/sim/launchStack';
import { DEMO_MISSIONS } from '../src/sim/missions';
import { SEQUENCES, SEQUENCE_AFTER, SEQUENCE_INTO, sequenceSeconds, sequencesFor, shotAt, shotStart, type SequenceId } from '../src/sim/sequences';
import { PLAYABLE } from '../src/sim/types';

describe('launch stack', () => {
  it('drops the boosters first, then the core, both before orbit', () => {
    expect(BOOSTER_SEP_ALT).toBeLessThan(CORE_SEP_ALT);
    expect(CORE_SEP_ALT).toBeLessThan(ORBIT_ALT);
    expect(ORBIT_ALT).toBe(ORBIT_ALTITUDE);
    expect(stackState(0)).toMatchObject({ boostersAway: false, coreAway: false });
    expect(stackState(BOOSTER_SEP_ALT)).toMatchObject({ boostersAway: true, coreAway: false });
    expect(stackState(CORE_SEP_ALT)).toMatchObject({ boostersAway: true, coreAway: true });
  });

  it('never lights an engine on a part that has gone', () => {
    expect(enginePower(10, 1)).toEqual([1, 1, 0]);
    expect(enginePower(BOOSTER_SEP_ALT + 1, 0.5)).toEqual([0, 0.5, 0]);
    expect(enginePower(CORE_SEP_ALT + 1, 1)).toEqual([0, 0, 1]);
    expect(enginePower(100, 0)).toEqual([0, 0, 0]);
  });

  it('climbs straight at first and leans over steadily, never past flat', () => {
    expect(stackPitch(0)).toBe(0);
    expect(stackPitch(1)).toBe(0);
    let last = 0;
    for (let alt = 2; alt <= ORBIT_ALT; alt += 4) {
      const p = stackPitch(alt);
      expect(p).toBeGreaterThan(last);
      expect(p).toBeLessThan(Math.PI / 2);
      last = p;
    }
    expect(stackPitch(ORBIT_ALT + 500)).toBe(stackPitch(ORBIT_ALT));
  });

  it('calls each separation once, as the height is crossed', () => {
    expect(separationCall(BOOSTER_SEP_ALT - 1, BOOSTER_SEP_ALT + 1)).toMatch(/Booster/);
    expect(separationCall(CORE_SEP_ALT - 1, CORE_SEP_ALT + 1)).toMatch(/Core stage/);
    expect(separationCall(BOOSTER_SEP_ALT + 1, BOOSTER_SEP_ALT + 2)).toBeNull();
    expect(separationCall(10, 20)).toBeNull();
    // A reset drops the height back down: no call on the way down.
    expect(separationCall(BOOSTER_SEP_ALT + 5, 0)).toBeNull();
  });
});

describe('journey sequences', () => {
  const ids = Object.keys(SEQUENCES) as SequenceId[];

  it('belong to playable missions, each film used exactly once', () => {
    const used: SequenceId[] = [];
    for (const [mission, seq] of Object.entries(SEQUENCE_INTO)) {
      expect(PLAYABLE).toContain(mission);
      expect(SEQUENCES[seq as SequenceId]).toMatchObject({ mission, when: 'before' });
      used.push(seq as SequenceId);
    }
    for (const [mission, seq] of Object.entries(SEQUENCE_AFTER)) {
      expect(PLAYABLE).toContain(mission);
      expect(SEQUENCES[seq as SequenceId]).toMatchObject({ mission, when: 'after' });
      used.push(seq as SequenceId);
    }
    expect(used.slice().sort()).toEqual(ids.slice().sort());
  });

  it('gives every mission a film before it, after it, or both', () => {
    for (const id of PLAYABLE) {
      expect(DEMO_MISSIONS[id]).toBeDefined();
      expect(sequencesFor(id).length).toBeGreaterThanOrEqual(1);
    }
    // The landings and the long flights are bracketed on both sides.
    for (const id of ['F01', 'S01', 'L02', 'M04'] as const) expect(sequencesFor(id).length).toBe(2);
  });

  it('keeps emergency openings short, so the player can act', () => {
    const urgent = ids.filter((id) => SEQUENCES[id].urgent);
    expect(urgent.sort()).toEqual(['alarm', 'fault', 'shadow']);
    for (const id of urgent) {
      expect(SEQUENCES[id].when).toBe('before');
      expect(sequenceSeconds(SEQUENCES[id])).toBeLessThanOrEqual(10);
      expect(SEQUENCES[id].shots.length).toBe(2);
    }
  });

  it.each(ids)('%s is the right length, captioned in every shot, and says what was shortened', (id) => {
    const def = SEQUENCES[id];
    const total = sequenceSeconds(def);
    expect(total).toBeGreaterThanOrEqual(def.urgent ? 8 : 10);
    expect(total).toBeLessThanOrEqual(25);
    for (const s of def.shots) {
      expect(s.caption.length).toBeGreaterThan(20);
      expect(s.caption.length).toBeLessThan(140);
      expect(s.seconds).toBeGreaterThanOrEqual(4);
    }
    expect(new Set(def.shots.map((s) => s.id)).size).toBe(def.shots.length);
    expect(def.simplified.length).toBeGreaterThan(20);
  });

  it.each(ids)('%s steps through its shots in order and then reports done', (id) => {
    const def = SEQUENCES[id];
    expect(shotAt(def, 0)).toEqual({ index: 0, local: 0, done: false });
    let last = 0;
    for (let t = 0; t < sequenceSeconds(def); t += 0.25) {
      const at = shotAt(def, t);
      expect(at.index).toBeGreaterThanOrEqual(last);
      expect(at.local).toBeGreaterThanOrEqual(0);
      expect(at.local).toBeLessThan(1);
      expect(at.done).toBe(false);
      last = at.index;
    }
    expect(last).toBe(def.shots.length - 1);
    expect(shotAt(def, sequenceSeconds(def))).toEqual({ index: def.shots.length - 1, local: 1, done: true });
    def.shots.forEach((_, i) => expect(shotAt(def, shotStart(def, i) + 0.001).index).toBe(i));
  });
});
