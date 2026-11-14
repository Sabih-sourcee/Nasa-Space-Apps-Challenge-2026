#!/usr/bin/env bash
# Optional: download larger LRO LOLA south pole illumination GeoTIFFs.
# The 85S 60 m/px product is already in data/moon (about 34 MB).
# These two files are over 50 MB, so they are not stored in git.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/data/moon}"
mkdir -p "$DEST"

fetch() {
  local url="$1"
  local out="$2"
  echo "Downloading $out"
  curl -L --max-time 300 -A "JuniorAstronautPrep/1.0" -o "$out" -w "HTTP %{http_code} size %{size_download}\n" "$url"
}

# Already in the repo; re-download only if missing.
if [ ! -s "$DEST/AVGVISIB_85S_060M_201608.TIF" ]; then
  fetch "https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608.TIF" "$DEST/AVGVISIB_85S_060M_201608.TIF"
fi

fetch "https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_65S_240M_201608.TIF" "$DEST/AVGVISIB_65S_240M_201608.TIF"
fetch "https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608.TIF" "$DEST/AVGVISIB_75S_120M_201608.TIF"
echo "Done. See data/SOURCES.md for citations."
