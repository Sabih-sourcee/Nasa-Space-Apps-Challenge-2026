// Crew Ship mission engine. One pure reducer is the authority for crew
// membership, roles, shared items, incidents, task completion and replay. The
// mission service (dev server) and solo training both run this same code, so
// every browser sees the same ship. Time moves only when the crew acts.

import {
  INCIDENT_BY_ID, ITEM_LABEL, ROLES, ROOM_BY_ID, TASK_BY_ID,
  type CrewCarry, type IncidentId, type IncidentTask, type ItemId, type Res, type Role, type RoomId, type TaskSpec,
} from './crewData';
import type { Tier } from './types';

export const MAX_CREW = 6;
export const CREW_CALLS = ['Need help', 'Bring battery', 'Ready at airlock', 'On my way', 'Done here', 'Check the Bridge'];

export interface Member {
  id: string; name: string; role: Role | null; ready: boolean; connected: boolean; bot: boolean;
  x: number; z: number; room: RoomId; claim: string | null;
}
export interface ShipItem { at: RoomId | 'held' | 'used'; holder: string | null; home: RoomId }
export interface LogEntry { n: number; shift: number; by: string; room: RoomId | null; text: string; kind: 'task' | 'miss' | 'event' | 'call' | 'choice' }

export interface ShipState {
  incident: IncidentId; tier: Tier; crew: number; res: Res;
  shift: number; clock: number; total: number;
  flags: Record<string, boolean>; done: string[];
  items: Partial<Record<ItemId, ShipItem>>;
  misses: number; outcome: 'active' | 'complete';
}

export interface Outcome { stars: 1 | 2 | 3; res: Res; total: number; misses: number; summary: string; cause: string; firstRoom: RoomId | null; flags: Record<string, boolean> }

export interface CrewSession {
  code: string; hostId: string; solo: boolean;
  phase: 'lobby' | 'briefing' | 'active' | 'debrief' | 'ended';
  incident: IncidentId; tier: Tier; carry: CrewCarry;
  members: Member[];
  state: ShipState | null;
  /** The ship exactly as it was when the incident started. Crew Replay forks from here. */
  checkpoint: ShipState | null;
  log: LogEntry[];
  outcome: Outcome | null;
  /** The finished first run, kept when the crew plays a practice replay. */
  original: Outcome | null;
  originalLog: LogEntry[];
  replay: boolean;
  applied: string[];
  seq: number;
}

export type CrewAction =
  | { type: 'join'; aid: string; id: string; name: string; bot?: boolean }
  | { type: 'leave'; aid: string; by: string }
  | { type: 'rejoin'; aid: string; by: string }
  | { type: 'role'; aid: string; by: string; role: Role }
  | { type: 'handoff'; aid: string; by: string; to: string }
  | { type: 'ready'; aid: string; by: string; ready: boolean }
  | { type: 'setup'; aid: string; by: string; incident: IncidentId; tier: Tier }
  | { type: 'start'; aid: string; by: string }
  | { type: 'briefed'; aid: string; by: string }
  | { type: 'move'; by: string; x: number; z: number; room: RoomId }
  | { type: 'claim'; aid: string; by: string; key: string }
  | { type: 'release'; aid: string; by: string }
  | { type: 'answer'; aid: string; by: string; key: string; value: unknown }
  | { type: 'pickup'; aid: string; by: string; item: ItemId }
  | { type: 'deliver'; aid: string; by: string }
  | { type: 'call'; aid: string; by: string; text: string }
  | { type: 'endShift'; aid: string; by: string }
  | { type: 'end'; aid: string; by: string }
  | { type: 'replay'; aid: string; by: string };

export interface CrewResult { session: CrewSession; ok: boolean; error?: string; say?: string; duplicate?: boolean; card?: boolean }

const BASE_RES: Res = { meals: 0, fuel: 100, power: 100, water: 100, air: 100, crops: 3, readiness: 100 };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function createSession(code: string, host: { id: string; name: string }, solo = false): CrewSession {
  const s: CrewSession = {
    code, hostId: host.id, solo, phase: 'lobby', incident: 'meals', tier: 'junior', carry: {}, members: [], state: null, checkpoint: null,
    log: [], outcome: null, original: null, originalLog: [], replay: false, applied: [], seq: 0,
  };
  return reduceCrew(s, { type: 'join', aid: `join-${host.id}`, id: host.id, name: host.name }).session;
}

/** Pseudonymous cadet names: no real names are ever asked for. */
export function cadetName(seed: number): string {
  const a = ['Orion', 'Vega', 'Lyra', 'Comet', 'Nova', 'Atlas', 'Juno', 'Rigel', 'Halo', 'Pixel', 'Echo', 'Zephyr'];
  return `Cadet ${a[Math.abs(seed) % a.length]}-${10 + (Math.abs(seed * 7) % 90)}`;
}

// ---------------------------------------------------------------------------
// Incident rules
// ---------------------------------------------------------------------------

function crewSize(members: Member[]): number {
  return Math.max(4, members.length);
}

function startRes(id: IncidentId, crew: number, carry: CrewCarry): Res {
  const r = { ...BASE_RES };
  if (id === 'meals') r.meals = 2 * crew;
  if (id === 'air') { r.air = 70; if (carry.reserveSpent) r.power = 60; }
  if (id === 'water') r.water = 60;
  if (id === 'relay') r.power = 60;
  if (id === 'tour' || id === 'cargo_relay') r.meals = crew;
  return r;
}

/** The tasks an incident uses, with its own wording where the drill version would not fit. */
export function incidentTasks(st: ShipState): (IncidentTask & { key: string })[] {
  const { incident: id, tier, crew, res, flags } = st;
  const guided = tier === 'junior';
  const k = (key: string, t: IncidentTask): IncidentTask & { key: string } => ({ key, ...t });
  switch (id) {
    case 'tour':
      return Object.keys(TASK_BY_ID).map((task) => k(task, { task, optional: true }));
    case 'meals':
      return [
        k('t08', { task: 't08', variant: { answer: crew, prompt: `There are ${crew} crew. One pack each per shift. How many packs go out for this shift?`, effect: `Packs set out: ${crew}. Packs left in reserve after this shift: ${Math.max(0, res.meals - crew)}.` } }),
        k('t01', { task: 't01', needs: guided ? 'done:t08' : undefined, variant: {
          title: 'Find the shift with no food', clue: 'Multiply: crew times shifts. Compare with the packs on the rack.',
          prompt: `Stock: ${2 * crew} packs. Crew: ${crew}. The delivery now arrives at the END of Shift 3. One pack each per shift. Which shift has nothing to eat?`,
          options: [
            { id: 's1', label: 'Shift 1', why: `Shift 1 uses ${crew} of the ${2 * crew} packs. There is food.` },
            { id: 's2', label: 'Shift 2', why: `Shift 2 uses the last ${crew} packs. There is food, just.` },
            { id: 's3', label: 'Shift 3', correct: true, why: `${3 * crew} packs are needed and there are ${2 * crew}. Shift 3 is short by ${crew}.` },
          ],
          effect: `The Bridge board shows SHIFT 3: SHORT BY ${crew} PACKS.`,
        } }),
        k('t11', { task: 't11', optional: true, needs: guided ? 'done:t01' : undefined, variant: { time: tier === 'advanced' ? 3 : 2 } }),
        k('t12', { task: 't12', optional: true, needs: guided ? 'done:t01' : undefined, variant: { title: 'Ask for an earlier docking', prompt: `Turn the dish until the signal is strongest, then ask the dock for the Shift 2 slot. It will cost ${tier === 'advanced' ? 30 : 20} fuel.`, effect: 'The Comms screen shows DOCKING MOVED TO END OF SHIFT 2. The fuel bar drops.' } }),
        k('t09', { task: 't09', optional: true }),
        ...(tier === 'advanced' ? [k('t04', { task: 't04', variant: { prompt: 'The Galley food warmer is dark. Connectors: P1 feeds BRIDGE. P2 feeds LIFE SUPPORT. P3 feeds GALLEY. Which connector do you reseat?', options: [
          { id: 'p1', label: 'P1', why: 'P1 feeds the Bridge.' }, { id: 'p2', label: 'P2', why: 'P2 feeds Life Support.' }, { id: 'p3', label: 'P3', correct: true, why: 'P3 feeds the Galley. The warmer is back.' },
        ], effect: 'The Galley warmer light comes on.' } })] : []),
      ];
    case 'air':
      return [
        k('t01', { task: 't01', variant: { title: 'Read the CO₂ board', clue: 'The Bridge sees which rooms are high. It cannot see which loop feeds them.', prompt: 'CO₂ board. Bridge: normal. Galley: HIGH ▲. Grow Lab: HIGH ▲. Water Recovery: normal. Which rooms do you call out to Life Support?', options: [
          { id: 'bw', label: 'Bridge and Water Recovery', why: 'Those two read normal.' },
          { id: 'gg', label: 'Galley and Grow Lab', correct: true, why: 'Those are the two rooms reading high.' },
        ], effect: 'The Bridge board flags GALLEY and GROW LAB.' } }),
        k('t06a', { task: 't06', needs: 'done:t01', variant: { kind: 'pick', item: undefined, title: 'Find the affected loop', time: 1, clue: 'Life Support sees which loop feeds which rooms. It needs the Bridge to say which rooms are high.', prompt: 'Loop A feeds the Bridge and Water Recovery. Loop B feeds the Galley and the Grow Lab. The Bridge called out: Galley and Grow Lab. Which loop has the bad filter?', options: [
          { id: 'a', label: 'Loop A', why: 'Loop A feeds rooms that read normal.' }, { id: 'b', label: 'Loop B', correct: true, why: 'Loop B feeds both high rooms. Its filter is full.' },
        ], effect: 'Life Support marks LOOP B: FILTER FULL.' } }),
        k('t05', { task: 't05', optional: true, needs: 'done:t06a', variant: { title: 'Backup circulation on the reserve battery', prompt: 'Seat the reserve battery to run backup fans while the filter is out. It costs 25 reserve power.', effect: 'Backup fans run. Reserve power drops by 25.' } }),
        k('t10', { task: 't10', optional: true, needs: 'done:t06a', variant: { title: 'Close the affected bay', time: 3, clue: 'Closing the bay keeps stale air out of the rest of the ship. Everything must go the long way round.', effect: 'The Galley side hatch closes. Cargo runs take the long loop.' } }),
        k('t06', { task: 't06', needs: 'done:t06a' }),
        k('t01b', { task: 't01', needs: 'done:t06', variant: { title: 'Confirm recovery on the Bridge', clue: 'A fix is only a fix when the reading changes.', prompt: 'CO₂ board after the new filter. Galley: falling ▼. Grow Lab: falling ▼. What do you report?', options: [
          { id: 'ok', label: 'CO₂ is falling. Filter confirmed.', correct: true, why: 'Both rooms are falling. The new filter is working.' }, { id: 'o2', label: 'We need more oxygen', why: 'Oxygen was never the problem. This was carbon dioxide.' },
        ], effect: 'The Bridge board shows AIR: RECOVERING.' } }),
      ];
    case 'water':
      return [
        k('t07', { task: 't07', needs: 'cartridge' }),
        k('alloc', { task: 't09', needs: 'done:t07', tradeoff: true, variant: { title: 'Decide where the recovered water goes', clue: 'There is not enough for both. People need water today. Plants can miss a day, and it costs growth.', prompt: `Recovered water: 20 units. The crew tank is at ${res.water}%. Where does it go?`, options: [
          { id: 'crew', label: 'Crew tank', why: 'The crew tank fills. One crop tray dries out.' }, { id: 'crops', label: 'Crop trays', why: 'The trays stay green. The crew tank stays low.' },
        ], effect: 'Tank levels change in Water Recovery and the Grow Lab.' } }),
      ];
    case 'relay':
      return [
        k('t12', { task: 't12', variant: { title: 'Send the power report', effect: `The Comms screen shows REPORT SENT, Shift ${st.shift}. Earth will read it later.` } }),
        k('t13', { task: 't13', variant: { title: 'Start the recovery', prompt: 'Move coolant to the power converter until it is in the green band. Do not wait for Earth.', effect: 'The converter cools and reserve power rises by 20.' } }),
        k('relaypower', { task: 't04', tradeoff: true, variant: { title: 'Relay power, or habitat power?', clue: 'The relay is how Earth reaches us. It also eats power the habitat wants.', prompt: 'Keep the relay powered and hear from Earth (10 power every shift), or give that power to the habitat equipment?', options: [
          { id: 'relay', label: 'Keep the relay on', why: 'The relay stays on. Earth will be able to answer.' }, { id: 'habitat', label: 'Power the habitat', why: 'The relay goes dark. The habitat gets 10 more power.' },
        ], effect: 'The relay light in the Power Bay changes.' } }),
        k('compare', { task: 't01', needs: 'reply', tradeoff: true, variant: { title: "Compare Earth's reply with now", clue: "Earth's advice was written about the ship as it was when you sent the report.", prompt: `Reply from Earth, written when power read ${flags.recoveryBeforeReport ? 80 : 60}%: "Power is critical. Shut down the habitat heaters." The Bridge reads ${res.power}% now. What do you do?`, options: [
          { id: 'follow', label: 'Follow the reply: heaters off', why: 'The heaters go off. The advice was about an earlier state.' }, { id: 'adapt', label: 'Use the current reading', why: 'You answer Earth with the new reading and keep the heaters on.' },
        ], effect: 'The Bridge logs the decision next to the reply.' } }),
      ];
    case 'docking':
      return [
        k('t14', { task: 't14' }),
        k('t10', { task: 't10', optional: true }),
        k('approach', { task: 't03', tradeoff: true, variant: { title: 'Choose the approach', clue: 'Quick means tight margins. Guided means more time and fuel.', prompt: 'Quick approach: no extra cost, and the nose must be within 1°. Guided approach: 10 fuel and 3 more clock steps, and the nose may be within 4°.', options: [
          { id: 'quick', label: 'Quick approach', why: 'Quick approach set. Margins are tight.' }, { id: 'guided', label: 'Guided approach', why: 'Guided approach set. Slower and steadier.' },
        ], effect: 'The chart table shows the chosen approach.' } }),
        k('t02', { task: 't02', needs: 'approach', variant: { dial: { label: 'Nose angle', start: 14, target: 0, tol: flags.guided || guided ? 4 : 1, min: -20, max: 20, unit: '°' }, prompt: flags.thruster ? 'Turn the ship until the nose is on the docking line, then hold it.' : 'The backup thruster is not online. The ship will not hold a line.' } }),
      ];
    case 'cargo_relay': return [k('t11', { task: 't11' }), k('t10', { task: 't10' })];
    case 'docking_drill': return [k('t14', { task: 't14' }), k('t02', { task: 't02', needs: 'done:t14' })];
    case 'signal_hunt': return [k('t13', { task: 't13' }), k('t12', { task: 't12', needs: 'done:t13' })];
  }
}

const needMet = (st: ShipState, need?: string): boolean => !need || (need.startsWith('done:') ? st.done.includes(need.slice(5)) : !!st.flags[need]);

export interface LiveTask { key: string; spec: TaskSpec; optional: boolean; tradeoff: boolean; available: boolean; done: boolean }

/** Every task of the current incident, merged with its wording for this emergency. */
export function liveTasks(st: ShipState): LiveTask[] {
  return incidentTasks(st).map((t) => ({
    key: t.key, spec: { ...TASK_BY_ID[t.task], ...(t.variant ?? {}) } as TaskSpec,
    optional: !!t.optional, tradeoff: !!t.tradeoff, available: needMet(st, t.needs), done: st.done.includes(t.key),
  }));
}

/** Where an item may be handed over, and what that does. */
function deliverRule(st: ShipState, item: ItemId, room: RoomId): string | null {
  if (item === 'meal_crate' && room === 'galley') {
    st.res.meals += st.crew; st.flags.crate = true;
    return `Meal crate delivered. ${st.crew} more packs on the Galley rack.`;
  }
  if (item === 'cartridge' && room === 'water') { st.flags.cartridge = true; return 'Replacement cartridge is at the recycle loop. The repair can start.'; }
  return null;
}

function onTaskDone(st: ShipState, key: string, choice: string | null): void {
  const f = st.flags;
  const r = st.res;
  switch (`${st.incident}:${key}`) {
    case 'meals:t12': r.fuel -= st.tier === 'advanced' ? 30 : 20; f.earlyDock = true; break;
    case 'meals:t09': case 'tour:t09': r.crops = Math.min(4, r.crops + 1); break;
    case 'meals:t04': f.warmer = true; break;
    case 'air:t05': r.power -= 25; f.held = true; break;
    case 'air:t10': f.held = true; break;
    case 'air:t06': if (!f.held) { r.air -= 15; f.unheld = true; } r.air = Math.min(100, r.air + 35); f.filter = true; break;
    case 'water:t07': f.leakFixed = true; break;
    case 'water:alloc':
      if (choice === 'crew') { r.water = Math.min(100, r.water + 20); r.crops -= 1; f.allocCrew = true; } else { f.allocCrops = true; if (r.water < 50) r.readiness -= 15; }
      break;
    case 'relay:t12': f.reportSent = true; f[`sent${st.shift}`] = true; if (f.recovery) f.recoveryBeforeReport = true; break;
    case 'relay:t13': r.power = Math.min(100, r.power + 20); f.recovery = true; break;
    case 'relay:relaypower': if (choice === 'relay') f.relayOn = true; else { f.relayOff = true; r.power = Math.min(100, r.power + 10); } break;
    case 'relay:compare': if (choice === 'follow') { r.readiness -= 20; f.followed = true; } else f.adapted = true; break;
    case 'docking:t14': case 'docking_drill:t14': f.thruster = true; break;
    case 'docking:t10': f.cargoSecured = true; break;
    case 'docking:approach': f.approach = true; if (choice === 'guided') { f.guided = true; r.fuel -= 10; st.clock += 3; st.total += 3; } else f.quick = true; break;
    default: break;
  }
}

/** What happens when a shift ends. Returns the lines for the mission log. */
function onShiftEnd(st: ShipState): string[] {
  const out: string[] = [];
  const { res: r, flags: f, crew } = st;
  if (st.incident === 'meals') {
    if (r.meals >= crew) { r.meals -= crew; out.push(`Shift ${st.shift} meal: ${crew} packs eaten, ${r.meals} left.`); }
    else {
      const short = crew - r.meals; r.meals = 0; r.readiness -= Math.round((30 * short) / crew); f.wentHungry = true;
      out.push(`Shift ${st.shift} meal: short by ${short} packs. The crew shared half rations and readiness fell.`);
    }
    if (st.tier === 'advanced' && !f.warmer) { r.readiness -= 10; out.push('The Galley warmer is still dark. Cold meals again.'); }
    if ((st.shift === 2 && f.earlyDock) || st.shift >= 3) { r.meals += 3 * crew; f.delivered = true; out.push(`The supply delivery docked at the end of Shift ${st.shift}.`); }
  }
  if (st.incident === 'air' && !f.filter) { r.air -= st.tier === 'advanced' ? 25 : 15; if (r.air < 50) r.readiness -= 15; out.push(`CO₂ kept building in Loop B. Air quality ${Math.max(0, r.air)}%.`); }
  if (st.incident === 'water' && !f.leakFixed) { r.water -= 15; if (r.water < 40) r.readiness -= 20; out.push(`The leak ran all shift. Clean water ${Math.max(0, r.water)}%.`); }
  if (st.incident === 'relay') {
    r.power -= 10 + (f.relayOn ? 10 : 0);
    out.push(`Dust kept the panels dim. Reserve power ${Math.max(0, r.power)}%.`);
    if (f.relayOn && f.reportSent && !f.reply) { f.reply = true; out.push('A reply from Earth arrived. It was written about the ship as it was when the report left.'); }
    if (r.power < 20) { r.readiness -= 20; out.push('Power is very low. The habitat is cold.'); }
  }
  for (const key of ['meals', 'fuel', 'power', 'water', 'air', 'crops', 'readiness'] as (keyof Res)[]) r[key] = clamp(r[key], 0, key === 'meals' ? 99 : key === 'crops' ? 4 : 100);
  return out;
}

function isComplete(st: ShipState): boolean {
  const f = st.flags;
  const d = (k: string) => st.done.includes(k);
  switch (st.incident) {
    case 'tour': return false;
    case 'meals': return !!f.delivered;
    case 'air': return d('t01b');
    case 'water': return d('alloc');
    case 'relay': return !!f.recovery && (!!f.relayOff || d('compare')) ;
    case 'docking': return d('t02');
    case 'cargo_relay': return d('t10') && !!f.crate;
    case 'docking_drill': return d('t02');
    case 'signal_hunt': return d('t12');
  }
}

function buildOutcome(st: ShipState, log: LogEntry[]): Outcome {
  const { res: r, flags: f, crew } = st;
  const spec = INCIDENT_BY_ID[st.incident];
  let stars: 1 | 2 | 3 = r.readiness >= 100 && st.misses <= 1 ? 3 : r.readiness >= 70 ? 2 : 1;
  let summary = '';
  let cause = '';
  switch (st.incident) {
    case 'meals':
      summary = f.wentHungry ? `The crew went short on food for a shift. Readiness ${r.readiness}%, fuel ${r.fuel}%.` : `Everyone ate every shift. Readiness ${r.readiness}%, fuel ${r.fuel}%.`;
      cause = f.wentHungry
        ? `Nobody closed the gap before Shift 3, so ${crew} crew shared what was left. ${f.crate ? 'The crate reached the Galley too late.' : 'The misplaced crate stayed in Cargo and the dock was never asked.'} The crop trays could not help: plants take weeks.`
        : f.crate && f.earlyDock ? `You did both: the misplaced crate fed Shift 3 and the earlier docking cost ${100 - r.fuel} fuel that was not needed.`
          : f.crate ? `Logistics matched the manifest and found the meal crate under the wrong label. It cost crew time and no fuel, and it gave Shift 3 its ${crew} packs.`
            : `Comms asked for the earlier docking, so the delivery came at the end of Shift 2. That cost ${100 - r.fuel} fuel and no crew time in Cargo.`;
      break;
    case 'air':
      stars = r.air >= 70 && r.readiness >= 100 ? 3 : r.air >= 50 ? 2 : 1;
      summary = `Air quality ${r.air}%. Reserve power ${r.power}%.`;
      cause = `The Bridge saw which rooms were high and Life Support knew which loop fed them: it took both clues to find Loop B. ${f.held ? (st.done.includes('t05') ? 'Backup fans on the reserve battery kept the air moving while the filter was out, and that spent reserve power.' : 'Closing the bay kept the stale air in one place, and every cargo run took the long way round.') : 'The filter was changed with nothing holding the air steady, so it dipped while the loop was open.'} Oxygen was never short. The filter takes carbon dioxide out.`;
      break;
    case 'water':
      stars = r.readiness >= 100 && r.water >= 60 ? 3 : r.readiness >= 70 ? 2 : 1;
      summary = `Clean water ${r.water}%. Crop trays ${r.crops}.`;
      cause = f.allocCrew ? 'You sent the recovered water to the crew tank. The crew is fine and one crop tray dried out, so a later harvest is smaller.' : 'You kept the crop trays watered. The harvest is safe, and the crew tank stayed low for the shift.';
      break;
    case 'relay':
      stars = r.readiness >= 100 && r.power >= 40 ? 3 : r.readiness >= 70 ? 2 : 1;
      summary = `Reserve power ${r.power}%. Readiness ${r.readiness}%.`;
      cause = f.relayOff ? 'You gave the relay power to the habitat. The equipment stayed warm, and Earth never got an answer through.'
        : f.followed ? "Earth's reply was written before your recovery took hold. Following it shut the heaters down when the gauges no longer called for it."
          : "Earth's reply described the ship as it was when the report left. You compared it with the current reading and kept the heaters on.";
      break;
    case 'docking':
      stars = f.cargoSecured && st.misses === 0 ? 3 : f.cargoSecured || st.misses === 0 ? 2 : 1;
      summary = `Docked on the ${f.guided ? 'guided' : 'quick'} approach. Cargo ${f.cargoSecured ? 'latched' : 'loose'}. Fuel ${r.fuel}%.`;
      cause = `${f.guided ? 'The guided approach cost 10 fuel and three clock steps, and gave the Pilot four degrees to work with.' : 'The quick approach cost nothing extra and left the Pilot one degree of margin.'} ${f.cargoSecured ? 'The cargo was latched, so it will be where the next crew expects it.' : 'The cargo was never latched. The next stop starts with digging it out.'}`;
      break;
    default:
      stars = st.misses === 0 ? 3 : st.misses <= 2 ? 2 : 1;
      summary = st.incident === 'tour' ? `${st.done.length} of 18 drills tried.` : `Finished in ${st.total} clock steps with ${st.misses} ${st.misses === 1 ? 'mistake' : 'mistakes'}.`;
      cause = st.incident === 'tour' ? 'Every drill used the same stations the emergencies use.' : 'Each wrong answer cost a clock step. The same stations are used in the emergencies.';
  }
  const first = log.find((l) => l.kind === 'task' || l.kind === 'choice');
  return { stars, res: { ...r }, total: st.total, misses: st.misses, summary: `${spec.title}: ${summary}`, cause, firstRoom: first?.room ?? null, flags: { ...f } };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function freshState(s: CrewSession): ShipState {
  const crew = crewSize(s.members);
  const spec = INCIDENT_BY_ID[s.incident];
  const items: Partial<Record<ItemId, ShipItem>> = {};
  for (const [item, room] of Object.entries(spec.items)) items[item as ItemId] = { at: room as RoomId, holder: null, home: room as RoomId };
  return { incident: s.incident, tier: s.tier, crew, res: startRes(s.incident, crew, s.carry), shift: 1, clock: 0, total: 0, flags: {}, done: [], items, misses: 0, outcome: 'active' };
}

/** Put back anything a member was carrying or working on. Used on leave and disconnect. */
function releaseMember(s: CrewSession, id: string): void {
  const m = s.members.find((x) => x.id === id);
  if (m) m.claim = null;
  if (s.state) for (const it of Object.values(s.state.items)) if (it && it.holder === id) { it.holder = null; it.at = it.home; }
}

export function reduceCrew(prev: CrewSession, a: CrewAction): CrewResult {
  // Idempotent writes: an action id that was already applied does nothing the second time.
  if ('aid' in a && prev.applied.includes(a.aid)) return { session: prev, ok: true, duplicate: true };
  if (a.type === 'move') {
    const m = prev.members.find((x) => x.id === a.by);
    if (!m) return { session: prev, ok: false, error: 'Not in this crew.' };
    return { session: { ...prev, members: prev.members.map((x) => (x.id === a.by ? { ...x, x: a.x, z: a.z, room: a.room } : x)) }, ok: true };
  }
  const s = clone(prev);
  const fail = (error: string): CrewResult => ({ session: prev, ok: false, error });
  const me = 'by' in a ? s.members.find((m) => m.id === a.by) : undefined;
  const st = s.state;
  const log = (by: string, room: RoomId | null, text: string, kind: LogEntry['kind']) => { s.log.push({ n: s.log.length + 1, shift: st?.shift ?? 0, by, room, text, kind }); };
  const done = (say?: string, card = false): CrewResult => { s.applied.push((a as { aid: string }).aid); if (s.applied.length > 400) s.applied.shift(); s.seq += 1; return { session: s, ok: true, say, card }; };
  const tick = (time: number) => {
    if (!st) return;
    st.clock += time; st.total += time;
    const len = INCIDENT_BY_ID[st.incident].shiftLen[st.tier];
    while (st.clock >= len && st.outcome === 'active') endShift();
  };
  const endShift = () => {
    if (!st) return;
    for (const line of onShiftEnd(st)) log('Ship', null, line, 'event');
    st.clock = 0;
    if (isComplete(st) || st.shift >= INCIDENT_BY_ID[st.incident].shifts) finish(); else { st.shift += 1; log('Ship', null, `Shift ${st.shift} begins.`, 'event'); }
  };
  const finish = () => {
    if (!st || st.outcome === 'complete') return;
    st.outcome = 'complete';
    s.outcome = buildOutcome(st, s.log);
    s.phase = 'debrief';
    for (const m of s.members) m.claim = null;
  };

  if (a.type === 'join') {
    if (s.members.some((m) => m.id === a.id)) return fail('Already in this crew.');
    if (s.members.length >= MAX_CREW) return fail('This crew is full. A ship holds six.');
    if (s.phase !== 'lobby' && !a.bot) return fail('This crew has already left the dock.');
    const taken = s.members.map((m) => m.role);
    s.members.push({ id: a.id, name: a.name, role: ROLES.find((r) => !taken.includes(r)) ?? null, ready: !!a.bot, connected: true, bot: !!a.bot, x: 0, z: 0, room: 'galley', claim: null });
    return done();
  }
  if (!me) return fail('Not in this crew.');
  const host = s.hostId === me.id;

  switch (a.type) {
    case 'leave':
      releaseMember(s, me.id);
      me.connected = false; me.ready = false;
      if (s.phase === 'lobby') s.members = s.members.filter((m) => m.id !== me.id);
      // The crew keeps a host: the next connected player takes over.
      if (host) { const next = s.members.find((m) => m.connected && !m.bot); if (next) s.hostId = next.id; else s.phase = 'ended'; }
      if (s.phase !== 'lobby' && s.phase !== 'ended') log(me.name, null, `${me.name} left. Their task and anything they carried went back.`, 'event');
      return done();
    case 'rejoin':
      me.connected = true;
      return done(`Welcome back, ${me.name}.`);
    case 'role': {
      const holder = s.members.find((m) => m.role === a.role && m.id !== me.id);
      if (holder && !holder.bot) return fail(`${holder.name} is the ${a.role}. Ask them to hand it over.`);
      if (holder) holder.role = me.role;
      me.role = a.role;
      return done();
    }
    case 'handoff': {
      const to = s.members.find((m) => m.id === a.to);
      if (!to) return fail('That cadet is not in this crew.');
      [me.role, to.role] = [to.role, me.role];
      if (st) log(me.name, me.room, `${me.name} and ${to.name} swapped stations.`, 'event');
      return done();
    }
    case 'ready': me.ready = a.ready; return done();
    case 'setup':
      if (!host) return fail('Only the host chooses the mission.');
      if (s.phase !== 'lobby' && s.phase !== 'debrief') return fail('Finish this mission first.');
      s.incident = a.incident; s.tier = a.tier;
      if (s.phase === 'debrief') { s.phase = 'lobby'; s.state = null; s.outcome = null; s.original = null; s.replay = false; s.log = []; for (const m of s.members) m.ready = m.bot; }
      return done();
    case 'start': {
      if (!host) return fail('Only the host can start.');
      if (s.phase !== 'lobby') return fail('Already started.');
      const humans = s.members.filter((m) => !m.bot && m.connected);
      if (!s.solo && humans.length < 2) return fail('A crew needs at least two cadets. Share the join code, or use Solo Training.');
      if (humans.some((m) => !m.ready && m.id !== me.id)) return fail('Not everyone is ready yet.');
      s.state = freshState(s); s.checkpoint = clone(s.state); s.log = []; s.outcome = null; s.phase = 'briefing';
      return done();
    }
    case 'briefed':
      if (s.phase !== 'briefing') return fail('No briefing is running.');
      if (!host) return fail('The host hands over control.');
      s.phase = 'active';
      log('Commander Reyes', null, `${INCIDENT_BY_ID[s.incident].title}: the crew has the ship.`, 'event');
      return done();
    case 'call':
      if (!CREW_CALLS.includes(a.text)) return fail('Use one of the crew calls.');
      log(me.name, me.room, `${me.name} (${ROOM_BY_ID[me.room].name}): ${a.text}`, 'call');
      return done();
    case 'end':
      if (!host) return fail('Only the host can end the session.');
      if (st && st.outcome === 'active' && s.phase === 'active') { finish(); return done('Session ended by the host.'); }
      s.phase = 'ended';
      return done('Session ended by the host.');
    case 'replay': {
      if (!host) return fail('Only the host starts a replay.');
      if (s.phase !== 'debrief' || !s.checkpoint || !s.outcome) return fail('Finish a mission first.');
      // Keep the completed first run. The replay is practice from the same checkpoint.
      if (!s.replay) { s.original = s.outcome; s.originalLog = s.log; }
      s.state = clone(s.checkpoint); s.log = []; s.outcome = null; s.replay = true; s.phase = 'active';
      log('Commander Reyes', null, 'Crew Replay: same ship, same supplies, same order of events. Change one decision.', 'event');
      return done();
    }
    default: break;
  }

  if (!st || s.phase !== 'active' || st.outcome !== 'active') return fail('No mission is running.');
  const tasks = liveTasks(st);

  switch (a.type) {
    case 'claim': {
      const t = tasks.find((x) => x.key === a.key);
      if (!t) return fail('That station is not part of this mission.');
      if (t.done && st.incident !== 'tour') return fail('That task is already done.');
      if (!t.available) return fail('That station is not ready yet. Another task comes first.');
      const other = s.members.find((m) => m.claim === a.key && m.id !== me.id);
      if (other) return fail(`${other.name} is already working on that.`);
      me.claim = a.key;
      return done();
    }
    case 'release': me.claim = null; return done();
    case 'pickup': {
      const it = st.items[a.item];
      if (!it) return fail('That is not on the ship.');
      if (it.at === 'used') return fail('That has already been installed.');
      if (it.holder) return fail(it.holder === me.id ? 'You are already carrying it.' : `${s.members.find((m) => m.id === it.holder)?.name ?? 'Someone'} already has the ${ITEM_LABEL[a.item]}.`);
      if (Object.values(st.items).some((x) => x && x.holder === me.id)) return fail('Your hands are full.');
      if (it.at !== me.room) return fail(`The ${ITEM_LABEL[a.item]} is in the ${ROOM_BY_ID[it.at as RoomId].name}.`);
      it.at = 'held'; it.holder = me.id;
      log(me.name, me.room, `${me.name} picked up the ${ITEM_LABEL[a.item]}.`, 'task');
      return done(`You have the ${ITEM_LABEL[a.item]}. Everyone can see who is carrying it.`);
    }
    case 'deliver': {
      const entry = Object.entries(st.items).find(([, it]) => it && it.holder === me.id) as [ItemId, ShipItem] | undefined;
      if (!entry) return fail('You are not carrying anything.');
      const text = deliverRule(st, entry[0], me.room);
      if (!text) return fail(`The ${ITEM_LABEL[entry[0]]} is not needed in the ${ROOM_BY_ID[me.room].name}.`);
      entry[1].at = 'used'; entry[1].holder = null;
      log(me.name, me.room, `${me.name}: ${text}`, 'task');
      tick(1);
      if (st.outcome === 'active' && isComplete(st)) finish();
      return done(text);
    }
    case 'endShift':
      if (me.room !== 'bridge') return fail('The shift change is called from the Bridge.');
      log(me.name, 'bridge', `${me.name} called the shift change.`, 'event');
      endShift();
      return done('Shift change called.');
    case 'answer': {
      const t = tasks.find((x) => x.key === a.key);
      if (!t) return fail('That station is not part of this mission.');
      if (t.done && st.incident !== 'tour') return fail('That task is already done.');
      if (!t.available) return fail('That station is not ready yet. Another task comes first.');
      const other = s.members.find((m) => m.claim === a.key && m.id !== me.id);
      if (other) return fail(`${other.name} is already working on that.`);
      const spec = t.spec;
      let right = false;
      let why = '';
      let choice: string | null = null;
      if (spec.kind === 'pick') {
        const opt = spec.options?.find((o) => o.id === a.value);
        if (!opt) return fail('Choose one of the options.');
        right = t.tradeoff || !!opt.correct; why = opt.why; choice = opt.id;
      } else if (spec.kind === 'order') {
        const seq = Array.isArray(a.value) ? (a.value as unknown[]).map(String) : [];
        const wrongAt = (spec.steps ?? []).findIndex((step, i) => seq[i] !== step);
        right = wrongAt < 0 && seq.length === (spec.steps ?? []).length;
        why = right ? 'Every step in the right order.' : `Step ${wrongAt + 1} should be: ${(spec.steps ?? [])[Math.max(0, wrongAt)]}.`;
      } else if (spec.kind === 'count') {
        right = Number(a.value) === spec.answer;
        why = right ? 'Counted right.' : Number(a.value) > (spec.answer ?? 0) ? 'That is more than one pack each. Keep the rest in reserve.' : 'That is not enough for one pack each.';
      } else if (spec.kind === 'dial') {
        const d = spec.dial as NonNullable<TaskSpec['dial']>;
        if (st.incident === 'docking' && t.key === 't02' && !st.flags.thruster) return fail('The backup thruster is not online yet. Engineering has to test it in the Propulsion Bay first.');
        right = Math.abs(Number(a.value) - d.target) <= d.tol;
        why = right ? `Held within ${d.tol}${d.unit} of the target.` : `Off by ${Math.abs(Number(a.value) - d.target)}${d.unit}. It must be within ${d.tol}${d.unit}.`;
      } else {
        const it = spec.item ? st.items[spec.item] : undefined;
        if (!it || it.holder !== me.id) return fail(`You need the ${ITEM_LABEL[spec.item as ItemId]} in your hands. ${it && it.at !== 'used' && it.at !== 'held' ? `It is in the ${ROOM_BY_ID[it.at].name}.` : it?.holder ? 'Another cadet is carrying it.' : ''}`.trim());
        it.at = 'used'; it.holder = null; right = true; why = `The ${ITEM_LABEL[spec.item as ItemId]} is installed. Nobody else can use it now.`;
      }
      me.claim = null;
      if (!right) {
        st.misses += 1;
        log(me.name, spec.room, `${me.name} tried "${spec.title}" and has to try again.`, 'miss');
        tick(1);
        s.applied.push(a.aid); s.seq += 1;
        return { session: s, ok: false, error: `${why} Try again: it cost one clock step.` };
      }
      if (!st.done.includes(t.key)) st.done.push(t.key);
      if (spec.id === 't11' && t.key === 't11') { st.items.meal_crate = { at: 'held', holder: me.id, home: 'cargo' }; }
      onTaskDone(st, t.key, choice);
      log(me.name, spec.room, `${me.name} · ${spec.title}${choice && t.tradeoff ? `: ${spec.options?.find((o) => o.id === choice)?.label}` : ''}. ${spec.effect}`, t.tradeoff ? 'choice' : 'task');
      tick(spec.time);
      if (st.outcome === 'active' && isComplete(st)) finish();
      return done(`${why} ${spec.effect}`, true);
    }
    default: return fail('Unknown action.');
  }
}

/** Solo training: one scripted crew member does one job that belongs to their station, so the cadet is never stuck waiting. */
export function botTurn(s: CrewSession, n: number): CrewResult | null {
  if (!s.solo || s.phase !== 'active' || !s.state) return null;
  const human = s.members.find((m) => !m.bot);
  for (const t of liveTasks(s.state)) {
    if (t.done || !t.available || t.optional || t.tradeoff || t.spec.kind === 'carry' || t.spec.id === 't11') continue;
    const bot = s.members.find((m) => m.bot && m.role === t.spec.role);
    if (!bot || t.spec.role === human?.role) continue;
    const value = t.spec.kind === 'pick' ? t.spec.options?.find((o) => o.correct)?.id : t.spec.kind === 'order' ? t.spec.steps : t.spec.kind === 'count' ? t.spec.answer : t.spec.dial?.target;
    const moved = reduceCrew(s, { type: 'move', by: bot.id, x: 0, z: 0, room: t.spec.room }).session;
    return reduceCrew(moved, { type: 'answer', aid: `bot-${n}-${t.key}`, by: bot.id, key: t.key, value });
  }
  return null;
}

/** Crew Replay: which room changed first, and what that did downstream. */
export function compareCrew(original: Outcome, originalLog: LogEntry[], replay: Outcome, replayLog: LogEntry[]): { same: boolean; firstRoom: RoomId | null; firstChange: string; rows: { label: string; first: number; replay: number; delta: number }[] } {
  // Mistakes are not decisions: only finished tasks and choices are compared.
  const acts = (l: LogEntry[]) => l.filter((e) => e.kind === 'task' || e.kind === 'choice');
  const A = acts(originalLog);
  const B = acts(replayLog);
  const i = B.findIndex((e, k) => !A[k] || A[k].text.replace(/^[^·:]+[·:]/, '') !== e.text.replace(/^[^·:]+[·:]/, ''));
  const diff = i >= 0 ? B[i] : A.length > B.length ? A[B.length] : null;
  const names: Record<keyof Res, string> = { meals: 'Meal packs', fuel: 'Fuel', power: 'Reserve power', water: 'Clean water', air: 'Air quality', crops: 'Crop trays', readiness: 'Crew readiness' };
  return {
    same: !diff,
    firstRoom: diff?.room ?? null,
    firstChange: diff ? diff.text : 'The crew made the same moves in the same order.',
    rows: (Object.keys(names) as (keyof Res)[]).map((k) => ({ label: names[k], first: original.res[k], replay: replay.res[k], delta: replay.res[k] - original.res[k] })),
  };
}
