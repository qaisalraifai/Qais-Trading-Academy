-- جدول إعدادات المستخدم الشخصية (ألوان الريبلاي، القوالب، الأصول المفضّلة،
-- إلخ) - محفوظة بحساب الطالب بدل ما تضيع مع تغيير الجهاز أو مسح الكاش.
-- كل مفاتيح localStorage يلي تبدأ بـ "qta_" بتتخزن هون تلقائياً كصف واحد
-- (JSON) لكل مستخدم، عن طريق /api/user/settings.

create table if not exists public.user_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

-- كل مستخدم يقدر يشوف/يعدّل بس صفه هو (الـ API فعلياً بيستخدم service role
-- ويتحقق من auth.getUser() بنفسه، بس منفعّل RLS كطبقة حماية إضافية لو
-- انفتح الجدول يوماً لعميل المتصفح مباشرة)
create policy "select own settings" on public.user_settings
  for select using (auth.uid() = user_id);

create policy "upsert own settings" on public.user_settings
  for insert with check (auth.uid() = user_id);

create policy "update own settings" on public.user_settings
  for update using (auth.uid() = user_id);
