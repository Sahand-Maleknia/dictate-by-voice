/**
 * Windows: DirectShow for capture, PowerShell for the clipboard, notifications
 * and cues.
 *
 * ⚠ UNTESTED. Written against the documented behaviour of ffmpeg's dshow
 * device and PowerShell 5.1 (stock on Windows 10/11), but the author has no
 * Windows machine. If you run it, please report what breaks — the four
 * likely-fragile spots are marked TESTME below.
 */

import { spawn } from 'node:child_process';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AudioDevice, Platform } from './index.js';

/** Run a PowerShell one-liner, fire-and-forget. */
function powershell(script: string): ReturnType<typeof spawn> {
  return spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    windowsHide: true,
  });
}

/** Escape a string for a PowerShell single-quoted literal. */
function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Parse `ffmpeg -list_devices` output for the DirectShow AUDIO devices.
 *
 * TESTME. Two output shapes exist in the wild and both are handled:
 *
 *   ffmpeg ≥ 5:  [dshow @ …] "Microphone (Realtek)" (audio)
 *   ffmpeg < 5:  [dshow @ …] DirectShow audio devices
 *                [dshow @ …]  "Microphone (Realtek)"
 *
 * followed in either case by an indented `Alternative name "@device_cm_{…}"`.
 * The alternative name is preferred as the id: friendly names are not unique
 * (two identical headsets), can change with a driver update, and may contain
 * characters that confuse the dshow demuxer.
 */
export function parseDshowDevices(stderr: string): AudioDevice[] {
  const devices: AudioDevice[] = [];
  let section: 'audio' | 'video' | null = null;
  let pending: AudioDevice | null = null;

  for (const raw of stderr.split('\n')) {
    // ffmpeg's log prefix on these lines was `[dshow @ 0x…]` up to ~ffmpeg 7
    // and became `[in#0 @ 0x…]` in ffmpeg 8+. Strip either bracketed `… @ …`
    // tag so the device lines parse on both.
    const line = raw.replace(/^\[[^\]]*@[^\]]*\]\s?/, '').trim();

    const header = /^DirectShow (audio|video) devices/i.exec(line);
    if (header) {
      section = header[1]!.toLowerCase() as 'audio' | 'video';
      continue;
    }

    const alt = /^Alternative name\s+"(.+)"$/i.exec(line);
    if (alt && pending) {
      pending.id = alt[1]!;
      continue;
    }

    const named = /^"(.+?)"(?:\s+\((audio|video)\))?$/.exec(line);
    if (named) {
      const kind = (named[2]?.toLowerCase() as 'audio' | 'video' | undefined) ?? section;
      if (kind !== 'audio') {
        pending = null;
        continue;
      }
      pending = { id: named[1]!, label: named[1]! };
      devices.push(pending);
    }
  }

  return devices;
}

export const windows: Platform = {
  id: 'windows',
  pasteKey: 'Ctrl+V',

  listDevices() {
    return new Promise<AudioDevice[]>((resolve) => {
      // Listing is an "error" as far as ffmpeg is concerned: the list goes to
      // stderr and the process exits non-zero. That is the documented way.
      const ff = spawn('ffmpeg', ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], {
        windowsHide: true,
      });
      let err = '';
      ff.stderr.on('data', (d) => (err += d.toString()));
      ff.on('close', () => resolve(parseDshowDevices(err)));
      ff.on('error', () => resolve([]));
    });
  },

  // TESTME. DirectShow addresses inputs by NAME, not by index — which is why
  // AudioDevice.id is a string across the whole codebase.
  recordInput(device) {
    return ['-f', 'dshow', '-i', `audio=${device.id}`];
  },

  /**
   * TESTME, and the one place not to improvise.
   *
   * `clip.exe` decodes stdin with the console codepage (cp1252 by default), so
   * piping UTF-8 Persian into it produces mojibake — the exact bug macOS has
   * with pbcopy and a bare locale. Writing the text as a UTF-8 file and having
   * PowerShell read it with an explicit encoding is the path that survives
   * non-Latin text.
   */
  async copyText(text) {
    const file = join(tmpdir(), `dictate-clip-${process.pid}.txt`);
    await writeFile(file, text, 'utf8');
    await new Promise<void>((resolve, reject) => {
      const p = powershell(
        `Set-Clipboard -Value ([IO.File]::ReadAllText(${psQuote(file)}, [Text.Encoding]::UTF8))`,
      );
      p.on('error', reject);
      p.on('close', () => resolve());
    });
    await unlink(file).catch(() => {});
  },

  /**
   * TESTME. A balloon tip through NotifyIcon, which Windows 10/11 renders as a
   * toast. Deliberately not BurntToast: a notification is not worth making the
   * user install a PowerShell module before the tool works.
   */
  notify(message) {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms;',
      '$n = New-Object System.Windows.Forms.NotifyIcon;',
      '$n.Icon = [System.Drawing.SystemIcons]::Information;',
      '$n.Visible = $true;',
      `$n.ShowBalloonTip(4000, 'Dictate', ${psQuote(message)}, 'Info');`,
      'Start-Sleep -Seconds 4;',
      '$n.Dispose()',
    ].join(' ');
    powershell(script).on('error', () => {});
  },

  cue(event) {
    const freq = event === 'start' ? 880 : 660;
    powershell(`[Console]::Beep(${freq}, 120)`).on('error', () => {});
  },
};
