import { useFrame } from '@react-three/fiber';
import { forwardRef, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { grainTexture, insigniaTexture } from './textures';

export type Pose = 'walk' | 'float' | 'sit';

export interface AstronautAnim {
  /** 0..1 how fast the astronaut is walking. */
  speed: number;
  airborne: boolean;
  carry: boolean;
  pose: Pose;
}

export function makeAnim(pose: Pose = 'walk'): AstronautAnim {
  return { speed: 0, airborne: false, carry: false, pose };
}

interface Props {
  anim?: React.MutableRefObject<AstronautAnim>;
  /** Small status light on the chest display. */
  chestLight?: 'green' | 'red' | 'amber';
  /** Highlights the left glove ring (used by the suit pressure fault). */
  gloveAlert?: boolean;
  still?: boolean;
  children?: ReactNode;
}

const LIGHT = { green: '#35e07a', red: '#ff3b30', amber: '#ffb020' };

/**
 * One reusable astronaut built from simple shapes. Proportions follow a real
 * pressure suit: large helmet with a gold visor, hard upper torso, life-support
 * backpack, chest display unit and red identification stripes.
 */
export const Astronaut = forwardRef<THREE.Group, Props>(function Astronaut({ anim, chestLight = 'green', gloveAlert = false, still = false, children }, ref) {
  const mats = useMemo(() => {
    const grain = grainTexture();
    grain.repeat.set(3, 3);
    return {
      suit: new THREE.MeshStandardMaterial({ color: '#ecebe6', roughness: 0.86, bumpMap: grain, bumpScale: 0.6 }),
      grey: new THREE.MeshStandardMaterial({ color: '#70747a', roughness: 0.7 }),
      red: new THREE.MeshStandardMaterial({ color: '#b3202a', roughness: 0.7 }),
      metal: new THREE.MeshStandardMaterial({ color: '#b4bac2', roughness: 0.28, metalness: 0.95 }),
      visor: new THREE.MeshStandardMaterial({ color: '#d7a43a', roughness: 0.06, metalness: 1, envMapIntensity: 2.4 }),
      pack: new THREE.MeshStandardMaterial({ color: '#dedcd6', roughness: 0.8, bumpMap: grain, bumpScale: 0.4 }),
      patch: new THREE.MeshStandardMaterial({ map: insigniaTexture(), transparent: true, roughness: 0.8 }),
      dark: new THREE.MeshStandardMaterial({ color: '#23262b', roughness: 0.6 }),
    };
  }, []);

  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const elbowL = useRef<THREE.Group>(null);
  const elbowR = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const phase = useRef(0);

  useFrame((_, delta) => {
    const a = anim?.current ?? { speed: 0, airborne: false, carry: false, pose: 'walk' as Pose };
    const d = Math.min(delta, 0.1);
    const k = 1 - Math.exp(-10 * d);
    const set = (g: THREE.Group | null, x: number, z = 0) => {
      if (!g) return;
      g.rotation.x += (x - g.rotation.x) * k;
      g.rotation.z += (z - g.rotation.z) * k;
    };
    if (a.pose === 'sit') {
      set(hipL.current, -1.45); set(hipR.current, -1.45);
      set(kneeL.current, 1.45); set(kneeR.current, 1.45);
      set(armL.current, -1.0, 0.12); set(armR.current, -1.0, -0.12);
      set(elbowL.current, -0.5); set(elbowR.current, -0.5);
      return;
    }
    if (a.pose === 'float') {
      const t = still ? 0 : (phase.current += d);
      const sway = Math.sin(t * 0.9) * 0.06;
      set(hipL.current, 0.25 + sway); set(hipR.current, 0.4 - sway);
      set(kneeL.current, 0.55); set(kneeR.current, 0.75);
      const reach = a.carry ? -1.25 : -0.55;
      set(armL.current, reach + sway, 0.3); set(armR.current, reach - sway, -0.3);
      set(elbowL.current, -0.5); set(elbowR.current, -0.5);
      return;
    }
    phase.current += d * (3 + a.speed * 6);
    const swing = still ? 0 : Math.sin(phase.current) * 0.62 * a.speed;
    if (a.airborne) {
      set(hipL.current, -0.35); set(hipR.current, 0.15);
      set(kneeL.current, 0.7); set(kneeR.current, 0.35);
      set(armL.current, a.carry ? -1.15 : -0.3, 0.5); set(armR.current, a.carry ? -1.15 : -0.3, -0.5);
    } else {
      set(hipL.current, swing); set(hipR.current, -swing);
      set(kneeL.current, Math.max(0, -swing) * 1.1 + 0.05); set(kneeR.current, Math.max(0, swing) * 1.1 + 0.05);
      set(armL.current, a.carry ? -1.15 : -swing * 0.7, 0.14); set(armR.current, a.carry ? -1.15 : swing * 0.7, -0.14);
    }
    set(elbowL.current, a.carry ? -0.7 : -0.25); set(elbowR.current, a.carry ? -0.7 : -0.25);
    if (body.current) body.current.position.y = still ? 0 : Math.abs(Math.sin(phase.current)) * 0.03 * a.speed;
  });

  const leg = (side: 1 | -1, hip: React.RefObject<THREE.Group | null>, knee: React.RefObject<THREE.Group | null>) => (
    <group ref={hip} position={[0.15 * side, 1.02, 0]}>
      <mesh castShadow position={[0, -0.25, 0]} material={mats.suit}><capsuleGeometry args={[0.122, 0.3, 6, 14]} /></mesh>
      <mesh position={[0, -0.34, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.red}><torusGeometry args={[0.124, 0.014, 8, 20]} /></mesh>
      <group ref={knee} position={[0, -0.5, 0]}>
        <mesh castShadow position={[0, -0.22, 0]} material={mats.suit}><capsuleGeometry args={[0.104, 0.27, 6, 14]} /></mesh>
        <mesh castShadow position={[0, -0.455, 0.05]} material={mats.grey}><boxGeometry args={[0.19, 0.13, 0.33]} /></mesh>
      </group>
    </group>
  );

  const arm = (side: 1 | -1, shoulder: React.RefObject<THREE.Group | null>, elbow: React.RefObject<THREE.Group | null>, alert: boolean) => (
    <group ref={shoulder} position={[0.39 * side, 1.47, 0]}>
      <mesh castShadow material={mats.suit}><sphereGeometry args={[0.135, 16, 12]} /></mesh>
      <mesh castShadow position={[0, -0.18, 0]} material={mats.suit}><capsuleGeometry args={[0.093, 0.2, 6, 12]} /></mesh>
      <mesh position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.red}><torusGeometry args={[0.096, 0.012, 8, 18]} /></mesh>
      <group ref={elbow} position={[0, -0.36, 0]}>
        <mesh castShadow position={[0, -0.15, 0]} material={mats.suit}><capsuleGeometry args={[0.086, 0.18, 6, 12]} /></mesh>
        <mesh position={[0, -0.27, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.09, 0.018, 8, 18]} />
          <meshStandardMaterial color={alert ? '#ff3b30' : '#b4bac2'} emissive={alert ? '#ff3b30' : '#000000'} emissiveIntensity={alert ? 2.2 : 0} metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh castShadow position={[0, -0.35, 0]} material={mats.grey}><sphereGeometry args={[0.098, 14, 10]} /></mesh>
      </group>
    </group>
  );

  return (
    <group ref={ref}>
      <group ref={body}>
        {leg(1, hipL, kneeL)}
        {leg(-1, hipR, kneeR)}
        <group position={[0, 0.1, 0]}>
        {/* Hard upper torso and waist ring */}
        <mesh castShadow position={[0, 1.22, 0]} scale={[1.04, 1, 0.8]} material={mats.suit}><capsuleGeometry args={[0.27, 0.34, 8, 18]} /></mesh>
        <mesh position={[0, 0.96, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.05, 0.82, 1]} material={mats.metal}><torusGeometry args={[0.27, 0.025, 8, 24]} /></mesh>
        {/* Life-support backpack with the mission patch */}
        <mesh castShadow position={[0, 1.34, -0.31]} material={mats.pack}><boxGeometry args={[0.52, 0.74, 0.26]} /></mesh>
        <mesh position={[0, 1.66, -0.31]} material={mats.red}><boxGeometry args={[0.525, 0.045, 0.265]} /></mesh>
        <mesh position={[0, 1.36, -0.442]} rotation={[0, Math.PI, 0]} material={mats.patch}><circleGeometry args={[0.15, 28]} /></mesh>
        {/* Chest display and control unit */}
        <mesh castShadow position={[0, 1.24, 0.27]} material={mats.pack}><boxGeometry args={[0.32, 0.22, 0.11]} /></mesh>
        <mesh position={[0.09, 1.28, 0.328]}>
          <boxGeometry args={[0.07, 0.05, 0.01]} />
          <meshStandardMaterial color={LIGHT[chestLight]} emissive={LIGHT[chestLight]} emissiveIntensity={2.4} />
        </mesh>
        <mesh position={[-0.07, 1.28, 0.328]} material={mats.dark}><boxGeometry args={[0.13, 0.07, 0.01]} /></mesh>
        <mesh position={[-0.09, 1.19, 0.33]} material={mats.red}><cylinderGeometry args={[0.018, 0.018, 0.02, 10]} /></mesh>
        <mesh position={[0, 1.19, 0.33]} material={mats.metal}><cylinderGeometry args={[0.018, 0.018, 0.02, 10]} /></mesh>
        {arm(1, armL, elbowL, gloveAlert)}
        {arm(-1, armR, elbowR, false)}
        {/* Neck ring, helmet shell and gold sun visor */}
        <mesh position={[0, 1.6, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.metal}><torusGeometry args={[0.2, 0.03, 10, 28]} /></mesh>
        <mesh castShadow position={[0, 1.79, -0.015]} material={mats.suit}><sphereGeometry args={[0.24, 28, 20]} /></mesh>
        <mesh position={[0, 1.79, 0.012]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.9]} material={mats.visor}>
          <sphereGeometry args={[0.243, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
        </mesh>
        <mesh position={[0.19, 1.91, 0.02]} material={mats.pack}><boxGeometry args={[0.06, 0.06, 0.1]} /></mesh>
        <mesh position={[-0.19, 1.91, 0.02]} material={mats.pack}><boxGeometry args={[0.06, 0.06, 0.1]} /></mesh>
        </group>
        {children}
      </group>
    </group>
  );
});
