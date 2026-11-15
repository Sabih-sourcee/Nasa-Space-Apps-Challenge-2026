// Journey sequences: the short in-engine films before and after a mission.
// This file is only the script: shots, lengths and captions. A sequence never
// changes game state, so watching it and skipping it end in exactly the same
// place, and a reload in the middle simply carries on with the mission.
//
// Every mission has a film before it, after it, or both, shaped by what is
// happening: a calm arrival, a short warning before an emergency, a landing
// settling down. Emergency openings are kept short so the player can act.

import type { DemoMissionId } from './types';

export type SequenceId =
  | 'site' | 'board' | 'launch' | 'insertion' | 'fault' | 'orbit' | 'aboard'
  | 'alarm' | 'moon' | 'moonbase' | 'shadow' | 'mars' | 'marsbase';

export interface Shot {
  id: string;
  seconds: number;
  speaker: 'Commander Reyes' | 'Mission Control';
  caption: string;
}

export interface SequenceDef {
  id: SequenceId;
  title: string;
  /** The mission this film belongs to, and whether it plays before or after it. */
  mission: DemoMissionId;
  when: 'before' | 'after';
  /** An emergency opening: short, so the player gets control quickly. */
  urgent?: boolean;
  shots: Shot[];
  /** What was shortened or invented, shown under the film. */
  simplified: string;
}

const R = 'Commander Reyes' as const;
const MC = 'Mission Control' as const;

export const SEQUENCES: Record<SequenceId, SequenceDef> = {
  site: {
    id: 'site', title: 'The launch site', mission: 'E02', when: 'before',
    shots: [
      { id: 'wide', seconds: 6, speaker: MC, caption: 'This is the launch site. The rocket on the pad will carry you to orbit.' },
      { id: 'yard', seconds: 6, speaker: R, caption: 'Down here is the training yard: the suit station, the supplies and the gravity lanes.' },
      { id: 'cadet', seconds: 5, speaker: R, caption: 'Prepare the supplies, check your suit, and complete the movement drill before boarding.' },
    ],
    simplified: 'A real launch site is far larger, and training takes about two years. The yard and the rocket are fictional.',
  },
  board: {
    id: 'board', title: 'Walk to the pad', mission: 'E02', when: 'after',
    shots: [
      { id: 'walk', seconds: 6, speaker: R, caption: 'Suit checked, training passed. Walk out to the pad, Cadet. Your ride is waiting.' },
      { id: 'stack', seconds: 6, speaker: MC, caption: 'One core stage, two boosters, and your orbiter on top. The boosters leave first, then the core.' },
      { id: 'arm', seconds: 5, speaker: R, caption: 'Up the tower and across the crew arm. Strap in. Level one is complete.' },
    ],
    simplified: 'A real crew rides to the pad and takes a lift up the tower hours before launch. The stack is a fictional training vehicle.',
  },
  launch: {
    id: 'launch', title: 'Liftoff', mission: 'F01', when: 'before',
    shots: [
      { id: 'count', seconds: 5, speaker: MC, caption: 'Hatch locked, suit air flowing, engines armed. Five. Four. Three. Two. One.' },
      { id: 'ignite', seconds: 5, speaker: MC, caption: 'Ignition. Two boosters and the core engines at full power. Liftoff!' },
      { id: 'climb', seconds: 6, speaker: R, caption: 'Up through the thick lower air. Watch the sky turn dark as the air thins out.' },
      { id: 'boosters', seconds: 6, speaker: MC, caption: 'Boosters empty at 45 kilometres. They let go and fall away. The core stage carries you on.' },
    ],
    simplified: 'About two minutes of flight are cut to a few seconds. The boosters are solid rocket motors: once empty they are dead weight, so they are dropped.',
  },
  insertion: {
    id: 'insertion', title: 'Earth departure', mission: 'F01', when: 'after',
    shots: [
      { id: 'release', seconds: 6, speaker: MC, caption: 'Engines off at orbital speed. The empty core stage lets go and drifts behind.' },
      { id: 'steady', seconds: 6, speaker: R, caption: 'Small thrusters stop the tumble and hold you steady. Nothing else will slow you up here.' },
      { id: 'depart', seconds: 6, speaker: R, caption: 'Earth departure confirmed. That bright shape ahead is the station: your next stop.' },
    ],
    simplified: 'Real upper stages burn a second time to round out the orbit. Here it is one burn, and the separation is shown from close by.',
  },
  fault: {
    id: 'fault', title: 'Power fault', mission: 'F03', when: 'before', urgent: true,
    shots: [
      { id: 'coast', seconds: 4, speaker: MC, caption: 'The ship is coasting toward the station. All systems were normal.' },
      { id: 'warning', seconds: 5, speaker: R, caption: 'Warning light: a power line has failed. Get to engineering, Cadet. I will talk you through it.' },
    ],
    simplified: 'The fault is invented for training. Real crews practise failures like this for months before a flight.',
  },
  orbit: {
    id: 'orbit', title: 'Orbit to the station', mission: 'S01', when: 'before',
    shots: [
      { id: 'coast', seconds: 6, speaker: MC, caption: 'You are in orbit. The empty core stage is far behind, and Earth turns below you.' },
      { id: 'chase', seconds: 7, speaker: R, caption: 'The station is ahead. Catching it takes real crews hours of small burns. We have shortened that.' },
      { id: 'port', seconds: 5, speaker: R, caption: 'Docking camera on. Line up with the port and arrive slowly.' },
    ],
    simplified: 'The rendezvous is compressed from many hours to a few seconds, and the orbiter is shown much closer to the station than a real approach begins.',
  },
  aboard: {
    id: 'aboard', title: 'Aboard the station', mission: 'S01', when: 'after',
    shots: [
      { id: 'joined', seconds: 6, speaker: MC, caption: 'Orbiter and station are one vehicle now, circling Earth together about every 90 minutes.' },
      { id: 'thanks', seconds: 6, speaker: R, caption: 'Cargo is stowed and the station crew says thank you. That was careful flying.' },
    ],
    simplified: 'The station is a fictional training station, much smaller than the real one.',
  },
  alarm: {
    id: 'alarm', title: 'Pressure alarm', mission: 'S04', when: 'before', urgent: true,
    shots: [
      { id: 'calm', seconds: 4, speaker: MC, caption: 'A quiet shift on the station. Then a sensor trips.' },
      { id: 'leak', seconds: 5, speaker: R, caption: 'Air is leaking from one module. Read the hatch gauges and find which one. Go.' },
    ],
    simplified: 'A real leak this size could not be seen from outside. The puff of air is drawn so the problem is clear.',
  },
  moon: {
    id: 'moon', title: 'To the Moon', mission: 'L02', when: 'before',
    shots: [
      { id: 'leave', seconds: 6, speaker: MC, caption: 'Engine burn complete. Earth is falling behind. The trip takes about three days.' },
      { id: 'arrive', seconds: 7, speaker: R, caption: 'There is the Moon. No air and no weather: every shadow is sharp.' },
      { id: 'undock', seconds: 6, speaker: R, caption: 'Lander away. No parachute works here, because there is no air. You land on engine power alone.' },
    ],
    simplified: 'Three days of coasting are cut to seconds. Sizes and distances of Earth and the Moon are not to scale.',
  },
  moonbase: {
    id: 'moonbase', title: 'On the Moon', mission: 'L02', when: 'after',
    shots: [
      { id: 'settle', seconds: 6, speaker: MC, caption: 'Engine off. With no air, the dust you kicked up fell straight back down.' },
      { id: 'habitat', seconds: 6, speaker: R, caption: 'The habitat is powered and holding its air. Your crew is safe inside tonight.' },
      { id: 'home', seconds: 5, speaker: R, caption: 'Look up. That small blue world is home. Good work, Cadet.' },
    ],
    simplified: 'The outpost is fictional. Earth is drawn larger in the lunar sky than it really looks.',
  },
  shadow: {
    id: 'shadow', title: 'Night is coming', mission: 'L03', when: 'before', urgent: true,
    shots: [
      { id: 'day', seconds: 4, speaker: MC, caption: 'The Sun is low over the outpost, and the solar panels are fading.' },
      { id: 'dark', seconds: 5, speaker: R, caption: 'Night on the Moon lasts about two weeks. We have one battery. Find it and choose where it goes.' },
    ],
    simplified: 'Sunset on the Moon takes hours, not seconds. The power numbers in the mission are invented.',
  },
  mars: {
    id: 'mars', title: 'To Mars', mission: 'M04', when: 'before',
    shots: [
      { id: 'cruise', seconds: 6, speaker: MC, caption: 'The cruise to Mars takes about seven months. We are skipping ahead to arrival.' },
      { id: 'arrive', seconds: 7, speaker: R, caption: 'Mars. Thin air, red dust, and a signal delay of many minutes. You make the calls here.' },
      { id: 'entry', seconds: 6, speaker: R, caption: 'Capsule away, heat shield first. The air slows you, then the parachute, then your engine.' },
    ],
    simplified: 'Months of travel are cut to seconds. The capsule is a fictional training vehicle: real Mars landers have used several different designs.',
  },
  marsbase: {
    id: 'marsbase', title: 'On Mars', mission: 'M04', when: 'after',
    shots: [
      { id: 'settle', seconds: 6, speaker: MC, caption: 'The storm has passed. Fine dust still hangs in the thin air and settles slowly.' },
      { id: 'outpost', seconds: 6, speaker: R, caption: 'The outpost came through. Your choices kept the crew, the power and the crops going.' },
      { id: 'far', seconds: 5, speaker: R, caption: 'Earth is a bright dot from here. You have gone further than anyone, Cadet.' },
    ],
    simplified: 'The outpost and the storm are fictional. Real Martian dust can take months to clear after a large storm.',
  },
};

/** The film that plays before a mission, the first time it is flown. */
export const SEQUENCE_INTO: Partial<Record<DemoMissionId, SequenceId>> = {
  E02: 'site', F01: 'launch', F03: 'fault', S01: 'orbit', S04: 'alarm', L02: 'moon', L03: 'shadow', M04: 'mars',
};

/** The film that plays after a mission, the first time it is completed. */
export const SEQUENCE_AFTER: Partial<Record<DemoMissionId, SequenceId>> = {
  E02: 'board', F01: 'insertion', S01: 'aboard', L02: 'moonbase', M04: 'marsbase',
};

/** Every film that belongs to a mission, in the order it is seen. */
export function sequencesFor(mission: DemoMissionId): SequenceId[] {
  return [SEQUENCE_INTO[mission], SEQUENCE_AFTER[mission]].filter((x): x is SequenceId => !!x);
}

export function sequenceSeconds(def: SequenceDef): number {
  return def.shots.reduce((sum, s) => sum + s.seconds, 0);
}

/** Which shot is on screen at a time, and how far through it (0 to 1). Past the end it reports done. */
export function shotAt(def: SequenceDef, t: number): { index: number; local: number; done: boolean } {
  let start = 0;
  for (let i = 0; i < def.shots.length; i++) {
    const len = def.shots[i].seconds;
    if (t < start + len) return { index: i, local: Math.max(0, (t - start) / len), done: false };
    start += len;
  }
  return { index: def.shots.length - 1, local: 1, done: true };
}

/** The time a shot starts, for stepping through with reduced motion. */
export function shotStart(def: SequenceDef, index: number): number {
  return def.shots.slice(0, index).reduce((sum, s) => sum + s.seconds, 0);
}
