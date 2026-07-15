-- ميزة "Trading Radar" (QAIS SK Engine)
-- شغّلي هالسكريبت مرة وحدة في Supabase → SQL Editor

create extension if not exists pgcrypto;

-- 1) حالة الرادار لكل أصل — تُحسب مرة مركزية بالكرون وتُقرأ من كل الطلاب
--    (مش لكل مستخدم لحاله: التحليل نفسه موضوعي وواحد لكل الطلاب، فما في داعي
--    نكرر نفس الحساب لكل طالب — أخف بكثير على السيرفر ومصدر يوهو المجاني)
create table if not exists qais_radar_state (
  symbol text primary key,
  status text not null default 'gray',       -- gray | yellow | orange | green | red
  score int not null default 0,               -- QAIS Score من 100
  direction text,                              -- up | down | null
  price numeric,
  timeframe text default 'M15',
  reason_tags text[] not null default '{}',    -- مثال: {Sweep, MSS, FVG, OB}
  decision jsonb not null default '{}'::jsonb, -- كامل نتيجة makeDecision() للتفاصيل عند الضغط
  updated_at timestamptz not null default now()
);

-- 2) قائمة متابعة كل طالب — أي أصول يبيّن على رادار حسابه (افتراضياً كل الأصول المدعومة)
create table if not exists qais_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  symbol text not null,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create index if not exists qais_watchlist_user_idx on qais_watchlist (user_id);

alter table qais_watchlist enable row level security;

drop policy if exists "qais_watchlist_select_own" on qais_watchlist;
create policy "qais_watchlist_select_own" on qais_watchlist
  for select using (auth.uid() = user_id);

drop policy if exists "qais_watchlist_insert_own" on qais_watchlist;
create policy "qais_watchlist_insert_own" on qais_watchlist
  for insert with check (auth.uid() = user_id);

drop policy if exists "qais_watchlist_delete_own" on qais_watchlist;
create policy "qais_watchlist_delete_own" on qais_watchlist
  for delete using (auth.uid() = user_id);

-- qais_radar_state مقصود تُقرأ من الجميع (بيانات سوق عامة مش خاصة)، والكتابة فيها
-- فقط عبر الكرون بمفتاح Service Role (اللي بيتجاوز RLS أصلاً) — فما بنفعّل RLS عليها.
