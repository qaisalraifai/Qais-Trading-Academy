-- استعلام تحقق سريع: شغّليه بالـ SQL Editor وبيطلعلك قائمة بكل الجداول
-- المفروض تكون موجودة مع عمود exists (true/false) لكل وحدة.
-- ما بيغيّر أو يحذف أي شي — قراءة بس.

select expected.table_name,
       exists (
         select 1 from information_schema.tables t
         where t.table_schema = 'public' and t.table_name = expected.table_name
       ) as table_exists
from (values
  ('batches'),                 -- المرحلة 1: جوهر نظام الدفعات
  ('batch_enrollments'),       -- المرحلة 1: تسجيل الطالب بدفعته
  ('live_sessions'),           -- البث المباشر (مربوط بدفعة من المرحلة 7)
  ('live_attendance'),         -- المرحلة 8: الحضور
  ('batch_announcements'),     -- المرحلة 9: الإعلانات
  ('batch_files'),             -- المرحلة 10: الملفات
  ('batch_assignments'),       -- المرحلة 11: الواجبات
  ('assignment_submissions'),  -- المرحلة 11: تسليمات الواجبات
  ('batch_chat_messages'),     -- المرحلة 12: الدردشة
  ('batch_certificates')       -- المرحلة 13: الشهادات
) as expected(table_name)
order by expected.table_name;

-- تحقق إضافي: تأكدي إن عمود batch_id متل ما لازم موجود بجدول lectures
-- (لازم يكون موجود من المرحلة 2، وإلا فلترة المحتوى حسب الدفعة ما رح تشتغل)
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'lectures' and column_name = 'batch_id';
