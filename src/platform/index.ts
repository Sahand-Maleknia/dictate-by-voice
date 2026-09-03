/**
 * The one seam that makes this tool portable.
 *
 * Everything above this file — how the recording is encoded, when it stops,
 * how the clip is sent to the model, the retry — is identical on every
 * operating system. What is NOT identical is the handful of primitives below:
 * how you enumerate a microphone, how ffmpeg is told to open it, how text
 * reaches the clipboard, and how the user is told something happened.
 *
 * Adding an OS therefore means writing one file that satisfies this interface
 * (see CONTRIBUTING.md), not editing the recorder or the transcriber.
 */

import { platform as osPlatform } from 'node:os';

export interface AudioDevice {
  /**
   * What ffmpeg needs to open this device. A string, not a number, on purpose:
   * macOS/AVFoundation addresses inputs by index (`:0`), Windows/DirectShow by
   * name (`audio=Microphone (Realtek)`). An index-typed API would have to be
   * redesigned the day Windows support lands.
   */
  id: string;
  /** Human-readable name, shown when the CLI lists devices. */
  label: string;
}

export interface Platform {
  readonly id: 'macos' | 'windows' | 'linux';
  /** Every microphone ffmpeg can see, in the order the OS reports them. */
  listDevices(): Promise<AudioDevice[]>;
  /** The ffmpeg input flags for this device, e.g. ['-f','avfoundation','-i',':0']. */
  recordInput(device: AudioDevice): string[];
  /**
   * Put text on the system clipboard.
   *
   * Async because it is a subprocess everywhere. Implementations MUST force a
   * UTF-8 encoding explicitly: the platform clipboard tools default to a
   * legacy codepage when the environment carries no locale (Mac OS Roman on
   * macOS, cp1252 via clip.exe on Windows), which turns any non-Latin
   * transcript into mojibake. This is not theoretical — it shipped.
   */
  copyText(text: string): Promise<void>;
  /** A desktop notification: the only feedback a GUI-launched run can give. */
  notify(message: string): void;
  /** A short sound so start/stop are perceptible with no window on screen. */
  cue(event: 'start' | 'stop'): void;
}

/** The implementation for the machine this is running on. */
export async function currentPlatform(): Promise<Platform> {
  switch (osPlatform()) {
    case 'darwin':
      return (await import('./macos.js')).macos;
    default:
      throw new Error(
        `dictate does not support ${osPlatform()} yet — only macOS today. ` +
          'Adding a platform is one file against the Platform interface; ' +
          'see CONTRIBUTING.md, and please open an issue so the work is not duplicated.',
      );
  }
}
