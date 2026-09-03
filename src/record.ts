/**
 * Recording and the silence gate. Nothing here is OS-specific: the platform
 * layer supplies the input flags, everything else — the codec, the stop
 * conditions, the analysis — is the same everywhere ffmpeg runs.
 */

import { spawn } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { createInterface } from 'node:readline';
import type { AudioDevice, Platform } from './platform/index.js';

/**
 * Opus at 32 kbps mono — a speech codec at a speech bitrate.
 *
 * This used to be 16-bit PCM WAV, which is 32 kB per second: two minutes of
 * talking exceeded the model's inline-audio ceiling and the clip was rejected
 * before it was ever heard. Opus is ~12x smaller for speech that transcribes
 * identically, which is what turns a long dictation from a guaranteed failure
 * into an ordinary request. Measured: 9 minutes of speech = 2.1 MB.
 */
const AUDIO_BITRATE = '32k';

export interface RecordOptions {
  device: AudioDevice;
  outPath: string;
  maxSeconds: number;
  /** Stop automatically after this much silence, once speech has begun. */
  autoStopSilence?: { seconds: number; minSpeechBefore: number };
  /** Stop when this file appears — how a GUI's second click reaches us. */
  stopFile?: string;
  /** Stop on Enter, when a real terminal is attached. */
  stopOnEnter: boolean;
}

/** Record to an Ogg/Opus file and resolve its path when the recording ends. */
export function record(platform: Platform, opts: RecordOptions): Promise<string> {
  const auto = opts.autoStopSilence;
  const ff = spawn('ffmpeg', [
    '-hide_banner',
    // silencedetect logs at `info`, so auto mode needs that verbosity;
    // otherwise stay quiet. It only analyses — the audio passes through
    // to the file unchanged.
    '-loglevel', auto ? 'info' : 'error',
    ...platform.recordInput(opts.device),
    ...(auto ? ['-af', `silencedetect=noise=-35dB:d=${auto.seconds}`] : []),
    '-ac', '1',
    '-ar', '16000',
    // `voip` is the Opus tuning built for a single close voice, which is
    // exactly what a dictation clip is.
    '-c:a', 'libopus',
    '-b:a', AUDIO_BITRATE,
    '-application', 'voip',
    '-t', String(opts.maxSeconds),
    '-y', opts.outPath,
  ]);

  let ffErr = '';
  platform.cue('start'); // audible "recording started", vital with no terminal

  return new Promise((resolve, reject) => {
    let stopped = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      // 'q' tells ffmpeg to finish and flush a valid file. Killing the process
      // instead leaves an Ogg stream with no trailer — and on Windows there is
      // no graceful signal at all, so this is the only portable stop.
      ff.stdin.write('q');
    };

    if (auto) {
      ff.stderr.on('data', (d) => {
        ffErr += d.toString();
        const m = /silence_start:\s*([\d.]+)/.exec(d.toString());
        if (m && Number(m[1]) >= auto.minSpeechBefore) stop();
      });
    } else {
      ff.stderr.on('data', (d) => (ffErr += d.toString()));
    }

    if (opts.stopFile) {
      const file = opts.stopFile;
      poll = setInterval(() => {
        if (existsSync(file)) {
          try { unlinkSync(file); } catch { /* already gone */ }
          stop();
        }
      }, 150);
    }

    let rl: ReturnType<typeof createInterface> | undefined;
    if (opts.stopOnEnter && process.stdin.isTTY) {
      rl = createInterface({ input: process.stdin });
      rl.once('line', stop);
    }

    ff.on('error', (e) => {
      if (poll) clearInterval(poll);
      rl?.close();
      reject(new Error(`ffmpeg failed to start: ${e.message}. Is ffmpeg installed?`));
    });
    ff.on('close', (code) => {
      if (poll) clearInterval(poll);
      rl?.close();
      platform.cue('stop');
      // ffmpeg exits 255 when we send 'q' mid-stream; that's a normal stop.
      if (code !== 0 && code !== 255) {
        reject(new Error(`ffmpeg exited ${code}. ${ffErr.trim()}`));
        return;
      }
      resolve(opts.outPath);
    });
  });
}

/**
 * Does this clip contain speech at all?
 *
 * Given silence the model does not answer "silence" — it writes a fluent,
 * invented note in whatever persona the system prompt implies, and that lands
 * on your clipboard looking exactly like something you said. The guard has to
 * be deterministic and outside the model: an empty room measures about
 * -32 dB peak / -50 dB mean, actual speech about -0 / -20.
 *
 * Do NOT try to solve this in the prompt instead. "If there is no intelligible
 * speech, output nothing" makes the model refuse perfectly good long clips.
 */
export function hasAudibleSpeech(clipPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ff = spawn('ffmpeg', ['-hide_banner', '-i', clipPath, '-af', 'volumedetect', '-f', 'null', '-']);
    let out = '';
    ff.stderr.on('data', (d) => (out += d.toString()));
    ff.on('error', () => resolve(true)); // can't measure → don't block the user
    ff.on('close', () => {
      const peak = Number(/max_volume:\s*(-?[\d.]+) dB/.exec(out)?.[1]);
      const mean = Number(/mean_volume:\s*(-?[\d.]+) dB/.exec(out)?.[1]);
      if (Number.isNaN(peak) || Number.isNaN(mean)) return resolve(true);
      resolve(!(peak < -30 && mean < -45));
    });
  });
}
