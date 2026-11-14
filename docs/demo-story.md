# Demo story and team plan

This is a plan only. No game code belongs in this folder.

Official audience: kids ages 7-12. Keep words short. The Karachi pitch can still talk about Urdu-medium government schools, including Grade 6 at the top of that age range.

## 2-minute demo story

0:00-0:20. Problem, with a hand-raise.

"How many of you had a real science lab at school?" Then one line of proof: in Karachi, 1,588 of 1,914 government schools had no science laboratory. In TIMSS 2019, Pakistan's Grade 4 students were second to last of 64 countries in science, with an average score of 290. Kids here get almost no hands-on space learning, and most of what exists is in English.

0:20-0:35. The idea, in one sentence.

Junior Astronaut is a browser game in Urdu and English. A child runs a Moon base at the south pole and has to make the same kind of trade-offs NASA planners make, using real NASA data, not made-up numbers.

0:35-1:35. Live demo (this is most of the time).

1. The base sits on the real south pole sunlight map. Bright areas get more power from the Sun. Dark areas do not.
2. A real solar flare from NASA's DONKI database hits. Show the flare class and date on screen, and say it is a real event, not a random script.
3. The child has to choose: put power into crew shielding, or keep the greenhouse running. There is no free choice.
4. On the first try the crops fail, or the crew's radiation risk goes up. An Urdu voice (the commander) explains why, in plain words.
5. The child replays. This time the base survives. The bars, the map, and the commander line should make the trade-off obvious without a speech.

1:35-1:50. Why this is not "just another space game."

Moonbase Alpha and Kerbal are English, PC-heavy, and complex. Urdu space content is mostly videos or fact apps. This is a short, no-login browser game where a real NASA event changes the base, and the explanation is in Urdu.

1:50-2:00. Honest close.

"Here is what we built in 34 hours, and here is the roadmap." If you ran a 5-question quiz with n kids, read the real numbers. If you did not, say so. Name the NASA datasets on one slide: DONKI flares, LRO LOLA south pole illumination, and any OSDR or Mars data you actually used.

If the live API fails, use the saved flare file in `data/donki/flr_sample.json` and say it is archived NASA data, not a live feed.

## Scope to lock at the start

- 1 Moon base.
- 3 resources: life support (or oxygen), power, and shielding. Food / greenhouse can be the thing power and life support fight over. Do not build five or six systems.
- About 5 real NASA events (pick real DONKI flares from the sample; the 14-15 Nov 2026 window includes several M-class flares, including an M3.5 on 5 Nov 2026).
- No login, no signup, browser only.
- Urdu commander voice plus on-screen English, so the submission stays clear for global judges.
- No Mars mode in the demo unless the Moon loop is finished early. The Mars dust data is packed if you need a second event type, not a second game.

## Role split

Team size can be 1 to 6. This plan assumes four people. If you are three, merge Pitch into Game and Art. If you are five or six, add a second game-logic person and a dedicated quiz / testing person. If you are two, one does game + data, the other does art + pitch, and you cut the voice if it slips.

- Person A, Game lead: core loop, resource bars, win/fail, event trigger.
- Person B, Data and logic: load DONKI events and the sunlight map, label sources on screen, keep a fallback JSON.
- Person C, Art and audio: base view, shield glow, draining bars, wilting plants, Urdu commander line.
- Person D, Pitch and words: slides, submission text in English, demo script, quiz if you can run one, References list.

## Hour-by-hour plan (PKT)

Venue hours used here: Saturday 14 Nov, 8:00 AM to late, and Sunday 15 Nov until the 6:00 PM close. Official project submission stays open until 11:59 PM PKT on Sunday, but plan to submit before 6:00 PM.

### Saturday 14 Nov

- 8:00-8:30. All: read the challenge page together, lock the scope above, pick roles, open an empty Vite + Phaser project. No extra features.
- 8:30-9:30. A+B: one screen, a base, three bars, one button that applies a stored flare. C: sketch the map background and the bars. D: outline the 7 slides and the 2-minute script.
- 9:30-12:30. A: the loop, event hits, choice, survive or fail, replay. B: hook the five real flares and show class + date + "NASA DONKI" on screen; drop the base on the sunlight preview if the full GeoTIFF is too heavy. C: shield, greenhouse, fail state. D: write problem and data slides with the sourced numbers only.
- 12:30-13:30. Lunch and a short playtest with the team only. Cut anything that is not in the core loop.
- 13:30-17:00. A+B: polish the trade-off so both choices hurt. C: Urdu commander line for the fail and the success. D: start the official submission draft (English).
- 17:00-20:00. If the venue is still open, keep going. Freeze new features at 8:00 PM. After that, only fixes and art. Record a backup screen capture of a clean run.

### Sunday 15 Nov

- Morning, first 90 minutes: bug hunt, load the clean demo data, typo pass, confirm sources are on screen.
- Late morning, if you can: a 5-question quiz with 5-10 kids (siblings, friends, or other teams' younger siblings). Write down n, average before, average after, and first-try vs third-try survival. If you cannot find kids, skip it and do not fake a number.
- Midday: freeze the build. D fills every required field on the project page. A+C record a short demo video as backup (the official video demo limit for the submission slot is 30 seconds; a longer walkthrough can be linked if the form allows a video link).
- Afternoon, before 5:00 PM: practice the 2-minute live demo twice. Slides stay at or under 7, including title. 80% of the talk is the live game.
- Before you leave, and no later than 6:00 PM if you can: click Submit. Recheck that every teammate is listed and registered for Karachi.

## Answers to prepare

- "This already exists." Moonbase Alpha and Kerbal are English and heavy. Urdu space apps are not trade-off games on a real NASA map. Nobody here is shipping an Urdu, no-login Moon-base trainer driven by real flares.
- "Games help kids less when resources are low." Point to the no-login browser design, Urdu voice, and any quiz numbers you actually have. Do not invent an effect size for your build.
- "Schools have no internet." Ship a cached event list so the game runs after the first load, or fully offline from the embedded JSON.
