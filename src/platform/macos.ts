/**
 * macOS: AVFoundation for capture, pbcopy for the clipboard, osascript for
 * notifications, afplay for cues.
 */

import { spawn } from 'node:child_process';
import type { AudioDevice, Platform } from './index.js';

/**
 * Child processes that carry non-Latin text must be told it is UTF-8.
 *
 * `pbcopy` and `osascript` take their input encoding from LANG/LC_CTYPE and
 * fall back to *Mac OS Roman* when neither is set — and a GUI launcher (a
 * hotkey daemon, a Login Item) starts this process with a bare environment.
 * That is how a clean Persian transcript reached the clipboard as
 * "ÿ≥ŸÑÿßŸÖ" instead of "سلام". Never trust the inherited locale here.
 */
const UTF8_ENV = {
  ...process.env,
  LANG: 'en_US.UTF-8',
  LC_ALL: 'en_US.UTF-8',
  LC_CTYPE: 'UTF-8',
};

/** Parse `ffmpeg -list_devices` output for the AVFoundation audio devices. */
function parseAudioDevices(stderr: string): AudioDevice[] {
  const lines = stderr.split('\n');
  const start = lines.findIndex((l) => /audio devices:/i.test(l));
  if (start === -1) return [];
  const devices: AudioDevice[] = [];
  for (const line of lines.slice(start + 1)) {
    const m = /\[(\d+)\]\s+(.+?)\s*$/.exec(line.replace(/^\[[^\]]*\]\s*/, ''));
    if (!m) break; // the audio list ends at the first line that isn't an entry
    devices.push({ id: m[1]!, label: m[2]! });
  }
  return devices;
}

export const macos: Platform = {
  id: 'macos',

  listDevices() {
    return new Promise<AudioDevice[]>((resolve) => {
      // Listing devices is an "error" as far as ffmpeg is concerned: it prints
      // the list to stderr and exits non-zero. That is the documented way.
      const ff = spawn('ffmpeg', ['-f', 'avfoundation', '-list_devices', 'true', '-i', '']);
      let err = '';
      ff.stderr.on('data', (d) => (err += d.toString()));
      ff.on('close', () => resolve(parseAudioDevices(err)));
      ff.on('error', () => resolve([]));
    });
  },

  recordInput(device) {
    // The leading colon means "no video, audio device N".
    return ['-f', 'avfoundation', '-i', `:${device.id}`];
  },

  copyText(text) {
    return new Promise<void>((resolve, reject) => {
      const p = spawn('pbcopy', { env: UTF8_ENV });
      p.on('error', reject);
      p.on('close', () => resolve());
      p.stdin.write(Buffer.from(text, 'utf8'));
      p.stdin.end();
    });
  },

  notify(message) {
    const safe = message.replace(/["\\]/g, ' ');
    spawn('osascript', ['-e', `display notification "${safe}" with title "Dictate"`], {
      env: UTF8_ENV,
    }).on('error', () => {});
  },

  cue(event) {
    const sound = event === 'start' ? 'Tink' : 'Pop';
    spawn('afplay', [`/System/Library/Sounds/${sound}.aiff`]).on('error', () => {});
  },
};
