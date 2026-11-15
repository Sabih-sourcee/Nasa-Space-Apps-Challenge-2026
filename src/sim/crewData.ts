// Crew Ship content: 15 rooms, 18 task types, the emergencies and the quick
// crew games. The ship (the "Kestrel"), its rooms, every reading and every unit
// are invented for this game. Science cards link to the sources in sources.ts.

import type { Tier } from './types';

export type Role = 'pilot' | 'engineer' | 'life' | 'logistics' | 'science' | 'comms';
export const ROLES: Role[] = ['pilot', 'engineer', 'life', 'logistics', 'science', 'comms'];
export const ROLE_LABEL: Record<Role, string> = {
  pilot: 'Pilot', engineer: 'Systems Engineer', life: 'Life Support', logistics: 'Logistics', science: 'Science', comms: 'Communications',
};

export type RoomId =
  | 'trajectory' | 'bridge' | 'comms' | 'observation' | 'airlock'
  | 'power' | 'life' | 'galley' | 'water' | 'cargo'
  | 'propulsion' | 'thermal' | 'grow' | 'medbay' | 'shelter';

export interface RoomSpec { id: RoomId; name: string; col: number; row: number; color: string; icon: string; landmark: string }

/** Five columns by three rows around the central Galley. Doors link every neighbour in a row, and columns 0, 2 and 4 link the rows, which makes two loops. */
export const ROOMS: RoomSpec[] = [
  { id: 'trajectory', name: 'Trajectory Lab', col: 0, row: 0, color: '#3b5bdb', icon: 'target', landmark: 'A star chart table' },
  { id: 'bridge', name: 'Bridge', col: 1, row: 0, color: '#1c7ed6', icon: 'rocket', landmark: 'Three pilot seats and the big forward window' },
  { id: 'comms', name: 'Comms Mast', col: 2, row: 0, color: '#7048e8', icon: 'antenna', landmark: 'A tall dish mast' },
  { id: 'observation', name: 'Observation Lab', col: 3, row: 0, color: '#0c8599', icon: 'eye', landmark: 'A glass dome' },
  { id: 'airlock', name: 'Airlock', col: 4, row: 0, color: '#868e96', icon: 'helmet', landmark: 'Two suits on the wall' },
  { id: 'power', name: 'Power Bay', col: 0, row: 1, color: '#f59f00', icon: 'bolt', landmark: 'A wall of battery sockets' },
  { id: 'life', name: 'Life Support', col: 1, row: 1, color: '#2f9e44', icon: 'air', landmark: 'Two big fans' },
  { id: 'galley', name: 'Galley', col: 2, row: 1, color: '#e8590c', icon: 'box', landmark: 'The long crew table' },
  { id: 'water', name: 'Water Recovery', col: 3, row: 1, color: '#1098ad', icon: 'fuel', landmark: 'Three clear tanks' },
  { id: 'cargo', name: 'Cargo Lock', col: 4, row: 1, color: '#845ef7', icon: 'box', landmark: 'Stacked crates and a manifest board' },
  { id: 'propulsion', name: 'Propulsion Bay', col: 0, row: 2, color: '#e03131', icon: 'rocket', landmark: 'Two thruster bells' },
  { id: 'thermal', name: 'Thermal Control', col: 1, row: 2, color: '#d6336c', icon: 'thermo', landmark: 'Coolant pipes in red and blue' },
  { id: 'grow', name: 'Grow Lab', col: 2, row: 2, color: '#37b24d', icon: 'leaf', landmark: 'Pink grow lights' },
  { id: 'medbay', name: 'MedBay', col: 3, row: 2, color: '#f06595', icon: 'shield', landmark: 'A training dummy on a bed' },
  { id: 'shelter', name: 'Storm Shelter', col: 4, row: 2, color: '#364fc7', icon: 'shield', landmark: 'Thick blue walls' },
];
export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r])) as Record<RoomId, RoomSpec>;
export const VERTICAL_DOOR_COLS = [0, 2, 4];

export type ItemId = 'battery' | 'filter' | 'cartridge' | 'meal_crate' | 'diag_card';
export const ITEM_LABEL: Record<ItemId, string> = {
  battery: 'reserve battery', filter: 'CO₂ filter', cartridge: 'water cartridge', meal_crate: 'meal crate', diag_card: 'diagnostic card',
};

export interface PickOption { id: string; label: string; correct?: boolean; why: string }

export interface TaskSpec {
  id: string;
  num: number;
  room: RoomId;
  title: string;
  role: Role;
  /** Predict: one plain clue before the action. */
  clue: string;
  kind: 'pick' | 'order' | 'count' | 'dial' | 'carry';
  prompt: string;
  options?: PickOption[];
  /** For "order": the steps in the right order. They are shown shuffled. */
  steps?: string[];
  /** For "count": the right number. */
  answer?: number;
  countLabel?: string;
  max?: number;
  /** For "dial": bring the value from start to within tol of target. */
  dial?: { label: string; start: number; target: number; tol: number; min: number; max: number; unit: string };
  /** For "carry": the item that must be in hand. */
  item?: ItemId;
  /** Crew time this task takes, in clock steps. */
  time: number;
  /** What everyone can see once it is done. */
  effect: string;
  /** Explain: the science card shown after the result. */
  card: string;
  sourceId?: string;
}

const T = (t: TaskSpec): TaskSpec => t;

export const TASKS: TaskSpec[] = [
  T({ id: 't01', num: 1, room: 'bridge', title: 'Check flight readiness', role: 'pilot', kind: 'pick', time: 1,
    clue: 'A flight is only ready when every condition is green. One light on the board is not.',
    prompt: 'Board: FUEL ✔ green. AIR ✔ green. CARGO ✖ not latched. COMMS ✔ green. Which condition is missing?',
    options: [
      { id: 'fuel', label: 'Fuel', why: 'Fuel is green. Look for the light that is not.' },
      { id: 'cargo', label: 'Cargo latched', correct: true, why: 'Cargo is the one that is not latched. Loose cargo moves when the ship turns.' },
      { id: 'comms', label: 'Comms', why: 'Comms is green. Look for the light that is not.' },
    ],
    effect: 'The readiness board on the Bridge shows the missing condition.',
    card: 'Crews use checklists so nothing depends on memory. One missing item holds the whole flight.', sourceId: 'astro_training' }),
  T({ id: 't02', num: 2, room: 'bridge', title: 'Correct attitude', role: 'pilot', kind: 'dial', time: 1,
    clue: 'In space nothing stops a turn by itself. You steer one way, then brake.',
    prompt: 'Turn the ship until the nose is on the target line, then hold it there.',
    dial: { label: 'Nose angle', start: 14, target: 0, tol: 2, min: -20, max: 20, unit: '°' },
    effect: 'The Bridge alignment marker turns green.',
    card: 'A spacecraft keeps turning until a thruster pushes the other way. That is why pilots brake before they arrive.', sourceId: 'microgravity' }),
  T({ id: 't03', num: 3, room: 'trajectory', title: 'Plot a debris bypass', role: 'pilot', kind: 'pick', time: 1,
    clue: 'A shorter path is not always cheaper. Changing direction costs fuel.',
    prompt: 'Debris ahead. Route A: 2 steps longer, uses 5 fuel. Route B: no extra time, uses 20 fuel. We have plenty of time and little fuel. Which route?',
    options: [
      { id: 'a', label: 'Route A: slower, 5 fuel', correct: true, why: 'With time to spare, the slow route saves 15 fuel.' },
      { id: 'b', label: 'Route B: faster, 20 fuel', why: 'That is quicker, but we are short of fuel, not time.' },
    ],
    effect: 'The chart table shows the new course line.',
    card: 'Every change of course in space is paid for in fuel, so crews trade time against fuel.', sourceId: 'microgravity' }),
  T({ id: 't04', num: 4, room: 'power', title: 'Trace a broken circuit', role: 'engineer', kind: 'pick', time: 1,
    clue: 'Follow the label from the dark equipment back to its connector.',
    prompt: 'The Life Support fans are dark. Connectors: P1 feeds BRIDGE. P2 feeds LIFE SUPPORT. P3 feeds GALLEY. Which connector do you reseat?',
    options: [
      { id: 'p1', label: 'P1', why: 'P1 feeds the Bridge, and the Bridge has power.' },
      { id: 'p2', label: 'P2', correct: true, why: 'P2 feeds Life Support. Reseating it brings the fans back.' },
      { id: 'p3', label: 'P3', why: 'P3 feeds the Galley, and the Galley has power.' },
    ],
    effect: 'The fans in Life Support spin up.',
    card: 'Power travels along branches. A fault on one branch only darkens the equipment on that branch.', sourceId: 'eclss' }),
  T({ id: 't05', num: 5, room: 'power', title: 'Install a reserve battery', role: 'engineer', kind: 'carry', item: 'battery', time: 1,
    clue: 'There is one reserve battery on the ship. Wherever it goes, it cannot be anywhere else.',
    prompt: 'Seat the reserve battery in the backup socket.',
    effect: 'The backup socket lights up and the reserve power bar rises.',
    card: 'Stored power covers the times when the solar panels are in shadow.', sourceId: 'lunar_illum' }),
  T({ id: 't06', num: 6, room: 'life', title: 'Replace a CO₂ filter', role: 'life', kind: 'carry', item: 'filter', time: 2,
    clue: 'Oxygen coming in is one job. Taking carbon dioxide out is a different job, done by a filter.',
    prompt: 'Fit the new filter to the loop with the high CO₂ reading.',
    effect: 'The CO₂ reading in Life Support and on the Bridge falls.',
    card: 'People breathe out carbon dioxide. A spacecraft has to remove it, as well as supply oxygen.', sourceId: 'eclss' }),
  T({ id: 't07', num: 7, room: 'water', title: 'Repair the recycle loop', role: 'life', kind: 'order', time: 2,
    clue: 'Water must be shut off before a pipe is opened, and checked after.',
    prompt: 'Put the repair steps in order.',
    steps: ['Close the inlet valve', 'Reroute the pipe past the leak', 'Open the inlet valve', 'Check water reaches the clean tank'],
    effect: 'The clean tank in Water Recovery starts to fill.',
    card: 'On a spacecraft most water is used again. It is cleaned and recycled instead of thrown away.', sourceId: 'eclss' }),
  T({ id: 't08', num: 8, room: 'galley', title: "Pack the next shift's meals", role: 'logistics', kind: 'count', time: 1,
    clue: 'Each crew member eats one pack per shift. Count the crew, then count the packs.',
    prompt: 'How many meal packs go out for the next shift?', countLabel: 'meal packs', answer: 4, max: 12,
    effect: 'The Galley rack shows packs set out and packs kept in reserve.',
    card: 'Packaged food is the main food on a mission. Crops grown aboard are a fresh extra, not the whole meal.', sourceId: 'veggie' }),
  T({ id: 't09', num: 9, room: 'grow', title: 'Restore a crop tray', role: 'science', kind: 'pick', time: 1,
    clue: 'A plant needs light and water. Look at what the tray is missing.',
    prompt: 'Tray 2: soil is damp, leaves are pale, the lamp above is dark. What does it need?',
    options: [
      { id: 'water', label: 'More water', why: 'The soil is already damp. Look at the lamp.' },
      { id: 'light', label: 'Its grow light', correct: true, why: 'The lamp was off. With light the tray grows again, and it will be ready some shifts from now.' },
    ],
    effect: 'The pink lamp over tray 2 comes on.',
    card: 'Plants take weeks to grow. A crop can add to later meals, but it cannot fix a shortage today.', sourceId: 'veggie' }),
  T({ id: 't10', num: 10, room: 'cargo', title: 'Secure cargo', role: 'logistics', kind: 'order', time: 2,
    clue: 'Heavy crates go in first and low, so nothing can slide.',
    prompt: 'Put the cargo steps in order.',
    steps: ['Move the heavy crate to the floor rack', 'Stack the light crate on top', 'Close both latches', 'Tug each crate to test it'],
    effect: 'The Cargo Lock latch lights turn green, and the Bridge board shows CARGO latched.',
    card: 'In free fall a loose crate keeps moving until something stops it, so cargo is always latched.', sourceId: 'microgravity' }),
  T({ id: 't11', num: 11, room: 'cargo', title: 'Find a mislabeled supply', role: 'logistics', kind: 'pick', time: 2,
    clue: 'Labels can be wrong. The manifest lists the weight of every crate.',
    prompt: 'Manifest: meal crate, 12 kg, blue band. Crate A: label SPARES, 12 kg, blue band. Crate B: label MEALS, 30 kg, red band. Crate C: label TOOLS, 8 kg, no band. Which crate holds the meals?',
    options: [
      { id: 'a', label: 'Crate A', correct: true, why: 'Crate A matches the weight and the band. Its label was wrong.' },
      { id: 'b', label: 'Crate B', why: 'The label says MEALS, but 30 kg and a red band do not match the manifest.' },
      { id: 'c', label: 'Crate C', why: 'Crate C is too light and has no band.' },
    ],
    effect: 'The meal crate is in your hands. Carry it to the room that asked for it.',
    card: 'Crews check supplies against a manifest, because what is on the label and what is in the box can differ.', sourceId: 'astro_training' }),
  T({ id: 't12', num: 12, room: 'comms', title: 'Align the relay', role: 'comms', kind: 'dial', time: 1,
    clue: 'The dish only hears Earth when it points at it. Watch the signal bars.',
    prompt: 'Turn the dish until the signal is strongest, then send the update.',
    dial: { label: 'Dish bearing', start: 20, target: 62, tol: 3, min: 0, max: 90, unit: '°' },
    effect: 'The mast dish turns and the Comms screen shows SIGNAL LOCKED with the send time.',
    card: 'Radio travels at the speed of light, and that still takes time. A reply answers the message you sent, not what is happening now.', sourceId: 'comms' }),
  T({ id: 't13', num: 13, room: 'thermal', title: 'Balance coolant', role: 'engineer', kind: 'dial', time: 1,
    clue: 'Coolant sent to one branch is coolant taken from another.',
    prompt: 'The relay amplifier is running hot. Move coolant to it until its temperature is in the green band.',
    dial: { label: 'Coolant to relay', start: 20, target: 60, tol: 5, min: 0, max: 100, unit: '%' },
    effect: 'The relay pipe turns blue. The lab pipe warms and the lab runs at half speed.',
    card: 'In space there is no air to carry heat away, so equipment is cooled by pumped liquid and radiators.', sourceId: 'eclss' }),
  T({ id: 't14', num: 14, room: 'propulsion', title: 'Bring the backup thruster online', role: 'engineer', kind: 'order', time: 2,
    clue: 'Test small before you fire big.',
    prompt: 'Put the test sequence in order.',
    steps: ['Open the fuel valve', 'Run a one-second test pulse', 'Read the thrust gauge', 'Arm the thruster for the Bridge'],
    effect: 'The second thruster bell glows and the Bridge shows BACKUP THRUSTER ready.',
    card: 'Spacecraft carry backup thrusters. A short test shows a thruster works before the crew depends on it.', sourceId: 'astro_training' }),
  T({ id: 't15', num: 15, room: 'airlock', title: 'Check the EVA suit', role: 'science', kind: 'order', time: 1,
    clue: 'Seal first. Air second. Tether last, just before you go out.',
    prompt: 'Put the suit checks in order.',
    steps: ['Check the helmet and glove seals', 'Check the air supply reads full', 'Clip the tether to the rail', 'Take the tool outside'],
    effect: 'The airlock suit light turns green.',
    card: 'A spacesuit is a small spacecraft. It is checked before every spacewalk.', sourceId: 'astro_training' }),
  T({ id: 't16', num: 16, room: 'medbay', title: 'Triage a suit alert', role: 'life', kind: 'pick', time: 1,
    clue: 'Compare each reading with its safe range before you call for help.',
    prompt: 'Training dummy. Suit air: 96% (safe above 90). Suit temperature: 31 °C (safe 18 to 26). Radio: clear. Which help request is right?',
    options: [
      { id: 'air', label: 'Bring air', why: 'Air is inside its safe range.' },
      { id: 'cool', label: 'Cool the suit', correct: true, why: 'Temperature is above the safe range. The suit needs cooling.' },
      { id: 'radio', label: 'Fix the radio', why: 'The radio is clear.' },
    ],
    effect: 'The MedBay board shows the right help request.',
    card: 'Suits carry sensors so the crew can spot a problem early and ask for the right help.', sourceId: 'astro_training' }),
  T({ id: 't17', num: 17, room: 'observation', title: 'Run a microgravity experiment', role: 'science', kind: 'pick', time: 1,
    clue: 'Everything in the ship is falling around the planet together.',
    prompt: 'You let go of a wrench without pushing it. What does it do?',
    options: [
      { id: 'fall', label: 'It drops to the floor', why: 'It would on Earth. Here the ship is falling with it.' },
      { id: 'stay', label: 'It floats where you left it', correct: true, why: 'Nothing pushed it, so it stays beside you. A crate will only move the way you push it.' },
      { id: 'up', label: 'It rises to the ceiling', why: 'Nothing is pushing it up.' },
    ],
    effect: 'The wrench floats in the dome. The cargo plan now says: push gently, stop it by hand.',
    card: 'Astronauts float because they and their ship are falling around the planet together. Gravity is still there.', sourceId: 'microgravity' }),
  T({ id: 't18', num: 18, room: 'shelter', title: 'Prepare the shielded room', role: 'life', kind: 'order', time: 2,
    clue: 'The thick walls do the shielding. Power only runs the fans and lights inside.',
    prompt: 'Put the shelter steps in order.',
    steps: ['Count the crew', 'Check water and meal packs are inside', 'Start the ventilation', 'Bring everyone inside and close the hatch'],
    effect: 'The shelter sign shows CREW INSIDE and the fan turns.',
    card: 'During a solar particle event, crews move to the best shielded part of their spacecraft.', sourceId: 'radiation_shelter' }),
];
export const TASK_BY_ID = Object.fromEntries(TASKS.map((t) => [t.id, t])) as Record<string, TaskSpec>;

export interface Res { meals: number; fuel: number; power: number; water: number; air: number; crops: number; readiness: number }
export const RES_KEYS: (keyof Res)[] = ['meals', 'fuel', 'power', 'water', 'air', 'crops', 'readiness'];
export const RES_NAME: Record<keyof Res, string> = { meals: 'Meal packs', fuel: 'Fuel', power: 'Reserve power', water: 'Clean water', air: 'Air quality', crops: 'Crop trays', readiness: 'Crew readiness' };
export const RES_UNIT: Record<keyof Res, string> = { meals: 'packs', fuel: '%', power: '%', water: '%', air: '%', crops: 'trays', readiness: '%' };

export type IncidentId = 'tour' | 'meals' | 'air' | 'water' | 'relay' | 'docking' | 'cargo_relay' | 'docking_drill' | 'signal_hunt';

/** Facts earlier missions left behind. */
export interface CrewCarry { reserveSpent?: boolean; cargoSecured?: boolean }

export interface IncidentTask {
  task: string;
  /** Overrides for this emergency: a different prompt, options, answer or dial. */
  variant?: Partial<TaskSpec>;
  /** Only available once this flag is set. */
  needs?: string;
  /** Not needed to finish. */
  optional?: boolean;
  /** For a choice between two valid routes: every option is accepted. */
  tradeoff?: boolean;
}

export interface IncidentSpec {
  id: IncidentId;
  n: number;
  kind: 'emergency' | 'drill';
  title: string;
  blurb: string;
  tradeoff: string;
  shifts: number;
  shiftLen: Record<Tier, number>;
  /** Items on the ship at the start, and the room each one is in. */
  items: Partial<Record<ItemId, RoomId>>;
  panels: { place: string; change: string; need: string };
  assignments: Partial<Record<Role, string>>;
  science: { text: string; sourceId: string }[];
  labels: string[];
}

const LEN = (j: number, m: number, a: number): Record<Tier, number> => ({ junior: j, middle: m, advanced: a });

export const INCIDENTS: IncidentSpec[] = [
  { id: 'tour', n: 0, kind: 'drill', title: 'Ship Tour and Drills', blurb: 'Walk the Kestrel and try any of the 18 tasks as a short drill. Nothing is at stake.',
    tradeoff: 'None. This is practice.', shifts: 1, shiftLen: LEN(999, 999, 999),
    items: { battery: 'cargo', filter: 'cargo', cartridge: 'cargo' },
    panels: { place: 'The Kestrel, parked in a quiet orbit. Fifteen rooms around one Galley.', change: 'Nothing is wrong. This is the day to learn where everything is.', need: 'Walk the ship. Every glowing station is a short drill. Try one in each room.' },
    assignments: { pilot: 'Start on the Bridge.', engineer: 'Start in the Power Bay.', life: 'Start in Life Support.', logistics: 'Start in the Cargo Lock.', science: 'Start in the Observation Lab.', comms: 'Start at the Comms Mast.' },
    science: [], labels: ['Fictional ship', 'Drills change nothing that lasts'] },
  { id: 'meals', n: 1, kind: 'emergency', title: 'Last Meals on Board', blurb: 'The supply delivery has slipped one shift. There is not enough packaged food to reach it.',
    tradeoff: 'Search the cargo for a misplaced meal crate (costs crew time), or ask for an earlier docking (costs fuel).', shifts: 3, shiftLen: LEN(12, 8, 6),
    items: {},
    panels: {
      place: 'The Kestrel, three shifts out from the supply dock. Two meal packs each in the Galley.',
      change: 'The delivery has slipped from the end of Shift 2 to the end of Shift 3. One pack each per shift: Shift 3 has nothing to eat.',
      need: 'Count the packs, confirm the gap on the Bridge, then close it: find the misplaced meal crate in Cargo, or get Comms to ask for an earlier docking.',
    },
    assignments: { logistics: 'Count the meal packs in the Galley, then check the Cargo manifest.', pilot: 'Confirm which shift is short on the Bridge board.', comms: 'Be ready to align the relay and ask for an earlier docking.', science: 'Check the crop trays. Tell us honestly when they will be ready.', engineer: 'Stand by in the Power Bay.', life: 'Watch the crew. Hungry people make mistakes.' },
    science: [{ text: 'Packaged food is the main food on a mission. Crops grown aboard take weeks and are a fresh extra.', sourceId: 'veggie' }],
    labels: ['Fictional emergency', 'Meal packs and fuel are game units', 'Shifts are compressed'] },
  { id: 'air', n: 2, kind: 'emergency', title: 'The Air Is Getting Stale', blurb: 'Carbon dioxide is building up in one air loop. A filter has to be replaced.',
    tradeoff: 'Run backup circulation on the reserve battery while the filter is changed (costs power), or close the bay and take the long way round (costs crew time).', shifts: 2, shiftLen: LEN(14, 9, 7),
    items: { filter: 'cargo', battery: 'cargo' },
    panels: {
      place: 'The Kestrel, mid-transfer. Oxygen tanks full, fans running.',
      change: 'The air smells stale. Oxygen is fine. Carbon dioxide is not being taken out of one loop.',
      need: 'The Bridge can see which rooms are high. Life Support can see which loop feeds them. Put the two clues together, then fit a new filter.',
    },
    assignments: { pilot: 'Read the CO₂ board on the Bridge and call out the rooms that are high.', life: 'Find the loop that feeds those rooms. You fit the filter.', logistics: 'Bring the spare filter from the Cargo Lock.', engineer: 'Decide with the crew: reserve battery for backup fans, or close the bay.', science: 'Check the plants. They breathe too.', comms: 'Keep the crew talking. Use the crew calls.' },
    science: [{ text: 'Supplying oxygen and removing carbon dioxide are two separate jobs for a life support system.', sourceId: 'eclss' }],
    labels: ['Fictional emergency', 'Air quality is a game score, not a real CO₂ level', 'Shifts are compressed'] },
  { id: 'water', n: 4, kind: 'emergency', title: 'Water on the Wrong Side', blurb: 'The recycle loop is leaking clean water into the waste tank.',
    tradeoff: 'Send the recovered water to the crew tank, or keep the crop trays watered.', shifts: 2, shiftLen: LEN(14, 9, 7),
    items: { cartridge: 'cargo' },
    panels: {
      place: 'The Kestrel. Three clear tanks in Water Recovery, one of them the wrong colour.',
      change: 'Clean water is ending up on the waste side. Every shift we lose more.',
      need: 'Bring a replacement cartridge from Cargo, repair the loop in the right order, then decide where the recovered water goes.',
    },
    assignments: { logistics: 'Carry the replacement cartridge from the Cargo Lock to Water Recovery.', life: 'Repair the recycle loop. Order matters.', science: 'Tell us what the crop trays need, and what they can go without.', pilot: 'Watch the tank levels on the Bridge.', engineer: 'Stand by.', comms: 'Log the tank readings.' },
    science: [{ text: 'A spacecraft recycles most of its water. It is cleaned and used again.', sourceId: 'eclss' }],
    labels: ['Fictional leak', 'Water and crop values are game units', 'Shifts are compressed'] },
  { id: 'relay', n: 5, kind: 'emergency', title: 'Houston Replies Too Late', blurb: 'A Mars dust event is cutting solar power. Advice from Earth arrives late and describes an earlier state.',
    tradeoff: 'Keep the relay powered to hear from Earth, or give that power to the habitat equipment.', shifts: 3, shiftLen: LEN(12, 8, 6),
    items: {},
    panels: {
      place: 'The Kestrel in Mars orbit, feeding power to the outpost below. Earth is many light-minutes away.',
      change: 'Dust is covering the panels. Power falls every shift.',
      need: 'Comms sends a report. Engineering starts the recovery now, without waiting. When Earth answers, compare the advice with what the gauges say today.',
    },
    assignments: { comms: 'Align the relay and send the report. Note the time you sent it.', engineer: 'Balance the coolant and start recovery. Do not wait for Earth.', pilot: 'When the reply comes, compare it with the Bridge readings.', science: 'Watch the dust.', life: 'Watch the air.', logistics: 'Stand by.' },
    science: [{ text: 'A radio signal takes between about 4 and 24 minutes to cross between Earth and Mars, each way.', sourceId: 'comms' }, { text: 'Dust in the Martian sky and on the panels blocks sunlight.', sourceId: 'mars_dust' }],
    labels: ['Fictional emergency', 'Message timing is compressed', 'Power is a game unit'] },
  { id: 'docking', n: 6, kind: 'emergency', title: 'Docking Window', blurb: 'A weak thruster branch and unsecured cargo threaten the docking window.',
    tradeoff: 'A quick approach with tight margins, or a slower guided approach that costs fuel and time.', shifts: 1, shiftLen: LEN(16, 10, 8),
    items: {},
    panels: {
      place: 'The Kestrel, closing on the supply dock. The window is open for one shift.',
      change: 'One propulsion branch is weak, and the cargo was moved late. It is not latched.',
      need: 'Engineering tests the backup thruster. Logistics secures the cargo. Then the Pilot chooses the approach and lines us up.',
    },
    assignments: { engineer: 'Bring the backup thruster online in the Propulsion Bay.', logistics: 'Secure the cargo. It decides what is waiting for us at the next stop.', pilot: 'Choose the approach in the Trajectory Lab, then correct our attitude on the Bridge.', comms: 'Call the dock.', life: 'Stand by.', science: 'Stand by.' },
    science: [{ text: 'A spacecraft keeps moving and turning until a thruster pushes the other way.', sourceId: 'microgravity' }],
    labels: ['Fictional docking', 'Fuel is a game unit', 'Time is compressed'] },
  { id: 'cargo_relay', n: 7, kind: 'drill', title: 'Quick Game: Cargo Relay', blurb: 'Find the right crate, carry it to the Galley, and latch the rest. Fewest clock steps wins.',
    tradeoff: 'Speed against mistakes: every wrong answer costs a step.', shifts: 1, shiftLen: LEN(999, 999, 999), items: {},
    panels: { place: 'Cargo Lock. Crates everywhere.', change: 'The Galley wants its meal crate before the shift ends.', need: 'Match the manifest, carry the crate to the Galley, latch what is left.' },
    assignments: { logistics: 'Find the crate.', pilot: 'Carry it.', engineer: 'Latch the rest.' }, science: [], labels: ['Quick crew game'] },
  { id: 'docking_drill', n: 8, kind: 'drill', title: 'Quick Game: Docking Drill', blurb: 'Test the backup thruster, then hold the nose on the line. Fewest clock steps wins.',
    tradeoff: 'Speed against mistakes.', shifts: 1, shiftLen: LEN(999, 999, 999), items: {},
    panels: { place: 'Propulsion Bay and Bridge.', change: 'The dock wants a clean approach.', need: 'Engineering tests the thruster. The Pilot lines us up.' },
    assignments: { engineer: 'Thruster test.', pilot: 'Attitude.' }, science: [], labels: ['Quick crew game'] },
  { id: 'signal_hunt', n: 9, kind: 'drill', title: 'Quick Game: Signal Hunt', blurb: 'Cool the relay, find the signal, send the update. Fewest clock steps wins.',
    tradeoff: 'Speed against mistakes.', shifts: 1, shiftLen: LEN(999, 999, 999), items: {},
    panels: { place: 'Comms Mast and Thermal Control.', change: 'The relay is hot and off target.', need: 'Engineering cools it. Comms finds the signal.' },
    assignments: { engineer: 'Coolant.', comms: 'Dish.' }, science: [], labels: ['Quick crew game'] },
];
export const INCIDENT_BY_ID = Object.fromEntries(INCIDENTS.map((i) => [i.id, i])) as Record<IncidentId, IncidentSpec>;
