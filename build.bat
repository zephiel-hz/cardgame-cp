@echo off
cd /d "e:\my apps\Web\cardgame-cp"
setlocal enabledelayedexpansion

REM Find npm
for /f "delims=" %%i in ('where npm') do set npm_path=%%i

REM Run build
"%npm_path%" run build

pause
