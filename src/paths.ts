/**
 * Fixed, predictable file locations shared with the GUI layer.
 *
 * These deliberately do NOT use os.tmpdir() on macOS and Linux: there it
 * resolves to a private per-user path (/var/folders/…) that an external UI
 * script — a Hammerspoon config, an AutoHotkey script — has no way to guess.
 * A hard-coded /tmp path is the contract between the recorder and whatever is
 * driving it. Windows has no /tmp, so there the private temp dir is the
 * convention and %TEMP% is what the UI layer must expand.
 */

import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = process.platform === 'win32' ? tmpdir() : '/tmp';

/** The GUI drops this file to end a `--hold` recording. */
export const STOP_FILE = process.env.DICTATE_STOP_FILE || join(dir, 'dictate-hold.stop');

/**
 * The most recent clip, kept so `--again` has something to re-send. Exactly one
 * file, overwritten by every recording; DICTATE_KEEP_LAST=0 opts out.
 */
export const LAST_CLIP = process.env.DICTATE_LAST_CLIP || join(dir, 'dictate-last.ogg');
