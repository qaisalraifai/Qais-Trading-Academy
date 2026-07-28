-- المرحلة 10: الملفات — مكتبة ملفات خاصة بكل دفعة (ملازم، أوراق عمل، مرفقات)
-- شغّلي هالسكريبت مرة وحدة في Supabase → SQL Editor
-- ملاحظة: باكت التخزين (batch-files) بينعمل تلقائيًا من الكود أول مرة حدا يرفع ملف،
-- زي باكت مستندات KYC بالضبط — ما محتاجة تنشئيه يدويًا.

create table if not exists batch_files (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  uploaded_by uuid references profiles(id),
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists batch_files_batch_idx on batch_files (batch_id);
