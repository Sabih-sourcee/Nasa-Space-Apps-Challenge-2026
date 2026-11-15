// Commander Reyes: the recurring character who opens every mission. Each
// briefing is three short panels: where we are, what changed, your assignment.
// Reyes is an invented character. Junior gets a direct instruction, Middle is
// asked to work the problem out, Advanced gets part of the picture and the call.

import type { DemoMissionId, Tier, WorldId } from './types';

export const COMMANDER = 'Commander Reyes';

export interface BriefPanel {
  kind: 'place' | 'change' | 'assignment';
  heading: string;
  caption: string;
  /** Icon drawn large in the "what changed" panel. */
  icon?: string;
}

export interface Briefing { missionId: DemoMissionId; world: WorldId; panels: [BriefPanel, BriefPanel, BriefPanel]; firstAction: string }

/** Facts carried over from earlier missions that change what Reyes says. */
export interface Carry { batterySecured?: boolean }

interface Script {
  world: WorldId;
  place: string;
  change: string;
  icon: string;
  assign: Record<Tier, string>;
  stake: string;
  first: string;
}

const SCRIPTS: Record<DemoMissionId, Script> = {
  E02: {
    world: 'earth',
    place: 'The astronaut academy, launch site in view. Your crew suits up at the training yard before any flight.',
    change: 'One suit on the rack is not holding its pressure. Nobody flies until it is found.',
    icon: 'gauge',
    assign: {
      junior: 'Cadet, walk to the suit station and check all four items. Fix the one that reads wrong, then carry the pouch through the gravity lanes.',
      middle: 'Cadet, run the suit check. One reading is off. Work out which one and why before you ask for clearance.',
      advanced: 'Cadet, something is wrong with that suit, maybe more than one thing. The reference card is closed. Your call.',
    },
    stake: 'A leak found here costs a minute. A leak found outside costs the mission.',
    first: 'Walk to the suit station on your left.',
  },
  F01: {
    world: 'shuttle',
    place: 'Flight deck, on the pad. The crew is strapped in and the tower is ready to let go.',
    change: 'Guidance has been drifting in tests. Expect it to push us off course on the way up.',
    icon: 'target',
    assign: {
      junior: 'Cadet, confirm each checklist item with E. After liftoff hold Space, keep the ring in the centre, and cut the engines at orbit speed.',
      middle: 'Cadet, run the checklist and fly the gates. When guidance drifts, you correct it. Watch your fuel.',
      advanced: 'Cadet, you have one miss to spare and a narrow speed band. I will call the fault. You fly it.',
    },
    stake: 'Miss too many gates and the flight computer ends the attempt.',
    first: 'The launch checklist is on your right.',
  },
  F03: {
    world: 'shuttle',
    place: 'Transfer craft, on our way to the station. Four rooms: cockpit, engineering, life support and cargo.',
    change: 'One power line dropped during ascent. The guidance display is dark and the main air fan has stopped.',
    icon: 'bolt',
    assign: {
      junior: 'Cadet, start in engineering. Inspect the failed line, fetch the spare connector and fit it to the navigation socket. I will call the next room.',
      middle: 'Cadet, we have one spare connector and two dark systems. Check what still works, decide what gets the power, secure our lunar cargo and get us ready to dock.',
      advanced: 'Cadet, one line is down and I do not have the full picture. One spare. Navigation or air: you decide the order. Secure the cargo if you can.',
    },
    stake: 'That loose battery in the cargo bay is for the Moon. If it is not latched before docking, somebody digs it out later.',
    first: 'The failed power line is in engineering, right beside you.',
  },
  S01: {
    world: 'station',
    place: 'Twenty-five metres from the orbital station. The docking port is dead ahead.',
    change: 'Out here nothing slows us down unless we fire thrusters. Too fast or off line, and the port will refuse us.',
    icon: 'gauge',
    assign: {
      junior: 'Cadet, put the cross under your crosshair, then come in slowly. Hold X to brake. Inside, push off, drift and grab the rails to move the cargo bag.',
      middle: 'Cadet, line up first, then manage your closing speed. Inside there is loose cargo. Plan each push before you let go.',
      advanced: 'Cadet, no damping on the thrusters today and the bag is drifting. Small inputs. You have the ship.',
    },
    stake: 'A refused approach backs us off to try again. A missed rail leaves you drifting until you reel in.',
    first: 'The docking port is straight ahead.',
  },
  S04: {
    world: 'station',
    place: 'Inside the orbital station. Three modules open off this one: lab, crew and storage.',
    change: 'A pressure alert. Air is leaking from one module, and an experiment canister is still inside the lab.',
    icon: 'warning',
    assign: {
      junior: 'Cadet, read the three hatch gauges, then report the one that is falling at the main console. I will help you choose what to do next.',
      middle: 'Cadet, the lowest number is not always the leak. Find the pressure that is still falling, report it, then choose: seal now or rescue the experiment.',
      advanced: 'Cadet, one sensor may be lying to you. Find the real leak. Seal or rescue is your decision, and the air reserve is the clock.',
    },
    stake: 'A wrong report seals a healthy module and wastes air. Every second the hatch stays open costs more.',
    first: 'Follow the blue ring to the first hatch gauge.',
  },
  L02: {
    world: 'moon',
    place: 'Lunar orbit, above the south pole outpost. The habitat is waiting for its new shift.',
    change: 'The Sun is about to slip behind the crater rim, and space weather is watching a solar particle event.',
    icon: 'sun',
    assign: {
      junior: 'Cadet, land us gently in the ring of lights. Carry the supplies inside. Then you run the power: air first, and get the crew into shelter when the alert comes.',
      middle: 'Cadet, land, set up, and then plan the power shift by shift. Anything you do not spend is banked. You will want it when the shadow arrives.',
      advanced: 'Cadet, you have the lander and the habitat. Earth can advise, but the answer arrives late. Decide what to spend before you know everything.',
    },
    stake: 'Spend the power on crops now and the shelter fans may go without it later.',
    first: 'Hold Space to slow the lander and steer for the ring of lights.',
  },
  L03: {
    world: 'moon',
    place: 'Inside the lunar outpost. Storage rack, grow rack and the shielded crew room, all under one roof.',
    change: 'The panels are about to lose sunlight, and a solar particle alert may follow. We have exactly one spare battery.',
    icon: 'battery',
    assign: {
      junior: 'Cadet, find our spare battery. Plug it into the grow rack and run one crop cycle. Then carry it to the shelter socket and call the crew in.',
      middle: 'Cadet, find the battery. The plants need power, and we may need to move the crew into shelter. One battery, two sockets: plan the order.',
      advanced: 'Cadet, find the battery. It is lower on charge than I would like, and I cannot tell you when the alert arrives. Spend it wisely.',
    },
    stake: 'The shelter walls protect the crew with no power at all. The battery only runs the fans, and the plants want it too.',
    first: 'Find the spare battery.',
  },
  M04: {
    world: 'mars',
    place: 'High above Mars, heat shield forward. The outpost and its rover are waiting below.',
    change: 'A dust storm is moving in. Dust on the panels means less power, for longer than one shift.',
    icon: 'air',
    assign: {
      junior: 'Cadet, open the parachute when I call it, drop it, then land on the engine. Check the rover, get inside, and keep the air running through the storm.',
      middle: 'Cadet, parachute, then engine. On the ground, decide early whether to clean the panels or save the power. The storm lasts three shifts.',
      advanced: 'Cadet, the air is thin and the storm is long. Earth is up to twenty-four minutes away by radio. Make the calls yourself.',
    },
    stake: 'A unit spent on the panel brush today comes back twice over tomorrow, if the air can spare it.',
    first: 'Wait for the parachute prompt, then press E.',
  },
};

export function briefingFor(id: DemoMissionId, tier: Tier, carry: Carry = {}): Briefing {
  const s = SCRIPTS[id];
  let change = s.change;
  let first = s.first;
  if (id === 'L03') {
    if (carry.batterySecured === true) {
      change += ' Good news: you latched it aboard the ship, so it is waiting at the near rack.';
      first = 'The battery is on the storage rack beside you.';
    } else if (carry.batterySecured === false) {
      change += ' It was never latched aboard the ship, so it is still strapped in the cargo crate by the airlock.';
      first = 'The battery is in the cargo crate by the airlock. Open the crate first.';
    }
  }
  return {
    missionId: id, world: s.world, firstAction: first,
    panels: [
      { kind: 'place', heading: 'Where we are', caption: s.place },
      { kind: 'change', heading: 'What changed', caption: change, icon: s.icon },
      { kind: 'assignment', heading: 'Your assignment', caption: `“${s.assign[tier]}” ${s.stake}` },
    ],
  };
}
