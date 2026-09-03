@echo off
REM One-click dictation: records, stops when you go quiet, copies the text.
cd /d "%~dp0.."
call npm run --silent dictate -- --auto
