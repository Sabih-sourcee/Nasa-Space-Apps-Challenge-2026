// Procedural textures drawn on canvases at start-up, plus four NASA globe maps
// in public/textures (credited in docs/SCIENCE_AND_CREDITS.md). The ground you
// walk on is painted here. The painted Earth is what shows until the real map loads.

import * as THREE from 'three';

export function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Smooth value noise in [0, 1]. Deterministic, so physics and visuals agree. */
export function vnoise(x: number, z: number, seed = 1): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

export function fbm(x: number, z: number, seed = 1): number {
  return vnoise(x, z, seed) * 0.55 + vnoise(x * 2.1, z * 2.1, seed + 7) * 0.28 + vnoise(x * 4.3, z * 4.3, seed + 13) * 0.17;
}

const cache = new Map<string, THREE.Texture>();

function make(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit as THREE.CanvasTexture;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, count: number, light: string, dark: string, maxR = 2.2): void {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 0.4 + r() * r() * maxR;
    ctx.globalAlpha = 0.06 + r() * 0.2;
    ctx.fillStyle = r() > 0.5 ? light : dark;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function blotches(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, count: number, colors: string[], size: number): void {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = size * (0.4 + r());
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const c = colors[Math.floor(r() * colors.length)];
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.1 + r() * 0.16;
    ctx.fillStyle = g;
    // Draw wrapped copies so the texture tiles without seams.
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export type GroundKind = 'moon' | 'mars' | 'concrete' | 'field';

/** Draws a round shape with its wrapped copies, so the texture still tiles. */
function tiled(ctx: CanvasRenderingContext2D, w: number, h: number, x: number, y: number, rad: number, draw: () => void): void {
  for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
    const cx = x + ox, cy = y + oy;
    if (cx < -rad || cx > w + rad || cy < -rad || cy > h + rad) continue;
    ctx.save();
    ctx.translate(cx, cy);
    draw();
    ctx.restore();
  }
}

function disc(ctx: CanvasRenderingContext2D, rad: number, stops: [number, string][]): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.fill();
}

/** The same small craters are used for colour and for relief, so they line up. */
function moonCraters(w: number, h: number): { x: number; y: number; rad: number }[] {
  const r = rng(13);
  const out: { x: number; y: number; rad: number }[] = [];
  for (let i = 0; i < 54; i++) out.push({ x: r() * w, y: r() * h, rad: 3 + r() * r() * 26 });
  return out;
}

function marsStones(w: number, h: number): { x: number; y: number; rad: number; tone: number }[] {
  const r = rng(27);
  const out: { x: number; y: number; rad: number; tone: number }[] = [];
  for (let i = 0; i < 170; i++) out.push({ x: r() * w, y: r() * h, rad: 1.5 + r() * r() * 9, tone: r() });
  return out;
}

/** Wind ripples in the dust, in [-1, 1]. Whole-number frequencies keep it tiling. */
function ripple(x: number, y: number, w: number, h: number): number {
  const T = Math.PI * 2;
  const patch = 0.5 + 0.5 * Math.sin(T * (x / w + (2 * y) / h) + 1.3);
  return Math.sin(T * ((13 * y) / h) + 1.6 * Math.sin(T * ((2 * x) / w)) + 0.8 * Math.sin(T * ((3 * x) / w + y / h))) * patch;
}

export function groundTexture(kind: GroundKind): THREE.CanvasTexture {
  const big = kind === 'moon' || kind === 'mars';
  return make(`ground-${kind}`, big ? 1024 : 512, big ? 1024 : 512, (ctx, w, h) => {
    if (kind === 'moon') {
      ctx.fillStyle = '#868583';
      ctx.fillRect(0, 0, w, h);
      blotches(ctx, w, h, 11, 150, ['#a3a29f', '#6a6968', '#7d7c7a', '#8f8c86'], 110);
      speckle(ctx, w, h, 12, 34000, '#c4c3bf', '#4c4b4a');
      // Small craters only. Large ones are real geometry, so the tiling pattern stays hidden.
      // Each has a darker floor and a ring of brighter dust thrown out around it.
      for (const c of moonCraters(w, h)) {
        tiled(ctx, w, h, c.x, c.y, c.rad * 1.9, () => disc(ctx, c.rad * 1.9, [
          [0, 'rgba(66,65,64,0.5)'], [0.42, 'rgba(82,81,80,0.4)'], [0.53, 'rgba(200,199,194,0.5)'],
          [0.72, 'rgba(172,171,167,0.2)'], [1, 'rgba(172,171,167,0)'],
        ]));
      }
    } else if (kind === 'mars') {
      ctx.fillStyle = '#a65a34';
      ctx.fillRect(0, 0, w, h);
      blotches(ctx, w, h, 21, 190, ['#c47443', '#8a4326', '#b3653a', '#7a3d24', '#c98a58'], 120);
      // Wind ripples: pale dust on the crests, darker sand in the troughs.
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const k = 1 + ripple(x, y, w, h) * 0.085;
        const i = (y * w + x) * 4;
        d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k);
      }
      ctx.putImageData(img, 0, 0);
      speckle(ctx, w, h, 22, 30000, '#d6935e', '#5e2c19');
      // Dark volcanic stones, each with a soft shadow and a dusty top.
      for (const st of marsStones(w, h)) {
        tiled(ctx, w, h, st.x, st.y, st.rad * 2.2, () => {
          ctx.save(); ctx.translate(st.rad * 0.5, st.rad * 0.4);
          disc(ctx, st.rad * 1.7, [[0, 'rgba(46,20,12,0.5)'], [1, 'rgba(46,20,12,0)']]);
          ctx.restore();
          const base = st.tone > 0.5 ? '74,44,34' : '98,56,38';
          disc(ctx, st.rad, [[0, `rgba(${base},0.95)`], [0.8, `rgba(${base},0.9)`], [1, `rgba(${base},0)`]]);
          ctx.save(); ctx.translate(-st.rad * 0.25, -st.rad * 0.3);
          disc(ctx, st.rad * 0.6, [[0, 'rgba(206,140,96,0.5)'], [1, 'rgba(206,140,96,0)']]);
          ctx.restore();
        });
      }
    } else if (kind === 'concrete') {
      ctx.fillStyle = '#8f9193';
      ctx.fillRect(0, 0, w, h);
      blotches(ctx, w, h, 31, 40, ['#a2a4a6', '#7c7e80'], 90);
      speckle(ctx, w, h, 32, 5000, '#b3b5b7', '#66686a', 1.4);
      ctx.strokeStyle = 'rgba(40,42,44,0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2); // slab joints
    } else {
      ctx.fillStyle = '#6f7d4d';
      ctx.fillRect(0, 0, w, h);
      blotches(ctx, w, h, 41, 70, ['#84925a', '#596a3d', '#8d8a5c'], 70);
      speckle(ctx, w, h, 42, 7000, '#9aa66a', '#465430', 1.6);
    }
  });
}

/**
 * Relief for the Moon and Mars ground, matched to the colour texture: crater
 * bowls and raised rims, dune ripples and stones. Mid grey is level ground.
 */
export function groundRelief(kind: 'moon' | 'mars'): THREE.CanvasTexture {
  return make(`relief-${kind}`, 1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    if (kind === 'moon') {
      blotches(ctx, w, h, 14, 120, ['#9a9a9a', '#686868'], 90);
      for (const c of moonCraters(w, h)) {
        tiled(ctx, w, h, c.x, c.y, c.rad * 1.9, () => disc(ctx, c.rad * 1.9, [
          [0, 'rgba(18,18,18,0.92)'], [0.4, 'rgba(44,44,44,0.85)'], [0.53, 'rgba(238,238,238,0.9)'],
          [0.75, 'rgba(156,156,156,0.35)'], [1, 'rgba(128,128,128,0)'],
        ]));
      }
      speckle(ctx, w, h, 15, 30000, '#ffffff', '#000000', 1.8);
    } else {
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = 128 + ripple(x, y, w, h) * 58;
        const i = (y * w + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      ctx.putImageData(img, 0, 0);
      for (const st of marsStones(w, h)) {
        tiled(ctx, w, h, st.x, st.y, st.rad * 1.2, () => disc(ctx, st.rad * 1.2, [[0, 'rgba(255,255,255,0.95)'], [0.7, 'rgba(225,225,225,0.8)'], [1, 'rgba(128,128,128,0)']]));
      }
      speckle(ctx, w, h, 25, 26000, '#ffffff', '#000000', 1.6);
    }
  }, false);
}

/** Neutral grain used as a bump map on fabric, regolith and painted metal. */
export function grainTexture(): THREE.CanvasTexture {
  return make('grain', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 51, 9000, '#ffffff', '#000000', 1.6);
  }, false);
}

export function panelTexture(base = '#e4e6e8', line = '#9aa0a6', key = 'panel'): THREE.CanvasTexture {
  return make(`${key}-${base}`, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, 61, 14, ['#ffffff', '#c6cace'], 80);
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(0, (i * h) / 2); ctx.lineTo(w, (i * h) / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo((i * w) / 2, 0); ctx.lineTo((i * w) / 2, h); ctx.stroke();
    }
    ctx.fillStyle = line;
    for (let x = 12; x < w; x += 29) for (const y of [8, h / 2 - 8, h / 2 + 8, h - 8]) {
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  });
}

/** Crinkled insulation foil for the lander descent stage. */
export function foilTexture(): THREE.CanvasTexture {
  return make('foil', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b8862b';
    ctx.fillRect(0, 0, w, h);
    const r = rng(71);
    for (let i = 0; i < 380; i++) {
      const x = r() * w, y = r() * h, s = 8 + r() * 26;
      ctx.globalAlpha = 0.3 + r() * 0.4;
      ctx.fillStyle = ['#e2b24a', '#8c6217', '#f3d27a', '#a87820', '#6d4b10'][Math.floor(r() * 5)];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * s, y + (r() - 0.5) * s);
      ctx.lineTo(x + (r() - 0.5) * s, y + (r() - 0.5) * s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

export function solarCellTexture(): THREE.CanvasTexture {
  return make('solar', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#10214a';
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, 81, 10, ['#1d3a7a', '#0a1634'], 90);
    ctx.strokeStyle = '#b9c4d6';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, (i * h) / 4); ctx.lineTo(w, (i * h) / 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo((i * w) / 4, 0); ctx.lineTo((i * w) / 4, h); ctx.stroke();
    }
  });
}

/** Original Beyond Earth mission patch. No agency insignia or flags are used. */
export function insigniaTexture(): THREE.CanvasTexture {
  const tex = make('insignia', 256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b1c3d';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 122, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f2f4f7'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 116, 0, Math.PI * 2); ctx.stroke();
    const g = ctx.createRadialGradient(108, 120, 6, 128, 140, 56);
    g.addColorStop(0, '#8fd0ff'); g.addColorStop(1, '#1b5fae');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(128, 140, 50, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e23d3d'; ctx.lineWidth = 9;
    ctx.save(); ctx.translate(128, 128); ctx.rotate(-0.42);
    ctx.beginPath(); ctx.ellipse(0, 0, 100, 34, 0, Math.PI * 0.08, Math.PI * 1.02); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#f2f4f7';
    ctx.beginPath(); ctx.arc(200, 74, 9, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 21px Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('BEYOND EARTH', w / 2, 52);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function labelTexture(lines: string[], opts: { bg?: string; fg?: string; accent?: string; w?: number; h?: number } = {}): THREE.CanvasTexture {
  const { bg = '#0b1c3d', fg = '#f2f4f7', accent = '#e23d3d', w = 512, h = 192 } = opts;
  const tex = make(`label-${lines.join('|')}-${bg}-${w}x${h}`, w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 14, h);
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle';
    const first = Math.min(72, Math.floor((h * 0.5) / Math.max(1, lines.length - 0.4)));
    lines.forEach((line, i) => {
      const size = i === 0 ? first : Math.floor(first * 0.62);
      ctx.font = `${i === 0 ? 'bold ' : ''}${size}px Arial, sans-serif`;
      const y = (h / (lines.length + 1)) * (i + 1) + (i === 0 ? -4 : 6);
      ctx.fillText(line, 34, y, w - 50);
    });
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Stylised Earth for orbital and lunar skies. Painted, not a satellite image. */
export type PlanetMap = 'earth' | 'moon' | 'mars' | 'jupiter';
const planetCache = new Map<PlanetMap, THREE.Texture>();

/** A real NASA map of a whole world, wrapped once round a globe. It fills in when the image arrives. */
export function planetTexture(name: PlanetMap): THREE.Texture {
  const hit = planetCache.get(name);
  if (hit) return hit;
  const t = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/${name}.jpg`);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  planetCache.set(name, t);
  return t;
}

let realEarthCache: Promise<{ map: THREE.Texture; rough: THREE.CanvasTexture }> | null = null;

/** The real Earth map, with a shine map worked out from it: blue water glints, land and ice do not. */
export function realEarth(): Promise<{ map: THREE.Texture; rough: THREE.CanvasTexture }> {
  realEarthCache ??= new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}textures/earth.jpg`).then((map) => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.anisotropy = 8;
    const w = 1024, h = 512;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(map.image as CanvasImageSource, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const water = d[i + 2] > d[i] + 22 && d[i + 2] >= d[i + 1] && d[i] < 120;
      const v = water ? 90 : 242;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    const rough = new THREE.CanvasTexture(c);
    rough.wrapS = THREE.RepeatWrapping;
    return { map, rough };
  });
  return realEarthCache;
}

export type EarthMaps = { map: THREE.CanvasTexture; rough: THREE.CanvasTexture; clouds: THREE.CanvasTexture };
let earthCache: EarthMaps | null = null;

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * A painted Earth: the surface colour, how shiny each part is (sea glints,
 * land does not), and a separate cloud layer that drifts over it. The
 * continents are invented shapes, not a map of the real ones.
 */
export function earthMaps(): EarthMaps {
  if (earthCache) return earthCache;
  const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // Noise blended across the seam so the map wraps cleanly round the globe.
  const wrapped = (u: number, v: number, seed: number, period: number, t: number) => fbm(u, v, seed) * (1 - t) + fbm(u - period, v, seed) * t;

  const W = 1536, H = 768;
  const cs = canvas(W, H), cr = canvas(W, H);
  const xs = cs.getContext('2d') as CanvasRenderingContext2D, xr = cr.getContext('2d') as CanvasRenderingContext2D;
  const is = xs.createImageData(W, H), ir = xr.createImageData(W, H);
  const ds = is.data, dr = ir.data;
  for (let y = 0; y < H; y++) {
    const lat = Math.abs(y / H - 0.5) * 2; // 0 at the equator, 1 at a pole
    for (let x = 0; x < W; x++) {
      const t = x / W, u = t * 8, v = (y / H) * 4;
      const land = wrapped(u, v, 5, 8, t) + (fbm(u * 5, v * 5, 31) - 0.5) * 0.07;
      const clim = wrapped(u * 1.5 + 9, v * 1.5, 23, 12, t);
      const i = (y * W + x) * 4;
      // Deep water is dark, and it gets lighter on the shelf near a coast.
      const shelf = smooth(0.38, 0.56, land);
      let r = 6 + 22 * shelf, g = 28 + 66 * shelf, b = 70 + 78 * shelf, rough = 0.34;
      // Edges are blended over a few pixels, so coasts and ice stay smooth when the globe fills the view.
      const coast = smooth(0.552, 0.578, land);
      if (coast > 0) {
        const hgt = Math.min(1, Math.max(0, (land - 0.56) * 6));
        // Forest near the equator, lighter green further out, bare ground toward the poles.
        const tropic = 1 - smooth(0.12, 0.34, lat);
        let lr = 70 - 34 * tropic, lg = 108 - 18 * tropic, lb = 56 - 12 * tropic;
        const desert = smooth(0.46, 0.62, clim) * smooth(0.1, 0.24, lat) * (1 - smooth(0.42, 0.6, lat));
        lr += (198 - lr) * desert; lg += (164 - lg) * desert; lb += (110 - lb) * desert;
        const cold = smooth(0.6, 0.82, lat);
        lr += (126 - lr) * cold; lg += (120 - lg) * cold; lb += (100 - lb) * cold;
        const peak = smooth(0.55, 0.95, hgt);
        lr += (134 - lr) * peak; lg += (122 - lg) * peak; lb += (108 - lb) * peak;
        const snow = smooth(0.82, 1, hgt) * smooth(0.3, 0.7, lat);
        lr += (240 - lr) * snow; lg += (242 - lg) * snow; lb += (246 - lb) * snow;
        const shade = 0.86 + clim * 0.26;
        r += (lr * shade - r) * coast; g += (lg * shade - g) * coast; b += (lb * shade - b) * coast;
        rough += (0.96 - rough) * coast;
      }
      // Polar ice and snow.
      const ice = smooth(0.87, 0.93, lat + (land - 0.5) * 0.3 + (clim - 0.5) * 0.08);
      const white = 0.9 + clim * 0.1;
      r += (236 * white - r) * ice; g += (242 * white - g) * ice; b += (248 * white - b) * ice;
      rough += (0.72 - rough) * ice;
      ds[i] = r; ds[i + 1] = g; ds[i + 2] = b; ds[i + 3] = 255;
      const rv = rough * 255;
      dr[i] = rv; dr[i + 1] = rv; dr[i + 2] = rv; dr[i + 3] = 255;
    }
  }
  xs.putImageData(is, 0, 0);
  xr.putImageData(ir, 0, 0);

  const CW = 1024, CH = 512;
  const cc = canvas(CW, CH);
  const xc = cc.getContext('2d') as CanvasRenderingContext2D;
  const ic = xc.createImageData(CW, CH);
  const dc = ic.data;
  for (let y = 0; y < CH; y++) {
    const lat = Math.abs(y / CH - 0.5) * 2;
    // Cloudy along the equator and in the storm belts, clearer between them.
    const belt = 0.07 * Math.cos(lat * Math.PI * 3.4) - 0.05 * smooth(0.8, 1, lat);
    for (let x = 0; x < CW; x++) {
      const t = x / CW, u = t * 8, v = (y / CH) * 4;
      const c = wrapped(u * 1.7 + 3, v * 2.6, 9, 13.6, t) + (wrapped(u * 5 + 1, v * 7, 17, 40, t) - 0.5) * 0.3 + belt;
      // Stored soft. The cloud edge is cut in the shader, so it stays crisp from close up.
      const a = Math.min(1, Math.max(0, (c - 0.3) / 0.6)) * 255;
      const i = (y * CW + x) * 4;
      dc[i] = dc[i + 1] = dc[i + 2] = a; dc[i + 3] = 255;
    }
  }
  xc.putImageData(ic, 0, 0);

  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const tx = new THREE.CanvasTexture(c);
    if (srgb) tx.colorSpace = THREE.SRGBColorSpace;
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.anisotropy = 8;
    return tx;
  };
  earthCache = { map: tex(cs, true), rough: tex(cr, false), clouds: tex(cc, false) };
  return earthCache;
}

/** A canvas that scenes redraw while playing (cockpit displays, console screens). */
export function makeScreen(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#05080f';
  ctx.fillRect(0, 0, w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, texture };
}
