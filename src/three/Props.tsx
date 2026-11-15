import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from './GameCanvas';
import { foilTexture, grainTexture, insigniaTexture, labelTexture, panelTexture, solarCellTexture } from './textures';

// Shared materials. Created once and reused by every prop.
let shared: ReturnType<typeof build> | null = null;
function build() {
  const hull = panelTexture('#e6e8ea', '#9aa0a6');
  const hullWarm = panelTexture('#d9cfc0', '#9a8f80', 'panelwarm');
  const foil = foilTexture();
  const grain = grainTexture();
  return {
    hull: new THREE.MeshStandardMaterial({ map: hull, roughness: 0.55, metalness: 0.25 }),
    hullWarm: new THREE.MeshStandardMaterial({ map: hullWarm, roughness: 0.7, metalness: 0.15 }),
    foil: new THREE.MeshStandardMaterial({ map: foil, roughness: 0.32, metalness: 0.85, bumpMap: foil, bumpScale: 2 }),
    steel: new THREE.MeshStandardMaterial({ color: '#8d949c', roughness: 0.42, metalness: 0.85 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.5, metalness: 0.7 }),
    black: new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.6, metalness: 0.2 }),
    glass: new THREE.MeshStandardMaterial({ color: '#0d1826', roughness: 0.08, metalness: 0.9, envMapIntensity: 2 }),
    white: new THREE.MeshStandardMaterial({ color: '#eceeef', roughness: 0.6, bumpMap: grain, bumpScale: 0.3 }),
    red: new THREE.MeshStandardMaterial({ color: '#b3202a', roughness: 0.6 }),
    navy: new THREE.MeshStandardMaterial({ color: '#0b1c3d', roughness: 0.6 }),
    orange: new THREE.MeshStandardMaterial({ color: '#c8641e', roughness: 0.75 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#e0b021', roughness: 0.6, metalness: 0.3 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#2a2b2d', roughness: 0.9 }),
    solar: new THREE.MeshStandardMaterial({ map: solarCellTexture(), roughness: 0.25, metalness: 0.6, side: THREE.DoubleSide }),
    patch: new THREE.MeshStandardMaterial({ map: insigniaTexture(), transparent: true, roughness: 0.7 }),
    fabric: new THREE.MeshStandardMaterial({ color: '#e8e6df', roughness: 0.9, bumpMap: grain, bumpScale: 0.6 }),
  };
}
export function M() {
  if (!shared) shared = build();
  return shared;
}

type V3 = [number, number, number];

/** A thin strut between two points. */
export function Strut({ a, b, r = 0.05, material }: { a: V3; b: V3; r?: number; material?: THREE.Material }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const l = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return { pos: va.add(vb).multiplyScalar(0.5), quat: q, len: l };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat} material={material ?? M().steel} castShadow>
      <cylinderGeometry args={[r, r, len, 8]} />
    </mesh>
  );
}

export function Sign({ lines, position, rotation = [0, 0, 0], size = [2.4, 0.9], accent }: { lines: string[]; position: V3; rotation?: V3; size?: [number, number]; accent?: string }) {
  const tex = useMemo(() => labelTexture(lines, { accent }), [lines.join('|'), accent]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshStandardMaterial map={tex} roughness={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Engine exhaust that grows with thrust. */
export function Exhaust({ power, length = 3, radius = 0.5, color = '#ffd9a0', glow = false }: { power: React.MutableRefObject<number>; length?: number; radius?: number; color?: string; glow?: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const reduced = useReducedMotion();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const p = power.current;
    const flicker = reduced ? 1 : 0.9 + Math.sin(clock.elapsedTime * 40) * 0.1;
    ref.current.visible = p > 0.02;
    ref.current.scale.set(1, Math.max(0.01, p * flicker), 1);
  });
  return (
    <mesh ref={ref} position={[0, -length / 2, 0]} rotation={[Math.PI, 0, 0]} visible={false}>
      <coneGeometry args={[radius, length, 18, 1, true]} />
      {/* A big engine's flame glows: it adds its light to what is behind it and has a white-hot centre. */}
      <meshBasicMaterial color={color} transparent opacity={glow ? 0.34 : 0.8} side={THREE.DoubleSide} depthWrite={false} fog={false} blending={glow ? THREE.AdditiveBlending : THREE.NormalBlending} />
      {glow && (
        <mesh scale={[0.45, 0.8, 0.45]} position={[0, length * 0.1, 0]}>
          <coneGeometry args={[radius, length, 14, 1, true]} />
          <meshBasicMaterial color="#fff4dc" transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} fog={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
    </mesh>
  );
}

/** Four-legged lunar lander: foil-wrapped descent stage under a faceted crew cabin. */
export function LunarLander({ power }: { power?: React.MutableRefObject<number> }) {
  const m = M();
  const legs = [0, 1, 2, 3].map((i) => (i * Math.PI) / 2 + Math.PI / 4);
  return (
    <group>
      <mesh position={[0, 1.95, 0]} material={m.foil} castShadow receiveShadow><cylinderGeometry args={[2.1, 2.1, 1.35, 8]} /></mesh>
      <mesh position={[0, 1.2, 0]} material={m.darkSteel} castShadow><cylinderGeometry args={[0.5, 0.95, 0.95, 16, 1, true]} /></mesh>
      {legs.map((a, i) => {
        const c = Math.cos(a), s = Math.sin(a);
        return (
          <group key={i}>
            <Strut a={[c * 1.9, 2.4, s * 1.9]} b={[c * 3.5, 0.2, s * 3.5]} r={0.07} material={m.foil} />
            <Strut a={[c * 1.9, 1.4, s * 1.9]} b={[c * 3.5, 0.2, s * 3.5]} r={0.05} />
            <mesh position={[c * 3.5, 0.1, s * 3.5]} material={m.foil} castShadow><cylinderGeometry args={[0.5, 0.42, 0.18, 14]} /></mesh>
          </group>
        );
      })}
      {/* Ascent cabin */}
      <mesh position={[0, 3.55, 0]} material={m.hull} castShadow><cylinderGeometry args={[1.25, 1.6, 1.85, 8]} /></mesh>
      <mesh position={[0, 3.6, 1.25]} material={m.steel} castShadow><boxGeometry args={[1.7, 1.3, 0.7]} /></mesh>
      <mesh position={[-0.45, 3.85, 1.61]} rotation={[0, 0, 0.5]} material={m.glass}><planeGeometry args={[0.5, 0.42]} /></mesh>
      <mesh position={[0.45, 3.85, 1.61]} rotation={[0, 0, -0.5]} material={m.glass}><planeGeometry args={[0.5, 0.42]} /></mesh>
      <mesh position={[0, 3.2, 1.61]} material={m.black}><planeGeometry args={[0.7, 0.75]} /></mesh>
      <mesh position={[0, 4.6, 0]} material={m.steel}><cylinderGeometry args={[0.45, 0.45, 0.3, 14]} /></mesh>
      <mesh position={[0, 3.55, -1.52]} rotation={[0, Math.PI, 0]} material={m.patch}><circleGeometry args={[0.45, 24]} /></mesh>
      {/* Dish and ladder */}
      <Strut a={[-1.0, 4.4, -0.3]} b={[-1.5, 5.3, -0.5]} r={0.03} />
      <mesh position={[-1.5, 5.4, -0.5]} rotation={[0.9, 0, 0.5]} material={m.white}><sphereGeometry args={[0.5, 16, 8, 0, Math.PI * 2, 0, 0.9]} /></mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const t = i / 5;
        return <mesh key={i} position={[0, 0.5 + t * 1.9, 2.55 - t * 1.05]} material={m.steel}><boxGeometry args={[0.6, 0.04, 0.06]} /></mesh>;
      })}
      {power && <group position={[0, 0.8, 0]}><Exhaust power={power} length={3.4} radius={0.75} /></group>}
    </group>
  );
}

/** Mars lander: wider, heavier, cone-shaped cabin on a deck, with four engines. */
export function MarsLander({ power }: { power?: React.MutableRefObject<number> }) {
  const m = M();
  const legs = [0, 1, 2, 3].map((i) => (i * Math.PI) / 2 + Math.PI / 4);
  return (
    <group>
      <mesh position={[0, 1.55, 0]} material={m.hullWarm} castShadow receiveShadow><cylinderGeometry args={[2.6, 2.75, 0.85, 20]} /></mesh>
      <mesh position={[0, 3.25, 0]} material={m.hull} castShadow><cylinderGeometry args={[1.15, 2.3, 2.6, 20]} /></mesh>
      <mesh position={[0, 4.7, 0]} material={m.steel} castShadow><cylinderGeometry args={[0.7, 1.15, 0.35, 20]} /></mesh>
      <mesh position={[0, 2.25, 0]} material={m.red}><cylinderGeometry args={[2.32, 2.32, 0.12, 20]} /></mesh>
      <mesh position={[0, 3.0, 1.82]} rotation={[-0.4, 0, 0]} material={m.black}><planeGeometry args={[0.9, 1.3]} /></mesh>
      <mesh position={[0.95, 3.6, 1.32]} rotation={[-0.4, 0.6, 0]} material={m.glass}><circleGeometry args={[0.24, 16]} /></mesh>
      <mesh position={[-0.95, 3.6, 1.32]} rotation={[-0.4, -0.6, 0]} material={m.glass}><circleGeometry args={[0.24, 16]} /></mesh>
      {legs.map((a, i) => {
        const c = Math.cos(a), s = Math.sin(a);
        return (
          <group key={i}>
            <Strut a={[c * 2.4, 1.6, s * 2.4]} b={[c * 3.9, 0.2, s * 3.9]} r={0.09} />
            <Strut a={[c * 1.6, 1.2, s * 1.6]} b={[c * 3.9, 0.2, s * 3.9]} r={0.05} />
            <mesh position={[c * 3.9, 0.1, s * 3.9]} material={m.darkSteel} castShadow><cylinderGeometry args={[0.55, 0.5, 0.2, 14]} /></mesh>
            <mesh position={[c * 1.5, 0.95, s * 1.5]} material={m.darkSteel}><cylinderGeometry args={[0.2, 0.34, 0.5, 12, 1, true]} /></mesh>
          </group>
        );
      })}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const t = i / 5;
        return <mesh key={i} position={[0, 0.4 + t * 1.5, 3.3 - t * 0.7]} material={m.steel}><boxGeometry args={[0.7, 0.04, 0.06]} /></mesh>;
      })}
      {power && <group position={[0, 0.7, 0]}><Exhaust power={power} length={3.8} radius={1.1} color="#ffe2b8" /></group>}
    </group>
  );
}

export function Parachute({ visible }: { visible: boolean }) {
  const m = M();
  if (!visible) return null;
  const lines = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i * Math.PI) / 4);
  return (
    <group position={[0, 4.8, 0]}>
      <mesh position={[0, 15, 0]} castShadow>
        <sphereGeometry args={[7, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
        <meshStandardMaterial color="#e8e6df" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 15.02, 0]}>
        <sphereGeometry args={[7.02, 24, 4, 0, Math.PI * 2, Math.PI * 0.2, Math.PI * 0.08]} />
        <meshStandardMaterial color="#c8641e" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {lines.map((a, i) => <Strut key={i} a={[0, 0, 0]} b={[Math.cos(a) * 6.9, 16, Math.sin(a) * 6.9]} r={0.02} material={m.white} />)}
    </group>
  );
}

/** Surface habitat: a horizontal pressure module with an airlock, dome and beacon. */
export function Habitat({ tint = 'moon', beacon = false }: { tint?: 'moon' | 'mars'; beacon?: boolean }) {
  const m = M();
  const body = tint === 'mars' ? m.hullWarm : m.hull;
  const lamp = useRef<THREE.MeshStandardMaterial>(null);
  const reduced = useReducedMotion();
  useFrame(({ clock }) => {
    if (!lamp.current) return;
    const on = beacon ? (reduced ? 1 : 0.5 + 0.5 * Math.sin(clock.elapsedTime * 5)) : 0.25;
    lamp.current.emissiveIntensity = 0.4 + on * 4;
  });
  return (
    <group>
      {/* Main module (axis along x) */}
      <mesh position={[0, 2.5, -4.5]} rotation={[0, 0, Math.PI / 2]} material={body} castShadow receiveShadow><cylinderGeometry args={[2.5, 2.5, 11, 28]} /></mesh>
      <mesh position={[5.5, 2.5, -4.5]} material={body} castShadow><sphereGeometry args={[2.5, 24, 16]} /></mesh>
      <mesh position={[-5.5, 2.5, -4.5]} material={body} castShadow><sphereGeometry args={[2.5, 24, 16]} /></mesh>
      {[-4, -1.3, 1.3, 4].map((x) => <mesh key={x} position={[x, 2.5, -4.5]} rotation={[0, 0, Math.PI / 2]} material={m.steel}><torusGeometry args={[2.53, 0.07, 8, 32]} /></mesh>)}
      {[-4, 0, 4].map((x) => <mesh key={x} position={[x, 0.4, -4.5]} material={m.darkSteel} castShadow><boxGeometry args={[0.5, 0.9, 4.4]} /></mesh>)}
      {[-3, 3].map((x) => <mesh key={x} position={[x, 3.1, -2.03]} material={m.glass}><circleGeometry args={[0.42, 20]} /></mesh>)}
      {/* Airlock facing the player */}
      <mesh position={[0, 1.6, -1.2]} material={body} castShadow receiveShadow><boxGeometry args={[3, 3.1, 2.6]} /></mesh>
      <mesh position={[0, 1.45, 0.11]} material={m.darkSteel}><boxGeometry args={[1.5, 2.3, 0.08]} /></mesh>
      <mesh position={[0, 1.45, 0.16]} material={m.steel}><boxGeometry args={[1.3, 2.1, 0.06]} /></mesh>
      <mesh position={[0, 1.9, 0.2]} material={m.glass}><circleGeometry args={[0.22, 16]} /></mesh>
      <mesh position={[0, 3.3, 0.12]}>
        <boxGeometry args={[1.5, 0.22, 0.08]} />
        <meshStandardMaterial ref={lamp} color="#fff4d6" emissive={beacon ? '#ffb020' : '#fff4d6'} emissiveIntensity={1} />
      </mesh>
      <Sign lines={['HABITAT AIRLOCK']} position={[0, 2.9, 0.13]} size={[1.5, 0.36]} />
      {/* Dome module and mast */}
      <mesh position={[-8.6, 0, -6]} material={body} castShadow><sphereGeometry args={[3.2, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      <Strut a={[7.2, 0, -7]} b={[7.2, 8.5, -7]} r={0.07} />
      <mesh position={[7.2, 8.2, -6.6]} rotation={[1.0, 0, 0]} material={m.white}><sphereGeometry args={[0.8, 16, 8, 0, Math.PI * 2, 0, 0.9]} /></mesh>
    </group>
  );
}

/** Row of fixed solar panels beside the habitat. `brightness` lets shadow and dust dim them. */
export function SolarArray({ count = 3, dust = 0 }: { count?: number; dust?: number }) {
  const m = M();
  const mat = useMemo(() => m.solar.clone(), [m]);
  mat.color.setRGB(1 + dust * 0.4, 1 - dust * 0.3, 1 - dust * 0.6); // dust turns the cells rusty
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} position={[i * 3.6, 0, 0]}>
          <Strut a={[0, 0, 0]} b={[0, 1.7, 0]} r={0.07} />
          <mesh position={[0, 1.9, 0]} rotation={[-0.75, 0, 0]} material={mat} castShadow><boxGeometry args={[3.2, 0.06, 2]} /></mesh>
        </group>
      ))}
    </group>
  );
}

/** Folding solar panel the astronaut deploys by hand. */
export function DeployablePanel({ deployed }: { deployed: boolean }) {
  const m = M();
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    const target = deployed ? 0 : 1.5;
    const k = 1 - Math.exp(-4 * Math.min(d, 0.1));
    if (left.current) left.current.rotation.z += (target - left.current.rotation.z) * k;
    if (right.current) right.current.rotation.z += (-target - right.current.rotation.z) * k;
  });
  return (
    <group>
      <mesh position={[0, 0.3, 0]} material={m.darkSteel} castShadow><boxGeometry args={[0.7, 0.6, 0.7]} /></mesh>
      <Strut a={[0, 0.6, 0]} b={[0, 1.4, 0]} r={0.05} />
      <group position={[0, 1.45, 0]} rotation={[-0.6, 0, 0]}>
        <group ref={left} position={[0.1, 0, 0]} rotation={[0, 0, 1.5]}>
          <mesh position={[0.95, 0, 0]} material={m.solar} castShadow><boxGeometry args={[1.9, 0.05, 1.3]} /></mesh>
        </group>
        <group ref={right} position={[-0.1, 0, 0]} rotation={[0, 0, -1.5]}>
          <mesh position={[-0.95, 0, 0]} material={m.solar} castShadow><boxGeometry args={[1.9, 0.05, 1.3]} /></mesh>
        </group>
      </group>
    </group>
  );
}

/** Six-wheeled rover with a mast camera and a solar deck. `dust` tints the deck. */
export function Rover({ dust = 0, wheelAlert = false }: { dust?: number; wheelAlert?: boolean }) {
  const m = M();
  const deck = useMemo(() => m.solar.clone(), [m]);
  deck.color.setRGB(1 + dust * 0.3, 1 - dust * 0.45, 1 - dust * 0.7);
  const wheels: V3[] = [[-1.15, 0.38, 0.95], [0, 0.38, 1.0], [1.15, 0.38, 0.95], [-1.15, 0.38, -0.95], [0, 0.38, -1.0], [1.15, 0.38, -0.95]];
  return (
    <group>
      <mesh position={[0, 0.95, 0]} material={m.white} castShadow receiveShadow><boxGeometry args={[2.5, 0.5, 1.45]} /></mesh>
      <mesh position={[0, 1.24, 0]} material={deck} castShadow><boxGeometry args={[2.3, 0.05, 1.3]} /></mesh>
      {wheels.map((p, i) => (
        <group key={i}>
          <mesh position={p} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.38, 0.38, 0.3, 18]} />
            <meshStandardMaterial color={wheelAlert && i === 0 ? '#ffb020' : '#55595f'} roughness={0.6} metalness={0.6} emissive={wheelAlert && i === 0 ? '#ffb020' : '#000000'} emissiveIntensity={wheelAlert && i === 0 ? 1.2 : 0} />
          </mesh>
          <Strut a={[p[0], 0.4, p[2] * 0.8]} b={[p[0] * 0.6, 0.9, p[2] * 0.55]} r={0.045} />
        </group>
      ))}
      <Strut a={[0.9, 1.2, 0.3]} b={[0.9, 2.3, 0.3]} r={0.05} />
      <mesh position={[0.9, 2.38, 0.3]} material={m.white} castShadow><boxGeometry args={[0.46, 0.22, 0.26]} /></mesh>
      <mesh position={[1.14, 2.38, 0.3]} rotation={[0, Math.PI / 2, 0]} material={m.glass}><circleGeometry args={[0.08, 12]} /></mesh>
      <Strut a={[-1.0, 1.2, -0.4]} b={[-1.3, 1.9, -0.6]} r={0.03} />
      <mesh position={[-1.3, 1.95, -0.6]} rotation={[0.7, 0, 0.4]} material={m.white}><sphereGeometry args={[0.32, 14, 8, 0, Math.PI * 2, 0, 0.9]} /></mesh>
      <mesh position={[1.3, 0.95, 0]} rotation={[0, Math.PI / 2, 0]} material={m.patch}><circleGeometry args={[0.2, 20]} /></mesh>
    </group>
  );
}

/** Soft equipment pouch carried on every world. */
export function Pouch() {
  const m = M();
  return (
    <group>
      <mesh material={m.fabric} castShadow><boxGeometry args={[0.38, 0.28, 0.22]} /></mesh>
      <mesh position={[0, 0, 0]} material={m.red}><boxGeometry args={[0.385, 0.06, 0.225]} /></mesh>
      <mesh position={[0, 0.17, 0]} rotation={[0, 0, Math.PI / 2]} material={m.darkSteel}><torusGeometry args={[0.06, 0.012, 6, 14, Math.PI]} /></mesh>
    </group>
  );
}

/** Fictional shuttle-class launch craft: winged orbiter on a core stage with two boosters. */
/** The crew orbiter that rides on top of the stack and flies on alone. Its base is at the origin, nose up. */
export function Orbiter({ power }: { power?: React.MutableRefObject<number> }) {
  const m = M();
  return (
    <group>
      <mesh position={[0, 3.5, 0]} material={m.hull} castShadow><cylinderGeometry args={[2.3, 2.6, 7, 28]} /></mesh>
      <mesh position={[0, 9.2, 0]} material={m.white} castShadow><sphereGeometry args={[2.3, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      <mesh position={[0, 9.2, 0]} scale={[1, 2.1, 1]} material={m.white} castShadow><sphereGeometry args={[2.3, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      <mesh position={[0, 10.6, 1.72]} rotation={[-0.62, 0, 0]} material={m.glass}><planeGeometry args={[2.2, 0.9]} /></mesh>
      <mesh position={[0, 3.5, 2.2]} material={m.black}><boxGeometry args={[4.4, 6.6, 0.25]} /></mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * 3.6, 2, 1.9]} rotation={[0, 0, sd * -0.35]} material={m.white} castShadow><boxGeometry args={[4.2, 4.6, 0.3]} /></mesh>
      ))}
      <mesh position={[0, 2.3, -2.9]} material={m.white} castShadow><boxGeometry args={[0.3, 4.2, 2.4]} /></mesh>
      <mesh position={[0, 5.5, -2.45]} rotation={[0, Math.PI, 0]} material={m.patch}><circleGeometry args={[1.1, 28]} /></mesh>
      {/* Hull detail: panel seams, a payload bay line, side windows, thruster pods and an antenna */}
      {[0.9, 2.6, 4.3, 6.2].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.darkSteel}><torusGeometry args={[2.47 - (y - 0.9) * 0.045, 0.025, 6, 40]} /></mesh>)}
      <mesh position={[0, 3.6, -2.47]} material={m.darkSteel}><boxGeometry args={[0.05, 5.6, 0.05]} /></mesh>
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh position={[sd * 1.25, 10.3, 1.35]} rotation={[-0.62, sd * 0.75, 0]} material={m.glass}><planeGeometry args={[0.9, 0.6]} /></mesh>
          {/* Thruster pods near the nose and the tail, each with two small nozzles */}
          {[8.6, 0.9].map((y) => (
            <group key={y} position={[sd * (y > 5 ? 2.2 : 2.55), y, 0]}>
              <mesh material={m.white}><boxGeometry args={[0.45, 0.7, 0.7]} /></mesh>
              {[-0.18, 0.18].map((z) => <mesh key={z} position={[sd * 0.28, 0, z]} rotation={[0, 0, sd * -Math.PI / 2]} material={m.darkSteel}><cylinderGeometry args={[0.07, 0.12, 0.16, 10, 1, true]} /></mesh>)}
            </group>
          ))}
          {/* Outer engine bells either side of the main one */}
          <mesh position={[sd * 1.25, -0.4, 0]} material={m.darkSteel}><cylinderGeometry args={[0.4, 0.68, 0.9, 16, 1, true]} /></mesh>
        </group>
      ))}
      <Strut a={[0.9, 8.2, -2.1]} b={[1.3, 10.4, -3.1]} r={0.03} />
      <mesh position={[1.3, 10.45, -3.12]} material={m.steel}><sphereGeometry args={[0.09, 10, 8]} /></mesh>
      {/* Docking ring on the nose, and the orbiter's own engine at the base */}
      <mesh position={[0, 13.9, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.steel}><torusGeometry args={[0.42, 0.07, 8, 28]} /></mesh>
      <mesh position={[0, -0.5, 0]} material={m.darkSteel}><cylinderGeometry args={[0.7, 1.15, 1.1, 20, 1, true]} /></mesh>
      {power && <group position={[0, -1, 0]}><Exhaust power={power} length={7} radius={0.9} color="#9fd0ff" glow /></group>}
    </group>
  );
}

/** Refs to the parts of the stack that leave during the climb, and the power of each set of engines. */
export interface StackParts {
  core?: React.Ref<THREE.Group>;
  boosterL?: React.Ref<THREE.Group>;
  boosterR?: React.Ref<THREE.Group>;
  orbiter?: React.Ref<THREE.Group>;
  boosterPower?: React.MutableRefObject<number>;
  corePower?: React.MutableRefObject<number>;
  orbiterPower?: React.MutableRefObject<number>;
}

/**
 * The training launch vehicle: a core stage, two side boosters and the orbiter
 * on top. Each part is its own group so it can separate.
 */
export function ShuttleStack({ parts }: { parts?: StackParts } = {}) {
  const m = M();
  return (
    <group>
      <group ref={parts?.core}>
        <mesh position={[0, 19, 0]} material={m.hull} castShadow><cylinderGeometry args={[2.6, 2.6, 34, 28]} /></mesh>
        <mesh position={[0, 30, 0]} material={m.navy}><cylinderGeometry args={[2.63, 2.63, 1.2, 28]} /></mesh>
        <mesh position={[0, 8, 0]} material={m.red}><cylinderGeometry args={[2.63, 2.63, 0.6, 28]} /></mesh>
        <mesh position={[0, 1.2, 0]} material={m.darkSteel}><cylinderGeometry args={[1.5, 2.2, 2.2, 20, 1, true]} /></mesh>
        {/* Tank ribs and the fuel line that runs down the outside */}
        {[5, 12, 16, 24, 27, 34].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.steel}><torusGeometry args={[2.62, 0.04, 6, 40]} /></mesh>)}
        <mesh position={[0, 18, 2.68]} material={m.steel}><cylinderGeometry args={[0.14, 0.14, 26, 10]} /></mesh>
        {parts?.corePower && <Exhaust power={parts.corePower} length={46} radius={2.4} color="#ffb46a" glow />}
      </group>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 3.9, 0, 0]}>
          <group ref={sd < 0 ? parts?.boosterL : parts?.boosterR}>
            <mesh position={[0, 14, 0]} material={m.white} castShadow><cylinderGeometry args={[1.25, 1.25, 26, 20]} /></mesh>
            <mesh position={[0, 28.6, 0]} material={m.white} castShadow><coneGeometry args={[1.25, 3.2, 20]} /></mesh>
            <mesh position={[0, 0.9, 0]} material={m.darkSteel}><cylinderGeometry args={[0.9, 1.4, 1.8, 16, 1, true]} /></mesh>
            <mesh position={[0, 20, 0]} material={m.navy}><cylinderGeometry args={[1.27, 1.27, 0.8, 20]} /></mesh>
            {/* Struts that hold the booster to the core until it lets go */}
            {[8, 22].map((y) => <mesh key={y} position={[-sd * 1.3, y, 0]} material={m.darkSteel}><boxGeometry args={[1.3, 0.3, 0.3]} /></mesh>)}
            {parts?.boosterPower && <Exhaust power={parts.boosterPower} length={38} radius={1.3} color="#ffd08a" glow />}
          </group>
        </group>
      ))}
      <group ref={parts?.orbiter} position={[0, 36, 0]}><Orbiter power={parts?.orbiterPower} /></group>
    </group>
  );
}

export function LaunchTower({ height = 52 }: { height?: number }) {
  const m = M();
  const levels = Math.floor(height / 4);
  const w = 3;
  return (
    <group>
      {[[-w, -w], [w, -w], [-w, w], [w, w]].map(([x, z], i) => (
        <mesh key={i} position={[x, height / 2, z]} material={m.steel} castShadow><boxGeometry args={[0.35, height, 0.35]} /></mesh>
      ))}
      {Array.from({ length: levels + 1 }, (_, i) => (
        <group key={i} position={[0, i * 4, 0]}>
          <mesh position={[0, 0, -w]} material={m.steel}><boxGeometry args={[w * 2, 0.2, 0.2]} /></mesh>
          <mesh position={[0, 0, w]} material={m.steel}><boxGeometry args={[w * 2, 0.2, 0.2]} /></mesh>
          <mesh position={[-w, 0, 0]} material={m.steel}><boxGeometry args={[0.2, 0.2, w * 2]} /></mesh>
          <mesh position={[w, 0, 0]} material={m.steel}><boxGeometry args={[0.2, 0.2, w * 2]} /></mesh>
          {i < levels && <Strut a={[-w, 0, w]} b={[w, 4, w]} r={0.07} />}
          {i < levels && <Strut a={[w, 0, -w]} b={[w, 4, w]} r={0.07} />}
        </group>
      ))}
      <mesh position={[0, height + 6, 0]} material={m.steel}><cylinderGeometry args={[0.08, 0.2, 12, 8]} /></mesh>
      <mesh position={[6.5, 42, 0]} material={m.white} castShadow><boxGeometry args={[9, 2.2, 2.2]} /></mesh>
      <mesh position={[5.5, 26, 0]} material={m.steel}><boxGeometry args={[6, 0.5, 1.2]} /></mesh>
    </group>
  );
}

/** Fictional orbital station seen from the approaching shuttle. The docking port faces +z. */
export function StationExterior({ portColor = '#35e07a' }: { portColor?: string }) {
  const m = M();
  return (
    <group>
      {/* Docking module and port */}
      <mesh position={[0, 0, -3]} rotation={[Math.PI / 2, 0, 0]} material={m.hull}><cylinderGeometry args={[2.2, 2.2, 6, 28]} /></mesh>
      <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]} material={m.steel}><cylinderGeometry args={[1.25, 1.5, 0.5, 28]} /></mesh>
      <mesh position={[0, 0, 0.36]} material={m.black}><circleGeometry args={[1.1, 28]} /></mesh>
      <mesh position={[0, 0, 0.38]}><ringGeometry args={[1.12, 1.26, 36]} /><meshBasicMaterial color={portColor} /></mesh>
      <mesh position={[0, 0, 0.39]}><planeGeometry args={[1.5, 0.07]} /><meshBasicMaterial color="#f2f4f7" /></mesh>
      <mesh position={[0, 0, 0.39]}><planeGeometry args={[0.07, 1.5]} /><meshBasicMaterial color="#f2f4f7" /></mesh>
      <mesh position={[0, 0, 0.4]}><ringGeometry args={[0.28, 0.34, 24]} /><meshBasicMaterial color="#f2f4f7" /></mesh>
      {/* Node and crossing modules */}
      <mesh position={[0, 0, -8]} material={m.hull}><sphereGeometry args={[2.9, 24, 16]} /></mesh>
      <mesh position={[0, 0, -16]} rotation={[Math.PI / 2, 0, 0]} material={m.hull}><cylinderGeometry args={[2.3, 2.3, 12, 28]} /></mesh>
      <mesh position={[8, 0, -8]} rotation={[0, 0, Math.PI / 2]} material={m.hull}><cylinderGeometry args={[2.1, 2.1, 11, 28]} /></mesh>
      <mesh position={[-8, 0, -8]} rotation={[0, 0, Math.PI / 2]} material={m.hull}><cylinderGeometry args={[2.1, 2.1, 11, 28]} /></mesh>
      <mesh position={[0, 0, -8]} rotation={[0, 0, Math.PI / 2]} material={m.navy}><torusGeometry args={[2.95, 0.12, 8, 32]} /></mesh>
      {/* Module seams, hatch rings on the node, a robotic arm and navigation lights */}
      {[-12, -19.5].map((z) => <mesh key={z} position={[0, 0, z]} material={m.steel}><torusGeometry args={[2.36, 0.07, 8, 32]} /></mesh>)}
      {[[0, 2.92, -8, Math.PI / 2, 0], [0, -2.92, -8, Math.PI / 2, 0]].map(([x, y, z, rx], i) => <mesh key={i} position={[x, y, z]} rotation={[rx, 0, 0]} material={m.darkSteel}><torusGeometry args={[0.8, 0.09, 8, 24]} /></mesh>)}
      <Strut a={[3.2, 2.0, -9]} b={[6.5, 5.2, -6]} r={0.09} />
      <Strut a={[6.5, 5.2, -6]} b={[9.6, 3.4, -2.6]} r={0.08} />
      <mesh position={[6.5, 5.2, -6]} material={m.steel}><sphereGeometry args={[0.2, 12, 10]} /></mesh>
      <mesh position={[9.6, 3.4, -2.6]} material={m.yellow}><boxGeometry args={[0.35, 0.35, 0.5]} /></mesh>
      <mesh position={[13.95, 2.1, -8]}><sphereGeometry args={[0.16, 10, 8]} /><meshBasicMaterial color="#35e07a" /></mesh>
      <mesh position={[-13.7, 2.1, -8]}><sphereGeometry args={[0.16, 10, 8]} /><meshBasicMaterial color="#ff3b30" /></mesh>
      <mesh position={[0, 2.5, -21.8]}><sphereGeometry args={[0.16, 10, 8]} /><meshBasicMaterial color="#f2f4f7" /></mesh>
      {/* Laboratory module: a band of windows and a ring of handrails */}
      {[-11.5, -9.5, -7.5, -5.5].map((x) => <mesh key={x} position={[x, 0.9, -5.93]} material={m.glass}><circleGeometry args={[0.42, 16]} /></mesh>)}
      {[-12.6, -3.4, 3.4, 12.6].map((x) => <mesh key={x} position={[x, 0, -8]} rotation={[0, Math.PI / 2, 0]} material={m.steel}><torusGeometry args={[2.16, 0.07, 8, 28]} /></mesh>)}
      {/* End caps with a spare docking adapter on the far module */}
      <mesh position={[13.6, 0, -8]} rotation={[0, 0, -Math.PI / 2]} material={m.steel}><cylinderGeometry args={[1.2, 1.5, 0.6, 24]} /></mesh>
      <mesh position={[13.92, 0, -8]} rotation={[0, Math.PI / 2, 0]} material={m.black}><circleGeometry args={[1.05, 24]} /></mesh>
      <mesh position={[-13.6, 0, -8]} rotation={[0, 0, Math.PI / 2]} material={m.white}><sphereGeometry args={[2.1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      {/* Radiators: white panels that shed the station's waste heat, edge-on to the Sun */}
      {[-11, 11].map((x) => (
        <group key={x} position={[x, 4.2, -16]}>
          <mesh position={[0, 0, 4.6]} material={m.white}><boxGeometry args={[0.12, 3, 6.5]} /></mesh>
          <mesh position={[0, 0, -4.6]} material={m.white}><boxGeometry args={[0.12, 3, 6.5]} /></mesh>
        </group>
      ))}
      {/* Communications dish and a pair of whip antennas */}
      <group position={[4.5, 5.6, -16]} rotation={[0.5, 0.4, 0]}>
        <Strut a={[0, -0.8, 0]} b={[0, 0.6, 0]} r={0.08} />
        <mesh position={[0, 0.9, 0]} rotation={[Math.PI, 0, 0]} material={m.white}><sphereGeometry args={[1.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3]} /></mesh>
        <mesh position={[0, 0.2, 0]} material={m.steel}><cylinderGeometry args={[0.05, 0.05, 1.2, 8]} /></mesh>
      </group>
      {[-2.6, 2.6].map((x) => <Strut key={x} a={[x, 2.1, -20]} b={[x, 5.4, -21]} r={0.04} />)}
      {/* Truss and solar wings */}
      <mesh position={[0, 4.2, -16]} material={m.steel}><boxGeometry args={[56, 1.1, 1.1]} /></mesh>
      <Strut a={[0, 2.2, -16]} b={[0, 4.2, -16]} r={0.3} />
      {[-25, -17, 17, 25].map((x) => (
        <group key={x} position={[x, 4.2, -16]}>
          <mesh position={[0, 8, 0]} material={m.solar}><boxGeometry args={[6, 14, 0.12]} /></mesh>
          <mesh position={[0, -8, 0]} material={m.solar}><boxGeometry args={[6, 14, 0.12]} /></mesh>
        </group>
      ))}
      {[-8, 8].map((x) => <mesh key={x} position={[x, 0.5, -19]} rotation={[0.2, 0, 0]} material={m.white}><boxGeometry args={[4, 0.1, 8]} /></mesh>)}
      <mesh position={[0, 2.35, -16]} rotation={[-Math.PI / 2, 0, 0]} material={m.patch}><circleGeometry args={[1.4, 28]} /></mesh>
    </group>
  );
}
