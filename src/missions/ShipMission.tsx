import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { playCue } from '../game/audio';
import { hud } from '../game/hud';
import { probe } from '../game/probe';
import { useGame } from '../game/store';
import { makeDock, retryDock, type DockState } from '../sim/flight';
import { GRAVITY_PRESETS, makeWalker, type WalkEnv, type WalkerState } from '../sim/movement';
import { hintsOn } from '../sim/save';
import { rateShip } from '../sim/score';
import {
  SHIP_TUNING, airflow, doShipTask, dockingHelp, makeShip, nextShipTask, powered, powerRestored, readyToDock,
  type ShipState, type ShipTask,
} from '../sim/ship';
import type { Tier } from '../sim/types';
import { GameCanvas, useReducedMotion } from '../three/GameCanvas';
import { M, Sign, Strut } from '../three/Props';
import { ObjectiveMarker } from '../three/Scenery';
import { panelTexture } from '../three/textures';
import { WalkerRig, type Interactable } from '../three/WalkerRig';
import { ResetCard } from '../ui/Hud';
import { DockingScene } from './StationMission';

// Four rooms in a row, left to right: cargo, engineering, life support, cockpit.
const SPOT = {
  line: { x: -5.0, z: -2.6 }, nav: { x: -3.6, z: -2.6 }, vent: { x: -2.4, z: -2.6 }, locker: { x: -1.0, z: -2.6 },
  gauge: { x: 2.0, z: -2.6 }, loop: { x: 4.0, z: -2.6 },
  battery: { x: -8.4, z: 1.0 }, rack: { x: -9.6, z: -2.6 },
  cockpit: { x: 9.6, z: -2.4 },
};
type SpotId = keyof typeof SPOT;

const TASK_SPOT: Record<ShipTask | 'cockpit', SpotId> = {
  inspect: 'line', take: 'locker', attach_nav: 'nav', attach_vent: 'vent', check_air: 'gauge', backup: 'loop',
  grab: 'battery', rack: 'rack', latch: 'rack', cockpit: 'cockpit',
};

/** The spare battery. The same prop is carried on the Moon in The Last Battery. */
export function BatteryPack({ charge = 1, latched = false }: { charge?: number; latched?: boolean }) {
  const m = M();
  return (
    <group>
      <mesh material={m.darkSteel} castShadow><boxGeometry args={[0.5, 0.34, 0.3]} /></mesh>
      <mesh position={[0, 0.2, 0]} material={m.yellow}><boxGeometry args={[0.3, 0.06, 0.08]} /></mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-0.165 + i * 0.11, 0, 0.155]}>
          <boxGeometry args={[0.08, 0.2, 0.02]} />
          <meshStandardMaterial color={i / 4 < charge ? '#35e07a' : '#1b2738'} emissive={i / 4 < charge ? '#35e07a' : '#000000'} emissiveIntensity={1.6} />
        </mesh>
      ))}
      {latched && <mesh position={[0, 0, 0.19]} material={m.yellow}><boxGeometry args={[0.62, 0.06, 0.04]} /></mesh>}
    </group>
  );
}

function Lamp({ x, on, color = '#eaf2ff' }: { x: number; on: boolean; color?: string }) {
  return (
    <>
      <mesh position={[x, 3.25, -1.2]}>
        <boxGeometry args={[2.6, 0.05, 0.3]} />
        <meshStandardMaterial color="#ffffff" emissive={on ? color : '#ffb020'} emissiveIntensity={on ? 2.2 : 0.35} />
      </mesh>
      <pointLight position={[x, 3, 0.6]} intensity={on ? 16 : 5} distance={11} color={on ? color : '#ffcf8a'} />
    </>
  );
}

function Deck({ ship }: { ship: ShipState }) {
  const m = M();
  const reduced = useReducedMotion();
  const wall = useMemo(() => {
    const t = panelTexture('#d9dee4', '#9aa2ab', 'shipwall').clone();
    t.needsUpdate = true; t.repeat.set(12, 2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.65 });
  }, []);
  const floor = useMemo(() => {
    const t = panelTexture('#8e97a1', '#626a73', 'shipfloor').clone();
    t.needsUpdate = true; t.repeat.set(12, 4);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  }, []);
  const fan = useRef<THREE.Group>(null);
  const burnt = useRef<THREE.MeshStandardMaterial>(null);

  const nav = powered(ship, 'nav');
  const vent = powered(ship, 'vent');
  const flow = airflow(ship);
  const fixed = powerRestored(ship);

  useFrame(({ clock }, delta) => {
    if (fan.current && !reduced) fan.current.rotation.z += delta * (flow === 'stable' ? 10 : flow === 'backup' ? 4.5 : 0.5);
    if (burnt.current) burnt.current.emissiveIntensity = fixed ? 1.6 : reduced ? 2 : 1.2 + Math.sin(clock.elapsedTime * 6) * 1.2;
  });

  const socket = (x: number, label: string, live: boolean) => (
    <group position={[x, 0, -3.75]}>
      <mesh position={[0, 1.2, 0]} material={m.darkSteel}><boxGeometry args={[0.7, 0.7, 0.14]} /></mesh>
      <mesh position={[0, 1.2, 0.09]}>
        <cylinderGeometry args={[0.16, 0.16, 0.08, 16]} />
        <meshStandardMaterial color={live ? '#35e07a' : '#3a1414'} emissive={live ? '#35e07a' : '#ff3b30'} emissiveIntensity={live ? 2.4 : 0.5} />
      </mesh>
      {live && <mesh position={[0, 1.2, 0.2]} rotation={[Math.PI / 2, 0, 0]} material={m.yellow}><cylinderGeometry args={[0.1, 0.1, 0.22, 12]} /></mesh>}
      <Sign lines={[label]} position={[0, 1.85, 0.02]} size={[1.0, 0.3]} accent={live ? '#35e07a' : '#e23d3d'} />
    </group>
  );

  return (
    <group>
      <mesh position={[0, -0.1, 0]} material={floor} receiveShadow><boxGeometry args={[24.4, 0.2, 8.4]} /></mesh>
      <mesh position={[0, 1.6, -4.0]} material={wall}><boxGeometry args={[24.4, 3.4, 0.2]} /></mesh>
      <mesh position={[-12.2, 1.6, 0]} material={wall}><boxGeometry args={[0.2, 3.4, 8.4]} /></mesh>
      <mesh position={[12.2, 1.6, 0]} material={wall}><boxGeometry args={[0.2, 3.4, 8.4]} /></mesh>
      {/* Bulkheads with open doorways between the rooms */}
      {[-6, 0, 6].map((x) => (
        <group key={x}>
          <mesh position={[x, 1.6, -2.55]} material={wall}><boxGeometry args={[0.24, 3.4, 2.9]} /></mesh>
          {/* The near half of each bulkhead is cut low so it never hides the room behind it */}
          <mesh position={[x, 0.3, 2.9]} material={m.navy}><boxGeometry args={[0.24, 0.6, 2.4]} /></mesh>
        </group>
      ))}
      <Sign lines={['CARGO']} position={[-9, 3.05, -3.88]} size={[1.8, 0.4]} />
      <Sign lines={['ENGINEERING']} position={[-3, 3.05, -3.88]} size={[2.4, 0.4]} />
      <Sign lines={['LIFE SUPPORT']} position={[3, 3.05, -3.88]} size={[2.4, 0.4]} />
      <Sign lines={['COCKPIT']} position={[9, 3.05, -3.88]} size={[1.8, 0.4]} />
      <ambientLight intensity={0.3} />
      <Lamp x={-9} on />
      <Lamp x={-3} on />
      <Lamp x={3} on={flow !== 'low'} color="#d9ffe9" />
      <Lamp x={9} on={nav} color="#bfe9ff" />

      {/* Engineering: the failed line, two sockets, the parts locker */}
      <group position={[SPOT.line.x, 0, -3.75]}>
        <mesh position={[0, 1.3, 0]} material={m.steel}><boxGeometry args={[1.0, 1.5, 0.16]} /></mesh>
        <Strut a={[-0.3, 0.6, 0.1]} b={[-0.3, 2.0, 0.1]} r={0.05} />
        <mesh position={[-0.3, 1.3, 0.14]}>
          <boxGeometry args={[0.24, 0.3, 0.14]} />
          <meshStandardMaterial ref={burnt} color={fixed ? '#1d4a2c' : '#2a1410'} emissive={fixed ? '#35e07a' : '#ff5a1f'} emissiveIntensity={1.4} />
        </mesh>
        <Sign lines={[fixed ? 'MAIN LINE: PATCHED' : ship.inspected ? 'MAIN LINE: CONNECTOR BURNT' : 'MAIN LINE: FAULT']} position={[0, 2.35, 0.02]} size={[2.0, 0.3]} accent={fixed ? '#35e07a' : '#e23d3d'} />
      </group>
      {socket(SPOT.nav.x, 'NAV SOCKET', nav)}
      {socket(SPOT.vent.x, 'VENT SOCKET', vent)}
      <group position={[SPOT.locker.x, 0, -3.6]}>
        <mesh position={[0, 0.8, 0]} material={m.white} castShadow><boxGeometry args={[0.9, 1.6, 0.5]} /></mesh>
        {ship.connector === 'locker' && <mesh position={[0, 1.2, 0.28]} rotation={[Math.PI / 2, 0, 0]} material={m.yellow}><cylinderGeometry args={[0.1, 0.1, 0.22, 12]} /></mesh>}
        <Sign lines={[ship.connector === 'locker' ? 'SPARES: 1 CONNECTOR' : 'SPARES: EMPTY']} position={[0, 1.95, 0.02]} size={[1.6, 0.3]} />
      </group>

      {/* Life support: gauge, loop switch, main fan */}
      <group position={[SPOT.gauge.x, 0, -3.75]}>
        <mesh position={[0, 1.3, 0]} material={m.white}><boxGeometry args={[0.9, 0.9, 0.14]} /></mesh>
        <mesh position={[0, 1.3, 0.08]}>
          <circleGeometry args={[0.32, 24]} />
          <meshStandardMaterial color="#0d1826" emissive={flow === 'low' ? '#ff3b30' : flow === 'backup' ? '#ffb020' : '#35e07a'} emissiveIntensity={ship.airChecked ? 1.8 : 0.4} />
        </mesh>
        <Sign lines={[!ship.airChecked ? 'AIRFLOW GAUGE' : flow === 'low' ? 'AIRFLOW: LOW' : flow === 'backup' ? 'AIRFLOW: BACKUP LOOP' : 'AIRFLOW: STABLE']} position={[0, 2.05, 0.02]} size={[2.0, 0.3]} accent={flow === 'low' ? '#e23d3d' : '#35e07a'} />
      </group>
      <group position={[SPOT.loop.x, 0, -3.75]}>
        <mesh position={[0, 1.2, 0]} material={m.darkSteel}><boxGeometry args={[0.6, 0.8, 0.14]} /></mesh>
        <mesh position={[0, ship.backupLoop ? 1.38 : 1.05, 0.12]} material={m.yellow}><boxGeometry args={[0.16, 0.3, 0.1]} /></mesh>
        <Sign lines={[ship.backupLoop ? 'BACKUP LOOP: ON' : 'BACKUP LOOP: OFF']} position={[0, 1.85, 0.02]} size={[1.7, 0.3]} accent={ship.backupLoop ? '#ffb020' : '#e23d3d'} />
      </group>
      <group position={[0.9, 1.9, -3.86]}>
        <mesh material={m.black}><circleGeometry args={[0.5, 24]} /></mesh>
        <group ref={fan} position={[0, 0, 0.02]}>
          {[0, 1, 2, 3].map((i) => <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]} material={m.steel}><boxGeometry args={[0.86, 0.14, 0.02]} /></mesh>)}
        </group>
        <mesh position={[0, 0, 0.04]} material={m.steel}><ringGeometry args={[0.5, 0.57, 24]} /></mesh>
      </group>

      {/* Cargo: the spare battery and its rack */}
      <group position={[SPOT.rack.x, 0, -3.6]}>
        {[[-0.6, -0.2], [0.6, -0.2], [-0.6, 0.25], [0.6, 0.25]].map(([x, z], i) => <Strut key={i} a={[x, 0, z]} b={[x, 1.7, z]} r={0.04} />)}
        <mesh position={[0, 0.9, 0.02]} material={m.darkSteel}><boxGeometry args={[1.3, 0.08, 0.6]} /></mesh>
        {(ship.battery === 'racked' || ship.battery === 'latched') && <group position={[0, 1.12, 0.05]}><BatteryPack latched={ship.battery === 'latched'} /></group>}
        <Sign lines={[ship.battery === 'latched' ? 'LUNAR CARGO: LATCHED' : ship.battery === 'racked' ? 'LUNAR CARGO: NOT LATCHED' : 'LUNAR CARGO RACK']} position={[0, 2.05, -0.1]} size={[2.2, 0.3]} accent={ship.battery === 'latched' ? '#35e07a' : '#ffb020'} />
      </group>
      {ship.battery === 'loose' && <group position={[SPOT.battery.x, 0.18, SPOT.battery.z]} rotation={[0, 0.5, 0]}><BatteryPack /></group>}
      {[[-10.6, 1.8], [-7.2, 2.4]].map(([x, z], i) => <mesh key={i} position={[x, 0.4, z]} material={m.white} castShadow><boxGeometry args={[0.9, 0.8, 0.9]} /></mesh>)}

      {/* Cockpit: the guidance display and the pilot seat */}
      <group position={[SPOT.cockpit.x, 0, -3.5]}>
        <mesh position={[0, 0.55, 0]} material={m.darkSteel} castShadow><boxGeometry args={[2.6, 1.1, 0.7]} /></mesh>
        <mesh position={[0, 1.5, -0.1]} rotation={[-0.2, 0, 0]}>
          <planeGeometry args={[2.0, 0.9]} />
          <meshStandardMaterial color="#05080f" emissive={nav ? '#4de3ff' : '#101820'} emissiveIntensity={nav ? 1.5 : 0.2} />
        </mesh>
        {nav && <mesh position={[0, 1.5, -0.08]} rotation={[-0.2, 0, 0]}><ringGeometry args={[0.2, 0.25, 28]} /><meshBasicMaterial color="#35e07a" /></mesh>}
        <Sign lines={[nav ? 'GUIDANCE: ONLINE' : 'GUIDANCE: DARK']} position={[0, 2.25, -0.2]} size={[2.0, 0.3]} accent={nav ? '#35e07a' : '#e23d3d'} />
      </group>
      <mesh position={[11.0, 1.9, -3.86]}><planeGeometry args={[1.6, 1.0]} /><meshBasicMaterial color="#02040a" /></mesh>
    </group>
  );
}

const ABORT_TEXT = {
  speed: { reason: 'The ship reached the port faster than the docking ring allows, so the approach was called off.', tip: 'Hold X to brake well before you arrive.' },
  alignment: { reason: 'The ship arrived out of line with the docking port, so the approach was called off.', tip: 'Put the cross under your crosshair first, then close in slowly.' },
};

/** F03 Keep the Ship Flying: four rooms of repairs, then the docking handoff. */
export function ShipMission() {
  const run = useGame((s) => s.run)!;
  const settings = useGame((s) => s.save.settings);
  const setPhase = useGame((s) => s.setPhase);
  const complete = useGame((s) => s.completeMission);
  const tier: Tier = run.tier;
  const hints = hintsOn(settings, tier);
  const [ship, setShip] = useState<ShipState>(makeShip);
  const walker = useRef<WalkerState>(makeWalker(SPOT.line.x + 0.6, -0.6, Math.PI));
  const dock = useRef(makeDock());
  const [abort, setAbort] = useState<'speed' | 'alignment' | null>(null);
  const finished = useRef(false);
  const phase = run.phase;

  useEffect(() => { probe.ship = { get: () => ship }; probe.dock = dock; }, [ship]);

  const env = useMemo<WalkEnv>(() => ({
    preset: GRAVITY_PRESETS.earth, ground: () => 0, circles: [],
    boxes: [-6, 0, 6].flatMap((x) => [
      { minX: x - 0.2, maxX: x + 0.2, minZ: -4, maxZ: -1.1, top: 3 },
      { minX: x - 0.2, maxX: x + 0.2, minZ: 1.7, maxZ: 4, top: 3 },
    ]),
    bounds: { minX: -11.6, maxX: 11.6, minZ: -3.2, maxZ: 3.4 }, radius: 0.4,
  }), []);

  const next = nextShipTask(ship, tier);
  const choice = SHIP_TUNING[tier].choice;

  const act = (task: ShipTask) => {
    const r = doShipTask(ship, task, tier);
    playCue(r.ok ? 'ok' : 'caution');
    hud.say(r.say);
    if (r.ok) setShip(r.state);
  };

  const toDock = () => {
    if (!readyToDock(ship)) {
      playCue('caution');
      hud.say(!powerRestored(ship) ? 'We cannot dock with that line down. Fit the spare connector in engineering first.' : 'The crew air is not steady yet. Check the airflow in life support before we dock.');
      return;
    }
    playCue('complete');
    hud.say(dockingHelp(ship) === 'display'
      ? `Guidance display is live${ship.battery === 'latched' ? '' : ', and that battery is still loose'}. Taking us in. You have the controls.`
      : `No guidance display, so I will talk you in${ship.battery === 'latched' ? '' : '. That battery is still loose'}. Slow and steady. You have the controls.`);
    setPhase('dock', {
      flags: { nav: powered(ship, 'nav'), backup: ship.backupLoop, latched: ship.battery === 'latched', navFirst: ship.log.indexOf('attach_nav') >= 0 },
      stats: { reserve: ship.reserve },
    });
  };

  const interactables = (): Interactable[] => {
    const held = ship.connector === 'held';
    const at = (id: SpotId, label: string, enabled: boolean): Interactable => ({ id, x: SPOT[id].x, z: SPOT[id].z, r: id === 'cockpit' ? 1.6 : 1.0, label, enabled });
    return [
      at('line', 'Inspect the failed power line', !ship.inspected),
      at('locker', 'Take the spare connector', ship.connector === 'locker'),
      at('nav', 'Fit the connector to the navigation socket', held),
      at('vent', 'Fit the connector to the ventilation socket', held),
      at('gauge', 'Read the airflow gauge', true),
      at('loop', 'Switch to the backup air loop', ship.airChecked && !ship.backupLoop),
      at('battery', 'Pick up the spare battery', ship.battery === 'loose'),
      at('rack', ship.battery === 'held' ? 'Put the battery in the rack' : 'Close the rack latch', ship.battery === 'held' || ship.battery === 'racked'),
      at('cockpit', readyToDock(ship) ? 'Take the pilot seat and start docking' : 'Check the cockpit', true),
    ];
  };

  const onInteract = (id: string) => {
    if (id === 'cockpit') { toDock(); return; }
    const task: ShipTask = id === 'line' ? 'inspect' : id === 'locker' ? 'take' : id === 'nav' ? 'attach_nav' : id === 'vent' ? 'attach_vent'
      : id === 'gauge' ? 'check_air' : id === 'loop' ? 'backup' : id === 'battery' ? 'grab' : ship.battery === 'held' ? 'rack' : 'latch';
    act(task);
  };

  // HUD for the repair phase.
  useEffect(() => {
    if (phase !== 'ship') return;
    const left = [
      !powerRestored(ship) ? 'fit the spare connector (engineering)' : null,
      !ship.airChecked || airflow(ship) === 'low' ? 'steady the air (life support)' : null,
      ship.battery !== 'latched' ? 'latch the spare battery (cargo)' : null,
    ].filter(Boolean);
    const step: Record<ShipTask | 'cockpit', string> = {
      inspect: 'Engineering: inspect the failed power line', take: 'Engineering: take the spare connector from the parts locker',
      attach_nav: choice ? 'Engineering: fit the connector to the navigation or the ventilation socket' : 'Engineering: fit the connector to the navigation socket',
      attach_vent: 'Engineering: fit the connector to the navigation or the ventilation socket',
      check_air: 'Life support: read the airflow gauge', backup: 'Life support: switch to the backup air loop',
      grab: 'Cargo: pick up the loose spare battery', rack: 'Cargo: put the battery in the marked rack', latch: 'Cargo: close the rack latch',
      cockpit: 'Cockpit: take the pilot seat and start docking',
    };
    hud.set({
      objective: tier === 'junior' || ship.connector === 'held' || !ship.inspected || left.length === 0 ? step[next]
        : `Your order, your call. Still to do: ${left.join(', ')}${readyToDock(ship) ? '. The cockpit is ready when you are' : ''}`,
      meters: [{ id: 'reserve', label: 'Air reserve', value: ship.reserve, max: 100, text: `${Math.round(ship.reserve)}%`, status: ship.reserve < 75 ? 'caution' : 'ok', note: ship.backupLoop ? 'The backup loop is using reserve' : undefined }],
      readouts: [
        { label: 'Power line', value: powered(ship, 'nav') ? 'Navigation restored' : powered(ship, 'vent') ? 'Ventilation restored' : 'Down', status: powerRestored(ship) ? 'ok' : 'low' },
        { label: 'Airflow', value: !ship.airChecked ? 'Not checked' : airflow(ship) === 'low' ? 'Low' : airflow(ship) === 'backup' ? 'Steady on backup' : 'Stable', status: ship.airChecked && airflow(ship) !== 'low' ? 'ok' : 'caution' },
        { label: 'Lunar battery', value: ship.battery === 'latched' ? 'Latched' : ship.battery === 'racked' ? 'In rack, not latched' : ship.battery === 'held' ? 'In hand' : 'Loose', status: ship.battery === 'latched' ? 'ok' : 'caution' },
        { label: 'Docking help', value: !powerRestored(ship) ? 'None yet' : dockingHelp(ship) === 'display' ? 'Guidance display' : 'Guided by Reyes' },
      ],
      touch: 'walk', touchLabels: { primary: 'Jump', use: 'Use' },
      labels: ['Fictional transfer craft', 'Power branches and air reserve are invented game values', 'Grip boots stand in for free fall'],
      hint: !hints ? null
        : ship.connector === 'held' && choice ? 'One spare, two sockets. Navigation gives you the docking display. Ventilation brings the main fan back and saves air reserve.'
          : next === 'cockpit' ? 'Everything essential is done. The cockpit is at the far right.' : 'Walk to the glowing marker and press E.',
      distance: null, crosshair: false,
    });
  }, [phase, ship, tier, next, choice, hints]);

  useEffect(() => {
    if (phase !== 'ship' || powerRestored(ship)) { if (phase === 'ship') hud.warn(null); return; }
    hud.warn({ title: 'POWER LINE DOWN', text: 'Guidance display dark. Main air fan stopped. One spare connector aboard.', level: 'caution' });
  }, [phase, ship]);

  useEffect(() => {
    if (phase !== 'dock') return;
    const guided = !run.flags.nav;
    hud.warn(null);
    hud.set({
      objective: guided ? 'Guided approach: line up with the docking port and arrive slowly' : 'Guidance display online: line up with the docking port and arrive slowly',
      touch: 'flight', touchLabels: { primary: 'Close in', use: 'Use', brake: 'Brake' },
      labels: ['Fictional transfer craft and station', 'Distances and speeds are simplified'], prompt: null, distance: null,
    });
  }, [phase, run.flags.nav]);

  const onDockEnd = (s: DockState) => {
    hud.warn(null);
    if (s.status === 'aborted') { playCue('fail'); setAbort(s.abortReason || 'speed'); return; }
    if (finished.current) return;
    finished.current = true;
    playCue('complete');
    hud.say('Hatch open. We are docked. Good work, Cadet.');
    hud.set({ objective: 'Docked', hint: null, crosshair: false });
    const f = run.flags;
    const reserve = run.stats.reserve ?? 100;
    window.setTimeout(() => complete({
      crewStatus: `Docked with ${f.nav ? 'navigation' : 'ventilation'} restored, air reserve at ${Math.round(reserve)}%. The spare battery ${f.latched ? 'is latched for the Moon' : 'was left loose'}.`,
      consequence: `${f.nav
        ? `You gave the one spare connector to navigation, so the guidance display steadied the docking approach. The air ran on the backup loop, which cost ${100 - Math.round(reserve)}% of the reserve.`
        : 'You gave the one spare connector to ventilation, so the main fan came back and the air reserve was never touched. The guidance display stayed dark, so I talked you in on tighter limits.'
      } ${f.latched
        ? 'You latched the spare battery before docking. It will be on the rack when we reach the lunar outpost.'
        : 'The spare battery was not latched before docking. On the Moon it will still be strapped in the cargo crate, and digging it out will cost time.'
      }${s.attempts > 1 ? ` Docking took ${s.attempts} approaches.` : ''} The rings met at ${s.contactSpeed.toFixed(2)} m/s, and the hatch stayed shut until the leak check passed.`,
      objectives: [
        { label: 'Restore one power branch with the spare connector', done: true },
        { label: 'Keep the crew ventilation stable', done: true },
        { label: 'Latch the spare battery for the Moon', done: !!f.latched },
        { label: 'Dock with the station', done: true },
      ],
      stats: [
        { label: 'Branch restored', value: f.nav ? 'Navigation' : 'Ventilation' },
        { label: 'Air reserve left', value: `${Math.round(reserve)}%` },
        { label: 'Docking help', value: f.nav ? 'Guidance display' : 'Guided by Reyes' },
        { label: 'Docking approaches', value: String(s.attempts) },
        { label: 'Lunar battery', value: f.latched ? 'Latched' : 'Loose' },
      ],
      outpost: null,
      rating: rateShip(!!f.latched, s.attempts),
      carry: { batterySecured: !!f.latched, navFirst: !!f.nav },
    }), 2000);
  };

  if (phase === 'dock') {
    return (
      <>
        <GameCanvas key="dock" fov={55} far={6000} envIntensity={0.12} background="#000003">
          {/* With the guidance display restored the ship holds itself steadier. Without it the approach uses the tier's own limits. */}
          <DockingScene sim={dock} tier={run.flags.nav ? 'junior' : tier} onEnd={onDockEnd} />
        </GameCanvas>
        {abort && (
          <ResetCard
            title="Approach aborted" reason={ABORT_TEXT[abort].reason} tip={ABORT_TEXT[abort].tip} retryLabel="Hold at 25 metres and try again"
            onRetry={() => { dock.current = retryDock(dock.current); setAbort(null); }}
          />
        )}
      </>
    );
  }

  const marker = tier === 'junior' || hints ? SPOT[TASK_SPOT[next]] : null;
  return (
    <GameCanvas key="ship" fov={46} envIntensity={0.4} background="#04060b">
      <Deck ship={ship} />
      {marker && <ObjectiveMarker x={marker.x} z={marker.z} radius={0.8} />}
      <WalkerRig
        env={() => env} state={walker} interactables={interactables} onInteract={onInteract}
        carrying={ship.connector === 'held' || ship.battery === 'held'}
        carried={ship.battery === 'held' ? <BatteryPack /> : <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.1, 0.1, 0.24, 12]} /><meshStandardMaterial color="#ffc83d" /></mesh>}
        cameraOffset={[0, 6.4, 10.4]} lookHeight={0.6}
      />
    </GameCanvas>
  );
}
