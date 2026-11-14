import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { playCue } from '../game/audio';
import { hud } from '../game/hud';
import { input } from '../game/input';
import { probe } from '../game/probe';
import { useGame } from '../game/store';
import {
  chuteCanDeploy, chuteCanRelease, enginesAvailable, landerConfig, makeLander, nearestZone, stepLander,
  type LanderAbort, type LanderConfig, type LanderState, type LanderWorld,
} from '../sim/flight';
import { hintsOn } from '../sim/save';
import type { Tier } from '../sim/types';
import { SunLight, useReducedMotion, useSim } from '../three/GameCanvas';
import { LunarLander, MarsLander, Parachute, Sign, Strut } from '../three/Props';
import { BlobShadow, EarthGlobe, Rocks, SkyDome, Stars, Terrain } from '../three/Scenery';
import { makeHeight, scatterRocks } from '../three/terrain';
import { ResetCard } from '../ui/Hud';

function abortText(reason: LanderAbort, s: LanderState, cfg: LanderConfig): { reason: string; tip: string } {
  const moon = cfg.world === 'moon';
  switch (reason) {
    case 'too_fast':
      return {
        reason: `The lander reached the ground at ${s.touchdownVy.toFixed(1)} m/s. The legs are safe up to ${cfg.safeVy.toFixed(1)} m/s, so the landing computer called it off.`,
        tip: moon
          ? 'Hold Space earlier and in longer bursts. The Moon has no air, so only the engine can slow you down.'
          : 'Open the parachute as soon as you can, release it when prompted, then hold Space until the descent rate is in the safe band.',
      };
    case 'sideways':
      return {
        reason: `The lander was still sliding sideways at ${s.touchdownVh.toFixed(1)} m/s when it touched down. The limit is ${cfg.safeVh.toFixed(1)} m/s.`,
        tip: 'Stop steering before you reach the ground, or steer the other way to cancel the slide.',
      };
    case 'outside_zone':
      return {
        reason: 'The touchdown was gentle, but outside the marked landing zone where the ground has not been checked.',
        tip: moon ? 'Steer toward the ring of lights early, while you are still high.' : 'Steer toward a ring of lights while you are high. On Mars the alternate zone is safe too.',
      };
    case 'chute_on_touchdown':
      return {
        reason: 'The parachute was still attached at the ground. In the thin air of Mars a parachute cannot slow a lander enough.',
        tip: `Press E to release the parachute below ${cfg.chuteReleaseAlt} metres, then hold Space to finish with the engine.`,
      };
    default:
      return { reason: 'The landing was called off.', tip: 'Try the approach again.' };
  }
}

function Zones({ cfg, activeId }: { cfg: LanderConfig; activeId: string }) {
  return (
    <>
      {cfg.zones.map((z) => {
        const color = z.primary ? '#4de3ff' : '#ffb020';
        const posts = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
        return (
          <group key={z.id} position={[z.x, 0.05, z.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[z.radius - 0.5, z.radius, 64]} />
              <meshBasicMaterial color={color} transparent opacity={activeId === z.id ? 0.95 : 0.6} side={THREE.DoubleSide} fog={false} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
              <ringGeometry args={[0.8, 1.3, 32]} />
              <meshBasicMaterial color={color} side={THREE.DoubleSide} fog={false} />
            </mesh>
            {posts.map((a, i) => (
              <group key={i} position={[Math.cos(a) * z.radius, 0, Math.sin(a) * z.radius]}>
                <Strut a={[0, 0, 0]} b={[0, 1.2, 0]} r={0.06} />
                <mesh position={[0, 1.3, 0]}><sphereGeometry args={[0.22, 10, 8]} /><meshBasicMaterial color={color} fog={false} /></mesh>
              </group>
            ))}
            <Sign lines={[z.label.toUpperCase()]} position={[0, 2.2, -z.radius - 0.5]} size={[5, 1.1]} accent={color} />
          </group>
        );
      })}
    </>
  );
}

function World({ world, storm }: { world: LanderWorld; storm?: boolean }) {
  const flats = useMemo(() => [
    { x1: 0, z1: 0, x2: 0, z2: 0, r: 24, blend: 40 },
    ...(world === 'mars' ? [{ x1: 46, z1: 14, x2: 46, z2: 14, r: 20, blend: 30 }] : []),
  ], [world]);
  const height = useMemo(() => makeHeight({
    seed: world === 'moon' ? 3 : 8, amp: world === 'moon' ? 9 : 14, scale: 0.006, flats,
    craters: world === 'moon' ? [{ x: -70, z: -60, r: 34, depth: 7 }, { x: 95, z: -40, r: 26, depth: 6 }, { x: 60, z: 90, r: 40, depth: 8 }, { x: -120, z: 60, r: 50, depth: 9 }] : [],
  }), [world, flats]);
  const rocks = useMemo(() => scatterRocks(height, world === 'moon' ? 160 : 260, 420, world === 'moon' ? 31 : 32, flats, 0.3, 2.6), [height, world, flats]);
  if (world === 'moon') {
    return (
      <>
        <Stars radius={5000} />
        <hemisphereLight args={['#3a3d44', '#1a1a1c', 0.22]} />
        <SunLight direction={[-0.7, 0.42, 0.35]} intensity={4.6} size={60} />
        <EarthGlobe position={[-900, 1100, -3600]} radius={230} />
        <Terrain height={height} kind="moon" size={1800} segments={200} repeat={110} />
        <Rocks rocks={rocks} color="#84837f" />
      </>
    );
  }
  return (
    <>
      <SkyDome top={storm ? '#8a5a3c' : '#b8845c'} horizon={storm ? '#c08a5c' : '#e3b98f'} radius={6000} />
      <fogExp2 attach="fog" args={['#d9a779', 0.0011]} />
      <hemisphereLight args={['#e8c39e', '#6b3e28', 0.85]} />
      <SunLight direction={[0.5, 0.6, 0.45]} intensity={2.7} color="#ffe0bd" size={60} />
      <Terrain height={height} kind="mars" size={2400} segments={200} repeat={140} />
      <Rocks rocks={rocks} color="#7c452c" />
    </>
  );
}

export interface LandingSummary { attempts: number; touchdownVy: number; fuelPct: number; zone: string; time: number }

function Flight({ world, tier, sim, cfg, onEnd }: {
  world: LanderWorld; tier: Tier; sim: React.MutableRefObject<LanderState>; cfg: LanderConfig; onEnd: (s: LanderState) => void;
}) {
  const craft = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Group>(null);
  const plasma = useRef<THREE.Mesh>(null);
  const power = useRef(0);
  const { camera } = useThree();
  const reduced = useReducedMotion();
  const settings = useGame((s) => s.save.settings);
  const hints = hintsOn(settings, tier);
  const ended = useRef(false);
  const tick = useRef(0);
  const look = useRef(new THREE.Vector3());
  const camPos = useRef(new THREE.Vector3());
  const first = useRef(true);
  const chute = useRef<THREE.Group>(null);
  const [zoneId, setZoneId] = useState('pad');

  useSim((dt) => {
    const prev = sim.current;
    if (prev.status !== 'descending') {
      if (!ended.current) { ended.current = true; onEnd(prev); }
      return;
    }
    ended.current = false;
    const next = stepLander(prev, {
      steerX: input.axisX(), steerY: input.axisY(), thrust: input.held('primary'), brake: false, action: input.consume('use'),
    }, dt, cfg);
    if (next.chute !== prev.chute) {
      playCue('ok');
      hud.say(next.chute === 'deployed' ? 'Parachute open. The thin air is slowing you down.' : 'Parachute released. Engine armed. Hold Space.');
    }
    sim.current = next;
  }, (delta, elapsed) => {
    const s = sim.current;
    power.current += ((s.thrusting ? 1 : 0) - power.current) * (1 - Math.exp(-14 * delta));
    if (craft.current) {
      craft.current.position.set(s.x, s.alt, s.z);
      // Lean into the steering so thrust direction is readable.
      const lean = s.status === 'descending' ? 0.045 : 0;
      craft.current.rotation.z += (-s.vx * lean - craft.current.rotation.z) * (1 - Math.exp(-6 * delta));
      craft.current.rotation.x += (s.vz * lean - craft.current.rotation.x) * (1 - Math.exp(-6 * delta));
    }
    if (chute.current) chute.current.visible = s.chute === 'deployed';
    if (shadow.current) {
      shadow.current.position.set(s.x, 0.12, s.z);
      const k = Math.max(0.35, 1 - s.alt / 400);
      shadow.current.scale.setScalar(4 * (1.6 - k * 0.6));
      shadow.current.visible = s.alt < 500;
    }
    if (plasma.current) {
      const hot = cfg.atmosphere && s.chute === 'stowed' ? Math.min(1, Math.max(0, (Math.abs(s.vy) - 50) / 30)) : 0;
      plasma.current.visible = hot > 0.02;
      (plasma.current.material as THREE.MeshBasicMaterial).opacity = hot * (reduced ? 0.5 : 0.4 + Math.sin(elapsed * 30) * 0.1);
    }

    // Stable chase camera: fixed direction, pulls back with altitude.
    const dist = Math.min(95, 24 + s.alt * 0.16);
    const want = new THREE.Vector3(s.x, s.alt + 8 + dist * 0.32, s.z + dist);
    const target = new THREE.Vector3(s.x, Math.max(1.5, s.alt - dist * 0.12), s.z);
    if (reduced || first.current) { camPos.current.copy(want); look.current.copy(target); first.current = false; }
    else { const k = 1 - Math.exp(-6 * delta); camPos.current.lerp(want, k); look.current.lerp(target, k); }
    camera.position.copy(camPos.current);
    camera.lookAt(look.current);

    if (tick.current++ % 6 !== 0) return;
    const near = nearestZone(cfg, s.x, s.z);
    if (near.zone.id !== zoneId) setZoneId(near.zone.id);
    const vh = Math.hypot(s.vx, s.vz);
    const fuelPct = (s.fuel / cfg.fuel) * 100;
    const rate = Math.abs(Math.min(0, s.vy));
    const rateStatus = rate <= cfg.safeVy ? 'ok' : rate <= cfg.safeVy * 2.5 ? 'caution' : 'low';
    const inside = near.dist <= near.zone.radius;
    const dx = near.zone.x - s.x;
    const dz = near.zone.z - s.z;
    const where = inside ? 'inside the ring' : `${Math.abs(dx) > 2 ? (dx > 0 ? 'right' : 'left') : ''}${Math.abs(dx) > 2 && Math.abs(dz) > 2 ? ' and ' : ''}${Math.abs(dz) > 2 ? (dz < 0 ? 'ahead' : 'behind') : ''}`;
    const engines = enginesAvailable(s, cfg);
    const canDeploy = chuteCanDeploy(s, cfg);
    const canRelease = chuteCanRelease(s, cfg);

    hud.set({
      prompt: s.status !== 'descending' ? null : canDeploy ? 'Press E: Open the parachute' : canRelease ? 'Press E: Release the parachute and arm the engine' : null,
      distance: s.status === 'descending' ? near.dist : null,
      meters: [
        { id: 'fuel', label: 'Fuel', value: fuelPct, max: 100, text: `${Math.round(fuelPct)}%`, status: fuelPct < 15 ? 'low' : fuelPct < 35 ? 'caution' : 'ok' },
        { id: 'rate', label: 'Descent rate', value: Math.min(rate, 12), max: 12, text: `${rate.toFixed(1)} m/s`, status: rateStatus, note: `Safe to touch down under ${cfg.safeVy.toFixed(1)} m/s` },
      ],
      readouts: [
        { label: 'Altitude', value: `${Math.round(s.alt)} m` },
        { label: 'Sideways speed', value: `${vh.toFixed(1)} m/s`, status: vh <= cfg.safeVh ? 'ok' : 'caution', note: `limit ${cfg.safeVh.toFixed(1)} m/s` },
        { label: near.zone.label, value: inside ? 'Over the zone' : `${Math.round(near.dist - near.zone.radius)} m outside`, status: inside ? 'ok' : 'caution', note: where },
        ...(cfg.atmosphere ? [
          { label: 'Parachute', value: s.chute === 'stowed' ? 'Packed' : s.chute === 'deployed' ? 'OPEN' : 'Released' },
          { label: 'Wind', value: `${cfg.windX.toFixed(1)} m/s to the right` },
        ] : [{ label: 'Air', value: 'None: engine only' }]),
      ],
      hint: !hints || s.status !== 'descending' ? null
        : cfg.atmosphere && s.chute === 'stowed' ? (canDeploy ? 'Press E to open the parachute now.' : 'Too fast for the parachute. Air drag on the heat shield is slowing you. Wait for the prompt.')
          : cfg.atmosphere && s.chute === 'deployed' ? (canRelease ? 'Press E to drop the parachute, then hold Space. A parachute alone is too fast in thin air.' : 'Drifting down under the parachute. The wind is pushing you right.')
            : !inside ? 'Steer toward the ring of lights. Short taps are enough.'
              : rate > cfg.safeVy ? 'Hold Space to slow down until the descent meter turns green.'
                : 'Nice and slow. Ease down onto the pad.',
    });

    if (s.status !== 'descending') { hud.warn(null); return; }
    if (canRelease && s.alt < cfg.chuteReleaseAlt * 0.55) hud.warn({ title: 'RELEASE THE PARACHUTE', text: 'Press E now, then hold Space. The parachute cannot land you safely.', level: 'alert' });
    else if (engines && s.alt < 70 && rate > cfg.safeVy * 2) hud.warn({ title: 'TOO FAST', text: 'Hold Space to slow the descent.', level: 'alert' });
    else if (engines && fuelPct < 15) hud.warn({ title: 'LOW FUEL', text: 'Use short engine bursts and land soon.', level: 'caution' });
    else if (s.alt < 40 && vh > cfg.safeVh) hud.warn({ title: 'SLIDING SIDEWAYS', text: 'Steer the other way to stop the slide before touchdown.', level: 'caution' });
    else hud.warn(null);
  });

  return (
    <>
      <World world={world} />
      <Zones cfg={cfg} activeId={zoneId} />
      <group ref={shadow}><BlobShadow radius={1} opacity={0.5} /></group>
      <group ref={craft}>
        {world === 'moon' ? <LunarLander power={power} /> : <MarsLander power={power} />}
        <group ref={chute} visible={false}><Parachute visible /></group>
        <mesh ref={plasma} visible={false} position={[0, 0.2, 0]} scale={[1, 0.5, 1]}>
          <sphereGeometry args={[4.2, 20, 12]} />
          <meshBasicMaterial color="#ff8a3c" transparent opacity={0.4} depthWrite={false} fog={false} />
        </mesh>
      </group>
    </>
  );
}

/**
 * Player-controlled descent shared by the Moon and Mars missions. Returns the
 * 3D scene (for inside the canvas) and the HTML overlay (for outside it).
 */
export function useLanderFlight({ world, tier, startAttempts, onLanded }: {
  world: LanderWorld; tier: Tier; startAttempts: number; onLanded: (summary: LandingSummary) => void;
}): { scene: React.ReactNode; overlay: React.ReactNode } {
  const cfg = useMemo(() => landerConfig(world, tier), [world, tier]);
  const sim = useRef(makeLander(cfg));
  const attempts = useRef(startAttempts + 1);
  const [abort, setAbort] = useState<{ reason: string; tip: string } | null>(null);
  const [epoch, setEpoch] = useState(0);
  const bumpStat = useGame((s) => s.bumpStat);
  const finished = useRef(false);

  useEffect(() => { probe.lander = sim; probe.landerCfg = cfg; }, [cfg]);

  useEffect(() => {
    hud.set({
      objective: world === 'moon' ? 'Fly to the landing zone and touch down gently' : 'Open the parachute, release it, then land with the engine',
      touch: 'flight', touchLabels: { primary: 'Engine', use: world === 'mars' ? 'Chute' : 'Use' },
      labels: world === 'moon'
        ? ['Fictional lander', 'Descent starts near the surface: time is compressed', 'Moon gravity 1.62 m/s²']
        : ['Fictional lander', 'Speeds and parachute values are illustrative', 'Mars gravity 3.71 m/s²'],
      crosshair: false,
    });
  }, [world]);

  const onEnd = (s: LanderState) => {
    hud.warn(null);
    if (s.status === 'aborted') {
      playCue('fail');
      setAbort(abortText(s.abortReason, s, cfg));
      return;
    }
    if (s.status === 'landed' && !finished.current) {
      finished.current = true;
      playCue('complete');
      const zone = cfg.zones.find((z) => z.id === s.zoneId);
      hud.say(`Touchdown at ${s.touchdownVy.toFixed(1)} metres per second. Engine off.`);
      hud.set({ objective: `Landed in the ${zone?.label.toLowerCase() ?? 'zone'}`, hint: null, prompt: null });
      window.setTimeout(() => onLanded({
        attempts: attempts.current, touchdownVy: s.touchdownVy, fuelPct: Math.round((s.fuel / cfg.fuel) * 100),
        zone: zone?.primary === false ? 'alternate' : 'primary', time: s.t,
      }), 2400);
    }
  };

  const scene = <Flight key={epoch} world={world} tier={tier} sim={sim} cfg={cfg} onEnd={onEnd} />;
  const overlay = abort ? (
    <ResetCard
      title="Landing called off" reason={abort.reason} tip={abort.tip} retryLabel="Back to the approach checkpoint"
      onRetry={() => {
        attempts.current += 1;
        bumpStat('landingAttempts');
        sim.current = makeLander(cfg);
        setAbort(null);
        setEpoch((e) => e + 1);
      }}
    />
  ) : null;
  return { scene, overlay };
}
