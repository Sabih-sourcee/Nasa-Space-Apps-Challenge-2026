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
  const { camera, gl } = useThree();
  const reduced = useReducedMotion();
  // Mouse and touch walking: click or tap the ground to walk there, or hold and drag to keep steering.
  const goal = useRef<{ x: number; z: number; use: string | null } | null>(null);
  const goalRing = useRef<THREE.Mesh>(null);
  const stuck = useRef(0);
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;
  const listRef = useRef(interactables);
  listRef.current = interactables;
  const target = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const look = useRef(new THREE.Vector3(state.current.x, state.current.y + lookHeight, state.current.z));
  const first = useRef(true);
  const nearest = useRef<Interactable | null>(null);

  useEffect(() => {
    probe.walker = state;
    return () => { hud.set({ prompt: null }); };
  }, [state]);

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = 'none';
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    let down = false;
    const aim = (ev: PointerEvent, first: boolean) => {
      if (frozenRef.current) return;
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
      plane.constant = -state.current.y;
      if (!ray.ray.intersectPlane(plane, hit)) return;
      // A click on something you can use walks there and uses it.
      let use: string | null = goal.current?.use ?? null;
      if (first) {
        use = null;
        let bestD = Infinity;
        for (const it of listRef.current()) {
          if (!it.enabled) continue;
          const d = Math.hypot(it.x - hit.x, it.z - hit.z);
          if (d <= Math.max(1.4, it.r) && d < bestD) { use = it.id; bestD = d; }
        }
      }
      goal.current = { x: hit.x, z: hit.z, use };
      stuck.current = 0;
    };
    const onDown = (ev: PointerEvent) => { if (ev.button !== 0) return; down = true; aim(ev, true); };
    const onMove = (ev: PointerEvent) => { if (down) aim(ev, false); };
    const onUp = () => { down = false; };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [gl, camera, state]);

  useSim((dt) => {
    const s = state.current;
    const e = env(s);
    const jump = input.consume('primary');
    const use = input.consume('use');
    let moveX = input.axisX();
    let moveZ = -input.axisY();
    // The keyboard always wins: any movement key cancels the mouse target.
    if (moveX !== 0 || moveZ !== 0 || frozen) goal.current = null;
    const g = goal.current;
    if (g) {
      const dx = g.x - s.x;
      const dz = g.z - s.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.3) goal.current = null;
      else { moveX = dx / dist; moveZ = dz / dist; }
    }
    const next = frozen
      ? stepWalker(s, { moveX: 0, moveZ: 0, jump: false }, dt, e)
      : stepWalker(s, { moveX, moveZ, jump }, dt, e);
    // Walking into a wall for half a second gives up on the target.
    if (goal.current) { stuck.current = Math.hypot(next.x - s.x, next.z - s.z) < 0.004 ? stuck.current + 1 : 0; if (stuck.current > 30) goal.current = null; }
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
    // Arrived at the thing that was clicked: use it.
    else if (goal.current?.use && best && best.id === goal.current.use && !frozen) { goal.current = null; onInteract(best.id); }
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

    if (goalRing.current) {
      goalRing.current.visible = !!goal.current;
      if (goal.current) goalRing.current.position.set(goal.current.x, s.y + 0.04, goal.current.z);
    }

    const n = nearest.current;
    hud.set({ prompt: n && !frozen ? `Press E: ${n.label}` : null });
  });

  return (
    <>
      <Astronaut ref={group} anim={anim} chestLight={chestLight} gloveAlert={gloveAlert}>
        {carrying && <group position={[0, 1.12, 0.42]}>{carried ?? <Pouch />}</group>}
        {children}
      </Astronaut>
      <mesh ref={goalRing} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.4, 28]} />
        <meshBasicMaterial color="#ffc83d" transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </>
  );
}
