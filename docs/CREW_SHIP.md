# Crew Ship

15 November 2026. Status words: **Pass**, **Fail**, **Unverified**, **Not built**.

Crew Ship puts 2 to 6 cadets on one walkable ship, the Kestrel, to work short room tasks and shared emergencies. It also runs alone as Solo Training with three scripted crew members. It was added on top of the campaign. Nothing in the campaign was removed.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173, then **Crew Ship · play together** on the title screen.

- **Solo training** and the **3D ship tour** need nothing else and work in any copy of the game.
- **Host a crew / Join with a code** works three ways:

| How the game was started | Who can join |
| --- | --- |
| `npm run dev` | Anyone on the same network who opens this computer's address |
| `npm start` (builds the game, then serves it to the network on port 4173) | The same. This is the one to use for a demo across computers |
| A plain static copy with no server behind it (the `dist` folder on a web host) | Other windows on the **same computer** only. The host's window holds the crew, so it must stay open |

- The game tries the server first. If there is none it switches to the same-computer mode by itself, and the lobby says so under the join code.
- Crew state is held in memory. Restarting the server, or closing the host window in the same-computer mode, ends the crew.
- Playing across computers from a static web host is **Not built**: that needs a server that stays running, which a static host does not have.

## What is in the build

| Part | File | Status |
| --- | --- | --- |
| Mission engine: crew, roles, ready and start, shared items, task claims, shifts, crew calls, host controls, replay | `src/sim/crew.ts` | Pass (35 unit tests) |
| Ship content: 15 rooms, 18 task types, 5 emergencies, a tour, 3 quick games | `src/sim/crewData.ts` | Pass (unit) |
| Mission service: one authoritative copy of each crew, join codes, per-cadet tokens, drop detection | `server/crewService.ts` | Pass (two browser tabs) |
| Lobby, briefing, 3D ship, task panels, crew HUD, debrief, Crew Replay | `src/ui/CrewShip.tsx`, `src/missions/CrewShipScene.tsx` | Pass for the paths listed below |
| WorkAdventure ship map and embedded panels | none | **Not built** (see below) |

## WorkAdventure: not used yet

The brief asked for WorkAdventure to carry walking and presence. That part is not done.

- Pinned revision inspected: `f4743a1d79f42277d232231ec1f5706c73d9efcb` (`master`), cloned into `.wa/wa`, which git ignores.
- Licence, read from `play/LICENSE.txt`: GNU AGPL version 3 with the Commons Clause, owned by TheCodingMachine, with a separate commercial edition. No WorkAdventure source or asset is copied into this repository.
- **Blocker:** Docker is installed but its daemon was not running (`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`). WorkAdventure's self-hosted setup is a Docker Compose stack (Traefik, play, back, map-storage, Redis). It was not started, so no map was loaded and no WorkAdventure room was joined.
- Integration points confirmed in its docs, for when it is run: a Tiled map needs a `floorLayer` object layer and 32 px orthogonal tiles; walls use a `collides` tile property; zones are objects of class `area`; a map `script` property loads a script; `WA.room.area.onEnter(name)` fires on entering a zone; `WA.nav.openCoWebSite(url)` opens an embedded page.
- What was done instead: walking, presence and interaction zones are drawn by the game's own 3D ship, and the mission service is the authority, as the brief asked for the mission state. The task panels are ordinary pages of this app, so they could later be opened from a WorkAdventure zone by URL.
- **WorkAdventure multiplayer: Unverified.** An original Tiled map: Not built.

## The ship

Five rooms across, three deep, the Galley in the centre. Every room in a row has a doorway to its neighbours. Columns 1, 3 and 5 also have doorways between rows, which makes two loops through the Galley column.

| | Column 1 | Column 2 | Column 3 | Column 4 | Column 5 |
| --- | --- | --- | --- | --- | --- |
| Fore | Trajectory Lab | Bridge | Comms Mast | Observation Lab | Airlock |
| Mid | Power Bay | Life Support | **Galley** | Water Recovery | Cargo Lock |
| Aft | Propulsion Bay | Thermal Control | Grow Lab | MedBay | Storm Shelter |

Each room has its own floor colour, its name painted large on the floor, and two pieces of equipment built from simple shapes (seats, a dish, tanks, fans, crates, thruster bells and so on). Stars surround the ship and the planet turns below it.

## 3D ship tour

**3D ship tour** on the Crew Ship screen starts a solo walk round the ship with nothing at stake. All 30 pieces of equipment can be clicked with the mouse, or walked up to and opened with E. Each card says what the thing does, how it is used, and the word a real crew uses for it, with a link for further reading. **Words to know** (the book button) lists all 30 terms and where each one is on the ship. Equipment can be clicked during emergencies too.

Checked in the browser: the tour started, a click on the pilot seat opened its card, the seen counter moved to 1 of 30, and the glossary listed 30 terms. Only that one piece of equipment was clicked. The linked pages are related NASA reading: they were not checked to contain each definition word for word.

## Task catalogue

Each task has a clue before it (predict), an action (do) and a science card with a source after it (explain). A wrong answer explains itself, costs one clock step and can be retried.

| # | Room | Task | How it is played | Station |
| --- | --- | --- | --- | --- |
| 01 | Bridge | Check flight readiness | Pick the condition that is not green | Pilot |
| 02 | Bridge | Correct attitude | Bring the nose angle into the target band and hold | Pilot |
| 03 | Trajectory Lab | Plot a debris bypass | Choose between a slow cheap route and a fast costly one | Pilot |
| 04 | Power Bay | Trace a broken circuit | Match the dark equipment to its connector | Systems Engineer |
| 05 | Power Bay | Install a reserve battery | Carry the one shared battery and seat it | Systems Engineer |
| 06 | Life Support | Replace a CO₂ filter | Carry the one spare filter and fit it | Life Support |
| 07 | Water Recovery | Repair the recycle loop | Put four repair steps in order | Life Support |
| 08 | Galley | Pack the next shift's meals | Count out one pack per crew member | Logistics |
| 09 | Grow Lab | Restore a crop tray | Diagnose light or water | Science |
| 10 | Cargo Lock | Secure cargo | Put four stowing steps in order | Logistics |
| 11 | Cargo Lock | Find a mislabeled supply | Match the manifest, then carry the crate | Logistics |
| 12 | Comms Mast | Align the relay | Turn the dish into the signal band, then send | Communications |
| 13 | Thermal Control | Balance coolant | Move coolant into the target band | Systems Engineer |
| 14 | Propulsion Bay | Bring the backup thruster online | Put the test sequence in order | Systems Engineer |
| 15 | Airlock | Check the EVA suit | Put the suit checks in order | Science |
| 16 | MedBay | Triage a suit alert | Compare a dummy's readings and pick the help request | Life Support |
| 17 | Observation Lab | Run a microgravity experiment | Predict what a released wrench does | Science |
| 18 | Storm Shelter | Prepare the shielded room | Put the shelter steps in order | Life Support |

Honest limit: the 18 tasks use five kinds of panel (pick, order, count, dial, carry). They are short puzzles in a dialog, not 18 separate physical mini-games. Tasks 02, 12 and 13 are a stepped dial, not live steering.

## Emergencies

| # | Mission | Status |
| --- | --- | --- |
| 1 | Last Meals on Board | Pass: unit on all three tiers, both routes and the missed action; browser solo and two tabs |
| 2 | The Air Is Getting Stale | Pass (unit). Not played in the browser |
| 3 | The Last Battery | The existing campaign mission L03. The lobby links to it. It is single-player |
| 4 | Water on the Wrong Side | Pass (unit). Not played in the browser |
| 5 | Houston Replies Too Late | Pass (unit). Not played in the browser |
| 6 | Docking Window | Pass (unit). Not played in the browser |
| | Ship Tour and Drills, Cargo Relay, Docking Drill, Signal Hunt | Pass (unit). Not played in the browser |

Tier differences in the crew missions are small so far: Junior is guided in order with long shifts, Middle has free order and shorter shifts, Advanced has the shortest shifts, dearer costs and, in Last Meals, one extra fault. Overlapping faults and distributed clues beyond that: **Not built**.

Carry-over: The Air Is Getting Stale starts with 60% reserve power, and Reyes says why, if the campaign's Last Battery ended with one unit or less. Docking Window records whether cargo was secured, and nothing reads it yet: **Not built**.

## Acceptance matrix

| Check | Result |
| --- | --- |
| Two browser clients enter the same crew with a join code | **Pass** (two tabs of one browser) |
| Another crew stays isolated | **Pass**: a second crew had its own state, and a token from the first was refused |
| Roles are exclusive, guest cannot start, host starts when all are ready | **Pass** (browser and unit) |
| Commander briefing with role assignments, manual advance, host hands over | **Pass** (solo, browser) |
| Idempotent writes: same action id applied once | **Pass** (unit) |
| Simultaneous pickup: one cadet gets the item | **Pass**: the second tab was told who holds the meal crate |
| Duplicate task submission | **Pass**: "That task is already done." |
| Dropped connection releases task and item, completed tasks persist | **Pass**: closing a tab marked the cadet Away after about 12 s |
| Rejoin from the service's snapshot after a reload | **Pass** |
| Last Meals: four-pack shortfall, cargo route, comms route, missed action | **Pass** (unit all tiers; browser Middle for both routes) |
| Crew Replay keeps the first outcome and shows the first changed room | **Pass** (unit and browser) |
| Solo training with scripted crew | **Pass** |
| Preset crew calls only, pseudonymous names | **Pass** (unit; one call sent between tabs) |
| Keyboard | Walking and E were driven by key events. Task panels were clicked, not driven by keyboard: **Unverified** |
| Touch | **Unverified** |
| Two separate browsers or two machines | **Unverified**: both clients were tabs of one in-app browser |
| WorkAdventure multiplayer | **Unverified / Not built** |
| Existing campaign and saves | **Pass**: 215 unit tests, and Crew Ship only reads the campaign save |

## Three-minute judge demo: one food emergency, two players, one replay

Before: `npm run dev`. Open the game in two browser windows side by side.

| Time | Do | Say |
| --- | --- | --- |
| 0:00 to 0:25 | Window A: **Crew Ship**, **Host a crew**. Read the code. Window B: **Join with a code** | "Two cadets, one ship. The ship is invite-only: a join code, made-up names, no chat box." |
| 0:25 to 0:45 | A picks **Pilot**, B picks **Logistics** and presses **I am ready**. A: **Last Meals on Board**, Middle, **Start**. Turn the panels, **Take Control** | "Commander Reyes gives each station a job. Eight packs, four crew, and the delivery has slipped a shift." |
| 0:45 to 1:20 | B walks to the Galley and counts out four packs. A walks to the Bridge and finds Shift 3 short by four | "They are in different rooms. Both gauges update in both windows, because one service owns the ship." |
| 1:20 to 1:55 | B: Cargo Lock, match the manifest, carry the crate to the Galley. A: Bridge, call the shift change three times | "The label was wrong and the weight was right. Crew time, no fuel. Everyone eats." |
| 1:55 to 2:40 | A: **Crew Replay**. This time A walks to the Comms Mast, aligns the dish and asks for the earlier docking. Shift changes | "Same ship, same eight packs. A different first move." |
| 2:40 to 3:00 | Comparison | "First run kept. The replay changed at the Comms Mast and cost twenty fuel. One decision, two outcomes, and the log says why." |
