-- تحقق من نجاح نقل بيانات المرحلة 1 — قراءة بس، ما بتغيّر أي شي.

-- 1) لازم عدد الدفعات القديمة (اللي عندها course_id) يطابق عدد السطور
--    المنقولة بجدول batch_courses.
select
  (select count(*) from batches where course_id is not null) as old_batches_with_course,
  (select count(*) from batch_courses) as migrated_rows;

-- 2) أي دفعة انطلعت بره النقل؟ (المفروض القائمة تطلع فاضية / بدون صفوف)
select b.id, b.name
from batches b
where b.course_id is not null
  and not exists (select 1 from batch_courses bc where bc.batch_id = b.id);
