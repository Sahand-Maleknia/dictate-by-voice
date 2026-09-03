/**
 * Every string the user reads, in one file.
 *
 * The interface language is Persian — this tool is built for Persian speakers
 * first. Code comments, the contributor docs, and the error text that only
 * developers see stay English, so the project is still contributable by
 * someone who does not read Persian.
 *
 * Keeping the strings here (rather than inline) means a future --lang=en is a
 * second object, not a hunt through the codebase.
 */

export const M = {
  help: (stopFile: string, lastClip: string) =>
    [
      'dictate — یک کلید بزن، حرف بزن، پیست کن.',
      '',
      '  dictate                    ضبط؛ برای پایان Enter بزن',
      '  dictate --auto             ضبط؛ وقتی ساکت شوی خودش تمام می‌شود',
      '  dictate --hold             ضبط تا وقتی فایل توقف ساخته شود (برای رابط گرافیکی)',
      '  dictate --again [کلمه‌ها]   تبدیل دوبارهٔ آخرین ضبط؛ می‌توانی کلمه‌هایی که',
      '                             اشتباه نوشته را درست بنویسی',
      '  dictate --list             لیست میکروفون‌ها',
      '  dictate 2                  استفاده از دستگاه شمارهٔ ۲',
      '',
      `فایل توقف: ${stopFile}`,
      `آخرین ضبط: ${lastClip}`,
    ].join('\n'),

  recordingHold: '🎙️  در حال ضبط… برای پایان دوباره کلیک کن.\n',
  recordingAuto: '🎙️  در حال ضبط… حرف بزن؛ وقتی ساکت شوی خودش تمام می‌شود.\n',
  recordingEnter: '🎙️  در حال ضبط… حرف بزن، بعد Enter بزن.\n',

  transcribing: '… در حال تبدیل به متن\n',
  transcriptTop: '\n──────── متن ────────',
  transcriptBottom: '─────────────────────',
  copied: (pasteKey: string) => `✓ در کلیپ‌بورد کپی شد — ${pasteKey} بزن.`,
  copiedBanner: (pasteKey: string) => `متن آماده است — ${pasteKey} بزن`,

  again: '↻ تبدیل دوبارهٔ آخرین ضبط',
  againWithHint: (hint: string) => `↻ تبدیل دوبارهٔ آخرین ضبط، با اصلاح: ${hint}`,

  tooShort: 'ضبط خیلی کوتاه بود — چیزی گرفته نشد.',
  noSpeech: 'صدایی در ضبط نبود — چیزی گفته نشد یا میکروفون قطع بود.',
  nothingHeard: 'چیزی شنیده نشد',
  noPreviousClip: 'ضبط قبلی پیدا نشد — یک بار دیگر ضبط کن.',
  noPreviousClipBanner: 'ضبط قبلی پیدا نشد',

  noDevices: 'میکروفونی پیدا نشد. ffmpeg نصب است و اجازهٔ میکروفون داده شده؟',
  noSuchDevice: (id: string) => `دستگاه صوتی #${id} وجود ندارد. با --list لیست را ببین.`,
  ffmpegMissing: (detail: string) => `ffmpeg اجرا نشد: ${detail} — نصب است؟`,
  ffmpegFailed: (code: number | null, detail: string) =>
    `ffmpeg با کد ${code} خارج شد. ${detail}`,

  missingKey:
    'کلید GOOGLE_GENERATIVE_AI_API_KEY تنظیم نشده. فایل .env.example را به .env کپی کن و کلیدت را از https://aistudio.google.com/apikey بگذار داخلش.',
  noAudio: 'صدایی دریافت نشد.',
  clipTooBig: (mb: string, limitMb: number) =>
    `این ضبط ${mb} مگابایت است و از حد ${limitMb} مگابایت بیشتر است. ضبط کوتاه‌تری بگیر.`,
  emptyTranscript: 'چیزی برای تبدیل پیدا نشد — ضبط ساکت یا خیلی کوتاه بوده.',
  refused: 'مدل این ضبط را قبول نکرد.',
  serviceRefusedBig: (mb: string) =>
    `سرویس این ضبط ${mb} مگابایتی را قبول نکرد — معمولاً به خاطر طولانی بودنش است. ضبطی زیر پنج دقیقه امتحان کن.`,
  serviceBusy: 'سرویس الان شلوغ است. یک دقیقه صبر کن و دوباره امتحان کن.',
  serviceInternal: 'سرویس روی این ضبط به خطای داخلی خورد. دوباره ضبط کن.',

  error: (detail: string) => `✗ dictate: ${detail}`,
  errorBanner: (detail: string) => `خطا: ${detail}`,

  unsupportedPlatform: (os: string) =>
    `dictate هنوز روی ${os} پشتیبانی نمی‌شود. افزودن یک سیستم‌عامل فقط یک فایل است — CONTRIBUTING.md را ببین.`,
} as const;
