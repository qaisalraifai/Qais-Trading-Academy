/* ============================================================================
   lib/market-data/timeframe-consistency.js
   حارس اتساق الفريمات: هل الشمعة الكبيرة بتحتوي شموعها الصغيرة؟

   ليش هالملف موجود:
   ---------------------------------------------------------------------------
   سلسلة المزوّدين (Dukascopy → TwelveData → Yahoo) بتتراجع لمزوّد أضعف
   بصمت لما يفشل الأساسي. والفشل شائع: Dukascopy بترجّع **HTTP 429** لما
   نطلب كذا رمز/فريم بسرعة — وهاد بيصير كل مرة يشتغل الكرون.

   المشكلة إنه التراجع ممكن يخلط سلسلتين من **عقود مختلفة**. قياس على يوهو
   بعد تصحيح التجميع (شوف التحذير تحت):

       GC=F  (ذهب آجل)   ١٦.٩٪ من الأيام متطابقة · خطأ ٠.٥٣١٪
       NQ=F  (ناسداك)   ٧٨.٠٪ · خطأ ٠.١١٧٪
       مقابل Dukascopy : ١٠٠.٠٪ · خطأ ٠.٠٠٠٪

   مثال حقيقي — الذهب ٢٠٢٦-٠٨-١٣ من يوهو:
       الشمعة اليومية : أعلى 4445.00 · أدنى 4350.00
       تجميع شموعها H4: أعلى 4509.10 · أدنى 4400.00
   الشمعة اليومية **ما بتحتوي شموعها**. أي تحليل متعدد الفريمات على بيانات
   زي هاي بيبني استنتاجات على تناقض.

   ⚠️ الأرقام الأولى المنشورة (٠.٧٪ للذهب) كانت مضخّمة: التجميع كان بشبكة
   epoch والذهب بيفتح ٠٤:٠٠ UTC، فجزء من «التناقض» كان أثر محاذاة. الرقم
   الصحيح ١٦.٩٪ — لسا تناقض حقيقي، بس أقل قسوة.

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

  /* ============================================================================
     التجميع على **حدود الشمعة الكبيرة الفعلية**، مش على شبكة epoch.
     ----------------------------------------------------------------------------
     النسخة السابقة كانت تقسّم بـ`Math.floor(t / higherSecs) * higherSecs`.
     هاد صحيح بس إذا صادف إنه أوقات الشموع منحاذية على شبكة epoch — يعني
     الشمعة اليومية بتبلّش ٠٠:٠٠ UTC. والعقود والفوركس بتفتح ٢٢:٠٠ أو
     ٢٣:٠٠، فسلة منتصف الليل بتلمّ شموع من **يومين مختلفين**.

     مُعاد إنتاجه على بيانات متّسقة بالبناء (كل شمعة يومية = تجميع شموعها
     الست بالضبط):
         فتح ٠٠:٠٠ → توافق ١٠٠.٠٪ · شدة none
         فتح ٢٢:٠٠ → توافق ٠.٠٪   · شدة critical
     نفس البيانات، وحكم معاكس تماماً. والأسبوعي أسوأ: أسبوع epoch بيبلّش
     **خميس**، فشمعة أسبوعية بتفتح الاثنين بتتقارن بجزء من شموعها وبتنجح
     بصمت.

     الصح: لكل شمعة كبيرة، منلم الشموع الصغيرة الواقعة ضمن مداها الحقيقي
     [t, t + higherSecs) — مقصوص عند بداية الشمعة الكبيرة التالية حتى ما
     يصير تداخل لو كانت الأوقات غير منتظمة.
     ============================================================================ */
  const hi_ = higher.filter((h) => Number.isFinite(h?.time)).sort((a, b) => a.time - b.time);
  const lo_ = lower.filter((c) => Number.isFinite(c?.time)).sort((a, b) => a.time - b.time);

  let compared = 0;
  let agreeing = 0;
  let errorSum = 0;
  const worst = [];
  let j = 0; // مؤشر متقدّم على الشموع الصغيرة — مسح خطي مش بحث لكل شمعة

  for (let k = 0; k < hi_.length; k++) {
    const h = hi_[k];
    const next = hi_[k + 1];
    const end = next ? Math.min(h.time + higherSecs, next.time) : h.time + higherSecs;

    while (j < lo_.length && lo_[j].time < h.time) j++;
    let b = null;
    for (let m = j; m < lo_.length && lo_[m].time < end; m++) {
      const c = lo_[m];
      if (!b) b = { high: c.high, low: c.low, count: 1 };
      else {
        if (c.high > b.high) b.high = c.high;
        if (c.low < b.low) b.low = c.low;
        b.count++;
      }
    }

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
      /* «unknown» مش «none» — ما في تناقض **مكتشف**، بس كمان ما انفحص شي.
         الخلط بينهم بيحوّل الحارس لضوء أخضر كاذب. */
      severity: "unknown",
      verifiedPairs: 0,
      checks: {},
      warnings: [],
      note: "فريم واحد أو أقل — ما في مقارنة ممكنة",
    };
  }

  const checks = {};
  const warnings = [];
  let worstRate = 1;
  let verifiedPairs = 0;

  for (let i = 0; i < known.length - 1; i++) {
    const hi = known[i];
    const lo = known[i + 1]; // بنقارن كل فريم بالأصغر منه مباشرة
    if (hi.secs % lo.secs !== 0) continue; // مش مضاعف — المقارنة بلا معنى

    const key = `${hi.tf}/${lo.tf}`;
    const res = comparePair(hi.candles, lo.candles, hi.secs, pairOptions);
    checks[key] = res;

    if (res.value === "INSUFFICIENT_DATA") continue;
    verifiedPairs++;
    if (res.agreementRate < minAgreementRate) {
      worstRate = Math.min(worstRate, res.agreementRate);
      warnings.push(
        `${key}: ${(res.agreementRate * 100).toFixed(1)}% بس من شموع ${hi.tf} بتحتوي شموع ${lo.tf} تبعها ` +
          `(متوسط الفرق ${res.meanErrorPct}%) — الفريمان غالباً من مصدرين/عقدين مختلفين`
      );
    }
  }

  /* ============================================================================
     الشدة: تحت ٥٠٪ يعني السلسلتين مختلفتين فعلياً مش مجرد ضجيج.

     و«unknown» لما ما ينفحص ولا زوج: كانت النسخة السابقة ترجّع
     `ok: true · severity: "none" · worstAgreementRate: 1` لما كل الأزواج
     تطلع INSUFFICIENT_DATA — يعني ضوء أخضر كامل على صفر فحص. والحارس
     بينقرا بالضبط لاتخاذ قرار، فما بينفع يخلط «فحصت وطلعت سليمة» مع
     «ما قدرت أفحص».
     ============================================================================ */
  const severity =
    verifiedPairs === 0 ? "unknown" : warnings.length === 0 ? "none" : worstRate < 0.5 ? "critical" : "warning";

  return {
    ok: warnings.length === 0,
    severity,
    verifiedPairs,
    worstAgreementRate: warnings.length ? worstRate : verifiedPairs > 0 ? 1 : null,
    checks,
    warnings,
    ...(verifiedPairs === 0 ? { note: "ما انفحص ولا زوج فريمات — تغطية غير كافية" } : {}),
  };
}
