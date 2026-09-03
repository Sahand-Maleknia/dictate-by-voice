-- Dictate — menu-bar icon + floating HUD + hotkeys, for macOS.
--
-- This is the GUI layer, and it is the ONLY part of the project that is not
-- portable: Hammerspoon is macOS-only, so a Windows or Linux front end is a
-- separate script driving the same CLI (see CONTRIBUTING.md).
--
--   Ctrl+Alt+D   start / stop recording
--   Ctrl+Alt+R   re-transcribe the last clip (asks for optional corrections)
--
-- Install: copy this into ~/.hammerspoon/init.lua (or dofile() it from there),
-- set REPO below to where you cloned this project, and reload Hammerspoon.

local REPO = os.getenv("HOME") .. "/dictate"
local RECORD = REPO .. "/bin/dictate-hold.command"
local RETRY = REPO .. "/bin/dictate-again.command"
local STOP_FILE = "/tmp/dictate-hold.stop"
local LOG = "/tmp/hs-dictate.log"

local C = {
  bg = { red = 0.09, green = 0.09, blue = 0.11, alpha = 0.96 },
  text = { white = 1 },
  sub = { white = 0.7 },
  bar = { red = 0.98, green = 0.35, blue = 0.35, alpha = 1 },
  done = { red = 0.35, green = 0.85, blue = 0.5, alpha = 1 },
}

local W, H, NBARS = 360, 120, 9
local STATE = "idle" -- idle | recording | processing | done
local startTime = 0
local waveTimer, tickTimer, hideTimer
local task = nil

local hud = hs.canvas.new({ x = 0, y = 0, w = W, h = H })
local els = {
  { type = "rectangle", action = "fill", fillColor = C.bg, roundedRectRadii = { xRadius = 18, yRadius = 18 } },
  { type = "text", text = "", textSize = 17, textColor = C.text, textAlignment = "center",
    frame = { x = 0, y = 16, w = W, h = 26 } },
  { type = "text", text = "", textSize = 12, textColor = C.sub, textAlignment = "center",
    frame = { x = 0, y = 88, w = W, h = 20 } },
}
local barX0 = (W - (NBARS * 4 + (NBARS - 1) * 6)) / 2
for i = 1, NBARS do
  els[#els + 1] = { type = "rectangle", action = "fill", fillColor = C.bar,
    roundedRectRadii = { xRadius = 2, yRadius = 2 },
    frame = { x = barX0 + (i - 1) * 10, y = 50, w = 4, h = 16 } }
end
hud:replaceElements(els)
hud:level(hs.canvas.windowLevels.overlay)
hud:behavior(hs.canvas.windowBehaviors.canJoinAllSpaces)

local function setTitle(t) hud:elementAttribute(2, "text", t) end
local function setSub(t) hud:elementAttribute(3, "text", t) end
local function barColor(c) for i = 1, NBARS do hud:elementAttribute(3 + i, "fillColor", c) end end

local function showBars(show)
  for i = 1, NBARS do
    hud:elementAttribute(3 + i, "action", show and "fill" or "skip")
  end
end

local function positionHud()
  local f = hs.screen.mainScreen():frame()
  hud:topLeft({ x = f.x + (f.w - W) / 2, y = f.y + f.h - H - 90 })
end

local dictateBar = hs.menubar.new()
local function setIcon(t) if dictateBar then dictateBar:setTitle(t) end end

local function stopTimers()
  if waveTimer then waveTimer:stop(); waveTimer = nil end
  if tickTimer then tickTimer:stop(); tickTimer = nil end
end

-- Shared completion handling for both the record and the retry task.
local function finish(code, failTitle, failSub)
  stopTimers()
  showBars(false)
  STATE = "done"; setIcon("🎙️")
  if code == 0 then
    barColor(C.done); setTitle("✓ Text ready"); setSub("paste it")
  else
    setTitle(failTitle); setSub(failSub)
  end
  hideTimer = hs.timer.doAfter(2.6, function()
    if STATE == "done" then hud:hide(0.3); STATE = "idle" end
  end)
end

local function beginRecording()
  STATE = "recording"
  startTime = os.time()
  if hideTimer then hideTimer:stop(); hideTimer = nil end
  os.remove(STOP_FILE)
  setIcon("🔴")
  barColor(C.bar)
  showBars(true)
  setTitle("● Recording")
  setSub("0:00  —  click to stop")
  positionHud()
  hud:show(0.12)

  -- Live (faux) waveform: randomised bar heights read as an audio meter.
  waveTimer = hs.timer.doEvery(0.11, function()
    if STATE ~= "recording" then return end
    for i = 1, NBARS do
      local h = math.random(6, 40)
      hud:elementAttribute(3 + i, "frame", { x = barX0 + (i - 1) * 10, y = 58 - h / 2, w = 4, h = h })
    end
  end)
  tickTimer = hs.timer.doEvery(1, function()
    if STATE ~= "recording" then return end
    local e = os.time() - startTime
    setSub(string.format("%d:%02d  —  click to stop", e // 60, e % 60))
  end)

  task = hs.task.new(RECORD, function(code)
    local f = io.open(LOG, "a"); if f then f:write(os.date() .. " record exit=" .. tostring(code) .. "\n"); f:close() end
    finish(code, "Nothing recorded", "try again")
  end)
  task:start()
end

local function endRecording()
  STATE = "processing"
  setIcon("⏳")
  stopTimers()
  showBars(false)
  setTitle("⏳ Transcribing…")
  setSub("one moment")
  local f = io.open(STOP_FILE, "w"); if f then f:close() end
end

function dictateToggle()
  if STATE == "idle" or STATE == "done" then
    beginRecording()
  elseif STATE == "recording" then
    endRecording()
  end -- ignore clicks while processing
end

-- The clip the model just heard is kept on disk, so a wrong transcript does not
-- cost you the recording: this re-sends the same audio. An empty hint makes it
-- a plain second attempt; typing the words it got wrong (names, jargon) is what
-- fixes a stubborn mistake, because the model cannot guess a spelling it has
-- never seen.
function dictateAgain()
  if STATE == "recording" or STATE == "processing" then return end
  local btn, hint = hs.dialog.textPrompt(
    "Transcribe the last recording again",
    "If it got a word wrong, type the correct spelling (optional) — e.g. names or product terms",
    "", "Transcribe", "Cancel")
  if btn ~= "Transcribe" then return end

  if hideTimer then hideTimer:stop(); hideTimer = nil end
  STATE = "processing"
  setIcon("⏳")
  showBars(false)
  setTitle("↻ Transcribing again…")
  setSub((hint and hint ~= "") and hint or "one moment")
  positionHud()
  hud:show(0.12)

  local a = {}
  if hint and hint ~= "" then a[1] = hint end
  task = hs.task.new(RETRY, function(code)
    local f = io.open(LOG, "a"); if f then f:write(os.date() .. " again exit=" .. tostring(code) .. "\n"); f:close() end
    finish(code, "No previous recording", "record one first")
  end, a)
  task:start()
end

-- ── Wiring ──
hud:mouseCallback(function(_, ev)
  if ev == "mouseUp" and STATE == "recording" then endRecording() end
end)

if dictateBar then
  dictateBar:setTitle("🎙️")
  dictateBar:setClickCallback(dictateToggle)
end

-- Bound by KEYCODE, not by character: keycodes 2 and 15 are the physical D and
-- R keys, so the hotkeys keep working under a non-Latin keyboard layout.
hs.hotkey.bind({ "ctrl", "alt" }, hs.keycodes.map["d"] or 2, dictateToggle)
hs.hotkey.bind({ "ctrl", "alt" }, hs.keycodes.map["r"] or 15, dictateAgain)

hs.alert.show("Dictate 🎙️ ready — Ctrl+Alt+D record · Ctrl+Alt+R again")
