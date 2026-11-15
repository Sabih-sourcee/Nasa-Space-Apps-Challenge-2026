// The launch vehicle, as a set of parts that leave in order.
//
// The training stack is fictional: one core stage, two side boosters, and the
// crew orbiter on top. The boosters burn out first and drop away, then the
// empty core stage, and the orbiter flies the last part on its own engine.
// Real rockets of this layout work the same way; the heights here are rounded
// and the whole climb is compressed into about a minute of play.

export const BOOSTER_SEP_ALT = 45;
export const CORE_SEP_ALT = 180;
export const ORBIT_ALT = 250;

export interface StackState {
  /** True once the part has left the vehicle. */
  boostersAway: boolean;
  coreAway: boolean;
  /** What is still flying, in words for the HUD. */
  label: string;
}

export function stackState(altitudeKm: number): StackState {
  const boostersAway = altitudeKm >= BOOSTER_SEP_ALT;
  const coreAway = altitudeKm >= CORE_SEP_ALT;
  return {
    boostersAway, coreAway,
    label: coreAway ? 'Orbiter only' : boostersAway ? 'Core stage and orbiter' : 'Boosters, core stage and orbiter',
  };
}

/**
 * How far the vehicle has tipped over from straight up, in radians. It climbs
 * straight for the first kilometre, then leans over more and more: an orbit
 * needs sideways speed, not just height.
 */
export function stackPitch(altitudeKm: number): number {
  const p = Math.min(1, Math.max(0, altitudeKm - 1) / (ORBIT_ALT - 1));
  return 1.36 * Math.sqrt(p);
}

/** Which engines are lit for a given throttle: [boosters, core, orbiter]. */
export function enginePower(altitudeKm: number, throttle: number): [number, number, number] {
  const s = stackState(altitudeKm);
  return [s.boostersAway ? 0 : throttle, s.coreAway ? 0 : throttle, s.coreAway ? throttle : 0];
}

/** The line Mission Control reads out when the vehicle passes a separation height, or null. */
export function separationCall(beforeKm: number, afterKm: number): string | null {
  if (beforeKm < BOOSTER_SEP_ALT && afterKm >= BOOSTER_SEP_ALT) return 'Booster separation. Both boosters are away.';
  if (beforeKm < CORE_SEP_ALT && afterKm >= CORE_SEP_ALT) return 'Core stage separation. The orbiter flies on its own engine now.';
  return null;
}
