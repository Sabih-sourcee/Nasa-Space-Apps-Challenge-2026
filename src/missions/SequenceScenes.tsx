import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { shotAt, type SequenceDef } from '../sim/sequences';
import { Astronaut, makeAnim } from '../three/Astronaut';
import { SunLight, simClock } from '../three/GameCanvas';
import { Habitat, LaunchTower, LunarLander, M, MarsLander, Orbiter, Rover, ShuttleStack, SolarArray, StationExterior } from '../three/Props';
import { EarthGlobe, SkyDome, Stars, SunDisc, Terrain } from '../three/Scenery';
import { fbm, planetTexture } from '../three/textures';
import { EarthWorld, Yard } from './EarthMission';

// Journey scenes. They are built from the same models the missions use, so the
// vehicle you watch is the vehicle you fly. Every position is a plain function
// of the sequence clock: nothing here keeps state of its own.

type V3 = [number, number, number];
const ease = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (a: V3, b: V3, t: number): V3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

interface SceneProps {
  def: SequenceDef;
  clock: React.MutableRefObject<number>;
  /** Reduced motion: each shot is shown as one still frame. */
  still: boolean;
}

/** Reads the clock into "which shot, how far through", holding the middle of the shot when motion is reduced. */
function useShot({ def, clock, still }: SceneProps): () => { index: number; l: number; t: number } {
  return () => {
    const at = shotAt(def, clock.current);
    return { index: at.index, l: still ? 0.5 : ease(at.local), t: still ? 0 : clock.current };
  };
}

/** Drives the clock and reports shot changes and the end. Lives inside the canvas so it runs once a frame. */
export function SequenceDriver({ def, clock, onShot, onDone }: { def: SequenceDef; clock: React.MutableRefObject<number>; onShot: (i: number) => void; onDone: () => void }) {
  const last = useRef(0);
  const ended = useRef(false);
  useFrame((_, delta) => {
    if (ended.current) return;
    clock.current += simClock.forceDelta ?? Math.min(delta, 0.1);
    const at = shotAt(def, clock.current);
    if (at.index !== last.current) { last.current = at.index; onShot(at.index); }
    if (at.done) { ended.current = true; onDone(); }
  });
  return null;
}

// ---------------------------------------------------------------------------
// Earth: the launch site, and the walk out to the pad
// ---------------------------------------------------------------------------

function PadScene(props: SceneProps) {
  const site = props.def.id === 'site';
  const read = useShot(props);
  const cadet = useRef<THREE.Group>(null);
  const anim = useRef(makeAnim('walk'));
  const follow = useRef({ x: site ? 0 : 40, z: site ? 8 : -110 });
  useFrame(({ camera }) => {
    const { index, l } = read();
    let pos: V3, look: V3;
    if (site) {
      // High over the site, down into the yard, then round to the cadet.
      if (cadet.current) { cadet.current.position.set(0, 0.01, 8.5); cadet.current.rotation.y = Math.PI; }
      anim.current.speed = 0;
      if (index === 0) { pos = mix3([-70, 46, 90], [-30, 30, 60], l); look = [34, 18, -170]; }
      else if (index === 1) { pos = mix3([-18, 14, 30], [-8, 7, 22], l); look = [0, 1, -6]; }
      else { pos = mix3([5, 2.4, 3.5], [3, 1.9, 4.5], l); look = [0, 1.25, 8.5]; }
    } else {
      const z = mix(-96, -112, index === 0 ? l : 1);
      if (cadet.current) {
        cadet.current.position.set(40, 0.01, z);
        cadet.current.rotation.y = Math.PI;
        cadet.current.visible = index === 0;
      }
      anim.current.speed = index === 0 && !props.still ? 0.9 : 0;
      follow.current.z = z;
      if (index === 0) { pos = [43.5, 2.1, z + 7.5]; look = [40, 16, -190]; }
      else if (index === 1) { pos = mix3([70, 5, -146], [66, 34, -150], l); look = [40, mix(12, 40, l), -190]; }
      else { pos = mix3([70, 40, -152], [60, 48, -166], l); look = [40, 47, -190]; }
    }
    camera.position.set(...pos);
    camera.lookAt(...look);
  });
  return (
    <>
      <EarthWorld follow={follow} />
      {site && <Yard cleared={false} carrying={false} delivered={false} />}
      <Astronaut ref={cadet} anim={anim} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Earth: ignition, liftoff, the climb, and the boosters falling away
// ---------------------------------------------------------------------------

const PAD: V3 = [40, 3, -190];

function LaunchScene(props: SceneProps) {
  const read = useShot(props);
  const rocket = useRef<THREE.Group>(null);
  const core = useRef<THREE.Group>(null);
  const boosterL = useRef<THREE.Group>(null);
  const boosterR = useRef<THREE.Group>(null);
  const boosterPower = useRef(0);
  const corePower = useRef(0);
  const smoke = useRef<THREE.Group>(null);
  const vent = useRef<THREE.Mesh>(null);
  const dark = useRef<THREE.Mesh>(null);
  const starsOn = useRef(0);
  const follow = useRef({ x: PAD[0], z: PAD[2] });

  useFrame(({ camera }) => {
    const { index, l, t } = read();
    // Height of the vehicle above the pad, how far it has leaned over, and how dark the sky is.
    const rise = index === 0 ? 0 : index === 1 ? 70 * Math.max(0, l - 0.3) ** 2 : index === 2 ? mix(40, 1500, l) : 1500 + 500 * l;
    const lean = index < 2 ? 0 : index === 2 ? 0.34 * l : 0.34 + 0.1 * l;
    const night = index < 2 ? 0 : index === 2 ? 0.75 * l : 0.75 + 0.2 * l;
    const lit = index === 0 ? 0 : 1;
    boosterPower.current = index === 3 && l > 0.18 ? 0 : lit;
    corePower.current = lit;
    const x = PAD[0], y = PAD[1] + rise, z = PAD[2] - (index >= 2 ? rise * 0.25 : 0);
    if (rocket.current) { rocket.current.position.set(x, y, z); rocket.current.rotation.x = -lean; }
    // The boosters let go a moment into the last shot, slide sideways off their struts and drop behind.
    const tb = index === 3 ? Math.max(0, l - 0.18) * 7 : 0;
    [boosterL.current, boosterR.current].forEach((b, i) => {
      if (!b) return;
      const side = i === 0 ? -1 : 1;
      b.position.set(side * (1.6 * tb + 0.5 * tb * tb), -(1.2 * tb + 4.5 * tb * tb), 0.6 * tb);
      b.rotation.z = side * -0.1 * tb;
    });
    if (vent.current) {
      // Cold vapour drifting off the tanks while the count runs.
      vent.current.visible = index === 0;
      vent.current.scale.setScalar(1 + (props.still ? 0.3 : (t * 0.5) % 1) * 1.5);
    }
    if (smoke.current) {
      const k = index === 1 ? l : index === 2 ? 1 : 0;
      smoke.current.visible = index === 1 || (index === 2 && l < 0.3);
      smoke.current.children.forEach((p, i) => {
        const a = (i / smoke.current!.children.length) * Math.PI * 2;
        const r = 5 + k * 42;
        p.position.set(PAD[0] + Math.cos(a) * r, 4 + k * 7 + (i % 3) * 2, PAD[2] + Math.sin(a) * r);
        p.scale.setScalar(5 + k * 13);
        ((p as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - k * 0.5);
      });
    }
    if (dark.current) {
      dark.current.position.copy(camera.position);
      (dark.current.material as THREE.MeshBasicMaterial).opacity = night;
    }
    starsOn.current = Math.max(0, night - 0.35) * 1.6;
    let pos: V3, look: V3;
    if (index === 0) { pos = mix3([88, 5, -138], [80, 4, -146], l); look = [40, 26, -190]; }
    // Ground camera: stays put and tilts up to follow the vehicle off the pad.
    else if (index === 1) { pos = [70, 3, -158]; look = [40, 14 + rise * 0.8, -190]; }
    // Vehicle camera: flies alongside.
    else if (index === 2) { pos = [x + 52, y + 14, z + 70]; look = [x, y + 6, z]; }
    else { pos = [x + mix(40, 54, l), y + 30, z + mix(58, 74, l)]; look = [x, y + 2, z]; }
    camera.position.set(...pos);
    camera.lookAt(...look);
  });

  return (
    <>
      <EarthWorld follow={follow} bare />
      <Stars opacity={starsOn} />
      <group position={[PAD[0] - 11, PAD[1], PAD[2]]}><LaunchTower /></group>
      <group ref={rocket} position={PAD}>
        <ShuttleStack parts={{ core, boosterL, boosterR, boosterPower, corePower }} />
        <mesh ref={vent} visible={false} position={[3.2, 30, 0]}>
          <sphereGeometry args={[1.6, 12, 10]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      </group>
      <group ref={smoke} visible={false}>
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i}><sphereGeometry args={[1, 12, 10]} /><meshBasicMaterial color={i % 2 ? '#f4f1ec' : '#d9d4cc'} transparent opacity={0.7} depthWrite={false} /></mesh>
        ))}
      </group>
      {/* The sky darkening as the air thins: a shell around the camera that fades toward black. */}
      <mesh ref={dark} renderOrder={-1}>
        <sphereGeometry args={[1000, 24, 16]} />
        <meshBasicMaterial color="#01030c" transparent opacity={0} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
    </>
  );
}

// ---------------------------------------------------------------------------
// Space: orbit, the station, the Moon and Mars
// ---------------------------------------------------------------------------

function Planet({ map, radius, haze }: { map: 'moon' | 'mars'; radius: number; haze?: string }) {
  const tex = useMemo(() => planetTexture(map), [map]);
  return (
    <group>
      <mesh rotation={[0.2, 1.2, 0]}>
        <sphereGeometry args={[radius, 64, 40]} />
        <meshStandardMaterial map={tex} roughness={0.95} metalness={0} />
      </mesh>
      {haze && (
        <mesh scale={1.02}>
          <sphereGeometry args={[radius, 48, 32]} />
          <meshBasicMaterial color={haze} transparent opacity={0.18} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

type CruiseKind = 'orbit' | 'moon' | 'mars' | 'insertion' | 'fault' | 'aboard' | 'alarm';
/** Where the station sits when the orbiter is docked to it: port face against the nose. */
const DOCKED_Z = -7.4;

function CruiseScene(props: SceneProps) {
  const kind = props.def.id as CruiseKind;
  const nearEarth = kind !== 'moon' && kind !== 'mars';
  const hasStation = kind === 'orbit' || kind === 'aboard' || kind === 'alarm' || kind === 'insertion';
  const hasCore = kind === 'orbit' || kind === 'insertion';
  const read = useShot(props);
  const m = M();
  const burn = useRef(0);
  const landerBurn = useRef(0);
  const craft = useRef<THREE.Group>(null);
  const core = useRef<THREE.Group>(null);
  const station = useRef<THREE.Group>(null);
  const home = useRef<THREE.Group>(null);
  const world = useRef<THREE.Group>(null);
  const lander = useRef<THREE.Group>(null);
  const plasma = useRef<THREE.Mesh>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const jets = useRef<THREE.Group>(null);
  const leak = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    const { index, l, t } = read();
    let pos: V3 = [9, 4, 26], look: V3 = [0, 0, -40];
    burn.current = 0;
    landerBurn.current = 0;
    let roll = 0;
    let warn = false;
    let puff = false;
    if (kind === 'orbit') {
      // The spent core stage tumbles away behind, then the station comes up ahead.
      if (core.current) {
        core.current.visible = index === 0;
        core.current.position.set(5, -6, 34 + 46 * l);
        core.current.rotation.set(0.4 + l * 0.5, 0, 0.3 + l * 0.3);
      }
      const range = index === 0 ? 600 : index === 1 ? mix(420, 110, l) : mix(110, 46, l);
      station.current?.position.set(0, 0, -range);
      if (index === 0) { pos = [13, 5, -18]; look = [1, -1, 12]; }
      else if (index === 1) { pos = mix3([10, 8, 28], [8, 7, 22], l); look = [0, -9, -60]; burn.current = l < 0.45 ? 1 : 0; }
      else { pos = mix3([8, 7, 22], [0, 1.2, -15.5], l); look = [0, mix(-9, 0, l), -60]; }
    } else if (kind === 'insertion') {
      // Engines off, the core stage lets go, thrusters steady the orbiter, and it flies on.
      const away = index === 0 ? l : 1;
      if (core.current) {
        core.current.visible = index < 2;
        core.current.position.set(away * 3, -away * 4, 24.6 + away * away * 70);
        core.current.rotation.set(Math.PI / 2 + away * 0.35, 0, away * 0.2);
      }
      // A slow tumble left over from the push-off, cancelled in the second shot.
      roll = index === 0 ? 0.22 * l : index === 1 ? 0.22 * (1 - l) : 0;
      puff = index === 1 && l < 0.8;
      burn.current = index === 0 && l < 0.12 ? 1 : 0;
      if (index === 0) { pos = mix3([30, 9, 24], [34, 11, 34], l); look = [0, 0, 20]; }
      else if (index === 1) { pos = mix3([16, 6, -14], [13, 5, -17], l); look = [0, -1, 4]; }
      else { pos = mix3([9, 7, 26], [11, 9, 40], l); look = [0, -8, -80]; }
      // The station is already out there: far ahead at first, then growing as the film ends.
      if (station.current) { station.current.visible = index === 2; station.current.position.set(-6, 4, -mix(520, 230, l)); }
    } else if (kind === 'fault') {
      // Coasting quietly, then a red warning light.
      warn = index === 1;
      if (index === 0) { pos = mix3([16, 6, 20], [13, 5, 17], l); look = [0, 0, 2]; }
      else { pos = mix3([10, 4, -12], [8, 3, -9], l); look = [0, 0.5, -1]; }
    } else if (kind === 'aboard' || kind === 'alarm') {
      // Docked: the two vehicles as one, seen from a slow pass around them.
      station.current?.position.set(0, 0, DOCKED_Z);
      warn = kind === 'alarm' && index === 1;
      puff = warn;
      if (index === 0) { const a = 0.5 + l * 0.5; pos = [Math.sin(a) * 62, 16, Math.cos(a) * 62 - 12]; look = [0, 2, -16]; }
      else if (kind === 'aboard') { pos = mix3([15, 5, 2], [11, 3.5, -3], l); look = [0, 0, -7]; }
      else { pos = mix3([20, 9, -2], [15, 7, -8], l); look = [-4, 0, -16]; }
    } else {
      // Home shrinks behind, the new world grows ahead, then the lander leaves.
      const far = kind === 'moon' ? 900 : 1100;
      const near = kind === 'moon' ? 430 : 520;
      if (home.current) {
        home.current.visible = index === 0;
        home.current.position.set(-46, 14, 230 + 260 * l);
      }
      const dz = index === 0 ? far : index === 1 ? mix(far, near, l) : mix(near, near - 70, l);
      world.current?.position.set(index === 2 ? mix(40, 20, l) : 40, index === 2 ? mix(-10, -120, l) : -10, -dz);
      if (lander.current) {
        lander.current.visible = index === 2;
        lander.current.position.set(0, -5 - 9 * l, -9 - 22 * l);
      }
      if (plasma.current) {
        const hot = kind === 'mars' && index === 2 ? Math.max(0, l - 0.45) * 1.6 : 0;
        plasma.current.visible = hot > 0.02;
        (plasma.current.material as THREE.MeshBasicMaterial).opacity = Math.min(0.7, hot);
      }
      if (index === 0) { pos = [11, 7, -24]; look = [-6, -4, 40]; burn.current = l < 0.5 ? 1 : 0; }
      else if (index === 1) { pos = mix3([10, 8, 30], [8, 7, 24], l); look = [14, -14, -200]; }
      else { pos = mix3([15, 2, 2], [13, -1, -8], l); look = [0, -5 - 9 * l, -9 - 22 * l]; landerBurn.current = kind === 'moon' && l > 0.55 ? 0.8 : 0; }
    }
    if (craft.current) craft.current.rotation.z = roll;
    if (beacon.current) {
      // The warning light blinks. With reduced motion it stays lit.
      beacon.current.visible = warn;
      (beacon.current.material as THREE.MeshBasicMaterial).opacity = props.still || Math.sin(t * 9) > 0 ? 1 : 0.15;
    }
    if (jets.current) {
      // Short thruster pulses: alternate sides, a few times a second.
      const on = puff && kind === 'insertion';
      jets.current.children.forEach((j, i) => { j.visible = on && (props.still ? i === 0 : Math.floor(t * 5) % 2 === i); });
    }
    if (leak.current) {
      leak.current.visible = puff && kind === 'alarm';
      leak.current.children.forEach((p, i) => {
        const k = props.still ? 0.3 + i * 0.15 : (t * 0.6 + i * 0.25) % 1;
        p.position.set(-1.5 - k * 9, 1 + k * 2.5 * (i % 2 ? 1 : -0.4), 0);
        p.scale.setScalar(0.4 + k * 2.4);
        ((p as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - k);
      });
    }
    camera.position.set(...pos);
    camera.lookAt(...look);
  });

  return (
    <>
      <Stars />
      <ambientLight intensity={0.18} />
      <SunLight direction={[0.6, 0.5, 0.6]} intensity={3.6} size={40} />
      <SunDisc direction={[0.6, 0.5, 0.6]} />
      <group ref={craft}>
        <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 7]}><Orbiter power={burn} /></group>
        {/* Warning light on the hull, and the small thrusters that hold the orbiter steady */}
        <mesh ref={beacon} visible={false} position={[0, 2.9, 2]}>
          <sphereGeometry args={[0.35, 16, 12]} />
          <meshBasicMaterial color="#ff3b30" transparent />
        </mesh>
        <group ref={jets}>
          {[-1, 1].map((sd) => (
            <mesh key={sd} visible={false} position={[sd * 3.4, 0.4, -1]} rotation={[0, 0, (sd * -Math.PI) / 2]}>
              <coneGeometry args={[0.35, 1.8, 12, 1, true]} />
              <meshBasicMaterial color="#e8f4ff" transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
          ))}
        </group>
      </group>
      {nearEarth && <EarthGlobe position={[60, -1150, -300]} radius={1100} spin={0.006} below />}
      {hasCore && (
        <group ref={core}>
          <mesh material={m.hull}><cylinderGeometry args={[2.6, 2.6, 34, 24]} /></mesh>
          <mesh position={[0, -17.8, 0]} material={m.darkSteel}><cylinderGeometry args={[1.5, 2.2, 2.2, 20, 1, true]} /></mesh>
          <mesh position={[0, 11, 0]} material={m.navy}><cylinderGeometry args={[2.63, 2.63, 1.2, 24]} /></mesh>
        </group>
      )}
      {hasStation && (
        <group ref={station}>
          <StationExterior />
          {/* Air escaping from a module, drawn so the leak can be seen */}
          <group ref={leak} visible={false} position={[-9, 0.6, -8]}>
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i}><sphereGeometry args={[0.6, 12, 10]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} /></mesh>
            ))}
          </group>
        </group>
      )}
      {(kind === 'moon' || kind === 'mars') && (
        <>
          <group ref={home}><EarthGlobe position={[0, 0, 0]} radius={kind === 'moon' ? 62 : 9} spin={0.02} /></group>
          <group ref={world}><Planet map={kind} radius={kind === 'moon' ? 150 : 190} haze={kind === 'mars' ? '#e6a877' : undefined} /></group>
          <group ref={lander} visible={false}>
            {kind === 'moon' ? <LunarLander power={landerBurn} /> : <MarsLander />}
            <mesh ref={plasma} visible={false} position={[0, -1.4, -0.6]}>
              <sphereGeometry args={[3.2, 24, 16]} />
              <meshBasicMaterial color="#ff8a3d" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          </group>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Surface: the Moon and Mars outposts after landing, and the lunar sunset
// ---------------------------------------------------------------------------

/** Gentle ground that is flat where the lander stands. */
const surfaceHeight = (x: number, z: number) => (fbm(x * 0.035, z * 0.035, 4) - 0.5) * 2.4 * Math.min(1, Math.max(0, Math.hypot(x, z) - 28) / 40);

function SurfaceScene(props: SceneProps) {
  const kind = props.def.id as 'moonbase' | 'shadow' | 'marsbase';
  const mars = kind === 'marsbase';
  const read = useShot(props);
  const sun = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.AmbientLight>(null);
  const dust = useRef<THREE.Group>(null);
  const anim = useRef(makeAnim('walk'));

  useFrame(({ camera }) => {
    const { index, l, t } = read();
    let pos: V3, look: V3;
    let light = mars ? 2.6 : 3.4;
    if (kind === 'shadow') {
      // The Sun goes down: long light, then only the lamps.
      light = index === 0 ? mix(2.2, 1.2, l) : mix(1.2, 0.06, l);
      if (index === 0) { pos = mix3([20, 5, 24], [16, 4, 20], l); look = [-6, 2, -4]; }
      else { pos = mix3([8, 3, 16], [5, 2.6, 12], l); look = [-12, 2.5, -9]; }
    } else if (index === 0) { pos = mix3([15, 3.2, 17], [10, 2.6, 13], l); look = [0, 2.2, 0]; }
    else if (index === 1) { pos = mix3([4, 4, 20], [-2, 3.2, 14], l); look = [-13, 2.2, -9]; }
    else { pos = mix3([10, 2.2, 18], [12, 1.8, 22], l); look = mars ? [-10, 9, -60] : [-30, 26, -80]; }
    if (sun.current) sun.current.intensity = light;
    if (fill.current) fill.current.intensity = mars ? 0.55 : kind === 'shadow' ? 0.06 + light * 0.04 : 0.14;
    const cloud = dust.current;
    if (cloud) {
      // Dust thrown up by the engine. On the Moon it drops straight back; on Mars it hangs and drifts.
      const k = index === 0 ? l : 1;
      cloud.visible = kind !== 'shadow' && index === 0 && k < 0.95;
      cloud.children.forEach((p, i) => {
        const a = (i / cloud.children.length) * Math.PI * 2;
        const r = 2.5 + k * (mars ? 9 : 5);
        const h = mars ? 0.6 + k * 1.6 : Math.max(0.1, 6.4 * k * (1 - k));
        p.position.set(Math.cos(a) * r + (mars ? Math.sin(t + i) * 0.4 : 0), h, Math.sin(a) * r);
        p.scale.setScalar(1 + k * (mars ? 2.2 : 0.8));
        ((p as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (mars ? 0.3 : 0.4) * (1 - k);
      });
    }
    camera.position.set(...pos);
    camera.lookAt(...look);
  });

  return (
    <>
      {mars ? <SkyDome top="#b98a66" horizon="#e3bb93" /> : <Stars />}
      {mars && <fog attach="fog" args={['#dcae84', 60, 420]} />}
      <ambientLight ref={fill} intensity={0.14} />
      <directionalLight ref={sun} position={kind === 'shadow' ? [60, 9, 30] : [40, 46, 30]} intensity={3} color={mars ? '#ffe2c2' : '#ffffff'} />
      <Terrain height={surfaceHeight} kind={mars ? 'mars' : 'moon'} size={360} segments={120} repeat={52} />
      {!mars && <EarthGlobe position={[-240, 210, -640]} radius={46} spin={0.01} />}
      {mars && <mesh position={[-60, 54, -360]}><sphereGeometry args={[1.1, 12, 10]} /><meshBasicMaterial color="#cfe6ff" fog={false} /></mesh>}
      {mars ? <MarsLander /> : <LunarLander />}
      <group position={[-13, 0, -9]} rotation={[0, 0.5, 0]}><Habitat tint={mars ? 'mars' : 'moon'} beacon /></group>
      <group position={[-22, 0, 2]} rotation={[0, 0.9, 0]}><SolarArray count={3} dust={mars ? 0.35 : 0} /></group>
      {mars && <group position={[9, 0, -8]} rotation={[0, -0.6, 0]}><Rover dust={0.3} /></group>}
      <group position={[3.2, 0, 3.4]} rotation={[0, -2.2, 0]}><Astronaut anim={anim} still /></group>
      <group ref={dust} visible={false}>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i}><sphereGeometry args={[0.9, 10, 8]} /><meshBasicMaterial color={mars ? '#d79a6a' : '#b9b8b4'} transparent opacity={0.3} depthWrite={false} /></mesh>
        ))}
      </group>
    </>
  );
}

export type SequenceFamily = 'pad' | 'space' | 'moon' | 'mars';

/** Which kind of place a sequence is set in, for the sky colour behind it. */
export function sequenceFamily(id: SequenceDef['id']): SequenceFamily {
  if (id === 'site' || id === 'board' || id === 'launch') return 'pad';
  if (id === 'marsbase') return 'mars';
  if (id === 'moonbase' || id === 'shadow') return 'moon';
  return 'space';
}

export function SequenceScene(props: SceneProps) {
  const family = sequenceFamily(props.def.id);
  if (props.def.id === 'launch') return <LaunchScene {...props} />;
  return family === 'pad' ? <PadScene {...props} /> : family === 'space' ? <CruiseScene {...props} /> : <SurfaceScene {...props} />;
}
