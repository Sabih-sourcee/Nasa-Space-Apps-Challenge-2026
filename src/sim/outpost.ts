// Deterministic outpost decision engine used by the Moon and Mars habitats.
//
// One decision turn is always processed in this order (SRS section 6):
//   input validation -> action cost -> world event -> resource effects
//   -> message delivery -> outcome
// Presentation code reads the resulting state. It never changes outcomes.

import { clamp, SCHEMA_VERSION, type DemoMissionId, type Tier } from './types';

export type ResKey = 'air' | 'battery' | 'crop' | 'protection' | 'science';
export const RES_KEYS: ResKey[] = ['air', 'battery', 'crop', 'protection', 'science'];

export const RES_BOUNDS: Record<ResKey, { min: number; max: number }> = {
  air: { min: 0, max: 100 },
  battery: { min: 0, max: 6 },
  crop: { min: 0, max: 4 },
  protection: { min: 0, max: 100 },
  science: { min: 0, max: 3 },
};

export const RES_LABEL: Record<ResKey, string> = {
  air: 'Air',
  battery: 'Battery',
  crop: 'Crops',
  protection: 'Crew protection',
  science: 'Science',
};

export type Resources = Record<ResKey, number>;
export type StationId = 'power' | 'air' | 'grow' | 'shelter' | 'comms';

export type Effect =
  | { kind: 'res'; res: ResKey; delta: number }
  | { kind: 'flag'; flag: string; value: boolean }
  | { kind: 'message'; id: string; from: string; text: string; delayTurns: number; setsFlag?: string };

export type Trigger =
  | { type: 'scheduled' }
  | { type: 'flag'; flag: string; value: boolean }
  | { type: 'below'; res: ResKey; value: number }
  | { type: 'atLeast'; res: ResKey; value: number };

export interface ActionSpec {
  id: string;
  label: string;
  detail: string;
  /** Energy cost in game units. Negative cost adds energy (backup cells). */
  cost: number;
  /** Actions that share a group are alternatives: exactly one must be chosen. */
  group?: string;
  /** Required every turn and pre-selected. */
  locked?: boolean;
  requiresFlag?: string;
  forbidsFlag?: string;
  effects: Effect[];
  /** One sentence used by the debrief and the replay comparison. */
  lesson?: string;
  /** If the turn ends in a critical outcome, this action is named as the cause. */
  blame?: boolean;
}

export interface EventSpec {
  id: string;
  /** 'start' events announce the turn. 'resolve' events fire after costs are paid. */
  phase: 'start' | 'resolve';
  trigger: Trigger;
  level: 'info' | 'caution' | 'alert';
  warning: string;
  symptom: string;
  effects: Effect[];
  debrief: string;
  sourceId?: string;
  highlight?: StationId;
}

export interface TurnSpec {
  id: string;
  title: string;
  station: StationId;
  narrative: string;
  income: number;
  incomeBonuses?: { flag: string; amount: number; note: string }[];
  actions: ActionSpec[];
  events: EventSpec[];
  hint?: string;
}

export interface CriticalRule { res: ResKey; below: number; explanation: string }

export interface ScenarioSpec {
  id: string;
  missionId: DemoMissionId;
  tier: Tier;
  world: 'moon' | 'mars';
  /** Primary meters shown on the HUD for this tier. */
  meters: ResKey[];
  start: Resources;
  startFlags: Record<string, boolean>;
  turns: TurnSpec[];
  critical: CriticalRule[];
  intro: string;
}

export interface PendingMessage { id: string; from: string; text: string; deliverAtTurn: number; setsFlag?: string }
export interface DeliveredMessage { id: string; from: string; text: string; deliveredAtTurn: number }

export interface TurnRecord {
  turnId: string;
  chosen: string[];
  income: number;
  spent: number;
  before: Resources;
  after: Resources;
  events: string[];
  delivered: string[];
}

export interface CriticalInfo { turn: number; causeAction: string; causeLabel: string; explanation: string }

export interface OutpostState {
  schemaVersion: number;
  scenarioId: string;
  /** Index of the decision turn waiting for input. Equals turns.length when finished. */
  turn: number;
  resources: Resources;
  flags: Record<string, boolean>;
  firedEvents: string[];
  pending: PendingMessage[];
  inbox: DeliveredMessage[];
  outcome: 'active' | 'success' | 'critical';
  critical: CriticalInfo | null;
  history: TurnRecord[];
}

export interface TurnReport {
  turnId: string;
  chosen: string[];
  income: number;
  spent: number;
  before: Resources;
  after: Resources;
  /** Events resolved by this turn, then the start events of the next turn. */
  events: EventSpec[];
  delivered: DeliveredMessage[];
  queued: PendingMessage[];
  outcome: OutpostState['outcome'];
}

export type ApplyResult =
  | { ok: true; state: OutpostState; report: TurnReport }
  | { ok: false; error: string; state: OutpostState };

export function cloneState(s: OutpostState): OutpostState {
  return JSON.parse(JSON.stringify(s)) as OutpostState;
}

function clampRes(res: ResKey, value: number): number {
  const b = RES_BOUNDS[res];
  return clamp(value, b.min, b.max);
}

function triggerFires(t: Trigger, s: OutpostState): boolean {
  switch (t.type) {
    case 'scheduled': return true;
    case 'flag': return !!s.flags[t.flag] === t.value;
    case 'below': return s.resources[t.res] < t.value;
    case 'atLeast': return s.resources[t.res] >= t.value;
  }
}

function applyEffects(s: OutpostState, effects: Effect[], turnIndex: number, queued: PendingMessage[]): void {
  for (const e of effects) {
    if (e.kind === 'res') {
      s.resources[e.res] = clampRes(e.res, s.resources[e.res] + e.delta);
    } else if (e.kind === 'flag') {
      s.flags[e.flag] = e.value;
    } else if (!s.pending.some((m) => m.id === e.id) && !s.inbox.some((m) => m.id === e.id)) {
      const msg: PendingMessage = { id: e.id, from: e.from, text: e.text, deliverAtTurn: turnIndex + e.delayTurns, setsFlag: e.setsFlag };
      s.pending.push(msg);
      queued.push(msg);
    }
  }
}

/** Fire the events of one phase. Each scripted event resolves once per checkpoint. */
function fireEvents(scn: ScenarioSpec, s: OutpostState, turnIndex: number, phase: EventSpec['phase'], queued: PendingMessage[]): EventSpec[] {
  const turn = scn.turns[turnIndex];
  if (!turn) return [];
  const fired: EventSpec[] = [];
  for (const ev of turn.events) {
    if (ev.phase !== phase) continue;
    const key = `${turn.id}:${ev.id}`;
    if (s.firedEvents.includes(key)) continue;
    if (!triggerFires(ev.trigger, s)) continue;
    s.firedEvents.push(key);
    fired.push(ev);
  }
  return fired;
}

export function initialState(scn: ScenarioSpec): { state: OutpostState; events: EventSpec[] } {
  const state: OutpostState = {
    schemaVersion: SCHEMA_VERSION,
    scenarioId: scn.id,
    turn: 0,
    resources: { ...scn.start },
    flags: { ...scn.startFlags },
    firedEvents: [],
    pending: [],
    inbox: [],
    outcome: 'active',
    critical: null,
    history: [],
  };
  for (const k of RES_KEYS) state.resources[k] = clampRes(k, state.resources[k]);
  const events = fireEvents(scn, state, 0, 'start', []);
  for (const ev of events) applyEffects(state, ev.effects, 0, []);
  return { state, events };
}

export function currentTurn(scn: ScenarioSpec, s: OutpostState): TurnSpec | null {
  return s.outcome === 'active' ? scn.turns[s.turn] ?? null : null;
}

export function turnIncome(turn: TurnSpec, s: OutpostState): { income: number; notes: string[] } {
  let income = turn.income;
  const notes: string[] = [];
  for (const b of turn.incomeBonuses ?? []) {
    if (s.flags[b.flag]) { income += b.amount; notes.push(b.note); }
  }
  return { income, notes };
}

export function actionVisible(a: ActionSpec, s: OutpostState): boolean {
  if (a.requiresFlag && !s.flags[a.requiresFlag]) return false;
  if (a.forbidsFlag && s.flags[a.forbidsFlag]) return false;
  return true;
}

export function turnActions(scn: ScenarioSpec, s: OutpostState): ActionSpec[] {
  const turn = currentTurn(scn, s);
  return turn ? turn.actions.filter((a) => actionVisible(a, s)) : [];
}

export interface Budget { income: number; reserve: number; available: number; spent: number; remaining: number; bonusNotes: string[] }

export function budgetFor(scn: ScenarioSpec, s: OutpostState, chosen: string[]): Budget {
  const turn = currentTurn(scn, s);
  if (!turn) return { income: 0, reserve: s.resources.battery, available: s.resources.battery, spent: 0, remaining: s.resources.battery, bonusNotes: [] };
  const { income, notes } = turnIncome(turn, s);
  const spent = turn.actions.filter((a) => chosen.includes(a.id)).reduce((sum, a) => sum + a.cost, 0);
  const available = s.resources.battery + income;
  return { income, reserve: s.resources.battery, available, spent, remaining: available - spent, bonusNotes: notes };
}

export function validateSelection(scn: ScenarioSpec, s: OutpostState, chosen: string[]): string | null {
  if (s.outcome !== 'active') return 'This mission has already finished.';
  const turn = scn.turns[s.turn];
  if (!turn) return 'There is no decision waiting.';
  const visible = turn.actions.filter((a) => actionVisible(a, s));
  if (new Set(chosen).size !== chosen.length) return 'An action was chosen twice.';
  for (const id of chosen) {
    if (!visible.some((a) => a.id === id)) return `"${id}" is not available right now.`;
  }
  for (const a of visible) {
    if (a.locked && !chosen.includes(a.id)) return `${a.label} must stay on.`;
  }
  const groups = new Map<string, number>();
  for (const a of visible) if (a.group) groups.set(a.group, 0);
  for (const a of visible) if (a.group && chosen.includes(a.id)) groups.set(a.group, (groups.get(a.group) ?? 0) + 1);
  for (const [group, count] of groups) {
    if (count !== 1) return `Choose exactly one option for ${group}.`;
  }
  const b = budgetFor(scn, s, chosen);
  if (b.remaining < 0) return `That plan needs ${b.spent} units but only ${b.available} are available.`;
  return null;
}

/** A sensible starting selection: locked actions plus the first affordable option of each group. */
export function defaultSelection(scn: ScenarioSpec, s: OutpostState, prefer: string[] = []): string[] {
  const actions = turnActions(scn, s);
  const chosen = actions.filter((a) => a.locked).map((a) => a.id);
  const groups = [...new Set(actions.filter((a) => a.group).map((a) => a.group as string))];
  for (const g of groups) {
    const options = actions.filter((a) => a.group === g);
    const preferred = options.find((a) => prefer.includes(a.id));
    chosen.push((preferred ?? options[0]).id);
  }
  for (const a of actions) if (!a.group && !a.locked && prefer.includes(a.id)) chosen.push(a.id);
  return chosen;
}

export function applyTurn(scn: ScenarioSpec, prev: OutpostState, chosen: string[]): ApplyResult {
  // 1. Input validation
  const error = validateSelection(scn, prev, chosen);
  if (error) return { ok: false, error, state: prev };

  const s = cloneState(prev);
  const turnIndex = s.turn;
  const turn = scn.turns[turnIndex];
  const before = { ...s.resources };
  const queued: PendingMessage[] = [];
  const actions = turn.actions.filter((a) => chosen.includes(a.id));

  // 2. Action cost
  const { income } = turnIncome(turn, s);
  const spent = actions.reduce((sum, a) => sum + a.cost, 0);
  s.resources.battery = clampRes('battery', s.resources.battery + income - spent);

  // 3. World event
  const resolved = fireEvents(scn, s, turnIndex, 'resolve', queued);

  // 4. Resource effects (chosen actions first, then events)
  for (const a of actions) applyEffects(s, a.effects, turnIndex, queued);
  for (const ev of resolved) applyEffects(s, ev.effects, turnIndex, queued);

  // 5. Message delivery
  const delivered: DeliveredMessage[] = [];
  const stillPending: PendingMessage[] = [];
  for (const m of s.pending) {
    if (m.deliverAtTurn <= turnIndex) {
      const d = { id: m.id, from: m.from, text: m.text, deliveredAtTurn: turnIndex };
      delivered.push(d);
      s.inbox.push(d);
      if (m.setsFlag) s.flags[m.setsFlag] = true;
    } else {
      stillPending.push(m);
    }
  }
  s.pending = stillPending;

  // 6. Outcome
  const events = [...resolved];
  const rule = scn.critical.find((c) => s.resources[c.res] < c.below);
  if (rule) {
    const cause = actions.find((a) => a.blame) ?? actions.find((a) => !a.locked) ?? actions[0];
    s.outcome = 'critical';
    s.critical = { turn: turnIndex, causeAction: cause?.id ?? '', causeLabel: cause?.label ?? turn.title, explanation: rule.explanation };
  } else if (turnIndex + 1 >= scn.turns.length) {
    s.outcome = 'success';
    s.turn = scn.turns.length;
  } else {
    s.turn = turnIndex + 1;
    const starts = fireEvents(scn, s, s.turn, 'start', queued);
    for (const ev of starts) applyEffects(s, ev.effects, s.turn, queued);
    events.push(...starts);
  }

  const record: TurnRecord = {
    turnId: turn.id, chosen: [...chosen], income, spent, before, after: { ...s.resources },
    events: events.map((e) => e.id), delivered: delivered.map((d) => d.id),
  };
  s.history.push(record);

  return {
    ok: true,
    state: s,
    report: { turnId: turn.id, chosen: [...chosen], income, spent, before, after: { ...s.resources }, events, delivered, queued, outcome: s.outcome },
  };
}

// ---------------------------------------------------------------------------
// Runs, checkpoints and Mission Replay
// ---------------------------------------------------------------------------

export interface OutpostRun {
  scenarioId: string;
  /** snapshots[i] is the full state restored when replaying decision turn i. */
  snapshots: OutpostState[];
  decisions: string[][];
  state: OutpostState;
}

export function startRun(scn: ScenarioSpec): OutpostRun {
  const { state } = initialState(scn);
  return { scenarioId: scn.id, snapshots: [cloneState(state)], decisions: [], state };
}

export function commitTurn(scn: ScenarioSpec, run: OutpostRun, chosen: string[]): { run: OutpostRun; result: ApplyResult } {
  const result = applyTurn(scn, run.state, chosen);
  if (!result.ok) return { run, result };
  const next: OutpostRun = {
    scenarioId: run.scenarioId,
    snapshots: [...run.snapshots],
    decisions: [...run.decisions, [...chosen]],
    state: result.state,
  };
  if (result.state.outcome === 'active') next.snapshots.push(cloneState(result.state));
  return { run: next, result };
}

/** Restore the checkpoint taken before decision turn `turnIndex`. */
export function restoreCheckpoint(run: OutpostRun, turnIndex: number): OutpostRun {
  const idx = clamp(turnIndex, 0, run.snapshots.length - 1);
  return {
    scenarioId: run.scenarioId,
    snapshots: run.snapshots.slice(0, idx + 1).map(cloneState),
    decisions: run.decisions.slice(0, idx).map((d) => [...d]),
    state: cloneState(run.snapshots[idx]),
  };
}

export function runScenario(scn: ScenarioSpec, decisions: string[][]): OutpostRun {
  let run = startRun(scn);
  for (const chosen of decisions) {
    if (run.state.outcome !== 'active') break;
    const step = commitTurn(scn, run, chosen);
    if (!step.result.ok) throw new Error(step.result.error);
    run = step.run;
  }
  return run;
}

/** Every valid selection for the current turn (used by tests to prove success paths exist). */
export function enumerateSelections(scn: ScenarioSpec, s: OutpostState): string[][] {
  const actions = turnActions(scn, s);
  const locked = actions.filter((a) => a.locked).map((a) => a.id);
  const groups = [...new Set(actions.filter((a) => a.group).map((a) => a.group as string))];
  const optional = actions.filter((a) => !a.group && !a.locked).map((a) => a.id);
  let combos: string[][] = [locked];
  for (const g of groups) {
    const options = actions.filter((a) => a.group === g).map((a) => a.id);
    combos = combos.flatMap((c) => options.map((o) => [...c, o]));
  }
  for (const o of optional) combos = combos.flatMap((c) => [c, [...c, o]]);
  return combos.filter((c) => validateSelection(scn, s, c) === null);
}

export interface CompareRow { res: ResKey; label: string; original: number; replay: number; delta: number }

export interface Comparison {
  changedTurn: number;
  changedTitle: string;
  originalChoice: string;
  replayChoice: string;
  /** Battery reserve at the next checkpoint after the changed decision. */
  reserveOriginal: number | null;
  reserveReplay: number | null;
  rows: CompareRow[];
  originalOutcome: OutpostState['outcome'];
  replayOutcome: OutpostState['outcome'];
  explanation: string;
}

function labelsFor(turn: TurnSpec, ids: string[]): string {
  const names = turn.actions.filter((a) => ids.includes(a.id) && !a.locked).map((a) => a.label);
  return names.length ? names.join(' + ') : 'No extra actions';
}

/** Battery reserve once decision turn `turnIndex` has resolved, i.e. at the next checkpoint. */
export function reserveAfter(run: OutpostRun, turnIndex: number): number | null {
  return run.state.history[turnIndex]?.after.battery ?? null;
}

export function compareRuns(scn: ScenarioSpec, original: OutpostRun, replay: OutpostRun): Comparison | null {
  const n = Math.max(original.decisions.length, replay.decisions.length);
  let changed = -1;
  for (let i = 0; i < n; i++) {
    const a = [...(original.decisions[i] ?? [])].sort().join('|');
    const b = [...(replay.decisions[i] ?? [])].sort().join('|');
    if (a !== b) { changed = i; break; }
  }
  if (changed < 0) return null;
  const turn = scn.turns[changed];
  const a = original.decisions[changed] ?? [];
  const b = replay.decisions[changed] ?? [];
  const reserveOriginal = reserveAfter(original, changed);
  const reserveReplay = reserveAfter(replay, changed);
  const rows: CompareRow[] = RES_KEYS.map((res) => ({
    res, label: RES_LABEL[res],
    original: original.state.resources[res], replay: replay.state.resources[res],
    delta: replay.state.resources[res] - original.state.resources[res],
  }));
  const lessonAction = turn.actions.find((x) => b.includes(x.id) && !a.includes(x.id) && x.lesson)
    ?? turn.actions.find((x) => a.includes(x.id) && !b.includes(x.id) && x.lesson);
  const parts: string[] = [];
  if (reserveOriginal !== null && reserveReplay !== null && reserveOriginal !== reserveReplay) {
    const d = reserveReplay - reserveOriginal;
    parts.push(`Changing "${turn.title}" left ${Math.abs(d)} ${Math.abs(d) === 1 ? 'unit' : 'units'} ${d > 0 ? 'more' : 'less'} in the battery at the next checkpoint (${reserveOriginal} then, ${reserveReplay} now).`);
  } else {
    parts.push(`You changed "${turn.title}".`);
  }
  if (lessonAction?.lesson) parts.push(lessonAction.lesson);
  return {
    changedTurn: changed, changedTitle: turn.title,
    originalChoice: labelsFor(turn, a), replayChoice: labelsFor(turn, b),
    reserveOriginal, reserveReplay, rows,
    originalOutcome: original.state.outcome, replayOutcome: replay.state.outcome,
    explanation: parts.join(' '),
  };
}
