import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { playCue } from '../game/audio';
import { hud } from '../game/hud';
import { useGame } from '../game/store';
import { RESTRAINTS, SUPPLIES, allLoaded, cargoChecklist, load, makeCargo, nextSupply, pickUp, secureLabel, secureStep, secured, type CargoState, type SupplyId } from '../sim/cargo';
import { GRAVITY_PRESETS, idealAirtime, makeWalker, type GravityId, type WalkEnv, type WalkerState } from '../sim/movement';
import { hintsOn } from '../sim/save';
import { rateSuitLab } from '../sim/score';
import type { Tier } from '../sim/types';
import { Astronaut, makeAnim } from '../three/Astronaut';
import { GameCanvas, SunLight, useReducedMotion } from '../three/GameCanvas';
import { LaunchTower, M, Pouch, ShuttleStack, Sign, Strut } from '../three/Props';
import { ObjectiveMarker, SkyDome } from '../three/Scenery';
import { groundTexture } from '../three/textures';
import { WalkerRig, type Interactable } from '../three/WalkerRig';
import { Btn, Comm, Dialog } from '../ui/common';
import { Icon } from '../ui/icons';

const SUN: [number, number, number] = [0.45, 0.85, 0.5];
const EMPTY_CARGO = makeCargo();

/** Launch-site environment shared by the home screen and the Earth mission. */
/** `bare` leaves the rocket and tower off the pad, for the launch film, which flies its own. */
export function EarthWorld({ follow, bare = false }: { follow?: React.MutableRefObject<{ x: number; y?: number; z: number }>; bare?: boolean }) {
  const m = M();
  const concrete = useMemo(() => {
    const t = groundTexture('concrete').clone();
    t.needsUpdate = true;
    t.repeat.set(30, 30);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 });
  }, []);
  const field = useMemo(() => {
    const t = groundTexture('field').clone();
    t.needsUpdate = true;
    t.repeat.set(120, 120);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
  }, []);
  return (
    <>
      <SkyDome top="#2f6fc0" horizon="#cfe2f3" />
      <fog attach="fog" args={['#cfe2f3', 180, 900]} />
      <hemisphereLight args={['#cfe4ff', '#7b735f', 1.15]} />
      <SunLight direction={SUN} intensity={3.4} color="#fff1dc" follow={follow} size={26} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} material={field} receiveShadow><planeGeometry args={[1800, 1800]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={concrete} receiveShadow><planeGeometry args={[150, 150]} /></mesh>
      {/* Crawlerway toward the pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[40, 0.01, -120]} material={concrete} receiveShadow><planeGeometry args={[26, 120]} /></mesh>
      <group position={[40, 0, -190]}>
        <mesh position={[0, 1.5, 0]} material={m.darkSteel} receiveShadow castShadow><boxGeometry args={[30, 3, 30]} /></mesh>
        {!bare && <group position={[0, 3, 0]}><ShuttleStack /></group>}
        {!bare && <group position={[-11, 3, 0]}><LaunchTower /></group>}
      </group>
      {/* Assembly building and hangars on the horizon */}
      <mesh position={[-150, 40, -330]} material={m.white}><boxGeometry args={[90, 80, 70]} /></mesh>
      <mesh position={[-150, 40, -294.8]} material={m.navy}><planeGeometry args={[30, 70]} /></mesh>
      <mesh position={[-60, 9, -300]} material={m.white}><boxGeometry args={[60, 18, 40]} /></mesh>
      <mesh position={[170, 7, -260]} material={m.white}><boxGeometry args={[70, 14, 30]} /></mesh>
      {[-70, -40, 90, 120].map((x) => <Strut key={x} a={[x, 0, -240]} b={[x, 46, -240]} r={0.35} />)}
    </>
  );
}

/** Static astronaut for the home screen. */
export function HomeScene() {
  const anim = useRef(makeAnim('walk'));
  const focus = useRef({ x: 30.8, y: 0, z: -113.4 });
  const body = useRef<THREE.Group>(null);
  const vapour = useRef<THREE.Group>(null);
  const reduced = useReducedMotion();
  const mouse = useRef({ x: 0, y: 0 });
  const eased = useRef({ x: 0, y: 0 });
  // The menu sits over the canvas, so the pointer is read from the window.
  useEffect(() => {
    const onMove = (e: PointerEvent) => { mouse.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 }; };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  useFrame(({ camera, clock }, delta) => {
    const k = 1 - Math.exp(-3 * Math.min(delta, 0.1));
    eased.current.x += (mouse.current.x - eased.current.x) * k;
    eased.current.y += (mouse.current.y - eased.current.y) * k;
    // Moving the mouse leans the view, and the astronaut turns to follow it.
    camera.position.set(27.5 + eased.current.x * 1.6, 1.6 - eased.current.y * 0.5, -105);
    camera.lookAt(30 + eased.current.x * 5, 13.5 - eased.current.y * 3, -190);
    if (body.current) body.current.rotation.y = -0.37 + eased.current.x * 0.9;
    // Vapour drifts slowly off the pad. With reduced motion it holds still.
    const t = clock.elapsedTime;
    vapour.current?.children.forEach((p, i) => {
      const k = reduced ? 0.5 : (t * 0.05 + i * 0.137) % 1;
      const side = i % 2 ? 1 : -1;
      p.position.set(40 + side * (7 + k * 26) + Math.sin(i * 2.1) * 4, 4.5 + k * 5 + (i % 3) * 1.6, -190 + Math.cos(i * 1.7) * 9);
      p.scale.setScalar(4.5 + k * 9);
      ((p as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k);
    });
  });
  return (
    <>
      <EarthWorld follow={focus} />
      <group ref={vapour}>
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i}><sphereGeometry args={[1, 12, 10]} /><meshBasicMaterial color={i % 2 ? '#f3efe8' : '#e2ddd4'} transparent opacity={0.4} depthWrite={false} /></mesh>
        ))}
      </group>
      <group ref={body} position={[30.8, 0, -113.4]} rotation={[0, -0.37, 0]}>
        <Astronaut anim={anim} still />
      </group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Suit preflight check
// ---------------------------------------------------------------------------

interface Check { id: string; label: string; reading: string; fixedReading: string; nominal: string; faulty: boolean; fixes: { label: string; right: boolean; why: string }[] }

function suitChecks(tier: Tier): Check[] {
  return [
    { id: 'helmet', label: 'Helmet lock ring', reading: 'LOCKED', fixedReading: 'LOCKED', nominal: 'LOCKED', faulty: false, fixes: [] },
    { id: 'oxygen', label: 'Oxygen supply', reading: '100%', fixedReading: '100%', nominal: 'above 90%', faulty: false, fixes: [] },
    {
      id: 'radio', label: 'Radio', faulty: tier === 'advanced',
      reading: tier === 'advanced' ? 'Channel 2: static' : 'Channel 1: loud and clear',
      fixedReading: 'Channel 1: loud and clear', nominal: 'Channel 1: clear voice',
      fixes: [
        { label: 'Switch back to channel 1', right: true, why: '' },
        { label: 'Turn the volume up', right: false, why: 'Louder static is still static. The radio is on the wrong channel.' },
        { label: 'Re-pressurize the suit', right: false, why: 'Suit pressure has nothing to do with the radio channel.' },
      ],
    },
    {
      id: 'pressure', label: 'Suit pressure', reading: '3.1 psi', fixedReading: '4.3 psi', nominal: '4.2 to 4.4 psi', faulty: true,
      fixes: [
        { label: 'Reseat the left glove ring, then re-pressurize', right: true, why: '' },
        { label: 'Open the helmet visor', right: false, why: 'Opening the visor lets more air out. The leak is at the glowing glove ring.' },
        { label: 'Top up the oxygen tank', right: false, why: 'The tank is already full. Air is escaping, so the leak must be sealed first.' },
      ],
    },
  ];
}

type CheckState = 'unseen' | 'seen' | 'ok' | 'reported' | 'fixed';

function SuitCheckPanel({ tier, state, setState, onClose, onCleared, onMistake }: {
  tier: Tier; state: Record<string, CheckState>; setState: (s: Record<string, CheckState>) => void;
  onClose: () => void; onCleared: () => void; onMistake: () => void;
}) {
  const settings = useGame((s) => s.save.settings);
  const hints = hintsOn(settings, tier);
  const checks = useMemo(() => suitChecks(tier), [tier]);
  const [note, setNote] = useState<string | null>(null);
  const [card, setCard] = useState(tier !== 'advanced');
  const set = (id: string, v: CheckState) => setState({ ...state, [id]: v });

  const allJudged = checks.every((c) => state[c.id] === 'ok' || state[c.id] === 'fixed');
  const openFault = checks.find((c) => state[c.id] === 'reported');
  const blocked = openFault ? `Clearance blocked: ${openFault.label.toLowerCase()} fault is not fixed.`
    : !allJudged ? 'Clearance blocked: every item must be inspected and judged first.' : null;

  const judge = (c: Check, verdict: 'ok' | 'fault') => {
    if (verdict === 'ok' && c.faulty) {
      setNote(`Look again. ${c.label} reads ${c.reading}, and the safe range is ${c.nominal}. Clearance is blocked until this is dealt with.`);
      playCue('caution'); onMistake(); return;
    }
    if (verdict === 'fault' && !c.faulty) {
      setNote(`${c.label} reads ${c.reading}. That is inside the safe range (${c.nominal}), so it is not a fault.`);
      playCue('caution'); onMistake(); return;
    }
    setNote(verdict === 'fault' ? `Fault reported: ${c.label}. Now choose how to fix it.` : null);
    playCue(verdict === 'fault' ? 'caution' : 'ok');
    set(c.id, verdict === 'ok' ? 'ok' : 'reported');
  };

  const fix = (c: Check, f: Check['fixes'][number]) => {
    if (!f.right) { setNote(f.why); playCue('caution'); onMistake(); return; }
    setNote(`${c.label} fixed. It now reads ${c.fixedReading}.`);
    playCue('ok');
    set(c.id, 'fixed');
  };

  const judged = checks.filter((c) => state[c.id] === 'ok' || state[c.id] === 'fixed').length;
  return (
    <Dialog title="Suit preflight check" icon="helmet" kicker={`${judged} of ${checks.length} items cleared`} onClose={onClose} wide>
      <p className="lead">Inspect each item, compare it with the safe range, and decide: good, or a fault to report.</p>
      {tier === 'advanced' && <div className="row"><Btn kind="ghost" size="sm" icon="book" onClick={() => setCard(!card)}>{card ? 'Close reference card' : 'Open reference card'}</Btn></div>}
      <ul className="suit-grid">
        {checks.map((c) => {
          const st = state[c.id] ?? 'unseen';
          return (
            <li key={c.id} className={`suit-card ${st}`}>
              <div className="suit-head">
                <span className="suit-icon"><Icon name={CHECK_ICON[c.id] ?? 'gauge'} size={22} /></span>
                <strong>{c.label}</strong>
              </div>
              <div className="suit-reading" aria-label={st === 'unseen' ? 'Not inspected yet' : undefined}>
                {st === 'unseen' ? '? ? ?' : st === 'fixed' ? c.fixedReading : c.reading}
              </div>
              {card && <div className="suit-range">Safe range: {c.nominal}</div>}
              {hints && st === 'seen' && c.faulty && <div className="hint-inline">Compare this with the safe range.</div>}
              <div className="suit-actions">
                {st === 'unseen' && <Btn kind="blue" size="sm" block icon="eye" onClick={() => { set(c.id, 'seen'); setNote(null); }}>Inspect</Btn>}
                {st === 'seen' && (
                  <>
                    <Btn kind="good" size="sm" block icon="check" onClick={() => judge(c, 'ok')}>Looks good</Btn>
                    <Btn kind="danger" size="sm" block icon="warning" onClick={() => judge(c, 'fault')}>Report a fault</Btn>
                  </>
                )}
                {st === 'ok' && <span className="verdict good"><Icon name="check" size={18} /> Good</span>}
                {st === 'fixed' && <span className="verdict good"><Icon name="check" size={18} /> Fault fixed</span>}
                {st === 'reported' && <span className="verdict bad"><Icon name="warning" size={18} /> Fault reported</span>}
              </div>
            </li>
          );
        })}
      </ul>

      {openFault && (
        <fieldset className="choice-group">
          <legend><Icon name="wrench" size={16} /> Fix it <span>{openFault.label} reads {openFault.reading}</span></legend>
          <div className="stack">
            {hints && openFault.id === 'pressure' && <Comm name="Tip" tone="tip">Look at the suit. One glove ring is glowing red.</Comm>}
            {openFault.fixes.map((f) => <Btn key={f.label} kind="ghost" block icon="wrench" onClick={() => fix(openFault, f)}>{f.label}</Btn>)}
          </div>
        </fieldset>
      )}

      {note && <p className="note" role="status">{note}</p>}
      {blocked && <p className="error"><Icon name="lock" size={18} /> {blocked}</p>}
      <div className="dialog-actions">
        <Btn size="lg" icon="check" onClick={onCleared} disabled={!!blocked} autoFocus={!blocked}>Request clearance for training</Btn>
        <Btn kind="ghost" onClick={onClose}>Step back</Btn>
      </div>
      <p className="fine center">Fictional training procedure. Real suits are checked by a team with far longer checklists.</p>
    </Dialog>
  );
}

const CHECK_ICON: Record<string, string> = { helmet: 'helmet', oxygen: 'air', radio: 'antenna', pressure: 'gauge' };

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

const ZONES: { id: GravityId; from: number; to: number; hurdle: number; label: string }[] = [
  { id: 'earth', from: 0, to: -9, hurdle: -4.5, label: 'EARTH  1.00 g' },
  { id: 'mars', from: -9, to: -18, hurdle: -13.5, label: 'MARS  0.38 g' },
  { id: 'moon', from: -18, to: -27, hurdle: -20.5, label: 'MOON  0.17 g' },
];
const LANE = 2.3;
const STATION = { x: -5, z: 4 };
const TABLE = { x: 4.5, z: 3.5 };
const GOAL = { x: 0, z: -33 };
/** The supply run: a shelf to take things from and a rack to load them into, both near the start. */
const SHELF = { x: 9.5, z: 8 };
const RACK = { x: 9.5, z: 1 };
/** After the drill the loaded rack is waiting on its cart beside the pad road, next to the crew transport. */
const CART = { x: 7.5, z: -34 };
const VAN = { x: -8, z: -35.2 };

/** One supply item, small enough to carry in both hands. */
export function SupplyItem({ id }: { id: SupplyId }) {
  const m = M();
  if (id === 'food') {
    return (
      <group>
        <mesh castShadow><boxGeometry args={[0.52, 0.34, 0.36]} /><meshStandardMaterial color="#c9a56b" roughness={0.9} /></mesh>
        <mesh position={[0, 0, 0.185]}><planeGeometry args={[0.3, 0.16]} /><meshStandardMaterial color="#3f9d5a" roughness={0.8} /></mesh>
        <mesh position={[0, 0.172, 0]} material={m.white}><boxGeometry args={[0.54, 0.02, 0.07]} /></mesh>
      </group>
    );
  }
  if (id === 'tools') {
    return (
      <group>
        <mesh material={m.red} castShadow><boxGeometry args={[0.56, 0.26, 0.3]} /></mesh>
        <mesh position={[0, 0.17, 0]} material={m.darkSteel}><boxGeometry args={[0.22, 0.05, 0.05]} /></mesh>
        {[-0.2, 0.2].map((x) => <mesh key={x} position={[x, 0.02, 0.155]} material={m.steel}><boxGeometry args={[0.07, 0.07, 0.02]} /></mesh>)}
      </group>
    );
  }
  return (
    <group>
      <mesh material={m.darkSteel} castShadow><boxGeometry args={[0.5, 0.34, 0.3]} /></mesh>
      <mesh position={[0, 0.2, 0]} material={m.yellow}><boxGeometry args={[0.3, 0.06, 0.08]} /></mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-0.165 + i * 0.11, 0, 0.155]}>
          <boxGeometry args={[0.08, 0.2, 0.02]} />
          <meshStandardMaterial color="#35e07a" emissive="#35e07a" emissiveIntensity={1.4} />
        </mesh>
      ))}
    </group>
  );
}

const SLOT_Y: Record<SupplyId, number> = { food: 1.42, tools: 0.92, battery: 0.42 };

/** The loading rack: three slots, a door that closes over them, and two restraint straps with latches. */
function CargoRack({ cargo, onCart = false }: { cargo: CargoState; onCart?: boolean }) {
  const m = M();
  const door = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (!door.current) return;
    const to = cargo.door ? 0 : -1.9;
    door.current.rotation.y += (to - door.current.rotation.y) * (1 - Math.exp(-7 * Math.min(d, 0.1)));
  });
  return (
    <group position={[0, onCart ? 0.38 : 0, 0]}>
      {onCart && (
        <group position={[0, -0.38, 0]}>
          <mesh position={[0, 0.3, 0]} material={m.darkSteel} castShadow><boxGeometry args={[1.5, 0.12, 1.0]} /></mesh>
          {[[-0.6, -0.42], [0.6, -0.42], [-0.6, 0.42], [0.6, 0.42]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.16, z]} rotation={[Math.PI / 2, 0, 0]} material={m.black}><cylinderGeometry args={[0.16, 0.16, 0.1, 16]} /></mesh>
          ))}
          <Strut a={[-0.75, 0.36, 0]} b={[-1.5, 0.9, 0]} r={0.035} />
        </group>
      )}
      {/* Frame, back and shelves */}
      {[[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]].map(([x, z], i) => <Strut key={i} a={[x, 0, z]} b={[x, 1.85, z]} r={0.04} />)}
      <mesh position={[0, 0.93, -0.3]} material={m.navy}><boxGeometry args={[1.14, 1.82, 0.04]} /></mesh>
      {[0.18, 0.68, 1.18, 1.82].map((y) => <mesh key={y} position={[0, y, 0]} material={m.steel} castShadow><boxGeometry args={[1.14, 0.05, 0.62]} /></mesh>)}
      {SUPPLIES.map((x) => cargo.loaded.includes(x.id) && <group key={x.id} position={[0, SLOT_Y[x.id], 0]}><SupplyItem id={x.id} /></group>)}
      {/* Door, hinged on the left */}
      <group ref={door} position={[-0.57, 0, 0.33]} rotation={[0, -1.9, 0]}>
        <mesh position={[0.57, 0.93, 0]}>
          <boxGeometry args={[1.14, 1.78, 0.04]} />
          <meshStandardMaterial color="#b8c4d2" roughness={0.3} metalness={0.2} transparent opacity={0.38} />
        </mesh>
        <mesh position={[0.57, 0.93, 0.03]} material={m.steel}><boxGeometry args={[1.18, 0.06, 0.03]} /></mesh>
      </group>
      {/* Restraints: each strap appears across the door with its latch lit when fastened */}
      {[0.55, 1.3].map((y, i) => cargo.restraints > i && (
        <group key={y} position={[0, y, 0.38]}>
          <mesh material={m.yellow}><boxGeometry args={[1.3, 0.09, 0.03]} /></mesh>
          <mesh position={[0.55, 0, 0.03]}><boxGeometry args={[0.14, 0.14, 0.05]} /><meshStandardMaterial color="#35e07a" emissive="#35e07a" emissiveIntensity={1.2} /></mesh>
        </group>
      ))}
      <Sign lines={['LOADING RACK']} position={[0, 2.12, 0]} size={[1.5, 0.42]} accent={secured(cargo) ? '#35e07a' : undefined} />
    </group>
  );
}

/** The van that carries the crew to the pad. Its side door stands open. */
function CrewTransport() {
  const m = M();
  return (
    <group>
      <mesh position={[0, 1.15, 0]} material={m.white} castShadow><boxGeometry args={[4.6, 1.7, 2.1]} /></mesh>
      <mesh position={[0, 0.42, 0]} material={m.navy}><boxGeometry args={[4.62, 0.5, 2.12]} /></mesh>
      <mesh position={[-1.5, 1.45, 1.06]} material={m.glass}><planeGeometry args={[1.2, 0.7]} /></mesh>
      <mesh position={[2.31, 1.4, 0]} rotation={[0, Math.PI / 2, 0]} material={m.glass}><planeGeometry args={[1.7, 0.8]} /></mesh>
      {/* Open doorway and a step */}
      <mesh position={[0.6, 1.0, 1.06]} material={m.black}><planeGeometry args={[1.1, 1.5]} /></mesh>
      <mesh position={[0.6, 0.2, 1.3]} material={m.steel}><boxGeometry args={[1.1, 0.08, 0.4]} /></mesh>
      {[[-1.5, -1.0], [1.5, -1.0], [-1.5, 1.0], [1.5, 1.0]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.36, z]} rotation={[Math.PI / 2, 0, 0]} material={m.black}><cylinderGeometry args={[0.36, 0.36, 0.26, 20]} /></mesh>
      ))}
      <mesh position={[0, 1.55, 1.07]} material={m.red}><planeGeometry args={[4.4, 0.12]} /></mesh>
      <Sign lines={['CREW TRANSPORT', 'To the launch pad']} position={[0, 2.5, 0]} size={[2.8, 0.8]} />
    </group>
  );
}

function zoneAt(s: { x: number; z: number }): GravityId {
  if (Math.abs(s.x) > LANE + 0.4) return 'earth';
  return ZONES.find((z) => s.z <= z.from && s.z > z.to)?.id ?? 'earth';
}

export function Yard({ cleared, carrying, delivered, cargo, atPad = false }: { cleared: boolean; carrying: boolean; delivered: boolean; cargo?: CargoState; atPad?: boolean }) {
  const m = M();
  const stock = cargo ?? EMPTY_CARGO;
  return (
    <group>
      {/* Supply shelf: what is still waiting to be loaded */}
      <group position={[SHELF.x, 0, SHELF.z]}>
        <mesh position={[0, 0.82, 0]} material={m.steel} castShadow><boxGeometry args={[2.4, 0.08, 0.8]} /></mesh>
        {[[-1.1, -0.3], [1.1, -0.3], [-1.1, 0.3], [1.1, 0.3]].map(([x, z], i) => <Strut key={i} a={[x, 0, z]} b={[x, 0.8, z]} r={0.035} />)}
        {SUPPLIES.map((x, i) => !stock.loaded.includes(x.id) && stock.carrying !== x.id && (
          <group key={x.id} position={[-0.75 + i * 0.75, 1.03, 0]}><SupplyItem id={x.id} /></group>
        ))}
        <Sign lines={['SUPPLIES', 'Food · Tools · Battery']} position={[0, 0.42, 0.41]} size={[2.2, 0.62]} />
      </group>
      {/* Loading rack: by the shelf to begin with, and on its cart by the pad road once the drill is done */}
      <group position={atPad ? [CART.x, 0, CART.z] : [RACK.x, 0, RACK.z]} rotation={[0, atPad ? -0.5 : -Math.PI / 2, 0]}>
        <CargoRack cargo={stock} onCart={atPad} />
      </group>
      {atPad && <group position={[VAN.x, 0, VAN.z]} rotation={[0, 0.35, 0]}><CrewTransport /></group>}
      {/* Suit station */}
      <group position={[STATION.x, 0, STATION.z]}>
        {[[-1.4, -1], [1.4, -1], [-1.4, 1], [1.4, 1]].map(([x, z], i) => <Strut key={i} a={[x, 0, z]} b={[x, 3, z]} r={0.06} />)}
        <mesh position={[0, 3.05, 0]} material={m.navy} castShadow><boxGeometry args={[3.2, 0.1, 2.4]} /></mesh>
        <mesh position={[0, 0.55, -0.7]} material={m.white} castShadow><boxGeometry args={[1.5, 1.1, 0.5]} /></mesh>
        <mesh position={[0, 1.35, -0.75]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[1.3, 0.7, 0.06]} />
          <meshStandardMaterial color="#0d1826" emissive={cleared ? '#35e07a' : '#ff3b30'} emissiveIntensity={0.55} />
        </mesh>
        <Sign lines={['SUIT STATION', cleared ? 'Suit cleared' : 'Preflight check required']} position={[0, 2.5, -1.02]} size={[2.6, 0.8]} accent={cleared ? '#35e07a' : '#e23d3d'} />
      </group>
      {/* Equipment table with the pouch */}
      <group position={[TABLE.x, 0, TABLE.z]}>
        <mesh position={[0, 0.82, 0]} material={m.steel} castShadow><boxGeometry args={[1.6, 0.08, 0.8]} /></mesh>
        {[[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]].map(([x, z], i) => <Strut key={i} a={[x, 0, z]} b={[x, 0.8, z]} r={0.035} />)}
        {!carrying && !delivered && <group position={[0, 1.0, 0]}><Pouch /></group>}
        <Sign lines={['EQUIPMENT']} position={[0, 0.45, 0.41]} size={[1.4, 0.4]} />
      </group>
      {/* Gravity trainer lane */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (LANE + 0.15), 0.5, -13.5]} material={m.yellow} castShadow><boxGeometry args={[0.12, 1.0, 27]} /></mesh>
      ))}
      {!cleared && <mesh position={[0, 0.6, 0.6]} material={m.red} castShadow><boxGeometry args={[LANE * 2 + 0.4, 0.14, 0.14]} /></mesh>}
      {!cleared && <Sign lines={['CLOSED', 'Suit check first']} position={[0, 1.3, 0.62]} size={[2.2, 0.8]} />}
      {ZONES.map((z) => (
        <group key={z.id}>
          <mesh position={[0, 0.15, z.hurdle]} castShadow receiveShadow><boxGeometry args={[LANE * 2, 0.3, 0.3]} /><meshStandardMaterial color="#e23d3d" roughness={0.6} /></mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, (z.from + z.to) / 2]}>
            <planeGeometry args={[LANE * 2, 8.6]} />
            <meshStandardMaterial color={z.id === 'earth' ? '#3d6fb0' : z.id === 'mars' ? '#b5522a' : '#9c9b98'} roughness={0.9} transparent opacity={0.55} />
          </mesh>
          <Sign lines={[z.label, z.id === 'earth' ? 'Normal gravity' : 'Trainer harness lifts you']} position={[LANE + 1.6, 1.7, z.from - 1.2]} rotation={[0, -0.5, 0]} size={[2.8, 1.0]} />
          <Strut a={[LANE + 1.6, 0, z.from - 1.2]} b={[LANE + 1.6, 1.2, z.from - 1.2]} r={0.05} />
        </group>
      ))}
      {/* Overhead trainer gantry above the reduced-gravity lanes */}
      {[-9, -18, -27].map((z) => (
        <group key={z}>
          <Strut a={[-LANE - 0.6, 0, z]} b={[-LANE - 0.6, 6.4, z]} r={0.09} />
          <Strut a={[LANE + 0.6, 0, z]} b={[LANE + 0.6, 6.4, z]} r={0.09} />
          <mesh position={[0, 6.4, z]} material={m.steel}><boxGeometry args={[LANE * 2 + 1.6, 0.22, 0.22]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 6.4, -18]} material={m.steel}><boxGeometry args={[0.22, 0.22, 18]} /></mesh>
      {/* Training point */}
      <mesh position={[GOAL.x, 0.06, GOAL.z]} material={m.navy} receiveShadow><cylinderGeometry args={[2.2, 2.2, 0.12, 36]} /></mesh>
      <Sign lines={['TRAINING POINT']} position={[GOAL.x, 2.4, GOAL.z - 2.6]} size={[3, 0.8]} />
      <Strut a={[GOAL.x - 1.3, 0, GOAL.z - 2.6]} b={[GOAL.x - 1.3, 2, GOAL.z - 2.6]} r={0.05} />
      <Strut a={[GOAL.x + 1.3, 0, GOAL.z - 2.6]} b={[GOAL.x + 1.3, 2, GOAL.z - 2.6]} r={0.05} />
      {delivered && <group position={[GOAL.x, 0.3, GOAL.z]}><Pouch /></group>}
    </group>
  );
}

/** Cable from the trainer gantry to the astronaut while a reduced-gravity lane is active. */
function HarnessCable({ walker, zone }: { walker: React.MutableRefObject<WalkerState>; zone: React.MutableRefObject<GravityId> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = walker.current;
    const on = (s.grounded ? zoneAt(s) : zone.current) !== 'earth';
    if (!ref.current) return;
    ref.current.visible = on;
    const top = 6.3;
    const bottom = s.y + 1.75;
    ref.current.position.set(s.x, (top + bottom) / 2, s.z - 0.3);
    ref.current.scale.set(1, Math.max(0.1, top - bottom), 1);
  });
  return <mesh ref={ref} visible={false}><cylinderGeometry args={[0.015, 0.015, 1, 6]} /><meshStandardMaterial color="#d0d4d8" metalness={0.8} roughness={0.3} /></mesh>;
}

export function EarthMission() {
  const run = useGame((s) => s.run)!;
  const settings = useGame((s) => s.save.settings);
  const setPhase = useGame((s) => s.setPhase);
  const complete = useGame((s) => s.completeMission);
  const tier = run.tier;
  // Four checkpoints: supplies, suit, gravity drill, then secure the cargo and board.
  const phase = run.phase;
  const cleared = phase === 'course' || phase === 'board';
  const hints = hintsOn(settings, tier);

  const walker = useRef(makeWalker(0, 8.5));
  const [panel, setPanel] = useState(false);
  const [checks, setChecks] = useState<Record<string, CheckState>>({});
  const [carrying, setCarrying] = useState(false);
  const [delivered, setDelivered] = useState(phase === 'board');
  // A later checkpoint starts with the rack already full.
  const [cargo, setCargo] = useState<CargoState>(() => makeCargo(phase !== 'supplies'));
  const [boarded, setBoarded] = useState(false);
  const baseline = useRef(false);
  const mistakes = useRef(run.stats.suitMistakes ?? 0);
  const airtimes = useRef<Record<GravityId, number>>({ earth: 0, mars: 0, moon: 0 });
  const jumpZone = useRef<GravityId>('earth');
  const wasGrounded = useRef(true);
  const tick = useRef(0);

  const pressureFixed = cleared || checks.pressure === 'fixed';
  const env = useMemo(() => {
    const boxes = [
      ...ZONES.map((z) => ({ minX: -LANE, maxX: LANE, minZ: z.hurdle - 0.15, maxZ: z.hurdle + 0.15, top: 0.3 })),
      { minX: -LANE - 0.25, maxX: -LANE - 0.05, minZ: -27, maxZ: 0, top: 1.0 },
      { minX: LANE + 0.05, maxX: LANE + 0.25, minZ: -27, maxZ: 0, top: 1.0 },
      ...(cleared ? [] : [{ minX: -LANE - 0.2, maxX: LANE + 0.2, minZ: 0.5, maxZ: 0.7, top: 1.6 }]),
      // Keep players from walking around the course to the training point.
      { minX: -16, maxX: -LANE - 0.25, minZ: -27.2, maxZ: -27, top: 1.6 },
      { minX: LANE + 0.25, maxX: 16, minZ: -27.2, maxZ: -27, top: 1.6 },
    ];
    const base = {
      ground: () => 0,
      circles: [
        { x: STATION.x, z: STATION.z - 0.7, r: 0.9 }, { x: TABLE.x, z: TABLE.z, r: 0.8 },
        { x: SHELF.x - 0.7, z: SHELF.z, r: 0.6 }, { x: SHELF.x + 0.7, z: SHELF.z, r: 0.6 },
        ...(phase === 'board' ? [{ x: CART.x, z: CART.z, r: 0.95 }, { x: VAN.x - 1.2, z: VAN.z, r: 1.3 }, { x: VAN.x + 1.2, z: VAN.z, r: 1.3 }] : [{ x: RACK.x, z: RACK.z, r: 0.8 }]),
      ],
      boxes,
      bounds: { minX: -15, maxX: 15, minZ: -38, maxZ: 12 },
      radius: 0.38,
    };
    const byZone: Record<GravityId, WalkEnv> = {
      earth: { ...base, preset: GRAVITY_PRESETS.earth },
      mars: { ...base, preset: GRAVITY_PRESETS.mars },
      moon: { ...base, preset: GRAVITY_PRESETS.moon },
    };
    // The trainer harness holds its setting until you land, so a long Moon jump is measured fairly.
    return (s: WalkerState) => byZone[s.grounded ? zoneAt(s) : jumpZone.current];
  }, [cleared, phase]);

  const supply = nextSupply(cargo);
  const nameOf = (id: SupplyId | null) => SUPPLIES.find((x) => x.id === id)?.name ?? 'item';
  const interactables = (): Interactable[] => [
    { id: 'shelf', x: SHELF.x, z: SHELF.z - 0.7, r: 2.3, label: `Pick up the ${nameOf(supply)}`, enabled: phase === 'supplies' && !cargo.carrying && !!supply },
    { id: 'rack', x: RACK.x - 0.8, z: RACK.z, r: 2.3, label: `Load the ${nameOf(cargo.carrying)} into the rack`, enabled: phase === 'supplies' && !!cargo.carrying },
    { id: 'cart', x: CART.x - 0.5, z: CART.z + 0.9, r: 2.4, label: secureLabel(cargo), enabled: phase === 'board' && !secured(cargo) },
    { id: 'van', x: VAN.x + 0.8, z: VAN.z + 1.9, r: 2.6, label: 'Board the crew transport', enabled: phase === 'board' && secured(cargo) && !boarded },
    { id: 'station', x: STATION.x, z: STATION.z + 0.6, r: 2.4, label: 'Run the suit preflight check', enabled: phase === 'suit' },
    { id: 'pouch', x: TABLE.x, z: TABLE.z + 0.6, r: 2.2, label: 'Pick up the equipment pouch', enabled: phase === 'course' && !carrying && !delivered },
    { id: 'goal', x: GOAL.x, z: GOAL.z, r: 2.4, label: 'Set the pouch down at the training point', enabled: carrying },
  ];

  /** The drill is over at the training point: save the jump times and move on to the cargo and boarding. */
  const drillDone = () => {
    setCarrying(false);
    setDelivered(true);
    const a = airtimes.current;
    playCue('checkpoint');
    hud.say('Drill complete. Your loaded rack is on the cart beside you. Lock it down, then board the crew transport.');
    setPhase('board', { stats: { airEarth: Math.round(a.earth * 100), airMars: Math.round(a.mars * 100), airMoon: Math.round(a.moon * 100) } });
  };

  const finish = () => {
    setBoarded(true);
    // After a reload the jump times come back from the checkpoint.
    const saved: Record<GravityId, number> = { earth: (run.stats.airEarth ?? 0) / 100, mars: (run.stats.airMars ?? 0) / 100, moon: (run.stats.airMoon ?? 0) / 100 };
    const a: Record<GravityId, number> = { earth: airtimes.current.earth || saved.earth, mars: airtimes.current.mars || saved.mars, moon: airtimes.current.moon || saved.moon };
    const fmt = (id: GravityId) => `${(a[id] || idealAirtime(GRAVITY_PRESETS[id])).toFixed(2)} s${a[id] ? '' : ' (not jumped: expected value)'}`;
    const n = mistakes.current;
    window.setTimeout(() => complete({
      crewStatus: 'Supplies loaded and strapped down, suit sealed at 4.3 psi, drill passed. Aboard the crew transport to the pad.',
      consequence: `${n === 0
        ? 'You caught the low pressure reading on your first pass, before the suit left the station.'
        : `You misjudged ${n} ${n === 1 ? 'reading' : 'readings'} and checked again. Clearance stayed blocked until the leak was fixed, which is what a preflight check is for.`
      } You loaded the food, the tools and the spare battery, then closed the rack and locked both restraints so nothing can shift at launch. In the trainer the same jump lasted ${fmt('earth')} in Earth gravity, ${fmt('mars')} in Mars gravity and ${fmt('moon')} in Moon gravity. Less gravity pulls you back down more slowly. Your Earth jump is the baseline to compare with when you reach the Moon.`,
      objectives: [
        { label: 'Load food, tools and the spare battery into the rack', done: true },
        { label: 'Inspect every suit item', done: true },
        { label: 'Detect and fix the low pressure reading', done: true },
        { label: 'Carry the pouch through all three gravity lanes', done: true },
        { label: 'Close the rack and lock both restraints', done: true },
        { label: 'Board the crew transport', done: true },
      ],
      stats: [
        { label: 'Readings misjudged', value: String(n) },
        { label: 'Jump airtime, Earth gravity', value: fmt('earth') },
        { label: 'Jump airtime, Mars gravity', value: fmt('mars') },
        { label: 'Jump airtime, Moon gravity', value: fmt('moon') },
      ],
      outpost: null,
      rating: rateSuitLab(n),
    }), 900);
  };

  const onInteract = (id: string) => {
    if (id === 'station') { setPanel(true); return; }
    if (id === 'pouch') { setCarrying(true); playCue('ok'); return; }
    if (id === 'goal') { drillDone(); return; }
    if (id === 'van') { playCue('complete'); hud.say('Welcome aboard. Next stop, the launch pad.'); finish(); return; }
    // The supply run and the restraints all go through the cargo rules.
    const r = id === 'shelf' ? pickUp(cargo) : id === 'rack' ? load(cargo) : id === 'cart' ? secureStep(cargo) : null;
    if (!r) return;
    playCue(r.ok ? 'ok' : 'caution');
    hud.say(r.say);
    if (!r.ok) return;
    setCargo(r.state);
    if (id === 'rack' && allLoaded(r.state)) {
      playCue('checkpoint');
      hud.say('All three are in the rack. Now check your suit at the suit station.');
      setPhase('suit', { flags: { suppliesLoaded: true } });
    }
    if (id === 'cart' && secured(r.state)) hud.say('Cargo secured. Board the crew transport when you are ready.');
  };

  useEffect(() => {
    const objective = phase === 'supplies' ? (cargo.carrying ? `Carry the ${nameOf(cargo.carrying)} to the loading rack` : `Pick up the ${nameOf(supply)} from the supply shelf`)
      : phase === 'suit' ? 'Walk to the suit station and run the preflight check'
        : phase === 'board' ? (boarded ? 'Aboard the crew transport' : secured(cargo) ? 'Board the crew transport' : `Secure the cargo: ${secureLabel(cargo).toLowerCase()}`)
          : !carrying ? 'Pick up the equipment pouch from the table'
            : 'Carry the pouch through the gravity lanes to the training point. Jump the red bars.';
    hud.set({
      objective, touch: 'walk', touchLabels: { primary: 'Jump', use: 'Use' },
      labels: ['Fictional training procedure', 'Trainer gravity: real Moon and Mars values'],
      hint: !hints ? null
        : phase === 'supplies' ? (cargo.carrying ? 'The loading rack is past the shelf, on your right. Walk close and press E.' : 'The supply shelf is on your right. Walk close and press E. You carry one thing at a time.')
          : phase === 'suit' ? 'The suit station is on your left. Walk close and press E.'
            : phase === 'board' ? (secured(cargo) ? 'The crew transport is across the road. Walk to its open door and press E.' : 'Stand at the rack and press E for each step: the door, then two restraints.')
              : carrying ? 'Press Space just before each red bar. Watch how long the jump lasts in each lane.' : null,
      meters: [
        { id: 'pressure', label: 'Suit pressure', value: pressureFixed ? 4.3 : 3.1, max: 4.3, text: pressureFixed ? '4.3 psi' : '3.1 psi', status: pressureFixed ? 'ok' : 'low', note: 'Safe range 4.2 to 4.4 psi' },
        { id: 'oxygen', label: 'Suit oxygen', value: 100, max: 100, text: '100%', status: 'ok' },
      ],
    });
    if (!pressureFixed && checks.pressure === 'reported') hud.warn({ title: 'SUIT PRESSURE LOW', text: 'Pressure is 3.1 psi. Fix the leak before training.', level: 'alert' });
    else hud.warn(null);
  }, [phase, cargo, boarded, supply, cleared, carrying, delivered, hints, pressureFixed, checks.pressure]); // eslint-disable-line react-hooks/exhaustive-deps

  const onStep = (s: WalkerState) => {
    // Record the airtime of each jump against the lane it started in.
    if (!wasGrounded.current && s.grounded && s.lastAirtime > 0.2) {
      airtimes.current[jumpZone.current] = s.lastAirtime;
      // The first Earth jump is the one to remember: every later world is compared with it.
      if (jumpZone.current === 'earth' && cleared && !baseline.current) {
        baseline.current = true;
        hud.say(`${s.lastAirtime.toFixed(2)} seconds in the air. That is your Earth baseline. Remember it for the Moon.`);
      }
    }
    if (s.grounded) jumpZone.current = zoneAt(s);
    wasGrounded.current = s.grounded;
    if (tick.current++ % 6 !== 0) return;
    const zone = s.grounded ? zoneAt(s) : jumpZone.current;
    const p = GRAVITY_PRESETS[zone];
    const a = airtimes.current;
    hud.set({
      distance: carrying ? Math.hypot(GOAL.x - s.x, GOAL.z - s.z) : null,
      readouts: phase === 'supplies' || phase === 'board' ? cargoChecklist(cargo).map((c) => ({ label: c.label, value: c.done ? `✓ ${c.value}` : c.value, status: c.done ? 'ok' as const : 'caution' as const, keep: c.done })) : cleared ? [
        { label: 'Gravity here', value: `${p.label} ${zone === 'earth' ? '1.00' : zone === 'mars' ? '0.38' : '0.17'} g`, note: zone === 'earth' ? '' : 'trainer harness' },
        { label: 'Last jump: Earth', value: a.earth ? `${a.earth.toFixed(2)} s` : 'not yet' },
        { label: 'Last jump: Mars', value: a.mars ? `${a.mars.toFixed(2)} s` : 'not yet' },
        { label: 'Last jump: Moon', value: a.moon ? `${a.moon.toFixed(2)} s` : 'not yet' },
      ] : [],
    });
  };

  const marker = phase === 'supplies' ? (cargo.carrying ? { x: RACK.x - 0.8, z: RACK.z } : { x: SHELF.x, z: SHELF.z - 0.7 })
    : phase === 'suit' ? { x: STATION.x, z: STATION.z + 0.6 }
      : phase === 'board' ? (boarded ? null : secured(cargo) ? { x: VAN.x + 0.8, z: VAN.z + 1.9 } : { x: CART.x - 0.5, z: CART.z + 0.9 })
        : !carrying ? { x: TABLE.x, z: TABLE.z + 0.6 } : GOAL;

  return (
    <>
      <GameCanvas fov={52} envIntensity={0.55} background="#cfe2f3">
        <EarthWorld follow={walker} />
        <Yard cleared={cleared} carrying={carrying} delivered={delivered} cargo={cargo} atPad={phase === 'board'} />
        {marker && <ObjectiveMarker x={marker.x} z={marker.z} />}
        <HarnessCable walker={walker} zone={jumpZone} />
        <WalkerRig
          env={env} state={walker} interactables={interactables} onInteract={onInteract} onStep={onStep}
          carrying={carrying || !!cargo.carrying} carried={cargo.carrying ? <SupplyItem id={cargo.carrying} /> : undefined} frozen={panel || boarded}
          chestLight={pressureFixed ? 'green' : 'red'} gloveAlert={!pressureFixed}
        />
      </GameCanvas>
      {panel && (
        <SuitCheckPanel
          tier={tier} state={checks} setState={setChecks}
          onClose={() => setPanel(false)}
          onMistake={() => { mistakes.current += 1; }}
          onCleared={() => {
            setPanel(false);
            playCue('complete');
            hud.say('Suit cleared. Pick up the equipment pouch.');
            setPhase('course', { flags: { suitCleared: true }, stats: { suitMistakes: mistakes.current } });
          }}
        />
      )}
    </>
  );
}
