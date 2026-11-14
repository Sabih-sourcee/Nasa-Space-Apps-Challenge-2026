# Three-minute judge demo

Goal: show a player doing astronaut work, making an emergency decision, and replaying it to get a different outcome.

## Before the judges arrive

1. `npm run dev`, open http://localhost:5173 in Chrome, full screen.
2. Settings: difficulty **Middle**. Reset Progress if a previous run is showing.
3. Tick **Judge Mode** on the home screen.
4. Keep a second tab on the Mission Atlas in campaign mode as a fallback.

## Script

| Time | Do | Say |
| --- | --- | --- |
| 0:00 to 0:20 | Home screen, then Mission Atlas | "Beyond Earth is a browser game for 7 to 12 year olds. One trainee goes from Earth to orbit, a station, the Moon and Mars. Five missions are playable today. The other fifteen are the roadmap." |
| 0:20 to 0:45 | Open **F01 Liftoff to Orbit**, press **Start at: Ascent**. Hold Space, steer through two gates, let the guidance fault appear and steer back | "Every mission is a job. Here the player flies. The instruments are live. That warning is an authored guidance fault, and the fix is in the player's hands." |
| 0:45 to 1:10 | Pause, return to the atlas. Open **L02 Power Before Shadow**, press **Start at: Surface work**. Take the pouch, do one jump | "On the Moon the same jump lasts about six times longer. That number comes from NASA's planetary fact sheet." |
| 1:10 to 1:20 | Pause, atlas, **L02**, **Start at: Habitat operations** | "Now the challenge itself: running an outpost when power is short." |
| 1:20 to 1:50 | Walk to the power console, press E. Choose **Run the grow lights**. Commit. Read the report | "Six units of power arrive. Air needs three. Lights cost two. The cost is on screen before you commit. Then the Sun drops behind the crater rim, and a separate solar particle alert arrives. That alert is labelled with an archived NASA record." |
| 1:50 to 2:10 | Walk to the shelter, press E. Point at the greyed-out fans. Commit the basic plan. Finish the harvest check | "With one unit banked, the powered shelter is out of reach. The walls still protect the crew, and the air gets stuffy. The crops are on time." |
| 2:10 to 2:45 | Debrief, **Replay a Decision**, checkpoint 1. Choose **Skip the lights**. Commit through the same later choices | "Mission Replay puts the habitat back exactly as it was. Same air, same battery, same events. We change one choice." |
| 2:45 to 3:00 | Comparison table | "Battery before the shelter decision: one unit, then three. Crops two stages behind. One choice, two outcomes, and the child can say why. The rules are deterministic and tested, the science is sourced, and it all runs offline in a browser." |

## If something goes wrong

- A landing or flight fails: that is a feature. Read the reset card aloud and retry.
- 3D stutters: Pause, Settings, Low graphics preset.
- Short on time: skip the F01 segment and start at 0:45.
- Asked about robotics or station emergencies: open **S04 Module Alert** in Judge Mode, press **Start at: Isolate or rescue**, choose the rescue plan and drive the arm.

## What to have ready for questions

- `docs/SRS_MATRIX.md` for what passes and what is unverified.
- `docs/SCIENCE_AND_CREDITS.md` for sources, and which values are invented.
- `npm test` output: 113 passing simulation tests, including the replay case.
