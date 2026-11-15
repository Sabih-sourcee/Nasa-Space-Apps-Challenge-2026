// S04 Module Alert: a fictional station pressure leak. The player reads hatch
// gauges to find the leaking module, then chooses between sealing it at once
// and first rescuing an experiment with the robotic arm. Deterministic rules;
// all pressures, rates and reserves are illustrative training values.

import { clamp, type Tier } from './types';

export type ModuleId = 'lab' | 'crew' | 'storage';
export const MODULE_LABEL: Record<ModuleId, string> = { lab: 'Lab module', crew: 'Crew module', storage: 'Storage module' };
export const LEAKING: ModuleId = 'lab';

export interface Gauge {
  module: ModuleId;
  now: number;
  /** Reading one minute earlier, so the player can work out the trend. */
  before: number;
  sensor: 'ok' | 'frozen';
}

/** A module is leaking if its pressure is falling. A low but steady reading is not a leak. */
export function gaugeTrend(g: Gauge): 'falling' | 'steady' {
  return g.before - g.now > 0.15 ? 'falling' : 'steady';
}

/** Hatch gauge readings in kilopascals. Higher tiers make the lowest reading a red herring. */
export function gaugesFor(tier: Tier): Gauge[] {
  if (tier === 'junior') {
    return [
      { module: 'lab', now: 96.0, before: 99.5, sensor: 'ok' },
      { module: 'crew', now: 101.3, before: 101.3, sensor: 'ok' },
      { module: 'storage', now: 101.3, before: 101.3, sensor: 'ok' },
    ];
  }
  if (tier === 'middle') {
    return [
      { module: 'lab', now: 100.6, before: 101.3, sensor: 'ok' },
      { module: 'crew', now: 100.2, before: 100.2, sensor: 'ok' },
      { module: 'storage', now: 101.3, before: 101.3, sensor: 'ok' },
    ];
  }
  return [
    { module: 'lab', now: 100.6, before: 101.3, sensor: 'ok' },
    { module: 'crew', now: 100.2, before: 100.2, sensor: 'ok' },
    { module: 'storage', now: 97.0, before: 97.0, sensor: 'frozen' },
  ];
}

export interface AlertTuning {
  /** Air reserve lost per second while the leak is open (percent). */
  leakRate: number;
  wrongPenalty: number;
  critical: number;
  armMode: 'tip' | 'joints';
  gripTol: number;
}

export const ALERT_TUNING: Record<Tier, AlertTuning> = {
  // Junior is effectively untimed: the leak would take over twelve minutes to matter.
  junior: { leakRate: 0.08, wrongPenalty: 3, critical: 40, armMode: 'tip', gripTol: 0.5 },
  middle: { leakRate: 0.18, wrongPenalty: 6, critical: 40, armMode: 'joints', gripTol: 0.4 },
  advanced: { leakRate: 0.25, wrongPenalty: 8, critical: 40, armMode: 'joints', gripTol: 0.32 },
};

// ---------------------------------------------------------------------------
// Robotic arm: two links in a plane. Higher tiers steer it joint by joint (a game simplification).
// ---------------------------------------------------------------------------

export const ARM = {
  l1: 2.2,
  l2: 1.8,
  canister: { x: 2.7, y: 0.7 },
  port: { x: -2.1, y: 2.3 },
  jointRate: 0.85,
  tipSpeed: 1.3,
};

export const ARM_LIMITS = { shoulder: [0.1, Math.PI - 0.1] as const, elbow: [-2.7, -0.15] as const };

export interface ArmState {
  /** Shoulder angle from the +x axis, counter-clockwise, in radians. */
  shoulder: number;
  /** Elbow bend relative to the first link. */
  elbow: number;
}

export interface ArmInput { moveX: number; moveY: number }

export function makeArm(): ArmState {
  return { shoulder: Math.PI / 2, elbow: -1.2 };
}

export function armPoints(a: ArmState): { ex: number; ey: number; x: number; y: number } {
  const ex = Math.cos(a.shoulder) * ARM.l1;
  const ey = Math.sin(a.shoulder) * ARM.l1;
  return { ex, ey, x: ex + Math.cos(a.shoulder + a.elbow) * ARM.l2, y: ey + Math.sin(a.shoulder + a.elbow) * ARM.l2 };
}

/** Joint angles that put the gripper at (x, y), elbow bent the same way as the start pose. */
export function armSolve(x: number, y: number): ArmState {
  const minR = Math.abs(ARM.l1 - ARM.l2) + 0.15;
  const maxR = ARM.l1 + ARM.l2 - 0.05;
  let d = Math.hypot(x, y);
  if (d < 1e-6) { x = minR; y = 0; d = minR; }
  const r = clamp(d, minR, maxR);
  x = (x / d) * r;
  y = (y / d) * r;
  const cosE = clamp((r * r - ARM.l1 * ARM.l1 - ARM.l2 * ARM.l2) / (2 * ARM.l1 * ARM.l2), -1, 1);
  const elbow = -Math.acos(cosE);
  const shoulder = Math.atan2(y, x) - Math.atan2(ARM.l2 * Math.sin(elbow), ARM.l1 + ARM.l2 * Math.cos(elbow));
  return { shoulder, elbow };
}

export function stepArm(a: ArmState, input: ArmInput, dt: number, mode: AlertTuning['armMode']): ArmState {
  const mx = clamp(input.moveX, -1, 1);
  const my = clamp(input.moveY, -1, 1);
  if (mx === 0 && my === 0) return a;
  if (mode === 'tip') {
    // Junior: steer the gripper itself and let the computer work out the joints.
    const p = armPoints(a);
    const x = p.x + mx * ARM.tipSpeed * dt;
    const y = Math.max(0.25, p.y + my * ARM.tipSpeed * dt);
    return armSolve(x, y);
  }
  // Joint mode: left/right swings the shoulder, up/down bends the elbow.
  return {
    shoulder: clamp(a.shoulder - mx * ARM.jointRate * dt, ARM_LIMITS.shoulder[0], ARM_LIMITS.shoulder[1]),
    elbow: clamp(a.elbow + my * ARM.jointRate * dt, ARM_LIMITS.elbow[0], ARM_LIMITS.elbow[1]),
  };
}

/** Scripted operator used by tests to prove the arm task can be done in each mode. */
export function armAutopilot(a: ArmState, target: { x: number; y: number }, mode: AlertTuning['armMode']): ArmInput {
  if (mode === 'tip') {
    const p = armPoints(a);
    const dead = (v: number) => (Math.abs(v) < 0.05 ? 0 : clamp(v * 4, -1, 1));
    return { moveX: dead(target.x - p.x), moveY: dead(target.y - p.y) };
  }
  const want = armSolve(target.x, target.y);
  const dead = (v: number) => (Math.abs(v) < 0.012 ? 0 : clamp(v * 8, -1, 1));
  return { moveX: dead(a.shoulder - want.shoulder), moveY: dead(want.elbow - a.elbow) };
}

// ---------------------------------------------------------------------------
// Alert state
// ---------------------------------------------------------------------------

export type Plan = 'none' | 'seal_now' | 'save_first';
export type Experiment = 'in_lab' | 'gripped' | 'safe' | 'lost';

export interface AlertState {
  t: number;
  /** Station air reserve in percent. */
  reserve: number;
  labPressure: number;
  leakOpen: boolean;
  inspected: Record<ModuleId, boolean>;
  wrongCalls: number;
  diagnosed: boolean;
  plan: Plan;
  experiment: Experiment;
  arm: ArmState;
  status: 'active' | 'success' | 'critical';
}

export function makeAlert(tier: Tier): AlertState {
  return {
    t: 0, reserve: 100, labPressure: gaugesFor(tier)[0].now, leakOpen: true,
    inspected: { lab: false, crew: false, storage: false },
    wrongCalls: 0, diagnosed: false, plan: 'none', experiment: 'in_lab', arm: makeArm(), status: 'active',
  };
}

/** Advance the leak. Call only while the player is free to act (not while a panel is open). */
export function stepAlert(prev: AlertState, dt: number, tier: Tier): AlertState {
  if (prev.status !== 'active' || !prev.leakOpen) return prev;
  const tune = ALERT_TUNING[tier];
  const s = { ...prev };
  s.t += dt;
  s.reserve = Math.max(0, s.reserve - tune.leakRate * dt);
  s.labPressure = Math.max(60, s.labPressure - tune.leakRate * 0.06 * dt);
  if (s.reserve < tune.critical) s.status = 'critical';
  return s;
}

export function inspectGauge(s: AlertState, module: ModuleId): AlertState {
  return { ...s, inspected: { ...s.inspected, [module]: true } };
}

export interface CallResult { state: AlertState; correct: boolean; reason: string }

/** Name the leaking module. A wrong call seals a healthy module and wastes air while it is undone. */
export function declareLeak(s: AlertState, module: ModuleId, tier: Tier): CallResult {
  if (s.diagnosed || s.status !== 'active') return { state: s, correct: s.diagnosed, reason: '' };
  if (module === LEAKING) {
    return { state: { ...s, diagnosed: true }, correct: true, reason: 'The lab pressure is the one that keeps falling. That is the leak.' };
  }
  const tune = ALERT_TUNING[tier];
  const g = gaugesFor(tier).find((x) => x.module === module) as Gauge;
  const reserve = Math.max(0, s.reserve - tune.wrongPenalty);
  const reason = g.sensor === 'frozen'
    ? `The ${MODULE_LABEL[module].toLowerCase()} gauge is frozen: its sensor failed its self-test, and the number has not moved. A leak makes the pressure keep falling.`
    : g.now < 101
      ? `The ${MODULE_LABEL[module].toLowerCase()} reads a little low, but it is steady. A leak makes the pressure keep falling.`
      : `The ${MODULE_LABEL[module].toLowerCase()} pressure is normal and steady.`;
  return {
    state: { ...s, wrongCalls: s.wrongCalls + 1, reserve, status: reserve < tune.critical ? 'critical' : 'active' },
    correct: false,
    reason: `${reason} Sealing it did not stop the leak and cost ${tune.wrongPenalty}% of the air reserve.`,
  };
}

export function choosePlan(s: AlertState, plan: Exclude<Plan, 'none'>): AlertState {
  if (!s.diagnosed || s.plan !== 'none') return s;
  return { ...s, plan };
}

export type GripResult = 'gripped' | 'released' | 'too_far' | 'not_over_port' | 'none';

/** Close or open the gripper. It grips only at the canister and releases only at the transfer port. */
export function operateGripper(s: AlertState, tier: Tier): { state: AlertState; result: GripResult } {
  if (s.status !== 'active' || (s.experiment !== 'in_lab' && s.experiment !== 'gripped')) return { state: s, result: 'none' };
  const tol = ALERT_TUNING[tier].gripTol;
  const p = armPoints(s.arm);
  if (s.experiment === 'in_lab') {
    const d = Math.hypot(p.x - ARM.canister.x, p.y - ARM.canister.y);
    return d <= tol ? { state: { ...s, experiment: 'gripped' }, result: 'gripped' } : { state: s, result: 'too_far' };
  }
  const d = Math.hypot(p.x - ARM.port.x, p.y - ARM.port.y);
  return d <= tol ? { state: { ...s, experiment: 'safe' }, result: 'released' } : { state: s, result: 'not_over_port' };
}

/** Stop the rescue. The experiment stays in the lab. */
export function abandonExperiment(s: AlertState): AlertState {
  if (s.experiment === 'safe' || s.experiment === 'lost') return s;
  return { ...s, experiment: 'in_lab', plan: 'seal_now' };
}

/** Close the lab hatch. Whatever is still inside the lab is lost to the experiment record. */
export function sealLab(s: AlertState): AlertState {
  if (!s.diagnosed || s.status !== 'active' || !s.leakOpen) return s;
  return { ...s, leakOpen: false, status: 'success', experiment: s.experiment === 'safe' ? 'safe' : 'lost' };
}

export function canSeal(s: AlertState): boolean {
  return s.diagnosed && s.plan !== 'none' && s.leakOpen && s.status === 'active';
}
