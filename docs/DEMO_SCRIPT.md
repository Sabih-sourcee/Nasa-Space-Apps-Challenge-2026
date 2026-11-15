# Three-minute judge demo

Goal: show a player doing astronaut work, making an emergency decision, and replaying it to get a different outcome.

## Before the judges arrive

1. `npm run dev`, open http://localhost:5173 in Chrome, full screen.
2. Settings (gear button, top right): difficulty **Middle**. Reset Progress if a previous run is showing.
3. Switch on **Judge Mode** at the bottom of the title screen.
4. Keep a second tab on the mission map in campaign mode as a fallback.

## Script

| Time | Do | Say |
| --- | --- | --- |
| 0:00 to 0:20 | Title screen, then **Missions** | "Beyond Earth is a browser game for 7 to 12 year olds. One trainee goes from Earth to orbit, a station, the Moon and Mars. Eight missions are playable today, and every one is scored with stars. The other twelve are the roadmap." |
| 0:20 to 0:45 | Open **F01 Liftoff to Orbit**, press **Start at: Ascent**. Hold Space, steer through two gates, let the guidance fault appear and steer back | "Every mission is a job. Here the player flies. The instruments are live. That warning is an authored guidance fault, and the fix is in the player's hands." |
| 0:45 to 1:10 | Pause, **Mission map**. Open **L02 Power Before Shadow**, press **Start at: Surface work**. Take the pouch, do one jump | "On the Moon the same jump lasts about six times longer. That number comes from NASA's planetary fact sheet." |
| 1:10 to 1:20 | Pause, **Mission map**, **L02**, **Start at: Habitat operations** | "Now the challenge itself: running an outpost when power is short." |
| 1:20 to 1:50 | Walk to the power console, press E. Point at the six power lights. Choose **Run the grow lights**. Press **Lock in this plan**. Read the shift report | "Six units of power arrive. Air needs three. Lights cost two. Every light on the board is one unit, and the cost is on screen before you lock it in. Then the Sun drops behind the crater rim, and a separate solar particle alert arrives. That alert is labelled with an archived NASA record." |
| 1:50 to 2:10 | Walk to the shelter, press E. Point at the dimmed fans card. Lock in the basic plan. Finish the harvest check | "With one unit banked, the powered shelter is out of reach. The walls still protect the crew, and the air gets stuffy. The crops are on time." |
| 2:10 to 2:45 | Results screen, **Replay a Decision**, checkpoint 1. Choose **Skip the lights**. Lock in the same later choices | "Mission Replay puts the habitat back exactly as it was. Same air, same battery, same events. We change one choice." |
| 2:45 to 3:00 | Side-by-side comparison | "Battery going into the shelter decision: one unit, then three. Crops two stages behind. One choice, two outcomes, and the child can say why. The rules are deterministic and tested, the science is sourced, and it all runs offline in a browser." |

## Second route: the commander story (about three minutes)

Use this route when the judges ask about story, characters or carry-over between missions. Judge Mode on, difficulty **Middle**.

| Time | Do | Say |
| --- | --- | --- |
| 0:00 to 0:25 | Open **F03 Keep the Ship Flying**, **Start mission**. Turn the three panels with Enter, then **Take Control** | "Every mission opens with Commander Reyes: where we are, what changed, your assignment. It works with the sound off, and it can be skipped." |
| 0:25 to 1:00 | Inspect the failed line, take the spare connector, fit it to the **navigation** socket. Point at the cockpit lights coming on | "One spare connector, two dark systems. Whatever you fix, another room changes. Navigation is back, so the air has to run on the backup loop." |
| 1:00 to 1:20 | Life support: read the gauge, switch to the backup loop. Cargo: pick up the battery, rack it, latch it | "Each job does something you can see. That battery is for the Moon. Latched, it will be waiting for us." |
| 1:20 to 1:45 | Cockpit, press E, dock | "Because navigation is back, the guidance display steadies the docking." |
| 1:45 to 2:15 | Results, **Story: The Last Battery**, start. Read panel two aloud. Take the battery from the near rack, plug it into the shelter socket, call the crew in, close the hatch | "Reyes remembers the battery was latched, so it is right here. Shelter first: the crew is safe early, and the grow lights stay dim." |
| 2:15 to 3:00 | **Replay the Choice**. Grow rack socket, run one crop cycle, unplug, shelter socket, crew in, hatch. Show the comparison | "Same battery, same charge, same alert. Grow rack first: the harvest is on time and one unit is left instead of four. The faint dots on the floor are the route from the first run." |

To show the other start, finish F03 once without latching the battery. The L03 briefing then says it is still in the cargo crate, and the mission begins there.

## If something goes wrong

- A landing or flight fails: that is a feature. Read the try-again card aloud and retry.
- 3D stutters: Pause, Settings, **Low graphics**.
- Sound is distracting in the room: the speaker button in the top right corner mutes it.
- Short on time: skip the F01 segment and start at 0:45.
- Asked about robotics or station emergencies: open **S04 Module Alert** in Judge Mode, press **Start at: Isolate or rescue**, choose the rescue plan and drive the arm.
- Asked how the stars work: open any mission card. The three-star goal is written on it, and the rules are in `src/sim/score.ts` with tests.

## What to have ready for questions

- `docs/SRS_MATRIX.md` for what passes and what is unverified.
- `docs/SCIENCE_AND_CREDITS.md` for sources, and which values are invented.
- `npm test` output: 180 passing simulation tests, including the replay cases, the star rules and both story missions.
