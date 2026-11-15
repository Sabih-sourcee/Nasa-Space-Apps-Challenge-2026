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

## Stage 14: camera views, journeys and stage separation (15 November 2026)

Asked for: a continuous, more realistic expedition, with different views on the V key. Seven reference images were supplied; `REFERENCE_MAP.md` records what each one maps to and what is still not built.

- **Camera views (V, or the view button in the HUD).** Views never change the rules, only the camera.
  - Walking (Earth, Moon, Mars, both ships, Crew Ship): Follow, Close, Above, Helmet. In the helmet view A and D turn, W and S walk, and a visor rim frames the picture.
  - Landing (Moon, Mars): Chase, Side, Above, Window.
  - Docking: Docking camera, Outside (shows the orbiter, the station and the gap).
  - Launch: Cockpit, Outside.
- **Launch stack and separation.** The stack is now built from parts: a core stage, two boosters and the orbiter. `src/sim/launchStack.ts` decides from the flight's own altitude when the boosters (45 km) and the core stage (180 km) leave, how far the vehicle has leaned over, and which engines are lit. The outside view shows it, Mission Control calls each separation, and the HUD lists what is still flying. Heights are rounded and the climb is compressed.
- **Journey sequences.** Short in-engine films before the briefing, the first time a mission is flown: Walk to the pad (into F01), Orbit to the station (S01), To the Moon (L02), To Mars (M04). 17 to 19 seconds each, three captioned shots. Skip (Esc or the button), Next shot, captions follow the captions setting, and reduced motion shows one still per shot. A journey changes no game state, so skipping, finishing and reloading all lead to the same mission start. Any journey can be watched again from the Mission Log.
- **Checked in the browser:** Walk to the pad played through two shots and Esc skipped it to the briefing; To Mars ran to its end and handed over to the briefing; To the Moon and Orbit to the station were seen on two shots each. The outside launch view showed liftoff, the lean-over, the boosters leaving and the radio call. Helmet and Above views on Mars, two landing views on the Moon, and the outside docking view were seen.
- **Unverified:** the journeys at real speed (the test pane runs slowly), reduced motion, journey replay from the Mission Log, the core-stage separation on screen, the Close view, the view button in Crew Ship, walking in the helmet view with a real keyboard for more than a few steps, touch screens, and frame rate.
- **Not built from the brief:** docking in phases with soft capture, hard dock and seal checks; touchdown dust, slope checks and a ladder to EVA; new rock formations; a boarding shot inside the cockpit; outcomes carried into journey lines; a measured performance target.
- `npm test`: 241 passed.

## Stage 15: docking in steps (15 November 2026)

Docking (S01, and the docking at the end of F03) used to end the moment the craft reached the port inside the limits. It now runs as a continuous sequence, in `src/sim/flight.ts`:

| Step | What happens | Who does it |
| --- | --- | --- |
| Approach (40 to 15 m) | Fly toward the port | Player |
| Alignment (15 to 5 m) | Put the cross under the crosshair | Player |
| Final approach (under 5 m) | Stay centred, arrive slowly | Player |
| Soft capture (2.5 s) | Only if the rings meet inside the alignment and closing-speed limits. Latches catch, the ring pulls the ports into line | Mechanism |
| Hard dock (3 s) | The ring pulls in the last 30 cm and the hooks close | Mechanism |
| Connection checks | Press E to fill the tunnel and run the leak check. The hatch stays shut until the tunnel holds cabin pressure, 101 kPa. Press E to open it | Player |
| Docked | Hatch open, on to the next task | |

- Range, offsets and speeds are measured from the orbiter's docking ring to the station's port, not between the vehicles' centres.
- A fast or crooked arrival is never captured: it is called off as before, with a retry from 25 metres. Braking (X) still backs the craft away.
- After contact the camera moves beside the two rings so the join can be seen, in either view. With reduced motion it cuts there. A capture ring with three latches was added to the orbiter.
- E during soft capture or hard dock skips ahead. A unit test checks that skipping, early or late, leaves exactly the state that watching does.
- The contact speed and offset are kept and reported in the S01 and F03 debriefs.
- Simplified, and said so in the HUD and here: roll is held for the pilot, the leak check is one button and a few seconds, and real hard docks take many minutes.
- Checked in the browser (S01, Judge Mode): contact at 0.20 m/s and 0.40 m off centre was captured, the side-on view showed the rings joined, E during pressurising did not open the hatch, the check passed at 101 kPa, E opened the hatch, and the mission moved on to the cargo task with the contact figures saved.
- Unverified in the browser: flying the whole approach by hand, an aborted approach and its retry under the new rules, the skip key, reduced motion, touch buttons, and the F03 docking.
- `npm test`: 247 passed.

## Stage 16: a film before or after every mission, zoom, station detail, quieter HUD (15 November 2026)

Asked for: realistic, detailed animation before or after every level, to suit what is happening; plus a level-by-level plan (Earth training and launch, spacecraft control, docking), a less cartoonish interface and a camera that is not zoomed in too far.

**Films.** Twelve now, built from the missions' own models. Each is skippable (Esc), captioned, steps shot by shot, shows stills with reduced motion, changes no game state, and can be watched again from the Mission Log. A closing film plays over the results screen the first time a mission is completed; finishing it or skipping it carries on exactly where Continue was going.

| Mission | Before | After |
| --- | --- | --- |
| E02 Earth training | The launch site: the pad, the yard, the cadet | (Walk to the pad plays before F01) |
| F01 Launch | Walk to the pad | Earth departure: the core stage lets go, thrusters steady the orbiter |
| F03 Keep the Ship Flying | Power fault: a warning light (short) | Docking capture is part of the mission |
| S01 Docking | Orbit to the station | Aboard the station: the two vehicles as one |
| S04 Module alert | Pressure alarm: air escaping from a module (short) | |
| L02 Moon | To the Moon | On the Moon: dust falling straight back, the habitat, Earth in the sky |
| L03 The Last Battery | Night is coming: the Sun goes down on the outpost (short) | |
| M04 Mars | To Mars | On Mars: dust hanging in thin air, the outpost, Earth as a dot |

**Camera zoom.** Mouse wheel over the 3D view, or the minus and plus keys, moves every outside camera between 0.55 and 1.9 times its normal distance. The HUD is drawn by the page, so it does not change size.

**Station.** Radiators, a communications dish, antennas, a row of laboratory windows, handrail rings and a spare docking adapter were added to the station model.

**HUD.** Inside missions the HUD now uses dark neutral panels, thin lines, square corners and fewer colours. Menus keep the bolder game style.

**Checked in the browser:** the launch site, Earth departure (two shots), pressure alarm, On the Moon (two shots), On Mars, and the lunar sunset films rendered; zoom moved the Mars walking camera back and stopped at its limits; the new HUD was seen on Mars.

**Unverified:** the films at real speed, Power fault and Aboard the station on screen, the closing film actually starting from the results screen's Continue button, reduced motion, the Mission Log buttons for the new films, the leak puff, and frame rate.

**Not built from this brief:**
- Level 1 as written: collecting food, tools and a battery to a loading rack, latching the rack, and a boarding step. E02 is still the suit check and the equipment carry across the gravity lanes.
- Level 2 as written: a free-flight spacecraft control mission with rotation, a navigation target and a rendezvous checkpoint. The game goes from the launch straight to docking.
- Thruster puffs during play, a detailed spacecraft hull, a station interior arrival film, and instruments rebuilt around target-relative speed.
- A full playthrough test and a performance measurement.

`npm test`: 265 passed.

## Stage 17: Level 1, Earth training with supplies, cargo and boarding (15 November 2026)

E02 was a suit check and one carry through the gravity lanes. It is now five steps with four checkpoints, so a reload does not send the player back to the start.

| Step | What the player does | What they see | Checkpoint |
| --- | --- | --- | --- |
| Supply run | Takes the food crate, the tool case and the spare battery from the supply shelf, one at a time, and loads each into the rack | The item in the astronaut's hands, then in its own slot in the rack. Reyes says why the crew takes it | Mission start |
| Suit check | Unchanged: inspect each item, find and fix the fault | Gauges, chest light, clearance | Supplies loaded |
| Gravity drill | Unchanged: carry the pouch through the Earth, Mars and Moon lanes, jumping the bars | The body now dips on landing as the knees take the weight. After the first Earth jump Reyes gives the airtime as the baseline to remember for the Moon | Suit cleared |
| Secure cargo | At the rack, now on its cart by the pad road: close the door, then fasten two restraints | The door swings shut, each strap appears with a green latch, and the cargo checklist ticks | Drill complete |
| Board | Walks to the open door of the crew transport | Mission complete. The walk to the pad film and the launch follow | |

- Rules are in `src/sim/cargo.ts`: one item in the hands at a time, nothing loads into a closed rack, the rack cannot be closed until it is full, and securing goes door, restraint, restraint.
- The HUD checklist keeps ticked lines visible (a new `keep` flag on HUD readouts).
- Old saves with a checkpoint at the suit check or the gravity lanes still load: those start with the rack already full.
- Honest limits: boarding ends the mission and goes to the results screen, then the walk to the pad film and the launch briefing, not straight into the cockpit. The rack moves to the pad road between the drill and the cargo step, explained by a radio line, not shown. The star rating still depends only on the suit check.
- Checked in the browser (Judge Mode): all three items picked up and loaded with the right prompts, the phase moved to the suit check with the checkpoint saved; from the last checkpoint the door and both restraints locked with the checklist fully ticked, boarding completed the mission with all six objectives and three stars.
- Unverified: walking the whole mission by hand (the astronaut was placed next to each station), the landing dip on screen, the baseline radio line, touch, and the suit and drill steps after these changes beyond the unit tests.
- `npm test`: 272 passed.

## Stage 18: films every time, the launch film, Level 2 in flight, more detail (15 November 2026)

Reported: no animation was showing in any level. Cause: a film only played the first time a mission was started or completed, and the campaign save already had E02, F01 and S01 completed, so none of them played. Resuming from a checkpoint with Continue never plays one either. Fix: the film before a mission now plays every time the mission is started from its mission card, and the film after it plays every time it is completed. Both can be skipped with Esc. Continue and Retry still go straight to play.

- **Order of the first three levels.** E02 training, then Walk to the pad, then the new **Liftoff** film (countdown with vapour venting, ignition and smoke at the pad, liftoff seen from a ground camera, the climb from a camera flying alongside with the sky darkening, and the two boosters letting go at 45 km), then F01.
- **F01 now begins in flight**, 45 km up, just after the boosters have gone (`makeAscentAloft`). The pad checklist became a climb checklist (boosters away, core engines, guidance, manual control) and the countdown became the autopilot handing over. All six gates are still ahead. A reset returns to booster separation.
- **After F01** the Earth departure film ends with the station coming into view ahead.
- **Cockpit camera** sits further back and higher, so the windows and the whole panel are in view. Zoom moves it along the cabin.
- **Detail.** Orbiter: panel seams, a payload bay line, side windows, thruster pods with nozzles, three engine bells, an antenna. Core stage: tank ribs and an outside fuel line. Station: module seams, hatch rings, a robotic arm, navigation lights. Space: a Sun disc with a glow where the light comes from, and more stars.
- **Interface.** The checklist panel, the readout banner and the radio bubble inside missions now match the restrained HUD.
- Checked in the browser: all four shots of the Liftoff film, F01 starting at 45 km with the climb checklist, the new cockpit view, and the detailed orbiter in the outside docking view.
- Unverified: the films starting from the mission card and from the results screen in the campaign (they were opened directly), a full flight of F01 by hand from the new start, the Sun disc on screen, and frame rate.
- Not built: thruster puffs while flying, a rebuilt cockpit model, a redesigned station, free rotation of the spacecraft. The boosters are solid rocket motors, which is what "fuel motors" was taken to mean.
- `npm test`: 277 passed.

## Stage 19: clear films, crews without the dev server, new title screen (15 November 2026)

- **Films.** The caption box, the buttons and the note were covering the bottom of the picture. They are gone: the picture is clear, with three small buttons in the top corner (CC, next shot, Skip) and thin progress marks in the lower bar. Captions are off until CC or the C key turns them on. With speech switched on in Settings the narration is read aloud.
- **"The mission service is not running."** That appeared whenever the game was opened without `npm run dev`, because only the dev server had the crew service. Fixed three ways: the service now also runs in the built game (`npm start`, new, serves it to the network); with no server at all the host's own window holds the crew and other windows on the same computer can join; and the message is gone, replaced by a note in the lobby when a crew is same-computer only. The crew rules moved to `src/sim/crewHub.ts` so the server and the browser run the same code, with 6 unit tests.
- **Title screen.** Restyled after the supplied reference: a dark glass Continue button with a pale gold outline, four dark tiles (Missions, Gravity Lab, Settings, Science), one wide blue Crew Ship button, a dark difficulty bar with an outlined choice, round top buttons, and vapour rolling off the launch pad.
- Checked in the browser: the title screen, the Liftoff film with a clear picture, a crew hosted through the dev server, and with the server blocked two windows hosting and joining one crew, a wrong code refused with a clear message. The built game's server answered a host request on port 4173.
- Unverified: two separate computers through `npm start`, a real static web host, the CC and speech options on screen.
- Honest limit: the reference image is a photo-realistic render. The title screen's layout and panels now follow it; the rocket, pad and astronaut are still the game's own simple models.
- `npm test`: 283 passed.

## Stage 20: real 3D models and terrain from the dossier branch (15 November 2026)

Asked for: the 3D model functions, the model replacements and the landing terrain from `cursor/dossier-ui-release-a7a9`, without any of its theme changes.

- **Taken** (six commits, cherry-picked in order): Moon and Mars ground from real NASA surface imagery; the Apollo Lunar Module and Perseverance models with the Draco decoder; six more NASA models (shuttle stack, Mobile Launcher, ISS, Space Exploration Vehicle, Habitat Demonstration Unit) and five Poly Haven boulders; those models wired into the pad, launch, docking and surface scenes; the Petavius crater and Olympus Mons landing terrain; the InSight lander at the Mars landing site.
- **Not taken** (three commits): the mission-dossier restyle, the beginner readability pass and the colour change. No file from them was brought over: `styles.css`, `DocHeader.tsx`, `art.tsx`, `main.tsx`, the two extra font packages and the interface parts of `App.tsx` are as they were on this branch.
- **Credits.** The branch's four credit commits were written on top of its theme text and would not apply, so the same credits for the models, ground imagery and terrain scans were written into `SCIENCE_AND_CREDITS.md`, the README and the in-game credits by hand, leaving out its font and artwork lines.
- **Conflicts resolved** in three files where this branch had also changed: the pad (the launch film still leaves the rocket off the pad), and the imports of the launch and docking scenes.
- **Made consistent.** The docking mission and the films now share one station component, so both show the real ISS with the docking port the simulation aims at. The launch film uses the real Mobile Launcher.
- Each model replaces the code-drawn one only after it has loaded, and the code-drawn one stays if a file cannot be read.
- Checked in the browser: the real shuttle stack and Mobile Launcher on the title screen, the Apollo Lunar Module, habitat and real ground on the Moon, the Perseverance rover and real ground on Mars, and every model file answering with status 200 and no load warnings.
- Unverified: the ISS in the docking view (the pause menu was open when it was captured), the Space Exploration Vehicle, InSight and the two landing terrains on screen, and frame rate with the models loaded (Perseverance alone is 4.9 MB).
- Known mismatch: the pad now shows the real Space Shuttle, with the orbiter on the side of an orange tank. The Liftoff film and the outside launch view still fly the code-drawn stack, with the orbiter on top, because its boosters and core stage are separate parts that can let go. The two do not look the same.
- `npm test`: 283 passed.
