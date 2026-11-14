import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { playCue } from '../game/audio';
import { hud } from '../game/hud';
import { useGame } from '../game/store';
import { GRAVITY_PRESETS, idealAirtime, makeWalker, type GravityId, type WalkEnv, type WalkerState } from '../sim/movement';
import { hintsOn } from '../sim/save';
import type { Tier } from '../sim/types';
import { Astronaut, makeAnim } from '../three/Astronaut';
import { GameCanvas, SunLight } from '../three/GameCanvas';
import { LaunchTower, M, Pouch, ShuttleStack, Sign, Strut } from '../three/Props';
import { ObjectiveMarker, SkyDome } from '../three/Scenery';
import { groundTexture } from '../three/textures';
import { WalkerRig, type Interactable } from '../three/WalkerRig';
import { Btn, Dialog } from '../ui/common';

const SUN: [number, number, number] = [0.45, 0.85, 0.5];

/** Launch-site environment shared by the home screen and the Earth mission. */
export function EarthWorld({ follow }: { follow?: React.MutableRefObject<{ x: number; y?: number; z: number }> }) {
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
        <group position={[0, 3, 0]}><ShuttleStack /></group>
        <group position={[-11, 3, 0]}><LaunchTower /></group>
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
  useFrame(({ camera }) => {
    camera.position.set(27.5, 1.6, -105);
    camera.lookAt(30, 13.5, -190);
  });
  return (
    <>
      <EarthWorld follow={focus} />
      <group position={[30.8, 0, -113.4]} rotation={[0, -0.37, 0]}>
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

  return (
    <Dialog title="Suit preflight check" onClose={onClose} wide>
      <p>Inspect each item, compare it with the safe range, and decide: good, or a fault to report.</p>
      {tier === 'advanced' && <div className="row"><Btn kind="ghost" onClick={() => setCard(!card)}>{card ? 'Close reference card' : 'Open reference card'}</Btn></div>}
      <table className="checks">
        <thead><tr><th>Item</th><th>Reading</th>{card && <th>Safe range</th>}<th>Your call</th></tr></thead>
        <tbody>
          {checks.map((c) => {
            const st = state[c.id] ?? 'unseen';
            return (
              <tr key={c.id} className={st}>
                <th scope="row">{c.label}</th>
                <td className="reading">
                  {st === 'unseen' ? '—' : st === 'fixed' ? c.fixedReading : c.reading}
                  {hints && st === 'seen' && <small className="hint-inline"> {c.faulty ? 'Compare this with the safe range.' : ''}</small>}
                </td>
                {card && <td>{c.nominal}</td>}
                <td>
                  {st === 'unseen' && <Btn kind="ghost" onClick={() => { set(c.id, 'seen'); setNote(null); }}>Inspect</Btn>}
                  {st === 'seen' && (
                    <span className="row tight">
                      <Btn kind="ghost" onClick={() => judge(c, 'ok')}>Looks good</Btn>
                      <Btn kind="ghost" onClick={() => judge(c, 'fault')}>Report a fault</Btn>
                    </span>
                  )}
                  {st === 'ok' && <span className="verdict good">✔ Good</span>}
                  {st === 'fixed' && <span className="verdict good">✔ Fault fixed</span>}
                  {st === 'reported' && <span className="verdict bad">! Fault reported</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {openFault && (
        <fieldset className="action-group">
          <legend>Fix: {openFault.label} reads {openFault.reading}</legend>
          {hints && openFault.id === 'pressure' && <p className="hint-line"><strong>Hint:</strong> Look at the suit. One glove ring is glowing red.</p>}
          <div className="stack">
            {openFault.fixes.map((f) => <Btn key={f.label} kind="ghost" onClick={() => fix(openFault, f)}>{f.label}</Btn>)}
          </div>
        </fieldset>
      )}

      {note && <p className="note" role="status">{note}</p>}
      {blocked && <p className="error">{blocked}</p>}
      <div className="row">
        <Btn onClick={onCleared} disabled={!!blocked} autoFocus={!blocked}>Request clearance for training</Btn>
        <Btn kind="ghost" onClick={onClose}>Step back</Btn>
      </div>
      <p className="fine">Fictional training procedure. Real suits are checked by a team with far longer checklists.</p>
    </Dialog>
  );
}

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

function zoneAt(s: { x: number; z: number }): GravityId {
  if (Math.abs(s.x) > LANE + 0.4) return 'earth';
  return ZONES.find((z) => s.z <= z.from && s.z > z.to)?.id ?? 'earth';
}

function Yard({ cleared, carrying, delivered }: { cleared: boolean; carrying: boolean; delivered: boolean }) {
  const m = M();
  return (
    <group>
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
  const cleared = run.phase === 'course';
  const hints = hintsOn(settings, tier);

  const walker = useRef(makeWalker(0, 8.5));
  const [panel, setPanel] = useState(false);
  const [checks, setChecks] = useState<Record<string, CheckState>>({});
  const [carrying, setCarrying] = useState(false);
  const [delivered, setDelivered] = useState(false);
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
      circles: [{ x: STATION.x, z: STATION.z - 0.7, r: 0.9 }, { x: TABLE.x, z: TABLE.z, r: 0.8 }],
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
  }, [cleared]);

  const interactables = (): Interactable[] => [
    { id: 'station', x: STATION.x, z: STATION.z + 0.6, r: 2.4, label: 'Run the suit preflight check', enabled: !cleared },
    { id: 'pouch', x: TABLE.x, z: TABLE.z + 0.6, r: 2.2, label: 'Pick up the equipment pouch', enabled: cleared && !carrying && !delivered },
    { id: 'goal', x: GOAL.x, z: GOAL.z, r: 2.4, label: 'Set the pouch down at the training point', enabled: carrying },
  ];

  const finish = () => {
    setCarrying(false);
    setDelivered(true);
    const a = airtimes.current;
    const fmt = (id: GravityId) => `${(a[id] || idealAirtime(GRAVITY_PRESETS[id])).toFixed(2)} s${a[id] ? '' : ' (not jumped: expected value)'}`;
    const n = mistakes.current;
    window.setTimeout(() => complete({
      crewStatus: 'Suit sealed at 4.3 psi and cleared for flight training.',
      consequence: `${n === 0
        ? 'You caught the low pressure reading on your first pass, before the suit left the station.'
        : `You misjudged ${n} ${n === 1 ? 'reading' : 'readings'} and checked again. Clearance stayed blocked until the leak was fixed, which is what a preflight check is for.`
      } In the trainer the same jump lasted ${fmt('earth')} in Earth gravity, ${fmt('mars')} in Mars gravity and ${fmt('moon')} in Moon gravity. Less gravity pulls you back down more slowly.`,
      objectives: [
        { label: 'Inspect every suit item', done: true },
        { label: 'Detect and fix the low pressure reading', done: true },
        { label: 'Carry the pouch through all three gravity lanes', done: true },
      ],
      stats: [
        { label: 'Readings misjudged', value: String(n) },
        { label: 'Jump airtime, Earth gravity', value: fmt('earth') },
        { label: 'Jump airtime, Mars gravity', value: fmt('mars') },
        { label: 'Jump airtime, Moon gravity', value: fmt('moon') },
      ],
      outpost: null,
    }), 900);
  };

  const onInteract = (id: string) => {
    if (id === 'station') { setPanel(true); return; }
    if (id === 'pouch') { setCarrying(true); playCue('ok'); return; }
    if (id === 'goal') { playCue('ok'); finish(); }
  };

  useEffect(() => {
    const objective = !cleared ? 'Walk to the suit station and run the preflight check'
      : delivered ? 'Pouch delivered'
        : !carrying ? 'Pick up the equipment pouch from the table'
          : 'Carry the pouch through the gravity lanes to the training point. Jump the red bars.';
    hud.set({
      objective, touch: 'walk', touchLabels: { primary: 'Jump', use: 'Use' },
      labels: ['Fictional training procedure', 'Trainer gravity: real Moon and Mars values'],
      hint: !hints ? null : !cleared ? 'The suit station is on your left. Walk close and press E.'
        : carrying ? 'Press Space just before each red bar. Watch how long the jump lasts in each lane.' : null,
      meters: [
        { id: 'pressure', label: 'Suit pressure', value: pressureFixed ? 4.3 : 3.1, max: 4.3, text: pressureFixed ? '4.3 psi' : '3.1 psi', status: pressureFixed ? 'ok' : 'low', note: 'Safe range 4.2 to 4.4 psi' },
        { id: 'oxygen', label: 'Suit oxygen', value: 100, max: 100, text: '100%', status: 'ok' },
      ],
    });
    if (!pressureFixed && checks.pressure === 'reported') hud.warn({ title: 'SUIT PRESSURE LOW', text: 'Pressure is 3.1 psi. Fix the leak before training.', level: 'alert' });
    else hud.warn(null);
  }, [cleared, carrying, delivered, hints, pressureFixed, checks.pressure]);

  const onStep = (s: WalkerState) => {
    // Record the airtime of each jump against the lane it started in.
    if (!wasGrounded.current && s.grounded && s.lastAirtime > 0.2) airtimes.current[jumpZone.current] = s.lastAirtime;
    if (s.grounded) jumpZone.current = zoneAt(s);
    wasGrounded.current = s.grounded;
    if (tick.current++ % 6 !== 0) return;
    const zone = s.grounded ? zoneAt(s) : jumpZone.current;
    const p = GRAVITY_PRESETS[zone];
    const a = airtimes.current;
    hud.set({
      distance: carrying ? Math.hypot(GOAL.x - s.x, GOAL.z - s.z) : null,
      readouts: cleared ? [
        { label: 'Gravity here', value: `${p.label} ${zone === 'earth' ? '1.00' : zone === 'mars' ? '0.38' : '0.17'} g`, note: zone === 'earth' ? '' : 'trainer harness' },
        { label: 'Last jump: Earth', value: a.earth ? `${a.earth.toFixed(2)} s` : 'not yet' },
        { label: 'Last jump: Mars', value: a.mars ? `${a.mars.toFixed(2)} s` : 'not yet' },
        { label: 'Last jump: Moon', value: a.moon ? `${a.moon.toFixed(2)} s` : 'not yet' },
      ] : [],
    });
  };

  const marker = !cleared ? { x: STATION.x, z: STATION.z + 0.6 } : delivered ? null : !carrying ? { x: TABLE.x, z: TABLE.z + 0.6 } : GOAL;

  return (
    <>
      <GameCanvas fov={52} envIntensity={0.55} background="#cfe2f3">
        <EarthWorld follow={walker} />
        <Yard cleared={cleared} carrying={carrying} delivered={delivered} />
        {marker && <ObjectiveMarker x={marker.x} z={marker.z} />}
        <HarnessCable walker={walker} zone={jumpZone} />
        <WalkerRig
          env={env} state={walker} interactables={interactables} onInteract={onInteract} onStep={onStep}
          carrying={carrying} frozen={panel || delivered}
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
