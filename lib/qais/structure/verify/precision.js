/* ============================================================================
   lib/qais/structure/verify/precision.js
   حجم التِك (tick size) — مستنتَج من **شبكة السوق الفعلية**، مش من عدد
   الخانات العشرية.

   ليش التمييز مهم:
   ---------------------------------------------------------------------------
   `29834.75` فيه خانتين عشريتين، بس عقد ناسداك الآجل بيتحرك بشبكة 0.25.
   لو اعتبرنا التِك 0.01 بيصير التسامح أضيق ٢٥ مرة من الواقع، وكل فرق سعري
   طبيعي بيتحوّل لـ«خطأ» — فالدقة بتقيس افتراضنا عن البيانات بدل ما تقيس
   المحرك.

   الطريقة:
     ١) تقريب الأسعار لأكبر عدد خانات متكرر (بيشيل ضجيج الفاصلة العائمة).
     ٢) تحويلها لأعداد صحيحة على نفس المقياس.
     ٣) فحص سلّم مرشّحات (١ · ٢ · ٥ · ٢٥ × قوى العشرة) وأخذ **أكبر** واحد
        بيقسم ٩٩.٩٪ من الأسعار — هاي هي الشبكة الحقيقية.
     ٤) الخانات العشرية بتضل مستعملة للعرض/التنسيق فقط.

   لو ما طلعت شبكة موثوقة: tickSize = unknown، وبينتقل التحقق لمعيار بديل
   **معلَن** (نسبة من ATR) بدل تخمين صامت.
   ============================================================================ */

export const TOLERANCE_MODES = {
  TICK: "tick_multiple",
  ATR: "atr_relative",
};

export const MAX_DIGITS = 8;

/**
 * أصغر عدد خانات بيمثّل القيمة بالضبط — مش طول النص.
 *
 * `String(v)` بيتأثر بضجيج الفاصلة العائمة (1.0832100000000001 بيطلع ١٦
 * خانة) فبينفخ الدقة ويخلّي شبكة السوق تبان أنعم مما هي. المقارنة بإعادة
 * التقريب بتعطي أصغر تمثيل صادق.
 */
function decimalsOf(v) {
  if (!Number.isFinite(v)) return null;
  for (let d = 0; d <= MAX_DIGITS; d++) {
    const p = Math.pow(10, d);
    if (Math.abs(Math.round(v * p) / p - v) < 1e-9) return d;
  }
  return MAX_DIGITS;
}

/* مانتيسات بتغطي شبكات الأدوات الحقيقية: 0.01 · 0.25 · 0.5 · 1 · 5 · 25 ... */
const MANTISSAS = [1, 2, 5, 25];

/**
 * @returns {
 *   instrument, tickSize, precision, tickSizeSource, tickSizeConfidence,
 *   coverage, candidatesTested, sampled
 * }
 */
export function inferPrecision(candles, options = {}) {
  const { instrument = null, sampleSize = 2000, coverageThreshold = 0.999 } = options;

  const base = {
    instrument,
    tickSize: null,
    precision: null,
    tickSizeSource: "unavailable",
    tickSizeConfidence: "low",
    coverage: null,
    candidatesTested: 0,
    sampled: 0,
  };

  if (!Array.isArray(candles) || candles.length === 0) return base;

  /* -------- ١) دقة العرض: أكبر عدد خانات **متكرر** -------- */
  const step = Math.max(1, Math.floor(candles.length / sampleSize));
  const decCounts = new Map();
  const values = [];

  for (let i = 0; i < candles.length; i += step) {
    for (const key of ["open", "high", "low", "close"]) {
      const v = candles[i]?.[key];
      if (!Number.isFinite(v)) continue;
      const d = decimalsOf(v);
      if (d != null) decCounts.set(d, (decCounts.get(d) || 0) + 1);
      values.push(v);
    }
  }
  if (values.length === 0) return base;

  const minOccurrences = Math.max(2, Math.floor(values.length * 0.01));
  let digits = 0;
  for (const [d, c] of decCounts) if (c >= minOccurrences && d > digits) digits = d;

  const result = { ...base, precision: digits, sampled: values.length };

  /* عيّنة صغيرة ما بتسمح باستنتاج شبكة — التصريح أفضل من التخمين. */
  if (values.length < 200) {
    result.tickSizeSource = "insufficient_sample";
    return result;
  }

  /* -------- ٢) أعداد صحيحة على مقياس الخانات -------- */
  const scale = Math.pow(10, digits);
  const ints = values.map((v) => Math.round(v * scale));

  const distinct = new Set(ints).size;
  if (distinct < 50) {
    /* أسعار قليلة التنوّع (رمز جامد أو بيانات مكرّرة): أي شبكة رح تنقبل
       صدفة. ما منستنتج. */
    result.tickSizeSource = "insufficient_price_variation";
    return result;
  }

  /* -------- ٣) سلّم المرشّحات: أكبر خطوة بتقسم شبه كل الأسعار -------- */
  const candidates = [];
  for (let exp = 0; exp <= digits + 3; exp++) {
    for (const m of MANTISSAS) {
      const g = m * Math.pow(10, exp);
      if (g >= 1 && Number.isInteger(g)) candidates.push(g);
    }
  }
  candidates.sort((a, b) => a - b);

  let best = null;
  let bestCoverage = 0;
  for (const g of candidates) {
    let hit = 0;
    for (const p of ints) if (p % g === 0) hit++;
    const coverage = hit / ints.length;
    if (coverage >= coverageThreshold) {
      best = g; // بنكمل، منبقى ناخد الأكبر اللي بينجح
      bestCoverage = coverage;
    }
  }
  result.candidatesTested = candidates.length;

  if (best == null) {
    /* ولا خطوة بتفسّر البيانات — غالباً أسعار معدّلة/محوّلة عملة. */
    result.tickSizeSource = "no_consistent_grid";
    return result;
  }

  result.tickSize = best / scale;
  result.coverage = +bestCoverage.toFixed(5);
  result.distinctPrices = distinct;

  /* ============================================================================
     أهم تحفّظ هون: `best === 1` يعني «ما لقينا شبكة **أخشن** من دقة العرض».
     وهاد بديهي — أصغر مرشّح بيقسم كل عدد صحيح مهما كانت البيانات. فحص
     الاختبارات على أسعار عشوائية بحتة طلّع تِك 1e-8 بثقة high من هالثغرة.

     التمييز: لو دقة العرض معقولة (≤٥ خانات، متل الفوركس والأسهم) فشبكة
     مساوية إلها احتمال حقيقي. لو الدقة وصلت السقف، فهاد ضجيج فاصلة عائمة
     أو أسعار محوّلة — مش شبكة.
     ============================================================================ */
  if (best === 1) {
    result.tickSizeSource = "grid_equals_display_resolution";
    result.tickSizeConfidence = digits >= MAX_DIGITS ? "low" : digits <= 5 ? "medium" : "low";
    if (result.tickSizeConfidence === "low") result.tickSize = null;
    return result;
  }

  result.tickSizeSource = "inferred_from_market_data";
  /* ثقة عالية بس مع عيّنة كبيرة **وتنوّع سعري كافي** — الاتنين لازمين:
     تغطية ١٠٠٪ على ٦٠ سعر مكرّر ما بتعني شبكة حقيقية. */
  result.tickSizeConfidence = values.length >= 800 && distinct >= 200 ? "high" : "medium";

  return result;
}

/**
 * وضع التسامح المعتمد + قيمته — **معلَن دايماً** بالتقرير.
 * مع تِك موثوق: مضاعف تِك. غير هيك: نسبة من ATR، وبينتكتب صراحةً.
 */
export function resolveTolerance(precision, atrValue, options = {}) {
  const { tickMultiple = 4, atrFraction = 0.1 } = options;

  if (precision?.tickSize && precision.tickSizeConfidence !== "low") {
    return {
      mode: TOLERANCE_MODES.TICK,
      value: precision.tickSize * tickMultiple,
      description: `${tickMultiple} × tick (${precision.tickSize})`,
      trustworthy: true,
    };
  }
  if (Number.isFinite(atrValue) && atrValue > 0) {
    return {
      mode: TOLERANCE_MODES.ATR,
      value: atrValue * atrFraction,
      description: `${atrFraction} × ATR (${atrValue.toFixed(5)}) — التِك غير معروف`,
      trustworthy: true,
    };
  }
  return {
    mode: null,
    value: null,
    description: "ما في تِك موثوق ولا ATR — ما بينحسب فرق سعري",
    trustworthy: false,
  };
}

/** فرق سعري بوحدة التِك — null لو التِك مش معروف (بدل رقم مضلّل). */
export function priceDeltaInTicks(delta, precision) {
  if (!precision?.tickSize || precision.tickSizeConfidence === "low") return null;
  return +(Math.abs(delta) / precision.tickSize).toFixed(2);
}
