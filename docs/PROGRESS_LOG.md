# Progress log and test record

14 November 2026. Windows 11, Node 24.15, Chromium-based in-app browser, Intel UHD Graphics 620.

## How the browser checks were run

The in-app Browser pane was **hidden** for the whole session, so the page's animation loop was throttled by the browser. To still exercise the real build, each check:

1. sent ordinary `keydown` / `keyup` events (or pointer events, or real Tab / Enter / arrow key presses) to the page, and
2. stepped rendered frames at exactly 1/60 s through the test hook in `src/three/GameCanvas.tsx`.

Every result below marked "browser" went through the real input layer, the real scene code and the real store. What this method does **not** show is how the game feels at full speed in a human's hands. That is listed under Unverified.

## Commands

| Command | Result |
| --- | --- |
| `npm install` | OK. react 19.3.1, three 0.187.0, @react-three/fiber 9.8.2, zustand 5.1.0, vite 8.3.8, typescript 7.0.2, vitest 5.1.0 |
| `npx tsc --noEmit` | 0 errors |
| `npm test` | 5 files, **113 passed**, 0 failed |
| `npm run build` | OK. `dist/` 1.37 MB JS (384 kB gzip), 18 kB CSS, 65 modules |
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
| Muted play | Pass. Audio is off by default. Every alert has text and a caption |
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
