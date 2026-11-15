// Earth training, the supply run: three things go into the loading rack, one
// at a time, and the rack is closed and strapped down before boarding.
// Pure rules: the scene only draws what this state says.

export type SupplyId = 'food' | 'tools' | 'battery';

export interface Supply {
  id: SupplyId;
  name: string;
  /** Why the crew takes it, said by the commander when it is loaded. */
  why: string;
}

export const SUPPLIES: Supply[] = [
  { id: 'food', name: 'food crate', why: 'Food is aboard. Nobody delivers lunch in orbit.' },
  { id: 'tools', name: 'tool case', why: 'Tools are aboard. Repairs happen a long way from any workshop.' },
  { id: 'battery', name: 'spare battery', why: 'Spare battery aboard. Backup power for the day a line fails.' },
];

/** Straps that hold the closed rack still during launch. */
export const RESTRAINTS = 2;

export interface CargoState {
  loaded: SupplyId[];
  carrying: SupplyId | null;
  /** The rack door is shut. */
  door: boolean;
  /** How many restraints are fastened. */
  restraints: number;
}

export function makeCargo(allLoaded = false): CargoState {
  return { loaded: allLoaded ? SUPPLIES.map((s) => s.id) : [], carrying: null, door: false, restraints: 0 };
}

export interface CargoResult { state: CargoState; ok: boolean; say: string }

const name = (id: SupplyId) => SUPPLIES.find((s) => s.id === id)!.name;

/** The next thing still on the shelf, in loading order. */
export function nextSupply(s: CargoState): SupplyId | null {
  return SUPPLIES.find((x) => !s.loaded.includes(x.id) && s.carrying !== x.id)?.id ?? null;
}

export function allLoaded(s: CargoState): boolean {
  return s.loaded.length === SUPPLIES.length;
}

export function secured(s: CargoState): boolean {
  return allLoaded(s) && s.door && s.restraints >= RESTRAINTS;
}

/** Take the next item off the shelf. Hands hold one thing at a time. */
export function pickUp(s: CargoState): CargoResult {
  if (s.carrying) return { state: s, ok: false, say: `Your hands are full. Load the ${name(s.carrying)} first.` };
  const next = nextSupply(s);
  if (!next) return { state: s, ok: false, say: 'The shelf is empty. Everything is in the rack.' };
  return { state: { ...s, carrying: next }, ok: true, say: `You have the ${name(next)}. Carry it to the loading rack.` };
}

/** Put what you are carrying into its slot in the rack. */
export function load(s: CargoState): CargoResult {
  if (!s.carrying) return { state: s, ok: false, say: 'Nothing to load. Pick something up from the supply shelf.' };
  if (s.door) return { state: s, ok: false, say: 'The rack door is shut.' };
  const item = SUPPLIES.find((x) => x.id === s.carrying)!;
  return { state: { ...s, carrying: null, loaded: [...s.loaded, item.id] }, ok: true, say: item.why };
}

/** One step of securing the cargo: shut the door, then fasten each restraint. */
export function secureStep(s: CargoState): CargoResult {
  if (!allLoaded(s) || s.carrying) return { state: s, ok: false, say: 'The rack is not full yet. Load every item before you close it.' };
  if (!s.door) return { state: { ...s, door: true }, ok: true, say: 'Rack door closed. Now the restraints.' };
  if (s.restraints < RESTRAINTS) {
    const n = s.restraints + 1;
    return { state: { ...s, restraints: n }, ok: true, say: n < RESTRAINTS ? `Restraint ${n} of ${RESTRAINTS} locked.` : 'Both restraints locked. The cargo will not move at launch.' };
  }
  return { state: s, ok: false, say: 'The cargo is already secured.' };
}

/** What the next press at the rack will do, for the prompt. */
export function secureLabel(s: CargoState): string {
  return !s.door ? 'Close the rack door' : `Fasten restraint ${Math.min(RESTRAINTS, s.restraints + 1)} of ${RESTRAINTS}`;
}

/** The cargo checklist shown in the HUD. */
export function cargoChecklist(s: CargoState): { label: string; value: string; done: boolean }[] {
  return [
    ...SUPPLIES.map((x) => {
      const done = s.loaded.includes(x.id);
      return { label: x.name[0].toUpperCase() + x.name.slice(1), value: done ? 'In the rack' : s.carrying === x.id ? 'In your hands' : 'On the shelf', done };
    }),
    { label: 'Rack door', value: s.door ? 'Closed' : 'Open', done: s.door },
    { label: 'Restraints', value: `${s.restraints} of ${RESTRAINTS} locked`, done: s.restraints >= RESTRAINTS },
  ];
}
