-- المرحلة 8: نظام الحضور — مرتبط بكل دفعة وبكل بث على حدة
-- شغّلي هالسكريبت مرة وحدة في Supabase → SQL Editor

create table if not exists live_attendance (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references live_sessions(id) on delete cascade,
  batch_id uuid references batches(id),
  user_id uuid not null references profiles(id),
  first_joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  join_count int not null default 1,
  unique (live_session_id, user_id)
);

create index if not exists live_attendance_session_idx on live_attendance (live_session_id);
create index if not exists live_attendance_batch_idx on live_attendance (batch_id);
create index if not exists live_attendance_user_idx on live_attendance (user_id);
