# Science sources and credits

14 November 2026. The in-game version of this list is the **Science and Credits** screen, generated from `src/sim/sources.ts`.

## Sources and how they were checked

"Checked" means the page was fetched on 14 November 2026 and the claim the game makes was found on it.

| Source | Used for | Checked |
| --- | --- | --- |
| [NASA Space Apps: Build a Junior Astronaut Mission Trainer](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/) | Audience and the outpost trade-offs | From the team's page captures, not re-fetched |
| [NASA: astronaut candidate training](https://www.nasa.gov/news-release/new-artemis-generation-astronauts-to-graduate-nasa-sets-coverage/) | Training topics: spacewalking, robotics, station systems, jet flying | Yes |
| [NASA Glenn: What is microgravity?](https://www.nasa.gov/centers-and-facilities/glenn/what-is-microgravity/) | Free fall ("falling together"), 28,000 km/h orbital speed | Yes |
| [NASA NSSDCA Planetary Fact Sheet, ratio table](https://nssdc.gsfc.nasa.gov/planetary/factsheet/planet_table_ratio.html) | Gravity ratios: Moon 0.166, Mars 0.377 | Yes |
| [NASA SVS 5027: Illumination at the Moon's South Pole](https://svs.gsfc.nasa.gov/5027) | Low Sun angle and changing light at the south pole | Yes |
| [NASA CCMC DONKI alert 20260905-AL-007](https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/Alert/48560/1) | Identifier, type and issue time (2026-09-05 16:27 UTC) for the scripted solar alert | **No.** The host refused the connection and the NASA API demo key was rate-limited. Values come from the team research report. Re-check before judging |
| [NASA: protecting astronauts from radiation at the Moon](https://science.nasa.gov/science-research/heliophysics/how-nasa-will-protect-astronauts-from-space-radiation-at-the-moon/) | Crews shelter during solar particle events. Soil could be piled over lunar shelters | Yes |
| [NASA ECLSS](https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/) | Powered systems make oxygen, remove carbon dioxide and control cabin pressure | Yes. The page gives no pressure figures and does not cover leaks, so S04's gauge readings and leak rates are labelled illustrative |
| [NASA Veggie](https://science.nasa.gov/mission/veggie/) | A space garden that grows fresh food for astronauts | Yes. The page does not describe the lights, so the grow lights are labelled illustrative |
| [NASA: space communications](https://www.nasa.gov/missions/tech-demonstration/space-communications-7-things-you-need-to-know/) | Mars signal delay of 4 to 24 minutes each way | Yes. The Moon figure (a little over one second) is calculated from distance, not taken from this page |
| [NASA: Mars facts](https://science.nasa.gov/mars/facts/) | Thin carbon dioxide atmosphere, planet-wide dust storms, months for dust to settle | Yes |

## Real, archived, compressed, invented

| Kind | Examples in the game |
| --- | --- |
| Real, sourced | Gravity on the Moon and Mars. Why astronauts float. Orbital speed. Sheltering during solar particle events. Mars signal delay. Thin Martian air and dust storms |
| Archived record | The lunar solar alert's identifier and time. Not live data, not a forecast, and no dose is modelled |
| Compressed time | Countdown and climb to orbit, both descents, outpost shifts, the wait for a reply from Earth |
| Invented game values | Energy units, battery size, crop stages, the Air comfort score, fuel budgets, landing limits, storm length, the panel brush, backup cells, station gauge readings, leak rates, the air reserve, the two-joint arm, every vehicle, station and habitat |

## Assets

- **3D models, textures, sounds, the Beyond Earth patch:** generated in code in `src/three/` and `src/game/audio.ts`. No third-party asset files.
- **No NASA insignia and no flags.** Beyond Earth is a hackathon project and is not endorsed by NASA.
- **Fonts:** the system's own sans-serif. Nothing is downloaded.

## Code

| Package | Version | License |
| --- | --- | --- |
| react, react-dom | 19.3.1 | MIT |
| three | 0.187.0 | MIT |
| @react-three/fiber | 9.8.2 | MIT |
| zustand | 5.1.0 | MIT |
| vite | 8.3.8 | MIT |
| @vitejs/plugin-react | 6.3.0 | MIT |
| vitest | 5.1.0 | MIT |
| typescript | 7.0.2 | Apache-2.0 |

`RoomEnvironment` from the three.js examples (MIT) provides the reflection map.

## Supplied repositories: what was used

| Resource | Decision |
| --- | --- |
| [GameDev Agent Skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) (Apache-2.0) | Read the index. Applied its general guidance: fixed timestep, named input actions, measure before optimising. No code copied |
| [TripoSR](https://github.com/vast-ai-research/triposr) | Not used. No image-to-3D prop was needed for the route. Simple props are in place |
| [Coding-Solo Godot MCP](https://github.com/Coding-Solo/godot-mcp), [Godot Asset 5245](https://godotengine.org/asset-library/asset/5245), [MCP Unity](https://github.com/CoderGamester/mcp-unity/releases) | Not applicable. There is no Godot or Unity project |
| [Colyseus](https://github.com/colyseus/colyseus) | Not used. The prototype is single-player. Kept as a future co-op option |
