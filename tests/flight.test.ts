import { describe, expect, it } from 'vitest';
import {
  ASCENT_TUNING, CABIN_PRESSURE, CAPTURE_SECONDS, DOCK_STANDOFF, DOCK_TUNING, HARD_DOCK_SECONDS, NO_INPUT, dockActive, dockStage, ascentAutopilot, ascentDeviation, dockAutopilot, landerAutopilot, landerConfig,
  makeAscent, makeDock, makeLander, retryDock, stepAscent, stepDock, stepLander,
  type AscentState, type DockState, type FlightInput, type LanderState, makeAscentAloft, HANDOVER_ALTITUDE, ORBIT_SPEED, ASCENT_GATES,
} from '../src/sim/flight';
import { TIERS, type Tier } from '../src/sim/types';

const DT = 1 / 60;

function flyAscent(tier: Tier, pilot: (s: AscentState) => FlightInput, seconds = 200): AscentState {
  let s = makeAscent(tier);
  for (let i = 0; i < seconds * 60 && s.status === 'flying'; i++) s = stepAscent(s, pilot(s), DT, tier);
  return s;
}

describe('shuttle ascent', () => {
  it.each(TIERS)('%s: a steered flight reaches a stable orbit', (tier) => {
    const s = flyAscent(tier, (st) => ascentAutopilot(st, tier));
    expect(s.status).toBe('orbit');
    expect(s.speed).toBeGreaterThanOrEqual(ASCENT_TUNING[tier].band[0]);
    expect(s.speed).toBeLessThanOrEqual(ASCENT_TUNING[tier].band[1]);
    expect(s.gatesMissed).toBeLessThanOrEqual(ASCENT_TUNING[tier].missesAllowed);
    expect(s.deviationFired).toBe(true);
  });

  it('player inputs change course and thrust', () => {
    let s = makeAscent('middle');
    for (let i = 0; i < 60; i++) s = stepAscent(s, { ...NO_INPUT, thrust: true }, DT, 'middle');
    expect(s.throttle).toBeGreaterThan(0.5);
    expect(s.speed).toBeGreaterThan(0);
    const before = s.dx;
    for (let i = 0; i < 60; i++) s = stepAscent(s, { ...NO_INPUT, steerX: -1 }, DT, 'middle');
    expect(s.dx).toBeLessThan(before);
    const throttle = s.throttle;
    for (let i = 0; i < 30; i++) s = stepAscent(s, { ...NO_INPUT, brake: true }, DT, 'middle');
    expect(s.throttle).toBeLessThan(throttle);
  });

  it('AT-04 flight error: ignoring the guidance deviation forces a training reset', () => {
    const s = flyAscent('advanced', () => ({ ...NO_INPUT, thrust: true }));
    expect(s.deviationFired).toBe(true);
    expect(s.status).toBe('reset');
    expect(['gates', 'corridor']).toContain(s.resetReason);
  });

  it('the guidance deviation pushes the craft outside the gate tolerance', () => {
    let s = makeAscent('middle');
    let worst = 0;
    for (let i = 0; i < 60 * 40 && s.status === 'flying'; i++) {
      s = stepAscent(s, { ...NO_INPUT, thrust: true }, DT, 'middle');
      if (s.deviationFired) worst = Math.max(worst, ascentDeviation(s));
    }
    expect(worst).toBeGreaterThan(ASCENT_TUNING.middle.gateTol);
  });

  it('leaving the engines on overshoots and never stabilises', () => {
    const tier: Tier = 'junior';
    const s = flyAscent(tier, (st) => ({ ...ascentAutopilot(st, tier), thrust: true, brake: false }), 120);
    expect(s.status).not.toBe('orbit');
  });

  it.each(TIERS)('%s: taking over after booster separation still reaches orbit, with every gate ahead', (tier) => {
    const start = makeAscentAloft(tier);
    expect(start.altitude).toBeCloseTo(HANDOVER_ALTITUDE, 5);
    expect(start.speed / ORBIT_SPEED).toBeLessThan(ASCENT_GATES[0]);
    expect(start).toMatchObject({ nextGate: 0, gatesHit: 0, gatesMissed: 0, status: 'flying' });
    let s = start;
    for (let i = 0; i < 60 * 400 && s.status === 'flying'; i++) s = stepAscent(s, ascentAutopilot(s, tier), DT, tier);
    expect(s.status).toBe('orbit');
    expect(s.gatesHit).toBe(ASCENT_GATES.length);
  });

  it('is deterministic', () => {
    const a = flyAscent('middle', (st) => ascentAutopilot(st, 'middle'));
    const b = flyAscent('middle', (st) => ascentAutopilot(st, 'middle'));
    expect(a).toEqual(b);
  });
});

function flyDock(tier: Tier, pilot: (s: DockState) => FlightInput, start = makeDock()): DockState {
  let s = start;
  for (let i = 0; i < 60 * 400 && dockActive(s); i++) s = stepDock(s, pilot(s), DT, tier);
  return s;
}

describe('station docking', () => {
  it.each(TIERS)('%s: a slow, aligned approach docks', (tier) => {
    const s = flyDock(tier, (st) => dockAutopilot(st, tier));
    expect(s.status).toBe('docked');
  });

  it('a fast approach is aborted, and the retry can still dock', () => {
    const fast = flyDock('middle', (st) => ({ ...dockAutopilot(st, 'middle'), thrust: true, brake: false }));
    expect(fast.status).toBe('aborted');
    expect(fast.abortReason).toBe('speed');
    const again = retryDock(fast);
    expect(again.status).toBe('approach');
    expect(again.attempts).toBe(2);
    const s = flyDock('middle', (st) => dockAutopilot(st, 'middle'), again);
    expect(s.status).toBe('docked');
  });

  it('a crooked approach is aborted for alignment', () => {
    const s = flyDock('advanced', (st) => ({ ...NO_INPUT, thrust: st.closing < 0.3 }));
    expect(s.status).toBe('aborted');
    expect(s.abortReason).toBe('alignment');
  });

  it('goes through soft capture, hard dock and the checks, in that order, before the hatch opens', () => {
    let s = makeDock();
    const seen: string[] = [];
    for (let i = 0; i < 60 * 400 && dockActive(s); i++) {
      s = stepDock(s, dockAutopilot(s, 'middle'), DT, 'middle');
      if (seen[seen.length - 1] !== dockStage(s)) seen.push(dockStage(s));
    }
    expect(seen).toEqual(['approach', 'alignment', 'final', 'capture', 'hardDock', 'checks', 'docked']);
    expect(s.standoff).toBe(0);
    expect(s.x).toBe(0);
    expect(s.y).toBe(0);
    expect(s.pressure).toBeCloseTo(CABIN_PRESSURE, 5);
    expect(s.leakCheck).toBe('passed');
    expect(s.contactSpeed).toBeLessThanOrEqual(DOCK_TUNING.middle.maxClosing);
    expect(s.contactOff).toBeLessThanOrEqual(DOCK_TUNING.middle.alignTol);
  });

  it('never captures a fast or crooked arrival', () => {
    const fast = flyDock('junior', (st) => ({ ...dockAutopilot(st, 'junior'), thrust: true, brake: false }));
    expect(fast.status).toBe('aborted');
    expect(fast.contactSpeed).toBe(0);
    expect(fast.standoff).toBe(DOCK_STANDOFF);
    const crooked = flyDock('junior', (st) => ({ ...NO_INPUT, thrust: st.closing < 0.3 }));
    expect(crooked.status).toBe('aborted');
  });

  it('takes its time: capture and hard dock cannot be rushed by flying', () => {
    let s = makeDock();
    while (s.status === 'approach') s = stepDock(s, dockAutopilot(s, 'middle'), DT, 'middle');
    expect(s.status).toBe('capture');
    const hands = { ...NO_INPUT, thrust: true, steerX: 1 };
    let steps = 0;
    while (s.status === 'capture' || s.status === 'hardDock') { s = stepDock(s, hands, DT, 'middle'); steps++; }
    expect(steps * DT).toBeCloseTo(CAPTURE_SECONDS + HARD_DOCK_SECONDS, 0);
    expect(s.status).toBe('checks');
    expect(s.closing).toBe(0);
  });

  it('skipping the capture film leaves exactly the state that watching it does', () => {
    let contact = makeDock();
    while (contact.status === 'approach') contact = stepDock(contact, dockAutopilot(contact, 'middle'), DT, 'middle');
    let watched = contact;
    while (watched.status !== 'checks') watched = stepDock(watched, NO_INPUT, DT, 'middle');
    const skipped = stepDock(contact, { ...NO_INPUT, action: true }, DT, 'middle');
    // Skipping halfway through the hard dock ends in the same place too.
    let half = contact;
    for (let i = 0; i < 60 * 4; i++) half = stepDock(half, NO_INPUT, DT, 'middle');
    expect(half.status).toBe('hardDock');
    const skippedLate = stepDock(half, { ...NO_INPUT, action: true }, DT, 'middle');
    for (const st of [skipped, skippedLate]) expect({ ...st, t: 0 }).toEqual({ ...watched, t: 0 });
  });

  it('keeps the hatch shut until the tunnel is at cabin pressure', () => {
    let s = makeDock();
    while (s.status !== 'checks') s = stepDock(s, dockAutopilot(s, 'middle'), DT, 'middle');
    // Waiting does nothing: the check has to be started.
    for (let i = 0; i < 300; i++) s = stepDock(s, NO_INPUT, DT, 'middle');
    expect(s.leakCheck).toBe('waiting');
    expect(s.pressure).toBe(0);
    s = stepDock(s, { ...NO_INPUT, action: true }, DT, 'middle');
    expect(s.leakCheck).toBe('running');
    // Asking for the hatch while the pressure is still rising is refused.
    for (let i = 0; i < 60; i++) s = stepDock(s, { ...NO_INPUT, action: true }, DT, 'middle');
    expect(s.status).toBe('checks');
    expect(s.pressure).toBeLessThan(CABIN_PRESSURE);
    for (let i = 0; i < 60 * 4; i++) s = stepDock(s, NO_INPUT, DT, 'middle');
    expect(s.leakCheck).toBe('passed');
    expect(s.status).toBe('checks');
    s = stepDock(s, { ...NO_INPUT, action: true }, DT, 'middle');
    expect(s.status).toBe('docked');
  });

  it('a retry starts clean, with the capture ring out again', () => {
    const fast = flyDock('middle', (st) => ({ ...dockAutopilot(st, 'middle'), thrust: true, brake: false }));
    const again = retryDock(fast);
    expect(again).toMatchObject({ status: 'approach', standoff: DOCK_STANDOFF, pressure: 0, leakCheck: 'waiting', stageT: 0, vx: 0, vy: 0 });
  });

  it('advanced docking keeps drifting after a thruster pulse; junior damps it', () => {
    const pulse = (tier: Tier) => {
      let s = makeDock();
      for (let i = 0; i < 30; i++) s = stepDock(s, { ...NO_INPUT, steerX: -1 }, DT, tier);
      for (let i = 0; i < 120; i++) s = stepDock(s, NO_INPUT, DT, tier);
      return Math.abs(s.vx);
    };
    expect(pulse('advanced')).toBeGreaterThan(0.15);
    expect(pulse('junior')).toBeLessThan(0.05);
    expect(DOCK_TUNING.advanced.damping).toBe(0);
  });
});

function flyLander(world: 'moon' | 'mars', tier: Tier, pilot: (s: LanderState) => FlightInput): LanderState {
  const cfg = landerConfig(world, tier);
  let s = makeLander(cfg);
  for (let i = 0; i < 60 * 400 && s.status === 'descending'; i++) s = stepLander(s, pilot(s), DT, cfg);
  return s;
}

describe('landers', () => {
  it.each(TIERS)('moon %s: a controlled descent lands in the zone', (tier) => {
    const cfg = landerConfig('moon', tier);
    const s = flyLander('moon', tier, (st) => landerAutopilot(st, cfg));
    expect(s.status).toBe('landed');
    expect(s.touchdownVy).toBeLessThanOrEqual(cfg.safeVy);
  });

  it.each(TIERS)('mars %s: parachute, release and engine land in the zone', (tier) => {
    const cfg = landerConfig('mars', tier);
    const s = flyLander('mars', tier, (st) => landerAutopilot(st, cfg));
    expect(s.status).toBe('landed');
    expect(s.chute).toBe('released');
  });

  it('safe landing depends on player input: no engine means an abort', () => {
    expect(flyLander('moon', 'junior', () => NO_INPUT).abortReason).toBe('too_fast');
    expect(flyLander('mars', 'junior', () => NO_INPUT).status).toBe('aborted');
  });

  it('mars: the parachute alone is not enough in thin air', () => {
    const s = flyLander('mars', 'middle', (st) => ({ ...NO_INPUT, action: st.chute === 'stowed' }));
    expect(s.chute).toBe('deployed');
    expect(s.abortReason).toBe('chute_on_touchdown');
  });

  it('mars: the alternate zone is a safe touchdown too', () => {
    const cfg = landerConfig('mars', 'middle');
    const s = flyLander('mars', 'middle', (st) => landerAutopilot(st, cfg, 'alt'));
    expect(s.status).toBe('landed');
    expect(s.zoneId).toBe('alt');
  });

  it('landing outside the zone is aborted', () => {
    const cfg = landerConfig('moon', 'advanced');
    const s = flyLander('moon', 'advanced', (st) => ({ ...landerAutopilot(st, cfg), steerX: 0, steerY: 0 }));
    expect(s.status).toBe('aborted');
  });

  it('the two landings are different problems', () => {
    const moon = landerConfig('moon', 'middle');
    const mars = landerConfig('mars', 'middle');
    expect(moon.atmosphere).toBe(false);
    expect(mars.atmosphere).toBe(true);
    expect(mars.gravity).toBeGreaterThan(moon.gravity);
    expect(mars.zones.length).toBeGreaterThan(moon.zones.length);
  });
});
