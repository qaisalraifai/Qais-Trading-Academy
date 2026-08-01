-- ============================================================================
-- المرحلة 9: تحويل البث المباشر لـ LiveKit Community Edition + الميزات التفاعلية
-- شغّلي هالسكريبت مرة وحدة في Supabase → SQL Editor. آمن للتشغيل أكتر من مرة.
--
-- ملاحظة مهمة: هاد السكريبت إضافي بس (Additive) — ما بيلمس أو يحذف أي شي من
-- بنية batch_id (المرحلة 7) أو جدول live_attendance (المرحلة 8) الموجودين
-- أصلاً؛ هدول ضلّوا يشتغلوا بالضبط متل ما هنّ.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) توسعة جدول البثوث عشان يدعم LiveKit + التسجيل
-- ---------------------------------------------------------------------------
alter table live_sessions
  add column if not exists provider text not null default 'livekit',
  add column if not exists description text,
  add column if not exists ended_by uuid references profiles(id),
  add column if not exists egress_id text,
  add column if not exists recording_status text not null default 'idle', -- idle | recording | processing | ready | failed
  add column if not exists recording_url text;

-- ---------------------------------------------------------------------------
-- 2) صلاحيات مساعد/مشرف مؤقتة داخل بث معيّن (يرقّيها المدرب أثناء البث)
-- ---------------------------------------------------------------------------
create table if not exists live_moderators (
  session_id uuid not null references live_sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  promoted_by uuid references profiles(id),
  promoted_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 3) الدردشة المباشرة (نسخة محفوظة للتاريخ + لمين ينضم متأخر)
-- ---------------------------------------------------------------------------
create table if not exists live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  username text not null,
  role text not null default 'student',
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists live_chat_session_idx on live_chat_messages (session_id, created_at);

-- ---------------------------------------------------------------------------
-- 4) الاستطلاعات (Polls)
-- ---------------------------------------------------------------------------
create table if not exists live_polls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  question text not null,
  options jsonb not null,
  created_by uuid references profiles(id),
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists live_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references live_polls(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  option_index integer not null,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id)
);

create index if not exists live_polls_session_idx on live_polls (session_id);
create index if not exists live_poll_votes_poll_idx on live_poll_votes (poll_id);

-- ---------------------------------------------------------------------------
-- 5) الأسئلة (Q&A)
-- ---------------------------------------------------------------------------
create table if not exists live_qna (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  username text not null,
  question text not null,
  is_answered boolean not null default false,
  upvotes integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists live_qna_session_idx on live_qna (session_id);

-- ---------------------------------------------------------------------------
-- 6) الملفات المشتركة أثناء البث
-- ---------------------------------------------------------------------------
create table if not exists live_files (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  uploaded_by uuid references profiles(id),
  file_name text not null,
  file_url text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists live_files_session_idx on live_files (session_id);

-- ---------------------------------------------------------------------------
-- 7) الإعلانات/التنبيهات اللي المدرب يعرضها فوق البث لحظياً (أرشفة)
-- ---------------------------------------------------------------------------
create table if not exists live_announcements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_sessions(id) on delete cascade,
  message text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
