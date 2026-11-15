import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { crewPos, useCrew } from '../game/crewStore';
import { liveTasks, type CrewSession, type LiveTask } from '../sim/crew';
import { INCIDENT_BY_ID, ITEM_LABEL, ROOMS, ROOM_BY_ID, VERTICAL_DOOR_COLS, type ItemId, type RoomId, type RoomSpec } from '../sim/crewData';
import { TOUR_SPOTS, type TourSpot } from '../sim/shipTour';
import { GRAVITY_PRESETS, makeWalker, type WalkEnv, type WalkerState } from '../sim/movement';
import { Astronaut, makeAnim } from '../three/Astronaut';
import { M, Sign } from '../three/Props';
import { EarthGlobe, ObjectiveMarker, Stars } from '../three/Scenery';
import { panelTexture } from '../three/textures';
import { WalkerRig, type Interactable } from '../three/WalkerRig';
import { BatteryPack } from './ShipMission';

// The Kestrel: five rooms across, three deep, the Galley in the middle.
export const CELL_W = 10;
export const CELL_D = 8;
const DOOR = 1.3;
const HALF_W = (5 * CELL_W) / 2;
const HALF_D = (3 * CELL_D) / 2;

export const roomCenter = (r: RoomSpec): { x: number; z: number } => ({ x: (r.col - 2) * CELL_W, z: (r.row - 1) * CELL_D });
export function roomAt(x: number, z: number): RoomId {
  const col = Math.max(0, Math.min(4, Math.floor((x + HALF_W) / CELL_W)));
  const row = Math.max(0, Math.min(2, Math.floor((z + HALF_D) / CELL_D)));
  return (ROOMS.find((r) => r.col === col && r.row === row) as RoomSpec).id;
}

/** Where each station of a room stands: along the back wall, left to right. */
function stationSpot(room: RoomSpec, index: number, count: number): { x: number; z: number } {
  const c = roomCenter(room);
  return { x: c.x + (index - (count - 1) / 2) * 2.7, z: c.z - 2.2 };
}

interface Walls { boxes: WalkEnv['boxes']; segs: { x: number; z: number; w: number; d: number }[] }

function buildWalls(): Walls {
  const segs: Walls['segs'] = [];
  const t = 0.3;
  // Walls between neighbours in a row: always a doorway in the middle.
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    const x = (col - 1.5) * CELL_W;
    const cz = (row - 1) * CELL_D;
    const len = (CELL_D - 2 * DOOR) / 2;
    segs.push({ x, z: cz - DOOR - len / 2, w: t, d: len }, { x, z: cz + DOOR + len / 2, w: t, d: len });
  }
  // Walls between rows: a doorway only in the columns that link the loops.
  for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
    const z = (row - 0.5) * CELL_D;
    const cx = (col - 2) * CELL_W;
    if (VERTICAL_DOOR_COLS.includes(col)) {
      const len = (CELL_W - 2 * DOOR) / 2;
      segs.push({ x: cx - DOOR - len / 2, z, w: len, d: t }, { x: cx + DOOR + len / 2, z, w: len, d: t });
    } else segs.push({ x: cx, z, w: CELL_W, d: t });
  }
  return { segs, boxes: segs.map((s) => ({ minX: s.x - s.w / 2, maxX: s.x + s.w / 2, minZ: s.z - s.d / 2, maxZ: s.z + s.d / 2, top: 3 })) };
}


// ---------------------------------------------------------------------------
// Big, readable lettering
// ---------------------------------------------------------------------------

const labelCache = new Map<string, THREE.CanvasTexture>();

/** Large lettering drawn to fill its plate, so it reads from the overhead camera. */
function plateTexture(text: string, color: string, dark = true): THREE.CanvasTexture {
  const key = `${text}|${color}|${dark}`;
  const hit = labelCache.get(key);
  if (hit) return hit;
  const w = 1024;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  if (dark) { ctx.fillStyle = '#081430'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = color; ctx.fillRect(0, 0, w, 22); ctx.fillRect(0, h - 22, w, 22); }
  ctx.fillStyle = dark ? '#ffffff' : color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = 150;
  do { ctx.font = `900 ${size}px "Exo 2 Variable", Arial, sans-serif`; size -= 6; } while (ctx.measureText(text).width > w - 70 && size > 40);
  ctx.fillText(text, w / 2, h / 2 + 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  labelCache.set(key, tex);
  return tex;
}

function Plate({ text, color, position, rotation = [0, 0, 0], width, dark = true }: { text: string; color: string; position: [number, number, number]; rotation?: [number, number, number]; width: number; dark?: boolean }) {
  const tex = useMemo(() => plateTexture(text, color, dark), [text, color, dark]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, width / 4]} />
      <meshBasicMaterial map={tex} transparent={!dark} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Equipment: every piece is a tour stop that can be clicked
// ---------------------------------------------------------------------------

const SHAPE: Record<string, string> = {
  pilot_seat: 'seat', readiness_board: 'screen', chart_table: 'table', burn_planner: 'screen', dish: 'dish', telemetry: 'screen',
  dome: 'dome', orbit_display: 'screen', suit_rack: 'suits', hatch: 'hatch', battery_wall: 'batteries', bus: 'panel',
  scrubber: 'machine', fans: 'fan', table: 'table', warmer: 'machine', tanks: 'tanks', recycler: 'pipes', crates: 'crates', manifest: 'screen',
  thrusters: 'bells', fuel_valves: 'pipes', coolant: 'pipes', radiator: 'panel', grow_trays: 'trays', grow_lights: 'lamp',
  med_dummy: 'bed', med_kit: 'crates', shelter_walls: 'wall', shelter_supplies: 'crates',
};

function Gear({ shape, color }: { shape: string; color: string }) {
  const m = M();
  const glow = (c: string, i = 1.4) => <meshStandardMaterial color={c} emissive={c} emissiveIntensity={i} />;
  switch (shape) {
    case 'seat': return (<><mesh position={[0, 0.35, 0]} material={m.navy} castShadow><boxGeometry args={[0.8, 0.3, 0.8]} /></mesh><mesh position={[0, 0.9, -0.35]} material={m.navy} castShadow><boxGeometry args={[0.8, 1.0, 0.18]} /></mesh><mesh position={[0.55, 0.7, 0.2]} material={m.darkSteel}><cylinderGeometry args={[0.05, 0.05, 0.5, 8]} /></mesh><mesh position={[0.55, 0.98, 0.2]}><sphereGeometry args={[0.1, 10, 8]} />{glow('#ff5a4d', 0.6)}</mesh></>);
    case 'screen': return (<><mesh position={[0, 0.5, 0]} material={m.darkSteel} castShadow><boxGeometry args={[1.3, 1.0, 0.4]} /></mesh><mesh position={[0, 1.35, 0]} rotation={[-0.5, 0, 0]}><boxGeometry args={[1.3, 0.75, 0.06]} />{glow(color, 0.9)}</mesh></>);
    case 'table': return (<><mesh position={[0, 0.75, 0]} material={m.white} castShadow><boxGeometry args={[2.4, 0.1, 1.1]} /></mesh>{[[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]].map(([x, z], i) => <mesh key={i} position={[x, 0.37, z]} material={m.steel}><cylinderGeometry args={[0.05, 0.05, 0.74, 8]} /></mesh>)}<mesh position={[0, 0.82, 0]}><boxGeometry args={[1.6, 0.03, 0.7]} />{glow(color, 0.7)}</mesh></>);
    case 'dish': return (<><mesh position={[0, 0.9, 0]} material={m.steel} castShadow><cylinderGeometry args={[0.09, 0.14, 1.8, 10]} /></mesh><mesh position={[0, 1.9, 0]} rotation={[0.9, 0, 0]} material={m.white} castShadow><sphereGeometry args={[0.9, 20, 10, 0, Math.PI * 2, 0, 0.9]} /></mesh><mesh position={[0, 2.2, 0.35]}><sphereGeometry args={[0.09, 8, 8]} />{glow('#ff5a4d')}</mesh></>);
    case 'dome': return (<><mesh position={[0, 0.2, 0]} material={m.steel}><cylinderGeometry args={[1.2, 1.3, 0.4, 24]} /></mesh><mesh position={[0, 0.4, 0]}><sphereGeometry args={[1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#9fe0ff" transparent opacity={0.28} roughness={0.05} metalness={0.2} /></mesh><mesh position={[0.2, 0.9, 0]} rotation={[0.4, 0.5, 0.8]} material={m.steel}><boxGeometry args={[0.36, 0.07, 0.07]} /></mesh></>);
    case 'suits': return (<>{[-0.5, 0.5].map((x) => <group key={x} position={[x, 0, 0]}><mesh position={[0, 0.95, 0]} material={m.white} castShadow><capsuleGeometry args={[0.28, 0.9, 6, 12]} /></mesh><mesh position={[0, 1.85, 0]} material={m.white}><sphereGeometry args={[0.3, 14, 10]} /></mesh><mesh position={[0, 1.85, 0.2]}><sphereGeometry args={[0.2, 12, 8]} /><meshStandardMaterial color="#c9952f" metalness={0.9} roughness={0.2} /></mesh></group>)}<mesh position={[0, 1.2, -0.35]} material={m.darkSteel}><boxGeometry args={[1.7, 2.3, 0.1]} /></mesh></>);
    case 'hatch': return (<><mesh position={[0, 1.1, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.darkSteel} castShadow><cylinderGeometry args={[1.0, 1.0, 0.3, 28]} /></mesh><mesh position={[0, 1.1, 0.17]} material={m.yellow}><torusGeometry args={[0.42, 0.06, 8, 24]} /></mesh><mesh position={[0, 1.1, 0.16]} material={m.steel}><boxGeometry args={[0.9, 0.08, 0.05]} /></mesh></>);
    case 'batteries': return (<><mesh position={[0, 1.0, -0.2]} material={m.darkSteel} castShadow><boxGeometry args={[2.0, 2.0, 0.3]} /></mesh>{[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} position={[-0.6 + (i % 3) * 0.6, 0.6 + Math.floor(i / 3) * 0.8, 0]}><boxGeometry args={[0.4, 0.55, 0.14]} />{glow(i === 5 ? '#3a4558' : '#35e07a', i === 5 ? 0.1 : 1.3)}</mesh>)}</>);
    case 'panel': return (<><mesh position={[0, 1.0, 0]} material={m.steel} castShadow><boxGeometry args={[1.6, 2.0, 0.25]} /></mesh>{[0, 1, 2].map((i) => <mesh key={i} position={[-0.45 + i * 0.45, 1.4, 0.14]}><boxGeometry args={[0.28, 0.5, 0.05]} />{glow(i === 1 ? '#ffb020' : color, 1.1)}</mesh>)}<mesh position={[0, 0.6, 0.14]} material={m.yellow}><boxGeometry args={[1.2, 0.12, 0.05]} /></mesh></>);
    case 'machine': return (<><mesh position={[0, 0.8, 0]} material={m.white} castShadow><boxGeometry args={[1.2, 1.6, 0.9]} /></mesh><mesh position={[0, 1.2, 0.46]}><boxGeometry args={[0.8, 0.3, 0.04]} />{glow(color, 1.1)}</mesh><mesh position={[0, 0.5, 0.46]} material={m.black}><boxGeometry args={[0.9, 0.5, 0.04]} /></mesh></>);
    case 'fan': return (<><mesh position={[0, 1.1, 0]} material={m.white} castShadow><boxGeometry args={[1.6, 2.2, 0.5]} /></mesh>{[0.6, 1.6].map((y) => <group key={y} position={[0, y, 0.27]}><mesh material={m.black}><circleGeometry args={[0.42, 20]} /></mesh>{[0, 1, 2].map((i) => <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]} position={[0, 0, 0.02]} material={m.steel}><boxGeometry args={[0.76, 0.1, 0.02]} /></mesh>)}</group>)}</>);
    case 'tanks': return (<>{['#4de3ff', '#8a6a3a', '#35e07a'].map((c, i) => <group key={c} position={[-0.8 + i * 0.8, 0, 0]}><mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.32, 0.32, 1.8, 18]} /><meshStandardMaterial color="#cfe8ff" transparent opacity={0.3} roughness={0.1} /></mesh><mesh position={[0, 0.2 + (0.5 + i * 0.2) / 1, 0]}><cylinderGeometry args={[0.28, 0.28, 0.9 + i * 0.3, 18]} /><meshStandardMaterial color={c} transparent opacity={0.75} /></mesh><mesh position={[0, 1.84, 0]} material={m.steel}><cylinderGeometry args={[0.34, 0.34, 0.08, 18]} /></mesh></group>)}</>);
    case 'pipes': return (<>{['#ff5a4d', '#4de3ff', '#c9d2e0'].map((c, i) => <mesh key={c} position={[0, 0.5 + i * 0.5, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.1, 0.1, 2.2, 12]} /><meshStandardMaterial color={c} metalness={0.5} roughness={0.35} /></mesh>)}{[-0.7, 0.7].map((x) => <mesh key={x} position={[x, 1.0, 0.16]} rotation={[Math.PI / 2, 0, 0]} material={m.yellow}><torusGeometry args={[0.16, 0.035, 8, 16]} /></mesh>)}<mesh position={[0, 0.9, -0.2]} material={m.darkSteel}><boxGeometry args={[2.3, 1.9, 0.1]} /></mesh></>);
    case 'crates': return (<>{[[-0.5, 0.35, 0, 0.9], [0.5, 0.35, 0.1, 0.8], [0, 1.0, 0, 0.7]].map(([x, y, z, sz], i) => <group key={i} position={[x, y, z]}><mesh material={m.white} castShadow><boxGeometry args={[sz, 0.66, sz]} /></mesh><mesh position={[0, 0, sz / 2 + 0.01]}><boxGeometry args={[sz, 0.12, 0.02]} />{glow(['#4d7dff', '#ff5a4d', '#35e07a'][i], 0.6)}</mesh></group>)}</>);
    case 'bells': return (<>{[-0.7, 0.7].map((x) => <group key={x} position={[x, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}><mesh material={m.darkSteel} castShadow><cylinderGeometry args={[0.2, 0.55, 1.1, 20, 1, true]} /></mesh><mesh position={[0, -0.5, 0]}><circleGeometry args={[0.5, 20]} />{glow('#ff8a3c', 0.5)}</mesh></group>)}<mesh position={[0, 0.9, -0.5]} material={m.steel}><boxGeometry args={[2.2, 1.4, 0.2]} /></mesh></>);
    case 'trays': return (<>{[0.6, 1.3].map((y) => <group key={y} position={[0, y, 0]}><mesh material={m.darkSteel}><boxGeometry args={[2.0, 0.1, 0.7]} /></mesh>{[-0.7, -0.35, 0, 0.35, 0.7].map((x) => <mesh key={x} position={[x, 0.18, 0]} scale={[1, 1.3, 1]}><sphereGeometry args={[0.13, 8, 6]} /><meshStandardMaterial color="#3fa34d" roughness={0.8} /></mesh>)}</group>)}{[-0.95, 0.95].map((x) => <mesh key={x} position={[x, 0.9, 0]} material={m.steel}><boxGeometry args={[0.06, 1.8, 0.06]} /></mesh>)}</>);
    case 'lamp': return (<><mesh position={[0, 1.9, 0]}><boxGeometry args={[1.8, 0.08, 0.6]} />{glow('#ff4fd0', 2.2)}</mesh>{[-0.85, 0.85].map((x) => <mesh key={x} position={[x, 0.95, 0]} material={m.steel}><boxGeometry args={[0.06, 1.9, 0.06]} /></mesh>)}<pointLight position={[0, 1.6, 0]} intensity={4} distance={4} color="#ff6ad5" /></>);
    case 'bed': return (<><mesh position={[0, 0.55, 0]} material={m.white} castShadow><boxGeometry args={[0.9, 0.2, 2.0]} /></mesh><mesh position={[0, 0.28, 0]} material={m.steel}><boxGeometry args={[0.8, 0.5, 1.8]} /></mesh><mesh position={[0, 0.8, 0.1]} rotation={[Math.PI / 2, 0, 0]} material={m.fabric}><capsuleGeometry args={[0.2, 1.0, 6, 10]} /></mesh><mesh position={[0, 0.82, -0.75]} material={m.fabric}><sphereGeometry args={[0.2, 12, 10]} /></mesh><mesh position={[0.75, 1.2, -0.6]}><boxGeometry args={[0.5, 0.4, 0.06]} />{glow('#35e07a', 1)}</mesh></>);
    case 'wall': return (<><mesh position={[0, 0.9, 0]} material={m.navy} castShadow><boxGeometry args={[2.4, 1.8, 0.7]} /></mesh>{[-0.7, 0, 0.7].map((x) => <mesh key={x} position={[x, 0.5, 0.42]} material={m.white}><boxGeometry args={[0.55, 0.8, 0.14]} /></mesh>)}</>);
    default: return <mesh position={[0, 0.5, 0]} material={m.white}><boxGeometry args={[1, 1, 1]} /></mesh>;
  }
}

function TourStop({ spot, color, beacon, onPick }: { spot: TourSpot; color: string; beacon: boolean; onPick: (id: string) => void }) {
  const room = ROOM_BY_ID[spot.room];
  const c = roomCenter(room);
  return (
    <group
      position={[c.x + spot.dx, 0, c.z + spot.dz]}
      onClick={(e) => { e.stopPropagation(); onPick(spot.id); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      <group scale={0.82}><Gear shape={SHAPE[spot.id] ?? 'box'} color={color} /></group>
      {beacon && (
        <group position={[0, 2.5, 0]}>
          <mesh><sphereGeometry args={[0.24, 16, 12]} /><meshStandardMaterial color="#5fe3ff" emissive="#5fe3ff" emissiveIntensity={2} /></mesh>
          <Plate text="i" color="#04122b" position={[0, 0, 0.26]} width={1.2} dark={false} />
        </group>
      )}
    </group>
  );
}

function ItemProp({ item }: { item: ItemId }) {
  const m = M();
  if (item === 'battery') return <BatteryPack />;
  const color = item === 'filter' ? '#35e07a' : item === 'cartridge' ? '#4de3ff' : item === 'meal_crate' ? '#4d7dff' : '#ffc83d';
  return (
    <group>
      <mesh material={m.white} castShadow><boxGeometry args={[0.5, 0.36, 0.4]} /></mesh>
      <mesh position={[0, 0, 0.21]}><boxGeometry args={[0.5, 0.1, 0.02]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} /></mesh>
    </group>
  );
}

function Hull({ tasks, session, onPick }: { tasks: LiveTask[]; session: CrewSession; onPick: (id: string) => void }) {
  const m = M();
  const walls = useMemo(buildWalls, []);
  const floor = useMemo(() => {
    const t = panelTexture('#8e97a1', '#626a73', 'shipfloor').clone();
    t.needsUpdate = true; t.repeat.set(2, 2);
    return t;
  }, []);
  const st = session.state;
  return (
    <group>
      {/* The Kestrel is in orbit: stars around it and the planet turning far below */}
      <Stars />
      <EarthGlobe position={[0, -1180, -260]} radius={1100} spin={0.004} below />
      <ambientLight intensity={0.5} />
      <directionalLight position={[8, 20, 10]} intensity={1.5} castShadow />
      {ROOMS.map((room) => {
        const c = roomCenter(room);
        const here = tasks.filter((t) => t.spec.room === room.id);
        const items = st ? (Object.entries(st.items) as [ItemId, { at: string }][]).filter(([, it]) => it.at === room.id) : [];
        return (
          <group key={room.id}>
            <mesh position={[c.x, -0.1, c.z]} receiveShadow>
              <boxGeometry args={[CELL_W - 0.1, 0.2, CELL_D - 0.1]} />
              <meshStandardMaterial map={floor} color={new THREE.Color(room.color).lerp(new THREE.Color('#ffffff'), 0.62)} roughness={0.85} />
            </mesh>
            {/* A coloured stripe and a sign give each room its own look from above */}
            <mesh position={[c.x, 0.012, c.z + CELL_D / 2 - 0.5]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[CELL_W - 1.2, 0.35]} /><meshBasicMaterial color={room.color} /></mesh>
            {/* The room name is painted large on the floor, where the overhead camera reads it best */}
            <Plate text={room.name.toUpperCase()} color="#ffffff" dark={false} position={[c.x, 0.02, c.z + 0.2]} rotation={[-Math.PI / 2, 0, 0]} width={7.6} />
            {TOUR_SPOTS.filter((s) => s.room === room.id).map((s) => <TourStop key={s.id} spot={s} color={room.color} beacon={session.incident === 'tour'} onPick={onPick} />)}
            <pointLight position={[c.x, 3.2, c.z]} intensity={9} distance={9} color="#eef4ff" />
            {here.map((t, i) => {
              const p = stationSpot(room, i, here.length);
              const color = t.done ? '#35e07a' : t.available ? '#ffc83d' : '#5b6474';
              return (
                <group key={t.key} position={[p.x, 0, p.z - 0.9]}>
                  <mesh position={[0, 0.55, 0]} material={m.white} castShadow><boxGeometry args={[1.5, 1.1, 0.6]} /></mesh>
                  <mesh position={[0, 1.35, -0.05]} rotation={[-0.25, 0, 0]}><boxGeometry args={[1.2, 0.6, 0.06]} /><meshStandardMaterial color="#0d1826" emissive={color} emissiveIntensity={t.available && !t.done ? 1.4 : 0.5} /></mesh>
                  <mesh position={[0, 1.12, 0.26]}><boxGeometry args={[1.5, 0.05, 0.08]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} /></mesh>
                  <Plate text={t.spec.title} color={color} position={[0, 2.15, 0]} rotation={[-0.45, 0, 0]} width={2.9} />
                </group>
              );
            })}
            {items.map(([item], i) => <group key={item} position={[c.x + 3.2, 0.2, c.z + 1.4 - i * 1.1]}><ItemProp item={item} /></group>)}
          </group>
        );
      })}
      {walls.segs.map((s, i) => <mesh key={i} position={[s.x, 0.55, s.z]} material={m.navy} castShadow><boxGeometry args={[s.w, 1.1, s.d]} /></mesh>)}
      {/* Outer hull */}
      {[[0, -HALF_D - 0.2, 2 * HALF_W + 0.8, 0.4], [0, HALF_D + 0.2, 2 * HALF_W + 0.8, 0.4], [-HALF_W - 0.2, 0, 0.4, 2 * HALF_D], [HALF_W + 0.2, 0, 0.4, 2 * HALF_D]].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.7, z]} material={m.steel}><boxGeometry args={[w, 1.4, d]} /></mesh>
      ))}
    </group>
  );
}

/** Another cadet, or a scripted crew member, drawn where the mission service says they are. */
function Crewmate({ id, name, carrying, slot }: { id: string; name: string; carrying: ItemId | null; slot: number }) {
  const group = useRef<THREE.Group>(null);
  const anim = useRef(makeAnim('walk'));
  const target = useRef(new THREE.Vector3());
  useFrame((_, delta) => {
    const m = useCrew.getState().session?.members.find((x) => x.id === id);
    if (!m || !group.current) return;
    if (m.bot || (m.x === 0 && m.z === 0)) {
      // Scripted crew stand at the station they last worked at.
      const c = roomCenter(ROOMS.find((r) => r.id === m.room) as RoomSpec);
      target.current.set(c.x - 3.4 + slot * 1.5, 0, c.z + 3.3);
    } else target.current.set(m.x, 0, m.z);
    const before = group.current.position.clone();
    group.current.position.lerp(target.current, 1 - Math.exp(-6 * Math.min(delta, 0.1)));
    const moved = group.current.position.clone().sub(before);
    anim.current.speed = Math.min(1, moved.length() / Math.max(delta, 0.001) / 3);
    anim.current.carry = !!carrying;
    if (moved.lengthSq() > 1e-6) group.current.rotation.y = Math.atan2(moved.x, moved.z);
  });
  return (
    <Astronaut ref={group} anim={anim} chestLight="amber">
      <Sign lines={[name.replace(' (scripted)', '')]} position={[0, 2.25, 0]} size={[1.9, 0.32]} />
      {carrying && <group position={[0, 1.12, 0.42]}><ItemProp item={carrying} /></group>}
    </Astronaut>
  );
}

export interface ShipUse { kind: 'task' | 'pickup' | 'deliver' | 'shift' | 'info'; id: string }

/** The walkable ship. Stations, items and the other crew all come from the shared mission state. */
export function CrewShipScene({ onUse, frozen }: { onUse: (use: ShipUse) => void; frozen: boolean }) {
  const session = useCrew((s) => s.session) as CrewSession;
  const memberId = useCrew((s) => s.memberId);
  const walls = useMemo(buildWalls, []);
  const start = useMemo(() => {
    const me = session.members.find((m) => m.id === memberId);
    const first = session.state ? liveTasks(session.state).find((t) => t.available && !t.done && t.spec.role === me?.role) : undefined;
    const room = ROOMS.find((r) => r.id === (first?.spec.room ?? 'galley')) as RoomSpec;
    const c = roomCenter(room);
    return makeWalker(c.x, c.z + 1.5, Math.PI);
    // Only where the cadet is first put down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const walker = useRef<WalkerState>(start);
  const env = useMemo<WalkEnv>(() => ({
    preset: GRAVITY_PRESETS.earth, ground: () => 0, boxes: walls.boxes,
    // Equipment is solid: you walk round it, not through it.
    circles: TOUR_SPOTS.map((sp) => { const c = roomCenter(ROOM_BY_ID[sp.room]); return { x: c.x + sp.dx, z: c.z + sp.dz, r: 0.75 }; }),
    bounds: { minX: -HALF_W + 0.5, maxX: HALF_W - 0.5, minZ: -HALF_D + 0.5, maxZ: HALF_D - 0.5 }, radius: 0.4,
  }), [walls]);

  const st = session.state;
  const tasks = useMemo(() => (st ? liveTasks(st) : []), [st]);
  const me = session.members.find((m) => m.id === memberId);
  const held = st ? ((Object.entries(st.items) as [ItemId, { holder: string | null }][]).find(([, it]) => it.holder === memberId)?.[0] ?? null) : null;
  const spec = INCIDENT_BY_ID[session.incident];

  const spots = useMemo(() => {
    const out: (Interactable & { use: ShipUse })[] = [];
    for (const room of ROOMS) {
      const here = tasks.filter((t) => t.spec.room === room.id);
      here.forEach((t, i) => {
        const p = stationSpot(room, i, here.length);
        const open = t.available && (!t.done || session.incident === 'tour');
        out.push({ id: `task:${t.key}`, x: p.x, z: p.z, r: 1.25, label: t.done && session.incident !== 'tour' ? `${t.spec.title} (done)` : t.spec.title, enabled: open, use: { kind: 'task', id: t.key } });
      });
      const c = roomCenter(room);
      if (st) (Object.entries(st.items) as [ItemId, { at: string }][]).filter(([, it]) => it.at === room.id).forEach(([item], i) => {
        out.push({ id: `item:${item}`, x: c.x + 2.4, z: c.z + 1.4 - i * 1.1, r: 1.2, label: `Pick up the ${ITEM_LABEL[item]}`, enabled: !held, use: { kind: 'pickup', id: item } });
      });
      const wants = (held === 'meal_crate' && room.id === 'galley') || (held === 'cartridge' && room.id === 'water');
      if (wants && held) out.push({ id: `deliver:${room.id}`, x: c.x, z: c.z + 0.6, r: 2.2, label: `Hand over the ${ITEM_LABEL[held]}`, enabled: true, use: { kind: 'deliver', id: room.id } });
      // On the tour every piece of equipment can also be walked up to and looked at.
      if (session.incident === 'tour') for (const sp of TOUR_SPOTS.filter((x) => x.room === room.id)) out.push({ id: `info:${sp.id}`, x: c.x + sp.dx, z: c.z + sp.dz - 1.2, r: 1.2, label: `Look at the ${sp.name.toLowerCase()}`, enabled: true, use: { kind: 'info', id: sp.id } });
      if (room.id === 'bridge' && spec.shifts > 1) out.push({ id: 'shift', x: c.x + 3.6, z: c.z + 1.6, r: 1.3, label: 'Call the shift change', enabled: true, use: { kind: 'shift', id: 'shift' } });
    }
    return out;
  }, [tasks, st, held, session.incident, spec.shifts]);

  // The route marker points at the next open job for this cadet's station, or any open job.
  const next = tasks.find((t) => t.available && !t.done && !t.optional && t.spec.role === me?.role) ?? tasks.find((t) => t.available && !t.done && !t.optional);
  const marker = next ? spots.find((s) => s.id === `task:${next.key}`) : null;

  return (
    <>
      <Hull tasks={tasks} session={session} onPick={(id) => onUse({ kind: 'info', id })} />
      {marker && <ObjectiveMarker x={marker.x} z={marker.z} radius={0.8} />}
      {session.members.filter((m) => m.id !== memberId && m.connected).map((m, i) => (
        <Crewmate key={m.id} slot={i} id={m.id} name={m.name} carrying={st ? ((Object.entries(st.items) as [ItemId, { holder: string | null }][]).find(([, it]) => it.holder === m.id)?.[0] ?? null) : null} />
      ))}
      <WalkerRig
        env={() => env} state={walker} frozen={frozen}
        interactables={() => spots}
        onInteract={(id) => { const s = spots.find((x) => x.id === id); if (s) onUse(s.use); }}
        onStep={(w) => { crewPos.x = Math.round(w.x * 10) / 10; crewPos.z = Math.round(w.z * 10) / 10; crewPos.room = roomAt(w.x, w.z); }}
        carrying={!!held} carried={held ? <ItemProp item={held} /> : undefined}
        cameraOffset={[0, 12.5, 9.5]} lookHeight={0.4}
      />
    </>
  );
}
