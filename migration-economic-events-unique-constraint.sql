-- إصلاح: إضافة قيد UNIQUE مركّب لجدول economic_events، وهو مطلوب عشان
-- upsert(rows, { onConflict: "event_date,event_title,currency" }) بملف
-- lib/economic-calendar.js يشتغل صح. بدون هاد القيد، Postgres بيرفض كل
-- عملية upsert برسالة "no unique or exclusion constraint matching the
-- ON CONFLICT specification" — وهاد بالضبط سبب "stored: 0" و"errors" عالية
-- يلي ظهرت لما جربنا التحديث اليدوي.

-- شيلي أي صفوف مكررة أولاً (لو موجودة) قبل إضافة القيد، وإلا الأمر تحت رح يفشل:
DELETE FROM economic_events a
USING economic_events b
WHERE a.ctid < b.ctid
  AND a.event_date = b.event_date
  AND a.event_title = b.event_title
  AND a.currency = b.currency;

-- إضافة القيد نفسه (الاسم مو مهم، بس لازم يكون على الأعمدة التلاتة سوا):
ALTER TABLE economic_events
  ADD CONSTRAINT economic_events_date_title_currency_key
  UNIQUE (event_date, event_title, currency);
