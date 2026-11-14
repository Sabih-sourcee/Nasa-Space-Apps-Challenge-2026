import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from './GameCanvas';
import type { HeightFn, RockSpec } from './terrain';
import { earthTexture, fbm, grainTexture, groundTexture, rng, type GroundKind } from './textures';

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
export function EarthGlobe({ position, radius, spin = 0.01 }: { position: [number, number, number]; radius: number; spin?: number }) {
  const tex = useMemo(() => earthTexture(), []);
  const globe = useRef<THREE.Mesh>(null);
  const reduced = useReducedMotion();
  useFrame((_, d) => { if (globe.current && !reduced) globe.current.rotation.y += d * spin; });
  return (
    <group position={position}>
      <mesh ref={globe} rotation={[0.35, 2.2, 0.1]}>
        <sphereGeometry args={[radius, 64, 40]} />
        <meshStandardMaterial map={tex} roughness={0.85} metalness={0} emissive="#16335c" emissiveIntensity={0.12} fog={false} />
      </mesh>
      <mesh scale={1.025}>
        <sphereGeometry args={[radius, 48, 32]} />
        <meshBasicMaterial color="#6fb6ff" transparent opacity={0.16} side={THREE.BackSide} depthWrite={false} fog={false} />
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
    const bump = grainTexture().clone();
    bump.needsUpdate = true;
    bump.repeat.set(repeat * 2, repeat * 2);
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.2, roughness: 0.97, metalness: 0, color, vertexColors: true });
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
