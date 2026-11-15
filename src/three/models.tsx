import { useEffect, useMemo, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// Real NASA 3D models (https://science.nasa.gov/3d-resources/), Draco-compressed GLBs.
// Each one replaces a code-drawn prop once it has loaded; the prop stays if it cannot be read.

export type NasaModel = 'lm' | 'perseverance';

/** Display size: the largest horizontal extent the model is scaled to, in metres. */
const CONFIG: Record<NasaModel, { file: string; width: number }> = {
  // Apollo Lunar Module, NASA 3D Resources (flag and "UNITED STATES" decals removed, panels left plain gold).
  lm: { file: 'lm', width: 7.0 },
  // Mars 2020 Perseverance Rover, NASA 3D Resources / JPL.
  perseverance: { file: 'perseverance', width: 3.0 },
};

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
  cache[kind] ??= loader()
    .loadAsync(`${import.meta.env.BASE_URL}models/${CONFIG[kind].file}.glb`)
    .then((g) => {
      const root = g.scene;
      // Normalize: scale the largest horizontal extent to the display size, feet to y=0.
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const scale = CONFIG[kind].width / Math.max(size.x, size.z);
      root.scale.setScalar(scale);
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
 * Renders the real NASA model once loaded, the code-drawn `fallback` until then
 * (and permanently if the file is missing). The model is cloned per use.
 * `overlay` renders only while the real model is on screen (markers that the
 * fallback prop already carries itself).
 */
export function RealAsset({ kind, fallback, overlay }: { kind: NasaModel; fallback: ReactNode; overlay?: ReactNode }) {
  const model = useNasaModel(kind);
  const instance = useMemo(() => (model ? model.clone(true) : null), [model]);
  return instance ? <><primitive object={instance} />{overlay}</> : <>{fallback}</>;
}
