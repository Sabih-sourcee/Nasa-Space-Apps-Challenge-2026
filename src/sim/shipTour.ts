// The 3D ship tour: things you can click in each room of the Kestrel, what
// each one does, and the real space term behind it. The Kestrel is invented.
// The explanations describe how real spacecraft work in plain words, and link
// to the sources listed in sources.ts.

import type { RoomId } from './crewData';

export interface TourSpot {
  id: string;
  room: RoomId;
  /** Where it stands in the room, as an offset from the room centre. */
  dx: number;
  dz: number;
  name: string;
  /** What this thing does on the ship. */
  what: string;
  /** How to use it, or what to watch for. */
  use: string;
  /** The term a real crew would use, and what it means. */
  term: string;
  meaning: string;
  sourceId: string;
}

export const TOUR_SPOTS: TourSpot[] = [
  { id: 'pilot_seat', room: 'bridge', dx: -2.6, dz: 1.6, name: 'Pilot seat and hand controller', what: 'The Pilot turns and moves the ship from here.', use: 'Small pushes. The ship keeps turning until you push the other way.', term: 'Attitude', meaning: 'Which way the ship is pointing. Changing it is called attitude control.', sourceId: 'microgravity' },
  { id: 'readiness_board', room: 'bridge', dx: 0.4, dz: 2.4, name: 'Readiness board', what: 'One light for each thing that must be ready before a burn or a docking.', use: 'Every light green means go. One light not green means hold.', term: 'Go / No-go', meaning: 'A check where each station says "go" if it is ready. One "no-go" stops the step.', sourceId: 'astro_training' },
  { id: 'chart_table', room: 'trajectory', dx: 0, dz: 1.2, name: 'Chart table', what: 'Shows the path the ship is on and the paths it could take.', use: 'Compare routes by time and by fuel before you choose.', term: 'Trajectory', meaning: 'The path a spacecraft follows through space.', sourceId: 'microgravity' },
  { id: 'burn_planner', room: 'trajectory', dx: 2.8, dz: 2.2, name: 'Burn planner', what: 'Works out how long to fire the engines to change course.', use: 'A bigger change of speed needs more fuel.', term: 'Delta-v', meaning: 'A change in speed. It is how crews measure what a manoeuvre costs.', sourceId: 'microgravity' },
  { id: 'dish', room: 'comms', dx: 0, dz: 1.4, name: 'Relay dish', what: 'Sends the ship\'s voice and data to Earth and listens for the answer.', use: 'It only hears Earth when it points at Earth.', term: 'Signal delay', meaning: 'Radio travels at the speed of light and still takes time: seconds to the Moon, minutes to Mars.', sourceId: 'comms' },
  { id: 'telemetry', room: 'comms', dx: -2.8, dz: 2.2, name: 'Telemetry console', what: 'Sends the ship\'s readings home automatically.', use: 'Mission control reads these numbers to help the crew.', term: 'Telemetry', meaning: 'Measurements sent by radio from a spacecraft to the people watching over it.', sourceId: 'comms' },
  { id: 'dome', room: 'observation', dx: 0, dz: 1.2, name: 'Observation dome', what: 'A window for looking at Earth, the Moon and the stars, and for experiments.', use: 'Let go of something gently and watch what it does.', term: 'Microgravity', meaning: 'The floating you see in orbit. The ship and everything in it are falling around the planet together.', sourceId: 'microgravity' },
  { id: 'orbit_display', room: 'observation', dx: 2.8, dz: 2.2, name: 'Orbit display', what: 'Shows the ship circling the planet.', use: 'The ship is always falling, and always missing the ground.', term: 'Orbit', meaning: 'The curved path of something going fast enough sideways to keep falling around a planet.', sourceId: 'microgravity' },
  { id: 'suit_rack', room: 'airlock', dx: -2.6, dz: 1.6, name: 'Spacesuit rack', what: 'Holds the suits the crew wears outside.', use: 'Seals first, air second, tether last.', term: 'EVA', meaning: 'Extravehicular activity: work done outside the spacecraft. A spacewalk.', sourceId: 'astro_training' },
  { id: 'hatch', room: 'airlock', dx: 2.4, dz: 2.0, name: 'Airlock hatch', what: 'Two doors with a small room between. Only one opens at a time.', use: 'The air is pumped out of the small room before the outer door opens.', term: 'Airlock', meaning: 'A room that lets people go outside without letting the ship\'s air escape.', sourceId: 'astro_training' },
  { id: 'battery_wall', room: 'power', dx: -2.6, dz: 1.6, name: 'Battery wall', what: 'Stores electricity for the times the solar panels are in shadow.', use: 'Whatever is not used is saved. What is saved can run out.', term: 'Reserve power', meaning: 'Stored energy kept back for an emergency or a dark stretch.', sourceId: 'lunar_illum' },
  { id: 'bus', room: 'power', dx: 2.6, dz: 2.2, name: 'Power distribution panel', what: 'Splits the ship\'s power into branches, one for each group of equipment.', use: 'A fault on one branch only darkens that branch.', term: 'Power bus', meaning: 'The main line that carries electricity around a spacecraft, with branches off it.', sourceId: 'eclss' },
  { id: 'scrubber', room: 'life', dx: -2.6, dz: 1.6, name: 'CO₂ scrubber', what: 'Takes carbon dioxide out of the air the crew breathes out.', use: 'Its filter fills up and has to be changed.', term: 'ECLSS', meaning: 'Environmental Control and Life Support System: the machines that keep air, water and temperature safe.', sourceId: 'eclss' },
  { id: 'fans', room: 'life', dx: 2.6, dz: 2.2, name: 'Circulation fans', what: 'Keep the air moving through every room.', use: 'In free fall warm air does not rise, so stale air stays put unless fans move it.', term: 'Cabin air', meaning: 'The air inside the ship: the right pressure, enough oxygen, not too much carbon dioxide.', sourceId: 'eclss' },
  { id: 'table', room: 'galley', dx: -1.8, dz: 1.8, name: 'Crew table and meal rack', what: 'Where the crew eats, and where packaged meals are counted out.', use: 'One pack each per shift. Keep a reserve.', term: 'Consumables', meaning: 'Things that get used up: food, water, air, fuel. They are counted carefully.', sourceId: 'veggie' },
  { id: 'warmer', room: 'galley', dx: 2.4, dz: 2.0, name: 'Food warmer', what: 'Heats meal pouches. There is no open flame on a spacecraft.', use: 'It needs power from the Galley branch.', term: 'Mission day', meaning: 'Crews work to a schedule of shifts. Meals, sleep and jobs are all planned.', sourceId: 'astro_training' },
  { id: 'tanks', room: 'water', dx: -2.4, dz: 1.6, name: 'Water tanks', what: 'Clean water, used water and recovered water, in three tanks.', use: 'Watch which tank is filling. Clean water on the waste side means a leak.', term: 'Water recovery', meaning: 'Cleaning used water so it can be used again. Most water on a spacecraft is recycled.', sourceId: 'eclss' },
  { id: 'recycler', room: 'water', dx: 2.6, dz: 2.2, name: 'Recycle loop', what: 'Pumps used water through filters and back to the clean tank.', use: 'Close the valve before opening a pipe. Check the flow after.', term: 'Closed loop', meaning: 'A system that reuses what it has instead of throwing it away.', sourceId: 'eclss' },
  { id: 'crates', room: 'cargo', dx: -2.4, dz: 1.6, name: 'Cargo crates and latches', what: 'Supplies, strapped and latched so they cannot drift.', use: 'Heavy first and low. Close the latch. Tug to test.', term: 'Payload', meaning: 'What a spacecraft carries for its mission: cargo, experiments, supplies.', sourceId: 'microgravity' },
  { id: 'manifest', room: 'cargo', dx: 2.6, dz: 2.2, name: 'Manifest board', what: 'The list of every crate, with its weight and its marking.', use: 'When a label and the manifest disagree, trust the weight and the band.', term: 'Manifest', meaning: 'The official list of everything loaded aboard.', sourceId: 'astro_training' },
  { id: 'thrusters', room: 'propulsion', dx: -2.4, dz: 1.6, name: 'Thruster bells', what: 'Push gas out one way so the ship moves the other way.', use: 'Test with a short pulse before you rely on one.', term: 'Thrust', meaning: 'The push from an engine. Every push one way moves the ship the opposite way.', sourceId: 'microgravity' },
  { id: 'fuel_valves', room: 'propulsion', dx: 2.6, dz: 2.2, name: 'Fuel valves', what: 'Open and close the fuel lines to each thruster.', use: 'Valve open, test pulse, read the gauge, then arm.', term: 'Redundancy', meaning: 'Carrying a backup for important equipment, such as a second thruster.', sourceId: 'astro_training' },
  { id: 'coolant', room: 'thermal', dx: -2.4, dz: 1.6, name: 'Coolant pipes', what: 'Carry heat away from hot equipment in pumped liquid.', use: 'Cooling sent to one branch is cooling taken from another.', term: 'Thermal control', meaning: 'Keeping equipment and crew at a safe temperature. In space there is no air to carry heat away.', sourceId: 'eclss' },
  { id: 'radiator', room: 'thermal', dx: 2.6, dz: 2.2, name: 'Radiator controls', what: 'Send the collected heat out to space from large flat panels.', use: 'Radiators face away from the Sun.', term: 'Radiator', meaning: 'A panel that gets rid of heat by glowing it away as invisible light.', sourceId: 'eclss' },
  { id: 'grow_trays', room: 'grow', dx: -2.2, dz: 1.6, name: 'Crop trays', what: 'Fresh plants grown under lamps.', use: 'Plants need light and water, and weeks of time.', term: 'Space crops', meaning: 'Plants grown aboard for fresh food. They add to packaged meals and do not replace them.', sourceId: 'veggie' },
  { id: 'grow_lights', room: 'grow', dx: 2.6, dz: 2.2, name: 'Grow lights', what: 'Pink lamps that give plants the red and blue light they use most.', use: 'A dark lamp over damp soil means the tray needs light, not water.', term: 'Supplemental food', meaning: 'Food that tops up the main supply.', sourceId: 'veggie' },
  { id: 'med_dummy', room: 'medbay', dx: -2.2, dz: 1.6, name: 'Training dummy and suit monitor', what: 'Shows a practice crew member\'s suit readings.', use: 'Compare every reading with its safe range before calling for help.', term: 'Biomedical monitor', meaning: 'Sensors that watch a crew member\'s suit and health during a task.', sourceId: 'astro_training' },
  { id: 'med_kit', room: 'medbay', dx: 2.6, dz: 2.2, name: 'Medical kit', what: 'First aid supplies, strapped down.', use: 'On a real mission every crew member trains in first aid.', term: 'Crew readiness', meaning: 'How fit and rested the crew is to do its work. In this game it is a score.', sourceId: 'astro_training' },
  { id: 'shelter_walls', room: 'shelter', dx: -2.2, dz: 1.6, name: 'Shielded walls', what: 'Thick walls, with supplies packed around them.', use: 'The walls do the shielding. Power only runs the fans and lights inside.', term: 'Solar particle event', meaning: 'A burst of fast particles from the Sun. Crews move to the best shielded part of their ship.', sourceId: 'radiation_shelter' },
  { id: 'shelter_supplies', room: 'shelter', dx: 2.6, dz: 2.2, name: 'Shelter supplies', what: 'Water, meal packs and a fan, ready before they are needed.', use: 'Count the crew, check supplies, start ventilation, then close the hatch.', term: 'Radiation shielding', meaning: 'Material placed between people and radiation. Dense walls, water and soil all help.', sourceId: 'radiation_shelter' },
];

/** The words worth knowing before flying. Built from the tour, so every term has a place on the ship. */
export const GLOSSARY: { term: string; meaning: string; where: string }[] = TOUR_SPOTS
  .map((s) => ({ term: s.term, meaning: s.meaning, where: s.name }))
  .sort((a, b) => a.term.localeCompare(b.term));
