-- إضافة عمود "منصة الفيديو" لجدول المحاضرات
-- شغّلي هالسكريبت مرة وحدة في Supabase → SQL Editor

alter table lectures
  add column if not exists video_provider text not null default 'youtube';

-- (اختياري) تأكيد إن كل المحاضرات الحالية معلّمة كـ يوتيوب
-- لأن هيك كانت تشتغل قبل هالتحديث بغض النظر عن اللي كان مكتوب بالنموذج
update lectures
  set video_provider = 'youtube'
  where video_provider is null;
