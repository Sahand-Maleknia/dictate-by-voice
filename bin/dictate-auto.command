#!/bin/bash
# One-click dictation: records, stops by itself when you go quiet, copies the
# transcript. Double-click it, or keep it in the Dock.
cd "$(dirname "$0")/.." || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
npm run --silent dictate -- --auto
