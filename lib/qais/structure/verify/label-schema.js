/* ============================================================================
   lib/qais/structure/verify/label-schema.js
   منطق التسمية المشترك — مصدر واحد لأداة التسمية وللمُصحِّح.

   ⚠️ الملف بينحقن حرفياً جوّا أداة التسمية (HTML) وقت البناء، فما بينستورد
   شي، وسطر التصدير بآخره بينشال عند الحقن. أي `import` هون بيكسر الأداة.

   ليش هالوحدة موجودة أصلاً:
   ---------------------------------------------------------------------------
   النسخة الأولى من الأداة كانت بتحط سعر الحدث = إغلاق **شمعة الكسر**.
   وهاد معنى مختلف تماماً عن اللي بيقيسه المحرك: هناك `price` هو **مستوى
   السوينغ المكسور** (events.js: buildEvent(..., level, swingRef, ...)).

   يعني كان المرجع البشري والمحرك بيتكلموا لغتين، وكل «فرق سعري» بالتقرير
   رح يطلع بلا معنى. التصحيح إنه التسمية تحدّد **أي مستوى انكسر**، وشمعة
   الحدث تضل مجرد لحظة التأكيد.
   ============================================================================ */

/** بيفوتات فراكتال بسيطة — **اقتراحات** للمحلّل، مش ادعاء هيكلي. */
function detectPivots(candles, lookback = 2) {
  const out = [];
  if (!Array.isArray(candles)) return out;
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) isHigh = false;
      if (candles[j].low <= c.low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) out.push({ index: i, time: c.time, price: c.high, type: "high" });
    if (isLow) out.push({ index: i, time: c.time, price: c.low, type: "low" });
  }
  return out;
}

/**
 * مرشّحات السوينغ المكسور لحدث عند eventIndex.
 *
 * صاعد → قمم سابقة.  هابط → قيعان سابقة.
 * `plausible` = إغلاق شمعة الحدث فعلاً خلف المستوى (كسر بالجسم مش بالذيل).
 * المرشّحات غير المعقولة بتضل معروضة — المحلّل بيقرر، الأداة ما بتفلتر
 * قراره — بس بتنتوسم حتى ما ينختار مستوى ما انكسر أصلاً بالغلط.
 */
function swingCandidates(candles, pivots, userSwings, eventIndex, direction, limit = 12) {
  const want = direction === "up" ? "high" : "low";
  const ec = candles[eventIndex];
  if (!ec) return [];

  const byTime = new Map();

  for (const p of pivots) {
    if (p.type !== want || p.index >= eventIndex) continue;
    byTime.set(p.time, { ...p, source: "detected" });
  }
  /* سوينغات المحلّل بتغلب المكتشفة عند نفس الوقت — هي المرجع. */
  for (const s of userSwings || []) {
    if (s.type !== want) continue;
    const idx = candles.findIndex((c) => c.time === s.time);
    if (idx === -1 || idx >= eventIndex) continue;
    byTime.set(s.time, { index: idx, time: s.time, price: s.price, type: s.type, label: s.label ?? null, source: "labeled" });
  }

  return [...byTime.values()]
    .map((p) => ({
      ...p,
      barsBack: eventIndex - p.index,
      plausible: direction === "up" ? ec.close > p.price : ec.close < p.price,
    }))
    .sort((a, b) => b.index - a.index)
    .slice(0, limit);
}

/**
 * مستوى الخط الأفقي للحدث = سعر السوينغ المكسور.
 * بيرجّع null لو الحدث ما إله سوينغ مكسور — وقتها ما منرسم مستوى
 * وبنوسمه needs-review بدل ما نخمّنله واحد.
 */
function lineLevelOf(event) {
  return Number.isFinite(event?.brokenSwingPrice) ? event.brokenSwingPrice : null;
}

/**
 * ترقية حدث قديم للصيغة الجديدة **بدون تخمين**.
 * أي حدث بلا سوينغ مكسور بينتوسم needsReview: true وبيضل موجود —
 * الحذف بيضيّع شغل المحلّل، والتخمين بيلوّث المرجع.
 */
function normalizeEvent(e, candles) {
  const idx = Array.isArray(candles) ? candles.findIndex((c) => c.time === e.time) : -1;
  const hasLevel = Number.isFinite(e.brokenSwingPrice) && Number.isFinite(e.brokenSwingTime);
  return {
    time: e.time,
    index: idx === -1 ? (Number.isFinite(e.index) ? e.index : null) : idx,
    type: e.type,
    direction: e.direction,
    brokenSwingTime: hasLevel ? e.brokenSwingTime : null,
    brokenSwingIndex: hasLevel
      ? Number.isFinite(e.brokenSwingIndex)
        ? e.brokenSwingIndex
        : Array.isArray(candles)
          ? candles.findIndex((c) => c.time === e.brokenSwingTime)
          : null
      : null,
    brokenSwingPrice: hasLevel ? e.brokenSwingPrice : null,
    /* السعر المُقاس = مستوى السوينغ المكسور، مطابق لدلالة المحرك. */
    price: hasLevel ? e.brokenSwingPrice : null,
    reason: e.reason ?? "",
    needsReview: !hasLevel,
    ...(e.legacyPrice != null || (!hasLevel && Number.isFinite(e.price))
      ? { legacyPrice: e.legacyPrice ?? e.price }
      : {}),
  };
}

export { detectPivots, swingCandidates, lineLevelOf, normalizeEvent };
