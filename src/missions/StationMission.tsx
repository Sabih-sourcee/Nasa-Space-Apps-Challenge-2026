import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { playCue } from '../game/audio';
import { hud } from '../game/hud';
import { input } from '../game/input';
import { DOCK_VIEWS, useViews, view } from '../game/view';
import { probe } from '../game/probe';
import { useGame } from '../game/store';
import { CABIN_PRESSURE, DOCK_STANDOFF, DOCK_TUNING, dockActive, dockStage, makeDock, retryDock, stepDock, type DockStage, type DockState } from '../sim/flight';
import { makeDrifter, nearestRail, stepDrift, type DriftEnv, type DriftState } from '../sim/movement';
import { hintsOn } from '../sim/save';
import { rateStation } from '../sim/score';
import type { Tier } from '../sim/types';
import { Astronaut, makeAnim } from '../three/Astronaut';
import { GameCanvas, SunLight, useReducedMotion, useSim } from '../three/GameCanvas';
import { DockingPort, M, Orbiter, Pouch, Sign, StationExterior, Strut } from '../three/Props';
import { RealAsset } from '../three/models';
import { EarthGlobe, Stars, SunDisc } from '../three/Scenery';
import { panelTexture } from '../three/textures';
import { ResetCard } from '../ui/Hud';

// ---------------------------------------------------------------------------
// Phase 1: docking
// ---------------------------------------------------------------------------

/** The objective line for each step of the docking. */
const STAGE_TEXT: Record<DockStage, string> = {
  approach: 'Approach: fly toward the docking port',
  alignment: 'Alignment: put the cross under your crosshair',
  final: 'Final approach: stay centred and arrive slowly',
  capture: 'Soft capture: the latches have caught',
  hardDock: 'Hard dock: the ring is pulling the ports together',
  checks: 'Connection checks before the hatch opens',
  docked: 'Docked. Hatch open',
  aborted: 'Approach called off',
};

export function DockingScene({ sim, tier, onEnd }: { sim: React.MutableRefObject<DockState>; tier: Tier; onEnd: (s: DockState) => void }) {
  const m = M();
  const station = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useViews(DOCK_VIEWS);
  const own = useRef<THREE.Group>(null);
  const nose = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Group>(null);
  const reduced = useReducedMotion();
  const camAt = useRef(new THREE.Vector3());
  const joinAt = useRef(new THREE.Vector3());
  const wasJoined = useRef(false);
  const tune = DOCK_TUNING[tier];
  const settings = useGame((s) => s.save.settings);
  const hints = hintsOn(settings, tier);
  const ended = useRef(false);
  const tick = useRef(0);
  const [portColor, setPortColor] = useState('#ffb020');
  const lastColor = useRef('#ffb020');

  useSim((dt) => {
    const prev = sim.current;
    if (!dockActive(prev)) {
      if (!ended.current) { ended.current = true; onEnd(prev); }
      return;
    }
    ended.current = false;
    // Thrusters only matter on the way in. After contact the one live key is the action key.
    const flying = prev.status === 'approach';
    const next = stepDock(prev, {
      steerX: flying ? input.axisX() : 0, steerY: flying ? input.axisY() : 0,
      thrust: flying && input.held('primary'), brake: flying && input.held('brake'), action: input.consume('use'),
    }, dt, tier);
    // Short radio calls, once, as each step begins.
    if (next.status !== prev.status) {
      if (next.status === 'capture') { playCue('ok'); hud.say('Contact. Soft capture: the latches have caught.'); }
      else if (next.status === 'hardDock') hud.say('Ring pulling in. Hooks closing for a hard dock.');
      else if (next.status === 'checks') { playCue('checkpoint'); hud.say('Hard dock. Check the tunnel for leaks before the hatch opens.'); }
    } else if (next.leakCheck !== prev.leakCheck) {
      if (next.leakCheck === 'running') hud.say('Filling the tunnel with air.');
      else if (next.leakCheck === 'passed') { playCue('ok'); hud.say('Pressure is equal and holding. No leak.'); }
    }
    sim.current = next;
  }, (delta) => {
    const s = sim.current;
    const joined = s.status === 'capture' || s.status === 'hardDock' || s.status === 'checks' || s.status === 'docked';
    const outside = joined || view.is('Outside');
    if (joined) {
      // Once the latches catch, the camera moves beside the two rings to show them join.
      const want = joinAt.current.set(8.5, 3.2, -0.6);
      if (!wasJoined.current) { camAt.current.copy(camera.position); wasJoined.current = true; }
      if (reduced) camAt.current.copy(want); else camAt.current.lerp(want, 1 - Math.exp(-2.2 * delta));
      camera.position.copy(camAt.current);
      camera.lookAt(0, 0, -2.9);
    } else if (outside) {
      wasJoined.current = false;
      // Beside the orbiter, so both vehicles and the gap between them are in view.
      const zm = view.zoom();
      camera.position.set(30 * zm, 11 * zm, 24 * zm);
      camera.lookAt(0, 0, -Math.min(s.range, 34) * 0.4);
    } else {
      wasJoined.current = false;
      camera.position.set(0, 0, 0);
      camera.lookAt(0, 0, -10);
    }
    if (own.current) own.current.visible = outside;
    if (nose.current) nose.current.visible = !outside;
    // Port-to-port: the station sits ahead by the range, plus the gap the capture ring still holds open.
    station.current?.position.set(-s.x, -s.y, -s.range - 2.6 - s.standoff);
    if (ring.current) {
      // The capture ring stays against the port and pulls in with it.
      ring.current.visible = outside;
      ring.current.position.set(0, 0, -2.2 - s.standoff);
      const shut = s.status === 'approach' || s.status === 'aborted' ? 0 : s.status === 'capture' ? Math.min(1, s.stageT / 0.8) : 1;
      ring.current.children.forEach((latch, i) => { if (i > 0) latch.rotation.x = -0.9 + shut * 0.9; });
    }

    if (tick.current++ % 6 !== 0) return;
    const off = Math.hypot(s.x, s.y);
    const aligned = off <= tune.alignTol;
    const gentle = s.closing <= tune.maxClosing;
    const stage = dockStage(s);
    const color = s.status === 'aborted' ? '#ff3b30' : s.status === 'capture' ? '#5fe3ff' : joined || aligned ? '#35e07a' : '#ffb020';
    if (color !== lastColor.current) { lastColor.current = color; setPortColor(color); }
    if (joined) {
      // After contact: what the mechanism is doing, and the one key that matters.
      const checks = s.status === 'checks';
      hud.warn(null);
      hud.set({
        objective: STAGE_TEXT[stage],
        crosshair: false,
        touchLabels: { primary: 'Close in', use: !checks ? 'Skip ahead' : s.leakCheck === 'passed' ? 'Open hatch' : 'Leak check', brake: 'Brake' },
        meters: checks
          ? [{ id: 'pressure', label: 'Tunnel pressure', value: s.pressure, max: CABIN_PRESSURE, text: `${Math.round(s.pressure)} kPa`, status: s.leakCheck === 'passed' ? 'ok' : 'caution', note: `Cabin is ${Math.round(CABIN_PRESSURE)} kPa on both sides` }]
          : s.status === 'hardDock'
            ? [{ id: 'align', label: 'Ring pulling in', value: DOCK_STANDOFF - s.standoff, max: DOCK_STANDOFF, text: `${Math.round(s.standoff * 100)} cm gap`, status: 'ok' }]
            : [{ id: 'align', label: 'Ports lining up', value: Math.max(0, s.contactOff - off), max: Math.max(0.01, s.contactOff), text: `${off.toFixed(2)} m off`, status: 'ok' }],
        readouts: [
          { label: 'Step', value: stage === 'capture' ? 'Soft capture' : stage === 'hardDock' ? 'Hard dock' : 'Connection checks' },
          { label: 'Rings met at', value: `${s.contactSpeed.toFixed(2)} m/s, ${s.contactOff.toFixed(2)} m off centre` },
          { label: 'Seal', value: !checks ? 'Hooks closing' : s.leakCheck === 'waiting' ? 'Not checked yet' : s.leakCheck === 'running' ? 'Filling the tunnel' : 'Holding. No leak' },
          { label: 'Attempt', value: String(s.attempts) },
        ],
        hint: !checks ? 'Hands off: the docking ring does this part. Press E to skip ahead.'
          : s.leakCheck === 'waiting' ? 'Press E to fill the tunnel with air and run the leak check.'
            : s.leakCheck === 'running' ? 'Watch the tunnel pressure climb to match the cabin.'
              : 'The pressure is holding. Press E to open the hatch.',
      });
      return;
    }
    const side = Math.abs(s.x) < 0.1 ? 'centred' : s.x > 0 ? `${s.x.toFixed(1)} m right of the port` : `${(-s.x).toFixed(1)} m left of the port`;
    const vert = Math.abs(s.y) < 0.1 ? 'centred' : s.y > 0 ? `${s.y.toFixed(1)} m high` : `${(-s.y).toFixed(1)} m low`;
    hud.set({
      objective: STAGE_TEXT[stage],
      crosshair: s.status === 'approach' && !view.is('Outside'),
      touchLabels: { primary: 'Close in', use: 'Use', brake: 'Brake' },
      meters: [
        { id: 'align', label: 'Alignment', value: Math.max(0, 3 - off), max: 3, text: `${off.toFixed(1)} m off`, status: aligned ? 'ok' : off < tune.alignTol * 2.5 ? 'caution' : 'low', note: `Dock within ${tune.alignTol.toFixed(1)} m of centre` },
        { id: 'closing', label: 'Closing speed', value: Math.max(0, s.closing), max: 1.6, text: `${s.closing.toFixed(2)} m/s`, status: gentle ? 'ok' : s.range < 15 ? 'low' : 'caution', note: `Safe to dock under ${tune.maxClosing.toFixed(2)} m/s` },
      ],
      readouts: [
        { label: 'Step', value: stage === 'alignment' ? 'Alignment' : stage === 'final' ? 'Final approach' : 'Approach' },
        { label: 'Range', value: `${s.range.toFixed(1)} m, ring to port` },
        { label: 'Side to side', value: side },
        { label: 'Up and down', value: vert },
        { label: 'Roll', value: 'Held for you (assist)' },
        { label: 'Attempt', value: String(s.attempts) },
      ],
      hint: !hints || s.status !== 'approach' ? null
        : !aligned ? 'Steer toward the cross on the port until it sits under your crosshair.'
          : !gentle ? 'Lined up. Now hold X to slow down before you arrive.'
            : s.closing < 0.1 ? 'Lined up and slow. Tap Space to close in gently.'
              : 'Good approach. Keep the cross centred.',
    });
    if (s.status !== 'approach') { hud.warn(null); return; }
    if (s.range < 15 && !gentle) hud.warn({ title: 'CLOSING TOO FAST', text: `Brake with X. The port accepts ${tune.maxClosing.toFixed(2)} m/s or slower.`, level: 'alert' });
    else if (s.range < 8 && !aligned) hud.warn({ title: 'NOT LINED UP', text: 'Centre the cross before you reach the port, or back away with X.', level: 'caution' });
    else hud.warn(null);
  });

  return (
    <>
      <Stars />
      <ambientLight intensity={0.16} />
      <SunLight direction={[0.6, 0.5, 0.6]} intensity={3.6} size={40} />
      <SunDisc direction={[0.6, 0.5, 0.6]} />
      <EarthGlobe position={[80, -1135, -520]} radius={1100} spin={0.006} below />
      <group ref={station}>
        {/* The real ISS once it has loaded, wearing the same docking port the sim aims at. */}
        <RealAsset
          kind="iss"
          fallback={<StationExterior portColor={portColor} />}
          modelPosition={[0, -12, -12]}
          overlay={
            <>
              <DockingPort portColor={portColor} />
              {/* Short connector from the port back toward the station body */}
              <mesh position={[0, 0, -3.5]} rotation={[Math.PI / 2, 0, 0]} material={m.hull}><cylinderGeometry args={[1.6, 1.9, 7, 28]} /></mesh>
            </>
          }
        />
      </group>
      {/* Shuttle nose and docking probe seen at the bottom of the docking camera */}
      <group ref={nose}>
        <mesh position={[0, -1.9, -2.9]} rotation={[-Math.PI / 2 - 0.1, 0, 0]} material={m.white}><coneGeometry args={[1.05, 2.6, 28]} /></mesh>
        <mesh position={[0, -1.32, -2.7]} rotation={[Math.PI / 2, 0, 0]} material={m.steel}><torusGeometry args={[0.36, 0.045, 8, 28]} /></mesh>
      </group>
      {/* The orbiter itself, shown in the outside view. Its docking ring sits where the station's port arrives. */}
      <group ref={own} visible={false} position={[0, 0, 11.4]} rotation={[-Math.PI / 2, 0, 0]}><Orbiter /></group>
      {/* Soft-capture ring: it reaches out ahead of the nose, catches the port with three latches, then pulls in. */}
      <group ref={ring} visible={false}>
        <mesh material={m.steel}><torusGeometry args={[1.34, 0.07, 10, 40]} /></mesh>
        {[0, 1, 2].map((i) => (
          <group key={i} position={[Math.cos((i * 2 * Math.PI) / 3 + Math.PI / 2) * 1.34, Math.sin((i * 2 * Math.PI) / 3 + Math.PI / 2) * 1.34, 0]} rotation={[-0.9, 0, 0]}>
            <mesh position={[0, 0, -0.16]}><boxGeometry args={[0.2, 0.1, 0.34]} /><meshStandardMaterial color={portColor} emissive={portColor} emissiveIntensity={0.6} roughness={0.5} /></mesh>
          </group>
        ))}
      </group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Phase 2: push, drift and grab
// ---------------------------------------------------------------------------

export const RAILS = [
  { id: 'A', x: -7.4, z: -1.15 },
  { id: 'B', x: -4.2, z: 1.15 },
  { id: 'C', x: -1.0, z: -1.15 },
  { id: 'D', x: 2.2, z: 1.15 },
  { id: 'E', x: 5.2, z: -1.15 },
  { id: 'S', x: 7.9, z: 0.3 },
];
export const FLOAT_Y = 0.45;

interface CargoState { x: number; z: number; vx: number; vz: number; held: boolean; stowed: boolean }

function cargoStart(tier: Tier): CargoState {
  if (tier === 'junior') return { x: -4.2, z: 0.1, vx: 0, vz: 0, held: false, stowed: false };
  if (tier === 'middle') return { x: -3.4, z: 0.2, vx: 0.16, vz: 0.05, held: false, stowed: false };
  return { x: -3.0, z: -0.2, vx: 0.28, vz: 0.09, held: false, stowed: false };
}

export function driftEnv(tier: Tier): DriftEnv {
  const t = { junior: 0, middle: 1, advanced: 2 }[tier];
  return {
    rails: RAILS,
    bounds: { minX: -8.6, maxX: 8.6, minZ: -1.55, maxZ: 1.55 },
    pushSpeed: [1.0, 1.25, 1.45][t],
    reach: [1.75, 1.4, 1.15][t],
    restitution: 0.5,
  };
}

export function Module({ storageLabel = 'STORAGE' }: { storageLabel?: string } = {}) {
  const m = M();
  const wall = useMemo(() => {
    const t = panelTexture('#dfe3e6', '#a9b0b7', 'inner').clone();
    t.needsUpdate = true;
    t.repeat.set(9, 2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.1 });
  }, []);
  const floor = useMemo(() => {
    const t = panelTexture('#b9c0c7', '#7f8790', 'floor').clone();
    t.needsUpdate = true;
    t.repeat.set(9, 2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.2 });
  }, []);
  return (
    <group>
      <mesh position={[0, -0.1, 0]} material={floor} receiveShadow><boxGeometry args={[18.4, 0.2, 4]} /></mesh>
      <mesh position={[0, 1.6, -2.05]} material={wall} receiveShadow><boxGeometry args={[18.4, 3.4, 0.2]} /></mesh>
      <mesh position={[-9.2, 1.6, 0]} material={wall}><boxGeometry args={[0.2, 3.4, 4]} /></mesh>
      <mesh position={[9.2, 1.6, 0]} material={wall}><boxGeometry args={[0.2, 3.4, 4]} /></mesh>
      <mesh position={[0, 3.35, -1.2]} material={wall}><boxGeometry args={[18.4, 0.14, 1.7]} /></mesh>
      {/* Hatches, lockers, light strips and a window with Earth light */}
      <mesh position={[-9.08, 1.5, 0]} rotation={[0, Math.PI / 2, 0]} material={m.darkSteel}><circleGeometry args={[1.05, 28]} /></mesh>
      <mesh position={[-9.07, 1.5, 0]} rotation={[0, Math.PI / 2, 0]} material={m.steel}><ringGeometry args={[1.05, 1.2, 28]} /></mesh>
      {[-6, -3, 0, 3].map((x) => (
        <group key={x} position={[x, 0, -1.93]}>
          <mesh position={[0, 2.35, 0]} material={m.white}><boxGeometry args={[2.4, 1.3, 0.06]} /></mesh>
          <mesh position={[-0.6, 2.35, 0.04]} material={m.navy}><boxGeometry args={[1.1, 1.1, 0.03]} /></mesh>
          <mesh position={[0.62, 2.35, 0.04]} material={m.steel}><boxGeometry args={[1.05, 1.1, 0.03]} /></mesh>
        </group>
      ))}
      <mesh position={[6, 1.9, -1.94]} material={m.glass}><circleGeometry args={[0.6, 24]} /></mesh>
      <mesh position={[6, 1.9, -1.93]}><ringGeometry args={[0.6, 0.72, 24]} /><meshStandardMaterial color="#8d949c" metalness={0.8} roughness={0.4} /></mesh>
      {[-6, 0, 6].map((x) => (
        <mesh key={x} position={[x, 3.26, -1.2]}>
          <boxGeometry args={[3.2, 0.04, 0.3]} />
          <meshStandardMaterial color="#ffffff" emissive="#eaf2ff" emissiveIntensity={2.2} />
        </mesh>
      ))}
      {/* Storage rack */}
      <group position={[8.7, 0, 0]}>
        <mesh position={[0, 1.2, 0]} material={m.navy} castShadow><boxGeometry args={[0.8, 2.3, 2.4]} /></mesh>
        <mesh position={[-0.42, 1.2, 0]} material={m.black}><boxGeometry args={[0.04, 0.8, 1.2]} /></mesh>
        <Sign lines={[storageLabel]} position={[-0.43, 2.1, 0]} rotation={[0, -Math.PI / 2, 0]} size={[1.8, 0.45]} />
      </group>
      {/* Handrails */}
      {RAILS.map((r) => (
        <group key={r.id} position={[r.x, 0, r.z]}>
          <Strut a={[-0.3, 0, 0]} b={[-0.3, 1.25, 0]} r={0.035} material={m.yellow} />
          <Strut a={[0.3, 0, 0]} b={[0.3, 1.25, 0]} r={0.035} material={m.yellow} />
          <Strut a={[-0.36, 1.25, 0]} b={[0.36, 1.25, 0]} r={0.045} material={m.yellow} />
        </group>
      ))}
      <pointLight position={[-5, 3, 0.5]} intensity={18} distance={14} color="#eaf2ff" />
      <pointLight position={[5, 3, 0.5]} intensity={18} distance={14} color="#eaf2ff" />
    </group>
  );
}

function CargoScene({ tier, onDone, stats }: { tier: Tier; onDone: (d: DriftState) => void; stats: React.MutableRefObject<{ wallHits: number; recoveries: number; pushes: number; grabs: number }> }) {
  const env = useMemo(() => driftEnv(tier), [tier]);
  const drift = useRef(makeDrifter(env, 'A', Math.PI / 2));
  const cargo = useRef(cargoStart(tier));
  const anim = useRef(makeAnim('float'));
  const body = useRef<THREE.Group>(null);
  const bag = useRef<THREE.Group>(null);
  const arrow = useRef<THREE.Group>(null);
  const tether = useRef<THREE.Mesh>(null);
  const railGlow = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const reduced = useReducedMotion();
  const settings = useGame((s) => s.save.settings);
  const hints = hintsOn(settings, tier);
  const tick = useRef(0);
  const done = useRef(false);
  const warned = useRef(false);
  const tetherMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#d0d4d8' }), []);
  const look = useRef(new THREE.Vector3(-7, 1.2, 0));

  useEffect(() => { probe.drift = drift; probe.cargo = cargo; }, []);

  useSim((dt) => {
    if (done.current) return;
    const d = drift.current;
    const c = cargo.current;
    const use = input.consume('use');
    const near = nearestRail(env, d.x, d.z);
    const railInReach = !d.holding && !!near && near.dist <= env.reach;
    const cargoDist = Math.hypot(c.x - d.x, c.z - d.z);

    let grab = false;
    if (use) {
      if (railInReach) grab = true;
      else if (!c.held && !c.stowed && cargoDist <= env.reach) { c.held = true; playCue('ok'); hud.say('Cargo secured. Now push off toward the storage rack.'); }
      else if (c.held && d.holding === 'S') {
        c.held = false; c.stowed = true; c.x = 8.25; c.z = 0;
        done.current = true; playCue('complete');
        onDone(d);
      }
    }
    // A = turn the aim left, D = turn it right, as seen from the camera.
    const next = stepDrift(d, { aimX: 0, aimZ: 0, turn: -input.axisX(), push: input.consume('primary'), grab, recover: input.consume('recover') }, dt, env);
    if (next.pushes > d.pushes) playCue('click');
    if (next.grabs > d.grabs) playCue('ok');
    if (next.wallHits > d.wallHits) playCue('caution');
    if (next.recoveries > d.recoveries) { playCue('ok'); hud.say('Tether reeled in. You are back at the last rail.'); }
    drift.current = next;
    stats.current = { wallHits: next.wallHits, recoveries: next.recoveries, pushes: next.pushes, grabs: next.grabs };

    if (c.held) { c.x = next.x + Math.sin(next.heading) * 0.45; c.z = next.z + Math.cos(next.heading) * 0.45; }
    else if (!c.stowed) {
      // Loose cargo keeps drifting too, and bounces gently off the walls.
      c.x += c.vx * dt; c.z += c.vz * dt;
      if (c.x < env.bounds.minX + 0.3 || c.x > env.bounds.maxX - 1.2) c.vx = -c.vx;
      if (c.z < env.bounds.minZ + 0.2 || c.z > env.bounds.maxZ - 0.2) c.vz = -c.vz;
    }

    // Station hazard: a missed handrail.
    const drifting = !next.holding && (next.freeTime > 7 || next.wallHits > d.wallHits || (warned.current && next.freeTime > 0));
    if (drifting && !warned.current) {
      warned.current = true;
      hud.warn({ title: 'DRIFT WARNING', text: 'You missed the handrail. Press E near any rail to grab it, or press R to reel in your tether.', level: 'caution' });
    }
    if (next.holding && warned.current) { warned.current = false; hud.warn(null); }
  }, (delta, elapsed) => {
    const d = drift.current;
    const c = cargo.current;
    const bob = reduced ? 0 : Math.sin(elapsed * 1.3) * 0.04;
    if (body.current) {
      body.current.position.set(d.x, FLOAT_Y + bob, d.z);
      let diff = d.heading - body.current.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      body.current.rotation.y += diff * (1 - Math.exp(-10 * delta));
    }
    anim.current.carry = c.held;
    if (bag.current) {
      bag.current.position.set(c.x, c.held ? 1.45 : c.stowed ? 1.2 : 1.35 + bob, c.z);
      if (!reduced && !c.held && !c.stowed) bag.current.rotation.y += delta * 0.4;
    }
    if (arrow.current) {
      arrow.current.visible = !!d.holding;
      arrow.current.position.set(d.x, 1.5, d.z);
      arrow.current.rotation.y = d.heading;
    }
    const rail = RAILS.find((r) => r.id === d.lastRail) ?? RAILS[0];
    if (tether.current) {
      const ax = rail.x, az = rail.z, bx = d.x, bz = d.z;
      const len = Math.max(0.05, Math.hypot(bx - ax, bz - az));
      tether.current.position.set((ax + bx) / 2, 1.22, (az + bz) / 2);
      tether.current.rotation.set(0, Math.atan2(bx - ax, bz - az), 0);
      tether.current.scale.set(1, 1, len);
      tetherMat.color.set(warned.current ? '#ffb020' : '#d0d4d8');
    }
    const near = nearestRail(env, d.x, d.z);
    const railInReach = !d.holding && !!near && near.dist <= env.reach;
    if (railGlow.current && near) {
      railGlow.current.visible = railInReach;
      railGlow.current.position.set(near.rail.x, 1.25, near.rail.z);
    }

    const tx = Math.max(-5.5, Math.min(5.5, d.x * 0.75));
    const target = new THREE.Vector3(tx, 1.25, 0);
    if (reduced) look.current.copy(target); else look.current.lerp(target, 1 - Math.exp(-3 * delta));
    camera.position.set(look.current.x, 4.3, 9.4);
    camera.lookAt(look.current.x, 1.2, -0.4);

    if (tick.current++ % 6 !== 0) return;
    const cargoDist = Math.hypot(c.x - d.x, c.z - d.z);
    const speed = Math.hypot(d.vx, d.vz);
    const prompt = done.current ? null
      : railInReach ? 'Press E: Grab the handrail'
        : !c.held && !c.stowed && cargoDist <= env.reach ? 'Press E: Take the cargo bag'
          : c.held && d.holding === 'S' ? 'Press E: Stow the cargo in the rack'
            : d.holding ? 'Aim with A and D, then press Space to push off'
              : null;
    hud.set({
      prompt,
      objective: c.stowed ? 'Cargo stowed' : c.held ? 'Carry the cargo bag to the storage rack at the far end and stow it' : tier === 'junior' ? 'Reach the cargo bag by the second rail and take it' : 'Catch the loose cargo bag',
      distance: c.stowed ? null : c.held ? Math.hypot(7.9 - d.x, 0.3 - d.z) : cargoDist,
      meters: [],
      readouts: [
        { label: 'Holding', value: d.holding ? `Rail ${d.holding}` : 'Nothing: drifting', status: d.holding ? 'ok' : 'caution' },
        { label: 'Drift speed', value: `${speed.toFixed(2)} m/s`, note: d.holding ? '' : 'stays the same until you grab something' },
        { label: 'Cargo', value: c.stowed ? 'Stowed' : c.held ? 'In hand' : tier === 'junior' ? 'Waiting' : 'Loose' },
        { label: 'Tether recoveries', value: String(d.recoveries) },
      ],
      hint: !hints || done.current ? null
        : d.holding ? 'You can only push off while you are holding something. Aim the arrow at the next rail.'
          : 'No air to swim through and nothing to push on. Wait until a rail is in reach, then press E.',
    });
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <SunLight direction={[0.2, 1, 0.6]} intensity={1.1} size={12} />
      <Module />
      <Astronaut ref={body} anim={anim} />
      <group ref={bag}><group scale={1.5}><Pouch /></group></group>
      <group ref={arrow} visible={false}>
        <mesh position={[0, 0, 0.95]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.16, 0.42, 12]} /><meshBasicMaterial color="#4de3ff" /></mesh>
        <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.04, 0.04, 0.6, 8]} /><meshBasicMaterial color="#4de3ff" /></mesh>
      </group>
      <mesh ref={tether} material={tetherMat}><boxGeometry args={[0.02, 0.02, 1]} /></mesh>
      <mesh ref={railGlow} visible={false} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.5, 0.04, 8, 28]} /><meshBasicMaterial color="#35e07a" /></mesh>
    </>
  );
}

const ABORT_TEXT = {
  speed: { reason: 'The shuttle reached the port faster than the docking ring allows, so the approach was called off.', tip: 'Hold X to brake well before you arrive. In space nothing slows you down unless you fire thrusters the other way.' },
  alignment: { reason: 'The shuttle arrived out of line with the docking port, so the approach was called off.', tip: 'Put the cross under your crosshair first, then close in slowly.' },
};

export function StationMission() {
  const run = useGame((s) => s.run)!;
  const setPhase = useGame((s) => s.setPhase);
  const complete = useGame((s) => s.completeMission);
  const tier = run.tier;
  const phase = run.phase;
  const dock = useRef(makeDock());
  const [abort, setAbort] = useState<'speed' | 'alignment' | null>(null);
  const cargoStats = useRef({ wallHits: 0, recoveries: 0, pushes: 0, grabs: 0 });

  useEffect(() => { probe.dock = dock; }, []);

  useEffect(() => {
    if (phase === 'docking') {
      hud.set({
        objective: 'Line up with the docking port and arrive slowly',
        touch: 'flight', touchLabels: { primary: 'Close in', use: 'Use', brake: 'Brake' },
        labels: ['Fictional station', 'Distances and speeds are simplified'],
      });
    } else {
      hud.warn(null);
      hud.set({
        touch: 'drift', touchLabels: { primary: 'Push off', use: 'Grab', recover: 'Tether (R)' },
        labels: ['Fictional station', 'Movement is simplified to a flat plane'], crosshair: false,
      });
    }
  }, [phase]);

  const onDockEnd = (s: DockState) => {
    hud.warn(null);
    if (s.status === 'aborted') { playCue('fail'); setAbort(s.abortReason || 'speed'); return; }
    playCue('complete');
    hud.say('Hatch open. Welcome aboard the station.');
    hud.set({ objective: 'Docked. Hatch open', hint: null, crosshair: false });
    // The quality of the contact is kept for the debrief, in whole centimetres.
    window.setTimeout(() => setPhase('cargo', { stats: { dockAttempts: s.attempts, dockContact: Math.round(s.contactSpeed * 100), dockOff: Math.round(s.contactOff * 100) } }), 2200);
  };

  const onCargoDone = (d: DriftState) => {
    hud.warn(null);
    hud.say('Cargo stowed. Well floated.');
    const attempts = run.stats.dockAttempts ?? dock.current.attempts;
    window.setTimeout(() => complete({
      crewStatus: 'Docked, hatch open, cargo stowed. Crew is safe aboard the station.',
      consequence: `${attempts > 1
        ? `Your first approach was called off and the shuttle backed away to 25 metres. Slowing down earlier made attempt ${attempts} a soft dock.`
        : 'You lined up first and arrived slowly, so the docking ring made a soft capture on the first approach.'
      }${run.stats.dockContact !== undefined ? ` The rings met at ${(run.stats.dockContact / 100).toFixed(2)} m/s, ${((run.stats.dockOff ?? 0) / 100).toFixed(2)} m off centre. The ring lined the ports up and pulled in for a hard dock, and the hatch stayed shut until the tunnel held cabin pressure.` : ''} Inside, each push sent you drifting at the same speed until you grabbed a rail${d.recoveries > 0 ? `. After a missed rail you used the tether ${d.recoveries} ${d.recoveries === 1 ? 'time' : 'times'} to get back` : ''}. Nothing slows you down in free fall, so you plan the stop before you push.`,
      objectives: [
        { label: 'Dock with safe alignment and closing speed', done: true },
        { label: 'Move through the module with push, drift and grab', done: true },
        { label: tier === 'junior' ? 'Carry the cargo bag to storage' : 'Catch the loose cargo bag and stow it', done: true },
      ],
      stats: [
        { label: 'Docking attempts', value: String(attempts) },
        ...(run.stats.dockContact !== undefined ? [{ label: 'Contact speed', value: `${(run.stats.dockContact / 100).toFixed(2)} m/s` }] : []),
        { label: 'Push-offs', value: String(d.pushes) },
        { label: 'Rail grabs', value: String(d.grabs) },
        { label: 'Wall bumps', value: String(d.wallHits) },
        { label: 'Tether recoveries', value: String(d.recoveries) },
      ],
      outpost: null,
      rating: rateStation(attempts, d.recoveries),
    }), 1600);
  };

  return (
    <>
      {phase === 'docking'
        ? (
          <GameCanvas key="dock" fov={55} far={6000} envIntensity={0.12} background="#000003">
            <DockingScene sim={dock} tier={tier} onEnd={onDockEnd} />
          </GameCanvas>
        )
        : (
          <GameCanvas key="cargo" fov={46} envIntensity={0.5} background="#05070c">
            <CargoScene tier={tier} onDone={onCargoDone} stats={cargoStats} />
          </GameCanvas>
        )}
      {abort && (
        <ResetCard
          title="Approach aborted"
          reason={ABORT_TEXT[abort].reason}
          tip={ABORT_TEXT[abort].tip}
          retryLabel="Hold at 25 metres and try again"
          onRetry={() => { dock.current = retryDock(dock.current); setAbort(null); }}
        />
      )}
    </>
  );
}
