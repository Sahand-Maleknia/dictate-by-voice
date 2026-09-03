#!/bin/bash
# Record the floating card while you dictate, and turn it into the README GIF.
#
#   tools/make-demo-gif.sh [seconds] [output]
#
# Run it, then do a normal dictation: Ctrl+Alt+D, say a sentence, Ctrl+Alt+D.
# The capture stops on its own and writes an optimised GIF.
#
# Only the card's own rectangle is captured — not your whole screen — so nothing
# else that happens to be open ends up in the README.
#
# On a multi-monitor setup the card appears on whichever screen has focus, and
# so does the capture: click on the screen you intend to record BEFORE starting,
# and do not click on the other one during the take.
set -euo pipefail

DURATION="${1:-14}"
OUT="${2:-docs/demo.gif}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# macOS ships no `timeout`, and every step here talks to a device or to another
# process — any of which can decide never to answer. A capture script that hangs
# forever is worse than one that gives up.
with_timeout() {
  local secs=$1; shift
  "$@" & local pid=$!
  ( sleep "$secs"; kill -9 $pid 2>/dev/null ) & local watcher=$!
  local rc=0; wait $pid || rc=$?
  kill -9 $watcher 2>/dev/null || true
  wait $watcher 2>/dev/null || true   # otherwise bash prints "Killed: 9"
  return $rc
}

# Ask the card where it is, rather than recomputing its position.
#
# On a multi-monitor Mac the card appears on whichever screen has focus, so any
# formula based on "the main screen" is a guess that is wrong half the time —
# and AVFoundation crops relative to the captured display, so a desktop x of
# 3228 is simply off the edge of the device. The Hammerspoon script exposes the
# card as `dictateHud` for exactly this. Override with DICTATE_GIF_RECT="x:y:w:h".
GEOM="$(with_timeout 15 hs -c '
  if not dictateHud then return "" end
  local PAD = 40
  local f = dictateHud:frame()
  local scr = hs.screen.find(hs.geometry.rect(f.x, f.y, f.w, f.h)) or hs.screen.mainScreen()
  local ff = scr:fullFrame()
  local scale = (scr:currentMode() or {}).scale or 1
  return string.format("%d:%d:%d:%d:%d:%d",
    math.floor((f.x - ff.x - PAD) * scale), math.floor((f.y - ff.y - PAD) * scale),
    math.floor((f.w + PAD * 2) * scale), math.floor((f.h + PAD * 2) * scale),
    math.floor(ff.w * scale), math.floor(ff.h * scale))' 2>/dev/null | tail -1)"
if [ -z "$GEOM" ]; then
  echo "Hammerspoon did not answer, or dictateHud is not loaded." >&2
  echo "Install ui/macos-hammerspoon/dictate.lua, or set DICTATE_GIF_RECT=x:y:w:h." >&2
  exit 1
fi

IFS=: read -r X Y W H SCREEN_W SCREEN_H <<< "${DICTATE_GIF_RECT:-$GEOM}"

# Which "Capture screen N" is the main display? The AVFoundation index order is
# not the same as the display order on every machine, so identify it by grabbing
# one frame from each and matching the resolution.
find_screen_device() {
  local idx
  for idx in $(with_timeout 20 ffmpeg -hide_banner -f avfoundation -list_devices true -i "" 2>&1 |
                 sed -n 's/.*\[\([0-9]*\)\] Capture screen [0-9]*.*/\1/p'); do
    echo "   probing screen device ${idx}..." >&2
    with_timeout 25 ffmpeg -hide_banner -loglevel quiet -f avfoundation -pixel_format uyvy422 \
      -framerate 30 -i "$idx" -frames:v 1 -y "$WORK/probe.png" </dev/null || continue
    if [ "$(ffprobe -v quiet -select_streams v -show_entries stream=width,height \
              -of csv=p=0:s=x "$WORK/probe.png")" = "${SCREEN_W}x${SCREEN_H}" ]; then
      echo "$idx"; return 0
    fi
  done
  return 1
}
SCREEN_INDEX="${DICTATE_GIF_SCREEN:-$(find_screen_device || true)}"
[ -n "$SCREEN_INDEX" ] || { echo "No screen device matches ${SCREEN_W}x${SCREEN_H}. Set DICTATE_GIF_SCREEN." >&2; exit 1; }

echo "▶︎ screen device $SCREEN_INDEX, capturing ${W}x${H} at ${X},${Y} for ${DURATION}s"
echo "   start dictating now: Ctrl+Alt+D, talk, Ctrl+Alt+D"

with_timeout "$((DURATION + 30))" ffmpeg -hide_banner -loglevel error \
  -f avfoundation -pixel_format uyvy422 -framerate 30 -capture_cursor 0 \
  -i "$SCREEN_INDEX" -t "$DURATION" \
  -vf "crop=${W}:${H}:${X}:${Y}" -c:v qtrle -y "$WORK/raw.mov" </dev/null

# Two passes: a palette built from the whole clip, then applied. A single-pass
# GIF picks its 256 colours from the first frame, which wrecks the level meter.
FILTERS="fps=12,scale=720:-1:flags=lanczos"
ffmpeg -hide_banner -loglevel error -i "$WORK/raw.mov" \
  -vf "${FILTERS},palettegen=stats_mode=diff" -y "$WORK/palette.png"
ffmpeg -hide_banner -loglevel error -i "$WORK/raw.mov" -i "$WORK/palette.png" \
  -lavfi "${FILTERS}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" -y "$OUT"

echo "✓ $OUT  ($(du -h "$OUT" | cut -f1))"
