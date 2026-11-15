import { useEffect, useMemo, useRef, useState } from 'react';
import { hud } from '../game/hud';
import { useGame } from '../game/store';
import { GameCanvas, SunLight } from '../three/GameCanvas';
import { DeployablePanel, Habitat, LunarLander, Pouch, Rover, Sign, SolarArray } from '../three/Props';
import { RealAsset, RealRocks } from '../three/models';
import { EarthGlobe, Rocks, Stars, Terrain } from '../three/Scenery';
import { makeHeight, scatterRocks } from '../three/terrain';
import { ResetCard } from '../ui/Hud';
import { useLanderFlight, type LandingSummary } from './LanderFlight';
import { OutpostPhase } from './OutpostPhase';
import { EvaWalker, makeSuit, type EvaTask } from './SurfaceEva';

function MoonLanding() {
  const run = useGame((s) => s.run)!;
  const setPhase = useGame((s) => s.setPhase);
  const onLanded = (sum: LandingSummary) => {
    setPhase('eva', { stats: { landingAttempts: sum.attempts - 1, touchdown: Math.round(sum.touchdownVy * 10), landingFuel: sum.fuelPct } });
  };
  const flight = useLanderFlight({ world: 'moon', tier: run.tier, startAttempts: run.stats.landingAttempts ?? 0, onLanded });
  return (
    <>
      <GameCanvas key="landing" fov={50} far={9000} envIntensity={0.1} background="#000002">{flight.scene}</GameCanvas>
      {flight.overlay}
    </>
  );
}

const FLATS = [{ x1: 2, z1: 12, x2: 0, z2: -46, r: 15, blend: 26 }];
const LANDER = { x: 8, z: 8 };
const PANEL_SITE = { x: -8, z: -17 };
const HAB = { x: 0, z: -46 };

const TASKS: EvaTask[] = [
  { id: 'pouch', objective: 'Take the supply pouch from the lander cargo shelf', prompt: 'Take the supply pouch', hint: 'The lander is right beside you. Walk to the marker and press E.', x: LANDER.x - 4.8, z: LANDER.z + 2.8 },
  { id: 'panel', objective: 'Carry the pouch to the folded solar panel and deploy the panel', prompt: 'Unfold the solar panel', hint: 'Try a jump on the way. On the Moon you stay in the air about six times longer than on Earth.', x: PANEL_SITE.x + 1.6, z: PANEL_SITE.z + 1.2 },
  { id: 'airlock', objective: 'Carry the supply pouch to the habitat airlock and go inside', prompt: 'Enter the habitat airlock', hint: 'The airlock is the lit door on the habitat ahead.', x: HAB.x, z: HAB.z + 2.6 },
];

function MoonEva() {
  const run = useGame((s) => s.run)!;
  const setPhase = useGame((s) => s.setPhase);
  const restart = useGame((s) => s.restartFromCheckpoint);
  const [index, setIndex] = useState(0);
  const [out, setOut] = useState(false);
  const suit = useRef(makeSuit());
  const height = useMemo(() => makeHeight({
    seed: 5, amp: 4.5, scale: 0.012, flats: FLATS,
    craters: [{ x: -34, z: -8, r: 13, depth: 3 }, { x: 36, z: -30, r: 17, depth: 4 }, { x: 28, z: 30, r: 9, depth: 2.2 }, { x: -44, z: -52, r: 20, depth: 4.5 }],
  }), []);
  const rocks = useMemo(() => scatterRocks(height, 220, 200, 51, FLATS, 0.1, 1.3), [height]);
  const colliders = useMemo(() => [
    { x: LANDER.x, z: LANDER.z, r: 3.9 }, { x: PANEL_SITE.x, z: PANEL_SITE.z, r: 0.9 },
    { x: 13, z: -22, r: 2.0 }, { x: HAB.x - 3.4, z: HAB.z - 3, r: 3.2 }, { x: HAB.x + 3.4, z: HAB.z - 3, r: 3.2 }, { x: HAB.x, z: HAB.z - 1.3, r: 2.0 },
  ], []);
  const bounds = useMemo(() => ({ minX: -40, maxX: 40, minZ: -47, maxZ: 22 }), []);

  useEffect(() => {
    hud.set({ labels: ['Fictional lunar south pole site', 'Moon gravity 1.62 m/s² (NASA fact sheet)', 'Suit values are illustrative'] });
  }, []);

  const onTask = (id: string) => {
    if (id === 'pouch') { hud.say('Supply pouch in hand.'); setIndex(1); }
    if (id === 'panel') { hud.say('Solar panel deployed. It will feed the habitat battery.'); setIndex(2); }
    if (id === 'airlock') {
      hud.say('Airlock cycling. Welcome to the habitat.');
      setIndex(3);
      window.setTimeout(() => setPhase('outpost', { stats: { suitO2: Math.round(suit.current.o2), moonJumps: suit.current.jumps } }), 1400);
    }
  };

  return (
    <>
      <GameCanvas key="eva" fov={52} far={6000} envIntensity={0.08} background="#000002">
        <Stars radius={3000} />
        <hemisphereLight args={['#33363d', '#18181a', 0.2]} />
        <SunLightFollow />
        <EarthGlobe position={[-500, 520, -2200]} radius={150} />
        <Terrain height={height} kind="moon" size={320} segments={170} repeat={46} />
        <RealRocks world="moon" rocks={rocks} fallback={<Rocks rocks={rocks} color="#85847f" />} />
        <group position={[LANDER.x, height(LANDER.x, LANDER.z), LANDER.z]} rotation={[0, -0.5, 0]}><RealAsset kind="lm" fallback={<LunarLander />} /></group>
        {index === 0 && <group position={[LANDER.x - 4.8, height(LANDER.x - 4.8, LANDER.z + 2.8) + 0.16, LANDER.z + 2.8]}><Pouch /></group>}
        <group position={[PANEL_SITE.x, height(PANEL_SITE.x, PANEL_SITE.z), PANEL_SITE.z]} rotation={[0, 0.9, 0]}><DeployablePanel deployed={index >= 2} /></group>
        <Sign lines={['SOLAR PANEL KIT']} position={[PANEL_SITE.x, 0.5, PANEL_SITE.z + 0.9]} rotation={[0, 0.3, 0]} size={[1.5, 0.36]} />
        <group position={[HAB.x, 0, HAB.z]}><Habitat tint="moon" /></group>
        <group position={[9, 0, -40]} rotation={[0, -0.4, 0]}><SolarArray count={3} /></group>
        <group position={[13, height(13, -22), -22]} rotation={[0, 0.7, 0]}><RealAsset kind="sev" fallback={<Rover />} /></group>
        <EvaWalker
          world="moon" tier={run.tier} height={height} start={{ x: LANDER.x - 2.2, z: LANDER.z + 5.4 }}
          tasks={TASKS} index={index} onTask={onTask} carrying={index >= 1 && index < 3} suit={suit}
          colliders={colliders} bounds={bounds} onOxygenOut={() => setOut(true)}
        />
      </GameCanvas>
      {out && (
        <ResetCard
          title="Suit reserve reached" reason="Suit oxygen reached the training reserve before you got to the airlock."
          tip="Head for each marker directly. Long jumps are fun, and they still use up air while you float."
          retryLabel="Back to the touchdown checkpoint" onRetry={restart}
        />
      )}
    </>
  );
}

/** Low Sun, as at the lunar south pole: long, hard-edged shadows and almost no fill light. */
function SunLightFollow() {
  return <SunLight direction={[-0.75, 0.3, 0.45]} intensity={4.8} size={46} />;
}

export function MoonMission() {
  const phase = useGame((s) => s.run?.phase);
  if (phase === 'landing') return <MoonLanding />;
  if (phase === 'eva') return <MoonEva />;
  return <OutpostPhase missionId="L02" />;
}
