# Data sources

Prep data only. All of it is from official or academic sources listed below. Do not present saved files as a live feed.

## DONKI solar flares

- File: `data/donki/flr_sample.json`
- What it is: Solar flare (FLR) records for 15 Oct 2026 to 14 Nov 2026 (30 days ending on the day this folder was prepared).
- Test result: HTTP 200 from the CCMC DONKI API. 13 flares returned. Classes in this window include C-class and M-class events. The strongest in the file is M3.5 on 5 Nov 2026 (flrID `2026-11-05T18:21:00-FLR-001`).
- Endpoints:
  - Documented on https://api.nasa.gov : `https://api.nasa.gov/DONKI/FLR?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&api_key=KEY`
  - Current working service, no key required: `https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- Note: on 14 Nov 2026, `api.nasa.gov/DONKI/FLR` redirected to `/DONKI-API/get/FLR/` and returned HTTP 404. The scripts try the documented api.nasa.gov URL first, then fall back to the CCMC URL. Get your own key at https://api.nasa.gov (use sabih.rehman.dev@gmail.com). `DEMO_KEY` is limited to 30 calls per hour and 50 per day.
- Tool page: https://ccmc.gsfc.nasa.gov/tools/DONKI/
- License: NASA / CCMC public web service data. Credit "NASA CCMC DONKI" in the game and in the submission References field.

## Moon south pole illumination

- Product: LRO LOLA average solar illumination over a lunar nutation cycle (about 18.6 years), polar stereographic, south pole.
- File kept in git: `data/moon/AVGVISIB_85S_060M_201608.TIF` (85S-90S, 60 m/px, GeoTIFF, 33,994,464 bytes, 5058 x 5058, 16-bit). This is under the 50 MB threshold used in this repo and under GitHub's 100 MB file limit.
- Preview: `data/moon/AVGVISIB_85S_060M_201608_preview.png` (1024 x 1024 PNG, about 603 KB), stretched from the GeoTIFF for easy viewing. It is a preview, not a science product. Use the GeoTIFF for any real values.
- Product page: https://pgda.gsfc.nasa.gov/products/69
- Direct file URL: https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608.TIF
- Also distributed through the LOLA PDS node: http://imbrium.mit.edu/EXTRAS/ILLUMINATION/ and the PDS Geosciences node: http://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/
- Citation: Mazarico, E., et al. (2011), Illumination conditions of the lunar polar regions using LOLA topography, Icarus, 211, 1066-1081, https://doi.org/10.1016/j.icarus.2010.10.030
- License: NASA / PDS open planetary data (U.S. government public data). Credit LRO LOLA / NASA GSFC PGDA.
- Larger tiles, not stored in git (each is over 50 MB). Use `scripts/download_moon_maps` if you want more coverage:
  - 65S-90S, 240 m/px, 60,394,652 bytes: https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_65S_240M_201608.TIF
  - 75S-90S, 120 m/px, 83,052,039 bytes: https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608.TIF
- Official color preview JPEGs on core2.gsfc.nasa.gov did not download from this machine (TLS / HTTP 500). The local PNG preview is the substitute.

## Mars dust storms

- File: `data/mars/MDAD.tab` (2,111,103 bytes, 14,974 data rows plus a header).
- What it is: Mars Dust Activity Database (MDAD), 14,974 outlined dust-storm instances across multiple Mars years, with latitude, longitude, time, and area.
- Dataset page: https://doi.org/10.7910/DVN/F8R2JX (Harvard Dataverse)
- File download used: https://dataverse.harvard.edu/api/access/datafile/3607412 (persistent id doi:10.7910/DVN/F8R2JX/4DBWG4)
- Author page: https://battalio.com/mars-dust-activity-database/
- Citation: Battalio, J. Michael; Wang, Huiqun, 2019, "The Mars Dust Activity Database (MDAD)", https://doi.org/10.7910/DVN/F8R2JX, Harvard Dataverse.
  Related paper: Battalio and Wang, 2021 (see the Dataverse page and the author site).
- License: CC0 1.0 (public domain dedication), as stated on the Dataverse record: https://creativecommons.org/publicdomain/zero/1.0/
- This dataset is not on the official challenge resource list. If you use it, say so in References. It is for optional Mars dust events, not for the first Moon-base demo unless the Moon loop is already done.

## Official challenge resources not downloaded as files

These are listed in `docs/challenge.md` and were not copied into `data/` because they are websites or APIs, not a single small file:

- NASA Open APIs, https://api.nasa.gov/
- OSDR, https://osdr.nasa.gov/bio/repo/
- RadLab, https://visualization.osdr.nasa.gov/radlab/gui/data-api/
- Mars Trek, https://trek.nasa.gov/mars/
- CSA STEM resources and CSA food-production toolkit (links in the challenge doc)
