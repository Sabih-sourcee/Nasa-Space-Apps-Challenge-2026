// L03 "The Last Battery": one spare battery, two sockets. Time moves only when
// the player acts, so the same actions always give the same result and a replay
// can be compared fairly. Charge units, crop stages, the crew readiness score
// and the clock are invented game values. The shelter walls do the shielding;
// the battery only runs the ventilation.

import type { Tier } from './types';

export type Socket = 'grow' | 'shelter';
export type BatteryAction = 'recover' | 'take' | 'plug_grow' | 'plug_shelter' | 'cycle' | 'move_crew' | 'low_flow' | 'ride_out';

export interface BatteryState {
  /** Game clock in steps. The alert arrives when it reaches `alertAt`. */
  clock: number;
  charge: number;
  battery: 'rack' | 'crate' | 'held' | Socket;
  /** Crop stage 0 to 3. */
  crop: number;
  cycles: number;
  vent: 'off' | 'full' | 'low';
  crew: 'working' | 'sheltered';
  /** 0 to 100. Drops if the crew is outside the shelter during the alert, or sits in stuffy air. */
  readiness: number;
  outcome: 'active' | 'success' | 'critical';
  reason: string;
  /** The first socket the battery went into. */
  first: Socket | null;
  log: BatteryAction[];
}

export interface BatteryTuning { startCharge: number; cycleCost: number; ventCost: number; lowCost: number; alertAt: number; exposure: number; stuffy: number; recoverTime: number }

export const BATTERY_TUNING: Record<Tier, BatteryTuning> = {
  junior: { startCharge: 9, cycleCost: 3, ventCost: 4, lowCost: 2, alertAt: 4, exposure: 15, stuffy: 20, recoverTime: 2 },
  middle: { startCharge: 8, cycleCost: 3, ventCost: 4, lowCost: 2, alertAt: 4, exposure: 15, stuffy: 20, recoverTime: 2 },
  advanced: { startCharge: 7, cycleCost: 3, ventCost: 4, lowCost: 2, alertAt: 4, exposure: 20, stuffy: 25, recoverTime: 2 },
};

export const MAX_CROP = 3;

/** Mission start. A battery latched aboard the ship waits at the near rack; otherwise it is still in the cargo crate. */
export function makeBattery(tier: Tier, secured: boolean): BatteryState {
  return {
    clock: 0, charge: BATTERY_TUNING[tier].startCharge, battery: secured ? 'rack' : 'crate', crop: 1, cycles: 0,
    vent: 'off', crew: 'working', readiness: 100, outcome: 'active', reason: '', first: null, log: [],
  };
}

export const alertActive = (s: BatteryState, tier: Tier): boolean => s.clock >= BATTERY_TUNING[tier].alertAt;

export interface BatteryResult { state: BatteryState; ok: boolean; say: string }

/** Apply one action. A refused action explains why and changes nothing. */
export function doBattery(prev: BatteryState, action: BatteryAction, tier: Tier): BatteryResult {
  const t = BATTERY_TUNING[tier];
  const no = (say: string): BatteryResult => ({ state: prev, ok: false, say });
  if (prev.outcome !== 'active') return no('This shift has already ended.');
  const s: BatteryState = { ...prev, log: [...prev.log, action] };
  const alertBefore = alertActive(prev, tier);
  let say = '';
  let time = 0;

  switch (action) {
    case 'recover':
      if (prev.battery !== 'crate') return no('The crate is already open.');
      s.battery = 'held'; time = t.recoverTime;
      say = 'Straps off, crate open. Battery in hand. That took a while: it was never latched aboard the ship.';
      break;
    case 'take':
      if (prev.battery === 'held') return no('You are already carrying it.');
      if (prev.battery === 'crate') return no('The battery is still strapped in the cargo crate. Open the crate first.');
      if (prev.battery === 'shelter' && prev.crew === 'sheltered') return no('The crew is breathing on that battery. Leave it in the shelter socket.');
      s.battery = 'held';
      say = prev.battery === 'rack' ? 'Battery in hand. Two sockets can use it: the grow rack and the shelter ventilation.' : 'Battery unplugged. Carry it to the other socket.';
      if (prev.battery === 'shelter') s.vent = 'off';
      break;
    case 'plug_grow':
      if (prev.battery !== 'held') return no('Bring the battery here first.');
      s.battery = 'grow'; time = 1; s.first = prev.first ?? 'grow';
      say = 'Grow lights on. Run a crop cycle from the grow panel.';
      break;
    case 'plug_shelter':
      if (prev.battery !== 'held') return no('Bring the battery here first.');
      s.battery = 'shelter'; time = 1; s.first = prev.first ?? 'shelter';
      if (s.charge >= t.ventCost) { s.vent = 'full'; say = 'Shelter ventilation running at full flow. Call the crew in.'; }
      else { s.vent = 'off'; say = `Only ${s.charge} units left. Full ventilation needs ${t.ventCost}. Switch to low-flow mode at the vent panel.`; }
      break;
    case 'cycle':
      if (prev.battery !== 'grow') return no('The grow rack has no power. Plug the battery in first.');
      if (prev.crop >= MAX_CROP) return no('The crop is ready to harvest. Another cycle would not help.');
      if (prev.charge < t.cycleCost) return no(`A crop cycle needs ${t.cycleCost} units and the battery has ${prev.charge}.`);
      s.charge -= t.cycleCost; s.crop += 1; s.cycles += 1; time = 2;
      say = `Crop cycle done. The plants are at stage ${s.crop}. The battery has ${s.charge} units left.`;
      break;
    case 'low_flow':
      if (prev.battery !== 'shelter') return no('The battery is not in the shelter socket.');
      if (prev.vent !== 'off') return no('Ventilation is already running.');
      if (prev.charge < t.lowCost) {
        s.outcome = 'critical';
        s.reason = `The battery had ${prev.charge} units left, too little even for low-flow ventilation, so Commander Reyes stopped the shift.`;
        say = s.reason;
        break;
      }
      s.vent = 'low';
      say = 'Low-flow mode on. The crew can shelter, but the air will be stuffy.';
      break;
    case 'move_crew':
      if (prev.crew === 'sheltered') return no('The crew is already inside.');
      s.crew = 'sheltered'; time = 1;
      say = s.vent === 'off' ? 'Crew is behind the shelter walls. There is no ventilation yet: get the battery to the shelter socket.' : 'Crew is inside, behind the thick walls, with the fans running.';
      break;
    case 'ride_out':
      if (prev.crew !== 'sheltered') return no('The crew is still outside the shelter.');
      if (prev.vent === 'off') return no('The shelter has no ventilation. Plug the battery into the shelter socket.');
      s.charge -= prev.vent === 'full' ? t.ventCost : t.lowCost;
      if (prev.vent === 'low') s.readiness -= t.stuffy;
      s.outcome = 'success'; time = 1;
      say = 'Hatch closed. The alert passes with the crew behind the shelter walls.';
      break;
  }

  s.clock += time;
  // Time spent after the alert has arrived, with the crew still at their stations, costs readiness.
  if (time > 0 && alertBefore && s.crew === 'working') {
    s.readiness -= t.exposure;
    if (s.readiness < 50 && s.outcome === 'active') {
      s.outcome = 'critical';
      s.reason = 'The crew was still outside the shelter long after the solar particle alert arrived, so Commander Reyes stopped the shift.';
      say = s.reason;
    }
  }
  s.readiness = Math.max(0, s.readiness);
  return { state: s, ok: true, say };
}

/** One run from the socket choice: where it began, what was done, where it ended. */
export interface BatteryRun {
  tier: Tier;
  secured: boolean;
  start: BatteryState;
  actions: BatteryAction[];
  state: BatteryState;
  /** Floor positions walked, for drawing the earlier route during a replay. */
  trail: [number, number][];
}

/** The checkpoint just before the socket choice: battery in hand, clock already counting any recovery. */
export function choiceStart(tier: Tier, secured: boolean): BatteryState {
  const s = makeBattery(tier, secured);
  return doBattery(secured ? s : doBattery(s, 'recover', tier).state, 'take', tier).state;
}

export function runBattery(tier: Tier, secured: boolean, actions: BatteryAction[]): BatteryRun {
  const start = choiceStart(tier, secured);
  let state = start;
  const done: BatteryAction[] = [];
  for (const a of actions) {
    const r = doBattery(state, a, tier);
    if (r.ok) { state = r.state; done.push(a); }
  }
  return { tier, secured, start, actions: done, state, trail: [] };
}

export const SOCKET_LABEL: Record<Socket, string> = { grow: 'Grow rack first', shelter: 'Shelter first' };

export interface BatteryCompare {
  same: boolean;
  rows: { label: string; first: string; replay: string; delta: number }[];
  why: string;
}

const harvest = (s: BatteryState) => (s.cycles > 0 ? 'on time' : 'delayed');

export function compareBattery(a: BatteryRun, b: BatteryRun): BatteryCompare {
  const same = a.actions.join() === b.actions.join();
  const A = a.state;
  const B = b.state;
  const units = (n: number) => `${n} ${n === 1 ? 'unit' : 'units'}`;
  const rows = [
    { label: 'First socket', first: A.first ? SOCKET_LABEL[A.first] : 'none', replay: B.first ? SOCKET_LABEL[B.first] : 'none', delta: 0 },
    { label: 'Crop stage', first: `${A.crop} of ${MAX_CROP}`, replay: `${B.crop} of ${MAX_CROP}`, delta: B.crop - A.crop },
    { label: 'Harvest', first: harvest(A), replay: harvest(B), delta: 0 },
    { label: 'Charge left', first: units(A.charge), replay: units(B.charge), delta: B.charge - A.charge },
    { label: 'Crew readiness', first: `${A.readiness}%`, replay: `${B.readiness}%`, delta: B.readiness - A.readiness },
  ];
  const why = same
    ? 'Same actions from the same checkpoint gave exactly the same result. The habitat follows fixed rules.'
    : A.first !== B.first
      ? B.first === 'grow'
        ? 'Powering the grow rack first finished a crop cycle before the alert, and left less charge for the shelter fans.'
        : 'Going to the shelter first kept more charge and got the crew in early, and the grow lights stayed dim so the harvest waits.'
      : B.cycles !== A.cycles
        ? 'Each crop cycle used charge the shelter fans needed later.'
        : 'The order of the steps changed how long the crew waited outside the shelter.';
  return { same, rows, why };
}
