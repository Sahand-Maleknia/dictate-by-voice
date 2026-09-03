# dictate 🎙️

یک کلید بزن، حرف بزن، پیست کن. ابزار کوچکی برای تبدیل صدا به متن روی دسکتاپ —
ساخته‌شده برای **فارسی**، و روی زبان‌های دیگر هم خوب کار می‌کند.

از میکروفونت ضبط می‌کند، فایل را یک بار به Gemini می‌فرستد، و متن را روی
کلیپ‌بورد می‌گذارد. نه اشتراک ماهانه، نه سرویس دیکتهٔ واسط، نه سرویسی که
پس‌زمینه چیزی آپلود کند: کلید API خودت، کامپیوتر خودت.

```
Ctrl+Alt+D   شروع / پایان ضبط  →  متن روی کلیپ‌بورد است
Ctrl+Alt+R   اشتباه نوشت؟ همان صدا را دوباره تبدیل کن
```

> **وضعیت:** روی **macOS** ساخته و تست شده. کد **Windows** نوشته شده ولی هنوز
> روی ویندوز واقعی اجرا نشده — اگر ویندوز داری، تستش کن و issue بزن.
> لینوکس هنوز نوشته نشده و [CONTRIBUTING.md](CONTRIBUTING.md) می‌گوید چطور
> اضافه‌اش کنی (یک فایل است).

## چرا ساخته شد

برای دیکتهٔ فارسیِ طولانی و محاوره‌ای — همان چیزی که بیشتر ابزارهای موجود بد
انجامش می‌دهند. فارسی اینجا فارسی می‌ماند و محاوره‌ای می‌ماند: نه ترجمه
می‌شود، نه به فارسی کتابی تبدیل. اصطلاح‌های انگلیسی داخل حرف فارسی هم همان‌طور
که گفته شده‌اند نوشته می‌شوند.

## پیش‌نیازها

- [Node.js](https://nodejs.org) نسخهٔ ۲۰ به بالا و ffmpeg (`brew install ffmpeg`)
- یک کلید رایگان Gemini از [Google AI Studio](https://aistudio.google.com/apikey)
- [Hammerspoon](https://www.hammerspoon.org) — فقط اگر هات‌کی و پنجرهٔ شناور را می‌خواهی (روی ویندوز: AutoHotkey v2)

## نصب

```bash
git clone https://github.com/siavash-smf/dictate.git
cd dictate
npm install
cp .env.example .env      # کلیدت را داخلش بگذار
npm run dictate           # حرف بزن، Enter بزن
```

اولین اجرا از macOS اجازهٔ میکروفون می‌خواهد، برای همان ترمینالی که از آن
اجرا کرده‌ای.

## استفاده

```bash
npm run dictate                  # ضبط، Enter برای پایان
npm run dictate -- --auto        # ضبط؛ وقتی ساکت شوی خودش تمام می‌شود
npm run dictate -- --list        # لیست میکروفون‌ها
npm run dictate -- 2             # استفاده از دستگاه شمارهٔ ۲

npm run dictate -- --again                    # اشتباه نوشت — دوباره امتحان کن
npm run dictate -- --again "سیاوش، صدف"       # …و املای درست را هم بده
```

### `--again` بخش جالب ماجراست

اشتباه نوشتن یک اسم نباید به قیمت از دست دادن کل ضبط تمام شود. آخرین فایل صدا
نگه داشته می‌شود، پس `--again` همان صدا را دوباره می‌فرستد و لازم نیست دوباره
حرف بزنی.

راهنما دادن از خود retry مهم‌تر است. پاس اول با `temperature: 0` اجرا می‌شود،
یعنی قطعی است — تلاش دوم بدون راهنما **دقیقاً همان متن** را برمی‌گرداند. پس:
بدون راهنما، retry با نمونه‌برداری متفاوت اجرا می‌شود؛ با راهنما، قطعی می‌ماند
و صرفاً املایی را که داده‌ای رعایت می‌کند. اسم‌ها، برندها و اصطلاح‌ها دقیقاً
همان چیزهایی هستند که مدل از روی صدا نمی‌تواند حدس بزند.

## هات‌کی و پنجرهٔ شناور (اختیاری)

**macOS —** یک اسکریپت Hammerspoon: آیکن میکروفون در نوار منو، یک کارت شناور با
نمایشگر صدا و تایمر، و دو هات‌کی بالا.

۱. [Hammerspoon](https://www.hammerspoon.org) را نصب کن و به آن دسترسی Accessibility بده.
۲. `ui/macos-hammerspoon/dictate.lua` را داخل `~/.hammerspoon/init.lua` کپی کن.
۳. مقدار `REPO` در بالای فایل را به مسیر کلون‌شده تغییر بده.
۴. کانفیگ را reload کن.

هات‌کی‌ها به **کلید فیزیکی** D و R وصل‌اند، پس با چیدمان کیبورد فارسی هم کار
می‌کنند.

**Windows —** `ui/windows-autohotkey/dictate.ahk` با AutoHotkey v2. مقدار `REPO`
را ست کن و اجرایش کن (هنوز تست نشده).

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
- **thinking روی حداقل.** روی Gemini 3 خلاصهٔ فکر مدل به‌صورت یک بخش *متنی*
  عادی برمی‌گردد، پس `.text` در SDK مونولوگ داخلی مدل را می‌چسباند به اول
  متن — و به کلیپ‌بورد تو.
- **گیت سکوتِ قطعی.** مدل در برابر سکوت نمی‌گوید «سکوت»؛ یک یادداشت روان و
  کاملاً ساختگی می‌نویسد. محافظ باید `volumedetect` در ffmpeg باشد نه یک قانون
  در پرامپت — نسخهٔ پرامپتی باعث می‌شود مدل کلیپ‌های طولانیِ کاملاً سالم را رد کند.
- **UTF-8 صریح برای کلیپ‌بورد.** `pbcopy` انکودینگ را از `LANG`/`LC_CTYPE`
  می‌خواند و وقتی یک لانچر گرافیکی محیط خالی پاس می‌دهد به *Mac OS Roman*
  برمی‌گردد. این‌طوری یک متن فارسی سالم به شکل `ÿ≥ŸÑÿßŸÖ` روی کلیپ‌بورد می‌نشیند.

## لایسنس

MIT

---

## English

**dictate** is a small local-first dictation tool for the desktop, built for
Persian first. Press `Ctrl+Alt+D`, talk, press it again — the transcript is on
your clipboard. If it got a word wrong, `Ctrl+Alt+R` re-transcribes the same
audio, and you can hand it the correct spellings instead of saying everything
again.

The interface is in Persian, because that is who it is for. The code, the
comments and [CONTRIBUTING.md](CONTRIBUTING.md) are in English, so the project
stays contributable — all user-facing strings live in one file
([`src/messages.ts`](src/messages.ts)), which is also what makes an English UI a
small change rather than a hunt.

Recording, the silence gate and the model call are OS-independent; each platform
supplies five primitives ([`src/platform/index.ts`](src/platform/index.ts)).
macOS is written and tested, Windows is written and **untested**, Linux is open.

Requires Node 20+, ffmpeg, and a free [Gemini API key](https://aistudio.google.com/apikey).
Nothing is uploaded anywhere but that API; one clip is kept on disk so the retry
has something to re-send. MIT.
