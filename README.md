# Spinify — Liquid Glass Disc Maker & Music Player

تطبيق **Spinify** بتصميم **iOS Liquid Glass** لصناعة فيديوهات الأسطوانة الدوّارة (`1:1` لتيليجرام، `9:16` للستوري والريلز وتيك توك، و`16:9` لليوتيوب) مع وضع **مشغل موسيقى شبيه بـ Spotify** متكامل.

> المطور: **[@xleeix](https://t.me/xleeix)** · قناة التحديثات على تيليجرام: **[@NameManger](https://t.me/NameManger)**

---

## المميزات الرئيسية | Features

- **تنظيم احترافي بـ 4 تبويبات فرعية:** الشكل، الخلفية، التصدير، والقوالب.
- **أنماط أسطوانة متعددة:** `Full CD`، `Vinyl`، `Full Vinyl`، `Glass`، **شريط كاسيت (`Cassette Tape`)**، و**أسطوانة نيون متفاعلة مع الإيقاع (`Neon Pulse`)**.
- **ذراع الفونوغراف المتحرك (Tonearm) الاختياري:** ينزل بانسيابية عند التشغيل ويرتفع عند التوقف.
- **اللمسات الواقعية:** خيار **تأثير الخدش والغبار**، وخيار إظهار/إخفاء **عنوان الأغنية واسم الفنان** أسفل الأسطوانة.
- **خلفية ذكية (Smart Background):** استخراج ألوان الغلاف لصنع تدرج متناغم أو تمويه ناعم (`Blur`).
- **مقاسات ودقة التصدير (Smart Resize):** `1:1` / `9:16` / `16:9` بدقة `720p` أو `1080p` ومعدل إطارات `30fps` أو `60fps` مع خيار `< 19MB` والتلاشي التلقائي (`Auto-Fade`).
- **ضجيج الخلفية (Ambient Noise):** خشخشة الفينيل، `Lo-fi Hiss`، ومطر ناعم مع شريط تحكم بمستوى الصوت.
- **القوالب (Presets):** حفظ إعداداتك المفضلة واستعادتها بضغطة واحدة.
- **مشغل الموسيقى الشبيه بـ Spotify:** طلب إذن الوصول لصوتيات الجهاز، شريط سرعة التشغيل الفوري (`0.50×` – `2.00×`)، رابط بوت التحميل المجاني [`@xleeixmusicbotbot`](https://t.me/xleeixmusicbotbot)، ونقل أي أغنية للاستوديو بضغطة واحدة.

---

## التجهيز والبناء التلقائي للـ APK عبر GitHub Actions

المشروع جاهز بالكامل مع سير عمل GitHub Actions في المسار `.github/workflows/build-apk.yml`.

> **ملاحظة مهمة عند الرفع إلى GitHub:** احرص على رفع المجلدات المخفية أيضاً (خصوصاً `.github/workflows/build-apk.yml` و`.gitignore`) باستخدام `git push` أو رفع المجلد الكامل حتى يعمل البناء التلقائي للـ APK.

### 1. رفع المشروع إلى مستودع GitHub جديد

```bash
git init -b main
git add .
git commit -m "Spinify APK release"
git remote add origin https://github.com/YOUR_USERNAME/spinify.git
git push -u origin main
```

### 2. نشر نسخة الويب للآيفون والمتصفحات مجاناً

هذه نسخة الويب منفصلة عن ملف APK. إعداد GitHub Pages موجود في `.github/workflows/deploy-web.yml`. اتبع خطوات `WEB-DEPLOY.md` لنشر الموقع والحصول على رابطه العام. الاستضافة ثابتة ومجانية، ولا تشغّل خادم Node.js.

### 3. تنزيل ملف الـ APK تلقائياً

1. افتح مستودعك على GitHub ثم انتقل إلى تبويب **Actions**.
2. ستجد مهمة **Build Android APK** تعمل تلقائياً بعد كل رفع على فرع `main` أو `master` (ويمكنك تشغيلها يدوياً عبر **Run workflow**).
3. بعد اكتمال البناء، انزل إلى قسم **Artifacts** وحمّل ملف **`spinify-debug-apk`** الذي يحتوي على `app-debug.apk`.

---

## التشغيل محلياً | Local Development

```bash
npm install
npm start
```

ثم افتح المتصفح على `http://localhost:3000`.
