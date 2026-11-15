import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from './GameCanvas';
import type { HeightFn, RockSpec } from './terrain';
import { earthMaps, realEarth, fbm, grainTexture, groundRelief, groundTexture, rng, type GroundKind } from './textures';

/** Gradient sky sphere. Colours are passed in so a dust storm can tint it live. */
export function SkyDome({ top, horizon, radius = 1100, tint }: { top: string; horizon: string; radius?: number; tint?: React.MutableRefObject<{ top: THREE.Color; horizon: THREE.Color } | null> }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vDir; void main(){ float t = pow(clamp(vDir.y, 0.0, 1.0), 0.55); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }',
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    mat.uniforms.top.value.set(top);
    mat.uniforms.horizon.value.set(horizon);
  }, [mat, top, horizon]);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
    if (tint?.current) {
      mat.uniforms.top.value.copy(tint.current.top);
      mat.uniforms.horizon.value.copy(tint.current.horizon);
    }
  });
  return <mesh ref={mesh} material={mat} renderOrder={-10}><sphereGeometry args={[radius, 32, 16]} /></mesh>;
}

export function Stars({ count = 1600, radius = 1000, opacity }: { count?: number; radius?: number; opacity?: React.MutableRefObject<number> }) {
  const geom = useMemo(() => {
    const r = rng(404);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1;
      const t = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(t) * s * radius;
      pos[i * 3 + 1] = u * radius;
      pos[i * 3 + 2] = Math.sin(t) * s * radius;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count, radius]);
  const pts = useRef<THREE.Points>(null);
  useFrame(({ camera }) => {
    if (!pts.current) return;
    pts.current.position.copy(camera.position);
    if (opacity) (pts.current.material as THREE.PointsMaterial).opacity = opacity.current;
  });
  return (
    <points ref={pts} geometry={geom} renderOrder={-9}>
      <pointsMaterial color="#ffffff" size={2.2} sizeAttenuation={false} transparent opacity={opacity ? opacity.current : 1} depthWrite={false} fog={false} />
    </points>
  );
}

/** Painted Earth with a thin blue atmosphere rim. Lit by the scene's Sun, so its phase is right. */
/** `below` is for a planet seen from orbit, under the camera: it turns the globe so warm latitudes face up, not the pole. */
export function EarthGlobe({ position, radius, spin = 0.01, below = false }: { position: [number, number, number]; radius: number; spin?: number; below?: boolean }) {
  const maps = useMemo(() => earthMaps(), []);
  // The NASA map takes over from the painted one as soon as it has loaded. Clouds stay painted.
  const [real, setReal] = useState<{ map: THREE.Texture; rough: THREE.Texture } | null>(null);
  useEffect(() => {
    let on = true;
    realEarth().then((r) => { if (on) setReal(r); }).catch(() => { /* keep the painted Earth */ });
    return () => { on = false; };
  }, []);
  const globe = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const reduced = useReducedMotion();
  // The thin blue line of air: brightest where you look through the most of it, at the edge.
  const air = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { tint: { value: new THREE.Color('#58a6ff') } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 tint; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.6); gl_FragColor = vec4(tint, f * 0.85); }',
  }), []);
  // Clouds: the soft cloud map sets where they are, and the same map repeated small breaks up their edges.
  const cloudMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', alphaMap: maps.clouds, transparent: true, depthWrite: false, roughness: 1, metalness: 0, emissive: '#8fa6c4', emissiveIntensity: 0.1, fog: false });
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphamap_fragment>', `#ifdef USE_ALPHAMAP
        float cBase = texture2D(alphaMap, vAlphaMapUv).g;
        float cFine = texture2D(alphaMap, vAlphaMapUv * vec2(23.0, 11.0)).g - 0.5;
        float cFiner = texture2D(alphaMap, vAlphaMapUv * vec2(97.0, 47.0) + 0.3).g - 0.5;
        diffuseColor.a *= smoothstep(0.36, 0.6, cBase + cFine * 0.26 + cFiner * 0.12) * 0.96;
      #endif`);
    };
    return m;
  }, [maps]);
  useFrame((_, d) => {
    if (reduced) return;
    if (globe.current) globe.current.rotation.y += d * spin;
    // Clouds drift a little faster than the ground turns.
    if (clouds.current) clouds.current.rotation.y += d * spin * 1.35;
  });
  return (
    <group position={position}>
      <group rotation={below ? [0.75, 0, 0.25] : [0, 0, 0]}>
      <mesh ref={globe} rotation={[0.35, 2.2, 0.1]}>
        <sphereGeometry args={[radius, 96, 64]} />
        <meshStandardMaterial map={real?.map ?? maps.map} roughnessMap={real?.rough ?? maps.rough} roughness={1} metalness={0} emissive="#16335c" emissiveIntensity={0.1} fog={false} />
      </mesh>
      <mesh ref={clouds} rotation={[0.35, 2.2, 0.1]} scale={1.006} material={cloudMat}>
        <sphereGeometry args={[radius, 96, 64]} />
      </mesh>
      </group>
      <mesh scale={1.012} material={air}>
        <sphereGeometry args={[radius, 64, 40]} />
      </mesh>
      <mesh scale={1.03}>
        <sphereGeometry args={[radius, 48, 32]} />
        <meshBasicMaterial color="#6fb6ff" transparent opacity={0.14} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
    </group>
  );
}

export function Terrain({ height, kind, size = 280, segments = 150, repeat = 40, color = '#ffffff' }: {
  height: HeightFn; kind: GroundKind; size?: number; segments?: number; repeat?: number; color?: string;
}) {
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size, segments, segments);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
    pos.needsUpdate = true;
    g.computeVertexNormals();
    // Broad light and dark patches break up the repeating ground texture.
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const v = 0.72 + fbm(x * 0.011, z * 0.011, 77) * 0.42 + fbm(x * 0.06, z * 0.06, 78) * 0.16;
      colors[i * 3] = v; colors[i * 3 + 1] = v; colors[i * 3 + 2] = v;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [height, size, segments]);
  const mat = useMemo(() => {
    const map = groundTexture(kind).clone();
    map.needsUpdate = true;
    map.repeat.set(repeat, repeat);
    // Moon and Mars have their own relief, lined up with the colour: crater rims, ripples and stones catch the sun.
    const own = kind === 'moon' || kind === 'mars';
    const bump = (own ? groundRelief(kind) : grainTexture()).clone();
    bump.needsUpdate = true;
    bump.repeat.set(own ? repeat : repeat * 2, own ? repeat : repeat * 2);
    const m = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: own ? 2.4 : 1.2, roughness: 0.97, metalness: 0, color, vertexColors: true });
    if (own) {
      // Seen from above, a repeated texture shows as a grid. Each sample is mixed with a second one
      // that is larger and turned, so the two never line up and the repeat is hidden.
      const second = 'mat2(0.829, -0.559, 0.559, 0.829) * UV * 0.29 + vec2(0.37, 0.11)';
      m.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <map_fragment>', `#ifdef USE_MAP
            diffuseColor *= mix(texture2D(map, vMapUv), texture2D(map, ${second.replace('UV', 'vMapUv')}), 0.45);
          #endif`)
          .replace('#include <bumpmap_pars_fragment>', THREE.ShaderChunk.bumpmap_pars_fragment
            .replace(/texture2D\(\s*bumpMap\s*,/g, 'bumpMix(')
            .replace('uniform float bumpScale;', `uniform float bumpScale;
              vec4 bumpMix(vec2 uv) { return mix(texture2D(bumpMap, uv), texture2D(bumpMap, ${second.replace('UV', 'uv')}), 0.45); }`));
      };
    }
    return m;
  }, [kind, repeat, color]);
  return <mesh geometry={geom} material={mat} receiveShadow />;
}

export function Rocks({ rocks, color }: { rocks: RockSpec[]; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    rocks.forEach((r, i) => {
      dummy.position.set(r.x, r.y, r.z);
      dummy.rotation.set(r.rx, r.ry, r.rx * 0.5);
      dummy.scale.set(r.s, r.s * r.sy, r.s * 0.9);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [rocks]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, rocks.length]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} roughness={0.95} flatShading />
    </instancedMesh>
  );
}

/** Ground ring plus a floating diamond that marks the current objective. */
export function ObjectiveMarker({ x, z, y = 0, color = '#4de3ff', visible = true, radius = 1.1 }: { x: number; z: number; y?: number; color?: string; visible?: boolean; radius?: number }) {
  const gem = useRef<THREE.Mesh>(null);
  const reduced = useReducedMotion();
  useFrame(({ clock }) => {
    if (!gem.current) return;
    gem.current.position.y = 2.9 + (reduced ? 0 : Math.sin(clock.elapsedTime * 2) * 0.18);
    if (!reduced) gem.current.rotation.y = clock.elapsedTime * 1.2;
  });
  if (!visible) return null;
  return (
    <group position={[x, y, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[radius * 0.82, radius, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} side={THREE.DoubleSide} fog={false} />
      </mesh>
      <mesh ref={gem} position={[0, 2.9, 0]} scale={[0.28, 0.42, 0.28]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={color} fog={false} />
      </mesh>
      <mesh position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 2.4, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} fog={false} />
      </mesh>
    </group>
  );
}

/** Soft dark disc under a flying or floating object. Reads altitude better than a shadow map alone. */
export function BlobShadow({ radius = 1, opacity = 0.45 }: { radius?: number; opacity?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 28]} />
      <meshBasicMaterial color="#000000" transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}
