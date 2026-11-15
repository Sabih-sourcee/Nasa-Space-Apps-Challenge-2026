# Progress log and test record

14 November 2026, with Stage 9 added on 15 November 2026. Windows 11, Node 24.15, Chromium-based in-app browser, Intel UHD Graphics 620.

## How the browser checks were run

The in-app Browser pane was **hidden** for the whole session, so the page's animation loop was throttled by the browser. To still exercise the real build, each check:

1. sent ordinary `keydown` / `keyup` events (or pointer events, or real Tab / Enter / arrow key presses) to the page, and
2. stepped rendered frames at exactly 1/60 s through the test hook in `src/three/GameCanvas.tsx`.

Every result below marked "browser" went through the real input layer, the real scene code and the real store. What this method does **not** show is how the game feels at full speed in a human's hands. That is listed under Unverified.

## Commands

| Command | Result |
| --- | --- |
| `npm install` | OK. react 19.3.1, three 0.187.0, @react-three/fiber 9.8.2, zustand 5.1.0, vite 8.3.8, typescript 7.0.2, vitest 5.1.0, @fontsource-variable/exo-2 5.3.0 |
| `npx tsc --noEmit` | 0 errors |
| `npm test` | 8 files, **215 passed**, 0 failed (15 November, after Stage 11) |
| `npm run build` | OK. `dist/` 1.51 MB JS (425 kB gzip), 54 kB CSS, five font files (126 kB, of which the browser loads the 41 kB Latin one) |
| `npm run dev` | Serves on http://localhost:5173 |

## Stage results

### Stage 0. Browser foundation: Pass

- Home shows a live 3D launch site with the astronaut. Atlas shows five worlds and 20 missions with text status labels.
- Guest profile is created on first load. Astronaut walks with keys.

### Stage 1. Earth Academy (E02): Pass

- Browser: walked to the suit station, opened the check. Clearance button disabled until every item was judged.
- Marking the 3.1 psi reading "Looks good" was rejected and clearance stayed blocked. A false alarm on the helmet ring was rejected. A wrong fix (open the visor) was explained and refused. The right fix raised the gauge to 4.3 psi and enabled clearance.
- Checkpoint saved as `course`. "Restart from checkpoint" returned to the cleared state with the pouch back on the table.
- Jump airtimes recorded in play: Earth lane 0.58 s, Mars lane 1.55 s, Moon lane 2.75 s. The Moon figure was cut short because the lane ended mid-jump. **Fixed:** the trainer now holds its gravity until landing. Unit test and the lunar EVA both give 3.57 s.

### Stage 2. Shuttle Flight (F01): Pass

- Browser: four checklist confirmations lit the panel lamps, the countdown ran, checkpoint saved as `ascent`.
- Holding Space raised throttle to 100% and the cockpit displays followed (speed 0.93 km/s, altitude 56 km at 6 s).
- Failure path: thrust only, no steering. GUIDANCE DEVIATION warning at t = 15.9 s, training reset for leaving the corridor at 25 s, retry returned to liftoff.
- Success path: steering and throttle by keys. Orbit at 7.66 km/s, 6 of 6 gates, 44% fuel, 48 s. Flight Ready milestone awarded.

### Stage 3. Orbital Station (S01): Pass

- Browser, bad approach: held Space all the way. CLOSING TOO FAST warning at 14.9 m, abort for speed at 1.60 m/s, retry held at 25 m as attempt 2.
- Good approach: docked 0.22 m off centre.
- Inside: drift speed stayed 1.00 m/s for 5 s with no input. Steering while drifting did not change velocity. DRIFT WARNING after 8.4 s of free drift. Tether (R) returned to rail A.
- Five rail hops, cargo taken at rail B, stowed at the storage rail. Debrief listed 6 push-offs, 5 grabs, 1 tether recovery.
- **Fixed during this stage:** a held Space key from docking carried into the cargo phase and caused an unwanted push. Key state is now cleared on every phase change.

### Stage 4. Moon landing and EVA (L02): Pass

- Browser, failure: no engine. TOO FAST warning at 69 m, landing called off at 23.1 m/s against a 2.6 m/s limit, retry to the approach checkpoint.
- Success: touchdown at 1.45 m/s inside the zone, 78% fuel left.
- EVA: pouch taken, one jump measured at 3.57 s, solar panel unfolded, airlock entered with 90% suit oxygen. The objective text advanced only after each physical action.
- **Fixed during this stage:** the landing zone started behind the camera. Both landers now start with the zone ahead.

### Stage 5. Lunar outpost and replay (L02): Pass

- Browser, Middle: 6 units in, air support 3. "Run the grow lights" showed Battery after 1. "Skip the lights" showed Battery after 3.
- After the lights, the shadow and the solar alert both appeared with their source labels. At the shelter, upgraded fans were shown as unaffordable (needs 5, have 3). Basic shelter dropped Air to 80%.
- Harvest check reported HARVEST READY. Lunar Crew milestone awarded.
- **Replay:** checkpoint 1 restored Air 100, Battery 0, Crops 1 with no events fired. Changing only the grow-light choice gave "Battery before Shadow and solar alert: 1 unit vs 3 units, up 2", final crops down 2, harvest delayed. Later choices were pre-selected from the first run. Campaign completion count was not changed by the replay.
- Junior (browser): exactly two meters, Air and Battery, with a hint line and one guided choice.
- Critical path (browser): "Keep working" dropped crew protection to 30%, the card named the decision, and recovery restored Battery 1 at the solar alert checkpoint.
- Advanced (browser): asking Earth cost 1 unit in the sunny shift. The reply arrived after the shelter decision and unlocked the 2-unit air schedule in the last shift. Finished with Air 90%, Science 1, harvest delayed.

### Stage 6. Mars landing and outpost (M04): Pass

- Browser, failure: parachute opened but never released. Landing called off with the thin-air explanation.
- Success: parachute, release, engine. Touchdown 1.32 m/s in the primary zone.
- EVA: wheel cleared, deck brushed, pouch taken. Storm trigger raised fog density from 0.006 to 0.051, cut sunlight from 2.7 to 0.76 and dropped habitat solar from 100% to 32%. Mars jump 1.55 s.
- Outpost, Advanced: brush, heater and a question to Earth used all 6 units. The reply arrived after the storm peak decision and added 1 unit to the last shift. Mars Expedition milestone awarded.
- **Fixed during this stage:** the decision panel could open on an unaffordable default plan. It now opens on the nearest affordable one.

### Stage 8. Station Module Alert (S04): Pass

Added after the first release to close FR-04. An extra station mission that unlocks after S01 and does not block the Moon.

- Rules in `src/sim/station.ts`, 27 tests in `tests/station.test.ts` (gauges per tier, wrong reports, leak drain, both plans per tier, critical outcome, arm kinematics and joint limits).
- Browser, Middle: the leak pauses while a panel is open (reserve unchanged over 2 s). Gauges read Lab 100.6 (was 101.3), Crew 100.2 steady, Storage 101.3 steady. Reporting the crew module (the lowest reading) was refused with the reason and cost 6% (95.5 to 89.5). Reporting the lab saved the `respond` checkpoint.
- Refresh and resume from that checkpoint restored the reserve (89.5), the wrong-report count and the plan choice.
- Rescue plan: at the arm station the gripper refused to close 2.38 m from the canister, gripped at 0.04 m, refused to release away from the port, released at the port. Sealing the hatch stopped the drain. Debrief: 87% reserve, experiment saved.
- Advanced: the storage gauge showed 97.0 kPa with a failed self-test. Reporting it was refused as a frozen sensor and cost 8%. The seal-now plan finished at 88% with the experiment lost, and the arm station refused to start.
- Critical path: ignoring the leak on Advanced reached 40% after 240 s. The reset card appeared, the leak froze, and the retry returned to a fresh checkpoint.
- Junior: the gauge names its trend (FALLING), the arm is steered by its gripper, and the Space key also works the gripper. Finished at 97% with the experiment saved.
- **Fixed during this stage:** the transfer port sat just outside the shoulder joint's limit, so the arm could only get within 0.16 m. The port moved inside the arm's range, and a test now checks both targets against the joint limits.

### Stage 11. Crew Ship (15 November): partly built

A shared ship for 2 to 6 cadets, with solo training. Engine, mission service, lobby, 3D ship, task panels, debrief and Crew Replay are in. WorkAdventure was inspected and not run, because the Docker daemon was off. Only Last Meals on Board was played in the browser; the other four crew emergencies and the quick games are covered by unit tests only. The request to make the game look more realistic was not started. Full record, including what is not built: [CREW_SHIP.md](CREW_SHIP.md). `npm test`: 8 files, **215 passed**.

### Stage 10. Commander story and two ship missions (15 November): Pass, with limits below

Added on top of everything already built. Nothing was removed. Two planned catalogue entries became playable: F03 (was "Emergency Protocol") and L03 (was "Rover Traverse").

- **Commander Reyes** (`src/sim/story.ts`, `src/ui/Commander.tsx`): a three-panel comic briefing for all eight playable missions, with different lines for Junior, Middle and Advanced. The scene is not mounted until Take Control, so nothing runs behind the briefing. Mission Log on the mission map replays any unlocked briefing. Radio calls and the results screen are now signed by Reyes.
- **F03 Keep the Ship Flying** (`src/sim/ship.ts`, `src/missions/ShipMission.tsx`): four rooms, nine physical tasks, then docking with the existing docking scene. With navigation restored the docking uses the easier limits; without it, the tier's own limits.
- **L03 The Last Battery** (`src/sim/lastBattery.ts`, `src/missions/LastBatteryMission.tsx`): one battery, two sockets. The clock moves only when the player acts, so a replay is exactly repeatable.
- **Carry-over**: F03 saves `batterySecured` in its mission record. L03 reads it for the briefing, the starting place of the battery and the starting clock.
- 43 new tests in `tests/story.test.ts`. `npm test`: 7 files, **180 passed**.

Browser checks, Judge Mode, Middle, the player's saves backed up and restored:

| Check | Result |
| --- | --- |
| Briefing | Pass. Real Enter presses turned the three panels and Take Control started the mission beside the failed line. Skip started it at once. With the pane narrow, one panel shows at a time |
| F03, navigation first | Pass. Inspect, take, fit to navigation, read gauge, backup loop (reserve 100 to 75), grab, rack, latch. The cockpit refused docking until the air was steady. Docked on the first approach, three stars, record saved with `batterySecured: true` |
| L03 with the battery latched | Pass. Briefing said it was at the near rack. Shelter first: 4 units left, crops stage 1, readiness 100%, three stars |
| L03 replay | Pass. Grow rack first from the same checkpoint: crops stage 2, 1 unit left, readiness 100%. Comparison rows matched. The first run's route showed as dots on the floor |
| L03 with the battery not latched | Pass. Briefing said it was in the cargo crate, the mission started there, the clock started at 2, and grow-rack-first ended at 85% readiness |
| Mission Log | Pass. Listed the eight missions, replayed a briefing and returned to the log |
| Existing saves | Pass. A campaign save made before this stage (three missions done, checkpoint in the L02 habitat) loaded unchanged and resumed without a briefing |

Not checked in this stage:

- F03 with the connector on **ventilation**, and Junior and Advanced on both missions, were covered by unit tests only, not played in the browser.
- The late-transfer path (low-flow mode) and both shift-stopped cards in L03 were covered by unit tests only.
- The optional radio voiceover was not listened to.
- Docking in F03 was flown by a scripted controller, not by hand.
- A refresh in the middle of F03 or L03 was not tried. By design both restart from their last checkpoint (Ship ready, Battery in hand), not from the exact task.

### Stage 9. Game interface redesign (15 November): Pass, with limits below

The screens read like documents and forms. They were rebuilt as a game interface. Mission rules did not change.

What changed:

- **One visual language** in `src/styles.css`: gold for the main action and rewards, blue for secondary actions, cyan for information, green, amber and red for status. Chunky buttons with a pressed state, rounded panels, a bundled game font (Exo 2), and icons and planet art drawn in code (`src/ui/icons.tsx`, `src/ui/art.tsx`).
- **Title screen**: one Play or Continue button, three tiles, difficulty as three buttons, call sign with rank and stars.
- **Mission map** in place of the atlas table: five worlds on a route, mission cards with status in words and stars. "Show all 20 missions" adds the 14 planned ones.
- **Mission card** in place of the briefing page: role, goal, steps, keys as keycaps, the three-star goal, one Start button.
- **HUD**: objective banner with step lights, a "Checkpoint saved" note, alerts stacked under the objective (they can no longer cover it), icon gauges, the key to press as a keycap, tips as a Mission Control message, a list of the keys that work right now, a title card when a mission or checkpoint starts.
- **Decisions**: a power board where every unit is one light, and choices as cards with their meter effects and cost. The board stays in view while the choices scroll, and so does the confirm button.
- **Results**: stars, badge, what happened, a space fact, the next mission.
- **Star ratings and ranks**: `src/sim/score.ts`, 24 tests in `tests/score.test.ts`. The tests also prove three stars can be reached on every tier: the steered climb passes every gate, and a search of every outpost plan finds one that ends with the air at 75% or more.
- **Sound**: effects are now on by default and have their own switch, separate from spoken alerts (still off by default). Old saves are migrated: effects on, speech kept only if the old single switch was on.

Browser checks, 1024 x 768, Judge Mode, the player's own saves backed up first and restored after:

| Check | Result |
| --- | --- |
| E02 start to finish | Pass. Suit check as four gauge cards, fault reported and fixed, checkpoint note shown, lanes jumped, three stars with no misjudged reading. Rank went from Space Cadet to Flight Trainee |
| F01 checklist, countdown, climb | Pass. Checklist panel and countdown did not cover the objective or the cockpit screens. Guidance alert appeared under the objective. Flying with no steering ended in the try-again card, and its button returned to the liftoff checkpoint |
| Pause menu | Pass. Esc opened it with focus on Resume |
| L02 outpost, Middle, three shifts | Pass. Board showed 6 lights with 5 used, then 3 of 3. The powered shelter was dimmed with its reason when only 1 unit was banked. Three stars (air 90%) |
| Mission Replay | Pass. Checkpoint 1, skip the lights: board showed 3 of 6 used, comparison showed 1 unit against 3 units, the key table row matched |
| S04, Middle | Pass. Three gauges read, lab reported, seal-now plan, three stars (0 wrong reports, 93% reserve) |
| Keyboard only, reduced motion on | Pass. Real E, ArrowDown, ArrowUp, Tab and Enter presses opened the panel, changed the choice (board updated), locked the plan and closed the report |
| Reduced motion | Pass. With the setting on, interface animations and transitions are off and content is fully visible |
| Small screens | Pass. 375 x 812: title screen and mission map fit with no sideways scrolling. 768 x 1024: mission HUD with the on-screen buttons. Pointer events on Jump, Up and Left reached the input layer, and holding Up walked the astronaut 1 m. Not tried on a physical touchscreen |
| Font | Pass. Only the Latin font file was requested |

Fixed during this stage:

- The choice cards first collapsed to one word per line (a flex layout bug). They now use a grid.
- The decision panel opened scrolled to its bottom, hiding the power board. Focus now starts on the first choice.
- The countdown covered the cockpit's own displays. It moved up into the windshield area.
- A mouse click on a HUD button kept keyboard focus, so Space pressed that button again instead of jumping. HUD buttons now give focus back after a pointer press.
- In S04 the console opened with focus on a Report button, so a stray key press could file a report. Focus now starts on Step back until all three gauges are read.

Not checked in this stage:

- S01, M04 and both landings were not replayed after the redesign. Their scenes are unchanged and use the same HUD component.
- Star pop and screen entrance animations were only seen frozen mid-way, because the pane was hidden. Their timing at full speed is unverified.
- Sound effects were not listened to.
- The interface was not shown to a child. Whether it reads as clearer is still a judgement.

### Stage 7. Campaign and release QA

| Check | Result |
| --- | --- |
| Five missions in sequence as one guest | Pass (browser, scripted input) |
| Refresh mid-outpost, resume | Pass. Same profile, tier (Junior kept although the setting had changed), phase, turn, resources, flags and alert |
| Judge Mode | Pass. Separate profile id and save slot. Campaign slot untouched. "Start at" jumps work |
| Corrupt checkpoint in both slots | Pass. Mission restarts from its beginning, completed missions and milestones kept, note shown |
| Keyboard only, reduced motion on | Pass. Tab, arrow keys and Enter drove a decision and its report using real key presses |
| On-screen controls | Pass with synthetic pointer events (move, jump, use). Not tried on a physical touchscreen |
| Reduced motion | Pass. Camera locks to its target, alert pulse and beacon flashing become steady |
| Muted play | Pass on 14 November, when audio was off by default. Since Stage 9, sound effects are on by default and the speaker button mutes them. Every alert has text and a caption |
| Reset Progress | Pass. Confirmation required. Only the active slot is erased |
| Source links | 9 of 11 pages fetched and matched. See `SCIENCE_AND_CREDITS.md` |

## Unverified, with manual steps

1. **Real-time feel and pacing.** Show the Browser pane, run `npm run dev`, play E02 to M04 by hand on Junior. Confirm fuel, tolerances and walking distances suit a child.
2. **Frame rate (NFR-02).** One indicative stepped-frame reading on this machine's integrated GPU at 1024 x 768 in the lunar EVA scene: about 20 ms per frame on Low, about 38 ms on High. Other scenes could not be timed reliably with the pane hidden. Manual: Settings, Low graphics preset, open each mission, watch the browser's FPS meter for 60 seconds, expect 30 or more.
3. **Firefox.** Not run. Manual: repeat step 1 in current Firefox.
4. **WebGL failure message (NFR-03).** The fallback exists (`CompatMessage`), but was not forced. Manual: start Chrome with `--disable-3d-apis`, load the page, expect the "3D graphics are not available" panel.
5. **Physical touchscreen.** Manual: open on a tablet, complete E02 with the on-screen buttons.
6. **DONKI alert record.** The NASA host refused the connection from this machine. Manual: open the link in `SCIENCE_AND_CREDITS.md` and confirm the identifier, type and issue time.

## Known limits

- Realism is procedural: simple shapes with PBR materials and generated textures. It reads as a clean flight-simulator look, not as the photoreal reference renders.
- Station movement and docking are simplified to a plane.
- The other crew members are implied by text and lights. Only the player's astronaut is modelled.
- 14 campaign missions are listed as Planned and are not playable.
- The robotic arm is a flat two-joint model, and station gauge readings are illustrative. The NASA life support page confirms that the system controls cabin pressure, and gives no numbers.

## Stage 12: mouse walking and planet surfaces (15 November 2026)

- **Mouse and touch walking.** In every walking scene (Earth, Moon, Mars, the F03 ship, L03 and Crew Ship) a click or tap on the ground walks the astronaut there, and holding and dragging keeps steering. A click on a station walks to it and uses it. Any movement key cancels the target. Keys and on-screen buttons work as before. Checked in the browser on the Crew Ship and on Mars with scripted pointer events. A real mouse, a real touch screen, and the click-to-use path: Unverified.
- **Title screen.** The view leans with the mouse and the astronaut turns toward it.
- **Earth.** Painted again with forest, desert, mountains, ice and a lighter sea shelf. The sea is shinier than the land, a cloud layer drifts on its own, and the rim of air glows at the edge. Seen from orbit, the globe is turned so the pole is not under the camera. The continents are invented.
- **Moon and Mars ground.** Small craters with bright rims, dune ripples and stones, with matching relief so they catch the sun. Each sample is mixed with a larger turned copy, which hides the repeat that showed as a grid from the lander.
- All of it is still drawn in code. No photographs or NASA image files were added. Frame rate with the larger textures: Unverified.

## Stage 13: real NASA maps and the Gravity Test Chamber (15 November 2026)

- **Real maps.** Four NASA globe maps were added to `public/textures/` (Earth, Moon, Mars, Jupiter; about 2 MB together; sources in `SCIENCE_AND_CREDITS.md`). The Earth globe in every scene now uses the real map, with the painted Earth showing until it loads. Clouds and the ground underfoot are still painted. Two files from the first download (a false-colour Earth and a Moon photograph) were not usable as maps and were removed.
- **Gravity Test Chamber** (Gravity Lab on the title screen). A glass tube with a cadet inside and five places to copy: Moon, Mars, Earth, Jupiter and the space station. Pick one by clicking its globe or its button, then jump (Space) or drop a ball from 2 m (E). The panel shows gravity, what a scale would read for a 32 kg cadet, jump height, fall time and air pressure, and a card says what happens to the body there and what you would need to survive. Tests are listed side by side to compare. Rules are in `src/sim/gravityLab.ts` with 13 unit tests.
- Checked in the browser: the chamber opened, Moon and station were picked, a Moon jump measured about 2.1 m in 3.2 s and the ball 1.57 s. Clicking a globe with a real mouse, the other three worlds on screen, and narrow or touch screens: Unverified.
- Science limits: no real chamber can switch gravity. Jupiter has no ground, so the tube only copies its pull. The body notes for the Moon, Mars and Jupiter are reasoning from the lower or higher pull, not measured crew data; the station figures are NASA's.
- `npm test`: 228 passed.
