#!/usr/bin/env bash
# Test NASA DONKI solar flare (FLR) data for the last 30 days.
# Reads NASA_API_KEY, or uses DEMO_KEY.
# Get a free key at https://api.nasa.gov (sign up with sabih.rehman.dev@gmail.com).
# DEMO_KEY is limited to 30 calls per hour and 50 per day.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/data/donki/flr_sample.json}"
KEY="${NASA_API_KEY:-DEMO_KEY}"

# Last 30 days in UTC. GNU date (Linux) or BSD date (macOS).
if date -u -d '30 days ago' +%Y-%m-%d >/dev/null 2>&1; then
  START="$(date -u -d '30 days ago' +%Y-%m-%d)"
  END="$(date -u +%Y-%m-%d)"
else
  START="$(date -u -v-30d +%Y-%m-%d)"
  END="$(date -u +%Y-%m-%d)"
fi

NASA_URL="https://api.nasa.gov/DONKI/FLR?startDate=${START}&endDate=${END}&api_key=${KEY}"
CCMC_URL="https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR?startDate=${START}&endDate=${END}"

mkdir -p "$(dirname "$OUT")"
TMP="$(mktemp)"
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

fetch() {
  local url="$1"
  local code
  code="$(curl -sS -L --max-time 40 -A "JuniorAstronautPrep/1.0" -o "$TMP" -w "%{http_code}" "$url" || true)"
  echo "$code"
}

echo "Date window (UTC): ${START} to ${END}"
echo "Trying api.nasa.gov (key starts with ${KEY:0:4}...)"
CODE="$(fetch "$NASA_URL")"
echo "api.nasa.gov HTTP ${CODE}"

is_array() {
  python3 - "$TMP" << 'PY' 2>/dev/null
import json,sys
p=sys.argv[1]
try:
    d=json.load(open(p,encoding="utf-8"))
except Exception:
    sys.exit(1)
sys.exit(0 if isinstance(d,list) else 1)
PY
}

if [ "$CODE" != "200" ] || ! is_array; then
  echo "Falling back to CCMC DONKI-API (no key required)."
  echo "On 14 Nov 2026, api.nasa.gov/DONKI/FLR redirected and returned 404."
  CODE="$(fetch "$CCMC_URL")"
  echo "CCMC HTTP ${CODE}"
fi

if [ "$CODE" != "200" ] || ! is_array; then
  echo "DONKI test failed. Body starts with:"
  head -c 400 "$TMP"
  echo
  exit 1
fi

python3 - "$TMP" "$OUT" << 'PY'
import json,sys
src, dest = sys.argv[1], sys.argv[2]
data=json.load(open(src,encoding="utf-8"))
json.dump(data, open(dest,"w",encoding="utf-8"), indent=2)
open(dest,"a",encoding="utf-8").write("\n")
print("Saved %s flares to %s" % (len(data), dest))
if data:
    print("First: %s  class %s  begin %s" % (data[0].get("flrID"), data[0].get("classType"), data[0].get("beginTime")))
    print("Last:  %s  class %s  begin %s" % (data[-1].get("flrID"), data[-1].get("classType"), data[-1].get("beginTime")))
PY
