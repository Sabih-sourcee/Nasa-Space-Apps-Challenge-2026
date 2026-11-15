// Deterministic vehicle models: shuttle ascent, station docking and the two
// landers. All speeds, fuel budgets and tolerances are simplified training
// values (compressed time, illustrative units), not real vehicle data.

import { clamp, type Tier } from './types';

export interface FlightInput {
  steerX: number;
  steerY: number;
  thrust: boolean;
  brake: boolean;
  /** One-shot action key (parachute deploy / release). */
  action?: boolean;
}

export const NO_INPUT: FlightInput = { steerX: 0, steerY: 0, thrust: false, brake: false, action: false };

// ---------------------------------------------------------------------------
// Shuttle ascent
// ---------------------------------------------------------------------------

/** Low Earth orbit speed is about 7.8 km/s. */
export const ORBIT_SPEED = 7.8;
export const ORBIT_ALTITUDE = 250;
export const ASCENT_GATES = [0.12, 0.26, 0.42, 0.58, 0.74, 0.9];
const ASCENT_ACCEL = 0.17; // km/s^2 at full throttle (compressed: about 46 s to orbit)
const OFF_COURSE_RADIUS = 2.6;

export interface AscentTuning {
  gateTol: number;
  missesAllowed: number;
  fuel: number;
  offCourseSeconds: number;
  band: [number, number];
}

export const ASCENT_TUNING: Record<Tier, AscentTuning> = {
  junior: { gateTol: 1.1, missesAllowed: 3, fuel: 80, offCourseSeconds: 8, band: [7.55, 8.15] },
  middle: { gateTol: 0.85, missesAllowed: 2, fuel: 66, offCourseSeconds: 6, band: [7.65, 8.0] },
  advanced: { gateTol: 0.65, missesAllowed: 1, fuel: 58, offCourseSeconds: 4.5, band: [7.7, 7.95] },
};

export type AscentReset = '' | 'corridor' | 'gates' | 'fuel';

export interface AscentState {
  t: number;
  speed: number;
  altitude: number;
  throttle: number;
  fuel: number;
  dx: number; dy: number; vdx: number; vdy: number;
  nextGate: number;
  gatesHit: number;
  gatesMissed: number;
  lastGate: 'none' | 'hit' | 'miss';
  deviationFired: boolean;
  deviationTimer: number;
  offCourseTime: number;
  stableTime: number;
  status: 'flying' | 'orbit' | 'reset';
  resetReason: AscentReset;
}

export function makeAscent(tier: Tier): AscentState {
  return {
    t: 0, speed: 0, altitude: 0, throttle: 0, fuel: ASCENT_TUNING[tier].fuel,
    dx: 0, dy: 0, vdx: 0, vdy: 0,
    nextGate: 0, gatesHit: 0, gatesMissed: 0, lastGate: 'none',
    deviationFired: false, deviationTimer: 0, offCourseTime: 0, stableTime: 0,
    status: 'flying', resetReason: '',
  };
}

export function ascentDeviation(s: AscentState): number {
  return Math.hypot(s.dx, s.dy);
}

export function stepAscent(prev: AscentState, input: FlightInput, dt: number, tier: Tier): AscentState {
  if (prev.status !== 'flying') return prev;
  const tune = ASCENT_TUNING[tier];
  const s = { ...prev };
  s.t += dt;

  // Throttle is a lever: it stays where you leave it.
  if (input.thrust && s.fuel > 0) s.throttle = Math.min(1, s.throttle + 0.9 * dt);
  if (input.brake) s.throttle = Math.max(0, s.throttle - 1.4 * dt);
  if (s.fuel <= 0) s.throttle = 0;

  s.speed += s.throttle * ASCENT_ACCEL * dt;
  // Braking thrusters trim an overshoot. They stop helping once the speed is back near the band floor.
  if (input.brake && s.throttle === 0 && s.speed > tune.band[0] + 0.05) s.speed = Math.max(tune.band[0] + 0.05, s.speed - 0.12 * dt);
  s.fuel = Math.max(0, s.fuel - s.throttle * dt);

  const p = Math.min(1, s.speed / ORBIT_SPEED);
  s.altitude = ORBIT_ALTITUDE * (1 - (1 - p) * (1 - p));

  // Steering changes the cross-track rate.
  const k = Math.min(1, 5 * dt);
  s.vdx += (clamp(input.steerX, -1, 1) * 1.15 - s.vdx) * k;
  s.vdy += (clamp(input.steerY, -1, 1) * 1.15 - s.vdy) * k;
  const climbing = s.throttle > 0.05 ? 1 : 0;
  s.dx += (s.vdx + 0.07 * climbing) * dt; // steady high-altitude wind

  // Authored emergency: guidance deviation once the craft passes a third of orbital speed.
  if (!s.deviationFired && p >= 0.33) {
    s.deviationFired = true;
    s.deviationTimer = 1.6;
  }
  if (s.deviationTimer > 0) {
    const step = Math.min(dt, s.deviationTimer);
    s.dx += 1.0 * step;
    s.dy -= 0.55 * step;
    s.deviationTimer = Math.max(0, s.deviationTimer - dt);
  }
  s.dy += s.vdy * dt;
  s.dx = clamp(s.dx, -4, 4);
  s.dy = clamp(s.dy, -4, 4);
  const d = Math.hypot(s.dx, s.dy);

  while (s.nextGate < ASCENT_GATES.length && p >= ASCENT_GATES[s.nextGate]) {
    if (d <= tune.gateTol) { s.gatesHit += 1; s.lastGate = 'hit'; }
    else { s.gatesMissed += 1; s.lastGate = 'miss'; }
    s.nextGate += 1;
  }
  if (s.gatesMissed > tune.missesAllowed) { s.status = 'reset'; s.resetReason = 'gates'; return s; }

  s.offCourseTime = d > OFF_COURSE_RADIUS ? s.offCourseTime + dt : 0;
  if (s.offCourseTime > tune.offCourseSeconds) { s.status = 'reset'; s.resetReason = 'corridor'; return s; }

  const inBand = s.speed >= tune.band[0] && s.speed <= tune.band[1];
  s.stableTime = inBand && s.throttle === 0 ? s.stableTime + dt : 0;
  if (s.stableTime >= 1.5) { s.status = 'orbit'; return s; }
  if (s.fuel <= 0 && s.speed < tune.band[0]) { s.status = 'reset'; s.resetReason = 'fuel'; }
  return s;
}

/** Scripted pilot used by tests to prove each tier has a successful flight. */
export function ascentAutopilot(s: AscentState, tier: Tier): FlightInput {
  const band = ASCENT_TUNING[tier].band;
  const cutoff = band[0] + 0.03;
  return {
    steerX: clamp(-s.dx * 2.5, -1, 1),
    steerY: clamp(-s.dy * 2.5, -1, 1),
    thrust: s.speed < cutoff && s.stableTime === 0,
    brake: s.speed >= cutoff && s.throttle > 0,
  };
}

// ---------------------------------------------------------------------------
// Docking
// ---------------------------------------------------------------------------

export interface DockTuning {
  alignTol: number;
  maxClosing: number;
  /** 0 = pure drift (momentum is kept), higher = more automatic damping. */
  damping: number;
  thruster: number;
}

export const DOCK_TUNING: Record<Tier, DockTuning> = {
  junior: { alignTol: 0.9, maxClosing: 0.6, damping: 1.6, thruster: 0.9 },
  middle: { alignTol: 0.65, maxClosing: 0.45, damping: 0.5, thruster: 0.6 },
  advanced: { alignTol: 0.45, maxClosing: 0.35, damping: 0, thruster: 0.45 },
};

export const DOCK_START_RANGE = 40;
export const DOCK_RETRY_RANGE = 25;

export interface DockState {
  t: number;
  range: number;
  closing: number;
  x: number; y: number; vx: number; vy: number;
  attempts: number;
  status: 'approach' | 'docked' | 'aborted';
  abortReason: '' | 'speed' | 'alignment';
}

export function makeDock(): DockState {
  return { t: 0, range: DOCK_START_RANGE, closing: 0.25, x: 2.6, y: -1.6, vx: 0, vy: 0, attempts: 1, status: 'approach', abortReason: '' };
}

export function stepDock(prev: DockState, input: FlightInput, dt: number, tier: Tier): DockState {
  if (prev.status !== 'approach') return prev;
  const tune = DOCK_TUNING[tier];
  const s = { ...prev };
  s.t += dt;

  s.vx += clamp(input.steerX, -1, 1) * tune.thruster * dt;
  s.vy += clamp(input.steerY, -1, 1) * tune.thruster * dt;
  if (tune.damping > 0) {
    const f = Math.max(0, 1 - tune.damping * dt);
    if (Math.abs(input.steerX) < 0.1) s.vx *= f;
    if (Math.abs(input.steerY) < 0.1) s.vy *= f;
  }
  s.vx = clamp(s.vx, -1.2, 1.2);
  s.vy = clamp(s.vy, -1.2, 1.2);
  s.x = clamp(s.x + s.vx * dt, -6, 6);
  s.y = clamp(s.y + s.vy * dt, -6, 6);

  if (input.thrust) s.closing += 0.3 * dt;
  if (input.brake) s.closing -= 0.45 * dt;
  s.closing = clamp(s.closing, -0.6, 1.6);
  s.range = Math.min(DOCK_START_RANGE + 10, s.range - s.closing * dt);

  if (s.range <= 0) {
    s.range = 0;
    const aligned = Math.hypot(s.x, s.y) <= tune.alignTol;
    const gentle = s.closing <= tune.maxClosing;
    if (aligned && gentle) {
      s.status = 'docked';
      s.closing = 0; s.vx = 0; s.vy = 0;
    } else {
      s.status = 'aborted';
      s.abortReason = !gentle ? 'speed' : 'alignment';
    }
  }
  return s;
}

/** Recovery after a poor approach: the craft backs away and holds for another try. */
export function retryDock(prev: DockState): DockState {
  return {
    ...prev,
    range: DOCK_RETRY_RANGE, closing: 0.2,
    x: clamp(prev.x * 0.6, -3, 3), y: clamp(prev.y * 0.6, -3, 3), vx: 0, vy: 0,
    attempts: prev.attempts + 1, status: 'approach', abortReason: '',
  };
}

export function dockAutopilot(s: DockState, tier: Tier): FlightInput {
  const tune = DOCK_TUNING[tier];
  const want = (pos: number, vel: number) => clamp((-pos * 0.5 - vel) * 4, -1, 1);
  const targetClosing = s.range > 8 ? 0.8 : tune.maxClosing * 0.6;
  return {
    steerX: want(s.x, s.vx),
    steerY: want(s.y, s.vy),
    thrust: s.closing < targetClosing - 0.05,
    brake: s.closing > targetClosing + 0.05,
  };
}

// ---------------------------------------------------------------------------
// Landers. The Moon has no air: only engines slow the craft. Mars has thin air:
// a parachute helps, but engines must finish the job.
// ---------------------------------------------------------------------------

export type LanderWorld = 'moon' | 'mars';

export interface LandingZone { id: string; label: string; x: number; z: number; radius: number; primary: boolean }

export interface LanderConfig {
  world: LanderWorld;
  gravity: number;
  thrustAccel: number;
  lateralAccel: number;
  fuel: number;
  safeVy: number;
  safeVh: number;
  zones: LandingZone[];
  /** Automatic sideways damping (Junior hover assist). */
  assist: number;
  start: { x: number; z: number; alt: number; vx: number; vz: number; vy: number };
  // Atmosphere (Mars only)
  atmosphere: boolean;
  dragFree: number;
  dragChute: number;
  windX: number;
  chuteMaxSpeed: number;
  chuteReleaseAlt: number;
}

export function landerConfig(world: LanderWorld, tier: Tier): LanderConfig {
  const t = { junior: 0, middle: 1, advanced: 2 }[tier];
  if (world === 'moon') {
    return {
      world, gravity: 1.62, thrustAccel: 4.2, lateralAccel: 2.2,
      fuel: [70, 48, 38][t], safeVy: [3.5, 2.6, 2.0][t], safeVh: [2.6, 2.0, 1.5][t],
      zones: [{ id: 'pad', label: 'Landing zone', x: 0, z: 0, radius: [15, 11, 8][t], primary: true }],
      assist: [1.2, 0, 0][t],
      start: { x: 30, z: 24, alt: 150, vx: -2.5, vz: -1.2, vy: -7 },
      atmosphere: false, dragFree: 0, dragChute: 0, windX: 0, chuteMaxSpeed: 0, chuteReleaseAlt: 0,
    };
  }
  return {
    world, gravity: 3.71, thrustAccel: 8.2, lateralAccel: 3.2,
    fuel: [34, 26, 21][t], safeVy: [4.0, 3.0, 2.4][t], safeVh: [3.0, 2.4, 1.8][t],
    zones: [
      { id: 'pad', label: 'Primary zone', x: 0, z: 0, radius: [15, 11, 8][t], primary: true },
      { id: 'alt', label: 'Alternate zone', x: 46, z: 14, radius: [13, 11, 9][t], primary: false },
    ],
    assist: [1.0, 0, 0][t],
    start: { x: -52, z: 22, alt: 1000, vx: 0, vz: 0, vy: -80 },
    atmosphere: true,
    dragFree: 3.71 / (55 * 55), // terminal speed about 55 m/s on the heat shield
    dragChute: 3.71 / (20 * 20), // about 20 m/s under the parachute
    windX: [2.0, 2.8, 3.6][t],
    chuteMaxSpeed: 70,
    chuteReleaseAlt: 280,
  };
}

export type LanderAbort = '' | 'too_fast' | 'sideways' | 'outside_zone' | 'chute_on_touchdown';

export interface LanderState {
  t: number;
  x: number; z: number; alt: number;
  vx: number; vz: number; vy: number;
  fuel: number;
  thrusting: boolean;
  chute: 'none' | 'stowed' | 'deployed' | 'released';
  status: 'descending' | 'landed' | 'aborted';
  abortReason: LanderAbort;
  zoneId: string;
  touchdownVy: number;
  touchdownVh: number;
}

export function makeLander(cfg: LanderConfig): LanderState {
  return {
    t: 0, ...cfg.start, fuel: cfg.fuel, thrusting: false,
    chute: cfg.atmosphere ? 'stowed' : 'none',
    status: 'descending', abortReason: '', zoneId: '', touchdownVy: 0, touchdownVh: 0,
  };
}

export function chuteCanDeploy(s: LanderState, cfg: LanderConfig): boolean {
  return cfg.atmosphere && s.chute === 'stowed' && Math.abs(s.vy) <= cfg.chuteMaxSpeed;
}

export function chuteCanRelease(s: LanderState, cfg: LanderConfig): boolean {
  return cfg.atmosphere && s.chute === 'deployed' && s.alt <= cfg.chuteReleaseAlt;
}

/** Engines are locked out until the parachute is released (Mars) so the lesson stays readable. */
export function enginesAvailable(s: LanderState, cfg: LanderConfig): boolean {
  return !cfg.atmosphere || s.chute === 'released';
}

export function nearestZone(cfg: LanderConfig, x: number, z: number): { zone: LandingZone; dist: number } {
  let best = { zone: cfg.zones[0], dist: Infinity };
  for (const zone of cfg.zones) {
    const dist = Math.hypot(x - zone.x, z - zone.z);
    if (dist - zone.radius < best.dist - best.zone.radius) best = { zone, dist };
  }
  return best;
}

export function stepLander(prev: LanderState, input: FlightInput, dt: number, cfg: LanderConfig): LanderState {
  if (prev.status !== 'descending') return prev;
  const s = { ...prev };
  s.t += dt;

  if (input.action) {
    if (chuteCanDeploy(s, cfg)) s.chute = 'deployed';
    else if (chuteCanRelease(s, cfg)) s.chute = 'released';
  }

  const engines = enginesAvailable(s, cfg) && s.fuel > 0;
  s.thrusting = engines && input.thrust;
  let ay = -cfg.gravity;
  let ax = 0;
  let az = 0;
  if (s.thrusting) { ay += cfg.thrustAccel; s.fuel = Math.max(0, s.fuel - dt); }

  const steerScale = cfg.atmosphere && s.chute === 'deployed' ? 0.25 : 1;
  const canSteer = cfg.atmosphere ? s.chute !== 'stowed' : true;
  if (canSteer && s.fuel > 0) {
    const sx = clamp(input.steerX, -1, 1);
    const sz = clamp(input.steerY, -1, 1);
    ax += sx * cfg.lateralAccel * steerScale;
    az += -sz * cfg.lateralAccel * steerScale; // "up" on the stick flies away from the camera (-z)
    if (sx !== 0 || sz !== 0) s.fuel = Math.max(0, s.fuel - dt * 0.15);
    if (cfg.assist > 0 && engines) {
      if (sx === 0) ax += -s.vx * cfg.assist;
      if (sz === 0) az += -s.vz * cfg.assist;
    }
  }

  if (cfg.atmosphere) {
    const c = s.chute === 'deployed' ? cfg.dragChute : cfg.dragFree;
    ay += clamp(-c * s.vy * Math.abs(s.vy), -30, 30);
    const k = s.chute === 'deployed' ? 0.7 : 0.12;
    ax += (cfg.windX - s.vx) * k;
    az += (0 - s.vz) * k;
  }

  s.vx += ax * dt;
  s.vz += az * dt;
  s.vy += ay * dt;
  s.vy = Math.min(s.vy, 6); // the training computer limits climb rate
  s.x += s.vx * dt;
  s.z += s.vz * dt;
  s.alt += s.vy * dt;
  s.alt = Math.min(s.alt, cfg.start.alt + 40);

  if (s.alt <= 0) {
    s.alt = 0;
    const vh = Math.hypot(s.vx, s.vz);
    s.touchdownVy = Math.abs(s.vy);
    s.touchdownVh = vh;
    const near = nearestZone(cfg, s.x, s.z);
    if (s.chute === 'deployed' || s.chute === 'stowed') { s.status = 'aborted'; s.abortReason = s.chute === 'deployed' ? 'chute_on_touchdown' : 'too_fast'; }
    else if (s.touchdownVy > cfg.safeVy) { s.status = 'aborted'; s.abortReason = 'too_fast'; }
    else if (vh > cfg.safeVh) { s.status = 'aborted'; s.abortReason = 'sideways'; }
    else if (near.dist > near.zone.radius) { s.status = 'aborted'; s.abortReason = 'outside_zone'; }
    else { s.status = 'landed'; s.zoneId = near.zone.id; }
    s.vx = 0; s.vz = 0; s.vy = 0; s.thrusting = false;
  }
  return s;
}

/** Scripted pilot used by tests to prove each tier and world has a safe landing. */
export function landerAutopilot(s: LanderState, cfg: LanderConfig, zoneId = 'pad'): FlightInput {
  const zone = cfg.zones.find((z) => z.id === zoneId) ?? cfg.zones[0];
  const action = chuteCanDeploy(s, cfg) || chuteCanRelease(s, cfg);
  const ex = zone.x - s.x;
  const ez = zone.z - s.z;
  const wantVx = clamp(ex * 0.35, -9, 9);
  const wantVz = clamp(ez * 0.35, -9, 9);
  const steerX = clamp((wantVx - s.vx) * 1.2, -1, 1);
  const steerZ = clamp((wantVz - s.vz) * 1.2, -1, 1);
  // Descend quickly while high, slow to a gentle rate near the ground.
  const wantVy = -Math.max(cfg.safeVy * 0.55, Math.min(30, s.alt * 0.22));
  return {
    steerX: Math.abs(steerX) < 0.15 ? 0 : steerX,
    steerY: Math.abs(steerZ) < 0.15 ? 0 : -steerZ,
    thrust: s.vy < wantVy,
    brake: false,
    action,
  };
}
