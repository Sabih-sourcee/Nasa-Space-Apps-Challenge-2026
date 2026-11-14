# Beyond Earth

A 3D browser astronaut mission trainer for ages 7 to 12, built for the NASA Space Apps challenge **Build a Junior Astronaut Mission Trainer**. One trainee astronaut goes from an Earth academy to a shuttle flight, an orbital station, a lunar outpost and a Mars outpost. The signature mechanic is **Mission Replay**: restore a decision checkpoint, change one choice and compare both outcomes.

Built with React 19, TypeScript, Vite 8, three.js r187 and React Three Fiber 9. All models, textures and sounds are generated in code, so there are no asset files to download or license.

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
| `npm test` | 113 simulation tests (Vitest) |
| `npm run typecheck` | TypeScript only |

## The six playable missions

| ID | World | Mission | What the player does |
| --- | --- | --- | --- |
| E02 | Earth | Gravity and Suit Lab | Suit preflight check with a low-pressure fault, then carry a pouch through Earth, Mars and Moon gravity lanes |
| F01 | Shuttle | Liftoff to Orbit | Cockpit checklist, throttle and steering through six gates, guidance deviation, engine cutoff at orbital speed |
| S01 | Station | Dock and Drift | Docking by alignment and closing speed, then push, drift and grab to stow cargo |
| S04 | Station | Module Alert | Find a leaking module from hatch gauges, then seal it or first rescue an experiment with the robotic arm |
| L02 | Moon | Power Before Shadow | Engine-only landing, low-gravity surface work, then the habitat power emergency and replay |
| M04 | Mars | Dust Storm Outpost | Parachute and engine landing, rover inspection, dust storm, outpost power decisions |

E02, F01, S01, L02 and M04 are the five-world route: each unlocks the next. S04 is an extra station mission that opens after S01 and is not needed to reach the Moon. The other 14 missions are listed in the Mission Atlas as **Planned**.

## Controls

| Action | Keyboard | On screen |
| --- | --- | --- |
| Move, steer, aim | W A S D or arrow keys | Arrow pad |
| Jump, engine, throttle up, push off | Space | Large right button |
| Use, interact, grab, grip, parachute, confirm | E or Enter | Use button |
| Brake, throttle down | X | Brake button |
| Tether recovery (station), give up the arm rescue | R | Tether button |
| Pause | Esc or P | Pause button |
| Dialogs and decisions | Tab, arrow keys, Enter, Esc | Click or tap |

Settings: difficulty (Junior, Middle, Advanced), hints, reduced motion, sound and spoken alerts (off by default), captions, low graphics preset, Reset Progress with confirmation.

## Judge Mode

Tick **Judge Mode** on the home screen or the atlas. Every playable mission opens directly, each briefing gains **Start at** buttons for later checkpoints, and progress is saved in a separate slot from the campaign.

## Project layout

```
src/
  sim/        Deterministic rules. No React, no three.js.
              movement, flight, station alert and arm, outpost engine, scenarios, missions, save, sources
  game/       Store, input layer, HUD state, audio
  three/      Astronaut, terrain, sky, props, walking rig, canvas and fixed-step loop
  missions/   The six mission scenes plus shared lander, EVA and habitat phases
  ui/         Home, atlas, briefing, HUD, decision panels, debrief, settings, credits
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
