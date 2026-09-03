#!/bin/bash
# Re-transcribe the LAST clip — for when the text came back wrong and you would
# rather correct the model than say it all again. Arguments are passed through
# as the correction hint (the words it should have written).
cd "$(dirname "$0")/.." || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
npm run --silent dictate -- --again "$@"
