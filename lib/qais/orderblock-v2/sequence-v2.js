/* ============================================================================
   lib/qais/orderblock-v2/sequence-v2.js
   السيكونز على **المحرك الجديد** — مصدر الأهداف.

   نقل لـ`lib/qais/sequence.js` بعد ما انكشف إنها بتتغذّى من المحرك القديم
   `lib/qais/structure.js` (`lastBOS.swingA/swingB/swingC` و`lastMSS`) —
   اللي أثبتنا إنه بيطلّع ٧٤٥ حدث على ٢٩٢٨ شمعة. حساب الأهداف بالقديمة
   **سليم ومطابق للمنهجية**؛ المشكلة كانت بمصدر النقاط وبس.

   ---------------------------------------------------------------------------
   النقاط الأربعة، واشتقاقها من مخرج `analyzeStructureV2`:

     A       = `event.swingRef` — السوينغ **المكسور**. المحرك الجديد بيرفقه
               بكل حدث، وهاد بالضبط ما كان `lastBOS.swingB` بالقديم.
     Origin  = آخر سوينغ معاكس النوع **قبل** A. بداية الحركة.
     B       = آخر سوينغ معاكس النوع **بين A وشمعة الكسر**. التصحيح.
     C       = أول سوينغ مؤكَّد **بعد** الكسر بيتجاوز A سعرياً. الاستمرار.

   بالبنية: Origin(قاع) → A(قمة) → B(قاع) → كسر فوق A → C(قمة)

   ⚠️ الأهداف بتنسقط من **B** مش من C.
   ---------------------------------------------------------------------------
   نفس قرار الوحدة القديمة، وسببه موثّق فيها: الإسقاط من C بيطلّع أهدافاً
   أعلى بطول ساق كاملة تقريباً — بمثال US100 أعطى 40,330 بدل 32,712 للنسبة
   1.000، يعني أهداف ما بتنوصل عملياً.

   ⚠️ سببية: كل سوينغ بينستعمل لازم يكون **مؤكَّداً** عند لحظة السؤال.
   ---------------------------------------------------------------------------
   `confirmedAtIndex` بالمحرك الجديد هو لحظة معرفة السوينغ، مش لحظة حدوثه.
   استعمال `index` وحده بيخلّي السيكونز تبان وكأنها كانت معروفة قبل وقتها.
   ============================================================================ */

import { alignIndex } from "./smt-v2.js";

/* النسب المحسومة بالمنهجية. TP1 مش نسبة — هو أقرب قمة/قاع حقيقي قدّام
   السعر، لأن الهدف الأول لازم يكون مستوى فعلي بالسوق مش رقماً محسوباً. */
export const PROJECTION_RATIOS = [
  { key: "TP2", ratio: 1.0 },
  { key: "TP3", ratio: 1.618 },
  { key: "TP4", ratio: 1.809 },
  { key: "TP5", ratio: 2.0 },
];

const MIN_LEG = 1e-9;
const insufficient = (why) => ({ ok: false, value: "INSUFFICIENT_DATA", why });

/** سوينغات مؤكَّدة لحد لحظة معيّنة، مرتّبة بالفهرس. */
function confirmedUpTo(majorSwings, asOfIndex) {
  return (majorSwings || [])
    .filter((s) => Number.isFinite(s.confirmedAtIndex) && s.confirmedAtIndex <= asOfIndex)
    .sort((a, b) => a.index - b.index);
}

/**
 * النقاط الثلاث الأولى من حدث هيكل.
 * @returns {{ origin, A, B }|null}
 */
export function pointsFromEvent(event, majorSwings, asOfIndex) {
  const A = event?.swingRef;
  if (!A || !Number.isFinite(A.index)) return null;

  const sw = confirmedUpTo(majorSwings, asOfIndex);
  const opposite = A.type === "high" ? "low" : "high";

  /* Origin = آخر معاكس قبل A. */
  let origin = null;
  for (const s of sw) {
    if (s.type !== opposite || s.index >= A.index) continue;
    if (!origin || s.index > origin.index) origin = s;
  }
  if (!origin) return null;

  /* B = آخر معاكس بين A وشمعة الكسر. */
  let B = null;
  for (const s of sw) {
    if (s.type !== opposite || s.index <= A.index || s.index >= event.index) continue;
    if (!B || s.index > B.index) B = s;
  }
  if (!B) return null;

  return { origin, A, B };
}

/** أول سوينغ مؤكَّد بعد الكسر بيتجاوز A سعرياً — نقطة C. */
function findC(majorSwings, event, A, direction, asOfIndex) {
  const wanted = direction === "up" ? "high" : "low";
  const sw = confirmedUpTo(majorSwings, asOfIndex);
  for (const s of sw) {
    if (s.type !== wanted || s.index <= event.index) continue;
    const beyond = direction === "up" ? s.price > A.price : s.price < A.price;
    if (beyond) return s;
  }
  return null;
}

/** أقرب قمة/قاع حقيقي قدّام السعر — TP1. */
function nearestRealTarget(majorSwings, direction, fromPrice, asOfIndex) {
  const wanted = direction === "up" ? "high" : "low";
  let best = null;
  for (const s of confirmedUpTo(majorSwings, asOfIndex)) {
    if (s.type !== wanted) continue;
    const ahead = direction === "up" ? s.price > fromPrice : s.price < fromPrice;
    if (!ahead) continue;
    const dist = Math.abs(s.price - fromPrice);
    if (!best || dist < best.dist) best = { price: s.price, dist, time: s.time, index: s.index };
  }
  return best;
}

/**
 * هل رجع السعر وكسر B (أو Origin) بالاتجاه المعاكس؟
 * قاعدة SK: «إذا تم كسر النقطة 0 أو النقطة B يُهمل السيكونز».
 * ⚠️ الكسر بالإغلاق — قاعدة محسومة بالمنهجية.
 */
function brokenBack(candles, fromIndex, toIndex, level, direction) {
  const to = Math.min(toIndex, candles.length - 1);
  for (let i = fromIndex; i <= to; i++) {
    const c = candles[i];
    if (!c) continue;
    if (direction === "up" ? c.close < level : c.close > level) return { index: i, time: c.time, close: c.close };
  }
  return null;
}

/**
 * السيكونز عند لحظة معيّنة.
 *
 * @param candles شموع الفريم
 * @param structure ناتج analyzeStructureV2
 * @param asOfIndex لحظة السؤال (افتراضياً آخر شمعة)
 */
export function analyzeSequenceV2(candles, structure, { asOfIndex = null } = {}) {
  if (!Array.isArray(candles) || candles.length < 2) return insufficient("ما في شموع كافية");
  const at = asOfIndex == null ? candles.length - 1 : asOfIndex;
  const events = (structure?.events || []).filter((e) => Number.isFinite(e.index) && e.index <= at);
  if (!events.length) return { ok: false, stage: "none", reason: "ما في حدث هيكل بعد لبناء سيكونز عليه" };

  const event = events[events.length - 1];
  const direction = event.direction;

  const pts = pointsFromEvent(event, structure.majorSwings, at);
  if (!pts) {
    return { ok: false, stage: "none", reason: "ما انشتقت النقاط الثلاث من الحدث — سوينغات مؤكَّدة ناقصة" };
  }
  const { origin, A, B } = pts;

  const legLength = Math.abs(A.price - origin.price);
  if (legLength <= MIN_LEG) return { ok: false, stage: "none", reason: "طول الساق الأساسية (0→A) غير صالح" };

  /* الإبطال: كسر B أو Origin بالاتجاه المعاكس — بينفحص من شمعة الكسر. */
  const killB = brokenBack(candles, event.index, at, B.price, direction);
  const killO = brokenBack(candles, event.index, at, origin.price, direction);
  const kill = killB && killO ? (killB.index <= killO.index ? killB : killO) : killB || killO;
  if (kill) {
    return {
      ok: false, active: false, stage: "invalidated", direction,
      points: { origin, A, B }, invalidatedAt: kill,
      reason: `السيكونز أُلغيت — السعر سكّر خلف ${kill === killB ? "B" : "النقطة 0"} عند ${kill.close.toFixed(2)}`,
    };
  }

  const C = findC(structure.majorSwings, event, A, direction, at);
  if (!C) {
    return {
      ok: true, active: true, stage: "awaiting-c", direction,
      points: { origin, A, B, C: null }, legLength: +legLength.toFixed(5), targets: null,
      reason: "C لسا ما تأكّدت — ما في أهداف بعد",
    };
  }

  /* ⚠️ الإسقاط من B. الإسقاط من C بيطلّع أهدافاً ما بتنوصل — موثّق
     بالوحدة القديمة بمثال US100 (40,330 بدل 32,712 للنسبة 1.000). */
  const projectFrom = B.price;
  const lastPrice = candles[Math.min(at, candles.length - 1)].close;

  const ratioTargets = PROJECTION_RATIOS.map((t) => ({
    ...t,
    price: +(direction === "up" ? projectFrom + legLength * t.ratio : projectFrom - legLength * t.ratio).toFixed(5),
    isRealLevel: false,
  }));
  const real = nearestRealTarget(structure.majorSwings, direction, lastPrice, at);
  const targets = real
    ? [{ key: "TP1", ratio: null, price: +real.price.toFixed(5), isRealLevel: true }, ...ratioTargets]
    : ratioTargets;
  for (const t of targets) t.hit = direction === "up" ? lastPrice >= t.price : lastPrice <= t.price;

  return {
    ok: true, active: true, stage: "complete", direction,
    points: { origin, A, B, C },
    legLength: +legLength.toFixed(5),
    projectedFrom: +projectFrom.toFixed(5),
    targets,
    reachedCount: targets.filter((t) => t.hit).length,
    nextTarget: targets.find((t) => !t.hit) || null,
    event: { id: event.id, type: event.type, index: event.index, price: event.price },
    /* ملاحظة منهجية: «لا يوجد إغلاق جزئي للأرباح» — الأهداف بتنعرض كخريطة
       كاملة، بدون تقسيم حجم الصفقة بينها. */
    partialClose: false,
    reason: `${event.type} ${direction === "up" ? "صاعد" : "هابط"} · ساق ${legLength.toFixed(2)} · مسقطة من B ${projectFrom.toFixed(2)}`,
  };
}

/* يُصدَّر للاستعمال من طبقات تانية بتحتاج محاذاة زمنية بين فريمات. */
export { alignIndex };
