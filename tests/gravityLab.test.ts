import { describe, expect, it } from 'vitest';
import { CADET_MASS, DROP_HEIGHT, HEAD_ROOM, LAB_WORLD, LAB_WORLDS, fallTime, jumpHeight, makeLab, scaleReading, stepLab, type LabEvent, type LabWorld } from '../src/sim/gravityLab';

const DT = 1 / 60;

function run(world: LabWorld, first: { jump: boolean; drop: boolean }, seconds: number): { events: LabEvent[]; maxY: number; endBall: number } {
  let s = makeLab(world);
  const events: LabEvent[] = [];
  let maxY = 0;
  for (let i = 0; i < seconds * 60; i++) {
    s = stepLab(s, i === 0 ? first : { jump: false, drop: false }, DT, world);
    maxY = Math.max(maxY, s.y);
    if (s.event) events.push(s.event);
  }
  return { events, maxY, endBall: s.ballY };
}

describe('gravity test chamber', () => {
  it('has five places, each with body notes and a source', () => {
    expect(LAB_WORLDS.map((w) => w.id)).toEqual(['moon', 'mars', 'earth', 'jupiter', 'station']);
    for (const w of LAB_WORLDS) {
      expect(w.body.length).toBe(3);
      expect(w.sourceId.length).toBeGreaterThan(0);
    }
  });

  it('keeps mass the same and changes the scale reading', () => {
    expect(scaleReading(LAB_WORLD.earth)).toBeCloseTo(CADET_MASS, 5);
    expect(scaleReading(LAB_WORLD.moon)).toBeCloseTo(CADET_MASS * 0.165, 1);
    expect(scaleReading(LAB_WORLD.mars)).toBeCloseTo(CADET_MASS * 0.379, 1);
    expect(scaleReading(LAB_WORLD.jupiter)).toBeGreaterThan(CADET_MASS * 2.3);
    expect(scaleReading(LAB_WORLD.station)).toBe(0);
  });

  it('jumps higher where gravity is weaker, with the same push', () => {
    const h = (id: 'moon' | 'mars' | 'earth' | 'jupiter') => jumpHeight(LAB_WORLD[id]) as number;
    expect(h('moon')).toBeGreaterThan(h('mars'));
    expect(h('mars')).toBeGreaterThan(h('earth'));
    expect(h('earth')).toBeGreaterThan(h('jupiter'));
    expect(h('moon') / h('earth')).toBeCloseTo(9.8 / 1.62, 3);
    expect(h('moon')).toBeLessThan(HEAD_ROOM);
    expect(jumpHeight(LAB_WORLD.station)).toBeNull();
  });

  it.each(['moon', 'mars', 'earth', 'jupiter'] as const)('measures a jump on %s close to the formula', (id) => {
    const w = LAB_WORLD[id];
    const { events } = run(w, { jump: true, drop: false }, 6);
    const jump = events.find((e) => e.kind === 'jump');
    expect(jump).toBeDefined();
    if (jump?.kind !== 'jump') return;
    const ideal = jumpHeight(w) as number;
    expect(Math.abs((jump.height as number) - ideal)).toBeLessThan(0.05);
  });

  it.each(['moon', 'mars', 'earth', 'jupiter'] as const)('times the ball drop on %s close to the formula', (id) => {
    const w = LAB_WORLD[id];
    const { events, endBall } = run(w, { jump: false, drop: true }, 4);
    const drop = events.find((e) => e.kind === 'drop');
    expect(drop).toBeDefined();
    if (drop?.kind !== 'drop') return;
    expect(Math.abs((drop.time as number) - (fallTime(w) as number))).toBeLessThan(0.04);
    expect(endBall).toBe(0);
  });

  it('floats on the station: a push drifts, and the ball does not fall', () => {
    const w = LAB_WORLD.station;
    const pushed = run(w, { jump: true, drop: false }, 5);
    expect(pushed.maxY).toBeGreaterThan(1.5);
    expect(pushed.events).toContainEqual({ kind: 'jump', height: null, air: expect.any(Number) });
    const dropped = run(w, { jump: false, drop: true }, 5);
    expect(dropped.events).toContainEqual({ kind: 'drop', time: null });
    expect(dropped.endBall).toBe(DROP_HEIGHT);
    expect(fallTime(w)).toBeNull();
  });

  it('cannot jump again in mid-air', () => {
    const w = LAB_WORLD.moon;
    let s = makeLab(w);
    s = stepLab(s, { jump: true, drop: false }, DT, w);
    const vy = s.vy;
    s = stepLab(s, { jump: true, drop: false }, DT, w);
    expect(s.vy).toBeLessThan(vy);
  });
});
