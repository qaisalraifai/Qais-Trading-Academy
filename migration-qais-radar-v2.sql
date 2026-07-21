-- Smart Market Radar v2 (QAIS SK Engine) — شغّلي هالسكريبت مرة وحدة بعد migration-qais-radar.sql
-- كل شي هون إضافي بالكامل: ما بيلمس عمود status/score الأصلي المستخدم من
-- ميزات ثانية بالمنصة (Market Intelligence، QAIS Engine tester...) — فقط
-- بيضيف أعمدة جديدة لواجهة الرادار الاحترافية الجديدة + جدولين جدد.

-- 1) أعمدة عرض جديدة على qais_radar_state لواجهة الرادار v2 (كلها إضافية)
alter table qais_radar_state add column if not exists radar_status text;       -- green/blue/yellow/orange/red/gray (نظام الألوان الجديد)
alter table qais_radar_state add column if not exists radar_score int;         -- سكور v2 (Trend/HTF/BOS/CHOCH/OB/FVG/Liquidity/Premium-Discount/Session/Volume)
alter table qais_radar_state add column if not exists radar_signal_label text; -- Strong Buy / Buy Setup / Neutral.../ Sell Setup / Strong Sell / No Setup
alter table qais_radar_state add column if not exists radar_signal_strength text; -- Very Strong / Strong / Moderate / Weak
alter table qais_radar_state add column if not exists htf_trend text;
alter table qais_radar_state add column if not exists market_structure text;
alter table qais_radar_state add column if not exists bos_status text;
alter table qais_radar_state add column if not exists choch_status text;
alter table qais_radar_state add column if not exists fvg_status text;
alter table qais_radar_state add column if not exists liquidity_status text;
alter table qais_radar_state add column if not exists premium_discount text;
alter table qais_radar_state add column if not exists session text;
alter table qais_radar_state add column if not exists session_label text;
alter table qais_radar_state add column if not exists entry_status text;
alter table qais_radar_state add column if not exists risk_reward numeric;
alter table qais_radar_state add column if not exists why text[] not null default '{}';

-- 2) الأصول المفضّلة لكل طالب (نجمة ⭐ على الرادار)
create table if not exists qais_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  symbol text not null,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create index if not exists qais_favorites_user_idx on qais_favorites (user_id);

alter table qais_favorites enable row level security;

drop policy if exists "qais_favorites_select_own" on qais_favorites;
create policy "qais_favorites_select_own" on qais_favorites
  for select using (auth.uid() = user_id);

drop policy if exists "qais_favorites_insert_own" on qais_favorites;
create policy "qais_favorites_insert_own" on qais_favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "qais_favorites_delete_own" on qais_favorites;
create policy "qais_favorites_delete_own" on qais_favorites
  for delete using (auth.uid() = user_id);

-- 3) سجلّ الإشارات (Signal History) — بيانات سوق عامة (مش خاصة بطالب معيّن)،
--    تُكتب فقط من الكرون (Service Role) وتُقرأ من الجميع، لنفس منطق qais_radar_state.
--    مبنية على انتقالات radar_status الجديدة، لا علاقة إلها بعمود status القديم.
create table if not exists qais_signal_history (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  direction text not null,               -- up | down
  entry_price numeric,
  entry_time timestamptz not null default now(),
  exit_price numeric,
  exit_time timestamptz,
  rr_target numeric,
  rr_achieved numeric,
  pnl_pct numeric,
  status text not null default 'open',   -- open | win | loss
  signal_label text,
  score int,
  created_at timestamptz not null default now()
);

create index if not exists qais_signal_history_symbol_idx on qais_signal_history (symbol, created_at desc);
create index if not exists qais_signal_history_status_idx on qais_signal_history (status);

-- ما في RLS مقصود — نفس منطق qais_radar_state: بيانات سوق عامة، الكتابة فقط عبر Service Role بالكرون.
