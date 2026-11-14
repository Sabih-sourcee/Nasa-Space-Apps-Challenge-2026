@echo off
REM Optional: download larger LRO LOLA south pole illumination GeoTIFFs.
REM The 85S 60 m/px product is already in data\moon (about 34 MB).
REM These two files are over 50 MB, so they are not stored in git.
setlocal
set "DEST=%~dp0..\data\moon"
if not "%~1"=="" set "DEST=%~1"
if not exist "%DEST%" mkdir "%DEST%"

if not exist "%DEST%\AVGVISIB_85S_060M_201608.TIF" (
  echo Downloading AVGVISIB_85S_060M_201608.TIF
  curl -L --max-time 300 -o "%DEST%\AVGVISIB_85S_060M_201608.TIF" "https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608.TIF"
)

echo Downloading AVGVISIB_65S_240M_201608.TIF (about 60 MB)
curl -L --max-time 300 -o "%DEST%\AVGVISIB_65S_240M_201608.TIF" "https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_65S_240M_201608.TIF"

echo Downloading AVGVISIB_75S_120M_201608.TIF (about 83 MB)
curl -L --max-time 300 -o "%DEST%\AVGVISIB_75S_120M_201608.TIF" "https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608.TIF"

echo Done. See data\SOURCES.md for citations.
endlocal
