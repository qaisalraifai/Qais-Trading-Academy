-- المرحلة 9: الإعلانات — ترسل إعلان لطلاب دفعة معينة بس، مستفيدة من جدول notifications الموجود
-- شغّلي هالسكريبت مرة وحدة في Supabase → SQL Editor

create table if not exists batch_announcements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  sent_by uuid references profiles(id),
  title text not null,
  message text not null default '',
  link text,
  recipients_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists batch_announcements_batch_idx on batch_announcements (batch_id);
