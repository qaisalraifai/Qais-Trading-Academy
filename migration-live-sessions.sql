-- جدول البثوث المباشرة (Live Sessions)
-- شغّلي هالسكريبت مرة وحدة في Supabase → SQL Editor

create extension if not exists pgcrypto;

create table if not exists live_sessions (
  id uuid primary key default gen_random_uuid(),
  room_name text not null unique,
  title text,
  is_active boolean not null default true,
  started_by uuid references profiles(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists live_sessions_active_idx on live_sessions (is_active);
