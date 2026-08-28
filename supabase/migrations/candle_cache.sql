-- ════════════════════════════════════════════════════════════════════════
-- candle_cache — مخزن الشموع التاريخية
-- ────────────────────────────────────────────────────────────────────────
-- بقراره (٢٠٢٦-٠٨-٢٨): الشموع التاريخية ما بتتغيّر، فما في داعي نسأل
-- Dukascopy عنها كل مرة. الأرشيف بيخنق رقم خروج Vercel المشترك، فكل طلب
-- مكرَّر بياكل حصة بلا مقابل.
--
-- الصف = دلو من ~180 شمعة (intervalSec × 180). حجم ثابت تقريباً مهما كان
-- الفريم، ومدى الدلو اللحظي بيضل تحت عتبة الأرشيف المقيسة (~360 يوم).
--
-- ⚠️ الرقم 180 مقاس: بـ1440 صار دلو الـ4 ساعات 240 يوم، بينما أصغر جلبة
--    ناجحة مقيسة 237 شمعة = 39 يوم — فولا دلو بيكتمل والمخزن ما بيتعبّى.
--
-- ⚠️ ما بينكتب إلا دلو **مكتمل** — شوف completeBuckets بـlib/candle-store.js.
--    دلو ناقص بينخزّن بيجمّد نقصه للأبد.
--
-- ⚠️ الحذف تحت **آمن**: هاد جدول كاش بحت، كل صف فيه قابل لإعادة الجلب من
--    المزوّد. ما فيه ولا بيانات مستخدم. وهو موجود عشان لصقة جزئية سابقة
--    ممكن تكون خلّفت جدولاً ناقص الأعمدة، فـ`create ... if not exists`
--    بيتخطّاه بصمت وبعدها الفهرس بيفشل بـ«column bucket does not exist».
-- ════════════════════════════════════════════════════════════════════════

drop table if exists public.candle_cache;

create table public.candle_cache (
  symbol      text        not null,
  interval    text        not null,
  bucket      bigint      not null,
  bars        integer     not null default 0,
  candles     jsonb       not null,
  created_at  timestamptz not null default now(),
  primary key (symbol, interval, bucket)
);

-- القراءة دايماً بمدى دلاء لرمز/فريم واحد.
create index candle_cache_lookup
  on public.candle_cache (symbol, interval, bucket);

-- ⚠️ الكتابة والقراءة من الخادم وحده (Service Role عبر createAdminClient).
--    ما في أي مسار عميل بيلمس هالجدول، فالـRLS مقفول بلا أي سياسة:
--    Service Role بيتجاوزه، وأي مفتاح عام ما بيشوف ولا صف.
alter table public.candle_cache enable row level security;

comment on table public.candle_cache is
  'شموع تاريخية مخزنة بدلاء ~1440 شمعة. للخادم فقط - لا تضيف سياسات RLS عامة.';
