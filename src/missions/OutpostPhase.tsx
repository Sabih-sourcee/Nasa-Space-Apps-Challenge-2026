import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { playCue } from '../game/audio';
import { hud } from '../game/hud';
import { useGame } from '../game/store';
import { GRAVITY_PRESETS, makeWalker, type WalkEnv, type WalkerState } from '../sim/movement';
import {
  RES_BOUNDS, RES_LABEL, currentTurn, turnIncome, type EventSpec, type OutpostRun, type ScenarioSpec, type StationId, type TurnReport,
} from '../sim/outpost';
import { getScenario } from '../sim/outpostScenarios';
import { hintsOn } from '../sim/save';
import { rateOutpost } from '../sim/score';
import { GameCanvas, useReducedMotion } from '../three/GameCanvas';
import { M, Sign, Strut } from '../three/Props';
import { ObjectiveMarker } from '../three/Scenery';
import { makeScreen, panelTexture } from '../three/textures';
import { WalkerRig, type Interactable } from '../three/WalkerRig';
import { CriticalCard, DecisionPanel, TurnReportCard, resStatus, resText } from '../ui/Outpost';

const STATIONS: Record<StationId, { x: number; z: number; label: string }> = {
  power: { x: 0, z: -3.5, label: 'power console' },
  comms: { x: -3.4, z: -3.5, label: 'comms terminal' },
  grow: { x: -5.0, z: 0.4, label: 'grow rack' },
  air: { x: 5.0, z: -0.9, label: 'air system' },
  shelter: { x: 3.9, z: 2.9, label: 'shelter hatch' },
};

function splitWarning(text: string): { title: string; text: string } {
  const i = text.indexOf('. ');
  return i < 0 ? { title: text, text: '' } : { title: text.slice(0, i), text: text.slice(i + 2) };
}

function warnFor(events: EventSpec[]): void {
  const order = { alert: 0, caution: 1, info: 2 };
  const ev = [...events].sort((a, b) => order[a.level] - order[b.level])[0];
  if (!ev) { hud.warn(null); return; }
  hud.warn({ ...splitWarning(ev.warning), level: ev.level, sourceId: ev.sourceId });
}

/** How bright the Sun is on the panels right now, from the current turn's income. */
function sunLevel(scn: ScenarioSpec, run: OutpostRun): number {
  const idx = Math.min(run.state.turn, scn.turns.length - 1);
  const turn = scn.turns[idx];
  const { income } = turnIncome(turn, run.state);
  return Math.max(0.08, Math.min(1, income / 6));
}

function Room({ scn, run, active }: { scn: ScenarioSpec; run: OutpostRun; active: StationId | null }) {
  const m = M();
  const reduced = useReducedMotion();
  const s = run.state;
  const mars = scn.world === 'mars';
  const sun = sunLevel(scn, run);
  const wall = useMemo(() => {
    const t = panelTexture(mars ? '#ddd3c6' : '#dfe3e6', '#a9b0b7', mars ? 'habwarm' : 'hab').clone();
    t.needsUpdate = true;
    t.repeat.set(6, 2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
  }, [mars]);
  const floor = useMemo(() => {
    const t = panelTexture('#9aa2ab', '#6c747d', 'habfloor').clone();
    t.needsUpdate = true;
    t.repeat.set(6, 5);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  }, []);
  const screen = useMemo(() => makeScreen(512, 256), []);
  const fan = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const beaconLight = useRef<THREE.PointLight>(null);
  const comms = useRef<THREE.MeshStandardMaterial>(null);
  const hatch = useRef<THREE.Group>(null);

  const alert = !!s.flags.alert_active && s.outcome === 'active' && !s.flags.sheltered;
  const eco = !!s.flags.air_eco;
  const lights = !!s.flags.lights_ran;
  const sheltered = !!s.flags.sheltered;
  const pendingMsg = s.pending.length > 0;
  const gotMsg = s.inbox.length > 0;

  // Console screen: redrawn only when the state changes.
  useEffect(() => {
    const { ctx } = screen;
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#7fd6ff';
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.fillText('HABITAT POWER', 20, 40);
    ctx.fillStyle = '#f2f4f7';
    ctx.font = '26px Arial, sans-serif';
    const turn = currentTurn(scn, s);
    const income = turn ? turnIncome(turn, s).income : 0;
    ctx.fillText(`SOLAR IN   ${turn ? income : '-'} units`, 20, 90);
    ctx.fillText(`AIR        ${eco ? 'ECO' : 'FULL'}`, 20, 128);
    ctx.fillText('BATTERY', 20, 176);
    for (let i = 0; i < RES_BOUNDS.battery.max; i++) {
      ctx.fillStyle = i < s.resources.battery ? '#35e07a' : '#1b2738';
      ctx.fillRect(20 + i * 78, 196, 66, 38);
    }
    screen.texture.needsUpdate = true;
  }, [screen, scn, s, eco]);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (fan.current && !reduced) fan.current.rotation.z += delta * (eco ? 2.2 : 9);
    if (beacon.current) beacon.current.emissiveIntensity = alert ? (reduced ? 3.5 : 2 + Math.sin(t * 7) * 2) : 0.05;
    if (beaconLight.current) beaconLight.current.intensity = alert ? (reduced ? 9 : 6 + Math.sin(t * 7) * 6) : 0;
    if (comms.current) comms.current.emissiveIntensity = pendingMsg ? (reduced ? 2 : 1.2 + Math.sin(t * 4) * 1.2) : gotMsg ? 1.6 : 0.2;
    if (hatch.current) {
      const target = sheltered ? -1.5 : 0;
      hatch.current.rotation.y += (target - hatch.current.rotation.y) * (1 - Math.exp(-4 * Math.min(delta, 0.1)));
    }
  });

  const windowColor = mars
    ? new THREE.Color('#e3b98f').lerp(new THREE.Color('#4a2a18'), s.flags.storm ? 0.75 - sun * 0.4 : 0)
    : new THREE.Color('#05070c').lerp(new THREE.Color('#fff6d8'), Math.pow(sun, 0.8));
  const plants = Math.round(s.resources.crop);
  const glow = (id: StationId) => (active === id ? 1 : 0);

  return (
    <group>
      <mesh position={[0, -0.1, 0]} material={floor} receiveShadow><boxGeometry args={[12.4, 0.2, 9.4]} /></mesh>
      <mesh position={[0, 1.6, -4.6]} material={wall} receiveShadow><boxGeometry args={[12.4, 3.4, 0.2]} /></mesh>
      <mesh position={[-6.2, 1.6, 0]} material={wall} receiveShadow><boxGeometry args={[0.2, 3.4, 9.4]} /></mesh>
      <mesh position={[6.2, 1.6, 0]} material={wall} receiveShadow><boxGeometry args={[0.2, 3.4, 9.4]} /></mesh>
      {/* Window: the easiest way to see sunlight, shadow or dust outside */}
      <mesh position={[2.9, 2.0, -4.48]}><planeGeometry args={[2.2, 1.2]} /><meshBasicMaterial color={windowColor} toneMapped={false} /></mesh>
      {[[2.9, 2.65], [2.9, 1.35]].map(([x, y], i) => <mesh key={i} position={[x, y, -4.46]} material={m.steel}><boxGeometry args={[2.4, 0.1, 0.06]} /></mesh>)}
      {[1.75, 4.05].map((x) => <mesh key={x} position={[x, 2.0, -4.46]} material={m.steel}><boxGeometry args={[0.1, 1.4, 0.06]} /></mesh>)}
      <Sign lines={[mars ? (s.flags.storm ? 'OUTSIDE: DUST STORM' : 'OUTSIDE: CLEAR') : (sun > 0.6 ? 'OUTSIDE: SUNLIT' : 'OUTSIDE: SHADOW')]} position={[2.9, 2.95, -4.47]} size={[2.2, 0.36]} />
      {/* Ceiling light strips dim a little when power is short */}
      {[-3.5, 0, 3.5].map((x) => (
        <mesh key={x} position={[x, 3.25, -1.5]}>
          <boxGeometry args={[2.4, 0.05, 0.3]} />
          <meshStandardMaterial color="#ffffff" emissive="#eaf2ff" emissiveIntensity={0.8 + sun * 1.6} />
        </mesh>
      ))}
      <pointLight position={[-3, 3, 0.5]} intensity={10 + sun * 12} distance={14} color="#eaf2ff" />
      <pointLight position={[3, 3, 0.5]} intensity={10 + sun * 12} distance={14} color="#eaf2ff" />

      {/* Power console with battery cells */}
      <group position={[STATIONS.power.x, 0, STATIONS.power.z - 0.6]}>
        <mesh position={[0, 0.5, 0]} material={m.white} castShadow><boxGeometry args={[2.2, 1.0, 0.7]} /></mesh>
        <mesh position={[0, 1.42, -0.05]} rotation={[-0.25, 0, 0]}><planeGeometry args={[1.9, 0.95]} /><meshBasicMaterial map={screen.texture} toneMapped={false} /></mesh>
        <mesh position={[0, 1.42, -0.1]} rotation={[-0.25, 0, 0]} material={m.darkSteel}><boxGeometry args={[2.05, 1.08, 0.06]} /></mesh>
        <mesh position={[0, 1.04, 0.2]}><boxGeometry args={[2.2, 0.04, 0.3]} /><meshStandardMaterial color="#4de3ff" emissive="#4de3ff" emissiveIntensity={glow('power') * 2.5} /></mesh>
        {Array.from({ length: RES_BOUNDS.battery.max }, (_, i) => (
          <mesh key={i} position={[-1.9 + i * 0.26 - 0.9, 1.3, -0.3]}>
            <boxGeometry args={[0.2, 0.5, 0.2]} />
            <meshStandardMaterial color={i < s.resources.battery ? '#35e07a' : '#2a3038'} emissive={i < s.resources.battery ? '#35e07a' : '#000000'} emissiveIntensity={1.8} />
          </mesh>
        ))}
        <Sign lines={['POWER']} position={[0, 2.15, -0.3]} size={[1.2, 0.36]} />
      </group>

      {/* Comms terminal */}
      <group position={[STATIONS.comms.x, 0, STATIONS.comms.z - 0.6]}>
        <mesh position={[0, 0.5, 0]} material={m.white} castShadow><boxGeometry args={[1.3, 1.0, 0.6]} /></mesh>
        <mesh position={[0, 1.35, -0.05]} rotation={[-0.25, 0, 0]}>
          <boxGeometry args={[1.0, 0.65, 0.06]} />
          <meshStandardMaterial ref={comms} color="#0d1826" emissive={gotMsg ? '#35e07a' : '#4de3ff'} emissiveIntensity={0.2} />
        </mesh>
        <Strut a={[0.45, 1.0, -0.2]} b={[0.45, 2.3, -0.2]} r={0.025} />
        <mesh position={[0.45, 2.35, -0.2]} rotation={[0.9, 0, 0]} material={m.white}><sphereGeometry args={[0.28, 14, 8, 0, Math.PI * 2, 0, 0.9]} /></mesh>
        <Sign lines={[pendingMsg ? 'COMMS: REPLY ON ITS WAY' : gotMsg ? 'COMMS: REPLY RECEIVED' : 'COMMS']} position={[0, 2.75, -0.3]} size={[2.0, 0.36]} accent={pendingMsg ? '#ffb020' : '#e23d3d'} />
      </group>

      {/* Grow rack: plants grow with the crop stage, LEDs follow the last decision */}
      <group position={[STATIONS.grow.x - 0.7, 0, STATIONS.grow.z]}>
        {[[-0.3, -1.2], [-0.3, 1.2], [0.3, -1.2], [0.3, 1.2]].map(([x, z], i) => <Strut key={i} a={[x, 0, z]} b={[x, 2.4, z]} r={0.04} />)}
        {[0.7, 1.5].map((y) => (
          <group key={y} position={[0, y, 0]}>
            <mesh material={m.darkSteel}><boxGeometry args={[0.7, 0.12, 2.5]} /></mesh>
            {Array.from({ length: 6 }, (_, i) => {
              const size = 0.06 + plants * 0.045;
              return (
                <mesh key={i} position={[0, 0.06 + size * 0.9, -1.0 + i * 0.4]} scale={[1, 1.3, 1]}>
                  <sphereGeometry args={[size, 8, 6]} />
                  <meshStandardMaterial color={plants === 0 ? '#7a6a3a' : '#3fa34d'} roughness={0.8} />
                </mesh>
              );
            })}
            <mesh position={[0, 0.66, 0]}>
              <boxGeometry args={[0.5, 0.04, 2.4]} />
              <meshStandardMaterial color={lights ? '#ff6ad5' : '#2a2030'} emissive={lights ? '#ff4fd0' : '#000000'} emissiveIntensity={lights ? 2.6 : 0} />
            </mesh>
          </group>
        ))}
        {lights && <pointLight position={[0.6, 1.4, 0]} intensity={5} distance={4} color="#ff6ad5" />}
        <Sign lines={[`CROPS: STAGE ${plants} OF ${RES_BOUNDS.crop.max}`]} position={[0.36, 2.6, 0]} rotation={[0, Math.PI / 2, 0]} size={[2.2, 0.36]} accent="#35e07a" />
      </group>

      {/* Air system with a fan */}
      <group position={[STATIONS.air.x + 0.7, 0, STATIONS.air.z]}>
        <mesh position={[0, 1.1, 0]} material={m.white} castShadow><boxGeometry args={[0.8, 2.2, 1.8]} /></mesh>
        <group position={[-0.42, 1.4, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh material={m.black}><circleGeometry args={[0.55, 24]} /></mesh>
          <group ref={fan} position={[0, 0, 0.02]}>
            {[0, 1, 2, 3].map((i) => <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]} position={[0, 0, 0]} material={m.steel}><boxGeometry args={[0.95, 0.16, 0.02]} /></mesh>)}
          </group>
          <mesh position={[0, 0, 0.04]} material={m.steel}><ringGeometry args={[0.55, 0.62, 24]} /></mesh>
        </group>
        <mesh position={[-0.42, 0.55, 0.5]}><boxGeometry args={[0.03, 0.14, 0.3]} /><meshStandardMaterial color={eco ? '#ffb020' : '#35e07a'} emissive={eco ? '#ffb020' : '#35e07a'} emissiveIntensity={2} /></mesh>
        <Sign lines={[eco ? 'AIR: ECO MODE' : 'AIR: FULL POWER']} position={[-0.43, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} size={[1.9, 0.36]} accent={eco ? '#ffb020' : '#35e07a'} />
      </group>

      {/* Radiation shelter: thick walls, a heavy hatch, fans if powered */}
      <group position={[4.9, 0, 3.4]}>
        <mesh position={[0, 1.2, 0.55]} material={m.navy} castShadow><boxGeometry args={[2.4, 2.4, 0.3]} /></mesh>
        <mesh position={[1.05, 1.2, -0.3]} material={m.navy} castShadow><boxGeometry args={[0.3, 2.4, 1.6]} /></mesh>
        <mesh position={[0, 2.5, -0.2]} material={m.navy} castShadow><boxGeometry args={[2.4, 0.3, 1.8]} /></mesh>
        <mesh position={[-1.05, 1.2, 0.2]} material={m.navy} castShadow><boxGeometry args={[0.3, 2.4, 0.6]} /></mesh>
        <group ref={hatch} position={[-1.05, 0, -1.05]}>
          <mesh position={[0.95, 1.15, 0]} material={m.darkSteel} castShadow><boxGeometry args={[1.9, 2.3, 0.22]} /></mesh>
          <mesh position={[0.95, 1.3, -0.12]} material={m.yellow}><torusGeometry args={[0.28, 0.04, 8, 20]} /></mesh>
        </group>
        <pointLight position={[0, 1.8, -0.2]} intensity={sheltered ? 5 : 0.5} distance={4} color={s.flags.shelter_fans ? '#bfffd8' : '#ffe6b0'} />
        <mesh position={[0, 2.68, -1.05]}>
          <sphereGeometry args={[0.16, 14, 10]} />
          <meshStandardMaterial ref={beacon} color="#5b1a1a" emissive="#ff3b30" emissiveIntensity={0.05} />
        </mesh>
        <pointLight ref={beaconLight} position={[0, 2.9, -1.2]} intensity={0} distance={9} color="#ff3b30" />
        <Sign lines={[sheltered ? (s.flags.shelter_fans ? 'SHELTER: CREW IN, FANS ON' : 'SHELTER: CREW IN, NO FANS') : 'SHELTER']} position={[0, 3.0, -1.07]} size={[2.4, 0.36]} accent={alert ? '#e23d3d' : '#35e07a'} />
      </group>
    </group>
  );
}

function Interior({ scn, run, onOpen, frozen }: { scn: ScenarioSpec; run: OutpostRun; onOpen: () => void; frozen: boolean }) {
  const walker = useRef<WalkerState>(makeWalker(0, 2.8, Math.PI));
  const preset = GRAVITY_PRESETS[scn.world];
  const turn = currentTurn(scn, run.state);
  const active = turn?.station ?? null;
  const s = run.state;
  const env = useMemo<WalkEnv>(() => ({
    preset, ground: () => 0, boxes: [],
    circles: [
      { x: STATIONS.power.x, z: STATIONS.power.z - 0.6, r: 1.1 },
      { x: STATIONS.comms.x, z: STATIONS.comms.z - 0.6, r: 0.8 },
      { x: STATIONS.grow.x - 0.7, z: STATIONS.grow.z, r: 1.0 },
      { x: STATIONS.air.x + 0.7, z: STATIONS.air.z, r: 1.0 },
      { x: 4.9, z: 3.5, r: 1.3 },
    ],
    bounds: { minX: -5.6, maxX: 5.6, minZ: -3.9, maxZ: 4.0 }, radius: 0.4,
  }), [preset]);

  const info: Record<StationId, string> = {
    power: `Power console. Battery holds ${s.resources.battery} of ${RES_BOUNDS.battery.max} units.`,
    comms: s.pending.length ? 'Comms terminal. A reply from Earth is on its way.' : s.inbox.length ? `Comms terminal. Earth said: ${s.inbox[s.inbox.length - 1].text}` : 'Comms terminal. No messages waiting.',
    grow: `Grow rack. Crops are at stage ${s.resources.crop} of ${RES_BOUNDS.crop.max}. Grow lights are ${s.flags.lights_ran ? 'on' : 'off'}.`,
    air: `Air system. Running in ${s.flags.air_eco ? 'eco mode' : 'full power'}. Air is at ${Math.round(s.resources.air)} percent.`,
    shelter: s.flags.sheltered ? 'Shelter. The crew is inside, behind the thick walls.' : 'Shelter. Thick walls protect the crew. Fans inside need power.',
  };

  const interactables = (): Interactable[] => (Object.keys(STATIONS) as StationId[]).map((id) => ({
    id, x: STATIONS[id].x, z: STATIONS[id].z, r: 1.9,
    label: id === active ? `Open the power plan at the ${STATIONS[id].label}` : `Inspect the ${STATIONS[id].label}`,
    enabled: true,
  }));

  const marker = active ? STATIONS[active] : null;
  return (
    <>
      <ambientLight intensity={0.35} />
      <Room scn={scn} run={run} active={active} />
      {marker && <ObjectiveMarker x={marker.x} z={marker.z} radius={0.9} />}
      <WalkerRig
        env={() => env} state={walker} interactables={interactables} frozen={frozen}
        onInteract={(id) => {
          if (id === active) { playCue('click'); onOpen(); }
          else { playCue('click'); hud.say(info[id as StationId]); }
        }}
        cameraOffset={[0, 6.8, 11.2]} lookHeight={0.5}
      />
    </>
  );
}

/** Habitat operations for the Moon and Mars: walk to a station, plan power, see the result. */
export function OutpostPhase({ missionId }: { missionId: 'L02' | 'M04' }) {
  const run = useGame((s) => s.run)!;
  const settings = useGame((s) => s.save.settings);
  const recover = useGame((s) => s.outpostRecover);
  const complete = useGame((s) => s.completeMission);
  const scn = getScenario(missionId, run.tier);
  const outpost = run.outpost as OutpostRun;
  const [panel, setPanel] = useState(false);
  const [report, setReport] = useState<TurnReport | null>(null);
  const hints = hintsOn(settings, run.tier);
  const state = outpost.state;
  const turn = currentTurn(scn, state);
  const finished = useRef(false);

  // Announce the current turn's start events when the phase is entered or restored.
  useEffect(() => {
    const t = currentTurn(scn, outpost.state);
    if (!t) return;
    const starts = t.events.filter((e) => e.phase === 'start' && outpost.state.firedEvents.includes(`${t.id}:${e.id}`));
    warnFor(starts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.attempt, state.turn]);

  useEffect(() => {
    const meters = scn.meters.map((res) => ({
      id: res, label: RES_LABEL[res], value: state.resources[res], max: RES_BOUNDS[res].max,
      text: resText(res, state.resources[res]), status: resStatus(scn, res, state.resources[res]),
    }));
    const income = turn ? turnIncome(turn, state).income : 0;
    hud.set({
      objective: turn ? `${turn.title}: walk to the ${STATIONS[turn.station].label} and plan the power` : state.outcome === 'critical' ? 'Shift stopped. Recover from the checkpoint and try a different plan' : 'Shift complete',
      meters,
      readouts: [
        ...(turn ? [{ label: 'Solar panels now', value: `${income} units per shift`, status: (income <= 2 ? 'caution' : 'ok') as 'caution' | 'ok' }] : []),
        ...(scn.missionId === 'L02' && scn.tier !== 'junior' ? [{ label: 'Crew', value: state.flags.sheltered ? 'In the shelter' : 'At work stations' }] : []),
        ...(scn.tier === 'advanced' ? [
          { label: 'Science', value: `${state.resources.science} experiments` },
          { label: 'Earth link', value: state.pending.length ? 'Reply on its way' : state.inbox.length ? 'Reply received' : 'Quiet' },
        ] : []),
      ],
      touch: 'walk', touchLabels: { primary: 'Jump', use: 'Use' },
      labels: ['Energy units are invented game units', 'Shifts are compressed', ...(scn.missionId === 'L02' ? ['Solar alert: archived NASA record, not live'] : [])],
      hint: hints && turn ? `Walk to the glowing marker at the ${STATIONS[turn.station].label} and press E. ${turn.hint ?? ''}` : null,
      distance: null, crosshair: false,
    });
  }, [scn, state, turn, hints]);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    hud.warn(null);
    const r = state.resources;
    const lessons = state.history.flatMap((h, i) => scn.turns[i].actions.filter((a) => h.chosen.includes(a.id) && a.lesson).map((a) => a.lesson as string)).slice(0, 3);
    const air = r.air >= 75 ? 'safe and comfortable' : r.air >= 55 ? 'safe, though the air got a little stuffy' : 'safe but tired: the air got very stuffy';
    const cropLine = !scn.meters.includes('crop') ? ''
      : scn.missionId === 'L02' ? (state.flags.harvest ? ' The first harvest came in on time.' : ' The harvest is delayed.')
        : r.crop >= 2 ? ' The crops came through the storm.' : ' The crops were set back by the cold.';
    const st = run.stats;
    complete({
      crewStatus: `Crew is ${air}.${cropLine}`,
      consequence: `${lessons.join(' ')} ${run.replayBaseline ? '' : 'Use Replay a Decision to change one choice and compare both endings.'}`.trim(),
      objectives: [
        // Only list the earlier steps if they were flown in this run (Judge Mode can jump past them).
        ...(!run.replayBaseline && st.touchdown !== undefined ? [{ label: scn.missionId === 'L02' ? 'Land safely on the Moon' : 'Land safely on Mars', done: true }] : []),
        ...(!run.replayBaseline && st.suitO2 !== undefined ? [{ label: scn.missionId === 'L02' ? 'Carry supplies and deploy the solar panel' : 'Inspect the rover and reach the habitat', done: true }] : []),
        { label: 'Keep air support running through the low-power shifts', done: true },
        ...(scn.missionId === 'L02' ? [{ label: 'Protect the crew during the solar particle alert', done: r.protection >= 50 }] : [{ label: 'Bring the outpost through the dust storm', done: true }]),
        ...(scn.meters.includes('crop') ? [{ label: scn.missionId === 'L02' ? 'Reach the crop milestone on time' : 'Keep the crops at stage 2 or better', done: scn.missionId === 'L02' ? !!state.flags.harvest : r.crop >= 2 }] : []),
        ...(scn.tier === 'advanced' ? [{ label: 'Optional: run a science experiment', done: r.science > 0 }] : []),
      ],
      stats: [
        ...scn.meters.map((res) => ({ label: `Final ${RES_LABEL[res].toLowerCase()}`, value: resText(res, r[res]) })),
        ...(scn.tier === 'advanced' ? [{ label: 'Science', value: String(r.science) }] : []),
        ...(st.landingAttempts !== undefined && !run.replayBaseline ? [{ label: 'Landing attempts', value: String((st.landingAttempts ?? 0) + 1) }] : []),
        ...(st.touchdown !== undefined && !run.replayBaseline ? [{ label: 'Touchdown speed', value: `${(st.touchdown / 10).toFixed(1)} m/s` }] : []),
        ...(st.suitO2 !== undefined && !run.replayBaseline ? [{ label: 'Suit oxygen left after surface work', value: `${Math.round(st.suitO2)}%` }] : []),
        ...(st.recoveries ? [{ label: 'Checkpoint recoveries', value: String(st.recoveries) }] : []),
      ],
      outpost,
      rating: rateOutpost(r.air, st.recoveries ?? 0),
    });
  };

  const onReportClosed = () => {
    const rep = report;
    setReport(null);
    if (!rep) return;
    if (rep.outcome === 'success') { finish(); return; }
    if (rep.outcome === 'active') {
      // Show the warning for whatever the next turn starts with.
      const next = currentTurn(scn, useGame.getState().run?.outpost?.state ?? state);
      warnFor(rep.events.filter((e) => e.phase === 'start' || (next && e.highlight === next.station)));
    }
  };

  // Resumed after the final shift was committed but before the debrief was shown.
  useEffect(() => {
    if (state.outcome === 'success' && !report) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.outcome, report]);

  const preferred = run.replayBaseline?.decisions[state.turn] ?? [];
  return (
    <>
      <GameCanvas key="outpost" fov={46} envIntensity={0.45} background={scn.world === 'mars' ? '#1a0f0a' : '#020308'}>
        <Interior scn={scn} run={outpost} onOpen={() => setPanel(true)} frozen={panel || !!report || state.outcome !== 'active'} />
      </GameCanvas>
      {panel && turn && (
        <DecisionPanel
          scn={scn} run={outpost} preferred={preferred}
          onClose={() => setPanel(false)}
          onCommitted={(rep) => { setPanel(false); setReport(rep); }}
        />
      )}
      {report && <TurnReportCard scn={scn} report={report} onContinue={onReportClosed} />}
      {!report && state.outcome === 'critical' && (
        <CriticalCard scn={scn} run={outpost} onRecover={() => { playCue('ok'); recover(); }} />
      )}
    </>
  );
}
