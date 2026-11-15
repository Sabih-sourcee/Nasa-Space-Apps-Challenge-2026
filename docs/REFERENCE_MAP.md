# Reference images and what they map to

15 November 2026. Status words: **Done**, **Partly**, **Not built**, **Unverified**.

Seven images were supplied with the "realistic expedition" brief. They are used as **visual references only**. None of them is shipped in the game: their source and licence are not known, and several look computer generated. The game's own models are still built in code, and its only image files are the four NASA maps listed in `SCIENCE_AND_CREDITS.md`.

| # | What the image shows | Scene it applies to | What was taken from it | Status |
| --- | --- | --- | --- | --- |
| 1 | Earth training yard: suit station under a canopy, gravity signs (Earth 1.00 g, Mars 0.38 g), equipment table, rocket and towers behind, astronaut from behind | E02 Earth training, title screen, the "Walk to the pad" journey | Layout already matches (suit station, gravity lanes, pad in the distance). The low camera behind the astronaut is now the **Close** view. The walk toward the pad is the first journey shot | Partly. Weathered concrete, the canopy and real-looking equipment: Not built |
| 2 | Cockpit: seated astronaut, three centre displays (course, speed, launch hold), sea and coast through the windows | F01 launch, cockpit view | Already the layout of the cockpit. Displays show live flight values. Added a "Still flying" readout for the stack | Partly. Switch panels, paper checklists and worn metal: Not built |
| 3 | Lunar lander descending with engine plume toward a ring of blue landing lights, crater field, hard shadows, black sky | L02 lunar landing | Ring of lights and powered descent already exist. Added **Side**, **Above** and **Window** views. Ground now has crater rims and relief (previous stage) | Partly. Dust kicked up at touchdown, larger crater fields near the zone: Not built |
| 4 | Launch: a stack with an orange core tank, two white boosters and a winged orbiter, lifting off beside a service tower | F01 launch, outside view | The game's stack is the same family (core, two boosters, crew vehicle), so separation follows that order: boosters, then core. New **Outside** view shows liftoff, the lean-over and both separations from the live flight state | Done for the sequence. The game's orbiter sits on top of the core, not on its side as in the image. Smoke at the pad: Not built |
| 5 | Orbiter approaching a large station with many solar arrays, Earth below with clouds and a sun glint | S01 docking, the "Orbit to the station" journey | New **Outside** docking view shows the orbiter, the station and the gap between them. Earth uses the NASA map with a shinier sea and drifting clouds | Partly. The station model is far simpler than the image. Truss detail, radiators and many modules: Not built |
| 6 | Mars capsule on engine power above a ring of blue lights, layered rock slabs, dusty sky | M04 Mars landing, the "To Mars" journey | Ring of lights, capsule and haze already exist. Same three extra views as the Moon. Journey shows the capsule leaving with a heat glow | Partly. Flat rock slabs and layered outcrops: Not built |
| 7 | Screenshot of the Crew Ship entry screen with "The mission service is not running" | Crew Ship lobby | Not a visual reference. It shows the game opened without `npm run dev`, where Host and Join cannot work. Solo training and the 3D tour still do | No change made. See `CREW_SHIP.md`, "Run it" |

## What the brief asked for, and where it stands

| Stage in the brief | Status |
| --- | --- |
| 1. Audit and reference mapping | **Done** (this file) |
| 2. Reusable transition system | **Done**: `src/sim/sequences.ts`, `src/missions/SequenceScenes.tsx`, `src/ui/SequencePlayer.tsx`. Skip, captions, reduced motion, replay from the Mission Log |
| 3. Earth departure, launch, stage separation | **Partly**: walk-to-pad journey, outside launch view, booster and core separation from live flight state. Boarding through a hatch and a cockpit shot inside the journey: Not built |
| 4. Spacecraft control and instruments | **Partly**: camera views added. The flight model itself was not changed |
| 5. Docking in phases (soft capture, hard dock, seal checks) | **Done** for the steps: approach, alignment, final approach, soft capture, hard dock, connection checks, hatch. Measured ring to port. Roll is held for the pilot (an assist, labelled). The station model is still simple |
| 6. Moon visuals and landing | **Partly**: views, journey with the lander leaving the orbiter. Touchdown dust, slope checks, ladder to EVA: Not built |
| 7. Mars visuals and landing | **Partly**: views and journey. New rock formations: Not built |
| 8. Commander continuity and radio | **Partly**: Reyes and Mission Control caption every journey shot; separation calls on the radio. Outcome carried into the next journey's lines: Not built |
| 9. Regression and performance | **Partly**: 241 unit tests pass and the build succeeds. Frame rate was not measured |
