# dictate 🎙️

Press a key, talk, paste. A small local-first dictation tool for the desktop —
built for **Persian** first, and good at everything else.

*(نسخهٔ فارسی در [پایین همین صفحه](#فارسی))*

It records from your microphone, sends the clip once to Google's Gemini, and
puts the text on your clipboard. No subscription, no dictation service in the
middle, no background daemon uploading anything: your own API key, your own
machine.

```
Ctrl+Alt+D   start / stop recording  →  the text is on your clipboard
Ctrl+Alt+R   that came out wrong — transcribe the same audio again
```

> **Status:** built and tested on **macOS**. The **Windows** code is written but
> has never run on an actual Windows machine — if you have one, try it and open
> an issue. Linux is not written yet; [CONTRIBUTING.md](CONTRIBUTING.md) explains
> how to add it (it is one file).

## Why it exists

For dictating long, conversational **Persian** — the case most dictation tools
handle badly. Persian speech here stays Persian and stays conversational
(محاوره‌ای): it is not translated, and it is not formalised into written Persian.
English terms spoken inside Persian come through as spoken.

The interface is in Persian, because that is who this is for. The code, the
comments and the contributor docs are in English, so the project is still
contributable by someone who does not read Persian — every user-facing string
lives in one file, [`src/messages.ts`](src/messages.ts).

## Requirements

- [Node.js](https://nodejs.org) 20+ and ffmpeg (`brew install ffmpeg`)
- A free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
- [Hammerspoon](https://www.hammerspoon.org) — only for the hotkeys and the floating card (Windows: AutoHotkey v2)

## Install

```bash
git clone https://github.com/siavash-smf/dictate.git
cd dictate
npm install
cp .env.example .env      # paste your key into it
npm run dictate           # talk, then press Enter
```

The first run asks macOS for microphone permission, for whichever terminal you
launched it from.

## Use

```bash
npm run dictate                  # record, Enter to stop
npm run dictate -- --auto        # record, stops by itself when you go quiet
npm run dictate -- --list        # which microphones ffmpeg can see
npm run dictate -- 2             # force input device #2

npm run dictate -- --again                  # it got it wrong — try again
npm run dictate -- --again "سیاوش، صدف"     # …and here are the right spellings
```

### `--again` is the interesting one

Getting a name wrong should not cost you the recording. The last clip is kept,
so `--again` re-sends that same audio instead of making you say it all again.

The hint matters more than the retry itself. The first pass runs at
`temperature: 0`, which is deterministic — an unguided second attempt returns
the *identical* text. So: with no hint the retry samples differently; with a
hint it stays deterministic and simply uses the spellings you gave it. Names,
brands and jargon are exactly what a model cannot guess from audio.

## Hotkeys and the floating card (optional)

**macOS —** a Hammerspoon script: a menu-bar microphone, a floating card with a
level meter and a timer, and the two hotkeys above.

1. Install [Hammerspoon](https://www.hammerspoon.org) and grant it Accessibility permission.
2. Copy `ui/macos-hammerspoon/dictate.lua` into `~/.hammerspoon/init.lua`.
3. Point `REPO` at the top of that file to where you cloned this.
4. Reload the config.

The hotkeys bind to the **physical** D and R keys, so they keep working under a
Persian (or any non-Latin) keyboard layout.

**Windows —** `ui/windows-autohotkey/dictate.ahk` with AutoHotkey v2. Set `REPO`
and run it. Untested.

## Privacy

The audio goes from your machine to the Gemini API and nowhere else. Exactly one
clip is kept on disk — the most recent, at `/tmp/dictate-last.ogg` — so
`--again` has something to re-send, and every recording overwrites it. Set
`DICTATE_KEEP_LAST=0` to delete it the moment it is transcribed (which turns
`--again` off).

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | — | required |
| `DICTATE_MIC` | auto | force an input device id |
| `DICTATE_MAX_SECONDS` | `600` | hard cap on one recording |
| `DICTATE_KEEP_LAST` | `1` | `0` deletes the audio immediately |
| `DICTATE_STOP_FILE` | `/tmp/dictate-hold.stop` | how a GUI ends a `--hold` recording |
| `DICTATE_LAST_CLIP` | `/tmp/dictate-last.ogg` | where the retry clip lives |

## How it works

```
ffmpeg (Opus 32 kbps mono)  →  silence gate  →  Gemini  →  clipboard
```

Four decisions in that line are load-bearing, and each is commented in the
source with the failure that produced it:

- **Opus, not WAV.** WAV is 32 kB/s, so two minutes of talking exceeded the
  model's inline-audio ceiling and the clip was rejected before it was ever heard.
- **Thinking set to minimal.** On Gemini 3 the thought summary arrives as an
  ordinary *text* part, so the SDK's `.text` glues the model's monologue onto the
  front of your transcript — and onto your clipboard.
- **A deterministic silence gate.** Given silence the model does not say
  "silence": it invents a fluent, plausible note. The guard is ffmpeg
  `volumedetect`, not a prompt rule — the prompt version makes the model refuse
  perfectly good long clips.
- **Explicit UTF-8 for the clipboard.** `pbcopy` takes its encoding from
  `LANG`/`LC_CTYPE` and falls back to *Mac OS Roman* when a GUI launcher hands
  the process a bare environment. That is how a clean Persian transcript reaches
  the clipboard as `ÿ≥ŸÑÿßŸÖ`.

## Contributing

The most useful thing right now is running the Windows code on a real Windows
machine. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT © Siavash Samimifard

---

# فارسی

یک کلید بزن، حرف بزن، پیست کن. ابزار کوچکی برای تبدیل صدا به متن روی دسکتاپ —
ساخته‌شده برای **فارسی**، و روی زبان‌های دیگر هم خوب کار می‌کند.

از میکروفونت ضبط می‌کند، فایل را یک بار به Gemini می‌فرستد، و متن را روی
کلیپ‌بورد می‌گذارد. نه اشتراک ماهانه، نه سرویس دیکتهٔ واسط، نه برنامه‌ای که
پس‌زمینه چیزی آپلود کند: کلید API خودت، کامپیوتر خودت.

```
Ctrl+Alt+D   شروع / پایان ضبط  →  متن روی کلیپ‌بورد است
Ctrl+Alt+R   اشتباه نوشت؟ همان صدا را دوباره تبدیل کن
```

> **وضعیت:** روی **macOS** ساخته و تست شده. کد **ویندوز** نوشته شده ولی هنوز روی
> ویندوز واقعی اجرا نشده — اگر ویندوز داری تستش کن و issue بزن. لینوکس هنوز
> نوشته نشده و [CONTRIBUTING.md](CONTRIBUTING.md) می‌گوید چطور اضافه‌اش کنی
> (یک فایل است).

## چرا ساخته شد

برای دیکتهٔ فارسیِ طولانی و محاوره‌ای — همان کاری که بیشتر ابزارهای موجود بد
انجامش می‌دهند. فارسی اینجا فارسی می‌ماند و محاوره‌ای می‌ماند: نه ترجمه
می‌شود، نه به فارسی کتابی تبدیل. اصطلاح‌های انگلیسی داخل حرف فارسی هم همان‌طور
که گفته شده‌اند نوشته می‌شوند.

رابط کاربری فارسی است، چون مخاطبش فارسی‌زبان است. کد، کامنت‌ها و مستندات
مشارکت انگلیسی‌اند تا کسی که فارسی بلد نیست هم بتواند contribute کند — همهٔ
متن‌هایی که کاربر می‌بیند در یک فایل جمع شده: [`src/messages.ts`](src/messages.ts).

## پیش‌نیازها

- [Node.js](https://nodejs.org) نسخهٔ ۲۰ به بالا و ffmpeg (`brew install ffmpeg`)
- یک کلید رایگان Gemini از [Google AI Studio](https://aistudio.google.com/apikey)
- [Hammerspoon](https://www.hammerspoon.org) — فقط برای هات‌کی و کارت شناور (ویندوز: AutoHotkey v2)

## نصب

```bash
git clone https://github.com/siavash-smf/dictate.git
cd dictate
npm install
cp .env.example .env      # کلیدت را داخلش بگذار
npm run dictate           # حرف بزن، بعد Enter بزن
```

اولین اجرا از macOS اجازهٔ میکروفون می‌خواهد، برای همان ترمینالی که از آن اجرا
کرده‌ای.

## استفاده

```bash
npm run dictate                  # ضبط، Enter برای پایان
npm run dictate -- --auto        # ضبط؛ وقتی ساکت شوی خودش تمام می‌شود
npm run dictate -- --list        # لیست میکروفون‌ها
npm run dictate -- 2             # استفاده از دستگاه شمارهٔ ۲

npm run dictate -- --again                  # اشتباه نوشت — دوباره امتحان کن
npm run dictate -- --again "سیاوش، صدف"     # …و املای درست را هم بده
```

### `--again` بخش جالب ماجراست

اشتباه نوشتن یک اسم نباید به قیمت از دست دادن کل ضبط تمام شود. آخرین فایل صدا
نگه داشته می‌شود، پس `--again` همان صدا را دوباره می‌فرستد و لازم نیست دوباره
حرف بزنی.

راهنما دادن از خودِ retry مهم‌تر است. پاس اول با `temperature: 0` اجرا می‌شود،
یعنی قطعی است — تلاش دوم بدون راهنما **دقیقاً همان متن** را برمی‌گرداند. پس
بدون راهنما، retry با نمونه‌برداری متفاوت اجرا می‌شود؛ با راهنما قطعی می‌ماند و
صرفاً املایی را که داده‌ای رعایت می‌کند. اسم‌ها، برندها و اصطلاح‌ها دقیقاً همان
چیزهایی هستند که مدل از روی صدا نمی‌تواند حدس بزند.

## هات‌کی و کارت شناور (اختیاری)

**macOS —** یک اسکریپت Hammerspoon: آیکن میکروفون در نوار منو، یک کارت شناور با
نمایشگر صدا و تایمر، و دو هات‌کی بالا.

۱. [Hammerspoon](https://www.hammerspoon.org) را نصب کن و به آن دسترسی Accessibility بده.
۲. `ui/macos-hammerspoon/dictate.lua` را داخل `~/.hammerspoon/init.lua` کپی کن.
۳. مقدار `REPO` در بالای فایل را به مسیر کلون‌شده تغییر بده.
۴. کانفیگ را reload کن.

هات‌کی‌ها به **کلید فیزیکی** D و R وصل‌اند، پس با چیدمان کیبورد فارسی هم کار
می‌کنند.

**ویندوز —** فایل `ui/windows-autohotkey/dictate.ahk` با AutoHotkey v2. مقدار
`REPO` را ست کن و اجرایش کن. هنوز تست نشده.

## حریم خصوصی

صدا از کامپیوتر تو مستقیم به Gemini می‌رود و جای دیگری نه. دقیقاً **یک** فایل
صوتی روی دیسک می‌ماند — آخرین ضبط، در `/tmp/dictate-last.ogg` — تا `--again`
چیزی برای فرستادن داشته باشد، و هر ضبط جدید رویش می‌نویسد. با
`DICTATE_KEEP_LAST=0` صدا بلافاصله بعد از تبدیل پاک می‌شود (و `--again` غیرفعال).

## تنظیمات

| متغیر | پیش‌فرض | معنی |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | — | الزامی |
| `DICTATE_MIC` | خودکار | انتخاب دستی دستگاه ورودی |
| `DICTATE_MAX_SECONDS` | `600` | سقف مدت یک ضبط |
| `DICTATE_KEEP_LAST` | `1` | `0` یعنی صدا فوراً پاک شود |
| `DICTATE_STOP_FILE` | `/tmp/dictate-hold.stop` | رابط گرافیکی با این فایل ضبط را تمام می‌کند |
| `DICTATE_LAST_CLIP` | `/tmp/dictate-last.ogg` | محل فایل retry |

## چطور کار می‌کند

```
ffmpeg (اوپوس ۳۲k مونو)  →  گیت سکوت  →  Gemini  →  کلیپ‌بورد
```

چهار تصمیم در این مسیر حیاتی‌اند و هرکدام در سورس با همان خرابی‌ای که تولیدش
کرده کامنت شده‌اند:

- **اوپوس، نه WAV.** فرمت WAV ثانیه‌ای ۳۲ کیلوبایت است؛ دو دقیقه حرف زدن از سقف
  صوت مدل رد می‌شد و کلیپ قبل از اینکه اصلاً شنیده شود رد می‌شد.
- **thinking روی حداقل.** روی Gemini 3 خلاصهٔ فکر مدل به‌صورت یک بخش *متنی* عادی
  برمی‌گردد، پس `.text` در SDK مونولوگ داخلی مدل را می‌چسباند به اول متن — و به
  کلیپ‌بورد تو.
- **گیت سکوتِ قطعی.** مدل در برابر سکوت نمی‌گوید «سکوت»؛ یک یادداشت روان و
  کاملاً ساختگی می‌نویسد. محافظ باید `volumedetect` در ffmpeg باشد نه یک قانون در
  پرامپت — نسخهٔ پرامپتی باعث می‌شود مدل کلیپ‌های طولانیِ کاملاً سالم را رد کند.
- **UTF-8 صریح برای کلیپ‌بورد.** `pbcopy` انکودینگ را از `LANG`/`LC_CTYPE`
  می‌خواند و وقتی یک لانچر گرافیکی محیط خالی پاس می‌دهد به *Mac OS Roman*
  برمی‌گردد. این‌طوری یک متن فارسی سالم به شکل `ÿ≥ŸÑÿßŸÖ` روی کلیپ‌بورد می‌نشیند.

## مشارکت

مفیدترین کاری که الان می‌شود کرد، اجرای کد ویندوز روی یک ویندوز واقعی است.
[CONTRIBUTING.md](CONTRIBUTING.md) را ببین.

## لایسنس

MIT © سیاوش صمیمی‌فرد
