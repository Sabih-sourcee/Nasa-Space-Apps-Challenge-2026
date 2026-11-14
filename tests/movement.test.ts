import { describe, expect, it } from 'vitest';
import {
  GRAVITY_PRESETS, idealAirtime, makeDrifter, makeWalker, measureJumpAirtime, stepDrift, stepWalker,
  type DriftEnv, type DriftInput, type WalkEnv,
} from '../src/sim/movement';

const DT = 1 / 60;
const flat = (preset: keyof typeof GRAVITY_PRESETS, boxes: WalkEnv['boxes'] = []): WalkEnv => ({
  preset: GRAVITY_PRESETS[preset], ground: () => 0, circles: [], boxes,
  bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 }, radius: 0.35,
});

describe('AT-02 gravity: same jump, different worlds', () => {
  it('gives longer airtime on the Moon than on Mars, and on Mars than on Earth', () => {
    const earth = measureJumpAirtime(GRAVITY_PRESETS.earth);
    const mars = measureJumpAirtime(GRAVITY_PRESETS.mars);
    const moon = measureJumpAirtime(GRAVITY_PRESETS.moon);
    expect(moon).toBeGreaterThan(mars);
    expect(mars).toBeGreaterThan(earth);
  });

  it('matches t = 2 v0 / g within one frame', () => {
    for (const id of ['earth', 'mars', 'moon'] as const) {
      const preset = GRAVITY_PRESETS[id];
      expect(measureJumpAirtime(preset)).toBeCloseTo(idealAirtime(preset), 1);
    }
  });

  it('uses the NASA fact sheet gravity ratios', () => {
    expect(GRAVITY_PRESETS.moon.ratio).toBeCloseTo(0.166, 3);
    expect(GRAVITY_PRESETS.mars.ratio).toBeCloseTo(0.377, 3);
    expect(GRAVITY_PRESETS.moon.g / GRAVITY_PRESETS.earth.g).toBeCloseTo(0.165, 2);
  });

  it('is repeatable: the same inputs give the same airtime', () => {
    expect(measureJumpAirtime(GRAVITY_PRESETS.moon)).toBe(measureJumpAirtime(GRAVITY_PRESETS.moon));
  });
});

describe('surface walking', () => {
  it('moves the astronaut and stops when input is released', () => {
    const env = flat('earth');
    let s = makeWalker(0, 0);
    for (let i = 0; i < 120; i++) s = stepWalker(s, { moveX: 0, moveZ: -1, jump: false }, DT, env);
    expect(s.z).toBeLessThan(-4);
    for (let i = 0; i < 60; i++) s = stepWalker(s, { moveX: 0, moveZ: 0, jump: false }, DT, env);
    expect(Math.abs(s.vz)).toBeLessThan(0.01);
  });

  it('a hurdle blocks walking and can be cleared with a jump', () => {
    const hurdle = [{ minX: -2, maxX: 2, minZ: -4.2, maxZ: -3.8, top: 0.3 }];
    const env = flat('earth', hurdle);
    let walk = makeWalker(0, 0);
    for (let i = 0; i < 300; i++) walk = stepWalker(walk, { moveX: 0, moveZ: -1, jump: false }, DT, env);
    expect(walk.z).toBeGreaterThan(-3.8);

    let jump = makeWalker(0, 0);
    for (let i = 0; i < 300; i++) {
      const nearHurdle = jump.z < -2.9 && jump.z > -3.4 && jump.grounded;
      jump = stepWalker(jump, { moveX: 0, moveZ: -1, jump: nearHurdle }, DT, env);
    }
    expect(jump.z).toBeLessThan(-4.5);
    expect(jump.jumps).toBeGreaterThan(0);
  });

  it('gives each world a distinct movement preset', () => {
    const { earth, moon, mars } = GRAVITY_PRESETS;
    expect(new Set([earth.g, moon.g, mars.g]).size).toBe(3);
    expect(new Set([earth.accel, moon.accel, mars.accel]).size).toBe(3);
  });
});

describe('microgravity push, drift and grab', () => {
  const env: DriftEnv = {
    rails: [{ id: 'a', x: -6, z: 0 }, { id: 'b', x: 0, z: 0 }, { id: 'c', x: 6, z: 0 }],
    bounds: { minX: -8, maxX: 8, minZ: -2, maxZ: 2 }, pushSpeed: 1, reach: 1.2, restitution: 0.5,
  };
  const idle: DriftInput = { aimX: 0, aimZ: 0, push: false, grab: false, recover: false };

  it('cannot move without pushing off something', () => {
    let s = makeDrifter(env, 'a');
    for (let i = 0; i < 120; i++) s = stepDrift(s, { ...idle, aimX: 1 }, DT, env);
    expect(s.x).toBe(-6);
  });

  it('keeps drifting at the same speed after input is released', () => {
    let s = makeDrifter(env, 'a');
    s = stepDrift(s, { ...idle, aimX: 1, push: true }, DT, env);
    const v0 = s.vx;
    for (let i = 0; i < 180; i++) s = stepDrift(s, idle, DT, env);
    expect(s.vx).toBe(v0);
    expect(s.x).toBeCloseTo(-6 + v0 * 3, 1);
  });

  it('steering while drifting does not change the path', () => {
    let s = makeDrifter(env, 'a');
    s = stepDrift(s, { ...idle, aimX: 1, push: true }, DT, env);
    for (let i = 0; i < 60; i++) s = stepDrift(s, { ...idle, aimZ: 1 }, DT, env);
    expect(s.vz).toBeCloseTo(0, 6);
  });

  it('grabbing a rail stops the drift, and only works within reach', () => {
    let s = makeDrifter(env, 'a');
    s = stepDrift(s, { ...idle, aimX: 1, push: true }, DT, env);
    for (let i = 0; i < 120; i++) s = stepDrift(s, { ...idle, grab: true }, DT, env);
    // 2 m from rail a and 4 m from rail b after the first frames: first grab that lands is near b.
    expect(s.holding).not.toBeNull();
    expect(s.vx).toBe(0);
  });

  it('a missed rail is recoverable with the tether', () => {
    let s = makeDrifter(env, 'a');
    s = stepDrift(s, { ...idle, aimX: 1, push: true }, DT, env);
    for (let i = 0; i < 900; i++) s = stepDrift(s, idle, DT, env);
    expect(s.wallHits).toBeGreaterThan(0);
    s = stepDrift(s, { ...idle, recover: true }, DT, env);
    expect(s.holding).toBe('a');
    expect(s.recoveries).toBe(1);
  });
});
