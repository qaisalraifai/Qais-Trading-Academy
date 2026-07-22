-- QAIS AI Trade Lifecycle (Phase 4) — شغّلي هالسكريبت مرة وحدة بعد باقي migration-qais-radar*.sql
-- جدول جديد ومنفصل تماماً عن جدول trades (دفتر يوميات الطالب اليدوي) — ما بيلمسه ولا بيأثر
-- على BacktestClient / ReportsView / DashboardClient اللي بتعتمد على trades الحالي.

create extension if not exists pgcrypto;

-- 1) صفقات QAIS AI — كل صفقة Execute بتنشئ سطر هون، منسوخة (snapshot) وقت الضغط
--    عن قرار الرادار (decision) لهيك ما بتتأثر لو الرادار تغيّر بعدين لنفس الرمز.
create table if not exists qais_ai_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,

  symbol text not null,
  direction text not null,              -- 'up' | 'down' (BUY/SELL يُشتق منه بالواجهة)
  timeframe text not null default 'M15',

  entry numeric not null,
  stop_loss numeric not null,
  tp1 numeric,
  tp2 numeric,
  tp3 numeric,
  tp4 numeric,

  confidence int,                       -- aiConfidence وقت الإنشاء
  risk_reward numeric,                  -- riskReward وقت الإنشاء (محسوب على TP1)

  -- Snapshot كامل لأسباب الدخول والتحليل وقت الضغط على Execute — يُستخدم بصفحة Trade Details
  -- (structure, liquidity, bosStatus, chochStatus, fvgStatus, session, why[], ob, sequence...)
  ai_analysis jsonb not null default '{}'::jsonb,

  status text not null default 'Open',  -- Open | Running | TP1 Hit | TP2 Hit | TP3 Hit | TP4 Hit | Closed Winner | Stopped Out
  source text not null default 'QAIS AI',

  -- آخر سعر تم فحصه به الصفقة (يُحدَّث بالفحص عند الطلب) — لعرض "آخر تحديث" بالواجهة
  last_checked_price numeric,
  last_checked_at timestamptz,

  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists qais_ai_trades_user_idx on qais_ai_trades (user_id, created_at desc);
create index if not exists qais_ai_trades_user_symbol_open_idx
  on qais_ai_trades (user_id, symbol)
  where status not in ('Closed Winner', 'Stopped Out');

alter table qais_ai_trades enable row level security;

drop policy if exists "qais_ai_trades_select_own" on qais_ai_trades;
create policy "qais_ai_trades_select_own" on qais_ai_trades
  for select using (auth.uid() = user_id);

drop policy if exists "qais_ai_trades_insert_own" on qais_ai_trades;
create policy "qais_ai_trades_insert_own" on qais_ai_trades
  for insert with check (auth.uid() = user_id);

-- التحديث (تغيير status/last_checked_*) بيصير من السيرفر بمفتاح Service Role
-- (وقت الفحص عند الطلب)، فما في داعي policy للـ update من طرف المستخدم مباشرة.
