/* ============================================================================
   lib/qais/orderblock-v2/cisd.js
   CISD — Change in State of Delivery. تأكيد الدخول على فريم أصغر.

   نصّ صاحب المنهجية (٢٠٢٦-٠٨-١٨):
       «CISD يعني كسر قمة آخر شمعة معاكسة على فريم ١٥ دقيقة أو ٥ دقائق.»
       و«الدخول بيكون بعد ما تتكوّن SMT عند أي مستوى ما بيفرق من الأوردر
        بلوك، بعد هيك بيكون في تأكيد ثاني عفريم أقل يلي هو CISD أول ما
        يصير وندخل. والستوب بيكون تحت الـSMT.»

   ---------------------------------------------------------------------------
   نفس البنية الهندسية لكتلة الأوامر بس على مقياس مصغّر: آخر **سلسلة** شموع
   معاكسة، وكسر طرفها. الفرق إنه هون الكسر **إشارة توقيت** للدخول، مش
   تعريف منطقة.

   شرائي: آخر شموع هابطة → كسر **أعلى** قمة فيهن.
   بيعي:  آخر شموع صاعدة → كسر **أدنى** قاع فيهن.

   ⚠️ الكسر بالإغلاق افتراضياً — قاعدة محسومة بالمنهجية («الكسر بالإغلاق
   مش بالذيل»). بس هي منطوقة عن **أحداث الهيكل**، وCISD إشارة توقيت مش
   حدث هيكل. فالوضع قابل للتبديل بـ`breakBy` والقرار لصاحب المنهجية.
   الفرق عملي: الكسر بالذيل بيدخّل أبكر بشمعة أو أكتر وبسعر أسوأ أحياناً.

   ⚠️ «آخر شمعة معاكسة» = آخر **سلسلة** متتالية، مش شمعة وحدة.
   ---------------------------------------------------------------------------
   لو أخدنا شمعة وحدة، سلسلة من ٣ شموع هابطة بتخلّي القمة المرجعية هي قمة
   آخر وحدة (الأدنى سعراً) — فبينكسر بسهولة وبيطلّع إشارة مبكّرة كاذبة.
   المرجع هو أعلى قمة بالسلسلة كلها، تماماً زي `oppositeGroupBefore`.
   ============================================================================ */

export const CISD_DEFAULTS = {
  /* "close" = إغلاق خلف المستوى · "wick" = تجاوز بالذيل. */
  breakBy: "close",
  /* أقصى شموع بينتظرها بعد تكوّن المرجع قبل ما تُلغى الإشارة.
     ⚠️ رقم **مكشوف بلا مرجع بشري** — ما انقاس على تسميات. */
  maxBarsToBreak: 60,
};

/**
 * آخر سلسلة شموع معاكسة منتهية **قبل** `beforeIndex`، ومستوى كسرها.
 *
 * @param dirUp اتجاه الصفقة (صاعد = بندوّر على شموع هابطة وكسر قمتها)
 * @returns {{ startIndex, endIndex, level, candles }|null}
 */
export function lastOppositeRun(candles, beforeIndex, dirUp) {
  const run = [];
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const c = candles[i];
    if (!c) break;
    const opposite = dirUp ? c.close < c.open : c.close > c.open;
    if (!opposite) break;
    run.unshift({ ...c, index: i });
  }
  if (run.length === 0) return null;
  return {
    startIndex: beforeIndex - run.length,
    endIndex: beforeIndex - 1,
    /* المستوى = طرف **السلسلة كلها**، مش آخر شمعة فيها. */
    level: dirUp ? Math.max(...run.map((c) => c.high)) : Math.min(...run.map((c) => c.low)),
    candles: run,
  };
}

/**
 * أول CISD بعد `fromIndex`.
 *
 * بيمشي شمعة بشمعة: عند كل شمعة بالاتجاه المطلوب، بياخد السلسلة المعاكسة
 * اللي قبلها ويفحص هل كسرت طرفها.
 *
 * @param candles شموع الفريم الأصغر (M15 أو M5)
 * @param fromIndex من وين يبلّش الفحص (عادةً لحظة تكوّن الـSMT)
 * @param dirUp اتجاه الصفقة
 */
export function findCISD(candles, fromIndex, dirUp, options = {}) {
  const cfg = { ...CISD_DEFAULTS, ...options };
  if (!Array.isArray(candles) || candles.length === 0) {
    return { value: "INSUFFICIENT_DATA", why: "ما في شموع بالفريم الأصغر" };
  }
  const start = Math.max(1, fromIndex);
  const limit = Math.min(candles.length - 1, start + cfg.maxBarsToBreak);

  for (let i = start; i <= limit; i++) {
    const c = candles[i];
    if (!c) continue;
    /* الشمعة لازم تكون باتجاه الصفقة — كسر بشمعة معاكسة مش CISD. */
    const aligned = dirUp ? c.close > c.open : c.close < c.open;
    if (!aligned) continue;

    const run = lastOppositeRun(candles, i, dirUp);
    if (!run) continue;

    const px = cfg.breakBy === "wick" ? (dirUp ? c.high : c.low) : c.close;
    const broke = dirUp ? px > run.level : px < run.level;
    if (!broke) continue;

    return {
      index: i,
      time: c.time,
      level: +run.level.toFixed(5),
      breakPrice: +px.toFixed(5),
      breakBy: cfg.breakBy,
      run: { startIndex: run.startIndex, endIndex: run.endIndex, candleCount: run.candles.length },
      direction: dirUp ? "up" : "down",
      reason:
        `كسر ${dirUp ? "قمة" : "قاع"} آخر ${run.candles.length} شمعة ` +
        `${dirUp ? "هابطة" : "صاعدة"} عند ${run.level.toFixed(2)} ` +
        `(${cfg.breakBy === "wick" ? "بالذيل" : "بالإغلاق"})`,
    };
  }
  return null;
}
