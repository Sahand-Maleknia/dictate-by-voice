/**
 * The Windows platform cannot be run here, but its one piece of real logic —
 * parsing ffmpeg's device list — is a pure function, so it is tested against
 * captured output from both ffmpeg generations.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseDshowDevices } from '../src/platform/windows.js';

const MODERN = `
[dshow @ 000001c8] "Integrated Camera" (video)
[dshow @ 000001c8]   Alternative name "@device_pnp_\\\\?\\usb#vid_04f2"
[dshow @ 000001c8] "Microphone (Realtek(R) Audio)" (audio)
[dshow @ 000001c8]   Alternative name "@device_cm_{33D9A762}\\wave_{A1B2}"
[dshow @ 000001c8] "Headset (Jabra Evolve)" (audio)
[dshow @ 000001c8]   Alternative name "@device_cm_{33D9A762}\\wave_{C3D4}"
`;

const LEGACY = `
[dshow @ 0000021f] DirectShow video devices (some may be both video and audio devices)
[dshow @ 0000021f]  "Integrated Camera"
[dshow @ 0000021f]     Alternative name "@device_pnp_\\\\?\\usb#vid_04f2"
[dshow @ 0000021f] DirectShow audio devices
[dshow @ 0000021f]  "Microphone (Realtek(R) Audio)"
[dshow @ 0000021f]     Alternative name "@device_cm_{33D9A762}\\wave_{A1B2}"
`;

test('modern ffmpeg: audio only, alternative name wins as the id', () => {
  const devices = parseDshowDevices(MODERN);
  assert.equal(devices.length, 2);
  assert.equal(devices[0]!.label, 'Microphone (Realtek(R) Audio)');
  assert.equal(devices[0]!.id, '@device_cm_{33D9A762}\\wave_{A1B2}');
  assert.equal(devices[1]!.label, 'Headset (Jabra Evolve)');
  // The camera must not appear: recording from it would fail with no clue why.
  assert.ok(!devices.some((d) => /camera/i.test(d.label)));
});

test('legacy ffmpeg: the section header decides what is audio', () => {
  const devices = parseDshowDevices(LEGACY);
  assert.equal(devices.length, 1);
  assert.equal(devices[0]!.label, 'Microphone (Realtek(R) Audio)');
  assert.equal(devices[0]!.id, '@device_cm_{33D9A762}\\wave_{A1B2}');
});

test('a device with no alternative name falls back to its friendly name', () => {
  const devices = parseDshowDevices('[dshow @ 1] "Line In" (audio)');
  assert.deepEqual(devices, [{ id: 'Line In', label: 'Line In' }]);
});

test('no devices at all is empty, not a crash', () => {
  assert.deepEqual(parseDshowDevices('ffmpeg version 7.1\n'), []);
});
