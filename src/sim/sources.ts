// Science references bundled with the game so play never depends on a live API.
// `kind` tells the player what sort of information each entry is.

export type SourceKind = 'nasa-reference' | 'archived-record' | 'challenge';

export interface Source {
  id: string;
  title: string;
  org: string;
  url: string;
  kind: SourceKind;
  /** What the game takes from this source. */
  use: string;
  /** What the game invents on top of it. */
  simplified: string;
}

export const SOURCES: Source[] = [
  {
    id: 'challenge', kind: 'challenge', org: 'NASA Space Apps Challenge 2026',
    title: 'Build a Junior Astronaut Mission Trainer',
    url: 'https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/',
    use: 'Audience (ages 7-12), outpost trade-offs between life support, shielding, power, food and communication delay.',
    simplified: 'Missions, vehicles and the outposts are fictional training scenarios.',
  },
  {
    id: 'astro_training', kind: 'nasa-reference', org: 'NASA',
    title: 'Astronaut candidate training (Artemis generation graduation release)',
    url: 'https://www.nasa.gov/news-release/new-artemis-generation-astronauts-to-graduate-nasa-sets-coverage/',
    use: 'Real training topics: spacewalking, robotics, space station systems and jet flying.',
    simplified: 'The suit check, trainer rig and checklists are simplified, fictional procedures.',
  },
  {
    id: 'microgravity', kind: 'nasa-reference', org: 'NASA Glenn Research Center',
    title: 'What is microgravity?',
    url: 'https://www.nasa.gov/centers-and-facilities/glenn/what-is-microgravity/',
    use: 'Astronauts float because they and the station are all falling together around Earth, at about 28,000 km per hour (7.8 km per second).',
    simplified: 'Station movement is limited to a flat push, drift and grab exercise.',
  },
  {
    id: 'gravity', kind: 'nasa-reference', org: 'NASA NSSDCA',
    title: 'Planetary Fact Sheet: ratio to Earth values',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/planet_table_ratio.html',
    use: 'Surface gravity compared with Earth: Moon 0.166, Mars 0.377. The game uses 9.8, 1.62 and 3.71 m/s2.',
    simplified: 'Walking speed and suit handling are tuned for play. The jump push is the same on every world.',
  },
  {
    id: 'lunar_illum', kind: 'nasa-reference', org: "NASA Scientific Visualization Studio",
    title: "Illumination at the Moon's South Pole to 80°S, 2025 to 2028 (SVS 5027)",
    url: 'https://svs.gsfc.nasa.gov/5027',
    use: 'Simulated sunlight and shadow at the lunar south pole. The low Sun angle and rugged terrain make light come and go, which grounds the solar power drop.',
    simplified: 'The habitat site is fictional. Power is counted in invented game units and shifts are compressed.',
  },
  {
    id: 'donki_alert', kind: 'archived-record', org: 'NASA CCMC DONKI',
    title: 'Archived space weather alert 20260905-AL-007 (solar energetic particles)',
    url: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/Alert/48560/1',
    use: 'Alert type, identifier and issue time (2026-09-05 16:27 UTC) label the scripted shelter event.',
    simplified: 'This is an archived record, not live data and not a forecast. The game does not model a measured lunar dose. Shelter effects are invented rules.',
  },
  {
    id: 'radiation_shelter', kind: 'nasa-reference', org: 'NASA Science',
    title: 'How NASA will protect astronauts from space radiation at the Moon',
    url: 'https://science.nasa.gov/science-research/heliophysics/how-nasa-will-protect-astronauts-from-space-radiation-at-the-moon/',
    use: 'During a solar particle event, crews build or enter a dense shelter. On the Moon, soil could be piled over shelters.',
    simplified: 'The two shelter plans are fictional. Shielding comes from the walls. Power only runs the fans.',
  },
  {
    id: 'eclss', kind: 'nasa-reference', org: 'NASA',
    title: 'Environmental Control and Life Support Systems (ECLSS)',
    url: 'https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/',
    use: 'Powered systems make oxygen for the crew, remove carbon dioxide and control cabin air pressure.',
    simplified: 'The Air meter is a single comfort score. Costs are game units. Station gauge readings and leak rates in Module Alert are illustrative.',
  },
  {
    id: 'veggie', kind: 'nasa-reference', org: 'NASA Science',
    title: 'Vegetable Production System (Veggie)',
    url: 'https://science.nasa.gov/mission/veggie/',
    use: 'Veggie is a space garden on the space station that grows fresh food for astronauts.',
    simplified: 'The grow rack, its lights, crop stages and growth speed are illustrative. Real plants take weeks.',
  },
  {
    id: 'comms', kind: 'nasa-reference', org: 'NASA',
    title: 'Space Communications: 7 things you need to know',
    url: 'https://www.nasa.gov/missions/tech-demonstration/space-communications-7-things-you-need-to-know/',
    use: 'Radio signals take time to cross space: between about 4 and 24 minutes each way to Mars. The Moon is much closer, a little over one second (calculated from its distance).',
    simplified: 'In the game a reply arrives one decision later. That wait stands for signal travel plus the time the team on Earth needs to answer.',
  },
  {
    id: 'mars_dust', kind: 'nasa-reference', org: 'NASA Science',
    title: 'Mars: facts (atmosphere and dust storms)',
    url: 'https://science.nasa.gov/mars/facts/',
    use: 'Mars has a thin atmosphere, mostly carbon dioxide. Winds can raise dust storms that cover much of the planet, and the dust can take months to settle.',
    simplified: 'Storm length, power numbers and the panel brush are invented game rules.',
  },
  {
    id: 'body_in_space', kind: 'nasa-reference', org: 'NASA',
    title: 'The human body in space',
    url: 'https://www.nasa.gov/humans-in-space/the-human-body-in-space/',
    use: 'Without Earth gravity, weight-bearing bones lose on average 1% to 1.5% of mineral density a month, muscles weaken, and body fluid shifts toward the head. Crews exercise to slow this.',
    simplified: 'The Gravity Test Chamber is invented: no real tube can switch gravity. The height gain and the two hours of daily exercise are from other NASA articles, rounded.',
  },
];

export function sourceById(id: string): Source | undefined {
  return SOURCES.find((s) => s.id === id);
}

export const LABELS = {
  units: 'Energy units are invented game units.',
  time: 'Time is compressed.',
  archived: 'Archived NASA record. Not live data.',
  fictional: 'Fictional training procedure.',
};
