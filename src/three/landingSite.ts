import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { flatMask, type FlatZone, type HeightFn } from './terrain';

// Real landing sites from Sketchfab terrain scans (CC BY, SebastianSosnowski), baked
// offline into a top-down 16-bit height map and an aligned colour photo:
//   Moon: Petavius crater, landing on the floor beside the central peaks.
//   Mars: Olympus Mons, landing inside the summit caldera.
// A tile spans `tile` metres; u, v are where the primary landing zone sits on it.

export interface SiteSpec {
  file: string;
  /** Side of the scanned square in game metres. */
  tile: number;
  /** Metres between the lowest and highest point of the scan at this scale. */
  relief: number;
  /** Primary landing zone position on the tile, 0..1 (u along +x, v along +z). */
  u: number;
  v: number;
  /** Mean linear luminance of the tiled detail texture laid over the photo. */
  detailMean: number;
}

export const SITES: Record<'moon' | 'mars', SiteSpec> = {
  moon: { file: 'moon_petavius', tile: 1800, relief: 125.5, u: 0.383, v: 0.547, detailMean: 0.158 },
  mars: { file: 'mars_olympus', tile: 3000, relief: 412.0, u: 0.488, v: 0.547, detailMean: 0.083 },
};

export interface LandingSite { spec: SiteSpec; size: number; heights: Float32Array; map: THREE.Texture }

const cache: Partial<Record<'moon' | 'mars', Promise<LandingSite>>> = {};

async function loadHeights(url: string): Promise<{ size: number; heights: Float32Array }> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  // Height is 16-bit: high byte in red, low byte in green.
  const heights = new Float32Array(bmp.width * bmp.height);
  for (let i = 0; i < heights.length; i++) heights[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 65535;
  return { size: bmp.width, heights };
}

function loadSite(world: 'moon' | 'mars'): Promise<LandingSite> {
  const spec = SITES[world];
  const base = `${import.meta.env.BASE_URL}terrain/${spec.file}`;
  cache[world] ??= Promise.all([
    loadHeights(`${base}_height.png`),
    new THREE.TextureLoader().loadAsync(`${base}_color.jpg`),
  ]).then(([h, map]) => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.MirroredRepeatWrapping;
    map.anisotropy = 8;
    return { spec, size: h.size, heights: h.heights, map };
  });
  return cache[world] as Promise<LandingSite>;
}

/** The real landing site once loaded; null until then, and for good if the files are missing. */
export function useLandingSite(world: 'moon' | 'mars'): LandingSite | null {
  const [site, setSite] = useState<LandingSite | null>(null);
  useEffect(() => {
    let on = true;
    loadSite(world).then((s) => { if (on) setSite(s); }).catch((err) => { console.warn(`Real ${world} landing site failed to load, keeping the painted ground.`, err); });
    return () => { on = false; };
  }, [world]);
  return site;
}

/** Mirror a tile coordinate into 0..1 so ground past the scan edge continues smoothly. */
function mirror(t: number): number {
  const m = ((t % 2) + 2) % 2;
  return m > 1 ? 2 - m : m;
}

/**
 * Ground height in game metres: the scan, shifted so the primary landing zone is at 0,
 * and pressed exactly flat over the landing zones the lander sim treats as level.
 */
export function siteHeight(site: LandingSite, flats: FlatZone[]): HeightFn {
  const { spec, size, heights } = site;
  const raw = (x: number, z: number) => {
    const c = mirror(spec.u + x / spec.tile) * (size - 1);
    const r = mirror(spec.v + z / spec.tile) * (size - 1);
    const c0 = Math.min(size - 2, Math.floor(c)), r0 = Math.min(size - 2, Math.floor(r));
    const fc = c - c0, fr = r - r0;
    const i = r0 * size + c0;
    const top = heights[i] * (1 - fc) + heights[i + 1] * fc;
    const bottom = heights[i + size] * (1 - fc) + heights[i + size + 1] * fc;
    return (top * (1 - fr) + bottom * fr) * spec.relief;
  };
  const zero = raw(0, 0);
  return (x, z) => (raw(x, z) - zero) * flatMask(flats, x, z);
}
