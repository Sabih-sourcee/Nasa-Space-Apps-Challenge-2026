import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { playCue } from '../game/audio';
import { hud } from '../game/hud';
import { input } from '../game/input';
import { probe } from '../game/probe';
import { useGame } from '../game/store';
import {
  ASCENT_GATES, ASCENT_TUNING, ORBIT_SPEED, ascentDeviation, makeAscent, stepAscent, type AscentState,
} from '../sim/flight';
import { hintsOn } from '../sim/save';
import { rateAscent } from '../sim/score';
import type { Tier } from '../sim/types';
import { Astronaut, makeAnim } from '../three/Astronaut';
import { GameCanvas, SunLight, useReducedMotion, useSim } from '../three/GameCanvas';
import { LaunchTower, M } from '../three/Props';
import { EarthGlobe, SkyDome, Stars } from '../three/Scenery';
import { groundTexture, makeScreen } from '../three/textures';
import { Btn, Keycap } from '../ui/common';
import { ResetCard } from '../ui/Hud';
import { Icon } from '../ui/icons';

interface CheckItem { id: string; label: string; done: string; twice?: boolean }

function checklist(tier: Tier): CheckItem[] {
  return [
    { id: 'hatch', label: 'Close and lock the hatch', done: 'LOCKED' },
    { id: 'air', label: 'Connect suit air to the ship', done: 'FLOWING' },
    { id: 'guidance', label: 'Align the guidance platform', done: 'ALIGNED', twice: tier !== 'junior' },
    { id: 'engines', label: 'Arm the main engines', done: 'ARMED' },
  ];
}

const COUNTDOWN = 6;
const UNIT = 2.2; // metres of window space per unit of course deviation

/** Redraw the cockpit displays from simulation state. Every number here is live. */
function drawPanel(ctx: CanvasRenderingContext2D, w: number, h: number, s: AscentState, tier: Tier, phase: string, checks: number, total: number, countdown: number) {
  const tune = ASCENT_TUNING[tier];
  ctx.fillStyle = '#05080f';
  ctx.fillRect(0, 0, w, h);
  const pw = w / 3;
  ctx.lineWidth = 3;
  ctx.textBaseline = 'middle';
  const frame = (i: number, title: string) => {
    ctx.strokeStyle = '#2b3b55';
    ctx.strokeRect(i * pw + 8, 8, pw - 16, h - 16);
    ctx.fillStyle = '#7fd6ff';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, i * pw + 22, 30);
  };

  // 1. Course deviation indicator
  frame(0, 'COURSE');
  const cx = pw / 2, cy = h / 2 + 14, R = Math.min(pw, h) * 0.34;
  const scale = R / 3;
  ctx.strokeStyle = '#33506e';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
  const d = ascentDeviation(s);
  const on = d <= tune.gateTol;
  ctx.strokeStyle = on ? '#35e07a' : '#ffb020';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cx, cy, tune.gateTol * scale, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = on ? '#35e07a' : '#ff5a4d';
  const mx = cx + Math.max(-3, Math.min(3, s.dx)) * scale;
  const my = cy - Math.max(-3, Math.min(3, s.dy)) * scale;
  ctx.beginPath(); ctx.moveTo(mx, my - 14); ctx.lineTo(mx + 12, my + 10); ctx.lineTo(mx - 12, my + 10); ctx.closePath(); ctx.fill();
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(phase === 'ascent' ? (on ? 'ON COURSE' : 'OFF COURSE') : 'STANDBY', cx, h - 30);

  // 2. Speed and altitude
  frame(1, 'SPEED  km/s');
  ctx.fillStyle = '#f2f4f7';
  ctx.font = 'bold 84px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(s.speed.toFixed(2), pw * 1.5, h * 0.4);
  const bx = pw + 30, bw = pw - 60, by = h * 0.62;
  ctx.fillStyle = '#1b2738';
  ctx.fillRect(bx, by, bw, 22);
  const max = 8.6;
  ctx.fillStyle = 'rgba(53,224,122,0.45)';
  ctx.fillRect(bx + (tune.band[0] / max) * bw, by, ((tune.band[1] - tune.band[0]) / max) * bw, 22);
  ctx.fillStyle = '#7fd6ff';
  ctx.fillRect(bx, by + 5, Math.min(1, s.speed / max) * bw, 12);
  ctx.font = '20px Arial, sans-serif';
  ctx.fillStyle = '#9fb2c8';
  ctx.fillText(`ORBIT ${ORBIT_SPEED.toFixed(1)}   ALT ${Math.round(s.altitude)} km`, pw * 1.5, by + 46);

  // 3. Engines and status
  frame(2, phase === 'ascent' ? 'ENGINES' : 'LAUNCH READY');
  const ex = pw * 2 + 30;
  if (phase === 'ascent') {
    const bar = (y: number, label: string, v: number, color: string) => {
      ctx.textAlign = 'left';
      ctx.font = '20px Arial, sans-serif';
      ctx.fillStyle = '#9fb2c8';
      ctx.fillText(label, ex, y);
      ctx.fillStyle = '#1b2738';
      ctx.fillRect(ex, y + 16, pw - 60, 20);
      ctx.fillStyle = color;
      ctx.fillRect(ex, y + 16, (pw - 60) * Math.max(0, Math.min(1, v)), 20);
    };
    bar(64, `THROTTLE ${Math.round(s.throttle * 100)}%`, s.throttle, '#ffb020');
    bar(128, `FUEL ${Math.round((s.fuel / tune.fuel) * 100)}%`, s.fuel / tune.fuel, s.fuel / tune.fuel < 0.2 ? '#ff5a4d' : '#35e07a');
    ctx.fillStyle = '#f2f4f7';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText(`GATES ${s.gatesHit} / ${ASCENT_GATES.length}   MISSED ${s.gatesMissed}`, ex, 206);
    if (s.deviationTimer > 0 || (s.deviationFired && !on)) {
      ctx.fillStyle = '#ff5a4d';
      ctx.fillText('GUIDANCE FAULT', ex, 240);
    }
  } else {
    ctx.textAlign = 'left';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillStyle = checks >= total ? '#35e07a' : '#ffb020';
    ctx.fillText(`CHECKS ${checks} / ${total}`, ex, 80);
    ctx.fillStyle = '#f2f4f7';
    ctx.font = 'bold 54px Arial, sans-serif';
    ctx.fillText(checks >= total ? `T-${Math.ceil(countdown).toString().padStart(2, '0')}` : 'HOLD', ex, 160);
  }
}

function Cockpit({ sim, tier, phase, done, total, countdown }: {
  sim: React.MutableRefObject<AscentState>; tier: Tier; phase: string; done: number; total: number; countdown: React.MutableRefObject<number>;
}) {
  const m = M();
  const anim = useRef(makeAnim('sit'));
  const screen = useMemo(() => makeScreen(1536, 300), []);
  const lever = useRef<THREE.Mesh>(null);
  const caution = useRef<THREE.MeshStandardMaterial>(null);
  const card = useRef<THREE.Mesh>(null);
  const reduced = useReducedMotion();
  const tick = useRef(0);
  const float = useRef(0);
  const shell = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a2f37', roughness: 0.75, metalness: 0.3 }), []);
  const trim = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a515c', roughness: 0.6, metalness: 0.5 }), []);

  useFrame(({ clock }, delta) => {
    const s = sim.current;
    if (tick.current++ % 6 === 0) {
      drawPanel(screen.ctx, 1536, 300, s, tier, phase, done, total, countdown.current);
      screen.texture.needsUpdate = true;
    }
    if (lever.current) lever.current.rotation.x = 0.5 - s.throttle * 1.0;
    if (caution.current) {
      const fault = s.deviationTimer > 0 || (s.deviationFired && ascentDeviation(s) > ASCENT_TUNING[tier].gateTol);
      caution.current.emissiveIntensity = fault ? (reduced ? 3 : 1.5 + Math.sin(clock.elapsedTime * 10) * 1.5) : 0.05;
    }
    // In orbit the checklist card drifts off the panel: everything is in free fall together.
    if (card.current) {
      if (s.status === 'orbit') float.current = Math.min(1, float.current + delta * 0.25);
      const f = float.current;
      card.current.position.set(-0.95 + f * 0.45, 1.3 + f * 0.36, -0.98 + f * 0.35);
      card.current.rotation.set(-1.45 + f * 1.1, f * 0.8, f * 0.5);
    }
  });

  const lamp = (i: number) => (
    <mesh key={i} position={[-0.36 + i * 0.24, 1.2, -0.93]}>
      <boxGeometry args={[0.12, 0.05, 0.03]} />
      <meshStandardMaterial color={i < done ? '#35e07a' : '#5b2a2a'} emissive={i < done ? '#35e07a' : '#ff3b30'} emissiveIntensity={i < done ? 2.2 : 0.5} />
    </mesh>
  );

  return (
    <group>
      {/* Floor, side walls, overhead panel */}
      <mesh position={[0, -0.05, 0.4]} material={shell}><boxGeometry args={[3.2, 0.1, 4]} /></mesh>
      <mesh position={[-1.55, 0.6, 0.4]} material={shell}><boxGeometry args={[0.1, 1.3, 4]} /></mesh>
      <mesh position={[1.55, 0.6, 0.4]} material={shell}><boxGeometry args={[0.1, 1.3, 4]} /></mesh>
      <mesh position={[0, 2.25, 0.7]} material={shell}><boxGeometry args={[3.2, 0.12, 3.4]} /></mesh>
      <mesh position={[0, 2.16, -0.4]} rotation={[0.35, 0, 0]} material={trim}><boxGeometry args={[1.5, 0.06, 0.7]} /></mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[-0.55 + (i % 6) * 0.22, 2.11 + Math.floor(i / 6) * 0.06, -0.52 + Math.floor(i / 6) * 0.2]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.07, 0.03, 0.05]} />
          <meshStandardMaterial color="#1c2026" emissive={i % 5 === 0 ? '#ffb020' : '#35e07a'} emissiveIntensity={0.8} />
        </mesh>
      ))}
      {/* Window frame */}
      {[-1.5, -0.5, 0.5, 1.5].map((x) => <mesh key={x} position={[x, 1.72, -1.15]} rotation={[0.25, 0, 0]} material={trim}><boxGeometry args={[0.09, 1.05, 0.12]} /></mesh>)}
      <mesh position={[0, 2.2, -1.02]} material={trim}><boxGeometry args={[3.2, 0.12, 0.14]} /></mesh>
      {/* Glare shield, instrument panel and displays */}
      <mesh position={[0, 1.24, -1.1]} material={shell}><boxGeometry args={[3.2, 0.1, 0.5]} /></mesh>
      <mesh position={[0, 0.72, -1.05]} rotation={[-0.25, 0, 0]} material={shell}><boxGeometry args={[3.2, 1.0, 0.25]} /></mesh>
      <mesh position={[0, 0.88, -0.9]} rotation={[-0.25, 0, 0]}>
        <planeGeometry args={[2.3, 0.45]} />
        <meshBasicMaterial map={screen.texture} toneMapped={false} />
      </mesh>
      {[0, 1, 2, 3].map(lamp)}
      <mesh position={[0.78, 1.2, -0.93]}>
        <boxGeometry args={[0.2, 0.06, 0.03]} />
        <meshStandardMaterial ref={caution} color="#5b2a2a" emissive="#ff3b30" emissiveIntensity={0.05} />
      </mesh>
      {Array.from({ length: 18 }, (_, i) => (
        <mesh key={i} position={[-1.3 + (i % 9) * 0.32, 0.5 + Math.floor(i / 9) * 0.1, -0.93 - Math.floor(i / 9) * 0.02]} rotation={[-0.25, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.03, 8]} />
          <meshStandardMaterial color="#8d949c" metalness={0.8} roughness={0.4} />
        </mesh>
      ))}
      {/* Centre pedestal with a throttle lever that follows the simulation */}
      <mesh position={[0, 0.3, -0.25]} material={trim}><boxGeometry args={[0.42, 0.6, 1.3]} /></mesh>
      <group position={[0, 0.62, -0.35]}>
        <mesh ref={lever} material={m.steel}><boxGeometry args={[0.07, 0.34, 0.07]} /></mesh>
      </group>
      <mesh ref={card} position={[-0.95, 1.3, -0.98]} rotation={[-1.45, 0, 0]}>
        <planeGeometry args={[0.22, 0.3]} />
        <meshStandardMaterial color="#f4f1e6" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {/* The camera sits at the left seat. The astronaut flies from the right seat. */}
      <mesh position={[-0.62, 0.42, 0.75]} material={m.navy}><boxGeometry args={[0.62, 0.14, 0.6]} /></mesh>
      <group position={[0.7, 0, 0.75]}>
        <mesh position={[0, 0.42, 0]} material={m.navy}><boxGeometry args={[0.62, 0.14, 0.6]} /></mesh>
        <mesh position={[0, 0.8, 0.34]} rotation={[0.1, 0, 0]} material={m.navy}><boxGeometry args={[0.6, 0.72, 0.12]} /></mesh>
      </group>
      <group position={[0.7, -0.52, 0.72]} rotation={[0, Math.PI, 0]}>
        <Astronaut anim={anim} />
      </group>
      <pointLight position={[0, 1.9, 0.2]} intensity={2.2} distance={5} color="#cfe0ff" />
    </group>
  );
}

/** Everything outside the windows: pad, sky fading to space, stars, Earth's limb and the gates. */
function Outside({ sim, tier, phase }: { sim: React.MutableRefObject<AscentState>; tier: Tier; phase: string }) {
  const tint = useRef<{ top: THREE.Color; horizon: THREE.Color } | null>({ top: new THREE.Color('#2f6fc0'), horizon: new THREE.Color('#cfe2f3') });
  const starOpacity = useRef(0);
  const ground = useRef<THREE.Group>(null);
  const earth = useRef<THREE.Group>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const field = useMemo(() => {
    const t = groundTexture('field').clone();
    t.needsUpdate = true;
    t.repeat.set(60, 60);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
  }, []);
  const c = useMemo(() => ({ skyTop: new THREE.Color('#2f6fc0'), skyHor: new THREE.Color('#cfe2f3'), space: new THREE.Color('#000005'), dusk: new THREE.Color('#0b1f4a') }), []);
  const tune = ASCENT_TUNING[tier];
  const { scene } = useThree();

  useFrame(() => {
    const s = sim.current;
    const p = Math.min(1, s.speed / ORBIT_SPEED);
    const a = Math.min(1, s.altitude / 120);
    tint.current!.top.copy(c.skyTop).lerp(c.space, Math.min(1, a * 1.4));
    tint.current!.horizon.copy(c.skyHor).lerp(c.dusk, Math.min(1, a * 1.2)).lerp(c.space, Math.max(0, a - 0.6) * 2.5);
    starOpacity.current = Math.max(0, Math.min(1, (s.altitude - 50) / 80));
    if (scene.fog) (scene.fog as THREE.Fog).far = 900 + s.altitude * 400;
    if (ground.current) {
      ground.current.position.y = -46 - s.altitude * 60;
      ground.current.visible = s.altitude < 14;
    }
    if (earth.current) {
      earth.current.visible = s.altitude >= 8;
      // Keep Earth's curved limb sitting low in the windows for the whole climb.
      earth.current.position.set(0, -1500 - 4 - Math.min(40, Math.max(0, s.altitude - 8)) * 0.35, -560);
    }
    const place = (mesh: THREE.Mesh | null, idx: number) => {
      if (!mesh) return;
      const gate = ASCENT_GATES[idx];
      const show = phase === 'ascent' && gate !== undefined && s.status === 'flying';
      mesh.visible = show;
      if (!show) return;
      const ahead = (gate - p) * 420 + 7;
      mesh.position.set(-s.dx * UNIT, 1.75 - s.dy * UNIT, -ahead);
      const ok = ascentDeviation(s) <= tune.gateTol;
      (mesh.material as THREE.MeshBasicMaterial).color.set(idx === s.nextGate ? (ok ? '#35e07a' : '#ffb020') : '#6fb6ff');
    };
    place(ringA.current, s.nextGate);
    place(ringB.current, s.nextGate + 1);
  });

  const ringR = tune.gateTol * UNIT;
  return (
    <>
      <SkyDome top="#2f6fc0" horizon="#cfe2f3" tint={tint} radius={9000} />
      <Stars opacity={starOpacity} radius={8000} />
      <fog attach="fog" args={['#cfe2f3', 200, 900]} />
      <hemisphereLight args={['#cfe4ff', '#3a3f4a', 0.9]} />
      <SunLight direction={[0.5, 0.7, 0.35]} intensity={3} color="#fff1dc" size={8} />
      <group ref={ground}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={field}><planeGeometry args={[4000, 4000]} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, -600]}><planeGeometry args={[4000, 700]} /><meshStandardMaterial color="#2e6c9c" roughness={0.4} /></mesh>
        <group position={[-7.5, -6, -3.5]}><LaunchTower height={56} /></group>
      </group>
      <group ref={earth} visible={false}><EarthGlobe position={[0, 0, 0]} radius={1500} spin={0.004} below /></group>
      <mesh ref={ringA} visible={false}><torusGeometry args={[ringR, 0.09, 8, 48]} /><meshBasicMaterial color="#35e07a" fog={false} /></mesh>
      <mesh ref={ringB} visible={false}><torusGeometry args={[ringR, 0.06, 8, 48]} /><meshBasicMaterial color="#6fb6ff" fog={false} transparent opacity={0.6} /></mesh>
    </>
  );
}

function FlightLoop({ sim, tier, phase, countdown, armed, onLiftoff, onEnd }: {
  sim: React.MutableRefObject<AscentState>; tier: Tier; phase: string; countdown: React.MutableRefObject<number>;
  armed: boolean; onLiftoff: () => void; onEnd: (s: AscentState) => void;
}) {
  const { camera } = useThree();
  const reduced = useReducedMotion();
  const ended = useRef(false);
  const tick = useRef(0);
  const lifted = useRef(false);
  const settings = useGame((s) => s.save.settings);
  const hints = hintsOn(settings, tier);
  const tune = ASCENT_TUNING[tier];

  useSim((dt) => {
    if (phase === 'checklist') {
      if (armed && !lifted.current) {
        countdown.current = Math.max(0, countdown.current - dt);
        if (countdown.current <= 0) { lifted.current = true; onLiftoff(); }
      }
      return;
    }
    const prev = sim.current;
    if (prev.status !== 'flying') {
      if (!ended.current) { ended.current = true; onEnd(prev); }
      return;
    }
    ended.current = false;
    const next = stepAscent(prev, { steerX: input.axisX(), steerY: input.axisY(), thrust: input.held('primary'), brake: input.held('brake') }, dt, tier);
    if (next.gatesHit > prev.gatesHit) playCue('ok');
    if (next.gatesMissed > prev.gatesMissed) playCue('caution');
    sim.current = next;
  }, (_, elapsed) => {
    const s = sim.current;
    // Seated pilot's-eye view. Launch vibration is skipped with reduced motion.
    const shake = reduced || s.status !== 'flying' ? 0 : s.throttle * Math.max(0, 1 - s.altitude / 60) * 0.012;
    camera.position.set(-0.42 + Math.sin(elapsed * 47) * shake, 1.52 + Math.sin(elapsed * 61) * shake, 1.8);
    camera.lookAt(0.2, 1.4, -3);

    if (tick.current++ % 6 !== 0 || phase !== 'ascent') return;
    const d = ascentDeviation(s);
    const on = d <= tune.gateTol;
    const fuelPct = (s.fuel / tune.fuel) * 100;
    const inBand = s.speed >= tune.band[0] && s.speed <= tune.band[1];
    hud.set({
      crosshair: s.status === 'flying',
      meters: [
        { id: 'throttle', label: 'Throttle', value: s.throttle, max: 1, text: `${Math.round(s.throttle * 100)}%`, status: 'ok' },
        { id: 'fuel', label: 'Fuel', value: fuelPct, max: 100, text: `${Math.round(fuelPct)}%`, status: fuelPct < 15 ? 'low' : fuelPct < 30 ? 'caution' : 'ok' },
      ],
      readouts: [
        { label: 'Speed', value: `${s.speed.toFixed(2)} km/s`, note: `orbit needs ${tune.band[0].toFixed(2)} to ${tune.band[1].toFixed(2)}`, status: inBand ? 'ok' : s.speed > tune.band[1] ? 'caution' : 'ok' },
        { label: 'Altitude', value: `${Math.round(s.altitude)} km` },
        { label: 'Course', value: on ? 'ON COURSE' : 'OFF COURSE', status: on ? 'ok' : 'caution', note: `${d.toFixed(1)} off centre, gate allows ${tune.gateTol.toFixed(1)}` },
        { label: 'Gates', value: `${s.gatesHit} hit, ${s.gatesMissed} missed`, note: `${tune.missesAllowed} misses allowed`, status: s.gatesMissed >= tune.missesAllowed ? 'caution' : 'ok' },
      ],
      hint: !hints || s.status !== 'flying' ? null
        : s.throttle < 0.05 && s.speed < 0.1 ? 'Hold Space to push the throttle up. Lift off!'
          : inBand && s.throttle > 0 ? 'Orbital speed! Hold X to cut the engines.'
            : s.speed > tune.band[1] ? 'Too fast. Keep holding X to brake back into the green band.'
              : !on ? 'Steer toward the ring. Up, down, left, right.'
                : 'Keep the ring in the centre. Hold Space for more thrust, X for less.',
    });
    if (s.status !== 'flying') { hud.warn(null); return; }
    if (s.deviationTimer > 0 || (s.deviationFired && !on && d > tune.gateTol)) {
      hud.warn({ title: 'GUIDANCE DEVIATION', text: 'A guidance fault pushed you off course. Steer back toward the ring. Tap X to slow the climb.', level: 'alert' });
    } else if (d > 2.6) {
      hud.warn({ title: 'LEAVING THE CORRIDOR', text: `Return to the ring within ${Math.max(0, tune.offCourseSeconds - s.offCourseTime).toFixed(0)} seconds.`, level: 'alert' });
    } else if (s.speed > tune.band[1]) {
      hud.warn({ title: 'TOO FAST FOR ORBIT', text: 'Hold X to brake back into the green speed band.', level: 'caution' });
    } else if (inBand && s.throttle > 0) {
      hud.warn({ title: 'ORBITAL SPEED', text: 'Cut the engines now: hold X.', level: 'info' });
    } else if (fuelPct < 15) {
      hud.warn({ title: 'LOW FUEL', text: 'Keep the throttle up and stay on course.', level: 'caution' });
    } else {
      hud.warn(null);
    }
  });
  return null;
}

const RESET_TEXT: Record<string, { reason: string; tip: string }> = {
  gates: { reason: 'Too many guidance gates were passed off course, so the flight computer ended the attempt.', tip: 'Watch for the ring sliding sideways after the guidance fault and steer toward it straight away.' },
  corridor: { reason: 'The shuttle stayed outside the safe corridor for too long.', tip: 'Steer back toward the ring as soon as the warning appears. Tap X to climb more slowly while you correct.' },
  fuel: { reason: 'The fuel ran out before the shuttle reached orbital speed.', tip: 'Keep the throttle high during the climb and only cut the engines at about 7.8 km/s.' },
};

export function ShuttleMission() {
  const run = useGame((s) => s.run)!;
  const setPhase = useGame((s) => s.setPhase);
  const bumpStat = useGame((s) => s.bumpStat);
  const complete = useGame((s) => s.completeMission);
  const settings = useGame((s) => s.save.settings);
  const tier = run.tier;
  const hints = hintsOn(settings, tier);
  const items = useMemo(() => checklist(tier), [tier]);
  const phase = run.phase;

  const sim = useRef(makeAscent(tier));
  const countdown = useRef(COUNTDOWN);
  const [done, setDone] = useState(phase === 'ascent' ? items.length : 0);
  const [realign, setRealign] = useState(false);
  const [reset, setReset] = useState<string | null>(null);
  const [count, setCount] = useState(COUNTDOWN);
  const attempts = useRef((run.stats.ascentAttempts ?? 0) + 1);
  const finished = useRef(false);

  useEffect(() => { probe.ascent = sim; }, []);

  const confirm = () => {
    if (phase !== 'checklist' || done >= items.length) return;
    const item = items[done];
    if (item.twice && !realign) {
      setRealign(true);
      playCue('caution');
      hud.warn({ title: 'GUIDANCE NOT ALIGNED', text: 'The platform drifted 2 degrees. Hold the launch and align it again.', level: 'caution' });
      return;
    }
    hud.warn(null);
    playCue('ok');
    setDone(done + 1);
  };

  // E or Enter confirms the highlighted checklist item.
  useEffect(() => {
    if (phase !== 'checklist') return;
    const t = window.setInterval(() => {
      if (input.consume('use')) confirm();
      setCount(countdown.current);
    }, 50);
    return () => window.clearInterval(t);
  });

  useEffect(() => {
    const armed = done >= items.length;
    if (phase === 'checklist') {
      hud.set({
        objective: armed ? 'Countdown running. Get ready to hold Space.' : `Checklist item ${done + 1} of ${items.length}: ${items[done].label}`,
        touch: 'flight', touchLabels: { primary: 'Thrust', use: 'Confirm', brake: 'Brake' },
        labels: ['Fictional shuttle-class craft', 'Countdown and climb are compressed'],
        hint: hints && !armed ? 'Press E to confirm each checklist item in order.' : null,
        meters: [], readouts: [], crosshair: false,
      });
    } else {
      hud.set({
        objective: 'Fly through the six gates, then cut the engines at orbital speed',
        touch: 'flight', touchLabels: { primary: 'Thrust', use: 'Confirm', brake: 'Brake' },
        labels: ['Fictional shuttle-class craft', 'Time is compressed: a real climb takes about 8 to 9 minutes'],
      });
    }
  }, [phase, done, items, hints]);

  const onEnd = (s: AscentState) => {
    if (s.status === 'reset') {
      playCue('fail');
      hud.warn(null);
      setReset(s.resetReason);
      return;
    }
    if (s.status === 'orbit' && !finished.current) {
      finished.current = true;
      hud.warn(null);
      playCue('complete');
      hud.say('Main engine cut-off. You are in orbit. Watch the checklist card float.');
      hud.set({ objective: 'Stable orbit reached', hint: null, crosshair: false });
      const tune = ASCENT_TUNING[tier];
      window.setTimeout(() => complete({
        crewStatus: `In a stable orbit at ${s.speed.toFixed(2)} km/s, about ${Math.round(s.altitude)} km up. Crew is floating and well.`,
        consequence: `${s.gatesMissed === 0
          ? 'A guidance fault pushed the shuttle sideways about a third of the way up, and you steered back in time to pass every gate.'
          : `A guidance fault pushed the shuttle sideways about a third of the way up. ${s.gatesMissed} ${s.gatesMissed === 1 ? 'gate was' : 'gates were'} passed off course before you steered back, inside the ${tune.missesAllowed} this tier allows.`
        } Cutting the engines at orbital speed left the shuttle falling around Earth instead of back to it.${attempts.current > 1 ? ` It took ${attempts.current} attempts: each training reset put you back at liftoff.` : ''}`,
        objectives: [
          { label: 'Complete the launch checklist', done: true },
          { label: 'Steer through the guidance gates', done: true },
          { label: 'Correct the guidance deviation', done: true },
          { label: 'Cut the engines at orbital speed', done: true },
        ],
        stats: [
          { label: 'Gates passed on course', value: `${s.gatesHit} of ${ASCENT_GATES.length}` },
          { label: 'Gates missed', value: `${s.gatesMissed} (allowed ${tune.missesAllowed})` },
          { label: 'Fuel remaining', value: `${Math.round((s.fuel / tune.fuel) * 100)}%` },
          { label: 'Climb time (compressed)', value: `${s.t.toFixed(0)} s` },
          { label: 'Attempts', value: String(attempts.current) },
        ],
        outpost: null,
        rating: rateAscent(s.gatesMissed, attempts.current),
      }), 4200);
    }
  };

  const armed = done >= items.length;
  return (
    <>
      <GameCanvas fov={62} far={20000} envIntensity={0.3} background="#cfe2f3">
        <Outside sim={sim} tier={tier} phase={phase} />
        <Cockpit sim={sim} tier={tier} phase={phase} done={done} total={items.length} countdown={countdown} />
        <FlightLoop
          sim={sim} tier={tier} phase={phase} countdown={countdown} armed={armed}
          onLiftoff={() => { hud.say('Liftoff checkpoint. Hold Space to throttle up.'); setPhase('ascent', { stats: { ascentAttempts: attempts.current - 1 } }); }}
          onEnd={onEnd}
        />
      </GameCanvas>

      {phase === 'checklist' && (
        <div className="side-panel" aria-label="Launch checklist">
          <h3><Icon name="list" size={16} /> Launch checklist · {Math.min(done, items.length)} of {items.length}</h3>
          <ol>
            {items.map((it, i) => (
              <li key={it.id} className={i < done ? 'done' : i === done ? 'current' : ''}>
                <span>{i + 1}. {it.label}</span>
                <span className="state">{i < done ? it.done : i === done ? (it.twice && realign ? 'RETRY' : 'NEXT') : 'WAIT'}</span>
              </li>
            ))}
          </ol>
          {!armed && <Btn block icon="check" onClick={confirm}>{items[done].twice && realign ? 'Align again' : 'Confirm'}: {items[done].label} <Keycap>E</Keycap></Btn>}
          {armed && <p className="fine">All checks complete. Countdown running.</p>}
        </div>
      )}
      {phase === 'checklist' && (
        <div className="big-readout" aria-live="off">
          {armed ? `T-MINUS 00:${Math.ceil(count).toString().padStart(2, '0')}` : 'LAUNCH HOLD'}
          <small>{armed ? 'COMPRESSED COUNTDOWN' : 'CHECKLIST IN PROGRESS'}</small>
        </div>
      )}

      {reset && (
        <ResetCard
          title="Training reset"
          reason={RESET_TEXT[reset]?.reason ?? 'The attempt ended.'}
          tip={RESET_TEXT[reset]?.tip ?? 'Try again.'}
          retryLabel="Back to the liftoff checkpoint"
          onRetry={() => {
            attempts.current += 1;
            bumpStat('ascentAttempts');
            sim.current = makeAscent(tier);
            setReset(null);
          }}
        />
      )}
    </>
  );
}
