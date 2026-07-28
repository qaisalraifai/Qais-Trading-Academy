-- المرحلة 1 من إعادة تصميم نظام الدفعات: فصل الدفعة عن الدورة الوحيدة.
-- بيضيف جدول وسيط batch_courses يسمح للدفعة الوحدة تحتوي أكثر من دورة،
-- وينقل كل دفعة حالية (دورة وحدة) لتصير سطر فيه تلقائيًا.
--
-- مهم: هاي المرحلة إضافية بس (Additive) — ما بتلمس أو تحذف عمود
-- batches.course_id القديم، فالموقع الشغال حاليًا ما بيتأثر إطلاقًا ولا
-- شي بينكسر. التبديل الفعلي لاستخدام الجدول الجديد بيصير بالمرحلة 3.
--
-- شغّلي هالسكريبت مرة وحدة في Supabase → SQL Editor

create table if not exists batch_courses (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  unique (batch_id, course_id)
);

create index if not exists batch_courses_batch_idx on batch_courses (batch_id);
create index if not exists batch_courses_course_idx on batch_courses (course_id);

-- نقل كل دفعة حالية: كل دفعة عندها course_id وحدة بتصير سطر بـ batch_courses
insert into batch_courses (batch_id, course_id)
select id, course_id from batches
where course_id is not null
on conflict (batch_id, course_id) do nothing;
