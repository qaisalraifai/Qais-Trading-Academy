-- المرحلة 12: الدردشة — غرفة دردشة خاصة بكل دفعة، بين الطلاب والمدرب، بدون اختلاط مع دفعات ثانية
-- شغّلي هالسكريبت مرة وحدة في Supabase → SQL Editor

create table if not exists batch_chat_messages (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  user_id uuid not null references profiles(id),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists batch_chat_messages_batch_idx on batch_chat_messages (batch_id, created_at);
