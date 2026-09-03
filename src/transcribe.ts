/**
 * Audio → text, in the language it was spoken.
 *
 * The clip goes straight to Gemini, which accepts audio natively, so there is
 * no separate speech service in the path and nothing is stored anywhere but
 * your own machine.
 *
 * Most of this file is scar tissue. Each of the four non-obvious settings
 * below is here because its absence produced a specific, reproducible failure
 * — they are documented so nobody "simplifies" them back out.
 */

import 'dotenv/config';
import { google, type GoogleLanguageModelOptions } from '@ai-sdk/google';
import { generateText } from 'ai';
import { M } from './messages.js';

/**
 * Model tiers, best first.
 *
 * Audio is the one call that fails per-MODEL rather than per-request: the same
 * clip a Flash model refuses with a bare 500 goes through on another tier. So
 * a 5xx walks down this chain instead of surfacing — a transcript from a
 * cheaper model beats no transcript. Lite tiers mis-hear Persian, which is why
 * the good model is tried first rather than last.
 */
const MODEL_CHAIN = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];

const SYSTEM = `You transcribe spoken voice notes.

Rules:
- Write exactly what was said, in the language it was said in. Persian speech stays Persian; do not translate.
- Persian speech is conversational (محاوره‌ای) — keep it that way. Do not formalise it into written Persian.
- Keep technical and foreign terms in the form they were spoken (e.g. "credit score", "API", "Amex") rather than translating them.
- Clean up only filler sounds and false starts. Never summarise, never add, never explain.
- Never write timestamps, speaker labels, or line numbers.
- Output the transcript alone: no preamble, no quotes, no commentary, no notes about the audio or about these rules.`;

/**
 * Hard ceiling on one clip. Gemini starts refusing big inline audio with a
 * generic 500 well before any documented limit, so this is empirical: a ~5
 * minute note at speech bitrate transcribes fine, an 8 minute one is refused.
 * At 32 kbps Opus this is far more speech than anyone dictates in one go.
 */
export const MAX_CLIP_BYTES = 4_000_000;

export interface TranscribeOptions {
  /**
   * Corrections for a second pass: the words the previous attempt got wrong,
   * in their right form (names, brands, jargon). Steering beats re-rolling —
   * the model gets a spelling it could not have guessed from the audio.
   */
  hint?: string;
  /**
   * This clip has been transcribed before and the result was wrong.
   *
   * The first pass runs at temperature 0, which is deterministic: re-sending
   * an identical request returns identical text, so a plain "try again" would
   * hand back the same mistake. With no hint to steer it, a retry only differs
   * if it samples differently.
   */
  retry?: boolean;
}

/**
 * `result.text` concatenates every text part — and on Gemini 3 the thought
 * summary arrives as an ordinary text part rather than a reasoning part. When
 * that happens the model's internal monologue is glued onto the front of the
 * transcript and lands on your clipboard. With thinking minimal there is
 * normally one part and this returns `text` untouched; it earns its keep on
 * the runs where the model narrates itself anyway.
 */
function spokenTextOnly(
  content: ReadonlyArray<{ type: string; text?: string }>,
  text: string,
): string {
  const parts = content.flatMap((p) => (p.type === 'text' && p.text ? [p.text] : []));
  return parts.length > 1 ? parts[parts.length - 1]! : text;
}

/**
 * Dictation is not a reasoning task, and thinking is precisely where this call
 * goes wrong (see spokenTextOnly). Gemini 3 takes discrete levels, 2.5 takes a
 * token budget.
 */
function thinking(model: string): GoogleLanguageModelOptions['thinkingConfig'] {
  return model.startsWith('gemini-3') ? { thinkingLevel: 'minimal' } : { thinkingBudget: 0 };
}

/** A 5xx — the provider's problem, not this request's, so try another model. */
function isProviderOutage(err: Error): boolean {
  return /internal error|high demand|overloaded|unavailable|5\d\d/i.test(err.message);
}

/**
 * Turn a provider failure into something the person holding the microphone can
 * act on. The raw text ("Failed after 3 attempts…") says nothing about what to
 * do, and the two common causes need opposite responses: an oversized clip
 * fails again on every retry, a capacity blip clears on its own in a minute.
 */
function describeFailure(err: Error, megabytes: number): string {
  const raw = err.message;
  const overloaded = /high demand|overloaded|unavailable|503/i.test(raw);
  const internal = /internal error|500/i.test(raw);
  // Google answers oversized inline audio with a generic 500 rather than a
  // size error, so length is the first thing to suspect on a big clip.
  if ((internal || overloaded) && megabytes > 1.5) {
    return M.serviceRefusedBig(megabytes.toFixed(1));
  }
  if (overloaded) return M.serviceBusy;
  if (internal) return M.serviceInternal;
  return raw;
}

/** Transcribe a base64-encoded audio clip to text in its original language. */
export async function transcribeAudio(
  audioBase64: string,
  mediaType: string,
  options: TranscribeOptions = {},
): Promise<string> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error(M.missingKey);
  }
  if (!audioBase64) throw new Error(M.noAudio);

  const bytes = Math.floor((audioBase64.length * 3) / 4);
  const megabytes = bytes / 1e6;
  if (bytes > MAX_CLIP_BYTES) {
    throw new Error(M.clipTooBig(megabytes.toFixed(1), MAX_CLIP_BYTES / 1e6));
  }

  const hint = options.hint?.trim();
  const user = hint
    ? `Transcribe this voice note.\n\nAn earlier attempt at this same clip got some words wrong. These are the correct forms — use them wherever they were spoken, and keep everything else exactly as heard:\n${hint}`
    : 'Transcribe this voice note.';

  let lastError: Error | undefined;

  for (const model of MODEL_CHAIN) {
    try {
      const { text, content, finishReason } = await generateText({
        model: google(model),
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: user },
              { type: 'file', data: audioBase64, mediaType },
            ],
          },
        ],
        maxOutputTokens: 16096,
        // Dictation has one right answer. Sampling is what lets the model
        // decide to introduce the transcript instead of just giving it — so 0
        // is the default, and only an unguided retry (where determinism would
        // simply repeat the mistake) raises it.
        temperature: options.retry && !hint ? 0.5 : 0,
        providerOptions: {
          google: { thinkingConfig: thinking(model) } satisfies GoogleLanguageModelOptions,
        },
        // One retry, not the default three: the failure this chain exists for
        // is a model-level 500 that repeats identically, so extra attempts only
        // add seconds before the fallback that actually works.
        maxRetries: 1,
      });

      if (finishReason === 'content-filter') throw new Error(M.refused);
      const transcript = spokenTextOnly(content, text).trim();
      if (!transcript) {
        throw new Error(M.emptyTranscript);
      }
      return transcript;
    } catch (err) {
      lastError = err as Error;
      // Only a provider-side failure is worth trying elsewhere. A refusal, a
      // truncation, or a bad clip fails identically on every model.
      if (!isProviderOutage(lastError)) throw lastError;
    }
  }

  throw new Error(describeFailure(lastError as Error, megabytes));
}
