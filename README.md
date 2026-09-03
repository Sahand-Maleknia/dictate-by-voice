# dictate 🎙️

Press a key, talk, paste. A small local-first dictation tool for the desktop —
tuned for **Persian**, and good at everything else.

It records from your microphone, sends the clip once to Google's Gemini, and
puts the text on your clipboard. No dictation service account, no background
daemon uploading anything, no subscription: your own API key, your own machine.

```
Ctrl+Alt+D   start / stop recording  →  text is on your clipboard
Ctrl+Alt+R   that came out wrong — transcribe the same audio again
```

> **Status:** macOS today. The code is structured for Windows and Linux (one
> file each, see [CONTRIBUTING.md](CONTRIBUTING.md)) but those are not written
> yet, and this README will not claim they are.

## Why this exists

Built for dictating long, conversational **Persian** — the case most dictation
tools handle badly. Persian speech here stays Persian and stays conversational
(محاوره‌ای): it is not translated, and it is not formalised into written Persian.
English, and technical terms inside Persian speech, come through as spoken.

## Requirements

- macOS, [Node.js](https://nodejs.org) 20+, and ffmpeg (`brew install ffmpeg`)
- A free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
- [Hammerspoon](https://www.hammerspoon.org) — only if you want the hotkeys and HUD

## Install

```bash
git clone https://github.com/siavash-smf/dictate.git
cd dictate
npm install
cp .env.example .env      # then paste your key into it
npm run dictate           # talk, press Enter
```

The first run will ask macOS for microphone permission for whichever terminal
you launched it from.

## Use

```bash
npm run dictate                  # record, Enter to stop
npm run dictate -- --auto        # record, stops by itself when you go quiet
npm run dictate -- --list        # which microphones ffmpeg can see
npm run dictate -- 2             # force input device #2

npm run dictate -- --again                    # it got it wrong — try again
npm run dictate -- --again "Siavash, Sadaf"   # …and here are the right spellings
```

### `--again` is the interesting one

Getting a name wrong should not cost you the recording. The last clip is kept,
so `--again` re-sends that same audio instead of making you say it all over.

The hint matters more than the retry. The first pass runs at `temperature: 0`,
which is deterministic — an unguided second attempt returns the *identical*
text. So: with no hint, the retry samples differently; with a hint, it stays
deterministic and simply uses the spellings you gave it. Names, brands, and
jargon are exactly what a model cannot guess from audio.

## Hotkeys and the floating HUD (optional)

The GUI layer is a Hammerspoon script: a menu-bar mic, a floating recorder card
with a level meter and a timer, and the two hotkeys above.

1. Install [Hammerspoon](https://www.hammerspoon.org) and grant it Accessibility permission.
2. Copy `ui/macos-hammerspoon/dictate.lua` into `~/.hammerspoon/init.lua`.
3. Set `REPO` at the top of that file to where you cloned this.
4. Reload the config.

The hotkeys bind to the **physical** D and R keys, so they keep working under a
Persian (or any non-Latin) keyboard layout.

## Privacy

The audio goes from your machine to the Gemini API and nowhere else. Exactly one
clip is kept on disk — the most recent, at `/tmp/dictate-last.ogg` — so
`--again` has something to re-send; every recording overwrites it. Set
`DICTATE_KEEP_LAST=0` to delete it the moment it is transcribed (which turns
`--again` off).

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | — | required |
| `DICTATE_MIC` | auto | force an input device id |
| `DICTATE_MAX_SECONDS` | `600` | hard cap on one recording |
| `DICTATE_KEEP_LAST` | `1` | `0` deletes the audio immediately |
| `DICTATE_STOP_FILE` | `/tmp/dictate-hold.stop` | how a GUI ends a `--hold` recording |
| `DICTATE_LAST_CLIP` | `/tmp/dictate-last.ogg` | where the retry clip lives |

## How it works

```
ffmpeg (Opus 32 kbps mono)  →  silence gate  →  Gemini  →  clipboard
```

Four decisions in here are load-bearing, and each one is commented in the source
with the failure that produced it:

- **Opus, not WAV.** WAV is 32 kB/s, so two minutes of talking exceeded the
  model's inline-audio ceiling and was rejected before it was ever heard.
- **Thinking set to minimal.** On Gemini 3 the thought summary arrives as an
  ordinary *text* part, so the SDK's `.text` glues the model's monologue onto
  the front of your transcript — and onto your clipboard.
- **A deterministic silence gate.** Given silence the model does not say
  "silence": it invents a fluent, plausible note. The guard is ffmpeg
  `volumedetect`, not a prompt rule — the prompt version makes the model refuse
  perfectly good long clips.
- **Explicit UTF-8 for the clipboard.** `pbcopy` takes its encoding from
  `LANG`/`LC_CTYPE` and falls back to *Mac OS Roman* when a GUI launcher hands
  the process a bare environment. That is how a clean Persian transcript
  reaches the clipboard as `ÿ≥ŸÑÿßŸÖ`.

## License

MIT

---

## فارسی

ابزار کوچکی برای تبدیل صدا به متن، مخصوص فارسی. `Ctrl+Alt+D` را می‌زنی، حرف
می‌زنی، دوباره می‌زنی — متن روی کلیپ‌بورد است. اگر کلمه‌ای را اشتباه نوشت،
`Ctrl+Alt+R` همان صدای قبلی را دوباره تبدیل می‌کند و می‌توانی املای درست
اسم‌ها را هم به آن بدهی.

فارسی محاوره‌ای، محاوره‌ای می‌ماند: نه ترجمه می‌شود، نه به فارسی کتابی تبدیل.
کلید API رایگان از Google AI Studio می‌گیری و صدا فقط به همان‌جا می‌رود.
