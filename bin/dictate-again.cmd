@echo off
REM Re-transcribe the LAST clip. Arguments are passed through as the correction
REM hint (the words it should have written).
cd /d "%~dp0.."
call npm run --silent dictate -- --again %*
