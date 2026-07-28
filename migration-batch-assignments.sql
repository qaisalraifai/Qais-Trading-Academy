-- المرحلة 11: الواجبات — إنشاء واجب لدفعة معينة، تسليمه من الطالب، وتقييمه
-- شغّلي هالسكريبت مرة وحدة في Supabase → SQL Editor
-- ملاحظة: باكت التخزين (assignment-submissions) بينعمل تلقائيًا من الكود أول مرة
-- حدا يسلّم واجب، زي باكت batch-files بالضبط — ما محتاجة تنشئيه يدويًا.

create table if not exists batch_assignments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  created_by uuid references profiles(id),
  title text not null,
  description text,
  due_date timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists batch_assignments_batch_idx on batch_assignments (batch_id);

create table if not exists assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references batch_assignments(id) on delete cascade,
  user_id uuid not null references profiles(id),
  file_path text,
  file_name text,
  note text,
  submitted_at timestamptz not null default now(),
  grade text,
  feedback text,
  graded_at timestamptz,
  graded_by uuid references profiles(id),
  unique (assignment_id, user_id)
);

create index if not exists assignment_submissions_assignment_idx on assignment_submissions (assignment_id);
create index if not exists assignment_submissions_user_idx on assignment_submissions (user_id);
