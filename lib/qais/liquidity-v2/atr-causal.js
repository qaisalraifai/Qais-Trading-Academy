/* ============================================================================
   lib/qais/liquidity-v2/atr-causal.js
   وحدة التقلب لطبقة السيولة — ATR سببي بالكامل.

   ليش هالملف موجود أصلاً:
   ---------------------------------------------------------------------------
   `atrSeries` بـ`../structure/atr.js` سببية تماماً (تنعيم Wilder على شموع
   ماضية بس)، فمنعيد استخدامها متل ما هي — ما منكرر حساب ATR ولا منخترع واحد
   جديد، عشان تضل العتبات بين الطبقتين بنفس الوحدة.

   بس `atrAt` بنفس الملف **مش سببية**: لما القيمة عند الفهرس المطلوب تكون null
   (قبل اكتمال فترة الـATR) بتمسح **للأمام**:

       for (let k = i; k < series.length; k++) ...   ← بتاخد قيمة من المستقبل

   يعني حدث عند الشمعة ٥ بيتقاس بتقلب الشمعة ١٤. هاد تسريب بيانات مستقبلية
   لفهارس ماضية — وبطبقة السيولة النتيجة أخطر منها بالهيكل: عرض التسامح تبع
   «القمم المتساوية» بينحسب من تقلب ما كان معروف وقتها، فبيطلع تجميع سيولة
   ما كان ممكن يتشاف بلحظته.

   لهيك هون: مسح **للخلف فقط**. وإذا ما في ولا قيمة سابقة، بنرجّع null —
   والمستدعي بيطلّع INSUFFICIENT_DATA بسبب مكتوب، مش رقم مقدَّر.
   ============================================================================ */

import { atrSeries } from "../structure/atr.js";

export { atrSeries };

/**
 * قيمة ATR عند فهرس، بمسح خلفي حصراً.
 * @returns {number|null} null = ما في تقلب مقيس لحد هالشمعة (بداية البيانات)
 */
export function atrAtCausal(series, index) {
  if (!Array.isArray(series) || series.length === 0) return null;
  const start = Math.min(index, series.length - 1);
  if (!(start >= 0)) return null;
  for (let k = start; k >= 0; k--) {
    if (Number.isFinite(series[k]) && series[k] > 0) return series[k];
  }
  return null;
}

/**
 * عتبة سعرية بوحدة ATR عند لحظة معيّنة.
 * ما في «مبلغ ثابت» بهالطبقة إطلاقاً — كل مقارنة سعرية بتمرق من هون.
 *
 * @returns {{ok: true, value: number, atr: number} | {ok: false, why: string}}
 */
export function atrBandAt(series, index, mult) {
  const atr = atrAtCausal(series, index);
  if (atr == null) {
    return { ok: false, why: `ما في ATR مقيس لحد الشمعة ${index} — بداية البيانات قبل اكتمال الفترة` };
  }
  return { ok: true, value: atr * mult, atr };
}
