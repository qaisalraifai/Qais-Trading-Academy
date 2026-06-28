# منصة التعليم — تعليمات التشغيل والنشر

## 1) قبل ما تنشر: خذ مفتاح Service Role
1. روح على Supabase Dashboard → Project Settings → API.
2. تحت "Project API keys"، خذ مفتاح **service_role** (سري، لا تشاركه مع أحد ولا تحطه بالواجهة الأمامية مباشرة).
3. افتح ملف `.env.local` بالمشروع وحط المفتاح بدل النص `ضع_هون_service_role_key_من_Supabase`.

## 2) رفع المشروع على GitHub (بدون Terminal)
1. روح على https://github.com وسجل دخول/أنشئ حساب.
2. اضغط **New repository**، اعطيه اسم مثل `edu-platform`، اختار **Private**، ثم **Create repository**.
3. بصفحة المستودع الفاضي، اضغط رابط "uploading an existing file".
4. اسحب وأفرج (Drag & Drop) **كل ملفات ومجلدات المشروع** (إلا `.env.local` — لا ترفعه أبداً لأنه فيه مفاتيح سرية).
5. اضغط **Commit changes**.

## 3) النشر على Vercel
1. روح على https://vercel.com وسجل دخول بحساب GitHub.
2. اضغط **Add New Project**، اختار المستودع `edu-platform`.
3. بقسم **Environment Variables**، ضيف:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

   (خذ القيم من ملف `.env.local` عندك محلياً)
4. اضغط **Deploy**.
5. بعد دقيقة أو دقيقتين، بيعطيك رابط مباشر مثل `edu-platform.vercel.app`.

## 4) إضافة محاضرات واختبارات (مؤقتاً يدوياً عبر Supabase)
لحد ما نبني لوحة أدمن:
1. روح Supabase → Table Editor → جدول `lectures`.
2. اضغط **Insert row** وعبّي:
   - `title`: عنوان المحاضرة
   - `youtube_video_id`: الكود اللي بعد `v=` برابط يوتيوب (مثلاً من `youtube.com/watch?v=ABC123` الكود هو `ABC123`)
   - `order_index`: رقم الترتيب (1, 2, 3...)
3. لإضافة اختبار: جدول `quizzes` → اربطه بـ `lecture_id`.
4. لإضافة أسئلة: جدول `quiz_questions` → اربطها بـ `quiz_id`، وحط `options` كـ JSON array مثل:
   `["خيار أ", "خيار ب", "خيار ج", "خيار د"]`
   و `correct_option_index` هو رقم الخيار الصحيح (0 = الأول، 1 = الثاني...).

## 5) تجربة الموقع
1. افتح الرابط، روح `/signup`.
2. استخدم أحد أكواد الدعوة التجريبية: `STUDENT-0001`.
3. اعمل حساب، جرب المحاضرات والاختبار.

## ملاحظة عن صلاحيات الأدمن
أول حساب بدك تخليه أدمن: روح Supabase → Table Editor → `profiles` → دوس على صف المستخدم → غيّر `role` من `student` لـ `admin`.
