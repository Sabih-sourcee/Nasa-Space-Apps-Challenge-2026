import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { crewPos, useCrew } from '../game/crewStore';
import { liveTasks, type CrewSession, type LiveTask } from '../sim/crew';
import { INCIDENT_BY_ID, ITEM_LABEL, ROOMS, VERTICAL_DOOR_COLS, type ItemId, type RoomId, type RoomSpec } from '../sim/crewData';
import { GRAVITY_PRESETS, makeWalker, type WalkEnv, type WalkerState } from '../sim/movement';
import { Astronaut, makeAnim } from '../three/Astronaut';
import { M, Sign } from '../three/Props';
import { ObjectiveMarker } from '../three/Scenery';
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

function Hull({ tasks, session }: { tasks: LiveTask[]; session: CrewSession }) {
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
      <ambientLight intensity={0.55} />
      <directionalLight position={[8, 20, 10]} intensity={1.4} />
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
            <Sign lines={[room.name.toUpperCase()]} position={[c.x, 2.3, c.z - CELL_D / 2 + 0.2]} size={[3.6, 0.5]} accent={room.color} />
            <pointLight position={[c.x, 3.2, c.z]} intensity={9} distance={9} color="#eef4ff" />
            {here.map((t, i) => {
              const p = stationSpot(room, i, here.length);
              const color = t.done ? '#35e07a' : t.available ? '#ffc83d' : '#5b6474';
              return (
                <group key={t.key} position={[p.x, 0, p.z - 0.9]}>
                  <mesh position={[0, 0.55, 0]} material={m.white} castShadow><boxGeometry args={[1.5, 1.1, 0.6]} /></mesh>
                  <mesh position={[0, 1.35, -0.05]} rotation={[-0.25, 0, 0]}><boxGeometry args={[1.2, 0.6, 0.06]} /><meshStandardMaterial color="#0d1826" emissive={color} emissiveIntensity={t.available && !t.done ? 1.4 : 0.5} /></mesh>
                  <mesh position={[0, 1.12, 0.26]}><boxGeometry args={[1.5, 0.05, 0.08]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} /></mesh>
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
      target.current.set(c.x - 3 + slot * 1.3, 0, c.z + 2.2);
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

export interface ShipUse { kind: 'task' | 'pickup' | 'deliver' | 'shift'; id: string }

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
    preset: GRAVITY_PRESETS.earth, ground: () => 0, circles: [], boxes: walls.boxes,
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
      if (room.id === 'bridge' && spec.shifts > 1) out.push({ id: 'shift', x: c.x + 3.6, z: c.z + 1.6, r: 1.3, label: 'Call the shift change', enabled: true, use: { kind: 'shift', id: 'shift' } });
    }
    return out;
  }, [tasks, st, held, session.incident, spec.shifts]);

  // The route marker points at the next open job for this cadet's station, or any open job.
  const next = tasks.find((t) => t.available && !t.done && !t.optional && t.spec.role === me?.role) ?? tasks.find((t) => t.available && !t.done && !t.optional);
  const marker = next ? spots.find((s) => s.id === `task:${next.key}`) : null;

  return (
    <>
      <Hull tasks={tasks} session={session} />
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
