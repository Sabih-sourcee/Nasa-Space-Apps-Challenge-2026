// Height fields shared by the renderer and the walking model, so the astronaut
// stands exactly on the ground that is drawn.

import { fbm, rng } from './textures';

export interface Crater { x: number; z: number; r: number; depth: number }
/** A flat work area: a capsule from (x1,z1) to (x2,z2) with radius r that blends out over `blend` metres. */
export interface FlatZone { x1: number; z1: number; x2: number; z2: number; r: number; blend: number }

export interface HeightOptions {
  seed: number;
  amp: number;
  scale: number;
  flats: FlatZone[];
  craters: Crater[];
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function distToSegment(x: number, z: number, f: FlatZone): number {
  const dx = f.x2 - f.x1;
  const dz = f.z2 - f.z1;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - f.x1) * dx + (z - f.z1) * dz) / len2));
  return Math.hypot(x - (f.x1 + dx * t), z - (f.z1 + dz * t));
}

export type HeightFn = (x: number, z: number) => number;

/** 0 inside a flat work area, rising smoothly to 1 outside its blend band. */
export function flatMask(flats: FlatZone[], x: number, z: number): number {
  let mask = 1;
  for (const f of flats) mask = Math.min(mask, smooth(f.r, f.r + f.blend, distToSegment(x, z, f)));
  return mask;
}

export function makeHeight(o: HeightOptions): HeightFn {
  return (x, z) => {
    const mask = flatMask(o.flats, x, z);
    let h = (fbm(x * o.scale, z * o.scale, o.seed) - 0.5) * 2 * o.amp * mask;
    h += (fbm(x * o.scale * 6, z * o.scale * 6, o.seed + 31) - 0.5) * 0.22 * (0.25 + 0.75 * mask);
    for (const c of o.craters) {
      const d = Math.hypot(x - c.x, z - c.z) / c.r;
      if (d < 1.5) {
        const bowl = d < 1 ? -c.depth * (1 - d * d) : 0;
        const rim = c.depth * 0.3 * Math.exp(-((d - 1) * (d - 1)) / 0.03);
        h += bowl + rim;
      }
    }
    return h;
  };
}

export interface RockSpec { x: number; z: number; y: number; s: number; rx: number; ry: number; sy: number }

export function scatterRocks(height: HeightFn, count: number, area: number, seed: number, flats: FlatZone[], minS = 0.12, maxS = 0.9): RockSpec[] {
  const r = rng(seed);
  const out: RockSpec[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 20) {
    const x = (r() - 0.5) * area;
    const z = (r() - 0.5) * area;
    const s = minS + r() * r() * (maxS - minS);
    // Keep work areas clear of anything large enough to trip over.
    const nearFlat = flats.some((f) => distToSegment(x, z, f) < f.r + 1);
    if (nearFlat && s > 0.22) continue;
    out.push({ x, z, y: height(x, z) + s * 0.25, s, rx: r() * 3, ry: r() * 6, sy: 0.55 + r() * 0.5 });
  }
  return out;
}
