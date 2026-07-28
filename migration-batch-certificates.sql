-- المرحلة 13: الشهادات — تصدر تلقائيًا لما الطالب يخلّص كل محاضرات دفعته،
-- أو يدويًا من الأدمن بغض النظر عن نسبة الإكمال.
-- شغّلي هالسكريبت مرة وحدة في Supabase → SQL Editor

create table if not exists batch_certificates (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  user_id uuid not null references profiles(id),
  certificate_code text not null unique,
  is_automatic boolean not null default false,
  issued_by uuid references profiles(id), -- فاضي لو صدرت تلقائيًا
  issued_at timestamptz not null default now(),
  unique (batch_id, user_id) -- شهادة وحدة بس لكل طالب لكل دفعة
);

create index if not exists batch_certificates_batch_idx on batch_certificates (batch_id);
create index if not exists batch_certificates_user_idx on batch_certificates (user_id);
create index if not exists batch_certificates_code_idx on batch_certificates (certificate_code);
