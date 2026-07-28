-- تحقق من نجاح المرحلة 2 — قراءة بس، ما بتغيّر أي شي.

-- 1) عمود course_id لازم يصير nullable (is_nullable = YES)
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'batch_enrollments' and column_name = 'course_id';

-- 2) الفهرس الجديد (user_id, batch_id) لازم يكون موجود
select indexname
from pg_indexes
where schemaname = 'public' and tablename = 'batch_enrollments'
  and indexname = 'batch_enrollments_user_batch_idx';
