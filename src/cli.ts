#!/usr/bin/env node
/**
 * dictate — press a key, talk, paste.
 *
 *   dictate                 # Enter to stop
 *   dictate --auto          # stops by itself when you go quiet
 *   dictate --hold          # stops when a UI drops the stop-file (hotkey mode)
 *   dictate --list          # show the microphones ffmpeg can see
 *   dictate 2               # force input device #2
 *   dictate --again         # re-transcribe the last clip (it came back wrong)
 *   dictate --again "Siavash, Careerpreneur"   # …telling it the right words
 *
 * The audio is recorded locally, sent once to Gemini, and then kept only as
 * the single most recent clip so `--again` can re-run it. Set
 * DICTATE_KEEP_LAST=0 to delete it the moment it is transcribed.
 */

import { copyFile, readFile, rename, unlink } from 'node:fs/promises';
import { existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { currentPlatform, type AudioDevice, type Platform } from './platform/index.js';
import { hasAudibleSpeech, record } from './record.js';
import { transcribeAudio } from './transcribe.js';
import { LAST_CLIP, STOP_FILE } from './paths.js';

const args = process.argv.slice(2);
const has = (...names: string[]) => names.some((n) => args.includes(n));

const HELP = has('--help', '-h');
const LIST = has('--list');
/** Stops on silence and reports by notification — no keyboard needed. */
const AUTO = has('--auto');
/** Records until a stop-file appears, so a UI can start on one click and stop on the next. */
const HOLD = has('--hold');
/** Re-transcribe the previous clip instead of recording a new one. */
const AGAIN = has('--again', '--retry');
/** Anything that is not a flag and not the device index is the correction hint. */
const HINT = args.filter((a) => !a.startsWith('-') && !/^\d+$/.test(a)).join(' ').trim();

/** Launched by a GUI: there is no terminal, so speak through notifications. */
const HEADLESS = AUTO || HOLD || (AGAIN && !process.stdout.isTTY);
const KEEP_LAST = process.env.DICTATE_KEEP_LAST !== '0';
const MAX_SECONDS = Number(process.env.DICTATE_MAX_SECONDS) || 600;
/** How long a pause ends a recording in auto mode. */
const SILENCE_SECONDS = 1.4;
/** Ignore silence in the first moment — the pause before you start talking. */
const MIN_SPEECH_BEFORE_STOP = 0.8;

function chooseDevice(devices: AudioDevice[]): AudioDevice {
  const requested = args.find((a) => /^\d+$/.test(a)) ?? process.env.DICTATE_MIC;
  if (requested) {
    const found = devices.find((d) => d.id === requested);
    if (!found) throw new Error(`No audio device #${requested}. Run with --list to see them.`);
    return found;
  }
  // Prefer a real microphone over the built-in one when both are present:
  // matching by name survives devices being plugged in, which renumbers them.
  const external = devices.find((d) => /r[øo]de|podmic|yeti|shure|usb/i.test(d.label));
  const builtin = devices.find((d) => /built-?in|macbook.*microphone/i.test(d.label));
  const device = external ?? builtin ?? devices[0];
  if (!device) throw new Error('No microphones found. Is ffmpeg installed and mic permission granted?');
  return device;
}

/** Keep this clip as *the* last clip, so `--again` can re-send it. */
async function parkClip(clipPath: string): Promise<void> {
  if (!KEEP_LAST) {
    await unlink(clipPath).catch(() => {});
    return;
  }
  try {
    await rename(clipPath, LAST_CLIP);
  } catch {
    // rename fails across filesystems; copy, then drop the original.
    await copyFile(clipPath, LAST_CLIP).catch(() => {});
    await unlink(clipPath).catch(() => {});
  }
}

async function transcribeClip(platform: Platform, clipPath: string, hint: string): Promise<void> {
  const audio = await readFile(clipPath);
  // ~0.3 s of Opus, including the Ogg header. Only a click-click with nothing
  // in between lands under this; a longer clip that happens to be silent is
  // caught by hasAudibleSpeech, not by its size (Opus encodes silence down to
  // almost nothing, so bytes alone cannot tell them apart).
  if (audio.byteLength < 1200) {
    return fail(platform, 'That was too short — nothing was captured.', 'Nothing heard');
  }
  if (!(await hasAudibleSpeech(clipPath))) {
    return fail(platform, 'No sound in the recording — nothing was said, or the mic was muted.', 'Nothing heard');
  }

  process.stdout.write('… transcribing\n');
  const text = await transcribeAudio(audio.toString('base64'), 'audio/ogg', {
    hint: hint || undefined,
    retry: AGAIN,
  });

  await platform.copyText(text);
  console.log('\n──────── transcript ────────');
  console.log(text);
  console.log('────────────────────────────');
  console.log('✓ copied to the clipboard — paste it.');
  if (HEADLESS) platform.notify('Text ready — paste it');
}

/** Report a soft failure: a banner with no terminal, an exception with one. */
function fail(platform: Platform, message: string, banner: string): void {
  if (!HEADLESS) throw new Error(message);
  platform.notify(banner);
  console.log(`✗ ${message}`);
}

async function main(): Promise<void> {
  if (HELP) {
    console.log(
      [
        'dictate — press a key, talk, paste.',
        '',
        '  dictate                    record, Enter to stop',
        '  dictate --auto             record, stops when you go quiet',
        '  dictate --hold             record until the stop-file appears (for a GUI)',
        '  dictate --again [words]    re-transcribe the last clip, optionally',
        '                             telling it the words it got wrong',
        '  dictate --list             list input devices',
        '  dictate 2                  use device #2',
        '',
        `stop-file: ${STOP_FILE}`,
        `last clip: ${LAST_CLIP}`,
      ].join('\n'),
    );
    return;
  }

  const platform = await currentPlatform();

  if (LIST) {
    for (const d of await platform.listDevices()) console.log(`  [${d.id}] ${d.label}`);
    return;
  }

  if (AGAIN) {
    if (!existsSync(LAST_CLIP)) {
      return fail(platform, 'No previous recording found — record one first.', 'Nothing to retry');
    }
    console.log(HINT ? `↻ re-transcribing the last clip, correcting: ${HINT}` : '↻ re-transcribing the last clip');
    // The clip is deliberately left in place: a third attempt with a better
    // hint is exactly what you want after a second one that still missed a word.
    await transcribeClip(platform, LAST_CLIP, HINT);
    return;
  }

  const devices = await platform.listDevices();
  const device = chooseDevice(devices);
  console.log(`▶︎ ${device.label}`);

  // Clear a stale stop-file so a leftover click cannot end the new recording early.
  if (HOLD && existsSync(STOP_FILE)) {
    try { unlinkSync(STOP_FILE); } catch { /* fine */ }
  }

  process.stdout.write(
    HOLD ? '🎙️  recording… click again to stop.\n'
      : AUTO ? '🎙️  recording… it stops when you go quiet.\n'
        : '🎙️  recording… talk, then press Enter.\n',
  );

  const clipPath = await record(platform, {
    device,
    outPath: join(tmpdir(), `dictate-${process.pid}.ogg`),
    maxSeconds: MAX_SECONDS,
    autoStopSilence: AUTO ? { seconds: SILENCE_SECONDS, minSpeechBefore: MIN_SPEECH_BEFORE_STOP } : undefined,
    stopFile: HOLD ? STOP_FILE : undefined,
    stopOnEnter: !HOLD && !AUTO,
  });

  try {
    await transcribeClip(platform, clipPath, '');
  } finally {
    await parkClip(clipPath);
  }
}

main().catch(async (err: unknown) => {
  const message = (err as Error).message;
  console.error(`✗ dictate: ${message}`);
  // Carry the reason into the banner: with no terminal attached this is the
  // only thing the user gets to see, and "error" alone is undiagnosable.
  if (HEADLESS) {
    await currentPlatform()
      .then((p) => p.notify(`Error: ${message.slice(0, 140)}`))
      .catch(() => {});
  }
  process.exit(1);
});
