/* ============================================================================
   lib/qais/structure/displacement.js
   تصنيف الزخم: Weak | Normal | Strong | Extreme

   المحرك القديم كان بوليان من عامل واحد: المدى >= 1.5× متوسط آخر ٢٠ شمعة.
   عامل واحد بيخلط بين شمعة اندفاع حقيقية وشمعة ذيول طويلة بجسم صغير
   (تذبذب عنيف) — والاثنين إلهم نفس المدى.

   هون التصنيف من عوامل مستقلة، وكل عامل بيرجّع دليله بالاسم حتى يكون
   القرار قابل للتفسير:

     1) المدى مقابل ATR           — حجم الحركة بوحدة تقلب الرمز نفسه
     2) نسبة الجسم للمدى           — اندفاع حقيقي مش ذيول
     3) شموع متتالية بنفس الاتجاه  — استمرارية مش شمعة يتيمة
     4) فجوة سعرية (FVG بسيطة)     — أقوى بصمة زخم بمنهجية SK
     5) الفوليوم مقابل متوسطه      — **بس إذا كان متوفر فعلياً**

   قاعدة: العامل غير المتوفر ما بيتحسب ولا بينحسب ضده — بينشال من المقام
   ويتسجّل بـ`unavailable`. ما منخترع قيمة ناقصة.
   ============================================================================ */

import { atrSeries, atrAt } from "./atr.js";

export const DISPLACEMENT_LEVELS = ["Weak", "Normal", "Strong", "Extreme"];

/** هل في فجوة سعرية ثلاثية مركزها الشمعة i؟ (قاع i+1 فوق قمة i-1، أو العكس) */
function hasGapAround(candles, i, dirUp) {
  const a = candles[i - 1];
  const b = candles[i + 1];
  if (!a || !b) return false;
  return dirUp ? b.low > a.high : b.high < a.low;
}

/** عدد الشموع المتتالية بنفس اتجاه الجسم المنتهية عند i (بتشمل i). */
function consecutiveRun(candles, i, dirUp) {
  let n = 0;
  for (let k = i; k >= 0; k--) {
    const c = candles[k];
    const up = c.close > c.open;
    const down = c.close < c.open;
    if (dirUp ? !up : !down) break;
    n++;
  }
  return n;
}

function avgVolume(candles, i, period) {
  let sum = 0;
  let n = 0;
  for (let k = Math.max(0, i - period); k < i; k++) {
    const v = candles[k]?.volume;
    if (Number.isFinite(v) && v > 0) {
      sum += v;
      n++;
    }
  }
  return n >= Math.ceil(period / 2) ? sum / n : null;
}

/**
 * تصنيف شمعة واحدة.
 * بيرجّع { level, score, factors[], reason, confidence } — و`confidence`
 * محسوبة من نسبة العوامل المتوفرة اللي تحققت، فهي رقم من بيانات حقيقية
 * مش تقدير.
 */
export function classifyDisplacement(candles, index, options = {}) {
  const {
    atrPeriod = 14,
    volumePeriod = 20,
    rangeStrong = 1.5, // مدى >= 1.5× ATR
    rangeExtreme = 2.5,
    bodyRatioMin = 0.55,
    runMin = 2,
    volumeMult = 1.3,
    precomputedAtr = null,
  } = options;

  const c = candles?.[index];
  if (!c) return null;

  const atr = precomputedAtr || atrSeries(candles, atrPeriod);
  const atrVal = atrAt(atr, index);

  const range = c.high - c.low;
  const body = Math.abs(c.close - c.open);
  const dirUp = c.close > c.open;
  const direction = dirUp ? "up" : c.close < c.open ? "down" : null;

  const factors = [];
  const add = (name, passed, detail, available = true) =>
    factors.push({ name, passed: available ? !!passed : null, available, detail });

  // 1) المدى مقابل ATR
  const rangeRatio = atrVal && atrVal > 0 ? range / atrVal : null;
  add(
    "range",
    rangeRatio != null && rangeRatio >= rangeStrong,
    rangeRatio != null ? `المدى ${rangeRatio.toFixed(2)}× ATR` : "ATR غير متوفر",
    rangeRatio != null
  );

  // 2) نسبة الجسم
  const bodyRatio = range > 0 ? body / range : null;
  add(
    "body",
    bodyRatio != null && bodyRatio >= bodyRatioMin,
    bodyRatio != null ? `الجسم ${(bodyRatio * 100).toFixed(0)}% من المدى` : "مدى صفر",
    bodyRatio != null
  );

  // 3) شموع متتالية
  const run = direction ? consecutiveRun(candles, index, dirUp) : 0;
  add("run", run >= runMin, `${run} شمعة متتالية بنفس الاتجاه`, !!direction);

  // 4) فجوة سعرية — غير متاحة على آخر شمعة (بدها الشمعة اللي بعدها)
  const gapAvailable = index > 0 && index < candles.length - 1 && !!direction;
  const gap = gapAvailable ? hasGapAround(candles, index, dirUp) : false;
  add("gap", gap, gap ? "فجوة سعرية حول الشمعة" : "ما في فجوة", gapAvailable);

  // 5) الفوليوم — بس إذا موجود فعلياً بالبيانات
  const vol = c.volume;
  const avgVol = Number.isFinite(vol) && vol > 0 ? avgVolume(candles, index, volumePeriod) : null;
  const volAvailable = avgVol != null && avgVol > 0;
  add(
    "volume",
    volAvailable && vol >= avgVol * volumeMult,
    volAvailable ? `الفوليوم ${(vol / avgVol).toFixed(2)}× متوسطه` : "فوليوم غير متوفر",
    volAvailable
  );

  const availableFactors = factors.filter((f) => f.available);
  const passedFactors = availableFactors.filter((f) => f.passed);
  const score = availableFactors.length ? passedFactors.length / availableFactors.length : 0;

  /* المستوى: بوابتان مستقلتان لازم تنفتحوا سوا قبل Strong/Extreme —
       المدى  = حجم الحركة بوحدة تقلب الرمز
       الجسم = إنه فعلاً اندفاع مش ذيول

     ليش الجسم بوابة مش صوت: أول تشغيل للاختبارات طلّع شمعة دوجي مداها
     ٢٩× ATR وجسمها ١٪ مصنّفة Extreme — لأنها كسبت أغلبية الأصوات من
     المدى والتتابع بينما الجسم صوت خاسر واحد. شمعة بذيول ضخمة وجسم شبه
     صفر هي تذبذب عنيف، عكس الزخم تماماً. الأغلبية وحدها ما بتكفي هون. */
  const bodyGateOpen = bodyRatio != null && bodyRatio >= bodyRatioMin;

  let level = "Weak";
  if (rangeRatio != null) {
    if (rangeRatio >= rangeExtreme && bodyGateOpen && score >= 0.6) level = "Extreme";
    else if (rangeRatio >= rangeStrong && bodyGateOpen && score >= 0.5) level = "Strong";
    else if (rangeRatio >= 1.0 || score >= 0.5) level = "Normal";
  } else if (score >= 0.5) {
    level = "Normal";
  }

  const reason = passedFactors.length
    ? passedFactors.map((f) => f.detail).join(" · ")
    : "ما تحقق ولا عامل زخم";

  return {
    level,
    direction,
    score: +score.toFixed(3),
    rangeRatio: rangeRatio != null ? +rangeRatio.toFixed(3) : null,
    bodyRatio: bodyRatio != null ? +bodyRatio.toFixed(3) : null,
    factors,
    unavailable: factors.filter((f) => !f.available).map((f) => f.name),
    reason,
    /* الثقة = نسبة العوامل المتوفرة اللي تحققت. لو العوامل المتوفرة أقل من
       ٣، الثقة بتنزل لأن القرار مبني على أدلة أقل — مش لأننا خمّنا. */
    confidence: +(score * Math.min(1, availableFactors.length / 3)).toFixed(3),
  };
}

/** مقارنة مستويين — بتُستخدم لشرط «زخم كافٍ» بأحداث الهيكل. */
export function atLeast(level, min) {
  return DISPLACEMENT_LEVELS.indexOf(level) >= DISPLACEMENT_LEVELS.indexOf(min);
}
