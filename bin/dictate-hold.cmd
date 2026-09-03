@echo off
REM Hold-mode launcher: records until the stop-file appears, then transcribes.
cd /d "%~dp0.."
call npm run --silent dictate -- --hold
