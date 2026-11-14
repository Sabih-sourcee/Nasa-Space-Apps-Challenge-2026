# Junior Astronaut (prep only)

Prep folder for a NASA Space Apps 2026 project. No game code is in this repo.

The idea is Junior Astronaut, an Urdu Moon-base game for kids. Real NASA data drives the events: DONKI solar flares, a Moon south pole sunlight map, and Mars dust storm records for a later or optional Mars mode.

Official challenge: [Build a Junior Astronaut Mission Trainer](https://www.spaceappschallenge.org/2026/challenges/build-a-junior-astronaut-mission-trainer/)

Event: 14 Nov 2026, 8:00 AM PKT, to 15 Nov 2026, 6:00 PM PKT, at Cedar College, DHA Phase 8, Karachi.

Rules: do not write project or game code before the official start. Research, data, API tests, tool setup, and an empty starter template are allowed. After 8:00 AM PKT on 14 Nov, you can start building.

This folder was prepared before the start. It has notes, test data, and install commands only.

## What's in here

- [docs/challenge.md](docs/challenge.md): challenge summary, official datasets, and judging criteria.
- [docs/stack.md](docs/stack.md): recommended stack (Vite + Phaser 3) and Windows install commands. No game code.
- [docs/pitch-proof.md](docs/pitch-proof.md): verified pitch numbers with sources.
- [docs/demo-story.md](docs/demo-story.md): 2-minute demo story and a role / hour plan.
- [data/SOURCES.md](data/SOURCES.md): every data file, URL, and license.
- [data/donki/flr_sample.json](data/donki/flr_sample.json): one test DONKI flare call (last 30 days from 14 Nov 2026).
- [data/moon/](data/moon/): LRO LOLA average solar illumination for 85S-90S at 60 m/px, plus a small PNG preview.
- [data/mars/MDAD.tab](data/mars/MDAD.tab): Mars Dust Activity Database (14,974 storm instances).
- [scripts/test_donki.sh](scripts/test_donki.sh) and [scripts/test_donki.bat](scripts/test_donki.bat): repeat the flare test. Reads `NASA_API_KEY`, falls back to `DEMO_KEY`.

## NASA API key

Get a free key at [https://api.nasa.gov](https://api.nasa.gov). Sign up with sabih.rehman.dev@gmail.com. The shared `DEMO_KEY` works for a first test but is limited to 30 calls per hour and 50 per day.

On Windows cmd:

```
set NASA_API_KEY=your_key_here
scripts\test_donki.bat
```

## Push this folder to GitHub

Copy this folder onto your Windows machine first, then in cmd:

```
cd path\to\Nasa-Space-Apps-Challenge-2026
git remote add origin https://github.com/Sabih-sourcee/Nasa-Space-Apps-Challenge-2026.git
git branch -M main
git push -u origin main
```

If Git asks you to log in, use your GitHub account. If the remote repo already has a README, run `git pull origin main --rebase` before the push.

Do not start writing game code until 8:00 AM PKT on 14 Nov 2026.
