// Star ratings and astronaut ranks. Pure rules, so every rating can be tested
// and explained to the player in one sentence. A finished mission always earns
// at least one star: training resets and checkpoint recoveries only cost stars.

import { PLAYABLE, type DemoMissionId, type MissionId } from './types';

export type Stars = 1 | 2 | 3;

export interface Rating {
  stars: Stars;
  /** What to do differently next time. Null at three stars. */
  tip: string | null;
}

/** Shown on the mission card before the mission starts. */
export const STAR_GOAL: Record<DemoMissionId, string> = {
  E02: 'Judge every suit reading right the first time.',
  F01: 'Fly through every gate on your first launch.',
  F03: 'Latch the spare battery and dock on the first approach.',
  S01: 'Dock on the first approach and never need the tether.',
  S04: 'Find the leak with no wrong report, then keep 60% of the air or save the experiment.',
  L02: 'Finish with the air at 75% or more, with no checkpoint recovery.',
  L03: 'Keep crew readiness at 100%, with no checkpoint recovery.',
  M04: 'Finish with the air at 75% or more, with no checkpoint recovery.',
};

function rating(points: number, tips: (string | null)[]): Rating {
  const stars = Math.max(1, Math.min(3, Math.round(points))) as Stars;
  return { stars, tip: stars === 3 ? null : tips.find((t) => !!t) ?? null };
}

/** E02: how many suit readings or fixes were judged wrongly. */
export function rateSuitLab(mistakes: number): Rating {
  return rating(mistakes <= 0 ? 3 : mistakes <= 2 ? 2 : 1, [
    'For 3 stars, compare each reading with its safe range before you decide.',
  ]);
}

/** F01: gates passed off course in the successful climb, and how many launches it took. */
export function rateAscent(gatesMissed: number, attempts: number): Rating {
  const clean = gatesMissed <= 0;
  const first = attempts <= 1;
  return rating(clean && first ? 3 : gatesMissed <= 1 && attempts <= 2 ? 2 : 1, [
    !clean ? 'For 3 stars, steer back to the ring as soon as it slides sideways and pass every gate.' : null,
    !first ? 'For 3 stars, reach orbit on your first launch.' : null,
  ]);
}

/** S01: docking approaches used, and tether recoveries while moving the cargo. */
export function rateStation(dockAttempts: number, tetherRecoveries: number): Rating {
  const first = dockAttempts <= 1;
  const noTether = tetherRecoveries <= 0;
  return rating(first && noTether ? 3 : dockAttempts <= 2 && tetherRecoveries <= 1 ? 2 : 1, [
    !first ? 'For 3 stars, brake early and dock on the first approach.' : null,
    !noTether ? 'For 3 stars, grab a rail every time so you never need the tether.' : null,
  ]);
}

/** S04: wrong leak reports, the air reserve at the end, and whether the experiment was rescued. */
export function rateAlert(wrongCalls: number, reserve: number, experimentSaved: boolean): Rating {
  const found = wrongCalls <= 0;
  const outcome = experimentSaved || reserve >= 60;
  return rating(1 + (found ? 1 : 0) + (outcome ? 1 : 0), [
    !found ? 'For 3 stars, read all three gauges first. Only one pressure is still falling.' : null,
    !outcome ? 'For 3 stars, seal the hatch while 60% of the air is left, or save the experiment.' : null,
  ]);
}

/** L02 and M04: the air comfort score at the end of the last shift, and checkpoint recoveries used. */
export function rateOutpost(air: number, recoveries: number): Rating {
  const fresh = air >= 75;
  const clean = recoveries <= 0;
  return rating(fresh && clean ? 3 : air >= 55 ? 2 : 1, [
    !fresh ? 'For 3 stars, keep the air at 75% or more. Replay a decision and try a different power plan.' : null,
    !clean ? 'For 3 stars, finish without a checkpoint recovery.' : null,
  ]);
}

/** F03: whether the spare battery was latched for the Moon, and docking approaches used. */
export function rateShip(latched: boolean, dockAttempts: number): Rating {
  const first = dockAttempts <= 1;
  return rating(1 + (latched ? 1 : 0) + (first ? 1 : 0), [
    !latched ? 'For 3 stars, put the spare battery in the rack and close the latch before you dock.' : null,
    !first ? 'For 3 stars, brake early and dock on the first approach.' : null,
  ]);
}

/** L03: crew readiness when the alert has passed, and checkpoint recoveries used. */
export function rateBattery(readiness: number, recoveries: number): Rating {
  const ready = readiness >= 100;
  const clean = recoveries <= 0;
  return rating(ready && clean ? 3 : readiness >= 65 ? 2 : 1, [
    !ready ? 'For 3 stars, get the crew into a ventilated shelter before the alert has been running long. Replay the choice and try another order.' : null,
    !clean ? 'For 3 stars, finish without a checkpoint recovery.' : null,
  ]);
}

// --------------------------------------------------------------------------
// Totals and ranks
// --------------------------------------------------------------------------

export const MAX_STARS = PLAYABLE.length * 3;

/** Stars held for one mission. Missions finished before ratings existed count as one star. */
export function starsOf(record: { stars?: number } | undefined): number {
  if (!record) return 0;
  return record.stars === 2 || record.stars === 3 ? record.stars : 1;
}

export function totalStars(completed: Partial<Record<MissionId, { stars?: number }>>): number {
  return PLAYABLE.reduce((sum, id) => sum + starsOf(completed[id]), 0);
}

export interface Rank { title: string; at: number; next: { title: string; at: number } | null }

const RANKS: { title: string; at: number }[] = [
  { title: 'Space Cadet', at: 0 },
  { title: 'Flight Trainee', at: 3 },
  { title: 'Astronaut', at: 7 },
  { title: 'Mission Specialist', at: 12 },
  { title: 'Mission Commander', at: 18 },
];

export function rankFor(stars: number): Rank {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (stars >= RANKS[k].at) i = k;
  return { ...RANKS[i], next: RANKS[i + 1] ?? null };
}
