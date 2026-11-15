// Deterministic movement models: surface walking with gravity presets, and
// microgravity push / drift / grab. Pure functions, fixed time step friendly.

import { clamp } from './types';

export type GravityId = 'earth' | 'moon' | 'mars';

export interface GravityPreset {
  id: GravityId;
  label: string;
  /** Surface gravity in m/s^2 (NASA planetary fact sheet). */
  g: number;
  /** Ratio to Earth from the NASA fact sheet ratio table. */
  ratio: number;
  walkSpeed: number;
  /** How quickly the astronaut reaches walking speed (m/s^2). Lower gravity = less grip. */
  accel: number;
  airControl: number;
}

/** Every preset uses the same jump push so airtime differences come from gravity alone. */
export const JUMP_SPEED = 2.9;

export const GRAVITY_PRESETS: Record<GravityId, GravityPreset> = {
  earth: { id: 'earth', label: 'Earth', g: 9.8, ratio: 1.0, walkSpeed: 3.4, accel: 20, airControl: 0.35 },
  mars: { id: 'mars', label: 'Mars', g: 3.71, ratio: 0.377, walkSpeed: 3.0, accel: 10, airControl: 0.25 },
  moon: { id: 'moon', label: 'Moon', g: 1.62, ratio: 0.166, walkSpeed: 2.7, accel: 6, airControl: 0.2 },
};

/** Ideal airtime of one jump on flat ground: t = 2 v0 / g. */
export function idealAirtime(preset: GravityPreset): number {
  return (2 * JUMP_SPEED) / preset.g;
}

export function idealJumpHeight(preset: GravityPreset): number {
  return (JUMP_SPEED * JUMP_SPEED) / (2 * preset.g);
}

export interface CircleCollider { x: number; z: number; r: number }
/** Solid block from the ground up to `top`. The walker can stand on it. */
export interface BoxCollider { minX: number; maxX: number; minZ: number; maxZ: number; top: number }
export interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number }

export interface WalkEnv {
  preset: GravityPreset;
  ground: (x: number, z: number) => number;
  circles: CircleCollider[];
  boxes: BoxCollider[];
  bounds: Bounds;
  radius: number;
}

export interface WalkerState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Facing angle. Forward vector is (sin h, cos h) on the x/z plane. */
  heading: number;
  grounded: boolean;
  airtime: number;
  lastAirtime: number;
  jumps: number;
  distance: number;
}

export interface WalkInput { moveX: number; moveZ: number; jump: boolean }

export function makeWalker(x: number, z: number, heading = Math.PI, ground = 0): WalkerState {
  return { x, y: ground, z, vx: 0, vy: 0, vz: 0, heading, grounded: true, airtime: 0, lastAirtime: 0, jumps: 0, distance: 0 };
}

function floorAt(env: WalkEnv, x: number, z: number, y: number): number {
  let h = env.ground(x, z);
  for (const b of env.boxes) {
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && y >= b.top - 0.03) {
      h = Math.max(h, b.top);
    }
  }
  return h;
}

export function stepWalker(s: WalkerState, input: WalkInput, dt: number, env: WalkEnv): WalkerState {
  const p = env.preset;
  let { x, y, z, vx, vy, vz, heading, grounded, airtime, lastAirtime, jumps, distance } = s;

  let mx = clamp(input.moveX, -1, 1);
  let mz = clamp(input.moveZ, -1, 1);
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }

  const control = grounded ? 1 : p.airControl;
  const maxDv = p.accel * control * dt;
  vx += clamp(mx * p.walkSpeed - vx, -maxDv, maxDv);
  vz += clamp(mz * p.walkSpeed - vz, -maxDv, maxDv);
  if (len > 0.2) heading = Math.atan2(mx, mz);

  if (grounded && input.jump) {
    vy = JUMP_SPEED;
    grounded = false;
    airtime = 0;
    jumps += 1;
  }
  if (!grounded) vy -= p.g * dt;

  const px = x;
  const pz = z;
  x += vx * dt;
  z += vz * dt;

  // Round obstacles: push out.
  for (const c of env.circles) {
    const dx = x - c.x;
    const dz = z - c.z;
    const min = c.r + env.radius;
    const d = Math.hypot(dx, dz);
    if (d < min && d > 1e-6) {
      x = c.x + (dx / d) * min;
      z = c.z + (dz / d) * min;
    }
  }
  // Blocks: solid below the top, walkable above it.
  for (const b of env.boxes) {
    if (y >= b.top - 0.03) continue;
    const r = env.radius;
    if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) {
      const pushes = [
        { d: x - (b.minX - r), ax: 'x', to: b.minX - r },
        { d: b.maxX + r - x, ax: 'x', to: b.maxX + r },
        { d: z - (b.minZ - r), ax: 'z', to: b.minZ - r },
        { d: b.maxZ + r - z, ax: 'z', to: b.maxZ + r },
      ].sort((a, c) => a.d - c.d)[0];
      if (pushes.ax === 'x') { x = pushes.to; vx = 0; } else { z = pushes.to; vz = 0; }
    }
  }
  x = clamp(x, env.bounds.minX, env.bounds.maxX);
  z = clamp(z, env.bounds.minZ, env.bounds.maxZ);

  const floor = floorAt(env, x, z, y);
  if (grounded) {
    if (floor < y - 0.45) {
      grounded = false; // walked off a ledge
      airtime = 0;
    } else {
      y = floor;
    }
  } else {
    y += vy * dt;
    airtime += dt;
    if (y <= floor && vy <= 0) {
      y = floor;
      vy = 0;
      grounded = true;
      lastAirtime = airtime;
    }
  }

  distance += Math.hypot(x - px, z - pz);
  return { x, y, z, vx, vy, vz, heading, grounded, airtime, lastAirtime, jumps, distance };
}

/** Run one jump on flat ground and report how long the astronaut stays in the air. */
export function measureJumpAirtime(preset: GravityPreset, dt = 1 / 120): number {
  const env: WalkEnv = {
    preset,
    ground: () => 0,
    circles: [],
    boxes: [],
    bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
    radius: 0.35,
  };
  let s = makeWalker(0, 0);
  s = stepWalker(s, { moveX: 0, moveZ: 0, jump: true }, dt, env);
  let guard = 0;
  while (!s.grounded && guard++ < 100000) {
    s = stepWalker(s, { moveX: 0, moveZ: 0, jump: false }, dt, env);
  }
  return s.lastAirtime;
}

// ---------------------------------------------------------------------------
// Microgravity: push, drift, grab. No gravity term and no friction, because the
// station and everything inside it are falling around Earth together.
// ---------------------------------------------------------------------------

export interface Rail { id: string; x: number; z: number }

export interface DriftEnv {
  rails: Rail[];
  bounds: Bounds;
  pushSpeed: number;
  reach: number;
  restitution: number;
}

export interface DriftState {
  x: number; z: number; vx: number; vz: number;
  heading: number;
  holding: string | null;
  lastRail: string;
  pushes: number;
  grabs: number;
  wallHits: number;
  recoveries: number;
  /** Seconds spent drifting since the last push. */
  freeTime: number;
}

export interface DriftInput {
  aimX: number; aimZ: number;
  /** Optional: rotate the aim steadily (-1..1) instead of snapping to a direction. */
  turn?: number;
  push: boolean; grab: boolean; recover: boolean;
}

export const DRIFT_TURN_RATE = 1.7;

export function makeDrifter(env: DriftEnv, railId: string, heading = Math.PI / 2): DriftState {
  const rail = env.rails.find((r) => r.id === railId) ?? env.rails[0];
  return {
    x: rail.x, z: rail.z, vx: 0, vz: 0, heading, holding: rail.id, lastRail: rail.id,
    pushes: 0, grabs: 0, wallHits: 0, recoveries: 0, freeTime: 0,
  };
}

export function nearestRail(env: DriftEnv, x: number, z: number): { rail: Rail; dist: number } | null {
  let best: { rail: Rail; dist: number } | null = null;
  for (const rail of env.rails) {
    const dist = Math.hypot(rail.x - x, rail.z - z);
    if (!best || dist < best.dist) best = { rail, dist };
  }
  return best;
}

export function stepDrift(s: DriftState, input: DriftInput, dt: number, env: DriftEnv): DriftState {
  const n = { ...s };
  if (Math.hypot(input.aimX, input.aimZ) > 0.3) n.heading = Math.atan2(input.aimX, input.aimZ);
  if (input.turn) n.heading += clamp(input.turn, -1, 1) * DRIFT_TURN_RATE * dt;

  if (input.recover) {
    const rail = env.rails.find((r) => r.id === n.lastRail) ?? env.rails[0];
    n.x = rail.x; n.z = rail.z; n.vx = 0; n.vz = 0;
    n.holding = rail.id; n.recoveries += 1; n.freeTime = 0;
    return n;
  }

  if (n.holding) {
    if (input.push) {
      // You can only push while touching something. That is the lesson.
      n.vx = Math.sin(n.heading) * env.pushSpeed;
      n.vz = Math.cos(n.heading) * env.pushSpeed;
      n.holding = null;
      n.pushes += 1;
      n.freeTime = 0;
    }
    return n;
  }

  // Free drift: velocity is preserved. Steering input changes where you look,
  // not where you go.
  n.x += n.vx * dt;
  n.z += n.vz * dt;
  n.freeTime += dt;

  if (n.x < env.bounds.minX) { n.x = env.bounds.minX; n.vx = Math.abs(n.vx) * env.restitution; n.wallHits += 1; }
  if (n.x > env.bounds.maxX) { n.x = env.bounds.maxX; n.vx = -Math.abs(n.vx) * env.restitution; n.wallHits += 1; }
  if (n.z < env.bounds.minZ) { n.z = env.bounds.minZ; n.vz = Math.abs(n.vz) * env.restitution; n.wallHits += 1; }
  if (n.z > env.bounds.maxZ) { n.z = env.bounds.maxZ; n.vz = -Math.abs(n.vz) * env.restitution; n.wallHits += 1; }

  if (input.grab) {
    const near = nearestRail(env, n.x, n.z);
    if (near && near.dist <= env.reach) {
      n.vx = 0; n.vz = 0;
      n.holding = near.rail.id;
      n.lastRail = near.rail.id;
      n.grabs += 1;
      n.freeTime = 0;
    }
  }
  return n;
}
