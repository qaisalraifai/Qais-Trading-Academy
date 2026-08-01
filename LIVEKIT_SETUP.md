# دليل إعداد البث المباشر (LiveKit Community Edition)

نظام البث المباشر صار مبني بالكامل على **LiveKit Community Edition** (مفتوح
المصدر، مستضاف ذاتيًا) بدل Jitsi، وهو **مدمج بالكامل مع نظام الدفعات
(Batches)** الموجود بالمنصة: كل بث مرتبط إجباريًا بدفعة معيّنة، وما بينضم إلها
إلا الطلاب المسجّلين فيها (أو الأدمن).

---

## 1) تشغيل سيرفر LiveKit

### الخيار أ — على سيرفر خاص فيك (VPS) عبر Docker

1. عدّلي `livekit.yaml` و `egress.yaml`:
   - غيّري `APIkeyChangeMe` و `secretChangeMeToARandom32PlusCharString` لقيم عشوائية قوية
     (نفس القيمتين لازم تتكررا بالملفين).
   - حطي رابط الـ webhook الحقيقي لمنصتك: `https://your-domain.com/api/live/webhook`.
2. تأكدي إن بورتات UDP `50000-60000` وبورت TCP `7880`/`7881` مفتوحة بجدار الحماية —
   هاي أهم خطوة، لو ما انفتحت هاي البورتات البث ما رح يشتغل خلف أغلب الشبكات.
3. شغّلي:
   ```bash
   docker compose -f docker-compose.livekit.yml up -d
   ```
4. حطي دومين وSSL قدام بورت 7880 (عبر Nginx/Caddy/Traefik) عشان يصير عندك
   `wss://live.yourdomain.com` بدل الاتصال المباشر بالـ IP.

### الخيار ب — LiveKit Cloud (سريع للتجربة، بعدين تقدري تنقلي لذاتي الاستضافة)
لو بدك تجربي بسرعة بدون إدارة سيرفر، فيك تفتحي حساب على livekit.io وتاخدي
`LIVEKIT_URL` و `API_KEY`/`API_SECRET` جاهزين، ونفس الكود تحت بيشتغل معهم بدون أي
تعديل.

---

## 2) متغيرات البيئة (Next.js `.env.local` / إعدادات الاستضافة)

```env
# LiveKit
LIVEKIT_URL=wss://live.yourdomain.com          # يستخدمه السيرفر (توليد التوكن + التحكم بالغرف)
LIVEKIT_API_KEY=APIkeyChangeMe
LIVEKIT_API_SECRET=secretChangeMeToARandom32PlusCharString
NEXT_PUBLIC_LIVEKIT_WS_URL=wss://live.yourdomain.com   # يستخدمه المتصفح للاتصال مباشرة

# تخزين التسجيلات (اختياري — لو بدك خاصية "تسجيل الجلسة")
# فيك تستخدمي Supabase Storage نفسه عبر بروتوكول S3 المتوافق (Project Settings → Storage → S3 Connection)
LIVE_RECORDINGS_S3_BUCKET=live-recordings
LIVE_RECORDINGS_S3_ACCESS_KEY=...
LIVE_RECORDINGS_S3_SECRET=...
LIVE_RECORDINGS_S3_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3
LIVE_RECORDINGS_S3_REGION=us-east-1
```

---

## 3) قاعدة البيانات

شغّلي `migration-livekit.sql` مرة وحدة في Supabase → SQL Editor. بيضيف بس:
- أعمدة جديدة لجدول `live_sessions` (`provider`, `egress_id`, `recording_status`,
  `recording_url`, `description`, `ended_by`).
- جداول جديدة: `live_moderators`, `live_chat_messages`, `live_polls`,
  `live_poll_votes`, `live_qna`, `live_files`, `live_announcements`.

**ما بيلمس ولا بيعدّل** أي شي من نظام الدفعات (`batches`, `batch_enrollments`,
`batch_instructors`) ولا من جدول `live_attendance` الموجود أصلاً — هدول ضلّوا
يشتغلوا بالضبط متل ما هنّ.

### Storage bucket للملفات المشتركة
من Supabase Dashboard → Storage، أنشئي bucket اسمه **`live-files`** واخليه Public
(أو خاص + Signed URLs لو بدك خصوصية أكتر — بهاد الحالة لازم تعدّلي
`app/dashboard/components/live/FilesPanel.js` يستخدم `createSignedUrl` بدل
`getPublicUrl`).

---

## 4) تسجيل الـ Webhook

بملف `livekit.yaml`، تأكدي إن `webhook.urls` فيها رابط الإنتاج الصحيح لـ:
```
https://your-domain.com/api/live/webhook
```
هاد بس بيتابع حالة التسجيل (لما يخلص، بيحفظ رابط الفيديو بجدول
`live_sessions.recording_url`). الحضور نفسه بيتسجّل عبر نفس نظام الحضور
الموجود أصلاً بالمنصة (`/api/live/attendance`)، مش عبر الـ webhook.

---

## 5) كيف يشتغل مع نظام الدفعات

- **بدء بث**: من `/admin/batches/[id]` → تبويب "البث والحضور" → زر "ابدأ بث".
  هاد بيرسل `batch_id` مباشرة، وبيمنع بث ثاني نشط لنفس الدفعة (محمي بقاعدة
  البيانات كمان).
- **الانضمام**: صفحة `/live-sessions` بتعرض للمستخدم كل البثوث النشطة هلأ
  اللي مسموحله يوصلها:
  - **طالب**: بس بثوث الدفعات اللي مسجّل فيها فعليًا (`batch_enrollments`).
  - **أدمن**: كل البثوث النشطة بالمنصة، بغض النظر عن الدفعة.
- **الأدوار جوا الغرفة**:
  - **Host (مدرب)**: أي أدمن عام، أو مدرب مرتبط بهاي الدفعة تحديدًا
    (`batch_instructors`). بيقدر يبدأ/ينهي البث، يسجّل، يكتم/يطرد/يرقّي أي
    مشارك، ينشر تنبيهات واستطلاعات.
  - **Moderator (مساعد)**: طالب رقّاه المدرب أثناء البث (`live_moderators`).
    بيقدر ينشئ استطلاعات ويجاوب على أسئلة، بس بدون صلاحيات LiveKit الإدارية
    الكاملة (الكتم/الطرد يضلوا بس للأدمن).
  - **Student (طالب)**: يقدر يفعّل كاميرا/مايك/مشاركة شاشة، يدردش، يرفع إيده،
    يسأل، يصوّت.

كل هاد محدّد سيرفر-سايد بملف `lib/live-access.js`، مش بالفرونت.

---

## 6) اختبار سريع

1. `npm install` (تمت إضافة `livekit-client` و `livekit-server-sdk` للمشروع).
2. شغّلي `docker compose -f docker-compose.livekit.yml up -d`.
3. شغّلي `npm run dev`.
4. سجّلي دخول كأدمن → `/admin/batches/[id]` → ابدئي بث → افتحي `/live-sessions`
   بمتصفح خاص (incognito) بحساب طالب مسجّل بنفس الدفعة → انضمي.

---

## 7) نقاط أداء مهمة

- `adaptiveStream` و `dynacast` مفعّلين بالـ SDK — بيقللوا استهلاك الباندويدث
  تلقائيًا حسب اللي كل مشاهد شايفه فعليًا.
- الفيديو بيتنشر بـ `simulcast` (أكتر من جودة بنفس الوقت) عشان كل مشاهد ياخد
  الجودة المناسبة لسرعة نته.
- `emptyTimeout` و `departureTimeout` بملف `lib/livekit-server.js` بيقفلوا الغرفة
  تلقائيًا لو ضلت فاضية، فما في موارد سيرفر ضايعة.
