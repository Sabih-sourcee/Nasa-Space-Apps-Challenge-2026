@echo off
REM Test NASA DONKI solar flare (FLR) data for the last 30 days.
REM Reads NASA_API_KEY, or uses DEMO_KEY.
REM Get a free key at https://api.nasa.gov (sign up with sabih.rehman.dev@gmail.com).
REM DEMO_KEY is limited to 30 calls per hour and 50 per day.
setlocal EnableExtensions

set "ROOT=%~dp0.."
if "%~1"=="" (set "OUT=%ROOT%\data\donki\flr_sample.json") else (set "OUT=%~1")
if not defined NASA_API_KEY set "NASA_API_KEY=DEMO_KEY"

for /f %%i in ('powershell -NoProfile -Command "(Get-Date).ToUniversalTime().AddDays(-30).ToString('yyyy-MM-dd')"') do set START=%%i
for /f %%i in ('powershell -NoProfile -Command "(Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')"') do set END=%%i

set "NASA_URL=https://api.nasa.gov/DONKI/FLR?startDate=%START%&endDate=%END%&api_key=%NASA_API_KEY%"
set "CCMC_URL=https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR?startDate=%START%&endDate=%END%"
set "TMP=%TEMP%\donki_flr_sample.json"

if not exist "%ROOT%\data\donki" mkdir "%ROOT%\data\donki"

echo Date window (UTC): %START% to %END%
echo Trying api.nasa.gov
curl -sS -L --max-time 40 -o "%TMP%" -w "api.nasa.gov HTTP %{http_code}\n" "%NASA_URL%"
if errorlevel 1 goto fallback

powershell -NoProfile -Command "try { $d = Get-Content -Raw -LiteralPath $env:TMP | ConvertFrom-Json; if ($d -is [System.Array] -or $d.GetType().FullName -eq 'System.Object[]') { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 goto fallback
goto save

:fallback
echo Falling back to CCMC DONKI-API (no key required).
echo On 14 Nov 2026, api.nasa.gov/DONKI/FLR redirected and returned 404.
curl -sS -L --max-time 40 -o "%TMP%" -w "CCMC HTTP %{http_code}\n" "%CCMC_URL%"
if errorlevel 1 (
  echo DONKI test failed.
  exit /b 1
)

:save
powershell -NoProfile -Command ^
  "$d = Get-Content -Raw -LiteralPath '%TMP%' | ConvertFrom-Json; if ($null -eq $d) { Write-Error 'Not JSON'; exit 1 }; $n = @($d).Count; $d | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath '%OUT%' -Encoding utf8; Write-Host ('Saved ' + $n + ' flares to %OUT%')"
if errorlevel 1 (
  echo Could not parse the response as a flare list.
  type "%TMP%"
  exit /b 1
)
echo Done.
endlocal
