# Beyond Earth

A 3D browser astronaut mission trainer for ages 7 to 12, built for the NASA Space Apps challenge **Build a Junior Astronaut Mission Trainer**. One trainee astronaut goes from an Earth academy to a shuttle flight, an orbital station, a lunar outpost and a Mars outpost. The signature mechanic is **Mission Replay**: restore a decision checkpoint, change one choice and compare both outcomes.

Built with React 19, TypeScript, Vite 8, three.js r187 and React Three Fiber 9. All models, sounds and icons are generated in code. The bundled third-party assets are NASA imagery in `public/textures/` (four globe maps, plus the Moon and Mars ground the player walks on, made from Lunar Reconnaissance Orbiter and Mars Viking mosaic imagery) and three typefaces under the SIL Open Font License (Space Grotesk, JetBrains Mono and Exo 2), installed from npm with everything else. See `docs/SCIENCE_AND_CREDITS.md`.

This repository began as a pre-event prep folder. Those notes, data samples and scripts are still here: see [Pre-event prep notes](#pre-event-prep-notes) at the end.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. No account, no network access needed after the page loads.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 5173 |
| `npm run build` | Type check, then production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | 215 simulation tests (Vitest) |
| `npm run typecheck` | TypeScript only |

## The eight playable missions

| ID | World | Mission | What the player does |
| --- | --- | --- | --- |
| E02 | Earth | Gravity and Suit Lab | Suit preflight check with a low-pressure fault, then carry a pouch through Earth, Mars and Moon gravity lanes |
| F01 | Shuttle | Liftoff to Orbit | Cockpit checklist, throttle and steering through six gates, guidance deviation, engine cutoff at orbital speed |
| F03 | Shuttle | Keep the Ship Flying | Four-room transfer craft: fit the one spare connector to navigation or ventilation, steady the air, latch the spare battery, then dock |
| S01 | Station | Dock and Drift | Docking by alignment and closing speed, then push, drift and grab to stow cargo |
| S04 | Station | Module Alert | Find a leaking module from hatch gauges, then seal it or first rescue an experiment with the robotic arm |
| L02 | Moon | Power Before Shadow | Engine-only landing, low-gravity surface work, then the habitat power emergency and replay |
| L03 | Moon | The Last Battery | Carry one battery between the grow rack and the shelter fans while the base is in shadow and a solar particle alert arrives. Replay the choice |
| M04 | Mars | Dust Storm Outpost | Parachute and engine landing, rover inspection, dust storm, outpost power decisions |

E02, F01, S01, L02 and M04 are the five-world route: each unlocks the next. S04 is an extra station mission that opens after S01 and is not needed to reach the Moon. F03 and L03 are a two-part story off the main route: F03 opens after F01, L03 opens after F03, and neither blocks the route. The other 12 missions appear on the mission map as **Planned** when you press **Show all 20 missions**.

## Crew Ship

**Crew Ship · play together** on the title screen puts 2 to 6 cadets on one walkable ship with 15 rooms, or one cadet with three scripted crew members in Solo Training. A shared crew needs `npm run dev`, which also runs the mission service. Setup, the room map, the task catalogue, what passed and what is not built (including WorkAdventure) are in [docs/CREW_SHIP.md](docs/CREW_SHIP.md).

## How it plays

- **Title screen.** One big Play or Continue button, then Missions, Settings and Science. Difficulty is three buttons underneath.
- **Mission map.** The five worlds on one route. Each playable mission is a card with its status in words (Up next, Available, Completed, Locked) and its stars.
- **Mission card.** Your role, the goal in one sentence, the steps, the keys, the three-star goal and a Start button.
- **In a mission.** The objective and its step sit top left, with any alert directly under it. Gauges are top right. The key to press and a tip from Mission Control are at the bottom, and the keys that work right now are listed bottom left.
- **Results.** One to three stars, what happened and why, a space fact with its source, and the next mission.

### Commander Reyes

Every playable mission opens with a briefing from Commander Reyes, an invented character: three comic panels (where we are, what changed, your assignment). Enter or the arrow keys turn the page, Esc skips, and it reads fully without sound. Reyes gives Junior a direct instruction, asks Middle to work the problem out, and gives Advanced part of the picture. The scene does not start until **Take Control**. Briefings can be watched again from **Mission Log** on the mission map. In a mission, Reyes speaks on the radio when something changes, and the results screen has Reyes name a decision you made and what it changed.

F03 and L03 are linked. If you latch the spare battery aboard the ship, it is waiting on the near rack on the Moon. If you do not, it is still strapped in the cargo crate, and digging it out costs time. Reyes says which in the L03 briefing.

### Stars, ranks and badges

Every finished mission earns one to three stars. The rules are plain, tested functions in `src/sim/score.ts`, and each mission card states its three-star goal before you start.

| Mission | Three stars for |
| --- | --- |
| E02 | Judging every suit reading right the first time |
| F01 | Flying through every gate on the first launch |
| F03 | Latching the spare battery and docking on the first approach |
| S01 | Docking on the first approach and never needing the tether |
| S04 | Finding the leak with no wrong report, then keeping 60% of the air or saving the experiment |
| L02, M04 | Finishing with the air at 75% or more and no checkpoint recovery |
| L03 | Keeping crew readiness at 100% with no checkpoint recovery |

Training resets and checkpoint recoveries only cost stars. Total stars set the rank shown next to the call sign, from Space Cadet to Mission Commander. A better Mission Replay keeps its stars. Stars, ranks and badges are invented game values.

## Controls

| Action | Keyboard | On screen |
| --- | --- | --- |
| Move, steer, aim | W A S D or arrow keys | Arrow pad |
| Jump, engine, throttle up, push off | Space | Large right button |
| Use, interact, grab, grip, parachute, confirm | E or Enter | Use button |
| Brake, throttle down | X | Brake button |
| Tether recovery (station), give up the arm rescue | R | Tether button |
| Pause | Esc or P | Pause button |
| Extra readouts | I | Info button |
| Sound on or off | | Speaker button |
| Dialogs and decisions | Tab, arrow keys, Enter, Esc | Click or tap |

Each menu screen starts with keyboard focus on its main button, so Enter moves on. The on-screen buttons appear by default on touch devices, and the gamepad button in the corner shows or hides them.

Settings: difficulty (Junior, Middle, Advanced), tips, sound effects (on by default), spoken alerts (off by default), captions, reduced motion, low graphics, Reset Progress with confirmation.

## Judge Mode

Switch on **Judge Mode** at the bottom of the title screen or the top of the mission map. Every playable mission opens directly, each mission card gains **Start at** buttons for later checkpoints, and progress is saved in a separate slot from the campaign.

## Project layout

```
src/
  sim/        Deterministic rules. No React, no three.js.
              movement, flight, station alert and arm, outpost engine, scenarios, missions, ship and battery rules, the commander's story, star ratings, save, sources
  game/       Store, input layer, HUD state, audio
  three/      Astronaut, terrain, sky, props, walking rig, canvas and fixed-step loop
  missions/   The eight mission scenes plus shared lander, EVA and habitat phases
  ui/         Title screen, mission map, mission card, HUD, decision panels, results, settings, credits,
              and the shared buttons, icons and planet art
tests/        Vitest suites for the simulation layer
docs/         Plan, progress log, SRS matrix, demo script, science and credits
```

Saves live in `localStorage` under `beyondEarth.campaign.v1` and `beyondEarth.judge.v1`. A guest profile is a random id. Nothing personal is stored.

## Test hooks

`window.__beyondEarth` exposes the store, the input layer, a fixed-step clock and read-only scene probes. Automated browser checks use it to step frames at exactly 1/60 s while sending ordinary keyboard events. Normal play never touches it.

## Documents

- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Progress log and test record](docs/PROGRESS_LOG.md)
- [SRS matrix: Pass, Fail, Unverified](docs/SRS_MATRIX.md)
- [Three-minute judge demo](docs/DEMO_SCRIPT.md)
- [Science sources and credits](docs/SCIENCE_AND_CREDITS.md)
- [Crew Ship: setup, ship map, tasks, acceptance matrix, demo](docs/CREW_SHIP.md)

## Pre-event prep notes

Everything below was written before the event started and is kept as it was. It describes the plan at that time: an Urdu Moon-base game called Junior Astronaut, with Vite and Phaser 3 as the suggested stack. The game that was built is Beyond Earth, described above, on React, TypeScript, Vite and React Three Fiber. The data samples in `data/` are not wired into the game yet.

### Junior Astronaut (prep only)

Prep folder for a NASA Space Apps 2026 project. No game code is in this repo.

The idea is Junior Astronaut, an Urdu Moon-base game for kids. Real NASA data drives the events: DONKI solar flares, a Moon south pole sunlight map, and Mars dust storm records for a later or optional Mars mode.

Official challenge: [Build a Junior Astronaut Mission Trainer](https://www.spaceappschallenge.org/2026/challenges/build-a-junior-astronaut-mission-trainer/)

Event: 14 Nov 2026, 8:00 AM PKT, to 15 Nov 2026, 6:00 PM PKT, at Cedar College, DHA Phase 8, Karachi.

Rules: do not write project or game code before the official start. Research, data, API tests, tool setup, and an empty starter template are allowed. After 8:00 AM PKT on 14 Nov, you can start building.

This folder was prepared before the start. It has notes, test data, and install commands only.

#### What's in here

- [docs/challenge.md](docs/challenge.md): challenge summary, official datasets, and judging criteria.
- [docs/stack.md](docs/stack.md): recommended stack (Vite + Phaser 3) and Windows install commands. No game code.
- [docs/pitch-proof.md](docs/pitch-proof.md): verified pitch numbers with sources.
- [docs/demo-story.md](docs/demo-story.md): 2-minute demo story and a role / hour plan.
- [data/SOURCES.md](data/SOURCES.md): every data file, URL, and license.
- [data/donki/flr_sample.json](data/donki/flr_sample.json): one test DONKI flare call (last 30 days from 14 Nov 2026).
- [data/moon/](data/moon/): LRO LOLA average solar illumination for 85S-90S at 60 m/px, plus a small PNG preview.
- [data/mars/MDAD.tab](data/mars/MDAD.tab): Mars Dust Activity Database (14,974 storm instances).
- [scripts/test_donki.sh](scripts/test_donki.sh) and [scripts/test_donki.bat](scripts/test_donki.bat): repeat the flare test. Reads `NASA_API_KEY`, falls back to `DEMO_KEY`.

#### NASA API key

Get a free key at [https://api.nasa.gov](https://api.nasa.gov). Sign up with sabih.rehman.dev@gmail.com. The shared `DEMO_KEY` works for a first test but is limited to 30 calls per hour and 50 per day.

On Windows cmd:

```
set NASA_API_KEY=your_key_here
scripts\test_donki.bat
```

#### Push this folder to GitHub

Copy this folder onto your Windows machine first, then in cmd:

```
cd path\to\Nasa-Space-Apps-Challenge-2026
git remote add origin https://github.com/Sabih-sourcee/Nasa-Space-Apps-Challenge-2026.git
git branch -M main
git push -u origin main
```

If Git asks you to log in, use your GitHub account. If the remote repo already has a README, run `git pull origin main --rebase` before the push.

Do not start writing game code until 8:00 AM PKT on 14 Nov 2026.
