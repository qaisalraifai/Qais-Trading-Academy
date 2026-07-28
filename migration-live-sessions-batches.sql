-- المرحلة 7: ربط البث المباشر بالدفعة (بدل ما يكون بث واحد عام للمنصة كلها)
-- شغّلي هالسكريبت مرة وحدة في Supabase → SQL Editor

alter table live_sessions
  add column if not exists batch_id uuid references batches(id);

create index if not exists live_sessions_batch_idx on live_sessions (batch_id);

-- تمنع وجود أكثر من بث نشط بنفس الوقت لنفس الدفعة (وما بتأثر على أي دفعة ثانية)
create unique index if not exists live_sessions_one_active_per_batch
  on live_sessions (batch_id)
  where is_active = true and batch_id is not null;

-- ملاحظة: البثوث القديمة (قبل هالمرحلة) بتضل موجودة بالسجل بدون batch_id،
-- وهاد طبيعي لأنها كانت بثوث عامة قبل ما يصير عنا دفعات أصلاً.
