# SRS matrix

14 November 2026, updated 15 November 2026 after the interface redesign (Stage 9 in `PROGRESS_LOG.md`). Status is **Pass**, **Fail** or **Unverified**. "Browser" means the running build was driven with real input events and stepped frames (see `PROGRESS_LOG.md`). "Unit" means `npm test`.

Stage 10 added Commander Reyes briefings and two story missions (F03, L03). The catalogue still lists 20 missions: eight playable, twelve planned.

The redesign changed how screens look and added star ratings. It did not change mission rules. After it, E02, S04 and the L02 outpost with a replay were played through again in the browser, and the F01 checklist, climb and reset card were driven. S01, M04 and both landings were not replayed after the redesign: their scenes are unchanged and they draw the same HUD.

## Acceptance tests

| ID | Status | Evidence |
| --- | --- | --- |
| AT-01 Campaign | **Pass** | Browser: one guest completed E02, F01, S01, L02, M04 in order with keyboard input, including the orbital flight, docking, both landings and a surface objective on the Moon and Mars. Hands-on play at real speed is Unverified |
| AT-02 Gravity | **Pass** | Unit: Moon airtime > Mars > Earth for the same jump, matching t = 2v/g. Browser: 0.58 s Earth, 1.55 s Mars, 3.57 s Moon. Pouch task repeats on Earth, station (drift), Moon and Mars |
| AT-03 Difficulty | **Pass** | Browser: Moon Junior shows two meters. Middle adds Crops and the grow-light trade-off. Advanced adds the question to Earth, optional science and a reply that arrives one decision later. All three finished successfully. Unit: every tier of L02 and M04 has a successful path and no dead ends |
| AT-04 Emergencies | **Pass** | Browser: guidance deviation, docking abort and drift warning, station pressure alert (S04), lunar solar alert, Mars dust storm. Each gave a labelled warning, a player action, a visible response and a recoverable outcome |
| AT-05 Replay | **Pass** | Unit and browser: identical actions give identical results. Changing only the crop-light choice gives 1 unit vs 3 units of reserve before the shelter choice |
| AT-06 Resume | **Pass** | Browser: refresh after an outpost checkpoint restored profile, tier, objective and resources. Judge Mode uses a separate slot |
| AT-07 Science and access | **Pass** | Browser: solar alert shows "Archived NASA record" with its identifier. Panels say energy units are invented game units. A decision turn was completed with real E, arrow, Tab and Enter presses with reduced motion on, and this was repeated on the redesigned panel |

## Functional requirements

| ID | Status | Notes |
| --- | --- | --- |
| FR-01 Persistent profile and unlocks | **Pass** | One guest id across five worlds. Next mission unlocks on completion (unit and browser) |
| FR-02 Movement | **Pass** | Walk, jump, carry, interact. Distinct Earth, Moon and Mars presets. Push, drift, grab and tether recovery |
| FR-03 Flight and landers | **Pass** | Checklist, steering, throttle and brake to orbit. Target-zone approach and safe-touchdown limits on both landers |
| FR-04 Station | **Pass** | S01: docking and cargo transfer, with an aborted approach and a missed-rail hazard. S04: module diagnostics (find the leak from gauge trends), a robotic arm task, and a pressure emergency whose outcome depends on the player's plan. Unit and browser. The arm is a flat two-joint model; S02 and S03 remain planned |
| FR-05 Linked outpost systems | **Pass** | Air, power, crops, shelter and queued messages share one energy budget. Costs shown before commit. Meters and room objects update after |
| FR-06 Mission definitions | **Pass** | `src/sim/missions.ts` and `outpostScenarios.ts` define entry, objectives, tiers, checkpoints, triggers, success and retry. Critical failure names the cause and recovers from a checkpoint |
| FR-07 Mission Replay | **Pass** | L03 adds a second replay: back to the moment the battery is picked up, with the same charge, cargo status and alert timing, then a side-by-side comparison (unit and browser). |
| FR-07 (outposts) | **Pass** | Restores checkpoint, flags, resources, event cursor and pending messages. Side-by-side comparison of air, battery, crops and protection |
| FR-08 Local saves and fallback | **Pass** | Unit and browser: corrupt or incompatible checkpoints fall back to the mission start and keep completed missions |
| FR-09 Access | **Pass** | Keyboard for everything, labelled on-screen buttons, reduced-motion option (also switches off every interface animation), sound effects and spoken alerts each with their own switch, captions, text plus an icon on every warning. Status is always written in words as well as colour. Physical touchscreen Unverified |
| FR-10 Provenance labels | **Pass** | Source, archived record, compressed time and game-unit labels at the point of use and in Science and Credits. The DONKI record itself is Unverified externally |

## Technical and release requirements

| ID | Status | Notes |
| --- | --- | --- |
| NFR-01 Stack and separation | **Pass** | React, TypeScript, Vite, React Three Fiber. `src/sim` imports no rendering code |
| NFR-02 Browsers and 30 FPS | **Unverified** | Chromium only, with the pane hidden. Firefox not run. No 60-second real-time FPS run. One indicative reading in `PROGRESS_LOG.md` |
| NFR-03 Bundled data, offline play, 3D failure message | **Pass / Unverified** | Pass: scenarios and sources are bundled and gameplay makes no network requests. Unverified: the WebGL failure message was not forced |
| NFR-04 Art, cameras, HUD, access tests | **Pass** | Realistic direction used in place of low-poly, as the build prompt directs. Fixed-direction cameras, labelled HUD. Reduced motion, focus order and keyboard completion were checked again on the redesigned screens. Muted play: sound effects are now on by default and one button mutes them; every alert still has text and a caption. A full muted playthrough was not repeated after the redesign |
| NFR-05 Privacy and reset | **Pass** | Local storage only, random guest id, no personal fields. Reset Progress asks for confirmation |
| NFR-06 Release package | **Pass** | Source build, test record, science and asset credits, demo route and three-minute script are in the repository |

## Summary

- Pass: AT-01 to AT-07, FR-01 to FR-10, NFR-01, NFR-04 to NFR-06.
- Fail: none.
- Unverified: NFR-02, and the WebGL failure message under NFR-03.
