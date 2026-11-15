// F03 "Keep the Ship Flying": rules for the transfer craft. One spare connector
// can bring back one equipment branch, and that choice changes what the other
// rooms can do. Every task changes something the player can see or use later.
// The craft, its power branches and the air reserve figures are invented.

import type { Tier } from './types';

export type Branch = 'nav' | 'vent';
export type ShipTask = 'inspect' | 'take' | 'attach_nav' | 'attach_vent' | 'check_air' | 'backup' | 'grab' | 'rack' | 'latch';

export interface ShipState {
  inspected: boolean;
  /** Where the spare connector is. */
  connector: 'locker' | 'held' | Branch;
  airChecked: boolean;
  backupLoop: boolean;
  battery: 'loose' | 'held' | 'racked' | 'latched';
  /** Crew air reserve, percent. */
  reserve: number;
  /** Tasks in the order they were done. */
  log: ShipTask[];
}

export const SHIP_TUNING: Record<Tier, { backupCost: number; choice: boolean }> = {
  junior: { backupCost: 15, choice: false },
  middle: { backupCost: 25, choice: true },
  advanced: { backupCost: 30, choice: true },
};

export const BRANCH_LABEL: Record<Branch, string> = { nav: 'navigation', vent: 'ventilation' };

export function makeShip(): ShipState {
  return { inspected: false, connector: 'locker', airChecked: false, backupLoop: false, battery: 'loose', reserve: 100, log: [] };
}

export const powered = (s: ShipState, b: Branch): boolean => s.connector === b;
export const powerRestored = (s: ShipState): boolean => s.connector === 'nav' || s.connector === 'vent';
/** Crew ventilation is stable on the main fan (powered) or on the backup loop. */
export const airStable = (s: ShipState): boolean => powered(s, 'vent') || s.backupLoop;
export const airflow = (s: ShipState): 'stable' | 'backup' | 'low' => (powered(s, 'vent') ? 'stable' : s.backupLoop ? 'backup' : 'low');
export const readyToDock = (s: ShipState): boolean => powerRestored(s) && airStable(s);
/** What the cockpit can offer for docking: the live guidance display, or a slower talk-down from Reyes. */
export const dockingHelp = (s: ShipState): 'display' | 'guided' => (powered(s, 'nav') ? 'display' : 'guided');
export const handsFull = (s: ShipState): boolean => s.connector === 'held' || s.battery === 'held';

export interface ShipResult { state: ShipState; ok: boolean; say: string }

const no = (state: ShipState, say: string): ShipResult => ({ state, ok: false, say });
const yes = (state: ShipState, task: ShipTask, say: string): ShipResult => ({ state: { ...state, log: [...state.log, task] }, ok: true, say });

/** Apply one task. A refused task explains why and changes nothing. */
export function doShipTask(s: ShipState, task: ShipTask, tier: Tier): ShipResult {
  const tune = SHIP_TUNING[tier];
  switch (task) {
    case 'inspect':
      if (s.inspected) return no(s, 'The burnt connector is already marked. The spare is in the parts locker.');
      return yes({ ...s, inspected: true }, task, 'One connector on the main line is burnt out. The navigation and ventilation branches are both dark. There is one spare in the parts locker.');
    case 'take':
      if (!s.inspected) return no(s, 'Inspect the failed line first, so you know which part to fetch.');
      if (s.connector !== 'locker') return no(s, 'The locker is empty. There was only one spare.');
      if (s.battery === 'held') return no(s, 'Your hands are full. Put the battery in the rack first.');
      return yes({ ...s, connector: 'held' }, task, 'Spare connector in hand. It fits one socket: navigation or ventilation.');
    case 'attach_nav':
    case 'attach_vent': {
      const branch: Branch = task === 'attach_nav' ? 'nav' : 'vent';
      if (s.connector !== 'held') return no(s, powerRestored(s) ? 'The spare is already fitted. There is no second one.' : 'You need the spare connector from the parts locker.');
      if (!tune.choice && branch === 'vent') return no(s, 'Fit it to the navigation socket, Cadet. We will run the air on the backup loop.');
      return yes({ ...s, connector: branch }, task, branch === 'nav'
        ? 'Navigation branch online. The cockpit guidance display is back. Ventilation is still off the main line: check the airflow.'
        : 'Ventilation branch online. The main fan is back to full speed. The cockpit guidance display stays dark: docking will be a guided approach.');
    }
    case 'check_air':
      if (s.airChecked) return no(s, `Airflow reads ${airflow(s) === 'low' ? 'LOW' : 'STABLE'}. Reserve ${Math.round(s.reserve)}%.`);
      return yes({ ...s, airChecked: true }, task, airflow(s) === 'low'
        ? `Airflow is LOW: the main fan has no power. The backup loop will hold it steady and uses ${tune.backupCost}% of the reserve.`
        : 'Airflow is STABLE. No need for the backup loop.');
    case 'backup':
      if (!s.airChecked) return no(s, 'Read the airflow gauge before you change the loop.');
      if (s.backupLoop) return no(s, 'The backup loop is already running.');
      if (powered(s, 'vent')) return no(s, 'The main fan is powered and airflow is stable. Save the backup loop.');
      return yes({ ...s, backupLoop: true, reserve: s.reserve - tune.backupCost }, task, `Backup loop running. Airflow is steady. It used ${tune.backupCost}% of the reserve.`);
    case 'grab':
      if (s.battery !== 'loose') return no(s, 'The battery is not loose any more.');
      if (s.connector === 'held') return no(s, 'Your hands are full. Fit the connector first.');
      return yes({ ...s, battery: 'held' }, task, 'Spare battery in hand. The marked rack is on the back wall.');
    case 'rack':
      if (s.battery !== 'held') return no(s, 'Bring the spare battery here first.');
      return yes({ ...s, battery: 'racked' }, task, 'Battery in the rack. Close the latch so it stays put during docking.');
    case 'latch':
      if (s.battery !== 'racked') return no(s, 'Nothing in the rack to latch yet.');
      return yes({ ...s, battery: 'latched' }, task, 'Latched. That battery will be waiting for us on the Moon.');
  }
}

/** The next task Reyes points at. Junior follows this one step at a time. */
export function nextShipTask(s: ShipState, tier: Tier): ShipTask | 'cockpit' {
  if (!s.inspected) return 'inspect';
  if (s.connector === 'locker') return 'take';
  if (s.connector === 'held') return SHIP_TUNING[tier].choice && s.log.includes('check_air') && airflow(s) === 'low' ? 'attach_vent' : 'attach_nav';
  if (!s.airChecked) return 'check_air';
  if (!airStable(s)) return 'backup';
  if (s.battery === 'loose') return 'grab';
  if (s.battery === 'held') return 'rack';
  if (s.battery === 'racked') return 'latch';
  return 'cockpit';
}

/** Run a list of tasks. Used by tests and to prove both task orders succeed. */
export function runShip(tasks: ShipTask[], tier: Tier): ShipState {
  let s = makeShip();
  for (const t of tasks) s = doShipTask(s, t, tier).state;
  return s;
}
