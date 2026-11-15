import { describe, expect, it } from 'vitest';
import {
  BATTERY_TUNING, alertActive, choiceStart, compareBattery, doBattery, makeBattery, runBattery, type BatteryAction,
} from '../src/sim/lastBattery';
import { DEMO_MISSIONS, missionAfter, missionStatus } from '../src/sim/missions';
import { defaultSave, parseSave, serializeSave } from '../src/sim/save';
import { rateBattery, rateShip } from '../src/sim/score';
import { airflow, airStable, dockingHelp, doShipTask, makeShip, nextShipTask, powered, readyToDock, runShip, SHIP_TUNING, type ShipTask } from '../src/sim/ship';
import { briefingFor } from '../src/sim/story';
import { PLAYABLE, TIERS } from '../src/sim/types';

const NAV_FIRST: ShipTask[] = ['inspect', 'take', 'attach_nav', 'check_air', 'backup', 'grab', 'rack', 'latch'];
const VENT_FIRST: ShipTask[] = ['inspect', 'take', 'attach_vent', 'check_air', 'grab', 'rack', 'latch'];

describe('F03 Keep the Ship Flying', () => {
  it('starts with both branches dark and nothing ready', () => {
    const s = makeShip();
    expect(powered(s, 'nav') || powered(s, 'vent')).toBe(false);
    expect(airflow(s)).toBe('low');
    expect(readyToDock(s)).toBe(false);
  });

  it.each(TIERS)('%s: navigation first docks with the guidance display and spends air reserve', (tier) => {
    const s = runShip(NAV_FIRST, tier);
    expect(readyToDock(s)).toBe(true);
    expect(dockingHelp(s)).toBe('display');
    expect(airflow(s)).toBe('backup');
    expect(s.reserve).toBe(100 - SHIP_TUNING[tier].backupCost);
    expect(s.battery).toBe('latched');
  });

  it.each(['middle', 'advanced'] as const)('%s: ventilation first keeps the reserve and gets a guided approach', (tier) => {
    const s = runShip(VENT_FIRST, tier);
    expect(readyToDock(s)).toBe(true);
    expect(dockingHelp(s)).toBe('guided');
    expect(airflow(s)).toBe('stable');
    expect(s.reserve).toBe(100);
    // The backup loop is refused when the main fan already has power.
    expect(doShipTask(s, 'backup', tier).ok).toBe(false);
  });

  it('junior is told to use the navigation socket', () => {
    const held = runShip(['inspect', 'take'], 'junior');
    const r = doShipTask(held, 'attach_vent', 'junior');
    expect(r.ok).toBe(false);
    expect(r.state).toBe(held);
  });

  it('there is only one spare connector, and it cannot be fitted twice', () => {
    const s = runShip(['inspect', 'take', 'attach_nav'], 'middle');
    expect(doShipTask(s, 'take', 'middle').ok).toBe(false);
    expect(doShipTask(s, 'attach_vent', 'middle').ok).toBe(false);
    expect(powered(s, 'vent')).toBe(false);
  });

  it('tasks out of order are refused and explained', () => {
    const s = makeShip();
    for (const t of ['take', 'attach_nav', 'backup', 'rack', 'latch'] as ShipTask[]) {
      const r = doShipTask(s, t, 'middle');
      expect(r.ok).toBe(false);
      expect(r.say.length).toBeGreaterThan(10);
    }
  });

  it('hands hold one thing at a time', () => {
    const s = runShip(['inspect', 'take'], 'middle');
    expect(doShipTask(s, 'grab', 'middle').ok).toBe(false);
    const b = runShip(['inspect', 'grab'], 'middle');
    expect(doShipTask(b, 'take', 'middle').ok).toBe(false);
  });

  it('docking does not need the cargo: an unlatched battery is recorded, not blocked', () => {
    const s = runShip(['inspect', 'take', 'attach_nav', 'check_air', 'backup'], 'middle');
    expect(readyToDock(s)).toBe(true);
    expect(s.battery).toBe('loose');
    expect(airStable(s)).toBe(true);
  });

  it.each(TIERS)('%s: following the suggested next task always reaches the cockpit', (tier) => {
    let s = makeShip();
    for (let i = 0; i < 20; i++) {
      const next = nextShipTask(s, tier);
      if (next === 'cockpit') break;
      const r = doShipTask(s, next, tier);
      expect(r.ok).toBe(true);
      s = r.state;
    }
    expect(nextShipTask(s, tier)).toBe('cockpit');
    expect(readyToDock(s)).toBe(true);
    expect(s.battery).toBe('latched');
  });

  it('the same tasks always give the same ship', () => {
    expect(runShip(NAV_FIRST, 'advanced')).toEqual(runShip(NAV_FIRST, 'advanced'));
  });
});

const SHELTER_FIRST: BatteryAction[] = ['plug_shelter', 'move_crew', 'ride_out'];
const GROW_FIRST: BatteryAction[] = ['plug_grow', 'cycle', 'take', 'plug_shelter', 'move_crew', 'ride_out'];

describe('L03 The Last Battery', () => {
  it('a latched battery waits at the near rack, an unlatched one is in the crate and costs time', () => {
    expect(makeBattery('middle', true).battery).toBe('rack');
    expect(makeBattery('middle', false).battery).toBe('crate');
    expect(choiceStart('middle', true).clock).toBe(0);
    expect(choiceStart('middle', false).clock).toBe(BATTERY_TUNING.middle.recoverTime);
    expect(choiceStart('middle', false).battery).toBe('held');
    expect(choiceStart('middle', false).charge).toBe(choiceStart('middle', true).charge);
  });

  it.each(TIERS.flatMap((t) => [[t, true], [t, false]] as const))('%s, battery latched %s: shelter first succeeds with a delayed harvest', (tier, secured) => {
    const r = runBattery(tier, secured, SHELTER_FIRST);
    expect(r.state.outcome).toBe('success');
    expect(r.state.vent).toBe('full');
    expect(r.state.cycles).toBe(0);
    expect(r.state.readiness).toBe(100);
    expect(r.state.charge).toBe(BATTERY_TUNING[tier].startCharge - BATTERY_TUNING[tier].ventCost);
  });

  it.each(TIERS.flatMap((t) => [[t, true], [t, false]] as const))('%s, battery latched %s: grow rack first succeeds with the harvest on time', (tier, secured) => {
    const r = runBattery(tier, secured, GROW_FIRST);
    expect(r.state.outcome).toBe('success');
    expect(r.state.cycles).toBe(1);
    expect(r.state.vent).toBe('full');
    // A latched battery leaves time to spare. A late start means the crew waits outside after the alert.
    expect(r.state.readiness).toBe(secured ? 100 : 100 - BATTERY_TUNING[tier].exposure);
  });

  it('the alert arrives by the clock, and the clock only moves on actions', () => {
    let s = choiceStart('middle', true);
    expect(alertActive(s, 'middle')).toBe(false);
    s = doBattery(s, 'plug_grow', 'middle').state;
    s = doBattery(s, 'cycle', 'middle').state;
    expect(s.clock).toBe(3);
    expect(alertActive(s, 'middle')).toBe(false);
    s = doBattery(s, 'take', 'middle').state;
    expect(s.clock).toBe(3);
    s = doBattery(s, 'plug_shelter', 'middle').state;
    expect(alertActive(s, 'middle')).toBe(true);
  });

  it('a late transfer leaves too little for full fans, and low-flow mode recovers it', () => {
    const late: BatteryAction[] = ['plug_grow', 'cycle', 'cycle', 'take', 'plug_shelter'];
    const r = runBattery('middle', true, late);
    expect(r.state.charge).toBe(2);
    expect(r.state.vent).toBe('off');
    expect(doBattery(r.state, 'move_crew', 'middle').ok).toBe(true);
    // Riding out is refused until there is some ventilation.
    const inShelter = doBattery(r.state, 'move_crew', 'middle').state;
    expect(doBattery(inShelter, 'ride_out', 'middle').ok).toBe(false);
    const done = runBattery('middle', true, [...late, 'low_flow', 'move_crew', 'ride_out']);
    expect(done.state.outcome).toBe('success');
    expect(done.state.vent).toBe('low');
    expect(done.state.readiness).toBeLessThan(100);
    expect(rateBattery(done.state.readiness, 0).stars).toBe(2);
  });

  it('a battery too flat even for low flow stops the shift with the reason', () => {
    const r = runBattery('advanced', true, ['plug_grow', 'cycle', 'cycle', 'take', 'plug_shelter', 'low_flow']);
    expect(r.state.charge).toBe(1);
    expect(r.state.outcome).toBe('critical');
    expect(r.state.reason).toMatch(/low-flow/);
  });

  it('leaving the crew outside long after the alert stops the shift', () => {
    let s = choiceStart('middle', true);
    for (const a of ['plug_grow', 'cycle', 'take', 'plug_shelter', 'take', 'plug_grow', 'take', 'plug_shelter', 'take', 'plug_grow', 'take', 'plug_shelter'] as BatteryAction[]) s = doBattery(s, a, 'middle').state;
    expect(s.outcome).toBe('critical');
    expect(s.reason).toMatch(/outside the shelter/);
    expect(doBattery(s, 'move_crew', 'middle').ok).toBe(false);
  });

  it('refused actions change nothing', () => {
    const s = choiceStart('middle', true);
    for (const a of ['cycle', 'low_flow', 'ride_out', 'recover'] as BatteryAction[]) {
      const r = doBattery(s, a, 'middle');
      expect(r.ok).toBe(false);
      expect(r.state).toBe(s);
    }
  });

  it('Mission Replay: the same actions from the same checkpoint give the same result', () => {
    const a = runBattery('middle', true, GROW_FIRST);
    const b = runBattery('middle', true, GROW_FIRST);
    expect(b.state).toEqual(a.state);
    expect(b.start).toEqual(a.start);
    const cmp = compareBattery(a, b);
    expect(cmp.same).toBe(true);
    expect(cmp.rows.every((r) => r.first === r.replay)).toBe(true);
  });

  it('Mission Replay: changing the first socket changes crops and charge', () => {
    const first = runBattery('middle', true, SHELTER_FIRST);
    const replay = runBattery('middle', true, GROW_FIRST);
    expect(replay.start).toEqual(first.start);
    const cmp = compareBattery(first, replay);
    expect(cmp.same).toBe(false);
    const row = (label: string) => cmp.rows.find((r) => r.label === label)!;
    expect(row('First socket').first).toBe('Shelter first');
    expect(row('First socket').replay).toBe('Grow rack first');
    expect(row('Crop stage').delta).toBe(1);
    expect(row('Harvest').first).toBe('delayed');
    expect(row('Harvest').replay).toBe('on time');
    expect(row('Charge left').delta).toBe(-BATTERY_TUNING.middle.cycleCost);
    expect(cmp.why).toMatch(/grow rack first/i);
  });

  it.each(TIERS)('%s: both main routes can earn three stars with a latched battery', (tier) => {
    expect(rateBattery(runBattery(tier, true, SHELTER_FIRST).state.readiness, 0).stars).toBe(3);
    expect(rateBattery(runBattery(tier, true, GROW_FIRST).state.readiness, 0).stars).toBe(3);
  });
});

describe('story continuity', () => {
  it('ship stars reward the latched battery and a first-approach dock', () => {
    expect(rateShip(true, 1).stars).toBe(3);
    expect(rateShip(false, 1).stars).toBe(2);
    expect(rateShip(true, 2).stars).toBe(2);
    expect(rateShip(false, 3).stars).toBe(1);
    expect(rateShip(false, 1).tip).toMatch(/latch/);
  });

  it('the cargo flag survives a save and load', () => {
    const save = defaultSave('guest-abc');
    save.completed.F03 = { tier: 'middle', completions: 1, summary: 'ok', stars: 2, flags: { batterySecured: false, navFirst: true } };
    const { save: loaded, notes } = parseSave(serializeSave(save), () => 'x');
    expect(notes).toEqual([]);
    expect(loaded).toEqual(save);
    const raw = JSON.parse(serializeSave(save));
    raw.completed.F03.flags = { batterySecured: 'yes', navFirst: true };
    expect(parseSave(JSON.stringify(raw), () => 'x').save.completed.F03?.flags).toEqual({ navFirst: true });
  });

  it('the new missions sit off the main route and never block it', () => {
    expect(DEMO_MISSIONS.F03.requires).toBe('F01');
    expect(DEMO_MISSIONS.L03.requires).toBe('F03');
    expect(missionStatus('S01', { E02: true, F01: true }, false)).toBe('available');
    expect(missionStatus('L03', { E02: true, F01: true }, false)).toBe('locked');
    expect(missionStatus('L03', { F03: true }, false)).toBe('available');
    expect(missionStatus('L03', {}, true)).toBe('available');
    expect(missionAfter('F03')).toBe('S01');
    expect(missionAfter('L03')).toBe('M04');
  });

  it('every playable mission has a three-panel briefing for every tier', () => {
    for (const id of PLAYABLE) {
      const lines = new Set<string>();
      for (const tier of TIERS) {
        const b = briefingFor(id, tier);
        expect(b.panels.map((p) => p.kind)).toEqual(['place', 'change', 'assignment']);
        for (const p of b.panels) expect(p.caption.length).toBeGreaterThan(30);
        expect(b.firstAction.length).toBeGreaterThan(8);
        lines.add(b.panels[2].caption);
      }
      // Reyes speaks differently to each tier.
      expect(lines.size).toBe(3);
    }
  });

  it('the lunar briefing reports what happened to the battery aboard the ship', () => {
    const yes = briefingFor('L03', 'middle', { batterySecured: true });
    const no = briefingFor('L03', 'middle', { batterySecured: false });
    expect(yes.panels[1].caption).toMatch(/near rack/);
    expect(no.panels[1].caption).toMatch(/cargo crate/);
    expect(yes.firstAction).not.toBe(no.firstAction);
  });
});
