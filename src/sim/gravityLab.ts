// Gravity Test Chamber: the rules. One glass tube, five places to copy.
// Pure and deterministic, like the rest of src/sim: no React, no three.js.

export type LabWorldId = 'moon' | 'mars' | 'earth' | 'jupiter' | 'station';

export interface LabWorld {
  id: LabWorldId;
  name: string;
  /** The pull you feel, in m/s2. Zero on the station, where everything falls together. */
  g: number;
  /** Compared with Earth. */
  ratio: number;
  /** Air pressure outside a suit, in kPa. Null where there is no ground to measure it on. */
  pressureKPa: number | null;
  pressureText: string;
  /** One line under the name. */
  tagline: string;
  /** What changes in the body there. */
  body: string[];
  /** What you need to survive there. */
  suit: string;
  /** The floor colour inside the tube. */
  ground: string;
  sourceId: string;
}

/** A cadet of about ten. Mass is the same everywhere: only the weight changes. */
export const CADET_MASS = 32;
/** The same leg push on every world, so only gravity changes the jump. */
export const PUSH_SPEED = 2.6;
export const DROP_HEIGHT = 2;
/** How high the feet can rise before the helmet meets the top of the tube. */
export const HEAD_ROOM = 3.4;
export const EARTH_G = 9.8;
export const EARTH_PRESSURE = 101.3;

export const LAB_WORLDS: LabWorld[] = [
  {
    id: 'moon', name: 'Moon', g: 1.62, ratio: 0.166, pressureKPa: 0, pressureText: 'Almost none: a vacuum',
    tagline: 'One sixth of Earth gravity',
    body: [
      'You weigh one sixth as much, so walking turns into a slow, floating hop.',
      'Bones and muscles get much less work than on Earth, so crews would need to exercise to stay strong.',
      'With no air pressing on you, the suit has to do the pressing.',
    ],
    suit: 'A pressure suit that carries its own air. There is none outside.',
    ground: '#8a8987', sourceId: 'gravity',
  },
  {
    id: 'mars', name: 'Mars', g: 3.71, ratio: 0.377, pressureKPa: 0.6, pressureText: '0.6 kPa: under 1% of Earth',
    tagline: 'A bit more than one third of Earth gravity',
    body: [
      'You weigh a little over one third as much. Jumps go more than twice as high.',
      'Lighter work for bones and muscles than on Earth, so exercise still matters on a long stay.',
      'The air is so thin, and mostly carbon dioxide, that you cannot breathe it.',
    ],
    suit: 'A pressure suit with oxygen. The thin air cannot keep your body safe.',
    ground: '#a65a34', sourceId: 'gravity',
  },
  {
    id: 'earth', name: 'Earth', g: 9.8, ratio: 1, pressureKPa: 101.3, pressureText: '101 kPa at sea level',
    tagline: 'Home: the pull your body is built for',
    body: [
      'Your bones, muscles, heart and sense of balance all grew up with this pull.',
      'Standing, walking and carrying things keep bones and muscles strong without you noticing.',
      'A thick blanket of air presses on you all the time, and you breathe it.',
    ],
    suit: 'Nothing. This is the one world where you can just walk outside.',
    ground: '#6f7d4d', sourceId: 'gravity',
  },
  {
    id: 'jupiter', name: 'Jupiter', g: 23.1, ratio: 2.36, pressureKPa: null, pressureText: 'No ground. Crushing deeper down',
    tagline: 'More than twice Earth gravity',
    body: [
      'You would feel more than twice as heavy. Even lifting an arm is hard work.',
      'Your heart would have to push much harder to get blood up to your head.',
      'Jupiter is a gas giant with no ground to stand on. This tube only copies its pull.',
    ],
    suit: 'Nobody can land here. Spacecraft study Jupiter from orbit.',
    ground: '#b98d58', sourceId: 'gravity',
  },
  {
    id: 'station', name: 'Space station', g: 0, ratio: 0, pressureKPa: 101.3, pressureText: '101 kPa inside the cabin',
    tagline: 'Floating: everything falls together',
    body: [
      'Bones and muscles have almost no work to do. Without exercise, crews lose about 1 to 1.5% of bone strength each month.',
      'Body fluid drifts up toward the head: a puffy face and thinner legs.',
      'The spine stretches, so astronauts can grow up to 3% taller. They exercise about 2 hours every day.',
    ],
    suit: 'No suit inside: the cabin has air like Earth. A suit is for spacewalks.',
    ground: '#c9d2dc', sourceId: 'body_in_space',
  },
];

export const LAB_WORLD: Record<LabWorldId, LabWorld> = Object.fromEntries(LAB_WORLDS.map((w) => [w.id, w])) as Record<LabWorldId, LabWorld>;

/** What a bathroom scale from Earth would show, in kg. */
export function scaleReading(world: LabWorld, mass = CADET_MASS): number {
  return (mass * world.g) / EARTH_G;
}

/** Height of one jump with the standard push, in metres. Null where nothing brings you back down. */
export function jumpHeight(world: LabWorld): number | null {
  return world.g > 0 ? (PUSH_SPEED * PUSH_SPEED) / (2 * world.g) : null;
}

/** Time for the ball to fall the drop height, in seconds. Null where it does not fall. */
export function fallTime(world: LabWorld, height = DROP_HEIGHT): number | null {
  return world.g > 0 ? Math.sqrt((2 * height) / world.g) : null;
}

export type LabEvent =
  | { kind: 'jump'; height: number | null; air: number }
  | { kind: 'drop'; time: number | null };

export interface LabState {
  /** Height of the feet above the floor. */
  y: number;
  vy: number;
  grounded: boolean;
  peak: number;
  air: number;
  /** Seconds spent drifting since the last push on the station. -1 when not counting. */
  floatT: number;
  ballY: number;
  ballVy: number;
  ball: 'held' | 'falling' | 'rest';
  dropT: number;
  /** Set only on the step something finishes. */
  event: LabEvent | null;
}

export function makeLab(world: LabWorld): LabState {
  const floating = world.g === 0;
  return { y: floating ? 0.7 : 0, vy: 0, grounded: !floating, peak: 0, air: 0, floatT: -1, ballY: DROP_HEIGHT, ballVy: 0, ball: 'held', dropT: 0, event: null };
}

export function stepLab(s: LabState, inp: { jump: boolean; drop: boolean }, dt: number, world: LabWorld): LabState {
  let { y, vy, grounded, peak, air, floatT, ballY, ballVy, ball, dropT } = s;
  let event: LabEvent | null = null;

  if (world.g > 0) {
    if (inp.jump && grounded) { vy = PUSH_SPEED; grounded = false; peak = 0; air = 0; }
    if (!grounded) {
      // Exact for a steady pull, so the measured jump matches the number on the panel.
      y += vy * dt - 0.5 * world.g * dt * dt;
      vy -= world.g * dt;
      air += dt;
      if (y >= HEAD_ROOM) { y = HEAD_ROOM; vy = Math.min(vy, 0); }
      peak = Math.max(peak, y);
      if (y <= 0 && vy < 0) { y = 0; vy = 0; grounded = true; event = { kind: 'jump', height: peak, air }; }
    }
  } else {
    // Nothing pulls you back. A push sends you drifting until you touch the far end.
    grounded = false;
    if (inp.jump && Math.abs(vy) < 0.3) { vy = PUSH_SPEED * 0.4; floatT = 0; }
    y += vy * dt;
    if (y >= HEAD_ROOM) { y = HEAD_ROOM; vy = -Math.abs(vy) * 0.6; }
    if (y <= 0.15) { y = 0.15; vy = Math.abs(vy) * 0.6; }
    if (Math.abs(vy) < 0.1) vy = 0;
    if (floatT >= 0) {
      floatT += dt;
      if (floatT >= 3) { event = { kind: 'jump', height: null, air: floatT }; floatT = -1; }
    }
  }

  if (inp.drop && ball !== 'falling') { ball = 'falling'; ballY = DROP_HEIGHT; ballVy = 0; dropT = 0; }
  else if (ball === 'falling') {
    dropT += dt;
    if (world.g > 0) {
      ballY += ballVy * dt - 0.5 * world.g * dt * dt;
      ballVy -= world.g * dt;
      if (ballY <= 0) { ballY = 0; ballVy = 0; ball = 'rest'; event = { kind: 'drop', time: dropT }; }
    } else if (dropT >= 3) {
      // Let go on the station and the ball just stays where you left it.
      ball = 'held';
      event = { kind: 'drop', time: null };
    }
  }

  return { y, vy, grounded, peak, air, floatT, ballY, ballVy, ball, dropT, event };
}
