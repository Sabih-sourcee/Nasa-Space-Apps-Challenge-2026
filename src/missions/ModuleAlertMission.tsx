import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import * as THREE from 'three';
import { playCue } from '../game/audio';
import { hud } from '../game/hud';
import { input } from '../game/input';
import { probe } from '../game/probe';
import { useGame } from '../game/store';
import { makeDrifter, nearestRail, stepDrift, type DriftEnv, type DriftState } from '../sim/movement';
import { hintsOn } from '../sim/save';
import { rateAlert } from '../sim/score';
import {
  ALERT_TUNING, ARM, MODULE_LABEL, armPoints, abandonExperiment, canSeal, choosePlan, declareLeak, gaugeTrend, gaugesFor,
  inspectGauge, makeAlert, operateGripper, sealLab, stepAlert, stepArm, type AlertState, type ModuleId,
} from '../sim/station';
import type { Tier } from '../sim/types';
import { Astronaut, makeAnim } from '../three/Astronaut';
import { GameCanvas, SunLight, useReducedMotion, useSim } from '../three/GameCanvas';
import { M, Sign, Strut } from '../three/Props';
import { panelTexture } from '../three/textures';
import { Btn, Comm, Dialog } from '../ui/common';
import { ResetCard } from '../ui/Hud';
import { Icon } from '../ui/icons';
import { FLOAT_Y, Module, RAILS, driftEnv } from './StationMission';

/** What each handrail is next to in this mission. */
const STATION_AT: Record<string, { kind: 'gauge' | 'console' | 'arm' | 'none'; module?: ModuleId; label: string }> = {
  A: { kind: 'gauge', module: 'lab', label: 'Lab hatch gauge' },
  B: { kind: 'arm', label: 'Robotic arm station' },
  C: { kind: 'gauge', module: 'crew', label: 'Crew hatch gauge' },
  D: { kind: 'console', label: 'Main console' },
  E: { kind: 'gauge', module: 'storage', label: 'Storage hatch gauge' },
  S: { kind: 'none', label: '' },
};

type Refresh = () => void;

// ---------------------------------------------------------------------------
// Module view: push, drift and grab between the stations
// ---------------------------------------------------------------------------

function Stations({ alert }: { alert: React.MutableRefObject<AlertState> }) {
  const m = M();
  const s = alert.current;
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const reduced = useReducedMotion();
  useFrame(({ clock }) => {
    const on = alert.current.diagnosed && alert.current.leakOpen;
    const k = on ? (reduced ? 1 : 0.5 + 0.5 * Math.sin(clock.elapsedTime * 7)) : 0;
    if (beacon.current) beacon.current.emissiveIntensity = 0.05 + k * 4;
    if (light.current) light.current.intensity = k * 9;
  });
  const sealed = !s.leakOpen;
  return (
    <group>
      {RAILS.filter((r) => STATION_AT[r.id].kind !== 'none').map((r) => {
        const st = STATION_AT[r.id];
        const side = r.z < 0 ? -1 : 1;
        const color = st.kind === 'gauge' ? '#4de3ff' : st.kind === 'console' ? '#ffb020' : '#35e07a';
        return (
          <group key={r.id} position={[r.x + 0.85, 0, r.z]}>
            <Strut a={[0, 0, 0]} b={[0, 1.1, 0]} r={0.04} />
            <mesh position={[0, 1.3, 0]} rotation={[-0.35, 0, 0]} material={m.darkSteel}><boxGeometry args={[0.62, 0.44, 0.07]} /></mesh>
            <mesh position={[0, 1.31, 0.04]} rotation={[-0.35, 0, 0]}>
              <planeGeometry args={[0.52, 0.34]} />
              <meshStandardMaterial color="#0d1826" emissive={color} emissiveIntensity={0.9} />
            </mesh>
            <Sign lines={[st.label.toUpperCase()]} position={[0, side < 0 ? 2.75 : 1.85, side < 0 ? -0.72 : 0.06]} size={[1.9, 0.34]} accent={color} />
          </group>
        );
      })}
      {/* Lab hatch at the left end: beacon while leaking, green cover once sealed */}
      <Sign lines={['LAB MODULE']} position={[-9.06, 2.95, 0]} rotation={[0, Math.PI / 2, 0]} size={[2.2, 0.4]} accent={sealed ? '#35e07a' : '#e23d3d'} />
      <mesh position={[-9.02, 1.5, 0]} rotation={[0, Math.PI / 2, 0]} visible={sealed}>
        <circleGeometry args={[1.04, 28]} />
        <meshStandardMaterial color="#2f6b45" emissive="#35e07a" emissiveIntensity={0.5} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[-8.95, 2.75, 1.3]}>
        <sphereGeometry args={[0.14, 14, 10]} />
        <meshStandardMaterial ref={beacon} color="#5b1a1a" emissive="#ff3b30" emissiveIntensity={0.05} />
      </mesh>
      <pointLight ref={light} position={[-8.4, 2.6, 0.8]} intensity={0} distance={8} color="#ff3b30" />
      {/* Crew hatch on the back wall */}
      <mesh position={[-1.0, 1.55, -1.86]} material={m.darkSteel}><circleGeometry args={[0.78, 26]} /></mesh>
      <mesh position={[-1.0, 1.55, -1.85]} material={m.steel}><ringGeometry args={[0.78, 0.9, 26]} /></mesh>
      <Sign lines={['CREW MODULE']} position={[-1.0, 0.5, -1.85]} size={[1.7, 0.32]} />
    </group>
  );
}

function DriftRig({ env, drift, frozen, onUse, promptFor, target }: {
  env: DriftEnv; drift: React.MutableRefObject<DriftState>; frozen: boolean;
  onUse: (railId: string) => void; promptFor: (railId: string) => string | null; target: string | null;
}) {
  const anim = useRef(makeAnim('float'));
  const body = useRef<THREE.Group>(null);
  const arrow = useRef<THREE.Group>(null);
  const tether = useRef<THREE.Mesh>(null);
  const railGlow = useRef<THREE.Mesh>(null);
  const targetGlow = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const reduced = useReducedMotion();
  const look = useRef(new THREE.Vector3(drift.current.x * 0.75, 1.25, 0));
  const warned = useRef(false);
  const tick = useRef(0);

  useSim((dt) => {
    if (frozen) return;
    const d = drift.current;
    const use = input.consume('use');
    const near = nearestRail(env, d.x, d.z);
    const railInReach = !d.holding && !!near && near.dist <= env.reach;
    let grab = false;
    if (use) {
      if (railInReach) grab = true;
      else if (d.holding) onUse(d.holding);
    }
    const next = stepDrift(d, { aimX: 0, aimZ: 0, turn: -input.axisX(), push: input.consume('primary'), grab, recover: input.consume('recover') }, dt, env);
    if (next.pushes > d.pushes) playCue('click');
    if (next.grabs > d.grabs) playCue('ok');
    if (next.wallHits > d.wallHits) playCue('caution');
    if (next.recoveries > d.recoveries) { playCue('ok'); hud.say('Tether reeled in. You are back at the last rail.'); }
    drift.current = next;
    if (!next.holding && !warned.current && (next.freeTime > 7 || next.wallHits > d.wallHits)) {
      warned.current = true;
      hud.say('You missed the handrail. Press E near any rail to grab it, or press R to reel in your tether.');
    }
    if (next.holding) warned.current = false;
  }, (delta, elapsed) => {
    const d = drift.current;
    const bob = reduced ? 0 : Math.sin(elapsed * 1.3) * 0.04;
    if (body.current) {
      body.current.position.set(d.x, FLOAT_Y + bob, d.z);
      let diff = d.heading - body.current.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      body.current.rotation.y += diff * (1 - Math.exp(-10 * delta));
    }
    if (arrow.current) {
      arrow.current.visible = !!d.holding && !frozen;
      arrow.current.position.set(d.x, 1.5, d.z);
      arrow.current.rotation.y = d.heading;
    }
    const rail = RAILS.find((r) => r.id === d.lastRail) ?? RAILS[0];
    if (tether.current) {
      const len = Math.max(0.05, Math.hypot(d.x - rail.x, d.z - rail.z));
      tether.current.position.set((rail.x + d.x) / 2, 1.22, (rail.z + d.z) / 2);
      tether.current.rotation.set(0, Math.atan2(d.x - rail.x, d.z - rail.z), 0);
      tether.current.scale.set(1, 1, len);
    }
    const near = nearestRail(env, d.x, d.z);
    const railInReach = !d.holding && !!near && near.dist <= env.reach;
    if (railGlow.current && near) {
      railGlow.current.visible = railInReach;
      railGlow.current.position.set(near.rail.x, 1.25, near.rail.z);
    }
    const t = target ? RAILS.find((r) => r.id === target) : null;
    if (targetGlow.current) {
      targetGlow.current.visible = !!t && d.holding !== target;
      if (t) targetGlow.current.position.set(t.x, 0.06, t.z);
    }
    const tx = Math.max(-5.5, Math.min(5.5, d.x * 0.75));
    if (reduced) look.current.set(tx, 1.25, 0); else look.current.lerp(new THREE.Vector3(tx, 1.25, 0), 1 - Math.exp(-3 * delta));
    camera.position.set(look.current.x, 4.3, 9.4);
    camera.lookAt(look.current.x, 1.2, -0.4);

    if (tick.current++ % 6 !== 0) return;
    hud.set({
      prompt: frozen ? null
        : railInReach ? 'Press E: Grab the handrail'
          : d.holding ? (promptFor(d.holding) ?? 'Aim with A and D, then press Space to push off')
            : null,
      distance: t && d.holding !== target ? Math.hypot(t.x - d.x, t.z - d.z) : null,
    });
  });

  return (
    <>
      <Astronaut ref={body} anim={anim} />
      <group ref={arrow} visible={false}>
        <mesh position={[0, 0, 0.95]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.16, 0.42, 12]} /><meshBasicMaterial color="#4de3ff" /></mesh>
        <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.04, 0.04, 0.6, 8]} /><meshBasicMaterial color="#4de3ff" /></mesh>
      </group>
      <mesh ref={tether}><boxGeometry args={[0.02, 0.02, 1]} /><meshBasicMaterial color="#d0d4d8" /></mesh>
      <mesh ref={railGlow} visible={false} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.5, 0.04, 8, 28]} /><meshBasicMaterial color="#35e07a" /></mesh>
      <mesh ref={targetGlow} visible={false} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.75, 0.92, 36]} /><meshBasicMaterial color="#4de3ff" side={THREE.DoubleSide} /></mesh>
    </>
  );
}

// ---------------------------------------------------------------------------
// Robotic arm view
// ---------------------------------------------------------------------------

function ArmView({ alert, tier, onChange, onDone }: {
  alert: React.MutableRefObject<AlertState>; tier: Tier; onChange: Refresh; onDone: (abandoned: boolean) => void;
}) {
  const m = M();
  const tune = ALERT_TUNING[tier];
  const shoulder = useRef<THREE.Group>(null);
  const elbow = useRef<THREE.Group>(null);
  const can = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const beacon = useRef<THREE.PointLight>(null);
  const { camera } = useThree();
  const reduced = useReducedMotion();
  const settings = useGame((s) => s.save.settings);
  const hints = hintsOn(settings, tier);
  const tick = useRef(0);
  const done = useRef(false);
  const wall = useMemo(() => {
    const t = panelTexture('#d7dbdf', '#9aa2ab', 'labwall').clone();
    t.needsUpdate = true;
    t.repeat.set(5, 2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.65 });
  }, []);

  useSim((dt) => {
    if (done.current) return;
    const s = alert.current;
    if (s.status !== 'active') return;
    if (input.consume('recover')) {
      alert.current = abandonExperiment(s);
      done.current = true;
      hud.say('Rescue stopped. The canister stays in the lab. Go and seal the hatch.');
      onChange();
      onDone(true);
      return;
    }
    const arm = stepArm(s.arm, { moveX: input.axisX(), moveY: input.axisY() }, dt, tune.armMode);
    let next = arm === s.arm ? s : { ...s, arm };
    const grip = input.consume('use');
    const alsoGrip = input.consume('primary');
    if (grip || alsoGrip) {
      const res = operateGripper(next, tier);
      next = res.state;
      if (res.result === 'gripped') { playCue('ok'); hud.say('Gripper closed on the canister. Now carry it to the transfer port.'); onChange(); }
      else if (res.result === 'released') { playCue('complete'); hud.say('Canister is safe in the transfer port. Now seal the lab hatch.'); }
      else if (res.result === 'too_far') { playCue('caution'); hud.say('The gripper is not on the canister yet. Move closer.'); }
      else if (res.result === 'not_over_port') { playCue('caution'); hud.say('Not over the transfer port yet. Keep hold and move closer.'); }
    }
    alert.current = next;
    if (next.experiment === 'safe') { done.current = true; onChange(); onDone(false); }
  }, (_, elapsed) => {
    const s = alert.current;
    const p = armPoints(s.arm);
    if (shoulder.current) shoulder.current.rotation.z = s.arm.shoulder;
    if (elbow.current) elbow.current.rotation.z = s.arm.elbow;
    if (can.current) {
      if (s.experiment === 'gripped') can.current.position.set(p.x, p.y - 0.2, 0);
      else if (s.experiment === 'safe') can.current.position.set(ARM.port.x, ARM.port.y - 0.2, 0);
      else can.current.position.set(ARM.canister.x, ARM.canister.y - 0.2, 0);
    }
    const target = s.experiment === 'gripped' ? ARM.port : ARM.canister;
    const dist = Math.hypot(p.x - target.x, p.y - target.y);
    const within = dist <= tune.gripTol;
    if (ring.current) {
      ring.current.position.set(target.x, target.y, 0.02);
      (ring.current.material as THREE.MeshBasicMaterial).color.set(within ? '#35e07a' : '#ffb020');
    }
    if (beacon.current) beacon.current.intensity = s.leakOpen ? (reduced ? 6 : 4 + Math.sin(elapsed * 7) * 4) : 0;
    camera.position.set(0.2, 2.0, 8.6);
    camera.lookAt(0.2, 1.7, 0);

    if (tick.current++ % 6 !== 0) return;
    hud.set({
      objective: s.experiment === 'gripped' ? 'Carry the canister to the transfer port and release it' : 'Move the gripper onto the experiment canister and close it',
      prompt: within ? (s.experiment === 'gripped' ? 'Press E: Release into the transfer port' : 'Press E: Close the gripper') : null,
      distance: null,
      readouts: [
        { label: s.experiment === 'gripped' ? 'Gripper to port' : 'Gripper to canister', value: `${dist.toFixed(2)} m`, status: within ? 'ok' : 'caution', note: `grip works within ${tune.gripTol.toFixed(2)} m` },
        { label: 'Arm control', value: tune.armMode === 'tip' ? 'Gripper steering' : 'Joint by joint', note: tune.armMode === 'tip' ? 'the computer works out the joints' : 'A and D: shoulder. W and S: elbow' },
        { label: 'Canister', value: s.experiment === 'gripped' ? 'In the gripper' : 'On the lab bench' },
      ],
      hint: !hints ? null : tune.armMode === 'tip'
        ? 'Use W A S D to move the gripper to the amber ring. It turns green when you are close enough.'
        : 'A and D swing the whole arm. W and S bend the elbow. Use both to bring the gripper to the ring.',
      touch: 'drift', touchLabels: { primary: 'Grip', use: 'Grip', recover: 'Give up (R)', move: 'Move the arm' },
    });
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <SunLight direction={[0.3, 1, 0.8]} intensity={1.4} size={10} />
      <pointLight position={[0, 4, 3]} intensity={30} distance={14} color="#eaf2ff" />
      <pointLight ref={beacon} position={[3.8, 3.6, 1]} intensity={0} distance={10} color="#ff3b30" />
      <mesh position={[0, 2.1, -1.2]} material={wall} receiveShadow><boxGeometry args={[11, 5.2, 0.2]} /></mesh>
      <mesh position={[0, -0.6, 0]} material={m.darkSteel} receiveShadow><boxGeometry args={[11, 0.2, 3]} /></mesh>
      <Sign lines={['LAB MODULE', 'Arm camera']} position={[-3.9, 4.1, -1.08]} size={[2.4, 0.8]} accent="#e23d3d" />
      {/* Bench and experiment canister */}
      <mesh position={[ARM.canister.x + 0.2, ARM.canister.y - 0.85, 0]} material={m.white} castShadow><boxGeometry args={[1.4, 0.9, 1.0]} /></mesh>
      <Sign lines={['EXPERIMENT']} position={[ARM.canister.x + 0.2, ARM.canister.y - 0.9, 0.51]} size={[1.2, 0.3]} accent="#35e07a" />
      <group ref={can}>
        <mesh castShadow><cylinderGeometry args={[0.2, 0.2, 0.42, 18]} /><meshStandardMaterial color="#35a85a" roughness={0.4} metalness={0.3} /></mesh>
        <mesh position={[0, 0.24, 0]} material={m.steel}><cylinderGeometry args={[0.1, 0.1, 0.08, 14]} /></mesh>
      </group>
      {/* Transfer port to the safe side of the hatch */}
      <group position={[ARM.port.x, ARM.port.y, -0.2]}>
        <mesh material={m.navy}><boxGeometry args={[1.0, 1.0, 0.5]} /></mesh>
        <mesh position={[0, 0, 0.26]} material={m.black}><circleGeometry args={[0.36, 22]} /></mesh>
        <mesh position={[0, 0, 0.27]} material={m.steel}><ringGeometry args={[0.36, 0.44, 22]} /></mesh>
        <Sign lines={['TRANSFER PORT']} position={[0, 0.75, 0.26]} size={[1.5, 0.3]} accent="#4de3ff" />
      </group>
      <mesh ref={ring}><ringGeometry args={[ALERT_TUNING[tier].gripTol - 0.04, ALERT_TUNING[tier].gripTol, 36]} /><meshBasicMaterial color="#ffb020" side={THREE.DoubleSide} transparent opacity={0.9} /></mesh>
      {/* Arm: base, two links, gripper */}
      <mesh position={[0, -0.3, 0]} material={m.darkSteel} castShadow><cylinderGeometry args={[0.45, 0.6, 0.5, 20]} /></mesh>
      <group ref={shoulder}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={m.yellow}><cylinderGeometry args={[0.22, 0.22, 0.4, 18]} /></mesh>
        <mesh position={[ARM.l1 / 2, 0, 0]} material={m.white} castShadow><boxGeometry args={[ARM.l1, 0.2, 0.22]} /></mesh>
        <group ref={elbow} position={[ARM.l1, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={m.yellow}><cylinderGeometry args={[0.18, 0.18, 0.36, 18]} /></mesh>
          <mesh position={[ARM.l2 / 2, 0, 0]} material={m.white} castShadow><boxGeometry args={[ARM.l2, 0.16, 0.18]} /></mesh>
          <group position={[ARM.l2, 0, 0]}>
            <mesh material={m.steel}><sphereGeometry args={[0.13, 14, 10]} /></mesh>
            <mesh position={[0.02, 0.17, 0]} material={m.darkSteel}><boxGeometry args={[0.07, 0.26, 0.1]} /></mesh>
            <mesh position={[0.02, -0.17, 0]} material={m.darkSteel}><boxGeometry args={[0.07, 0.26, 0.1]} /></mesh>
          </group>
        </group>
      </group>
    </>
  );
}

/** Advances the leak while the player is free to act, and keeps the two meters current. */
function LeakClock({ alert, tier, frozen, onCritical }: { alert: React.MutableRefObject<AlertState>; tier: Tier; frozen: boolean; onCritical: () => void }) {
  const tick = useRef(0);
  const lowWarned = useRef(false);
  const fired = useRef(false);
  useSim((dt) => {
    if (frozen) return;
    const next = stepAlert(alert.current, dt, tier);
    alert.current = next;
    if (next.status === 'critical' && !fired.current) { fired.current = true; playCue('fail'); onCritical(); }
    if (next.diagnosed && next.leakOpen && next.reserve < 55 && !lowWarned.current) {
      lowWarned.current = true;
      hud.warn({ title: 'AIR RESERVE LOW', text: 'The leak is still open. Seal the lab hatch soon. In the arm view, R gives up the rescue.', level: 'caution' });
    }
  }, () => {
    if (tick.current++ % 6 !== 0) return;
    const s = alert.current;
    const crit = ALERT_TUNING[tier].critical;
    hud.set({
      meters: [
        { id: 'reserve', label: 'Air reserve', value: s.reserve, max: 100, text: `${Math.round(s.reserve)}%`, status: s.reserve < crit + 12 ? 'low' : s.reserve < 75 ? 'caution' : 'ok', note: s.leakOpen ? `Leaking. Mission stops below ${crit}%` : 'Leak sealed' },
        { id: 'lab', label: 'Lab pressure', value: Math.max(0, s.labPressure - 90), max: 11.3, text: `${s.labPressure.toFixed(1)} kPa`, status: s.leakOpen ? 'low' : 'ok', note: s.leakOpen ? 'falling' : 'holding steady' },
      ],
    });
  });
  return null;
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

function GaugePanel({ tier, module, onClose }: { tier: Tier; module: ModuleId; onClose: () => void }) {
  const settings = useGame((s) => s.save.settings);
  const hints = hintsOn(settings, tier);
  const g = gaugesFor(tier).find((x) => x.module === module)!;
  const trend = gaugeTrend(g);
  return (
    <Dialog title={`${MODULE_LABEL[module]}: hatch gauge`} icon="gauge" kicker="Pressure reading" onClose={onClose}>
      <dl className="stat-tiles">
        <div className="stat-tile"><dd>{g.now.toFixed(1)} kPa</dd><dt>Pressure now</dt></div>
        <div className="stat-tile"><dd>{g.before.toFixed(1)} kPa</dd><dt>One minute ago</dt></div>
        {tier === 'junior' && <div className={`stat-tile ${trend === 'falling' ? 'down' : ''}`}><dd>{trend === 'falling' ? '▼ FALLING' : 'STEADY'}</dd><dt>Trend</dt></div>}
        {tier === 'advanced' && <div className={`stat-tile ${g.sensor === 'ok' ? '' : 'down'}`}><dd>{g.sensor === 'ok' ? 'OK' : 'FAILED: reading frozen'}</dd><dt>Sensor self-test</dt></div>}
      </dl>
      {hints && tier !== 'junior' && <Comm name="Tip" tone="tip">Compare now with one minute ago. A leak keeps falling. A low number that does not move is something else.</Comm>}
      <div className="dialog-actions"><Btn autoFocus size="lg" icon="check" onClick={onClose}>Got it</Btn></div>
      <p className="fine center">Illustrative readings for a fictional station.</p>
    </Dialog>
  );
}

function ConsolePanel({ alert, tier, onClose, onChange, onFound }: {
  alert: React.MutableRefObject<AlertState>; tier: Tier; onClose: () => void; onChange: Refresh; onFound: () => void;
}) {
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const s = alert.current;
  const tune = ALERT_TUNING[tier];
  const gauges = gaugesFor(tier);

  if (!s.diagnosed) {
    const report = (module: ModuleId) => {
      const res = declareLeak(alert.current, module, tier);
      alert.current = res.state;
      playCue(res.correct ? 'ok' : 'caution');
      setNote({ text: res.reason, good: res.correct });
      onChange();
      if (res.correct) onFound();
    };
    // Until every gauge has been read, focus starts on "Step back" so a stray key press cannot file a report.
    const allRead = gauges.every((g) => s.inspected[g.module]);
    return (
      <Dialog title="Which module is leaking?" icon="warning" kicker="Main console" onClose={onClose} wide>
        <p className="lead">Report the module whose pressure is falling. A wrong report seals a healthy module and costs {tune.wrongPenalty}% of the air reserve.</p>
        <ul className="module-grid">
          {gauges.map((g, i) => (
            <li key={g.module} className="module-card">
              <strong>{MODULE_LABEL[g.module]}</strong>
              {s.inspected[g.module]
                ? (
                  <>
                    <span className="module-now">{g.now.toFixed(1)} kPa now</span>
                    <span className="module-then">{g.before.toFixed(1)} kPa one minute ago</span>
                    {tier === 'advanced' && <span className="module-then">Sensor: {g.sensor === 'ok' ? 'OK' : 'FROZEN'}</span>}
                  </>
                )
                : <span className="module-unread">Not read yet. Visit its hatch gauge.</span>}
              <Btn kind="blue" size="sm" block icon="flag" autoFocus={allRead && i === 0} onClick={() => report(g.module)}>Report: {MODULE_LABEL[g.module]}</Btn>
            </li>
          ))}
        </ul>
        {note && <p className={note.good ? 'hint-line' : 'note'} role="status">{note.text}</p>}
        <div className="dialog-actions"><Btn kind="ghost" autoFocus={!allRead} onClick={onClose}>Step back</Btn></div>
        <p className="fine center">No timer while this panel is open.</p>
      </Dialog>
    );
  }

  if (s.plan === 'none') {
    const pick = (plan: 'seal_now' | 'save_first') => {
      alert.current = choosePlan(alert.current, plan);
      playCue('ok');
      onChange();
      onClose();
      hud.say(plan === 'seal_now' ? 'Plan set: seal the lab hatch now.' : 'Plan set: rescue the experiment with the robotic arm, then seal the hatch.');
    };
    const per10 = (tune.leakRate * 10).toFixed(1);
    return (
      <Dialog title="Leak found: the lab module" icon="warning" kicker="Choose your plan" onClose={onClose} wide tone="alert">
        {note && <p className="hint-line" role="status">{note.text}</p>}
        <p className="lead">Air reserve is at <strong>{Math.round(s.reserve)}%</strong>. While the lab hatch is open, the leak drains about <strong>{per10}%</strong> every 10 seconds. An experiment canister is still inside the lab.</p>
        <div className="stack">
          <button type="button" className="pick-card" data-autofocus onClick={() => pick('seal_now')}>
            <span className="pick-num"><Icon name="shield" size={22} /></span>
            <span className="pick-main">
              <span className="pick-title">Seal the lab hatch now</span>
              <span className="pick-meta">Stops the leak soonest and keeps the most air. The experiment stays inside and is lost.</span>
            </span>
            <Icon name="arrow" size={22} />
          </button>
          <button type="button" className="pick-card" onClick={() => pick('save_first')}>
            <span className="pick-num"><Icon name="flask" size={22} /></span>
            <span className="pick-main">
              <span className="pick-title">Rescue the experiment first</span>
              <span className="pick-meta">Move the canister to the transfer port with the robotic arm, then seal. Saves the experiment and costs air for every second it takes.</span>
            </span>
            <Icon name="arrow" size={22} />
          </button>
        </div>
        <p className="fine center">No timer while this panel is open. Pressures and leak rates are illustrative.</p>
      </Dialog>
    );
  }

  return (
    <Dialog title="Main console" icon="list" kicker="Plan locked in" onClose={onClose}>
      <p className="lead">Plan: <strong>{s.plan === 'seal_now' ? 'seal the lab hatch now' : 'rescue the experiment, then seal the hatch'}</strong>.</p>
      <dl className="stat-tiles">
        <div className="stat-tile"><dd>{Math.round(s.reserve)}%</dd><dt>Air reserve</dt></div>
        <div className="stat-tile"><dd>{s.experiment === 'safe' ? 'Safe' : 'In the lab'}</dd><dt>Experiment</dt></div>
      </dl>
      <div className="dialog-actions"><Btn autoFocus size="lg" icon="check" onClick={onClose}>Got it</Btn></div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Mission
// ---------------------------------------------------------------------------

type Panel = null | { kind: 'gauge'; module: ModuleId } | { kind: 'console' } | { kind: 'critical' };

export function ModuleAlertMission() {
  const run = useGame((s) => s.run)!;
  const settings = useGame((s) => s.save.settings);
  const setPhase = useGame((s) => s.setPhase);
  const restart = useGame((s) => s.restartFromCheckpoint);
  const complete = useGame((s) => s.completeMission);
  const tier = run.tier;
  const hints = hintsOn(settings, tier);
  const env = useMemo(() => driftEnv(tier), [tier]);
  const drift = useRef(makeDrifter(env, 'D', -Math.PI / 2));
  const alert = useRef<AlertState>((() => {
    const a = makeAlert(tier);
    // Restore the Leak found checkpoint.
    return run.phase === 'respond'
      ? { ...a, diagnosed: true, reserve: run.stats.reserve ?? a.reserve, wrongCalls: run.stats.wrongCalls ?? 0, t: run.stats.leakTime ?? 0, inspected: { lab: true, crew: true, storage: true } }
      : a;
  })());
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [panel, setPanel] = useState<Panel>(null);
  const [view, setView] = useState<'module' | 'arm'>('module');
  const finished = useRef(false);
  const s = alert.current;

  useEffect(() => { probe.alert = alert; probe.drift = drift; }, []);

  const target: string | null = !s.diagnosed
    ? (!s.inspected.lab ? 'A' : !s.inspected.crew ? 'C' : !s.inspected.storage ? 'E' : 'D')
    : s.plan === 'none' ? 'D'
      : s.plan === 'save_first' && s.experiment !== 'safe' ? 'B'
        : s.leakOpen ? 'A' : null;

  useEffect(() => {
    if (view === 'arm') return;
    const cur = alert.current;
    const read = Object.values(cur.inspected).filter(Boolean).length;
    hud.set({
      objective: !cur.diagnosed
        ? (read < 3 ? `Read the hatch gauges (${read} of 3 read), then report the leak at the main console` : 'Report the leaking module at the main console')
        : cur.plan === 'none' ? 'Choose a plan at the main console'
          : cur.plan === 'save_first' && cur.experiment !== 'safe' ? 'Go to the robotic arm station and rescue the experiment'
            : cur.leakOpen ? 'Go to the lab hatch and seal it' : 'Lab hatch sealed',
      readouts: [
        { label: 'Gauges read', value: `${read} of 3` },
        { label: 'Leak', value: cur.diagnosed ? (cur.leakOpen ? 'Lab module: open' : 'Lab module: sealed') : 'Not found yet', status: cur.leakOpen ? 'caution' : 'ok' },
        { label: 'Experiment', value: cur.experiment === 'safe' ? 'Safe' : cur.experiment === 'lost' ? 'Left in the lab' : 'In the lab' },
        { label: 'Wrong reports', value: String(cur.wrongCalls) },
      ],
      touch: 'drift', touchLabels: { primary: 'Push off', use: 'Use', recover: 'Tether (R)' },
      labels: ['Fictional station and procedure', 'Pressures and leak rates are illustrative', 'Time is compressed'],
      hint: !hints ? null
        : !cur.diagnosed ? 'Follow the blue ring on the floor. Hold a rail, aim with A and D, press Space to push off, and E to grab the next rail.'
          : cur.plan === 'none' ? 'The main console is the amber screen in the middle of the module.'
            : 'Follow the blue ring on the floor to the next station.',
      crosshair: false,
    });
  });

  useEffect(() => {
    if (alert.current.diagnosed) return;
    hud.warn({ title: 'PRESSURE ALERT', text: 'Air is leaking from one module. Read the three hatch gauges, then report the leak at the main console.', level: 'alert', sourceId: 'eclss' });
  }, []);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    hud.warn(null);
    playCue('complete');
    hud.say('Lab hatch sealed. The pressure is holding.');
    const end = alert.current;
    const saved = end.experiment === 'safe';
    const read = Object.values(end.inspected).filter(Boolean).length;
    window.setTimeout(() => complete({
      crewStatus: `Leak isolated with ${Math.round(end.reserve)}% of the air reserve left. The experiment was ${saved ? 'saved' : 'left in the sealed lab'}.`,
      consequence: `${end.wrongCalls === 0
        ? 'You reported the lab on the first try: its pressure was the one still falling.'
        : `You reported ${end.wrongCalls} healthy ${end.wrongCalls === 1 ? 'module' : 'modules'} first. Each wrong report sealed a module that was not leaking and wasted air.`
      } ${saved
        ? 'You chose to rescue the experiment before sealing. The canister is safe, and the air reserve paid for every second the hatch stayed open.'
        : 'You sealed the hatch without the canister. That kept more air in reserve and cost the experiment.'
      } Neither choice was free.`,
      objectives: [
        { label: 'Read the hatch gauges', done: read > 0 },
        { label: 'Find the leaking module', done: true },
        { label: 'Seal the lab hatch before the reserve runs low', done: true },
        { label: 'Rescue the experiment with the robotic arm', done: saved },
      ],
      stats: [
        { label: 'Air reserve left', value: `${Math.round(end.reserve)}%` },
        { label: 'Wrong reports', value: String(end.wrongCalls) },
        { label: 'Gauges read', value: `${read} of 3` },
        { label: 'Experiment', value: saved ? 'Saved' : 'Lost' },
        { label: 'Time with the leak open (compressed)', value: `${Math.round(end.t)} s` },
      ],
      outpost: null,
      rating: rateAlert(end.wrongCalls, end.reserve, saved),
    }), 1500);
  };

  const onUse = (railId: string) => {
    const st = STATION_AT[railId];
    const cur = alert.current;
    if (railId === 'A' && canSeal(cur)) {
      alert.current = sealLab(cur);
      refresh();
      finish();
      return;
    }
    if (st.kind === 'gauge' && st.module) {
      alert.current = inspectGauge(cur, st.module);
      playCue('click');
      refresh();
      setPanel({ kind: 'gauge', module: st.module });
      return;
    }
    if (st.kind === 'console') { playCue('click'); setPanel({ kind: 'console' }); return; }
    if (st.kind === 'arm') {
      if (cur.plan === 'save_first' && cur.experiment !== 'safe' && cur.leakOpen) { playCue('click'); hud.say('Arm camera on. You are operating the lab arm from here.'); setView('arm'); }
      else hud.say(cur.experiment === 'safe' ? 'Arm station. The canister is already safe.' : 'Arm station. The arm is parked. Choose the rescue plan at the main console to use it.');
    }
  };

  const promptFor = (railId: string): string | null => {
    const st = STATION_AT[railId];
    const cur = alert.current;
    if (railId === 'A' && canSeal(cur)) return cur.experiment === 'safe' ? 'Press E: Close and seal the lab hatch' : 'Press E: Close and seal the lab hatch (the experiment stays inside)';
    if (st.kind === 'gauge') return `Press E: Read the ${st.label.toLowerCase()}`;
    if (st.kind === 'console') return !cur.diagnosed ? 'Press E: Report the leak at the main console' : cur.plan === 'none' ? 'Press E: Choose a plan at the main console' : 'Press E: Check the main console';
    if (st.kind === 'arm') return cur.plan === 'save_first' && cur.experiment !== 'safe' ? 'Press E: Operate the robotic arm' : 'Press E: Check the arm station';
    return null;
  };

  const frozen = panel !== null || s.status !== 'active';
  return (
    <>
      <GameCanvas fov={46} envIntensity={0.5} background="#05070c">
        <LeakClock alert={alert} tier={tier} frozen={frozen} onCritical={() => { hud.warn(null); setPanel({ kind: 'critical' }); }} />
        {view === 'module'
          ? (
            <>
              <ambientLight intensity={0.55} />
              <SunLight direction={[0.2, 1, 0.6]} intensity={1.1} size={12} />
              <Module storageLabel="STORAGE MODULE" />
              <Stations alert={alert} />
              <DriftRig env={env} drift={drift} frozen={frozen} onUse={onUse} promptFor={promptFor} target={target} />
            </>
          )
          : (
            <ArmView
              alert={alert} tier={tier} onChange={refresh}
              onDone={() => { setView('module'); refresh(); }}
            />
          )}
      </GameCanvas>

      {panel?.kind === 'gauge' && <GaugePanel tier={tier} module={panel.module} onClose={() => setPanel(null)} />}
      {panel?.kind === 'console' && (
        <ConsolePanel
          alert={alert} tier={tier} onChange={refresh} onClose={() => setPanel(null)}
          onFound={() => {
            hud.warn({ title: 'LEAK FOUND: LAB MODULE', text: 'The beacon at the lab hatch is flashing. Choose a plan at the main console.', level: 'caution' });
            setPhase('respond', { stats: { reserve: Math.round(alert.current.reserve * 10) / 10, wrongCalls: alert.current.wrongCalls, leakTime: Math.round(alert.current.t) } });
          }}
        />
      )}
      {panel?.kind === 'critical' && (
        <ResetCard
          title="Air reserve below the limit"
          reason={`The station air reserve fell below ${ALERT_TUNING[tier].critical}% while the leak was still open, so the crew moved to the shuttle.`}
          tip={alert.current.diagnosed
            ? 'Sealing the hatch stops the drain at once. If the rescue is taking too long, press R in the arm view to give it up.'
            : 'Read the gauges in order and report the module whose pressure is falling. A wrong report wastes air.'}
          retryLabel="Back to the last checkpoint"
          onRetry={restart}
        />
      )}
    </>
  );
}
