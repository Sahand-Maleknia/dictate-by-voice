#!/bin/bash
# Hold-mode launcher for the menu-bar toggle: records until the stop-file
# appears (the second click), then transcribes to the clipboard.
cd "$(dirname "$0")/.." || exit 1
# Homebrew's bin is not on a GUI-launched PATH; add it so node/npm/ffmpeg resolve.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
# A GUI launcher passes a bare environment. Without a UTF-8 locale the clipboard
# tool falls back to a legacy codepage and non-Latin text arrives as mojibake.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
npm run --silent dictate -- --hold
