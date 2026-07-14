-- ميزة "بصمتك كمتداول" (Trader DNA)
-- شغّلي هالسكريبت مرة وحدة في Supabase → SQL Editor

create extension if not exists pgcrypto;

-- 1) جدول نتائج اختبار الشخصية (يتحدّث كل ما الطالب يعيد الاختبار)
create table if not exists trader_dna_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade unique,
  answers jsonb not null default '{}'::jsonb,       -- إجابات الاختبار الخام { "q1": "sniper", ... }
  trader_type text not null,                         -- sniper | scalper | day_trader | swing_trader
  risk_tolerance text not null,                       -- low | medium | high
  psychology_score int not null default 0,            -- 0-100
  discipline_score int not null default 0,            -- 0-100
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  session_preference text,                            -- london | newyork | asia | flexible
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trader_dna_profiles_user_idx on trader_dna_profiles (user_id);

alter table trader_dna_profiles enable row level security;

drop policy if exists "trader_dna_select_own" on trader_dna_profiles;
create policy "trader_dna_select_own" on trader_dna_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "trader_dna_insert_own" on trader_dna_profiles;
create policy "trader_dna_insert_own" on trader_dna_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "trader_dna_update_own" on trader_dna_profiles;
create policy "trader_dna_update_own" on trader_dna_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) إضافة عمود الجلسة (لندن / نيويورك / آسيا) لجدول الصفقات الموجود
-- عمود اختياري (nullable) ما بأثر على الصفقات القديمة
alter table trades add column if not exists session text;
