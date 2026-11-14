// Mission catalog: the full 20-mission campaign plus the data that drives the
// five playable prototype missions (entry conditions, objectives, checkpoints,
// tier variants, emergency specs, success and retry conditions).

import { DEMO_ROUTE, PLAYABLE, type DemoMissionId, type MissionId, type Tier, type WorldId } from './types';

export interface CatalogEntry {
  id: MissionId;
  world: WorldId;
  title: string;
  task: string;
  obstacle: string;
  demo: boolean;
}

export const WORLD_INFO: Record<WorldId, { label: string; blurb: string }> = {
  earth: { label: 'Earth', blurb: 'Astronaut academy' },
  shuttle: { label: 'Shuttle', blurb: 'Flight to orbit' },
  station: { label: 'Orbital Station', blurb: 'Life in free fall' },
  moon: { label: 'Moon', blurb: 'Lunar south pole outpost' },
  mars: { label: 'Mars', blurb: 'Red planet expedition' },
};

export const CATALOG: CatalogEntry[] = [
  { id: 'E01', world: 'earth', title: 'The New Recruit', task: 'Learn movement and carry a checklist to the trainer.', obstacle: 'Guided recovery from a missed checkpoint.', demo: false },
  { id: 'E02', world: 'earth', title: 'Gravity and Suit Lab', task: 'Carry a pouch through a gravity course and complete a suit check.', obstacle: 'Detect and correct a simulated low-pressure reading.', demo: true },
  { id: 'E03', world: 'earth', title: 'Robotics Lab', task: 'Move cargo with a training arm and park it safely.', obstacle: 'Obstructed approach. Retract and choose a clear path.', demo: false },
  { id: 'E04', world: 'earth', title: 'Countdown Rehearsal', task: 'Check suit, communications and launch systems.', obstacle: 'A failed check requires holding the launch and clearing the fault.', demo: false },
  { id: 'F01', world: 'shuttle', title: 'Liftoff to Orbit', task: 'Run the launch checklist, steer through gates and stabilize in orbit.', obstacle: 'A guidance deviation requires steering correction or a training reset.', demo: true },
  { id: 'F02', world: 'shuttle', title: 'Rendezvous', task: 'Align the vehicle with the station approach corridor.', obstacle: 'Excess closing speed requires braking and a new approach.', demo: false },
  { id: 'F03', world: 'shuttle', title: 'Emergency Protocol', task: 'Diagnose an electrical fault and choose a backup route.', obstacle: 'A power drop reduces available systems. Preserve essential loads.', demo: false },
  { id: 'S01', world: 'station', title: 'Dock and Drift', task: 'Guide the shuttle through a docking approach, then move cargo with push, drift and grab.', obstacle: 'A missed handrail requires a recovery grab. Higher tiers add loose cargo.', demo: true },
  { id: 'S02', world: 'station', title: 'Science Lab', task: 'Secure and observe a microgravity experiment.', obstacle: 'A loose item must be retrieved and secured before the trial.', demo: false },
  { id: 'S03', world: 'station', title: 'Station Repair', task: 'Use the robotic arm to move a replacement component.', obstacle: 'A jammed fixture requires repositioning.', demo: false },
  { id: 'S04', world: 'station', title: 'Module Alert', task: 'Diagnose and isolate a fictional station module fault.', obstacle: 'A pressure alert forces a choice between isolating a module and protecting an experiment.', demo: true },
  { id: 'L01', world: 'moon', title: 'Landing Zone', task: 'Compare terrain and select a descent corridor.', obstacle: 'A hazardous slope forces a diversion.', demo: false },
  { id: 'L02', world: 'moon', title: 'Power Before Shadow', task: 'Pilot the lunar lander, exit onto the surface and run the habitat across a solar-power drop.', obstacle: 'Low generation and a separate solar-particle alert force decisions about battery reserve, crop lights and shelter.', demo: true },
  { id: 'L03', world: 'moon', title: 'Rover Traverse', task: 'Collect samples and return with adequate power and suit air.', obstacle: 'A rover fault forces a shorter route or an early return.', demo: false },
  { id: 'L04', world: 'moon', title: 'Hidden Ice', task: 'Survey a shadowed region and return to the base.', obstacle: 'Reduced visibility and instrument power limit the route.', demo: false },
  { id: 'M01', world: 'mars', title: 'Entry and Landing', task: 'Control simplified atmospheric descent and land in a designated area.', obstacle: 'A poor approach requires a safe alternate touchdown zone.', demo: false },
  { id: 'M02', world: 'mars', title: 'Red Planet Explorer', task: 'Navigate a rover and collect geological samples.', obstacle: 'A dust front reduces visibility and forces a route choice.', demo: false },
  { id: 'M03', world: 'mars', title: 'Build Your Habitat', task: 'Balance air, stored water, crop lighting, battery and shelter readiness.', obstacle: 'A pump fault reduces recycling while stored water runs down.', demo: false },
  { id: 'M04', world: 'mars', title: 'Dust Storm Outpost', task: 'Land on Mars, exit the lander and keep the outpost running as solar output falls.', obstacle: 'A dust storm reduces solar generation. Advanced also queues delayed advice from Earth.', demo: true },
  { id: 'M05', world: 'mars', title: 'Final Expedition', task: 'Keep crew and habitat safe over several shifts and finish a science objective if resources permit.', obstacle: 'Combined resource failures require prioritizing crew safety, reserves and communications.', demo: false },
];

export function catalogEntry(id: MissionId): CatalogEntry {
  return CATALOG.find((m) => m.id === id) as CatalogEntry;
}

export interface PhaseSpec { id: string; label: string; objective: string; checkpoint: string }

export interface EmergencySpec {
  id: string;
  title: string;
  trigger: string;
  warning: string;
  symptoms: string;
  actions: string;
  effects: string;
  recovery: string;
  debrief: string;
}

export interface DemoMission {
  id: DemoMissionId;
  world: WorldId;
  title: string;
  duty: string;
  goal: string;
  skill: string;
  entry: string;
  /** Mission that must be completed first. Undefined for the first mission. */
  requires?: DemoMissionId;
  controls: string[];
  startingResources: string;
  science: { text: string; sourceId: string };
  fact: { text: string; sourceId: string };
  phases: PhaseSpec[];
  tiers: Record<Tier, string>;
  emergencies: EmergencySpec[];
  success: string;
  retry: string;
  milestone?: { id: string; label: string };
  labels: string[];
}

const WALK = ['Move: W A S D or arrow keys', 'Jump: Space', 'Use / interact: E or Enter', 'Pause: Esc'];
const FLY = ['Steer: W A S D or arrow keys', 'Engine / throttle up: Space', 'Brake / throttle down: X', 'Pause: Esc'];

export const DEMO_MISSIONS: Record<DemoMissionId, DemoMission> = {
  E02: {
    id: 'E02', world: 'earth', title: 'Gravity and Suit Lab',
    duty: 'Suit technician and trainee',
    goal: 'Run a suit preflight check, fix what you find, then carry an equipment pouch through the gravity trainer to the training point.',
    skill: 'Reading suit gauges and feeling how gravity changes a jump.',
    entry: 'Always available. This is the first mission of the campaign.',
    controls: WALK,
    startingResources: 'Suit oxygen 100%. Suit pressure: check it yourself.',
    science: {
      text: 'A spacesuit is a tiny spacecraft. Before any spacewalk, astronauts check that it holds pressure. This suit should read about 4.3 psi.',
      sourceId: 'astro_training',
    },
    fact: {
      text: 'The same jump lasts about six times longer on the Moon than on Earth, because lunar gravity is about one sixth as strong.',
      sourceId: 'gravity',
    },
    phases: [
      { id: 'suit', label: 'Suit preflight', objective: 'Walk to the suit station and run the preflight check', checkpoint: 'Mission start' },
      { id: 'course', label: 'Gravity trainer', objective: 'Carry the equipment pouch to the training point', checkpoint: 'Suit cleared' },
    ],
    tiers: {
      junior: 'Hints show the safe range for every gauge. One fault to find.',
      middle: 'No hints unless you ask. Compare each reading with the reference card yourself.',
      advanced: 'Two faults at once: suit pressure and the radio channel. The reference card stays closed until you open it.',
    },
    emergencies: [{
      id: 'low_pressure', title: 'Simulated low suit pressure',
      trigger: 'Authored: present from mission start until corrected.',
      warning: 'SUIT PRESSURE LOW shown on the checklist and the chest display.',
      symptoms: 'Pressure gauge reads 3.1 psi. The chest light is red and the left glove ring glows.',
      actions: 'Report the fault, then reseat the left glove ring and re-pressurize.',
      effects: 'Clearance is blocked while the fault stands. A wrong fix explains why and lets you choose again.',
      recovery: 'Restart from the mission start checkpoint, or continue once the gauge reads 4.3 psi.',
      debrief: 'You found the low-pressure reading before leaving the suit station, which is exactly when to find it.',
    }],
    success: 'Suit cleared and the pouch delivered to the training point.',
    retry: 'Restart from the last checkpoint at any time from the pause menu.',
    milestone: undefined,
    labels: ['Fictional training procedure', 'Trainer gravity uses real Moon and Mars values'],
  },
  F01: {
    id: 'F01', world: 'shuttle', title: 'Liftoff to Orbit',
    duty: 'Pilot',
    goal: 'Complete the launch checklist, fly the shuttle through six guidance gates and cut the engines at orbital speed.',
    skill: 'Working a checklist, steering, and using the throttle and brake.',
    entry: 'Complete Earth: Gravity and Suit Lab.',
    requires: 'E02',
    controls: [...FLY, 'Checklist: E or Enter'],
    startingResources: 'Fuel 100%. Six guidance gates.',
    science: {
      text: 'To stay in orbit a spacecraft must travel sideways at about 28,000 kilometres per hour. That is about 7.8 kilometres every second. At that speed it keeps falling around Earth instead of back to the ground.',
      sourceId: 'microgravity',
    },
    fact: {
      text: 'Astronauts in orbit float because they and their spacecraft are falling around Earth together. Gravity is still there.',
      sourceId: 'microgravity',
    },
    phases: [
      { id: 'checklist', label: 'Launch checklist', objective: 'Complete the launch checklist', checkpoint: 'Mission start' },
      { id: 'ascent', label: 'Ascent', objective: 'Hold Space to throttle up, then steer through the gates', checkpoint: 'Liftoff' },
    ],
    tiers: {
      junior: 'Wide gates, three misses allowed, plenty of fuel and a wide orbit speed band.',
      middle: 'Narrower gates, two misses allowed, less spare fuel.',
      advanced: 'Tight gates, one miss allowed, a narrow speed band for engine cutoff.',
    },
    emergencies: [{
      id: 'guidance_deviation', title: 'Guidance deviation',
      trigger: 'Flight condition: speed passes one third of orbital speed.',
      warning: 'GUIDANCE DEVIATION with a caption and a flashing course indicator.',
      symptoms: 'The course marker slides away from centre and the next gate moves off to one side.',
      actions: 'Steer back toward the gate. Throttle down with X to buy time.',
      effects: 'Gates passed off course count as misses. Too many misses, or staying far off course, ends the attempt.',
      recovery: 'Training reset to the liftoff checkpoint. The checklist does not need repeating.',
      debrief: 'A guidance fault pushed the shuttle off course and you steered it back by hand.',
    }],
    success: 'Engines off inside the orbit speed band for 1.5 seconds.',
    retry: 'Training reset on too many missed gates, leaving the corridor, or running out of fuel.',
    milestone: { id: 'flight_ready', label: 'Flight Ready' },
    labels: ['Fictional shuttle-class craft', 'Time is compressed: a real climb to orbit takes about 8 to 9 minutes'],
  },
  S01: {
    id: 'S01', world: 'station', title: 'Dock and Drift',
    duty: 'Pilot and cargo specialist',
    goal: 'Dock gently with the station, then float a cargo bag to the storage rack using push, drift and grab.',
    skill: 'Controlling alignment and closing speed, and moving with momentum.',
    entry: 'Complete Shuttle: Liftoff to Orbit.',
    requires: 'F01',
    controls: [
      'Docking: W A S D to line up, Space to close in, X to brake',
      'Inside: W A S D to aim, Space to push off, E to grab a rail or cargo',
      'Tether recovery: R', 'Pause: Esc',
    ],
    startingResources: 'Range 40 m. One cargo bag.',
    science: {
      text: 'In orbit nothing slows you down. Push off and you keep drifting in a straight line until you grab something.',
      sourceId: 'microgravity',
    },
    fact: {
      text: 'The station and everyone in it are in free fall around Earth. That is why a gentle push sends you all the way across a module.',
      sourceId: 'microgravity',
    },
    phases: [
      { id: 'docking', label: 'Docking', objective: 'Line up with the docking port and close in slowly', checkpoint: 'Mission start' },
      { id: 'cargo', label: 'Cargo transfer', objective: 'Push off, drift and grab rails to move the cargo bag to storage', checkpoint: 'Docked' },
    ],
    tiers: {
      junior: 'Thrusters stop the shuttle drifting when you let go. Long reach for handrails. Cargo waits by a rail.',
      middle: 'The shuttle keeps some drift. Shorter reach. The cargo bag is loose and slowly drifting.',
      advanced: 'Full drift: every thruster push must be cancelled by hand. Shortest reach and faster loose cargo.',
    },
    emergencies: [
      {
        id: 'dock_abort', title: 'Unsafe docking approach',
        trigger: 'Flight condition: arriving at the port too fast or out of line.',
        warning: 'APPROACH ABORTED with the reason: closing speed or alignment.',
        symptoms: 'The docking target flashes red and the shuttle backs away.',
        actions: 'Brake earlier with X and centre the target before closing in.',
        effects: 'No damage. The attempt counter goes up.',
        recovery: 'The shuttle holds at 25 m for a new approach.',
        debrief: 'A fast or crooked approach was called off and flown again.',
      },
      {
        id: 'drift_hazard', title: 'Missed handrail',
        trigger: 'Station hazard: more than 7 seconds of free drift, or a bump against a wall.',
        warning: 'DRIFT WARNING with a caption telling you to grab a rail or use the tether.',
        symptoms: 'The astronaut drifts past the rail and the tether line turns amber.',
        actions: 'Press E near any rail to grab it, or press R to reel in the tether.',
        effects: 'A tether recovery returns you to the last rail you held and is counted in the debrief.',
        recovery: 'Tether reel to the last handrail.',
        debrief: 'After a missed rail you recovered with a grab or the tether instead of trying to swim.',
      },
    ],
    success: 'Soft dock, then the cargo bag stowed in the storage rack.',
    retry: 'A poor approach backs off to 25 m. Restart from the Docked checkpoint from the pause menu.',
    labels: ['Fictional station', 'Movement is simplified to a flat plane'],
  },
  S04: {
    id: 'S04', world: 'station', title: 'Module Alert',
    duty: 'Flight engineer and robotic arm operator',
    goal: 'Find which module is leaking air by reading the hatch gauges. Then decide: seal the lab at once, or rescue the experiment with the robotic arm first.',
    skill: 'Reading a trend instead of a single number, and steering a robotic arm.',
    entry: 'Complete Station: Dock and Drift. This is an extra station mission and is not needed to reach the Moon.',
    requires: 'S01',
    controls: [
      'Move: W A S D to aim, Space to push off, E to grab a rail',
      'At a rail: E to use the gauge, console, arm station or hatch',
      'Robotic arm: W A S D to move, E to grip or release, R to give up the rescue',
      'Tether recovery: R', 'Pause: Esc',
    ],
    startingResources: 'Station air reserve 100%. One experiment canister inside the lab.',
    science: {
      text: 'A life support system provides and controls the air pressure in a spacecraft. If air is escaping, one clue is a pressure reading that keeps falling.',
      sourceId: 'eclss',
    },
    fact: {
      text: 'Robotics is one of the skills every astronaut candidate trains in, along with spacewalking and space station systems.',
      sourceId: 'astro_training',
    },
    phases: [
      { id: 'diagnose', label: 'Find the leak', objective: 'Read the three hatch gauges, then report the leaking module at the main console', checkpoint: 'Mission start' },
      { id: 'respond', label: 'Isolate or rescue', objective: 'Choose a plan at the main console, then carry it out', checkpoint: 'Leak found' },
    ],
    tiers: {
      junior: 'The leaking module has the lowest reading and each gauge names its trend. You steer the arm gripper directly. The leak is slow enough to ignore the clock.',
      middle: 'The lowest reading is not the leak: work out which pressure is falling. You steer the arm joint by joint. The leak costs air while you work.',
      advanced: 'Two problems at once: a leak and a frozen sensor that looks worse than the leak. Faster leak, tighter gripper.',
    },
    emergencies: [
      {
        id: 'pressure_alert', title: 'Module pressure alert',
        trigger: 'Authored: active from mission start until the lab hatch is sealed.',
        warning: 'PRESSURE ALERT banner, caption and a flashing beacon at the lab hatch once the leak is found.',
        symptoms: 'The air reserve meter falls. The lab gauge reads lower each minute.',
        actions: 'Read the gauges, report the leaking module, then seal the lab hatch or rescue the experiment first.',
        effects: 'The reserve drains while the leak is open. A wrong report seals a healthy module and wastes air.',
        recovery: 'Below 40% reserve the crew moves to the shuttle and the mission restarts from the last checkpoint.',
        debrief: 'The falling reading, not the lowest one, pointed to the leak.',
      },
      {
        id: 'rescue_tradeoff', title: 'Isolate or protect the experiment',
        trigger: 'Earlier player choice: the plan picked at the main console after the leak is found.',
        warning: 'AIR RESERVE LOW caution during a slow rescue.',
        symptoms: 'The reserve keeps falling while the arm is working.',
        actions: 'Finish the rescue, or press R to give it up and seal the hatch.',
        effects: 'Sealing at once keeps more air and loses the experiment. Rescuing first saves it and costs air.',
        recovery: 'Give up the rescue at any time. Restart from the Leak found checkpoint from the pause menu.',
        debrief: 'Every second the hatch stayed open cost air, so the rescue had a price.',
      },
    ],
    success: 'The lab hatch is sealed with the air reserve above 40%.',
    retry: 'Restart from the last checkpoint if the reserve falls below 40%.',
    labels: ['Fictional station and procedure', 'Pressures and leak rates are illustrative', 'Time is compressed'],
  },
  L02: {
    id: 'L02', world: 'moon', title: 'Power Before Shadow',
    duty: 'Lander pilot and habitat operator',
    goal: 'Land on the Moon, carry supplies to the habitat and deploy a solar panel, then run the outpost through a power drop and a solar particle alert.',
    skill: 'Landing with engines only, low-gravity walking, and budgeting power.',
    entry: 'Complete Station: Dock and Drift.',
    requires: 'S01',
    controls: ['Lander: W A S D to steer, Space for the engine', ...WALK.slice(0, 3), 'Decisions: Tab and Enter, or click', 'Pause: Esc'],
    startingResources: 'Lander fuel 100%. Suit oxygen 100%. Habitat energy is counted in game units.',
    science: {
      text: 'The Moon has no air, so a parachute cannot help. Only the engine slows the lander. Near the south pole the Sun stays low, so sunlight comes and goes.',
      sourceId: 'lunar_illum',
    },
    fact: {
      text: 'During a solar particle event, astronauts build or enter a dense shelter. Extra material around them does the protecting.',
      sourceId: 'radiation_shelter',
    },
    phases: [
      { id: 'landing', label: 'Lunar landing', objective: 'Fly to the landing zone and touch down gently', checkpoint: 'Mission start' },
      { id: 'eva', label: 'Surface work', objective: 'Carry the supply pouch to the habitat and deploy the solar panel', checkpoint: 'Touchdown' },
      { id: 'outpost', label: 'Habitat operations', objective: 'Run the habitat through the shadow and the solar alert', checkpoint: 'Inside the habitat' },
    ],
    tiers: {
      junior: 'Two meters: Air and Battery. One guided choice at a time, hover assist on the lander, no countdowns.',
      middle: 'Adds the Crops meter. The grow-light choice changes what you can afford when the solar alert arrives.',
      advanced: 'Shadow and alert overlap. Adds a question to Earth whose reply arrives after your next decision, and optional science.',
    },
    emergencies: [
      {
        id: 'low_generation', title: 'Solar power drop',
        trigger: 'Scheduled event after the sunny shift (lunar south pole shadow).',
        warning: 'SHADOW / LOW POWER banner and caption.',
        symptoms: 'The habitat window goes dark and the power console flashes.',
        actions: 'Choose how to power air support and what to bank.',
        effects: 'Panels deliver 2 units instead of 6. Air support still needs 3.',
        recovery: 'Recover from the checkpoint before the decision that caused a critical outcome.',
        debrief: 'Stored power decided what the crew could afford in shadow.',
      },
      {
        id: 'solar_alert', title: 'Solar particle alert',
        trigger: 'Scheduled event, independent of the shadow. Labelled with archived NASA DONKI alert 20260905-AL-007.',
        warning: 'SOLAR PARTICLE ALERT banner, flashing beacon and caption.',
        symptoms: 'Alert beacon on, shelter hatch lit.',
        actions: 'Basic shelter plan (0 units), upgraded shelter fans (2 units), or keep working.',
        effects: 'Basic plan makes the air stuffy. Fans keep it fresh. Skipping the shelter is a critical outcome.',
        recovery: 'Recover from the solar alert checkpoint.',
        debrief: 'The shelter walls protected the crew. Banked power decided whether the fans could run.',
      },
    ],
    success: 'The habitat finishes its last shift with safe air and a protected crew.',
    retry: 'Landing: training reset to the approach. Habitat: recover from the checkpoint before the critical decision.',
    milestone: { id: 'lunar_crew', label: 'Lunar Crew' },
    labels: ['Energy units are invented game units', 'Time is compressed', 'Solar alert: archived NASA record, not live data'],
  },
  M04: {
    id: 'M04', world: 'mars', title: 'Dust Storm Outpost',
    duty: 'Lander pilot and outpost engineer',
    goal: 'Land on Mars with a parachute and engines, inspect the rover, then keep the outpost running through a dust storm.',
    skill: 'Landing through thin air and stretching a small power budget.',
    entry: 'Complete Moon: Power Before Shadow.',
    requires: 'L02',
    controls: ['Lander: E for the parachute, W A S D to steer, Space for the engine', ...WALK.slice(0, 3), 'Decisions: Tab and Enter, or click', 'Pause: Esc'],
    startingResources: 'Lander fuel 100%. Suit oxygen 100%. Outpost battery 2 game units.',
    science: {
      text: 'Mars has air, but it is very thin. A parachute slows the lander a lot, and engines still have to finish the landing.',
      sourceId: 'mars_dust',
    },
    fact: {
      text: 'Dust storms on Mars can grow to cover much of the planet, and the dust can take months to settle. Solar-powered machines have to save energy until the sky clears.',
      sourceId: 'mars_dust',
    },
    phases: [
      { id: 'landing', label: 'Mars landing', objective: 'Open the parachute, release it, then land with the engine', checkpoint: 'Mission start' },
      { id: 'eva', label: 'Surface work', objective: 'Inspect the rover, then get to the habitat before the dust arrives', checkpoint: 'Touchdown' },
      { id: 'outpost', label: 'Outpost operations', objective: 'Keep the outpost running through the dust storm', checkpoint: 'Inside the habitat' },
    ],
    tiers: {
      junior: 'Two meters: Air and Battery. Lighter wind, hover assist, one choice per shift.',
      middle: 'Adds the Crops meter and a crop heater that competes with the air system for power.',
      advanced: 'Stronger wind, less fuel, optional science, and a question to Earth whose reply arrives after the storm peak decision.',
    },
    emergencies: [{
      id: 'dust_storm', title: 'Dust storm',
      trigger: 'Scheduled event after the rover inspection.',
      warning: 'DUST STORM banner and caption.',
      symptoms: 'Thick orange haze outside, short visibility, dim panels.',
      actions: 'Brush the panels or save power, run air at full or eco, use the lander backup cells.',
      effects: 'Solar income falls from 4 units to 1. Clean panels add 2 units per shift.',
      recovery: 'Backup cells add 2 units once. A critical outcome recovers from the checkpoint before the decision.',
      debrief: 'Early panel care and stored power carried the outpost through the storm.',
    }],
    success: 'The outpost reaches clearing skies with safe air.',
    retry: 'Landing: training reset to the entry point. Outpost: recover from the checkpoint before the critical decision.',
    milestone: { id: 'mars_expedition', label: 'Mars Expedition' },
    labels: ['Fictional future mission', 'Energy units are invented game units', 'Time is compressed'],
  },
};

export type MissionStatus = 'completed' | 'available' | 'locked' | 'planned';

/** Campaign rule: a mission unlocks when the mission it requires is completed. */
export function missionStatus(id: MissionId, completed: Partial<Record<MissionId, unknown>>, judgeMode: boolean): MissionStatus {
  const entry = catalogEntry(id);
  if (!entry.demo) return 'planned';
  if (completed[id]) return 'completed';
  if (judgeMode) return 'available';
  const requires = DEMO_MISSIONS[id as DemoMissionId].requires;
  return !requires || completed[requires] ? 'available' : 'locked';
}

/** Next mission on the five-world route. */
export function nextMission(completed: Partial<Record<MissionId, unknown>>): DemoMissionId | null {
  return DEMO_ROUTE.find((id) => !completed[id]) ?? null;
}

export function missionAfter(id: DemoMissionId): DemoMissionId | null {
  const idx = DEMO_ROUTE.indexOf(id);
  // Missions off the main route lead on to the next world in atlas order.
  if (idx < 0) return PLAYABLE.slice(PLAYABLE.indexOf(id) + 1).find((m) => DEMO_ROUTE.includes(m)) ?? null;
  return DEMO_ROUTE[idx + 1] ?? null;
}

export function phaseIds(id: DemoMissionId): string[] {
  return DEMO_MISSIONS[id].phases.map((p) => p.id);
}

export const STATUS_LABEL: Record<MissionStatus, string> = {
  completed: 'Completed',
  available: 'Available',
  locked: 'Locked',
  planned: 'Planned',
};
