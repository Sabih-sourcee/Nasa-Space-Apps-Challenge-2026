# Implementation plan

14 November 2026. Baseline: Beyond Earth SRS v1.0, the research report, the NASA challenge brief and the five visual references.

## Decisions taken at the start

- **Workspace was empty**, so this is a new project on the SRS stack: React, TypeScript, Vite, React Three Fiber. One engine.
- **Art direction:** the realistic direction in the build prompt replaces the cartoon direction in the older development plan. Realism comes from proportions, PBR materials, hard lunar shadows, Martian haze and live instruments. All geometry and textures are procedural.
- **No external assets, no backend, no live API.** Firebase, Meteomatics and cloud saves from the older plan are out of the prototype. Guest play with local saves only.
- **Simulation first.** Every rule lives in `src/sim` as pure functions with tests. Scenes call those functions at a fixed 60 Hz step and only draw the result.
- **Original insignia.** No NASA logo or flags, although the reference images show them.

## Stages and the acceptance tests they serve

| Stage | Build | SRS acceptance tests |
| --- | --- | --- |
| 0. Browser foundation | Home, atlas, guest profile, difficulty, astronaut controller | AT-01 (entry), AT-06 (profile) |
| 1. Earth Academy (E02) | Suit check, pressure fault, gravity lanes | AT-01, AT-02 |
| 2. Shuttle Flight (F01) | Checklist, ascent, guidance deviation | AT-01, AT-04 (flight error) |
| 3. Orbital Station (S01) | Docking, push, drift, grab, cargo | AT-01, AT-02 (orbital drift), AT-04 (station hazard) |
| 4. Moon landing and EVA (L02) | Engine landing, low-gravity work | AT-01, AT-02 |
| 5. Lunar outpost and replay (L02) | Power, air, crops, shelter, solar alert, replay | AT-03, AT-04 (solar alert), AT-05, AT-07 |
| 6. Mars landing and outpost (M04) | Parachute landing, rover, dust storm, delayed reply | AT-01, AT-03, AT-04 (dust event) |
| 7. Campaign and release QA | Saves, resume, Judge Mode, accessibility, credits | AT-06, AT-07, NFR-02 to NFR-06 |
| 8. Station Module Alert (S04) | Gauge diagnostics, robotic arm, isolate-or-rescue decision | FR-04, AT-04 (station hazard) |

Stages 4 and 5 are one connected mission.

## Five owners

| Owner | Area | Files to start in |
| --- | --- | --- |
| 1. Gameplay engineer | Turn engine, scenarios, difficulty, emergency triggers, replay | `src/sim/outpost.ts`, `src/sim/outpostScenarios.ts`, `tests/outpost.test.ts` |
| 2. Flight and movement engineer | Walking presets, drift, ascent, docking, both landers | `src/sim/movement.ts`, `src/sim/flight.ts`, `src/missions/LanderFlight.tsx` |
| 3. 3D artist and level designer | Astronaut, vehicles, habitat, terrain, lighting | `src/three/Astronaut.tsx`, `src/three/Props.tsx`, `src/three/Scenery.tsx` |
| 4. UI and frontend engineer | Atlas, briefing, HUD, decision panels, debrief, saves, accessibility | `src/ui/`, `src/game/store.ts`, `src/styles.css` |
| 5. Science and QA lead | Source checks, mission text, tests, judge demo | `src/sim/sources.ts`, `src/sim/missions.ts`, `docs/` |

## Scope rule

If time runs short, cut scenery, texture detail and room count first. Do not cut player-controlled flight, docking, either landing, the outpost decisions or replay.

## Next work, in priority order

1. Hands-on playtest at real speed on the demo laptop, with the Browser visible, in Chrome and Firefox. Tune fuel, tolerances and walking distances from what children actually do.
2. Re-check the archived DONKI alert link and identifier (see `docs/SCIENCE_AND_CREDITS.md`).
3. Backlog missions from the 20-mission table. S04 Module Alert is now built and closes FR-04. E03 Robotics Lab and S03 Station Repair can reuse its arm model.
4. Optional: one static GLB prop through TripoSR, only after the playtest.
