# Contributing

The most useful contribution right now is **running the Windows code on an
actual Windows machine**. It is written (`src/platform/windows.ts`,
`ui/windows-autohotkey/dictate.ahk`) but has never executed there — the author
has no Windows box. The four spots most likely to be wrong are marked `TESTME`
in the source. Linux is not written at all; it is one file.

A note on strings: user-facing text is Persian and lives in
[`src/messages.ts`](src/messages.ts). Add new strings there, not inline — code,
comments and this document stay English so the project is contributable by
people who do not read Persian.

## Adding an OS

Everything except five primitives is already portable: the codec, the stop
conditions, the silence gate, the model call, the retry. Write
`src/platform/<os>.ts` implementing `Platform` from
[`src/platform/index.ts`](src/platform/index.ts), then add one `case` to
`currentPlatform()`. Nothing else should need to change — if it does, that is a
bug in the seam and worth an issue.

```ts
interface Platform {
  id: 'macos' | 'windows' | 'linux';
  listDevices(): Promise<AudioDevice[]>;      // { id, label }[]
  recordInput(device: AudioDevice): string[]; // ffmpeg input flags
  copyText(text: string): Promise<void>;
  notify(message: string): void;
  cue(event: 'start' | 'stop'): void;
}
```

### Windows — what is already written, and what to check

`src/platform/windows.ts` implements all five primitives; the table is what it
does and why. `parseDshowDevices` is covered by tests against captured output
from both ffmpeg generations (`npm test`) — that part is verified. Everything
that needs a real Windows machine is not.

| primitive | macOS (tested) | Windows (untested) |
|---|---|---|
| `recordInput` | `-f avfoundation -i :0` | `-f dshow -i audio=@device_cm_{…}` — the *alternative name*, which is unique where friendly names are not |
| `listDevices` | parse `-list_devices` (AVFoundation block) | `ffmpeg -list_devices true -f dshow -i dummy` — a **different** output format, and devices are addressed by NAME, not index. `AudioDevice.id` is a string for exactly this reason. |
| `pasteKey` | `Cmd+V` | `Ctrl+V` |
| `copyText` | `pbcopy` + forced UTF-8 env | PowerShell `Set-Clipboard`, reading the text as explicit UTF-8 |
| `notify` | `osascript display notification` | PowerShell toast (BurntToast), or skip and return early |
| `cue` | `afplay` | `[Console]::Beep`, or `System.Media.SoundPlayer` |

The GUI: `ui/windows-autohotkey/dictate.ahk` (AutoHotkey v2) mirrors the
Hammerspoon card and drives the same CLI. It detects "finished" by watching the
launched process exit, since the CLI gives no other signal.

**Do not use `clip.exe`.** It decodes stdin with the console codepage (cp1252 by
default), which is the same class of bug the macOS implementation already has a
comment about: any non-Latin transcript becomes mojibake. `Set-Clipboard` with
an explicit UTF-8 read is the correct path, and a Persian round-trip
(`سلام` in → `سلام` out) is the test that proves it.

Two things are already portable and should stay that way: ffmpeg is stopped by
writing `q` to its stdin (there is no graceful signal on Windows, and killing
the process leaves a truncated Ogg file), and `src/paths.ts` already resolves
the stop-file and retry-clip locations under `%TEMP%` on `win32`.

The GUI layer does **not** port. Hammerspoon is macOS-only; the Windows
equivalent is a separate AutoHotkey v2 script under `ui/windows-autohotkey/`
that drives the same CLI — `dictate --hold`, a stop-file, `dictate --again`.

### Linux

`-f pulse -i default` for capture, `pactl list sources short` for devices,
`wl-copy` or `xclip -selection clipboard` for the clipboard (both take UTF-8
directly), `notify-send`, `paplay`.

## Testing without a native speaker

macOS has no Persian `say` voice, so build test clips from *varied* English
sentences — repeating one sentence 40× is pathological input that makes the
model drift and hallucinate, and will convince you long clips are broken when
they are not.

```bash
say -v Samantha -o /tmp/t.aiff "…varied sentences…"
ffmpeg -y -i /tmp/t.aiff -c:a libopus -b:a 32k -application voip -ac 1 /tmp/dictate-last.ogg
npm run dictate -- --again
```

## Before opening a PR

```bash
npm run typecheck
npm test
```

Keep the comment style: explain *why* a non-obvious line exists, ideally naming
the failure it prevents. Most of the odd-looking settings in this codebase are
scar tissue, and an uncommented one gets "simplified" away by the next person.
