import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { input } from '../game/input';
import { LAB_WORLD, LAB_WORLDS, makeLab, stepLab, type LabEvent, type LabWorldId } from '../sim/gravityLab';
import { Astronaut, makeAnim } from '../three/Astronaut';
import { useReducedMotion, useSim } from '../three/GameCanvas';
import { Stars } from '../three/Scenery';
import { labelTexture, planetTexture, type PlanetMap } from '../three/textures';

/** Top of the tube's base plate: the floor the astronaut stands on. */
const BASE = 0.3;
const TUBE_R = 1.7;
const TUBE_H = 5.6;

export interface LabCmd { jump: boolean; drop: boolean }

/** A ruler painted up the back of the tube, one tick every half metre. */
function rulerTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 1024;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#0b1c3d';
  ctx.fillRect(0, 0, 160, 1024);
  ctx.fillStyle = '#ffc83d';
  ctx.font = '900 54px sans-serif';
  ctx.textBaseline = 'middle';
  // The plane is 5 m tall: 1024 px, so 204.8 px to the metre.
  for (let m = 0; m <= 4.5; m += 0.5) {
    const y = 1024 - m * 204.8;
    const whole = Number.isInteger(m);
    ctx.fillRect(0, y - (whole ? 5 : 3), whole ? 70 : 40, whole ? 10 : 6);
    if (whole && m > 0) ctx.fillText(`${m} m`, 78, y);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Where each world hangs: two either side of the tube, and the station above it. Kept near the middle so the panels do not cover them. */
const SPOT: Record<LabWorldId, [number, number]> = { moon: [-4.3, 6], mars: [-4.3, 2.7], earth: [4.3, 6], jupiter: [4.3, 2.7], station: [0, 8.2] };

function Globe({ id, picked, onPick }: { id: LabWorldId; picked: boolean; onPick: (id: LabWorldId) => void }) {
  const spin = useRef<THREE.Group>(null);
  const grow = useRef<THREE.Group>(null);
  const reduced = useReducedMotion();
  const world = LAB_WORLD[id];
  const map = useMemo(() => (id === 'station' ? null : planetTexture(id as PlanetMap)), [id]);
  const label = useMemo(() => labelTexture([world.name], { bg: '#0b1c3d', accent: '#ffc83d' }), [world.name]);
  const r = id === 'jupiter' ? 1.05 : id === 'moon' ? 0.62 : id === 'mars' ? 0.72 : 0.85;
  useFrame((_, d) => {
    if (spin.current && !reduced) spin.current.rotation.y += d * 0.25;
    if (grow.current) {
      const to = picked ? 1.22 : 1;
      grow.current.scale.setScalar(grow.current.scale.x + (to - grow.current.scale.x) * (1 - Math.exp(-8 * Math.min(d, 0.1))));
    }
  });
  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; };
  const out = () => { document.body.style.cursor = ''; };
  return (
    <group position={[SPOT[id][0], SPOT[id][1], -5.5]}>
      <group ref={grow} onClick={(e) => { e.stopPropagation(); onPick(id); }} onPointerOver={over} onPointerOut={out}>
        <group ref={spin} rotation={[0.3, 0, 0.12]}>
          {id === 'station' ? (
            <group>
              <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.28, 0.28, 1.5, 20]} /><meshStandardMaterial color="#e6e9ee" roughness={0.5} metalness={0.3} /></mesh>
              <mesh><cylinderGeometry args={[0.2, 0.2, 0.9, 16]} /><meshStandardMaterial color="#cfd5dd" roughness={0.5} metalness={0.3} /></mesh>
              {[-1.25, 1.25].map((px) => (
                <mesh key={px} position={[px, 0, 0]}><boxGeometry args={[0.9, 0.03, 1.5]} /><meshStandardMaterial color="#1d3f8f" roughness={0.35} metalness={0.5} emissive="#0c1d4a" emissiveIntensity={0.5} /></mesh>
              ))}
            </group>
          ) : (
            <mesh>
              <sphereGeometry args={[r, 48, 32]} />
              <meshStandardMaterial map={map} roughness={0.9} metalness={0} />
            </mesh>
          )}
        </group>
        {picked && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[(id === 'station' ? 1.5 : r) + 0.28, 0.035, 10, 64]} />
            <meshBasicMaterial color="#ffc83d" />
          </mesh>
        )}
      </group>
      <mesh position={[0, id === 'station' ? -1.0 : -1.55, 0]}>
        <planeGeometry args={[1.5, 0.56]} />
        <meshBasicMaterial map={label} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function GravityLabScene({ world, cmd, onPick, onEvent }: {
  world: LabWorldId;
  cmd: React.MutableRefObject<LabCmd>;
  onPick: (id: LabWorldId) => void;
  /** The world is the one the chamber was copying when it happened, which the panel may already have moved on from. */
  onEvent: (e: LabEvent, world: LabWorldId) => void;
}) {
  const w = LAB_WORLD[world];
  const state = useRef(makeLab(w));
  const current = useRef(world);
  if (current.current !== world) { current.current = world; state.current = makeLab(w); }
  const anim = useRef(makeAnim('walk'));
  const cadet = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Mesh>(null);
  const pad = useRef<THREE.MeshStandardMaterial>(null);
  const reduced = useReducedMotion();
  const ruler = useMemo(() => rulerTexture(), []);
  const mouse = useRef({ x: 0, y: 0 });
  const eased = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => { mouse.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 }; };
    window.addEventListener('pointermove', onMove);
    return () => { window.removeEventListener('pointermove', onMove); document.body.style.cursor = ''; };
  }, []);

  useSim((dt) => {
    const jump = input.consume('primary') || cmd.current.jump;
    const drop = input.consume('use') || cmd.current.drop;
    cmd.current.jump = false;
    cmd.current.drop = false;
    const next = stepLab(state.current, { jump, drop }, dt, w);
    state.current = next;
    if (next.event) onEvent(next.event, world);
  }, (delta, elapsed) => {
    const s = state.current;
    anim.current.airborne = !s.grounded;
    anim.current.pose = w.g === 0 ? 'float' : 'walk';
    if (cadet.current) {
      // On the station the cadet bobs a little, like anything left floating.
      const bob = w.g === 0 && !reduced ? Math.sin(elapsed * 0.9) * 0.05 : 0;
      cadet.current.position.y = BASE + s.y + bob;
      cadet.current.rotation.z = w.g === 0 && !reduced ? Math.sin(elapsed * 0.5) * 0.12 : 0;
    }
    if (ball.current) ball.current.position.y = BASE + s.ballY + 0.13;
    if (pad.current) pad.current.emissiveIntensity = s.grounded ? 0.9 : 0.25;
    return delta;
  });

  // The view leans a little with the mouse, like the title screen.
  useFrame(({ camera }, delta) => {
    const k = 1 - Math.exp(-3 * Math.min(delta, 0.1));
    eased.current.x += (mouse.current.x - eased.current.x) * k;
    eased.current.y += (mouse.current.y - eased.current.y) * k;
    const lean = reduced ? 0 : 1;
    camera.position.set(eased.current.x * 1.2 * lean, 3.1 - eased.current.y * 0.4 * lean, 11.5);
    camera.lookAt(0, 3.3, 0);
  });

  return (
    <>
      <Stars count={900} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 9, 8]} intensity={2.2} />
      <pointLight position={[0, BASE + TUBE_H - 0.5, 0]} intensity={18} distance={9} color="#dff1ff" />

      {/* Lab floor */}
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <cylinderGeometry args={[9, 9.4, 0.2, 64]} />
        <meshStandardMaterial color="#1a2238" roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <ringGeometry args={[2.6, 2.75, 64]} />
        <meshBasicMaterial color="#5fe3ff" />
      </mesh>

      {/* The glass tube */}
      <mesh position={[0, BASE / 2, 0]}>
        <cylinderGeometry args={[TUBE_R + 0.25, TUBE_R + 0.4, BASE, 48]} />
        <meshStandardMaterial color="#39445e" roughness={0.35} metalness={0.8} />
      </mesh>
      <mesh position={[0, BASE + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[TUBE_R - 0.03, 48]} />
        <meshStandardMaterial color={w.ground} roughness={0.95} />
      </mesh>
      <mesh position={[0, BASE + TUBE_H + 0.2, 0]}>
        <cylinderGeometry args={[TUBE_R + 0.35, TUBE_R + 0.2, 0.4, 48]} />
        <meshStandardMaterial color="#39445e" roughness={0.35} metalness={0.8} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        return (
          <mesh key={i} position={[Math.cos(a) * (TUBE_R + 0.06), BASE + TUBE_H / 2, Math.sin(a) * (TUBE_R + 0.06)]}>
            <cylinderGeometry args={[0.05, 0.05, TUBE_H, 10]} />
            <meshStandardMaterial color="#8d9bb8" roughness={0.3} metalness={0.9} />
          </mesh>
        );
      })}
      <mesh position={[0, BASE + 2.5, -TUBE_R + 0.12]}>
        <planeGeometry args={[0.78, 5]} />
        <meshBasicMaterial map={ruler} toneMapped={false} />
      </mesh>
      <mesh position={[0, BASE + 0.04, 0]}>
        <cylinderGeometry args={[0.62, 0.66, 0.06, 32]} />
        <meshStandardMaterial ref={pad} color="#20304f" emissive="#5fe3ff" emissiveIntensity={0.9} roughness={0.4} metalness={0.4} />
      </mesh>

      <Astronaut ref={cadet} anim={anim} />
      <mesh ref={ball} position={[1.05, BASE + 2.13, 0.2]}>
        <sphereGeometry args={[0.13, 24, 16]} />
        <meshStandardMaterial color="#ff8a3d" emissive="#7a2c00" emissiveIntensity={0.5} roughness={0.5} />
      </mesh>
      {/* The arm that holds the ball at two metres */}
      <mesh position={[1.4, BASE + 2.4, 0.2]}>
        <boxGeometry args={[0.6, 0.06, 0.1]} />
        <meshStandardMaterial color="#8d9bb8" roughness={0.3} metalness={0.9} />
      </mesh>

      {/* Glass last, so everything inside shows through it */}
      <mesh position={[0, BASE + TUBE_H / 2, 0]} renderOrder={5}>
        <cylinderGeometry args={[TUBE_R, TUBE_R, TUBE_H, 64, 1, true]} />
        <meshPhysicalMaterial color="#bfe6ff" transparent opacity={0.17} roughness={0.04} metalness={0} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {LAB_WORLDS.map((lw) => (
        <Globe key={lw.id} id={lw.id} picked={lw.id === world} onPick={onPick} />
      ))}
    </>
  );
}
