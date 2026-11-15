import { describe, expect, it } from 'vitest';
import {
  RES_BOUNDS, RES_KEYS, applyTurn, budgetFor, commitTurn, compareRuns, enumerateSelections, initialState,
  reserveAfter, restoreCheckpoint, runScenario, startRun, validateSelection, type OutpostRun, type ScenarioSpec,
} from '../src/sim/outpost';
import { getScenario } from '../src/sim/outpostScenarios';
import { TIERS } from '../src/sim/types';

/** Walk every valid decision path of a scenario. */
function explore(scn: ScenarioSpec): { runs: OutpostRun[]; deadEnds: number } {
  const done: OutpostRun[] = [];
  let deadEnds = 0;
  const walk = (run: OutpostRun) => {
    if (run.state.outcome !== 'active') { done.push(run); return; }
    const options = enumerateSelections(scn, run.state);
    if (options.length === 0) { deadEnds += 1; return; }
    for (const chosen of options) {
      const step = commitTurn(scn, run, chosen);
      if (!step.result.ok) throw new Error(step.result.error);
      walk(step.run);
    }
  };
  walk(startRun(scn));
  return { runs: done, deadEnds };
}

describe('SRS reference scenario (L02 Middle)', () => {
  const scn = getScenario('L02', 'middle');

  it('six units arrive, air support costs three, grow lights cost two', () => {
    const { state } = initialState(scn);
    const turn = scn.turns[0];
    expect(turn.income).toBe(6);
    expect(turn.actions.find((a) => a.id === 'air_full')?.cost).toBe(3);
    expect(turn.actions.find((a) => a.id === 'lights_on')?.cost).toBe(2);
    expect(budgetFor(scn, state, ['air_full', 'lights_on']).remaining).toBe(1);
    expect(budgetFor(scn, state, ['air_full', 'lights_off']).remaining).toBe(3);
  });

  it('running the lights banks one unit, skipping them banks three and delays the crop', () => {
    const lights = runScenario(scn, [['air_full', 'lights_on']]);
    const bank = runScenario(scn, [['air_full', 'lights_off']]);
    expect(lights.state.resources.battery).toBe(1);
    expect(bank.state.resources.battery).toBe(3);
    expect(lights.state.resources.crop).toBeGreaterThan(bank.state.resources.crop);
  });

  it('at the next checkpoint panels give two units and both routes still fund air support', () => {
    expect(scn.turns[1].income).toBe(2);
    for (const first of ['lights_on', 'lights_off']) {
      const run = runScenario(scn, [['air_full', first]]);
      expect(validateSelection(scn, run.state, ['air_full', 'shelter_basic'])).toBeNull();
    }
  });

  it('only the banked route can afford the upgraded shelter fans', () => {
    const lights = runScenario(scn, [['air_full', 'lights_on']]);
    const bank = runScenario(scn, [['air_full', 'lights_off']]);
    expect(validateSelection(scn, lights.state, ['air_full', 'shelter_fans'])).not.toBeNull();
    expect(validateSelection(scn, bank.state, ['air_full', 'shelter_fans'])).toBeNull();
  });

  it('the solar alert is a separate event with archived NASA provenance', () => {
    const run = runScenario(scn, [['air_full', 'lights_on']]);
    expect(run.state.firedEvents).toContain('sunny:shadow_arrives');
    expect(run.state.firedEvents).toContain('solar_alert:solar_alert');
    const alert = scn.turns[1].events.find((e) => e.id === 'solar_alert');
    expect(alert?.sourceId).toBe('donki_alert');
  });

  it('the crop consequence shows up at a later checkpoint', () => {
    const lights = runScenario(scn, [['air_full', 'lights_on'], ['air_full', 'shelter_basic'], ['air_full', 'bank_spare']]);
    const bank = runScenario(scn, [['air_full', 'lights_off'], ['air_full', 'shelter_fans'], ['air_full', 'bank_spare']]);
    expect(lights.state.outcome).toBe('success');
    expect(bank.state.outcome).toBe('success');
    expect(lights.state.flags.harvest).toBe(true);
    expect(bank.state.flags.harvest).toBe(false);
    expect(bank.state.resources.air).toBeGreaterThan(lights.state.resources.air);
  });
});

describe('AT-05 Mission Replay', () => {
  const scn = getScenario('L02', 'middle');
  const original = runScenario(scn, [['air_full', 'lights_on'], ['air_full', 'shelter_basic'], ['air_full', 'bank_spare']]);

  it('identical actions produce identical results', () => {
    const again = runScenario(scn, original.decisions);
    expect(again.state).toEqual(original.state);
    expect(again.snapshots).toEqual(original.snapshots);
  });

  it('restoring a checkpoint restores resources, flags, event cursor and messages', () => {
    const restored = restoreCheckpoint(original, 0);
    const fresh = startRun(scn);
    expect(restored.state).toEqual(fresh.state);
    expect(restored.decisions).toEqual([]);
    const mid = restoreCheckpoint(original, 1);
    expect(mid.state).toEqual(original.snapshots[1]);
    expect(mid.state.firedEvents).toEqual(original.snapshots[1].firedEvents);
  });

  it('replaying the same decisions from a checkpoint reproduces the outcome', () => {
    let replay = restoreCheckpoint(original, 0);
    for (const chosen of original.decisions) replay = commitTurn(scn, replay, chosen).run;
    expect(replay.state).toEqual(original.state);
  });

  it('changing only the crop-light choice gives a two-unit reserve difference before the shelter choice', () => {
    let replay = restoreCheckpoint(original, 0);
    replay = commitTurn(scn, replay, ['air_full', 'lights_off']).run;
    expect(reserveAfter(original, 0)).toBe(1);
    expect(reserveAfter(replay, 0)).toBe(3);
    expect((reserveAfter(replay, 0) as number) - (reserveAfter(original, 0) as number)).toBe(2);

    replay = commitTurn(scn, replay, ['air_full', 'shelter_fans']).run;
    replay = commitTurn(scn, replay, ['air_full', 'bank_spare']).run;
    const cmp = compareRuns(scn, original, replay);
    expect(cmp).not.toBeNull();
    expect(cmp?.changedTurn).toBe(0);
    expect(cmp?.reserveOriginal).toBe(1);
    expect(cmp?.reserveReplay).toBe(3);
    expect(cmp?.explanation).toMatch(/2 units more/);
    const air = cmp?.rows.find((r) => r.res === 'air');
    expect(air?.replay).toBeGreaterThan(air?.original as number);
  });

  it('restoring does not mutate the original run', () => {
    const copy = JSON.stringify(original);
    const replay = restoreCheckpoint(original, 1);
    commitTurn(scn, replay, ['air_eco', 'shelter_basic']);
    expect(JSON.stringify(original)).toBe(copy);
  });
});

describe('AT-03 difficulty tiers', () => {
  it('Junior shows two primary meters; Middle and Advanced add crops', () => {
    for (const mission of ['L02', 'M04'] as const) {
      expect(getScenario(mission, 'junior').meters).toEqual(['air', 'battery']);
      expect(getScenario(mission, 'middle').meters).toEqual(['air', 'battery', 'crop']);
      expect(getScenario(mission, 'advanced').meters.length).toBe(3);
    }
  });

  it('Middle and Advanced add meaningful decisions on top of Junior', () => {
    const count = (tier: (typeof TIERS)[number]) => getScenario('L02', tier).turns.flatMap((t) => t.actions).length;
    expect(count('middle')).toBeGreaterThan(count('junior'));
    expect(count('advanced')).toBeGreaterThan(count('middle'));
  });

  for (const mission of ['L02', 'M04'] as const) {
    for (const tier of TIERS) {
      it(`${mission} ${tier}: has a successful path, no dead ends, and stays in bounds`, () => {
        const scn = getScenario(mission, tier);
        const { runs, deadEnds } = explore(scn);
        expect(deadEnds).toBe(0);
        expect(runs.some((r) => r.state.outcome === 'success')).toBe(true);
        for (const run of runs) {
          for (const snap of [...run.snapshots, run.state]) {
            for (const k of RES_KEYS) {
              expect(snap.resources[k]).toBeGreaterThanOrEqual(RES_BOUNDS[k].min);
              expect(snap.resources[k]).toBeLessThanOrEqual(RES_BOUNDS[k].max);
            }
          }
        }
      });
    }
  }

  it('Advanced offers more than one viable plan with different outcomes', () => {
    const { runs } = explore(getScenario('L02', 'advanced'));
    const wins = runs.filter((r) => r.state.outcome === 'success');
    const signatures = new Set(wins.map((r) => `${r.state.resources.air}|${r.state.resources.crop}|${r.state.resources.science}`));
    expect(signatures.size).toBeGreaterThan(3);
  });

  it('no choice is free: every alternative in a group differs in cost or effect', () => {
    for (const mission of ['L02', 'M04'] as const) {
      for (const tier of TIERS) {
        for (const turn of getScenario(mission, tier).turns) {
          const groups = new Set(turn.actions.filter((a) => a.group).map((a) => a.group));
          for (const g of groups) {
            const sigs = turn.actions.filter((a) => a.group === g).map((a) => `${a.cost}|${JSON.stringify(a.effects)}`);
            expect(new Set(sigs).size).toBe(sigs.length);
          }
        }
      }
    }
  });
});

describe('AT-04 emergencies and recovery', () => {
  it('lunar solar alert: skipping the shelter is critical, explains the cause and is recoverable', () => {
    const scn = getScenario('L02', 'middle');
    const run = runScenario(scn, [['air_full', 'lights_on'], ['air_full', 'keep_working']]);
    expect(run.state.outcome).toBe('critical');
    expect(run.state.critical?.causeAction).toBe('keep_working');
    expect(run.state.critical?.explanation).toMatch(/shelter/i);
    let recovered = restoreCheckpoint(run, run.state.critical?.turn as number);
    expect(recovered.state.outcome).toBe('active');
    recovered = commitTurn(scn, recovered, ['air_full', 'shelter_basic']).run;
    recovered = commitTurn(scn, recovered, ['air_full', 'bank_spare']).run;
    expect(recovered.state.outcome).toBe('success');
  });

  it('every emergency event carries a warning, a visible symptom and a debrief line', () => {
    for (const mission of ['L02', 'M04'] as const) {
      for (const tier of TIERS) {
        for (const ev of getScenario(mission, tier).turns.flatMap((t) => t.events)) {
          expect(ev.warning.length).toBeGreaterThan(10);
          expect(ev.symptom.length).toBeGreaterThan(10);
          expect(ev.debrief.length).toBeGreaterThan(10);
        }
      }
    }
  });

  it('Mars dust storm cuts solar income and clean panels win it back', () => {
    const scn = getScenario('M04', 'junior');
    const swept = runScenario(scn, [['air_full', 'sweep_now']]);
    const dusty = runScenario(scn, [['air_full', 'save_power']]);
    expect(budgetFor(scn, swept.state, []).income).toBe(3);
    expect(budgetFor(scn, dusty.state, []).income).toBe(1);
    expect(swept.state.flags.storm).toBe(true);
  });

  it('Mars: the crew can recover from a bad decision with the backup cells', () => {
    const scn = getScenario('M04', 'junior');
    const run = runScenario(scn, [['air_full', 'save_power'], ['air_full']]);
    expect(run.state.resources.battery).toBe(0);
    expect(validateSelection(scn, run.state, ['air_full'])).not.toBeNull();
    const rescued = commitTurn(scn, run, ['air_full', 'backup_cells']).run;
    expect(rescued.state.outcome).toBe('success');
    expect(rescued.state.flags.backup_used).toBe(true);
  });

  it('Mars Middle has a critical air path that names the causal action', () => {
    const scn = getScenario('M04', 'middle');
    const run = runScenario(scn, [
      ['air_full', 'save_power', 'heater_on'],
      ['air_eco', 'heater_off'],
      ['air_eco', 'heater_off'],
    ]);
    expect(run.state.outcome).toBe('critical');
    expect(run.state.critical?.causeAction).toBe('air_eco');
  });
});

describe('turn engine rules', () => {
  const scn = getScenario('L02', 'advanced');

  it('rejects invalid input without changing state', () => {
    const { state } = initialState(scn);
    const before = JSON.stringify(state);
    expect(applyTurn(scn, state, ['lights_on']).ok).toBe(false); // locked air support missing
    expect(applyTurn(scn, state, ['air_full']).ok).toBe(false); // no grow-light choice
    expect(applyTurn(scn, state, ['air_full', 'lights_on', 'lights_off']).ok).toBe(false);
    expect(applyTurn(scn, state, ['air_full', 'lights_on', 'nonsense']).ok).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('rejects a plan that costs more than is available', () => {
    const run = runScenario(scn, [['air_full', 'lights_on', 'ask_earth']]);
    expect(run.state.resources.battery).toBe(0);
    expect(validateSelection(scn, run.state, ['air_full', 'shelter_basic'])).toMatch(/only 2/);
  });

  it('applies each accepted action once: a finished turn cannot be applied again', () => {
    const run = runScenario(scn, [['air_full', 'lights_off']]);
    expect(run.state.turn).toBe(1);
    expect(applyTurn(scn, run.state, ['air_full', 'lights_off']).ok).toBe(false);
    expect(run.state.history.length).toBe(1);
  });

  it('a queued Earth reply arrives after the next decision, not before', () => {
    const asked = runScenario(scn, [['air_full', 'lights_off', 'ask_earth']]);
    expect(asked.state.pending.map((m) => m.id)).toEqual(['earth_forecast']);
    expect(asked.state.inbox).toEqual([]);
    expect(asked.state.flags.earth_reply).toBeFalsy();
    const next = commitTurn(scn, asked, ['air_full', 'shelter_basic']);
    expect(next.result.ok && next.result.report.delivered.map((d) => d.id)).toEqual(['earth_forecast']);
    expect(next.run.state.flags.earth_reply).toBe(true);
    expect(next.run.state.pending).toEqual([]);
    expect(validateSelection(scn, next.run.state, ['air_smart'])).toBeNull();
  });

  it('the Earth reply option stays hidden if nobody asked', () => {
    const run = runScenario(scn, [['air_full', 'lights_off'], ['air_full', 'shelter_fans']]);
    expect(validateSelection(scn, run.state, ['air_smart'])).not.toBeNull();
  });

  it('scripted events resolve once per checkpoint', () => {
    const run = runScenario(scn, [['air_full', 'lights_off'], ['air_full', 'shelter_basic'], ['air_full']]);
    const fired = run.state.firedEvents;
    expect(new Set(fired).size).toBe(fired.length);
  });

  it('follows the turn order: cost is paid before effects and events', () => {
    const middle = getScenario('L02', 'middle');
    const { state } = initialState(middle);
    const res = applyTurn(middle, state, ['air_full', 'lights_on']);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.report.spent).toBe(5);
      expect(res.report.before.battery).toBe(0);
      expect(res.report.after.battery).toBe(1);
      expect(res.report.events.map((e) => e.id)).toEqual(['shadow_arrives', 'solar_alert']);
    }
  });
});
