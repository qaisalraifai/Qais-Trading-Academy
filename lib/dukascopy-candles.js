/* ============================================================================
   lib/dukascopy-candles.js
   جالب شموع Dukascopy — مصدر مجاني بالكامل وبدون مفتاح API، هدفه يحل مشكلة
   "حد العمق التاريخي" اللي عند Yahoo Finance (يوهو ما بتحتفظ بشموع الدقيقة
   لأكتر من ~29 يوم للخلف، و5min/15min لحوالي 58 يوم بس - هاد حد بالبيانات
   نفسها عند يوهو، مش حد بعدد الطلبات، فزيادة الطلبات ما بتحل المشكلة).

   Dukascopy (بنك سويسري) عنده بيانات تاريخية تيك-باي-تيك من أول ~2003-2017
   (حسب الأداة) لليوم، لأكتر من 1000 أداة (فوركس، معادن، كريبتو، مؤشرات،
   أسهم)، عام بالكامل وبدون تسجيل. منستخدم مكتبة "dukascopy-node" مفتوحة
   المصدر (npm) اللي بتتعامل مع تنزيل وفك ملفات .bi5 المضغوطة نيابة عنا
   وترجع شموع OHLC جاهزة.

   الفرق عن Yahoo/Twelve Data: هاي مو نقطة نهاية REST سريعة برد JSON فوري -
   المكتبة بتنزّل ملف لكل ساعة/يوم من أرشيف Dukascopy وتجمّعهم، فأول طلب
   لمدى طويل ممكن ياخد كذا ثانية (مش مشكلة هون لأنها بس لأداة الريبلاي
   التاريخية، مش للايف). ما في حد رسمي على عدد الطلبات، بس لازم استخدام
   معقول (batchSize/pause تحت مضبوطين عشان ما نقصف الأرشيف بسرعة جنونية).

   useCache: false عمداً - السيرفرليس (Vercel) نظام ملفاته للقراءة فقط
   تقريباً بكل مكان إلا /tmp المؤقت، فمنعتمد بس على fetch بالميموري بدون أي
   كتابة على القرص.
   ============================================================================ */

import { getHistoricalRates } from "dukascopy-node";

/* فريمات المشروع (1min|5min|15min|1h|4h|1day) → تسمية Dukascopy (m1|m5|m15|h1|h4|d1) */
const INTERVAL_TO_DUKASCOPY = {
  "1min": "m1",
  "5min": "m5",
  "15min": "m15",
  "1h": "h1",
  "4h": "h4",
  "1day": "d1",
};

const INTERVAL_SECONDS = {
  "1min": 60,
  "5min": 300,
  "15min": 900,
  "1h": 3600,
  "4h": 4 * 3600,
  "1day": 24 * 3600,
};

/**
 * يجيب شموع OHLC تاريخية من Dukascopy - بدون حد عمق زمني عملي (لغاية بداية
 * تغطية الأداة نفسها عند Dukascopy، سنين للخلف عادة).
 * @param {string} instrument - رمز Dukascopy (مثل "xauusd"، "eurusd"، بحروف صغيرة)
 * @param {string} interval - أحد مفاتيح INTERVAL_TO_DUKASCOPY (1min|5min|15min|1h|4h|1day)
 * @param {number} wanted - عدد الشموع المطلوبة تقريباً (يُقص لآخر N شمعة)
 * @param {number|null} anchorTimestamp - نقطة قص/Replay اختيارية (Unix seconds)
 * @returns {Promise<{candles: Array}|{error: string}>}
 */
export async function fetchDukascopyCandles(instrument, interval = "15min", wanted = 1000, anchorTimestamp = null) {
  const timeframe = INTERVAL_TO_DUKASCOPY[interval];
  if (!timeframe) {
    return { error: `فريم غير مدعوم عند Dukascopy: ${interval}` };
  }
  if (!instrument) {
    return { error: "لا يوجد رمز Dukascopy لهذا الأصل" };
  }

  const secPerBar = INTERVAL_SECONDS[interval] || 900;
  const count = Math.min(Number(wanted) || 1000, 20000);
  const nowMs = Date.now();

  /* حماية حرجة: مكتبة dukascopy-node عندها باغ موثّق (Issue #186 على
     GitHub تبعها) - لما يكون "to" المطلوب قريب جداً من الوقت الحالي فعلياً
     ("الآن")، getHistoricalRates بتدخل تسريب ذاكرة وبتطيح الـ process كامل
     بـ"JavaScript heap out of memory" - وهاد الخطأ **مش قابل للإمساك حتى
     بـtry/catch** (بيطيح الـ Node process نفسه، مش بس الـ promise). هاد
     بالضبط كان سبب الـ502 العام (بدون أي JSON body) يلي كنا نشوفه بالكونسول:
     الفنكشن كانت تنهار قبل ما توصل حتى لسطر catch تحت. أرشيف Dukascopy أصلاً
     بيتأخر بالنشر عن اللحظة الحالية (مش لحظي)، فمافي خسارة بيانات حقيقية
     بفرض هامش أمان هون - بس لازم نضمن إنه "to" ما يوصل أبداً لآخر ساعتين. */
  const NOW_SAFETY_MARGIN_MS = 2 * 60 * 60 * 1000;
  const safeNowMs = nowMs - NOW_SAFETY_MARGIN_MS;

  /* منحسب نافذة تغطي عدد الشموع المطلوب (+ هامش 25%) - لو في anchor منخليها
     تنتهي شوي بعد نقطة القص (زي نفس منطق anchor بيوهو/Twelve Data بالضبط)
     عشان الريبلاي يقدر يفوت لأبعد منها، وإلا منخليها تاريخ اليوم (بهامش
     الأمان فوق، مش "الآن" حرفياً). */
  const bufferSeconds = Math.max(secPerBar * 300, 3 * 24 * 60 * 60);
  const spanMs = Math.ceil(secPerBar * count * 1.25) * 1000;

  let toMs, fromMs;
  if (anchorTimestamp && Number.isFinite(anchorTimestamp)) {
    toMs = Math.min(safeNowMs, (anchorTimestamp + bufferSeconds) * 1000);
    fromMs = anchorTimestamp * 1000 - spanMs;
  } else {
    toMs = safeNowMs;
    fromMs = safeNowMs - spanMs;
  }
  if (fromMs >= toMs) fromMs = toMs - secPerBar * 1000 * 10;

  /* حماية ثانية مهمة: Dukascopy عمرها الفعلي يبلّش من 2003 تقريباً (وبعض
     الأدوات لاحقاً - 2016/2017). بس لما يكون count=20000 (الافتراضي من
     الواجهة) وinterval يومي/ساعة، الحساب فوق (secPerBar*count*1.25) بينتج
     مدى تاريخي بعشرات السنين (يوصل لما قبل 1970!) - يعني الكود كان عم
     يطلب من Dukascopy عشرات/مئات الشهور "الفاضية" يلي مافيها بيانات أصلاً
     (قبل وجود الأداة عند Dukascopy)، والمكتبة كانت تحاول تجيبهم كلهم (بمحاولات
     إعادة retryCount لكل شهر فاشل) لحد ما تضرب مهلة withTimeout فوق بدون ما
     توصل حتى لسنين البيانات الحقيقية - فكانت تفشل بصمت وترجع الكود للاحتياطي
     (Yahoo)، ويوهو لليومي بالفوركس تحديداً محدود بعمد بسنتين بس (شوفي
     isDailyForex بـlib/yahoo-candles.js). هاد بالضبط كان سبب "الفوركس بيجيب
     سنتين بس" رغم إنه duk موجود ومفروض يرجّع سنين أكتر بكثير. الحل: منمنع
     fromMs من النزول قبل بداية تغطية Dukascopy الفعلية، بغض النظر عن count
     المطلوب - هيك الطلب يغطي فقط السنين يلي فيها بيانات حقيقية، وبيخلص
     أسرع بكثير وجوا المهلة المسموحة. */
  const DUKASCOPY_EARLIEST_MS = Date.UTC(2003, 0, 1); // 2003-01-01 UTC
  if (fromMs < DUKASCOPY_EARLIEST_MS) fromMs = DUKASCOPY_EARLIEST_MS;
  if (fromMs >= toMs) fromMs = toMs - secPerBar * 1000 * 10;

  let raw;
  try {
    raw = await getHistoricalRates({
      instrument,
      dates: { from: new Date(fromMs), to: new Date(toMs) },
      timeframe,
      priceType: "bid",
      format: "json",
      volumes: true,
      ignoreFlats: true, // بتشيل شموع عطلة الأسبوع "المسطّحة" تلقائياً - نفس مشكلة الشحطة الرفيعة اللي بنعالجها يدوياً بيوهو/Twelve Data
      useCache: false,
      batchSize: 20,
      pauseBetweenBatchesMs: 150,
      retryCount: 2,
      pauseBetweenRetriesMs: 400,
    });
  } catch (e) {
    const msg = e?.validationErrors ? JSON.stringify(e.validationErrors) : e?.message || String(e);
    return { error: `تعذّر جلب بيانات Dukascopy: ${msg}` };
  }

  if (!Array.isArray(raw) || !raw.length) {
    return { error: "Dukascopy ما رجّعت أي شموع لهذا الرمز/الفريم/المدى الزمني" };
  }

  const candles = raw
    .map((v) => ({
      time: Math.floor(v.timestamp / 1000),
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: Number.isFinite(Number(v.volume)) ? Number(v.volume) : 0,
    }))
    .filter(
      (c) =>
        Number.isFinite(c.time) &&
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close)
    )
    .sort((a, b) => a.time - b.time)
    .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);

  if (!candles.length) {
    return { error: "بيانات Dukascopy وصلت لكن كلها غير صالحة" };
  }

  return { candles: candles.slice(-count) };
}
