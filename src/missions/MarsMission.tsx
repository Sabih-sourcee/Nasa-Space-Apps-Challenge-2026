import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { hud } from '../game/hud';
import { useGame } from '../game/store';
import { GameCanvas, SunLight, simClock, useReducedMotion } from '../three/GameCanvas';
import { Habitat, MarsLander, Pouch, Rover, SolarArray } from '../three/Props';
import { RealAsset, RealRocks } from '../three/models';
import { Rocks, SkyDome, Terrain } from '../three/Scenery';
import { makeHeight, scatterRocks } from '../three/terrain';
import { ResetCard } from '../ui/Hud';
import { useLanderFlight, type LandingSummary } from './LanderFlight';
import { OutpostPhase } from './OutpostPhase';
import { EvaWalker, makeSuit, type EvaTask } from './SurfaceEva';

function MarsLanding() {
  const run = useGame((s) => s.run)!;
  const setPhase = useGame((s) => s.setPhase);
  const onLanded = (sum: LandingSummary) => {
    setPhase('eva', { stats: { landingAttempts: sum.attempts - 1, touchdown: Math.round(sum.touchdownVy * 10), landingFuel: sum.fuelPct, altZone: sum.zone === 'alternate' ? 1 : 0 } });
  };
  const flight = useLanderFlight({ world: 'mars', tier: run.tier, startAttempts: run.stats.landingAttempts ?? 0, onLanded });
  return (
    <>
      <GameCanvas key="landing" fov={50} far={9000} envIntensity={0.3} background="#d9a779">{flight.scene}</GameCanvas>
      {flight.overlay}
    </>
  );
}

const FLATS = [{ x1: 2, z1: 12, x2: 0, z2: -44, r: 15, blend: 26 }];
const LANDER = { x: 9, z: 8 };
const ROVER = { x: -7, z: -14 };
const HAB = { x: 0, z: -44 };

const TASKS: EvaTask[] = [
  { id: 'wheel', objective: 'Inspect the rover: check the front wheel that is showing a fault', prompt: 'Clear the rock stuck in the wheel', hint: 'The rover is ahead on your left. One wheel is glowing amber.', x: ROVER.x - 0.6, z: ROVER.z + 2.2 },
  { id: 'deck', objective: 'Brush the dust off the rover solar deck', prompt: 'Brush the dust off the solar deck', hint: 'Dusty panels make less power. Walk to the marker and press E.', x: ROVER.x + 1.6, z: ROVER.z + 2.0 },
  { id: 'pouch', objective: 'Take the sample pouch from the rover', prompt: 'Take the sample pouch', hint: 'The pouch is on the back of the rover.', x: ROVER.x + 2.6, z: ROVER.z + 0.4 },
  { id: 'airlock', objective: 'Dust storm! Carry the pouch to the habitat airlock', prompt: 'Enter the habitat airlock', hint: 'Follow the flashing beacon and the yellow marker to the airlock.', x: HAB.x, z: HAB.z + 2.6 },
];

/** Dust front: thickens the haze, dims the Sun and tints the sky as `level` rises from 0 to 1. */
function DustStorm({ level, tier }: { level: React.MutableRefObject<number>; tier: 'junior' | 'middle' | 'advanced' }) {
  const { scene } = useThree();
  const tint = useRef<{ top: THREE.Color; horizon: THREE.Color } | null>({ top: new THREE.Color('#b8845c'), horizon: new THREE.Color('#e3b98f') });
  const sun = useRef<THREE.Group>(null);
  const c = useMemo(() => ({
    top: new THREE.Color('#b8845c'), horizon: new THREE.Color('#e3b98f'), stormTop: new THREE.Color('#6b4128'), stormHor: new THREE.Color('#a66b40'),
    fog: new THREE.Color('#d9a779'), stormFog: new THREE.Color('#9a6238'),
  }), []);
  const peak = { junior: 0.022, middle: 0.034, advanced: 0.045 }[tier];
  useFrame(() => {
    const k = level.current;
    tint.current!.top.copy(c.top).lerp(c.stormTop, k);
    tint.current!.horizon.copy(c.horizon).lerp(c.stormHor, k);
    const fog = scene.fog as THREE.FogExp2 | null;
    if (fog) {
      fog.density = 0.006 + k * peak;
      fog.color.copy(c.fog).lerp(c.stormFog, k);
    }
    scene.background = fog ? fog.color : scene.background;
    sun.current?.traverse((o) => { if ((o as THREE.DirectionalLight).isDirectionalLight) (o as THREE.DirectionalLight).intensity = 2.7 * (1 - k * 0.72); });
  });
  return (
    <>
      <SkyDome top="#b8845c" horizon="#e3b98f" tint={tint} radius={2500} />
      <fogExp2 attach="fog" args={['#d9a779', 0.006]} />
      <hemisphereLight args={['#e8c39e', '#6b3e28', 0.85]} />
      <group ref={sun}><SunLight direction={[0.55, 0.55, 0.45]} intensity={2.7} color="#ffe0bd" size={46} /></group>
    </>
  );
}

function MarsEva() {
  const run = useGame((s) => s.run)!;
  const setPhase = useGame((s) => s.setPhase);
  const restart = useGame((s) => s.restartFromCheckpoint);
  const [index, setIndex] = useState(0);
  const [out, setOut] = useState(false);
  const suit = useRef(makeSuit());
  const storm = useRef(0);
  const stormOn = useRef(false);
  const solar = useRef(100);
  const height = useMemo(() => makeHeight({ seed: 12, amp: 5.5, scale: 0.011, flats: FLATS, craters: [{ x: 38, z: -20, r: 15, depth: 3 }, { x: -40, z: 6, r: 12, depth: 2.4 }] }), []);
  const rocks = useMemo(() => scatterRocks(height, 380, 210, 61, FLATS, 0.1, 1.5), [height]);
  const colliders = useMemo(() => [
    { x: LANDER.x, z: LANDER.z, r: 4.2 }, { x: ROVER.x, z: ROVER.z, r: 1.7 },
    { x: HAB.x - 3.4, z: HAB.z - 3, r: 3.2 }, { x: HAB.x + 3.4, z: HAB.z - 3, r: 3.2 }, { x: HAB.x, z: HAB.z - 1.3, r: 2.0 },
  ], []);
  const bounds = useMemo(() => ({ minX: -40, maxX: 40, minZ: -45, maxZ: 22 }), []);

  useEffect(() => {
    hud.set({ labels: ['Fictional future mission', 'Mars gravity 3.71 m/s² (NASA fact sheet)', 'Storm timing and solar numbers are invented'] });
  }, []);

  const onTask = (id: string) => {
    if (id === 'wheel') { hud.say('Wheel cleared. The fault light is off.'); setIndex(1); }
    if (id === 'deck') { hud.say('Solar deck clean. The rover is charging again.'); setIndex(2); }
    if (id === 'pouch') {
      setIndex(3);
      // Authored trigger: the dust front arrives once the rover inspection is done.
      stormOn.current = true;
      hud.warn({ title: 'DUST STORM APPROACHING', text: 'Visibility and solar power are dropping. Carry the pouch to the habitat airlock now.', level: 'alert', sourceId: 'mars_dust' });
    }
    if (id === 'airlock') {
      hud.warn(null);
      hud.say('Airlock cycling. You are inside. The storm is over the outpost.');
      setIndex(4);
      window.setTimeout(() => setPhase('outpost', { stats: { suitO2: Math.round(suit.current.o2) } }), 1400);
    }
  };

  return (
    <>
      <GameCanvas key="eva" fov={52} far={4000} envIntensity={0.3} background="#d9a779">
        <DustStorm level={storm} tier={run.tier} />
        <StormClock on={stormOn} level={storm} solar={solar} />
        <Terrain height={height} kind="mars" size={320} segments={170} repeat={46} />
        <RealRocks world="mars" rocks={rocks} fallback={<Rocks rocks={rocks} color="#7c452c" />} />
        <group position={[LANDER.x, height(LANDER.x, LANDER.z), LANDER.z]} rotation={[0, -0.4, 0]}><MarsLander /></group>
        <group position={[ROVER.x, height(ROVER.x, ROVER.z), ROVER.z]} rotation={[0, 0.5, 0]}>
          <RealAsset
            kind="perseverance"
            fallback={<Rover dust={index >= 2 ? 0 : 1} wheelAlert={index === 0} />}
            overlay={index === 0 ? <WheelFaultMarker position={[-1.05, 0.45, 0.95]} /> : null}
          />
          {index <= 2 && <group position={[-1.0, 1.42, 0.2]}><Pouch /></group>}
        </group>
        <group position={[HAB.x, 0, HAB.z]}><Habitat tint="mars" beacon={index >= 3} /></group>
        <group position={[9, 0, -38]} rotation={[0, -0.4, 0]}><SolarArray count={3} dust={index >= 3 ? 1 : 0.3} /></group>
        <EvaWalker
          world="mars" tier={run.tier} height={height} start={{ x: LANDER.x - 3, z: LANDER.z + 5 }}
          tasks={TASKS} index={index} onTask={onTask} carrying={index === 3} suit={suit}
          colliders={colliders} bounds={bounds} onOxygenOut={() => setOut(true)} lowVisibility={index >= 3}
          extraReadouts={() => [{
            label: 'Habitat solar power', value: `${Math.round(solar.current)}%`,
            status: solar.current < 50 ? 'low' : solar.current < 90 ? 'caution' : 'ok', note: storm.current > 0.05 ? 'dust is blocking the Sun' : 'clear sky',
          }]}
        />
      </GameCanvas>
      {out && (
        <ResetCard
          title="Suit reserve reached" reason="Suit oxygen reached the training reserve before you got to the airlock."
          tip="Go straight from marker to marker. In the storm, follow the flashing beacon."
          retryLabel="Back to the touchdown checkpoint" onRetry={restart}
        />
      )}
    </>
  );
}

/** Pulsing amber ring at the faulty front wheel of the real Perseverance model. */
function WheelFaultMarker({ position }: { position: [number, number, number] }) {
  const gem = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const reduced = useReducedMotion();
  useFrame(({ clock }) => {
    const pulse = reduced ? 1 : 0.75 + Math.sin(clock.elapsedTime * 5) * 0.25;
    if (gem.current) {
      gem.current.position.y = 0.62 + (reduced ? 0 : Math.sin(clock.elapsedTime * 2.4) * 0.08);
      gem.current.rotation.y = clock.elapsedTime * 1.4;
    }
    if (ring.current) {
      ring.current.scale.setScalar(pulse);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.45 + pulse * 0.4;
    }
  });
  return (
    <group position={position}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.32, 0]}>
        <ringGeometry args={[0.34, 0.46, 32]} />
        <meshBasicMaterial color="#ffb020" transparent opacity={0.85} side={THREE.DoubleSide} fog={false} />
      </mesh>
      <mesh ref={gem} scale={[0.13, 0.2, 0.13]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#ffb020" fog={false} />
      </mesh>
    </group>
  );
}

/** Ramps the storm up over about ten simulated seconds once it has been triggered. */
function StormClock({ on, level, solar }: { on: React.MutableRefObject<boolean>; level: React.MutableRefObject<number>; solar: React.MutableRefObject<number> }) {
  useFrame((_, delta) => {
    if (useGame.getState().paused) return;
    if (on.current) level.current = Math.min(1, level.current + (simClock.forceDelta ?? Math.min(delta, 0.1)) / 10);
    solar.current = 100 - level.current * 68;
  });
  return null;
}

export function MarsMission() {
  const phase = useGame((s) => s.run?.phase);
  if (phase === 'landing') return <MarsLanding />;
  if (phase === 'eva') return <MarsEva />;
  return <OutpostPhase missionId="M04" />;
}
