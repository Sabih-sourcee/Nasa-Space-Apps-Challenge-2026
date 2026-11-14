// Shared simulation types. Nothing in src/sim imports React or three.js.

export type Tier = 'junior' | 'middle' | 'advanced';
export const TIERS: Tier[] = ['junior', 'middle', 'advanced'];
export const TIER_LABEL: Record<Tier, string> = {
  junior: 'Junior',
  middle: 'Middle',
  advanced: 'Advanced',
};

export type WorldId = 'earth' | 'shuttle' | 'station' | 'moon' | 'mars';
export const WORLDS: WorldId[] = ['earth', 'shuttle', 'station', 'moon', 'mars'];

export type MissionId =
  | 'E01' | 'E02' | 'E03' | 'E04'
  | 'F01' | 'F02' | 'F03'
  | 'S01' | 'S02' | 'S03' | 'S04'
  | 'L01' | 'L02' | 'L03' | 'L04'
  | 'M01' | 'M02' | 'M03' | 'M04' | 'M05';

/** Every mission that can be played. */
export type DemoMissionId = 'E02' | 'F01' | 'S01' | 'S04' | 'L02' | 'M04';
/** The five-world campaign route: one mission per world, each unlocking the next. */
export const DEMO_ROUTE: DemoMissionId[] = ['E02', 'F01', 'S01', 'L02', 'M04'];
/** All playable missions in atlas order. S04 is an extra station mission off the main route. */
export const PLAYABLE: DemoMissionId[] = ['E02', 'F01', 'S01', 'S04', 'L02', 'M04'];

export const SCHEMA_VERSION = 1;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function isTier(v: unknown): v is Tier {
  return v === 'junior' || v === 'middle' || v === 'advanced';
}

export function isDemoMission(v: unknown): v is DemoMissionId {
  return typeof v === 'string' && (PLAYABLE as string[]).includes(v);
}
