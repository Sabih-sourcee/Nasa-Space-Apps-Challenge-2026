import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useGame } from '../game/store';

export const STEP = 1 / 60;

/**
 * Test hook: when `forceDelta` is set, every rendered frame advances the game by
 * exactly that many seconds. Automated checks use it to step scenes at a fixed
 * rate even when the browser throttles animation frames. Normal play leaves it null.
 */
export const simClock: { forceDelta: number | null } = { forceDelta: null };

let webglCache: boolean | null = null;
export function webglAvailable(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement('canvas');
    webglCache = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webglCache = false;
  }
  return webglCache;
}

export function CompatMessage() {
  return (
    <div className="compat" role="alert">
      <h2>3D graphics are not available</h2>
      <p>Beyond Earth needs WebGL to draw its 3D scenes, and this browser or device could not start it.</p>
      <ul>
        <li>Try the current version of Chrome or Firefox.</li>
        <li>Turn on hardware acceleration in the browser settings, then reload.</li>
        <li>Your progress is saved on this device and will be here when 3D works.</li>
      </ul>
    </div>
  );
}

class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.error('3D scene failed', err); }
  render() { return this.state.failed ? <CompatMessage /> : this.props.children; }
}

/** Soft studio reflections so visors and metal read as real materials. Generated in code. */
function SceneEnvironment({ intensity }: { intensity: number }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  useEffect(() => { scene.environmentIntensity = intensity; }, [scene, intensity]);
  return null;
}

export interface GameCanvasProps {
  children: ReactNode;
  fov?: number;
  position?: [number, number, number];
  envIntensity?: number;
  exposure?: number;
  far?: number;
  background?: string;
}

export function GameCanvas({ children, fov = 50, position = [0, 3, 8], envIntensity = 0.35, exposure = 1, far = 1500, background = '#000000' }: GameCanvasProps) {
  const graphics = useGame((s) => s.save.settings.graphics);
  if (!webglAvailable()) return <CompatMessage />;
  const high = graphics === 'high';
  return (
    <CanvasBoundary>
      <Canvas
        key={graphics}
        shadows={high}
        dpr={high ? [1, 1.75] : 1}
        gl={{ antialias: high, powerPreference: 'high-performance' }}
        camera={{ fov, near: 0.1, far, position }}
        onCreated={(state) => {
          const { gl, scene } = state;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = exposure;
          scene.background = new THREE.Color(background);
          // Read-only handle for automated browser checks.
          (window as unknown as Record<string, unknown>).__beyondEarth3d = state;
        }}
      >
        <SceneEnvironment intensity={envIntensity} />
        <PerformanceWatch />
        {children}
      </Canvas>
    </CanvasBoundary>
  );
}

/**
 * Fixed-step simulation loop. `step` advances game rules at 60 Hz regardless of
 * frame rate; `after` updates meshes and the camera once per rendered frame.
 */
export function useSim(step: (dt: number) => void, after?: (delta: number, elapsed: number) => void): void {
  const acc = useRef(0);
  const stepRef = useRef(step);
  const afterRef = useRef(after);
  stepRef.current = step;
  afterRef.current = after;
  useFrame((state, delta) => {
    const d = simClock.forceDelta ?? Math.min(delta, 0.1);
    if (!useGame.getState().paused) {
      acc.current += d;
      let guard = 0;
      while (acc.current >= STEP && guard++ < 8) {
        stepRef.current(STEP);
        acc.current -= STEP;
      }
    }
    afterRef.current?.(d, state.clock.elapsedTime);
  });
}

let slowHintShown = false;

/**
 * Watches real frame times. If the High preset runs slowly for a few seconds,
 * it suggests the Low preset once. Background-tab frames are ignored.
 */
function PerformanceWatch() {
  const samples = useRef<number[]>([]);
  useFrame((_, delta) => {
    if (slowHintShown || simClock.forceDelta !== null || delta > 0.25) return;
    const game = useGame.getState();
    if (game.save.settings.graphics !== 'high' || game.paused) return;
    samples.current.push(delta);
    if (samples.current.length < 240) return;
    const avg = samples.current.reduce((a, b) => a + b, 0) / samples.current.length;
    samples.current = [];
    if (avg > 0.042) {
      slowHintShown = true;
      useGame.setState({ notes: [...game.notes, 'The picture is running slowly on this device. You can switch to the Low graphics preset in Settings (Pause, then Settings).'] });
    }
  });
  return null;
}

export function useReducedMotion(): boolean {
  return useGame((s) => s.save.settings.reducedMotion);
}

/** Sun light whose shadow box follows a moving point, so shadows stay crisp near the player. */
export function SunLight({ direction, intensity, color = '#ffffff', follow, size = 22 }: {
  direction: [number, number, number]; intensity: number; color?: string;
  follow?: React.MutableRefObject<{ x: number; y?: number; z: number }>; size?: number;
}) {
  const light = useRef<THREE.DirectionalLight>(null);
  const dir = useMemo(() => new THREE.Vector3(...direction).normalize(), [direction]);
  const high = useGame((s) => s.save.settings.graphics === 'high');
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const fx = follow?.current.x ?? 0;
    const fy = follow?.current.y ?? 0;
    const fz = follow?.current.z ?? 0;
    l.position.set(fx + dir.x * 60, fy + dir.y * 60, fz + dir.z * 60);
    l.target.position.set(fx, fy, fz);
    l.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light} intensity={intensity} color={color} castShadow={high}
      shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03}
    >
      <orthographicCamera attach="shadow-camera" args={[-size, size, size, -size, 1, 160]} />
    </directionalLight>
  );
}
