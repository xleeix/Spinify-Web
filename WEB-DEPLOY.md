# Spinify Web — نشر مجاني على GitHub Pages

هذه الحزمة هي نسخة الويب الخاصة بـ Spinify للآيفون والمتصفحات. لا تحتاج إلى APK ولا تنشر أو تعدّل مشروع Android المنفصل.

## النشر لأول مرة

1. ارفع محتويات هذا المشروع إلى مستودع GitHub الخاص بنسخة الويب (مثلاً `Spinify`). تأكد من رفع المجلد المخفي `.github` أيضاً.
2. من المستودع افتح **Settings → Pages**.
3. اختر **GitHub Actions** في خانة **Build and deployment → Source**.
4. افتح **Actions** وشغّل **Deploy Free Website (GitHub Pages)** عبر **Run workflow**، أو ادفع commit جديداً إلى `main` أو `master`.
5. بعد نجاح مهمة النشر سيظهر رابط الموقع في سجل المهمة، ويكون عادةً:
   `https://xleeix.github.io/Spinify/`

## النشر بعد التعديلات

أي `git push` إلى `main` أو `master` يشغّل النشر تلقائياً.

## ملاحظات مهمة للويب

- GitHub Pages استضافة ملفات ثابتة؛ لا يشغّل `server.js` أو Express أو FFmpeg.
- التصدير على الويب يعتمد على WebCodecs أولاً، ثم MediaRecorder كخيار احتياطي في المتصفحات الداعمة. لذلك قد تختلف خيارات التصدير والأداء حسب إصدار Safari والجهاز.
- مسار `/api/export-video` الخاص بخادم Node غير متاح على GitHub Pages؛ فشل هذا المسار متوقع، ويجب أن ينتقل التطبيق إلى التصدير داخل المتصفح.
- يمكن فتح الموقع على iPhone من Safari ثم اختيار **Share → Add to Home Screen** لإضافته للشاشة الرئيسية، إذا كان المتصفح يدعم ذلك.
