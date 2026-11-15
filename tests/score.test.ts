import { describe, expect, it } from 'vitest';
import { ascentAutopilot, makeAscent, stepAscent } from '../src/sim/flight';
import { commitTurn, enumerateSelections, startRun, type OutpostRun, type ScenarioSpec } from '../src/sim/outpost';
import { getScenario } from '../src/sim/outpostScenarios';
import { DEFAULT_SETTINGS, defaultSave, parseSave, serializeSave } from '../src/sim/save';
import {
  MAX_STARS, STAR_GOAL, rankFor, rateAlert, rateAscent, rateOutpost, rateStation, rateSuitLab, starsOf, totalStars,
} from '../src/sim/score';
import { PLAYABLE, TIERS } from '../src/sim/types';

const id = () => 'guest-test';

describe('star ratings', () => {
  it('a finished mission always earns between one and three stars', () => {
    const all = [
      rateSuitLab(0), rateSuitLab(9), rateAscent(0, 1), rateAscent(3, 7), rateStation(1, 0), rateStation(5, 5),
      rateAlert(0, 100, true), rateAlert(4, 41, false), rateOutpost(100, 0), rateOutpost(41, 3),
    ];
    for (const r of all) {
      expect(r.stars).toBeGreaterThanOrEqual(1);
      expect(r.stars).toBeLessThanOrEqual(3);
    }
  });

  it('three stars come with no tip, fewer stars always say what to change', () => {
    expect(rateSuitLab(0)).toEqual({ stars: 3, tip: null });
    expect(rateAscent(0, 1)).toEqual({ stars: 3, tip: null });
    expect(rateStation(1, 0)).toEqual({ stars: 3, tip: null });
    expect(rateAlert(0, 61, false)).toEqual({ stars: 3, tip: null });
    expect(rateOutpost(75, 0)).toEqual({ stars: 3, tip: null });
    for (const r of [rateSuitLab(1), rateAscent(1, 1), rateAscent(0, 2), rateStation(2, 0), rateStation(1, 1), rateAlert(1, 90, true), rateAlert(0, 50, false), rateOutpost(60, 0), rateOutpost(90, 1)]) {
      expect(r.stars).toBeLessThan(3);
      expect(r.tip).toMatch(/3 stars/);
    }
  });

  it('suit lab: no misjudged reading is three stars, one or two is two stars', () => {
    expect(rateSuitLab(0).stars).toBe(3);
    expect(rateSuitLab(1).stars).toBe(2);
    expect(rateSuitLab(2).stars).toBe(2);
    expect(rateSuitLab(3).stars).toBe(1);
  });

  it('ascent: every gate on the first launch is three stars', () => {
    expect(rateAscent(0, 1).stars).toBe(3);
    expect(rateAscent(1, 1).stars).toBe(2);
    expect(rateAscent(0, 2).stars).toBe(2);
    expect(rateAscent(2, 1).stars).toBe(1);
    expect(rateAscent(0, 3).stars).toBe(1);
  });

  it('station: first-approach docking with no tether is three stars', () => {
    expect(rateStation(1, 0).stars).toBe(3);
    expect(rateStation(2, 1).stars).toBe(2);
    expect(rateStation(3, 0).stars).toBe(1);
    expect(rateStation(1, 2).stars).toBe(1);
  });

  it('module alert: both ways of handling the leak can earn three stars', () => {
    // Seal at once: lots of air left, experiment lost.
    expect(rateAlert(0, 82, false).stars).toBe(3);
    // Rescue first: the experiment is safe, air is lower.
    expect(rateAlert(0, 48, true).stars).toBe(3);
    // A wrong report costs a star either way.
    expect(rateAlert(1, 82, false).stars).toBe(2);
    expect(rateAlert(1, 48, true).stars).toBe(2);
    // Slow and nothing saved.
    expect(rateAlert(0, 50, false).stars).toBe(2);
    expect(rateAlert(2, 50, false).stars).toBe(1);
  });

  it('outpost: fresh air and no recovery is three stars', () => {
    expect(rateOutpost(100, 0).stars).toBe(3);
    expect(rateOutpost(75, 0).stars).toBe(3);
    expect(rateOutpost(74, 0).stars).toBe(2);
    expect(rateOutpost(90, 1).stars).toBe(2);
    expect(rateOutpost(55, 2).stars).toBe(2);
    expect(rateOutpost(54, 0).stars).toBe(1);
  });

  it('every playable mission states its three-star goal', () => {
    for (const m of PLAYABLE) expect(STAR_GOAL[m].length).toBeGreaterThan(20);
  });
});

describe('three stars are reachable on every tier', () => {
  it.each(TIERS)('%s: a steered climb passes every gate', (tier) => {
    let s = makeAscent(tier);
    for (let i = 0; i < 200 * 60 && s.status === 'flying'; i++) s = stepAscent(s, ascentAutopilot(s, tier), 1 / 60, tier);
    expect(s.status).toBe('orbit');
    expect(rateAscent(s.gatesMissed, 1).stars).toBe(3);
  });

  /** Best final air over every possible set of decisions that finishes the scenario. */
  function bestAir(scn: ScenarioSpec, run: OutpostRun = startRun(scn)): number {
    if (run.state.outcome === 'success') return run.state.resources.air;
    if (run.state.outcome !== 'active') return -1;
    let best = -1;
    for (const pick of enumerateSelections(scn, run.state)) {
      const step = commitTurn(scn, run, pick);
      if (step.result.ok) best = Math.max(best, bestAir(scn, step.run));
    }
    return best;
  }

  it.each(TIERS.flatMap((tier) => (['L02', 'M04'] as const).map((m) => [m, tier] as const)))('%s %s: some power plan keeps the air at 75% or more', (missionId, tier) => {
    const air = bestAir(getScenario(missionId, tier));
    expect(rateOutpost(air, 0).stars).toBe(3);
  });
});

describe('totals and ranks', () => {
  it('counts stars over the playable missions, and old records as one star', () => {
    expect(MAX_STARS).toBe(PLAYABLE.length * 3);
    expect(starsOf(undefined)).toBe(0);
    expect(starsOf({})).toBe(1);
    expect(starsOf({ stars: 3 })).toBe(3);
    expect(totalStars({})).toBe(0);
    expect(totalStars({ E02: { stars: 3 }, F01: { stars: 2 }, L02: {} })).toBe(6);
  });

  it('ranks rise with stars and name the next rank', () => {
    expect(rankFor(0).title).toBe('Space Cadet');
    expect(rankFor(0).next?.at).toBe(3);
    expect(rankFor(3).title).toBe('Flight Trainee');
    expect(rankFor(11).title).toBe('Astronaut');
    expect(rankFor(MAX_STARS).title).toBe('Mission Commander');
    expect(rankFor(MAX_STARS).next).toBeNull();
    let last = -1;
    for (let s = 0; s <= MAX_STARS; s++) {
      const r = rankFor(s);
      expect(r.at).toBeGreaterThanOrEqual(last);
      expect(r.at).toBeLessThanOrEqual(s);
      last = r.at;
    }
  });
});

describe('saving stars and sound settings', () => {
  it('best stars survive a save and load', () => {
    const save = defaultSave('guest-abc');
    save.completed.E02 = { tier: 'junior', completions: 2, summary: 'ok', stars: 3 };
    save.completed.F01 = { tier: 'junior', completions: 1, summary: 'ok', stars: 1 };
    const { save: loaded, notes } = parseSave(serializeSave(save), id);
    expect(notes).toEqual([]);
    expect(loaded).toEqual(save);
  });

  it('a record without stars or with a bad value loads without stars', () => {
    const raw = JSON.parse(serializeSave(defaultSave('guest-abc')));
    raw.completed = { E02: { tier: 'junior', completions: 1, summary: 'ok' }, F01: { tier: 'junior', completions: 1, summary: 'ok', stars: 7 } };
    const { save } = parseSave(JSON.stringify(raw), id);
    expect(save.completed.E02).toEqual({ tier: 'junior', completions: 1, summary: 'ok' });
    expect(save.completed.F01?.stars).toBeUndefined();
    expect(totalStars(save.completed)).toBe(2);
  });

  it('sound effects are on and spoken alerts are off for a new player', () => {
    expect(DEFAULT_SETTINGS.audio).toBe(true);
    expect(DEFAULT_SETTINGS.speech).toBe(false);
  });

  it('saves from before the sound split get effects on and keep their speech choice', () => {
    const old = (audio: boolean) => {
      const raw = JSON.parse(serializeSave(defaultSave('guest-abc')));
      raw.settings = { tier: 'middle', reducedMotion: true, audio, captions: true, graphics: 'high', hints: 'auto' };
      return parseSave(JSON.stringify(raw), id).save.settings;
    };
    expect(old(false)).toMatchObject({ tier: 'middle', reducedMotion: true, audio: true, speech: false });
    expect(old(true)).toMatchObject({ audio: true, speech: true });
  });

  it('a muted game stays muted', () => {
    const save = defaultSave('guest-abc');
    save.settings.audio = false;
    save.settings.speech = false;
    expect(parseSave(serializeSave(save), id).save.settings).toMatchObject({ audio: false, speech: false });
  });
});
