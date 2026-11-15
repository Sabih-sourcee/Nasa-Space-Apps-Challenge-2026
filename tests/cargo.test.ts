import { describe, expect, it } from 'vitest';
import { RESTRAINTS, SUPPLIES, allLoaded, cargoChecklist, load, makeCargo, nextSupply, pickUp, secureLabel, secureStep, secured } from '../src/sim/cargo';
import { DEMO_MISSIONS } from '../src/sim/missions';

function loadAll() {
  let s = makeCargo();
  for (let i = 0; i < SUPPLIES.length; i++) { s = pickUp(s).state; s = load(s).state; }
  return s;
}

describe('earth training: the supply run', () => {
  it('loads food, tools and the battery in order, one at a time', () => {
    let s = makeCargo();
    const order: string[] = [];
    while (nextSupply(s)) {
      const got = pickUp(s);
      expect(got.ok).toBe(true);
      order.push(got.state.carrying as string);
      // Hands are full: a second pick-up is refused and changes nothing.
      expect(pickUp(got.state)).toMatchObject({ ok: false, state: got.state });
      const put = load(got.state);
      expect(put.ok).toBe(true);
      expect(put.state.carrying).toBeNull();
      s = put.state;
    }
    expect(order).toEqual(['food', 'tools', 'battery']);
    expect(allLoaded(s)).toBe(true);
    expect(pickUp(s).ok).toBe(false);
  });

  it('refuses to load with empty hands', () => {
    const r = load(makeCargo());
    expect(r.ok).toBe(false);
    expect(r.state.loaded).toEqual([]);
  });

  it('will not close a rack that is not full', () => {
    let s = makeCargo();
    expect(secureStep(s).ok).toBe(false);
    s = load(pickUp(s).state).state;
    expect(secureStep(s).ok).toBe(false);
    expect(secureStep(pickUp(s).state).ok).toBe(false);
    expect(secured(s)).toBe(false);
  });

  it('secures in steps: the door, then each restraint, and then it is done', () => {
    let s = loadAll();
    expect(secureLabel(s)).toBe('Close the rack door');
    s = secureStep(s).state;
    expect(s).toMatchObject({ door: true, restraints: 0 });
    expect(secured(s)).toBe(false);
    for (let n = 1; n <= RESTRAINTS; n++) {
      expect(secureLabel(s)).toBe(`Fasten restraint ${n} of ${RESTRAINTS}`);
      s = secureStep(s).state;
      expect(s.restraints).toBe(n);
    }
    expect(secured(s)).toBe(true);
    expect(secureStep(s)).toMatchObject({ ok: false, state: s });
    // A closed rack takes nothing more.
    expect(load({ ...s, carrying: 'food' }).ok).toBe(false);
  });

  it('lists every item, the door and the restraints on the checklist', () => {
    const fresh = cargoChecklist(makeCargo());
    expect(fresh.map((c) => c.label)).toEqual(['Food crate', 'Tool case', 'Spare battery', 'Rack door', 'Restraints']);
    expect(fresh.every((c) => !c.done)).toBe(true);
    expect(cargoChecklist(pickUp(makeCargo()).state)[0].value).toBe('In your hands');
    let s = loadAll();
    for (let i = 0; i <= RESTRAINTS; i++) s = secureStep(s).state;
    expect(cargoChecklist(s).every((c) => c.done)).toBe(true);
  });

  it('starts later checkpoints with the rack already full', () => {
    const s = makeCargo(true);
    expect(allLoaded(s)).toBe(true);
    expect(s).toMatchObject({ door: false, restraints: 0, carrying: null });
  });

  it('gives the mission a checkpoint for each step, so training is not repeated after a reload', () => {
    expect(DEMO_MISSIONS.E02.phases.map((p) => p.id)).toEqual(['supplies', 'suit', 'course', 'board']);
  });
});
