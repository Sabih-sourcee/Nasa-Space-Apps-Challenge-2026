import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { RockSpec } from './terrain';

// Real NASA 3D models (https://science.nasa.gov/3d-resources/) and CC0 photogrammetry
// rocks (Poly Haven), Draco-compressed GLBs. Each one replaces a code-drawn prop once
// it has loaded; the painted prop stays if the file cannot be read.

export type NasaModel = 'lm' | 'perseverance' | 'shuttle' | 'iss' | 'ml' | 'sev' | 'hdu' | 'insight';

interface ModelConfig {
  file: string;
  /** Normalize by the largest horizontal extent (m) or by height (m). */
  by: 'width' | 'height';
  size: number;
  /** Extra rotation after normalizing, for models authored Z-up or facing another way. */
  rotate?: [number, number, number];
  /** Per-kind material touch-up once loaded. */
  finish?: (root: THREE.Group) => void;
}

/**
 * The launch stack is an untextured clay model: paint it by part. The parts are told
 * apart by the names they have in the file, which do not depend on how the model is
 * turned: `pCylinder8` is the external tank, `group13` the engine nozzles, and the
 * rest (the two boosters and the orbiter) is white.
 */
function paintShuttle(root: THREE.Group) {
  const tank = new THREE.MeshStandardMaterial({ color: '#c07a3e', roughness: 0.85, metalness: 0.05 });
  const white = new THREE.MeshStandardMaterial({ color: '#e9e7e2', roughness: 0.55, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.5, metalness: 0.7 });
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const name = `${o.parent?.name ?? ''} ${o.name}`;
    o.material = name.includes('pCylinder8') ? tank : name.includes('group13') ? dark : white;
  });
}

const CONFIG: Record<NasaModel, ModelConfig> = {
  // Apollo Lunar Module, NASA 3D Resources (flag and "UNITED STATES" decals removed, panels left plain gold).
  lm: { file: 'lm', by: 'width', size: 7.0 },
  // Mars 2020 Perseverance Rover, NASA 3D Resources / JPL.
  perseverance: { file: 'perseverance', by: 'width', size: 3.0 },
  // Space Shuttle stack (orbiter, external tank and two SRBs), NASA 3D Resources. Untextured; painted in code.
  // In the file the nose points along -Z and the orbiter sits on the +Y side of the tank, so a quarter turn
  // about X stands it nose up with the orbiter facing the viewer.
  shuttle: { file: 'shuttle', by: 'height', size: 45, rotate: [Math.PI / 2, 0, 0], finish: paintShuttle },
  // International Space Station, NASA 3D Resources (disconnected stray meshes removed).
  // Untextured clay; authored with the truss along z, turned so it lies along x like the painted station.
  iss: { file: 'iss', by: 'width', size: 56, rotate: [0, Math.PI / 2, 0] },
  // Mobile Launcher, NASA 3D Resources (textured).
  ml: { file: 'ml', by: 'height', size: 56 },
  // Space Exploration Vehicle pressurized rover concept, NASA 3D Resources.
  sev: { file: 'sev', by: 'width', size: 3.4 },
  // Habitat Demonstration Unit, NASA 3D Resources (NASA logos and flags removed, keeping hatches and labels).
  hdu: { file: 'hdu', by: 'width', size: 6.8 },
  // InSight Mars lander with solar panels and arm deployed, NASA 3D Resources / JPL.
  insight: { file: 'insight', by: 'width', size: 6.0 },
};

/**
 * Where the Mobile Launcher model goes beside a pad, relative to a group placed 16 m to the
 * left of the rocket. In the file the tower stands over the middle of the deck's long side,
 * which put it through the rocket. A quarter turn moves the tower behind the rocket and
 * leaves the deck under it.
 */
export const ML_AT: [number, number, number] = [16, 0, 3.6];
export const ML_TURN: [number, number, number] = [0, Math.PI / 2, 0];

let gltf: GLTFLoader | null = null;
function loader(): GLTFLoader {
  if (!gltf) {
    const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    gltf = new GLTFLoader().setDRACOLoader(draco);
  }
  return gltf;
}

const cache: Partial<Record<NasaModel, Promise<THREE.Group>>> = {};

function loadModel(kind: NasaModel): Promise<THREE.Group> {
  const cfg = CONFIG[kind];
  cache[kind] ??= loader()
    .loadAsync(`${import.meta.env.BASE_URL}models/${cfg.file}.glb`)
    .then((g) => {
      const root = g.scene;
      if (cfg.rotate) root.rotation.set(...cfg.rotate);
      root.updateMatrixWorld(true);
      // Normalize: scale to the display size, feet to y=0.
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const measure = cfg.by === 'height' ? size.y : Math.max(size.x, size.z);
      root.scale.setScalar(cfg.size / measure);
      root.updateMatrixWorld(true);
      const scaled = new THREE.Box3().setFromObject(root);
      root.position.y -= scaled.min.y;
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.envMapIntensity = 0.6;
        }
      });
      cfg.finish?.(root);
      const wrap = new THREE.Group();
      wrap.add(root);
      return wrap;
    });
  return cache[kind] as Promise<THREE.Group>;
}

function useNasaModel(kind: NasaModel): THREE.Group | null {
  const [model, setModel] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let on = true;
    loadModel(kind).then((m) => { if (on) setModel(m); }).catch((err) => { console.warn(`NASA model "${kind}" failed to load, keeping the code-drawn prop.`, err); });
    return () => { on = false; };
  }, [kind]);
  return model;
}

/**
 * Renders the real model once loaded, the code-drawn `fallback` until then
 * (and permanently if the file is missing). The model is cloned per use.
 * `overlay` renders only while the real model is on screen (markers that the
 * fallback prop already carries itself). `modelPosition`/`modelRotation` move
 * only the real model, for scenes where the fallback prop is placed differently.
 */
export function RealAsset({ kind, fallback, overlay, modelPosition, modelRotation }: {
  kind: NasaModel; fallback: ReactNode; overlay?: ReactNode;
  modelPosition?: [number, number, number]; modelRotation?: [number, number, number];
}) {
  const model = useNasaModel(kind);
  const instance = useMemo(() => (model ? model.clone(true) : null), [model]);
  return instance
    ? <><group position={modelPosition} rotation={modelRotation}><primitive object={instance} /></group>{overlay}</>
    : <>{fallback}</>;
}

// ---------------------------------------------------------------------------
// Real rocks: CC0 photogrammetry boulders (Poly Haven), instanced like the painted ones.
// ---------------------------------------------------------------------------

const ROCK_FILES: Record<'moon' | 'mars', string[]> = {
  // Poly Haven "Moon Rock" photogrammetry set (CC0).
  moon: ['rock_moon_1', 'rock_moon_2', 'rock_moon_3'],
  // Poly Haven "Namaqualand Boulder" red desert photogrammetry (CC0).
  mars: ['rock_mars_1', 'rock_mars_2'],
};

interface RockPart { geometry: THREE.BufferGeometry; material: THREE.Material }

const rockCache: Partial<Record<'moon' | 'mars', Promise<RockPart[]>>> = {};

function loadRocks(world: 'moon' | 'mars'): Promise<RockPart[]> {
  rockCache[world] ??= Promise.all(
    ROCK_FILES[world].map((file) =>
      loader().loadAsync(`${import.meta.env.BASE_URL}models/${file}.glb`).then((g) => {
        let part: RockPart | null = null;
        g.scene.traverse((o) => {
          if (part || !(o instanceof THREE.Mesh)) return;
          const geometry = o.geometry.clone();
          geometry.computeBoundingBox();
          const box = geometry.boundingBox as THREE.Box3;
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          // Bake a unit normalization into the geometry: max dimension 1, centred, base at y=0.
          const s = 1 / Math.max(size.x, size.y, size.z);
          geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));
          geometry.applyMatrix4(new THREE.Matrix4().makeScale(s, s, s));
          geometry.computeVertexNormals();
          const src = Array.isArray(o.material) ? o.material[0] : o.material;
          const material = src.clone();
          material.envMapIntensity = 0.5;
          part = { geometry, material };
        });
        if (!part) throw new Error(`no mesh in ${file}`);
        return part;
      }),
    ),
  );
  return rockCache[world] as Promise<RockPart[]>;
}

/**
 * The scattered boulders on the Moon and Mars: real photogrammetry rocks once loaded,
 * the painted instanced rocks otherwise. Same positions, sizes and colliders either way.
 */
export function RealRocks({ world, rocks, fallback }: { world: 'moon' | 'mars'; rocks: RockSpec[]; fallback: ReactNode }) {
  const [parts, setParts] = useState<RockPart[] | null>(null);
  useEffect(() => {
    let on = true;
    loadRocks(world).then((p) => { if (on) setParts(p); }).catch((err) => { console.warn(`Real ${world} rocks failed to load, keeping the painted rocks.`, err); });
    return () => { on = false; };
  }, [world]);
  const groups = useMemo(() => {
    if (!parts) return null;
    // Split the rock specs across the model variants round-robin, stable by index.
    return parts.map((part, i) => ({ part, specs: rocks.filter((_, j) => j % parts.length === i) }));
  }, [parts, rocks]);
  if (!groups) return <>{fallback}</>;
  return (
    <>
      {groups.map(({ part, specs }, i) => <RockInstances key={i} part={part} specs={specs} />)}
    </>
  );
}

function RockInstances({ part, specs }: { part: RockPart; specs: RockSpec[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    specs.forEach((r, i) => {
      // Sink a little into the regolith so rocks sit naturally instead of perfectly on top.
      dummy.position.set(r.x, r.y - r.s * r.sy * 0.14, r.z);
      dummy.rotation.set(r.rx, r.ry, r.rx * 0.5);
      // Painted rocks are unit spheres scaled by s; real rocks are unit-normalized the same way,
      // doubled so the visual size matches what the colliders and scenery expect.
      dummy.scale.set(r.s * 2, r.s * r.sy * 2, r.s * 1.8);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [specs]);
  return <instancedMesh ref={ref} args={[part.geometry, part.material, specs.length]} castShadow receiveShadow />;
}
