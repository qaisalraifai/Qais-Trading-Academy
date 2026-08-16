/* ============================================================================
   lib/market-data/timeframe-consistency.js
   حارس اتساق الفريمات: هل الشمعة الكبيرة بتحتوي شموعها الصغيرة؟

   ليش هالملف موجود:
   ---------------------------------------------------------------------------
   سلسلة المزوّدين (Dukascopy → TwelveData → Yahoo) بتتراجع لمزوّد أضعف
   بصمت لما يفشل الأساسي. والفشل شائع: Dukascopy بترجّع **HTTP 429** لما
   نطلب كذا رمز/فريم بسرعة — وهاد بيصير كل مرة يشتغل الكرون.

   المشكلة إنه التراجع ممكن يخلط سلسلتين من **عقود مختلفة**. قياس فعلي على
   يوهو (٢٠٢٦-٠٨-١٥، ١٥٠ يوم لكل رمز):

       GC=F  (ذهب آجل)   ٠.٧٪ من الأيام متطابقة · خطأ ٠.٧٤٢٪
       SI=F  (فضة آجل)   ٠.٧٪ من الأيام متطابقة · خطأ ١.٤٩١٪
       NQ=F  (ناسداك)   ٧٨.٠٪ من الأيام متطابقة · خطأ ٠.١١٧٪

   مثال حقيقي — الذهب ٢٠٢٦-٠٨-١٣:
       الشمعة اليومية : أعلى 4445.00 · أدنى 4350.00
       تجميع شموعها H4: أعلى 4509.10 · أدنى 4400.00
   الشمعة اليومية **ما بتحتوي شموعها**. أي تحليل متعدد الفريمات على بيانات
   زي هاي بيبني استنتاجات على تناقض.

   الحارس ما بيصلّح البيانات ولا بيرفضها — بيكشفها ويوسمها، حتى القرار
   يكون واعي بدل ما يمرق بصمت.
   ============================================================================ */

/** ثواني الشمعة لكل فريم معروف بالمشروع. */
export const TF_SECONDS = {
  monthly: 2592000,
  weekly: 604800,
  daily: 86400,
  d1: 86400,
  h4: 14400,
  h1: 3600,
  m15: 900,
  m5: 300,
  m1: 60,
};

export function tfSeconds(tf) {
  return TF_SECONDS[String(tf || "").toLowerCase()] ?? null;
}

/**
 * مقارنة فريم كبير بفريم صغير: كل شمعة كبيرة لازم يكون مداها شامل
 * لمدى الشموع الصغيرة الواقعة ضمنها.
 *
 * @param higher   شموع الفريم الأكبر
 * @param lower    شموع الفريم الأصغر
 * @param higherSecs  ثواني شمعة الفريم الأكبر
 * @param options  { tolerance, minInnerBars, samples }
 */
export function comparePair(higher, lower, higherSecs, options = {}) {
  const { tolerance = 0.002, minInnerBars = 3, samples = 5 } = options;

  if (!Array.isArray(higher) || !Array.isArray(lower) || !higher.length || !lower.length) {
    return { value: "INSUFFICIENT_DATA", why: "إحدى السلسلتين فاضية" };
  }

  /* فهرسة الشموع الصغيرة على بداية شمعتها الكبيرة — أرخص من بحث لكل شمعة. */
  const buckets = new Map();
  for (const c of lower) {
    if (!Number.isFinite(c?.time)) continue;
    const key = Math.floor(c.time / higherSecs) * higherSecs;
    const b = buckets.get(key);
    if (b) {
      if (c.high > b.high) b.high = c.high;
      if (c.low < b.low) b.low = c.low;
      b.count++;
    } else {
      buckets.set(key, { high: c.high, low: c.low, count: 1 });
    }
  }

  let compared = 0;
  let agreeing = 0;
  let errorSum = 0;
  const worst = [];

  for (const h of higher) {
    if (!Number.isFinite(h?.time)) continue;
    const key = Math.floor(h.time / higherSecs) * higherSecs;
    const b = buckets.get(key);
    /* شمعة كبيرة ما إلها تغطية كافية بالصغير (بداية/نهاية المدى، أو عطلة)
       بتنستثنى — غيابها مش تناقض. */
    if (!b || b.count < minInnerBars) continue;

    compared++;
    const eHigh = Math.abs(b.high - h.high) / Math.abs(h.high || 1);
    const eLow = Math.abs(b.low - h.low) / Math.abs(h.low || 1);
    const err = (eHigh + eLow) / 2;
    errorSum += err;

    /* الاتساق = الشمعة الكبيرة **بتحتوي** الصغيرة (بهامش التسامح).
       تجاوز الصغير لحدود الكبير هو التناقض الحقيقي — مش مجرد اختلاف. */
    const containsHigh = b.high <= h.high * (1 + tolerance);
    const containsLow = b.low >= h.low * (1 - tolerance);
    if (containsHigh && containsLow) agreeing++;
    else {
      worst.push({
        time: h.time,
        higher: { high: h.high, low: h.low },
        innerAggregate: { high: b.high, low: b.low, bars: b.count },
        highOverflow: +(b.high - h.high).toFixed(6),
        lowOverflow: +(h.low - b.low).toFixed(6),
        errorPct: +(err * 100).toFixed(4),
      });
    }
  }

  if (compared === 0) {
    return { value: "INSUFFICIENT_DATA", why: `ما في شمعة كبيرة مغطّاة بـ${minInnerBars} شموع صغيرة على الأقل` };
  }

  worst.sort((a, b) => b.errorPct - a.errorPct);
  const agreementRate = agreeing / compared;

  return {
    compared,
    agreeing,
    agreementRate: +agreementRate.toFixed(4),
    meanErrorPct: +((errorSum / compared) * 100).toFixed(4),
    tolerance,
    samples: worst.slice(0, samples),
  };
}

/**
 * فحص كل أزواج الفريمات المتوفرة.
 *
 * @param candlesByTF  { daily: [...], h4: [...], h1: [...] }
 * @param options { tolerance, minAgreementRate, ... }
 * @returns { ok, severity, checks, warnings }
 */
export function checkTimeframeConsistency(candlesByTF, options = {}) {
  const { minAgreementRate = 0.9, ...pairOptions } = options;

  const known = Object.entries(candlesByTF || {})
    .filter(([tf, c]) => tfSeconds(tf) && Array.isArray(c) && c.length)
    .map(([tf, c]) => ({ tf, secs: tfSeconds(tf), candles: c }))
    .sort((a, b) => b.secs - a.secs); // الأكبر أولاً

  if (known.length < 2) {
    return {
      ok: true,
      severity: "none",
      checks: {},
      warnings: [],
      note: "فريم واحد أو أقل — ما في مقارنة ممكنة",
    };
  }

  const checks = {};
  const warnings = [];
  let worstRate = 1;

  for (let i = 0; i < known.length - 1; i++) {
    const hi = known[i];
    const lo = known[i + 1]; // بنقارن كل فريم بالأصغر منه مباشرة
    if (hi.secs % lo.secs !== 0) continue; // مش مضاعف — المقارنة بلا معنى

    const key = `${hi.tf}/${lo.tf}`;
    const res = comparePair(hi.candles, lo.candles, hi.secs, pairOptions);
    checks[key] = res;

    if (res.value === "INSUFFICIENT_DATA") continue;
    if (res.agreementRate < minAgreementRate) {
      worstRate = Math.min(worstRate, res.agreementRate);
      warnings.push(
        `${key}: ${(res.agreementRate * 100).toFixed(1)}% بس من شموع ${hi.tf} بتحتوي شموع ${lo.tf} تبعها ` +
          `(متوسط الفرق ${res.meanErrorPct}%) — الفريمان غالباً من مصدرين/عقدين مختلفين`
      );
    }
  }

  /* الشدة: تحت ٥٠٪ يعني السلسلتين مختلفتين فعلياً مش مجرد ضجيج. */
  const severity = warnings.length === 0 ? "none" : worstRate < 0.5 ? "critical" : "warning";

  return { ok: warnings.length === 0, severity, worstAgreementRate: warnings.length ? worstRate : 1, checks, warnings };
}
