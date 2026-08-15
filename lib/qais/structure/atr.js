/* ============================================================================
   lib/qais/structure/atr.js
   True Range / ATR — الوحدة القياسية للتقلب داخل محرك الهيكل.

   ليش هون ومش مستوردة من lib/indicators.js: المحرك لازم يكون **مستقل وقابل
   للاختبار** لحاله (المرحلة ١)، بدون ما يجرّ معه شجرة استيراد الواجهة.

   ATR هو اللي بيخلّي المحرك يتأقلم مع الرمز والفريم تلقائياً: عتبة «الحركة
   المعتبرة» على الذهب غير عتبتها على ناسداك، وعلى D1 غير H4. أي رقم ثابت
   بيكون صح لرمز واحد وغلط للباقي.
   ============================================================================ */

/** المدى الحقيقي لشمعة واحدة (يشمل الفجوة عن إغلاق الشمعة السابقة). */
export function trueRange(candles, i) {
  const c = candles[i];
  if (!c) return null;
  const prev = candles[i - 1];
  const hl = c.high - c.low;
  if (!prev) return hl;
  return Math.max(hl, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
}

/**
 * سلسلة ATR كاملة (Wilder smoothing) — عنصر لكل شمعة، أو null قبل اكتمال
 * الفترة. بنرجّع سلسلة مش قيمة وحدة لأن كل حدث هيكلي لازم يتقاس بتقلب
 * **لحظته** هو، مش بتقلب آخر الشارت.
 */
export function atrSeries(candles, period = 14) {
  const n = Array.isArray(candles) ? candles.length : 0;
  const out = new Array(n).fill(null);
  if (n === 0 || period < 1) return out;

  let sum = 0;
  let prevAtr = null;
  for (let i = 0; i < n; i++) {
    const tr = trueRange(candles, i);
    if (tr == null || !Number.isFinite(tr)) continue;

    if (i < period) {
      sum += tr;
      if (i === period - 1) {
        prevAtr = sum / period;
        out[i] = prevAtr;
      }
      continue;
    }
    prevAtr = (prevAtr * (period - 1) + tr) / period;
    out[i] = prevAtr;
  }
  return out;
}

/**
 * قيمة ATR عند فهرس معيّن مع تراجع آمن: لو الفهرس قبل اكتمال الفترة،
 * بنرجع أول قيمة متوفرة بدل null — هيك بداية البيانات التاريخية بتضل
 * قابلة للتحليل بدل ما تنرمى كلها (حالة حافة مطلوبة صراحةً).
 */
export function atrAt(series, index) {
  if (!Array.isArray(series) || series.length === 0) return null;
  const i = Math.max(0, Math.min(index, series.length - 1));
  if (Number.isFinite(series[i])) return series[i];
  for (let k = i; k < series.length; k++) if (Number.isFinite(series[k])) return series[k];
  for (let k = i; k >= 0; k--) if (Number.isFinite(series[k])) return series[k];
  return null;
}
