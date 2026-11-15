// Procedural textures drawn on canvases at start-up. The game ships no image
// files, so there is nothing to download and nothing third-party to credit.

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

export function groundTexture(kind: GroundKind): THREE.CanvasTexture {
  return make(`ground-${kind}`, 512, 512, (ctx, w, h) => {
    if (kind === 'moon') {
      ctx.fillStyle = '#8b8a88';
      ctx.fillRect(0, 0, w, h);
      blotches(ctx, w, h, 11, 60, ['#a3a29f', '#6f6e6c', '#7d7c7a'], 70);
      speckle(ctx, w, h, 12, 9000, '#c0bfbb', '#4f4e4d');
      // Small pits only. Large craters are real geometry, so the tiling pattern stays hidden.
      const r = rng(13);
      for (let i = 0; i < 70; i++) {
        const x = r() * w, y = r() * h, rad = 0.8 + r() * r() * 2.6;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#5c5b5a';
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'mars') {
      ctx.fillStyle = '#a5512c';
      ctx.fillRect(0, 0, w, h);
      blotches(ctx, w, h, 21, 70, ['#c1693a', '#8a3f22', '#b05a30', '#7a3a22'], 80);
      speckle(ctx, w, h, 22, 8000, '#d08955', '#5e2a18');
      speckle(ctx, w, h, 23, 260, '#6b3320', '#4a2416', 5);
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
export function earthTexture(): THREE.CanvasTexture {
  return make('earth', 1024, 512, (ctx, w, h) => {
    const sea = ctx.createLinearGradient(0, 0, 0, h);
    sea.addColorStop(0, '#dfeaf2'); sea.addColorStop(0.12, '#2a5f9e'); sea.addColorStop(0.5, '#164a8c');
    sea.addColorStop(0.88, '#2a5f9e'); sea.addColorStop(1, '#eef3f7');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const lat = Math.abs(y / h - 0.5) * 2;
      for (let x = 0; x < w; x++) {
        const u = (x / w) * 8, v = (y / h) * 4;
        // Blend the noise across the seam so the map wraps cleanly.
        const t = x / w;
        const land = fbm(u, v, 5) * (1 - t) + fbm(u - 8, v, 5) * t;
        const cloud = fbm(u * 1.7 + 3, v * 2.6, 9) * (1 - t) + fbm((u - 8) * 1.7 + 3, v * 2.6, 9) * t;
        const i = (y * w + x) * 4;
        if (land > 0.56 && lat < 0.86) {
          const dry = fbm(u * 2, v * 2, 3);
          const k = Math.min(1, (land - 0.56) * 9);
          const lr = dry > 0.5 ? 150 : 62, lg = dry > 0.5 ? 128 : 112, lb = dry > 0.5 ? 82 : 58;
          d[i] += (lr - d[i]) * k; d[i + 1] += (lg - d[i + 1]) * k; d[i + 2] += (lb - d[i + 2]) * k;
        }
        if (cloud > 0.55) {
          const k = Math.min(1, (cloud - 0.55) * 5) * 0.92;
          d[i] += (250 - d[i]) * k; d[i + 1] += (252 - d[i + 1]) * k; d[i + 2] += (255 - d[i + 2]) * k;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  });
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
