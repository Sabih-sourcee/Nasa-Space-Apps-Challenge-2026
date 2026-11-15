import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { hud } from '../game/hud';
import { input } from '../game/input';
import { probe } from '../game/probe';
import { stepWalker, type WalkEnv, type WalkerState } from '../sim/movement';
import { Astronaut, makeAnim } from './Astronaut';
import { useReducedMotion, useSim } from './GameCanvas';
import { Pouch } from './Props';

export interface Interactable {
  id: string;
  x: number;
  z: number;
  r: number;
  label: string;
  enabled: boolean;
}

interface Props {
  /** Called every step so the scene can swap gravity presets by zone. */
  env: (s: WalkerState) => WalkEnv;
  state: React.MutableRefObject<WalkerState>;
  interactables: () => Interactable[];
  onInteract: (id: string) => void;
  onStep?: (s: WalkerState, dt: number) => void;
  carrying?: boolean;
  /** What is in the astronaut's hands. Defaults to the equipment pouch. */
  carried?: ReactNode;
  chestLight?: 'green' | 'red' | 'amber';
  gloveAlert?: boolean;
  /** Stop the astronaut (for example while a panel is open). */
  frozen?: boolean;
  cameraOffset?: [number, number, number];
  lookHeight?: number;
  children?: ReactNode;
}

/**
 * Third-person astronaut. The camera keeps a fixed direction and only follows
 * position, which keeps the view stable for young players. Movement keys are
 * camera-relative: up walks away from the camera.
 */
export function WalkerRig({ env, state, interactables, onInteract, onStep, carrying = false, carried, chestLight, gloveAlert, frozen = false, cameraOffset = [0, 3.4, 8.2], lookHeight = 1.3, children }: Props) {
  const group = useRef<THREE.Group>(null);
  const anim = useRef(makeAnim('walk'));
  const { camera } = useThree();
  const reduced = useReducedMotion();
  const target = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const look = useRef(new THREE.Vector3(state.current.x, state.current.y + lookHeight, state.current.z));
  const first = useRef(true);
  const nearest = useRef<Interactable | null>(null);

  useEffect(() => {
    probe.walker = state;
    return () => { hud.set({ prompt: null }); };
  }, [state]);

  useSim((dt) => {
    const s = state.current;
    const e = env(s);
    const jump = input.consume('primary');
    const use = input.consume('use');
    const next = frozen
      ? stepWalker(s, { moveX: 0, moveZ: 0, jump: false }, dt, e)
      : stepWalker(s, { moveX: input.axisX(), moveZ: -input.axisY(), jump }, dt, e);
    state.current = next;
    onStep?.(next, dt);

    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of interactables()) {
      if (!it.enabled) continue;
      const d = Math.hypot(it.x - next.x, it.z - next.z);
      if (d <= it.r && d < bestD) { best = it; bestD = d; }
    }
    nearest.current = best;
    if (use && best && !frozen) onInteract(best.id);
  }, (delta) => {
    const s = state.current;
    const e = env(s);
    const g = group.current;
    if (g) {
      g.position.set(s.x, s.y, s.z);
      // Turn smoothly toward the heading.
      let diff = s.heading - g.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      g.rotation.y += diff * (1 - Math.exp(-12 * delta));
    }
    anim.current.speed = Math.min(1, Math.hypot(s.vx, s.vz) / e.preset.walkSpeed);
    anim.current.airborne = !s.grounded;
    anim.current.carry = carrying;

    target.set(s.x, s.y + lookHeight, s.z);
    desired.set(s.x + cameraOffset[0], s.y * 0.6 + cameraOffset[1], s.z + cameraOffset[2]);
    if (reduced || first.current) {
      camera.position.copy(desired);
      look.current.copy(target);
      first.current = false;
    } else {
      const k = 1 - Math.exp(-5 * delta);
      camera.position.lerp(desired, k);
      look.current.lerp(target, k);
    }
    camera.lookAt(look.current);

    const n = nearest.current;
    hud.set({ prompt: n && !frozen ? `Press E: ${n.label}` : null });
  });

  return (
    <Astronaut ref={group} anim={anim} chestLight={chestLight} gloveAlert={gloveAlert}>
      {carrying && <group position={[0, 1.12, 0.42]}>{carried ?? <Pouch />}</group>}
      {children}
    </Astronaut>
  );
}
