-- جدول notifications — مركز الإشعارات (الجرس) + "آخر النشاطات" بصفحة المسوّق.
-- شغّلي هالسكريبت مرة وحدة في Supabase → SQL Editor.
--
-- ⚠️ ليش انكتبت هالـmigration متأخرة:
-- الجدول انعمل **يدوياً** بسوبابيس ومستعمل بـ٧ أماكن بالكود، بس ما كان
-- إله ولا migration بالمستودع. يعني ما في مصدر واحد لمخططه، وما بتنعرف
-- أعمدته إلا بقراءة الاستعلامات. أي بيئة جديدة كانت بتنكسر بصمت.
--
-- ⚠️ المخطط هون **مشتقّ من استعمال الكود** مش من قاعدة الإنتاج:
--     app/api/notifications/route.js        select id, type, title, message, link, read, created_at
--                                           eq user_id · eq read · order created_at
--     lib/notifications.js                  insert user_id, type, title, message, link
--     app/api/admin/batches/[id]/announcements/route.js   نفس الأعمدة، فان-أوت
--     app/api/admin/quick-add/route.js      نفس الأعمدة، فان-أوت
--     app/api/admin/users/[id]/action/route.js            user_id, title, message
--
-- كل الأوامر `if not exists` فما بتلمس الجدول الموجود بالإنتاج — بتوثّقه
-- وبتخلّي بيئة جديدة تشتغل. لو مخطط الإنتاج بيختلف عن هون، **الإنتاج هو
-- المرجع** ولازم يتصحّح هالملف، مش العكس.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),

  -- ⚠️ `not null` بقصد. الإشعار العام بينعمل **صف لكل مستخدم** مش صف واحد
  -- فاضي: القراءة بتفلتر على user_id، وحالة `read` لازم تكون لكل واحد
  -- لحاله. صف بـuser_id فاضي كان ما بيوصل ولا حدا (انصلح بـquick-add).
  user_id uuid not null references profiles(id) on delete cascade,

  -- أمثلة مستعملة بالكود: commission · badge · wheel_spin · wheel_credit ·
  -- referral_joined · application_approved · application_rejected · payout ·
  -- batch_announcement · broadcast
  type text,

  title text not null,
  message text not null default '',
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- الاستعلام الأساسي: إشعارات مستخدم مرتّبة بالأحدث.
create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

-- عدّاد غير المقروء: eq user_id + eq read=false. جزئي عشان يضل صغير.
create index if not exists notifications_unread_idx
  on notifications (user_id)
  where read = false;

-- ⚠️ صفوف قديمة بـuser_id فاضي (من الإشعارات العامة قبل التصليح).
-- هاي موجودة بالإنتاج غالباً، و**مخفية**: ما بتظهر لحدا لأن القراءة
-- بتفلتر على user_id. شوفي كم وحدة أول:
--
--   select count(*) from notifications where user_id is null;
--
-- وبعدين إما تنشرهن على كل المستخدمين (نفس منطق التصليح):
--
--   insert into notifications (user_id, type, title, message, link, created_at)
--   select p.id, coalesce(n.type, 'broadcast'), n.title, n.message, n.link, n.created_at
--   from notifications n cross join profiles p
--   where n.user_id is null;
--   delete from notifications where user_id is null;
--
-- أو تنمسح إذا ما عاد إلها معنى:
--
--   delete from notifications where user_id is null;
--
-- ⚠️ شوفي العدد قبل — النشر بيضرب عدد الصفوف بعدد المستخدمين.
-- وما بينحط `not null` على العمود بالإنتاج إلا **بعد** ما تتعالج الصفوف
-- دي، وإلا `alter column set not null` بيفشل.

-- ⚠️ RLS مقصود إنه **مش مُفعَّل** هون.
-- كل القراءة والكتابة بتمرق عبر `createAdminClient()` (service role) اللي
-- بيتجاوز RLS أصلاً، ونفس عرف باقي الجداول بالمستودع (شوفي
-- migration-batch-announcements.sql). وتفعيله بسطر `alter table` بينفّذ
-- على الجدول الحي فوراً — فلو أي مسار بيقرا بمفتاح anon، بينكسر بصمت.
-- لو بدك تفعّليه، فعّليه **مع** السياسات بنفس الجلسة وبعد فحص كل المسارات:
--
--   alter table notifications enable row level security;
--   create policy "قراءة إشعاراتي" on notifications
--     for select using (auth.uid() = user_id);
--   create policy "تأشير إشعاراتي مقروءة" on notifications
--     for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
--   -- الإدراج بيضل من service role بس (ما في سياسة insert للمستخدم).
