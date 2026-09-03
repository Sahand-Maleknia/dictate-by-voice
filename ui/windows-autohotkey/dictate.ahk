#Requires AutoHotkey v2.0
Persistent
; Dictate — hotkeys + a small floating card, for Windows.
;
; The Windows counterpart of ui/macos-hammerspoon/dictate.lua. The GUI layer is
; the one part of this project that cannot be shared: both scripts drive the
; same CLI (`dictate --hold`, a stop-file, `dictate --again`), and neither
; knows anything about recording or transcription.
;
;   Ctrl+Alt+D   start / stop recording
;   Ctrl+Alt+R   re-transcribe the last clip (asks for optional corrections)
;
; Install: set REPO below, then run this file (AutoHotkey v2 required).
; To start it with Windows, drop a shortcut in shell:startup.
;
; ⚠ UNTESTED — written blind, like src/platform/windows.ts. Reports welcome.

REPO := A_MyDocuments . "\dictate"
RECORD := REPO . "\bin\dictate-hold.cmd"
RETRY := REPO . "\bin\dictate-again.cmd"
STOP_FILE := A_Temp . "\dictate-hold.stop"

state := "idle"   ; idle | recording | processing | done
startTime := 0
watchPid := 0

; ── The card ──
card := Gui("+AlwaysOnTop -Caption +ToolWindow +E0x20")  ; E0x20 = click-through off for the button below
card.BackColor := "1A1A1C"
card.SetFont("s13 cWhite", "Segoe UI")
title := card.AddText("w320 Center", "")
card.SetFont("s9 c9E9E9E", "Segoe UI")
sub := card.AddText("w320 Center", "")

ShowCard(titleText, subText) {
    title.Value := titleText
    sub.Value := subText
    card.Show("AutoSize NoActivate y" . (A_ScreenHeight - 220))
}

HideCard(*) {
    global state
    if (state = "done") {
        card.Hide()
        state := "idle"
    }
}

; ── Recording ──
BeginRecording() {
    global state, startTime, watchPid
    if FileExist(STOP_FILE)
        FileDelete(STOP_FILE)
    state := "recording"
    startTime := A_TickCount
    ShowCard("● در حال ضبط", "برای پایان دوباره Ctrl+Alt+D بزن")
    Run('"' . RECORD . '"', REPO, "Hide", &pid)
    watchPid := pid
    SetTimer(Tick, 500)
    SetTimer(WatchTask, 250)
}

EndRecording() {
    global state
    state := "processing"
    SetTimer(Tick, 0)
    ShowCard("⏳ در حال تبدیل به متن…", "چند لحظه…")
    FileAppend("", STOP_FILE)   ; the CLI polls for this file and stops
}

Tick() {
    global state, startTime
    if (state != "recording") {
        SetTimer(Tick, 0)
        return
    }
    elapsed := (A_TickCount - startTime) // 1000
    sub.Value := Format("{1}:{2:02}  —  برای پایان Ctrl+Alt+D", elapsed // 60, Mod(elapsed, 60))
}

; The CLI exiting is what "finished" means — there is no other signal.
WatchTask() {
    global state, watchPid
    if ProcessExist(watchPid)
        return
    SetTimer(WatchTask, 0)
    state := "done"
    ShowCard("✓ متن آماده شد", "Ctrl+V بزن")
    SetTimer(HideCard, -2600)
}

; ── Retry ──
; The last clip is kept on disk, so a wrong transcript does not cost you the
; recording. Typing the words it got wrong is what fixes a stubborn mistake:
; the model cannot guess a spelling it has never seen.
Again() {
    global state, watchPid
    if (state = "recording" || state = "processing")
        return
    answer := InputBox("اگر کلمه‌ای را اشتباه نوشت، شکل درستش را بنویس (اختیاری)", "تبدیل دوبارهٔ آخرین ضبط", "w420 h130")
    if (answer.Result != "OK")
        return
    state := "processing"
    hint := Trim(answer.Value)
    ShowCard("↻ تبدیل دوباره…", hint != "" ? hint : "چند لحظه…")
    cmd := '"' . RETRY . '"'
    if (hint != "")
        cmd .= ' "' . StrReplace(hint, '"', "") . '"'
    Run(cmd, REPO, "Hide", &pid)
    watchPid := pid
    SetTimer(WatchTask, 250)
}

^!d:: {
    global state
    if (state = "idle" || state = "done")
        BeginRecording()
    else if (state = "recording")
        EndRecording()
}

^!r:: Again()

TrayTip("Dictate", "آماده — Ctrl+Alt+D ضبط · Ctrl+Alt+R تبدیل دوباره")
