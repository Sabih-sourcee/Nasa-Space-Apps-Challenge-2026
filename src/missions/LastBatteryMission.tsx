import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { playCue } from '../game/audio';
import { hud } from '../game/hud';
import { probe } from '../game/probe';
import { useGame } from '../game/store';
import {
  BATTERY_TUNING, MAX_CROP, alertActive, choiceStart, doBattery, makeBattery,
  type BatteryAction, type BatteryRun, type BatteryState,
} from '../sim/lastBattery';
import { GRAVITY_PRESETS, makeWalker, type WalkEnv, type WalkerState } from '../sim/movement';
import { hintsOn } from '../sim/save';
import { rateBattery } from '../sim/score';
import type { Tier } from '../sim/types';
import { Astronaut, makeAnim } from '../three/Astronaut';
import { GameCanvas, useReducedMotion } from '../three/GameCanvas';
import { M, Sign, Strut } from '../three/Props';
import { ObjectiveMarker } from '../three/Scenery';
import { panelTexture } from '../three/textures';
import { WalkerRig, type Interactable } from '../three/WalkerRig';
import { ResetCard } from '../ui/Hud';
import { BatteryPack } from './ShipMission';

const SPOT = {
  rack: { x: -0.6, z: -2.7 }, crate: { x: 3.6, z: 2.6 },
  growSocket: { x: -4.5, z: -2.0 }, growPanel: { x: -4.5, z: 0.4 },
  shelterSocket: { x: 3.5, z: 0.1 }, hatch: { x: 5.0, z: 0.1 },
};
type SpotId = keyof typeof SPOT;

function Room({ s, tier, trail }: { s: BatteryState; tier: Tier; trail: [number, number][] | null }) {
  const m = M();
  const reduced = useReducedMotion();
  const wall = useMemo(() => {
    const t = panelTexture('#dfe3e6', '#a9b0b7', 'hab').clone();
    t.needsUpdate = true; t.repeat.set(6, 2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
  }, []);
  const floor = useMemo(() => {
    const t = panelTexture('#9aa2ab', '#6c747d', 'habfloor').clone();
    t.needsUpdate = true; t.repeat.set(6, 5);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  }, []);
  const fan = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const crewA = useRef(makeAnim('walk'));
  const crewB = useRef(makeAnim('walk'));
  const alert = alertActive(s, tier) && s.outcome === 'active';
  const lights = s.battery === 'grow';
  const max = BATTERY_TUNING[tier].startCharge;
  const sheltered = s.crew === 'sheltered';

  useFrame(({ clock }, delta) => {
    if (fan.current && !reduced) fan.current.rotation.z += delta * (s.vent === 'full' ? 10 : s.vent === 'low' ? 3 : 0);
    if (beacon.current) beacon.current.emissiveIntensity = alert && !sheltered ? (reduced ? 3.5 : 2 + Math.sin(clock.elapsedTime * 7) * 2) : alert ? 1 : 0.05;
  });

  const socket = (x: number, z: number, rot: number, live: boolean) => (
    <group position={[x, 1.0, z]} rotation={[0, rot, 0]}>
      <mesh material={m.darkSteel}><boxGeometry args={[0.6, 0.5, 0.12]} /></mesh>
      <mesh position={[0, 0, 0.08]}><boxGeometry args={[0.3, 0.2, 0.04]} /><meshStandardMaterial color={live ? '#35e07a' : '#3a1414'} emissive={live ? '#35e07a' : '#ffb020'} emissiveIntensity={live ? 2.2 : 0.5} /></mesh>
      {live && <group position={[0, 0.05, 0.32]}><BatteryPack charge={s.charge / max} /></group>}
    </group>
  );

  return (
    <group>
      <mesh position={[0, -0.1, 0]} material={floor} receiveShadow><boxGeometry args={[12.4, 0.2, 9.4]} /></mesh>
      <mesh position={[0, 1.6, -4.6]} material={wall}><boxGeometry args={[12.4, 3.4, 0.2]} /></mesh>
      <mesh position={[-6.2, 1.6, 0]} material={wall}><boxGeometry args={[0.2, 3.4, 9.4]} /></mesh>
      <mesh position={[6.2, 1.6, 0]} material={wall}><boxGeometry args={[0.2, 3.4, 9.4]} /></mesh>
      {/* The window is dark: the base is in shadow from the start */}
      <mesh position={[-3.0, 2.0, -4.48]}><planeGeometry args={[2.0, 1.1]} /><meshBasicMaterial color="#05070c" /></mesh>
      <Sign lines={['OUTSIDE: SHADOW', 'Panels are making almost no power']} position={[-3.0, 2.95, -4.47]} size={[2.6, 0.5]} accent="#ffb020" />
      <ambientLight intensity={0.3} />
      <pointLight position={[-2.5, 3, 0.5]} intensity={14} distance={14} color="#dfe8ff" />
      <pointLight position={[3, 3, 1.5]} intensity={12} distance={14} color="#dfe8ff" />

      {/* Storage rack */}
      <group position={[SPOT.rack.x, 0, -4.1]}>
        {[[-0.8, -0.2], [0.8, -0.2], [-0.8, 0.3], [0.8, 0.3]].map(([x, z], i) => <Strut key={i} a={[x, 0, z]} b={[x, 1.9, z]} r={0.04} />)}
        {[0.6, 1.3].map((y) => <mesh key={y} position={[0, y, 0.05]} material={m.darkSteel}><boxGeometry args={[1.7, 0.07, 0.6]} /></mesh>)}
        {s.battery === 'rack' && <group position={[0, 0.85, 0.1]}><BatteryPack charge={s.charge / max} latched /></group>}
        <Sign lines={[s.battery === 'rack' ? 'STORAGE: SPARE BATTERY' : 'STORAGE RACK']} position={[0, 2.25, -0.25]} size={[2.2, 0.32]} accent={s.battery === 'rack' ? '#35e07a' : '#e23d3d'} />
      </group>

      {/* Cargo crate by the airlock: where the battery is if it was never latched aboard the ship */}
      <group position={[4.7, 0, 3.3]}>
        <mesh position={[0, 0.45, 0]} material={m.white} castShadow><boxGeometry args={[1.3, 0.9, 1.0]} /></mesh>
        {s.battery === 'crate' && [-0.35, 0.35].map((x) => <mesh key={x} position={[x, 0.45, 0]} material={m.yellow}><boxGeometry args={[0.1, 0.94, 1.04]} /></mesh>)}
        <Sign lines={[s.battery === 'crate' ? 'CARGO CRATE: BATTERY INSIDE' : 'CARGO CRATE']} position={[0, 1.25, -0.4]} size={[2.3, 0.32]} accent={s.battery === 'crate' ? '#ffb020' : '#e23d3d'} />
      </group>
      <mesh position={[6.08, 1.2, 3.2]} rotation={[0, -Math.PI / 2, 0]} material={m.darkSteel}><boxGeometry args={[1.6, 2.3, 0.1]} /></mesh>
      <Sign lines={['AIRLOCK']} position={[6.06, 2.7, 3.2]} rotation={[0, -Math.PI / 2, 0]} size={[1.4, 0.32]} />

      {/* Grow rack: lights follow the battery, plants follow the crop stage */}
      <group position={[-5.4, 0, -0.8]}>
        {[[-0.3, -1.3], [-0.3, 1.3], [0.3, -1.3], [0.3, 1.3]].map(([x, z], i) => <Strut key={i} a={[x, 0, z]} b={[x, 2.4, z]} r={0.04} />)}
        {[0.7, 1.5].map((y) => (
          <group key={y} position={[0, y, 0]}>
            <mesh material={m.darkSteel}><boxGeometry args={[0.7, 0.12, 2.7]} /></mesh>
            {Array.from({ length: 6 }, (_, i) => {
              const size = 0.05 + s.crop * 0.055;
              return <mesh key={i} position={[0, 0.06 + size * 0.9, -1.05 + i * 0.42]} scale={[1, 1.3, 1]}><sphereGeometry args={[size, 8, 6]} /><meshStandardMaterial color="#3fa34d" roughness={0.8} /></mesh>;
            })}
            <mesh position={[0, 0.66, 0]}><boxGeometry args={[0.5, 0.04, 2.6]} /><meshStandardMaterial color={lights ? '#ff6ad5' : '#2a2030'} emissive={lights ? '#ff4fd0' : '#000000'} emissiveIntensity={lights ? 2.6 : 0} /></mesh>
          </group>
        ))}
        {lights && <pointLight position={[0.6, 1.4, 0]} intensity={6} distance={4.5} color="#ff6ad5" />}
        <Sign lines={[`CROPS: STAGE ${s.crop} OF ${MAX_CROP}`, lights ? 'Grow lights on' : 'Grow lights dim']} position={[0.36, 2.75, 0]} rotation={[0, Math.PI / 2, 0]} size={[2.4, 0.5]} accent={lights ? '#35e07a' : '#ffb020'} />
      </group>
      {socket(-5.95, SPOT.growSocket.z, Math.PI / 2, s.battery === 'grow')}

      {/* Shielded crew room: thick walls drawn without a roof so the crew can be seen inside */}
      <group>
        <mesh position={[4.75, 0.9, -0.75]} material={m.navy} castShadow><boxGeometry args={[2.9, 1.8, 0.5]} /></mesh>
        <mesh position={[3.3, 0.9, -2.6]} material={m.navy} castShadow><boxGeometry args={[0.5, 1.8, 3.6]} /></mesh>
        <mesh position={[5.0, 0.9 + (sheltered ? 0 : 1.3), -0.45]} material={m.darkSteel}><boxGeometry args={[1.1, 1.7, 0.14]} /></mesh>
        <mesh position={[4.75, 2.1, -0.75]}><sphereGeometry args={[0.16, 14, 10]} /><meshStandardMaterial ref={beacon} color="#5b1a1a" emissive="#ff3b30" emissiveIntensity={0.05} /></mesh>
        <group position={[4.2, 1.45, -4.46]}>
          <mesh material={m.black}><circleGeometry args={[0.4, 20]} /></mesh>
          <group ref={fan} position={[0, 0, 0.02]}>{[0, 1, 2, 3].map((i) => <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]} material={m.steel}><boxGeometry args={[0.7, 0.12, 0.02]} /></mesh>)}</group>
        </group>
        <pointLight position={[4.8, 1.6, -2.4]} intensity={sheltered ? 8 : 1} distance={5} color={s.vent === 'off' ? '#ffe6b0' : '#bfffd8'} />
        <Sign
          lines={[sheltered ? 'SHELTER: CREW INSIDE' : 'SHELTER: EMPTY', s.vent === 'full' ? 'Fans: full flow' : s.vent === 'low' ? 'Fans: low flow' : 'Fans: no power']}
          position={[4.75, 2.6, -0.6]} size={[2.6, 0.5]} accent={s.vent === 'off' ? '#e23d3d' : '#35e07a'}
        />
      </group>
      {socket(SPOT.shelterSocket.x, -0.46, 0, s.battery === 'shelter')}

      {/* The rest of the crew: at the work bench, or behind the shelter walls */}
      <mesh position={[1.6, 0.5, -3.9]} material={m.white} castShadow><boxGeometry args={[2.2, 1.0, 0.8]} /></mesh>
      <group position={sheltered ? [4.3, 0, -2.6] : [1.1, 0, -2.9]} rotation={[0, sheltered ? 0.4 : Math.PI, 0]}><Astronaut anim={crewA} still chestLight={alert && !sheltered ? 'amber' : 'green'} /></group>
      <group position={sheltered ? [5.3, 0, -2.2] : [2.2, 0, -2.9]} rotation={[0, sheltered ? -0.5 : Math.PI, 0]}><Astronaut anim={crewB} still chestLight={alert && !sheltered ? 'amber' : 'green'} /></group>

      {/* Mission Replay: the route walked the first time, as a faint trail on the floor */}
      {trail && trail.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.12, 10]} />
          <meshBasicMaterial color="#9af0ff" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** L03 The Last Battery: carry one battery between two sockets while the base is in shadow. */
export function LastBatteryMission() {
  const run = useGame((s) => s.run)!;
  const settings = useGame((s) => s.save.settings);
  const shipFlags = useGame((s) => s.save.completed.F03?.flags);
  const setPhase = useGame((s) => s.setPhase);
  const bumpStat = useGame((s) => s.bumpStat);
  const restart = useGame((s) => s.restartFromCheckpoint);
  const complete = useGame((s) => s.completeMission);
  const tier = run.tier;
  const hints = hintsOn(settings, tier);
  const phase = run.phase;
  const baseline = run.batteryBaseline ?? null;
  // Whether the battery was latched aboard the ship. If that mission was never flown, it is at the near rack.
  const secured = phase === 'power' ? run.flags.secured !== false : shipFlags?.batterySecured !== false;
  const [state, setState] = useState<BatteryState>(() => (phase === 'power' ? choiceStart(tier, secured) : makeBattery(tier, secured)));
  const walker = useRef<WalkerState>(phase === 'power'
    ? makeWalker(secured ? SPOT.rack.x : SPOT.crate.x, secured ? SPOT.rack.z + 0.6 : SPOT.crate.z - 0.4, Math.PI)
    : makeWalker(secured ? SPOT.rack.x + 1.6 : 1.6, secured ? -0.8 : 1.6, Math.PI));
  const trail = useRef<[number, number][]>([]);
  const tick = useRef(0);
  const finished = useRef(false);
  const t = BATTERY_TUNING[tier];

  useEffect(() => { probe.battery = { get: () => state }; }, [state]);

  // The first event: the base goes into shadow as the mission starts.
  useEffect(() => {
    if (phase === 'fetch') hud.say('We are in shadow, Cadet. The Sun is behind the crater rim and the panels are making almost no power.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const env = useMemo<WalkEnv>(() => ({
    preset: GRAVITY_PRESETS.moon, ground: () => 0,
    circles: [{ x: SPOT.rack.x, z: -4.0, r: 1.0 }, { x: 4.7, z: 3.3, r: 0.95 }, { x: -5.4, z: -0.8, r: 0.9 }, { x: 1.6, z: -3.9, r: 1.1 }],
    boxes: [{ minX: 3.05, maxX: 6.2, minZ: -4.6, maxZ: -0.5, top: 3 }],
    bounds: { minX: -5.6, maxX: 5.6, minZ: -3.9, maxZ: 4.0 }, radius: 0.4,
  }), []);

  const act = (action: BatteryAction) => {
    const r = doBattery(state, action, tier);
    playCue(!r.ok || r.state.outcome === 'critical' ? 'caution' : 'ok');
    hud.say(r.say);
    if (!r.ok) return;
    setState(r.state);
    if (phase === 'fetch' && r.state.battery === 'held') {
      hud.say(secured ? 'Battery in hand, right where you latched it. Two sockets can use it.' : 'Battery in hand. It took extra work to dig out, and the clock kept running.');
      setPhase('power', { flags: { secured } });
    }
  };

  const interactables = (): Interactable[] => {
    const held = state.battery === 'held';
    const at = (id: SpotId, label: string, enabled: boolean): Interactable => ({ id, x: SPOT[id].x, z: SPOT[id].z, r: 1.15, label, enabled: enabled && state.outcome === 'active' });
    return [
      at('rack', 'Take the spare battery', state.battery === 'rack'),
      at('crate', 'Open the crate and take the battery', state.battery === 'crate'),
      at('growSocket', held ? 'Plug the battery into the grow rack' : 'Unplug the battery', held || state.battery === 'grow'),
      at('growPanel', `Run a crop cycle (${t.cycleCost} units)`, state.battery === 'grow'),
      at('shelterSocket', held ? 'Plug the battery into the shelter fans' : state.vent === 'off' ? 'Switch the fans to low-flow mode' : 'Unplug the battery',
        held || (state.battery === 'shelter' && (state.vent === 'off' || state.crew === 'working'))),
      at('hatch', state.crew === 'working' ? 'Call the crew into the shelter' : 'Close the hatch and ride out the alert', phase === 'power'),
    ];
  };

  const onInteract = (id: string) => {
    const held = state.battery === 'held';
    const action: BatteryAction = id === 'rack' ? 'take' : id === 'crate' ? 'recover'
      : id === 'growSocket' ? (held ? 'plug_grow' : 'take') : id === 'growPanel' ? 'cycle'
        : id === 'shelterSocket' ? (held ? 'plug_shelter' : state.vent === 'off' ? 'low_flow' : 'take')
          : state.crew === 'working' ? 'move_crew' : 'ride_out';
    act(action);
  };

  const target: SpotId | null = state.outcome !== 'active' ? null
    : state.battery === 'rack' ? 'rack' : state.battery === 'crate' ? 'crate'
      : state.battery === 'held' ? (state.cycles === 0 && state.first === null && tier === 'junior' ? 'growSocket' : state.cycles > 0 || state.first === 'shelter' ? 'shelterSocket' : null)
        : state.battery === 'grow' ? (state.cycles === 0 ? 'growPanel' : 'growSocket')
          : state.vent === 'off' ? 'shelterSocket' : 'hatch';

  useEffect(() => {
    const alert = alertActive(state, tier);
    const untilAlert = t.alertAt - state.clock;
    const objective = state.outcome === 'success' ? 'The alert has passed'
      : state.outcome === 'critical' ? 'Shift stopped. Go back to the checkpoint and try another order'
        : state.battery === 'rack' ? 'Take the spare battery from the storage rack'
          : state.battery === 'crate' ? 'The battery was never latched: open the cargo crate by the airlock'
            : state.battery === 'held' ? (tier === 'junior' && state.first === null ? 'Carry the battery to the grow rack socket and plug it in' : state.first === null ? 'One battery, two sockets: the grow rack or the shelter fans' : 'Carry the battery to the shelter socket')
              : state.battery === 'grow' ? (state.cycles === 0 ? 'Run a crop cycle at the grow panel' : 'Unplug the battery and carry it to the shelter socket, or run another cycle')
                : state.vent === 'off' ? 'Not enough charge for full fans: switch to low-flow mode at the shelter socket'
                  : state.crew === 'working' ? 'Call the crew into the shelter at the hatch' : 'Close the hatch and ride out the alert';
    hud.set({
      objective,
      meters: [
        { id: 'battery', label: 'Battery charge', value: state.charge, max: t.startCharge, text: `${state.charge} units`, status: state.charge < t.lowCost ? 'low' : state.charge < t.ventCost ? 'caution' : 'ok', note: `Shelter fans need ${t.ventCost}, low flow ${t.lowCost}` },
        { id: 'crop', label: 'Crops', value: state.crop, max: MAX_CROP, text: `stage ${state.crop} of ${MAX_CROP}`, status: state.cycles > 0 ? 'ok' : 'caution', note: state.cycles > 0 ? 'Harvest on time' : 'Harvest waits without a crop cycle' },
        { id: 'protection', label: 'Crew readiness', value: state.readiness, max: 100, text: `${state.readiness}%`, status: state.readiness < 65 ? 'low' : state.readiness < 100 ? 'caution' : 'ok' },
      ],
      readouts: [
        { label: 'Solar alert', value: alert ? 'ARRIVED' : tier === 'advanced' ? 'Timing unknown' : `Expected in ${untilAlert} ${untilAlert === 1 ? 'step' : 'steps'}`, status: alert ? 'low' : 'ok', note: 'time moves when you act' },
        { label: 'Sunlight', value: 'Shadow: panels nearly dark', status: 'caution' },
        { label: 'Battery', value: state.battery === 'held' ? 'In hand' : state.battery === 'grow' ? 'Grow rack' : state.battery === 'shelter' ? 'Shelter socket' : state.battery === 'rack' ? 'Storage rack' : 'Cargo crate' },
        { label: 'Shelter fans', value: state.vent === 'full' ? 'Full flow' : state.vent === 'low' ? 'Low flow' : 'No power', status: state.vent === 'off' && alert ? 'caution' : 'ok' },
        { label: 'Crew', value: state.crew === 'sheltered' ? 'In the shelter' : 'At work stations', status: alert && state.crew === 'working' ? 'caution' : 'ok' },
      ],
      touch: 'walk', touchLabels: { primary: 'Jump', use: 'Use' },
      labels: ['Charge units and crop stages are invented game units', 'Time is compressed: it moves when you act', 'Solar alert: archived NASA record, not live'],
      hint: !hints ? null
        : state.battery === 'held' && state.first === null ? 'The shelter walls protect the crew with no power. The battery runs the fans, and the grow lights want it too.'
          : state.battery === 'grow' && state.cycles > 0 ? `Each cycle costs ${t.cycleCost} units. The shelter fans need ${t.ventCost}.`
            : 'Walk to the glowing marker and press E.',
      distance: null, crosshair: false,
    });
    if (state.outcome !== 'active') hud.warn(null);
    else if (alert && state.crew === 'working') hud.warn({ title: 'SOLAR PARTICLE ALERT', text: 'Get the crew behind the shelter walls. The battery runs the shelter fans.', level: 'alert', sourceId: 'donki_alert' });
    else if (alert) hud.warn({ title: 'SOLAR PARTICLE ALERT', text: 'The crew is behind the shelter walls.', level: 'info', sourceId: 'donki_alert' });
    else hud.warn(null);
  }, [state, tier, hints, t]);

  // Success: hand the run to the debrief.
  useEffect(() => {
    if (state.outcome !== 'success' || finished.current) return;
    finished.current = true;
    playCue('complete');
    const start = choiceStart(tier, secured);
    const battery: BatteryRun = { tier, secured, start, actions: state.log.slice(start.log.length), state, trail: trail.current.slice(0, 160) };
    const recoveries = (run.stats.restarts ?? 0) + (run.stats.recoveries ?? 0);
    const growFirst = state.first === 'grow';
    const timer = window.setTimeout(() => complete({
      crewStatus: `Crew rode out the alert in the shelter at ${state.readiness}% readiness. Crops at stage ${state.crop}, ${state.charge} units left in the battery.`,
      consequence: `${secured
        ? 'Because you latched the battery aboard the ship, it was waiting on the near rack.'
        : 'The battery was never latched aboard the ship, so you had to dig it out of the cargo crate while the clock ran.'
      } ${growFirst
        ? `You powered the grow rack first and ran ${state.cycles} crop ${state.cycles === 1 ? 'cycle' : 'cycles'}, so the harvest stays on time. That left ${state.vent === 'full' ? 'just enough charge for full shelter fans' : 'too little charge for full fans, so the crew sheltered in stuffy air on low flow'}.`
        : 'You took the battery to the shelter first. The crew was inside early with the fans at full flow, and the grow lights stayed dim, so the harvest waits.'
      } The walls did the shielding. The battery only decided how the crew and the plants got through it.${baseline ? '' : ' Replay the choice to see the other ending.'}`,
      objectives: [
        { label: 'Find the spare battery', done: true },
        { label: 'Get the crew behind the shelter walls with ventilation running', done: true },
        { label: 'Keep the harvest on time', done: state.cycles > 0 },
        { label: 'Keep the shelter fans at full flow', done: state.vent === 'full' },
      ],
      stats: [
        { label: 'First socket', value: growFirst ? 'Grow rack' : 'Shelter fans' },
        { label: 'Crop stage', value: `${state.crop} of ${MAX_CROP}` },
        { label: 'Charge left', value: `${state.charge} units` },
        { label: 'Crew readiness', value: `${state.readiness}%` },
        { label: 'Battery found', value: secured ? 'On the near rack' : 'In the cargo crate' },
        ...(recoveries ? [{ label: 'Checkpoint recoveries', value: String(recoveries) }] : []),
      ],
      outpost: null, battery,
      // The Crew Ship remembers whether the reserve battery came back nearly empty.
      carry: { reserveSpent: state.charge <= 1 },
      rating: rateBattery(state.readiness, recoveries),
    }), 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.outcome]);

  const marker = target && (tier === 'junior' || hints) ? SPOT[target] : null;
  return (
    <>
      <GameCanvas fov={46} envIntensity={0.4} background="#020308">
        <Room s={state} tier={tier} trail={baseline ? baseline.trail : null} />
        {marker && <ObjectiveMarker x={marker.x} z={marker.z} radius={0.8} />}
        <WalkerRig
          env={() => env} state={walker} interactables={interactables} onInteract={onInteract}
          frozen={state.outcome !== 'active'} carrying={state.battery === 'held'} carried={<BatteryPack charge={state.charge / t.startCharge} />}
          onStep={(w) => { if (phase === 'power' && tick.current++ % 12 === 0 && trail.current.length < 400) trail.current.push([Math.round(w.x * 10) / 10, Math.round(w.z * 10) / 10]); }}
          cameraOffset={[0, 6.8, 11.2]} lookHeight={0.5}
        />
      </GameCanvas>
      {state.outcome === 'critical' && (
        <ResetCard
          title="Shift stopped by Commander Reyes" reason={state.reason}
          tip="Everyone is safe. Go back to the moment you picked the battery up. Try the shelter socket sooner, or run fewer crop cycles."
          retryLabel="Back to the checkpoint: battery in hand"
          onRetry={() => { bumpStat('recoveries'); restart(); }}
        />
      )}
    </>
  );
}
