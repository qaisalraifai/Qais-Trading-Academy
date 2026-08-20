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

/**
 * تعداد السيكونزات المرشّحة من **السوينغات مباشرة** — مش من الأحداث.
 *
 * ⚠️ ليش مش من الأحداث.
 * ---------------------------------------------------------------------------
 * `pointsFromEvent` بتاخد A = السوينغ اللي كسره الحدث. وهاد بيفوّت سيكونزات
 * حقيقية: على ذهب H4، صاحب المنهجية رسم A عند 4202.90 بينما أحداث المحرك
 * كسرت قمماً أوطى (4100.78) — لأن السوينغ **الحامي** وقتها كان الأوطى، وهاد
 * صحيح حسب تعريف MSS. فنقطة A عنده قمة **الاندفاع**، مش المستوى المكسور.
 *
 * ⚠️ الثلاثي لازم يكون سوينغات **متتالية** — وهاد حسم فرقاً ضخماً.
 * ---------------------------------------------------------------------------
 * أول تعداد كتبته سمح لأي قاع مع أي قمة لاحقة، فطلعت «سيقان» بتمتد ٢٠٠ شمعة
 * وبتضم عدة اندفاعات: **٥٣ مرشّحة** على نفس البيانات، وسيكونزه رقم ١٢ —
 * فقاعدة «الأكبر» بانت غلط وهي صح. مع القيد: **٦ مرشّحات** وسيكونزه منهن.
 *
 * ⚠️ B = **أعمق** قاع بالتصحيح، مش أول قاع بعد A.
 * ---------------------------------------------------------------------------
 * بين A وB بحالته أربع سوينغات (ارتدادات لـ4138 و4100). أخذ أول قاع بيعطي
 * B غلط وساقاً أقصر.
 */
export function enumerateSequences(candles, majorSwings, asOfIndex) {
  const sw = confirmedUpTo(majorSwings, asOfIndex);
  const out = [];

  for (let i = 0; i + 1 < sw.length; i++) {
    for (const dirUp of [true, false]) {
      const startT = dirUp ? "low" : "high";
      const O = sw[i], A = sw[i + 1];
      if (O.type !== startT || A.type === startT) continue;

      const leg = Math.abs(A.price - O.price);
      if (leg <= MIN_LEG) continue;

      /* الاختراق: أول إغلاق خلف A. قبله ما في سيكونز. */
      let brk = null;
      for (let n = A.index + 1; n <= asOfIndex; n++) {
        const c = candles[n];
        if (dirUp ? c.close > A.price : c.close < A.price) { brk = n; break; }
      }
      if (brk == null) continue;

      /* B = أقصى تصحيح بين A والاختراق. */
      const mids = sw.filter((s) => s.type === startT && s.index > A.index && s.index < brk);
      if (!mids.length) continue;
      const B = mids.reduce((m, s) => ((dirUp ? s.price < m.price : s.price > m.price) ? s : m));

      /* التصحيح ما بيتجاوز نقطة البداية — وإلا مش تصحيح. */
      if (dirUp ? B.price <= O.price : B.price >= O.price) continue;
      /* سببية: B لازم تكون مؤكَّدة قبل الاختراق. */
      if (B.confirmedAtIndex > brk) continue;

      /* الإبطال: إغلاق خلف B بعد الاختراق (قاعدة SK). */
      let killed = null;
      for (let n = brk; n <= asOfIndex; n++) {
        const c = candles[n];
        if (dirUp ? c.close < B.price : c.close > B.price) { killed = n; break; }
      }

      out.push({
        direction: dirUp ? "up" : "down",
        origin: O, A, B,
        legLength: +leg.toFixed(5),
        breakIndex: brk,
        breakTime: candles[brk].time,
        alive: killed == null,
        killedAtIndex: killed,
      });
    }
  }
  return out;
}

/**
 * **أكبر سيكونز** — قاعدة صاحب المنهجية الصريحة: «اخترت أكبر سيكونز».
 *
 * ⚠️ «أكبر» وحدها ما بتكفي — بدها تلات قيود، وكلها مقيسة على ذهب H4
 * مقابل سيكونز رسمها بإيده (0 3942.31 · A 4203.11 · B 3959.69):
 *
 *   حيّة       B ما انكسرت. مرشّحتان أكبر ماتتا فعلاً (٢٠٢٦-٠٥-١٥ · ٠٤-٢٨).
 *   C مؤكَّدة  بلا C ما في أهداف أصلاً. أكبر مرشّحة (ساق 430) اخترقت بآخر
 *              يوم بالبيانات وC تبعها ما تأكّدت.
 *   نفس الاتجاه  المرشّحتان الأكبر بعدها **هابطتان** والذهب صاعد. قاعدته R7:
 *              السيناريو بيحدد الاتجاه.
 *
 * بالقيود التلاتة: مرشّحتان بس، وسيكونزه **الأولى**. وأهدافها طلعت مطابقة
 * لأهدافه بفرق 0.37 · 0.73 · 0.84 · 0.95 — كله زحزحة CFI عن Dukascopy.
 * بلا قيد الاتجاه بتطلع المرتبة ٣، وبلا قيد C المرتبة ٢.
 */
export function biggestSequence(candles, majorSwings, asOfIndex, opts = {}) {
  const { direction = null, requireC = true, events = null } = opts;

  /* الاتجاه القائم = اتجاه آخر حدث هيكل. قاعدته R7: السيناريو بيحدد
     الاتجاه، فسيكونز معاكسة مش مرشّحة أصلاً. */
  let dir = direction;
  if (!dir && Array.isArray(events)) {
    const past = events.filter((e) => Number.isFinite(e.index) && e.index <= asOfIndex);
    dir = past.length ? past[past.length - 1].direction : null;
  }

  const all = enumerateSequences(candles, majorSwings, asOfIndex)
    .filter((s) => s.alive)
    .filter((s) => !dir || s.direction === dir)
    .filter((s) => !requireC || findC(majorSwings, { index: s.breakIndex }, s.A, s.direction, asOfIndex));

  if (!all.length) return null;
  return all.reduce((m, s) => (s.legLength > m.legLength ? s : m));
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
export function analyzeSequenceV2(candles, structure, options = {}) {
  const { asOfIndex = null } = options;
  if (!Array.isArray(candles) || candles.length < 2) return insufficient("ما في شموع كافية");
  const at = asOfIndex == null ? candles.length - 1 : asOfIndex;
  const events = (structure?.events || []).filter((e) => Number.isFinite(e.index) && e.index <= at);
  if (!events.length) return { ok: false, stage: "none", reason: "ما في حدث هيكل بعد لبناء سيكونز عليه" };

  /* ⚠️ الاختيار: **أكبر سيكونز حيّة** — قاعدته الصريحة، مش آخر حدث.
     أخذ آخر حدث بيعطي ساقاً مجهرية: على ذهب H4 أعطى ١١٨ نقطة بينما
     سيكونزه ٢٦١. والأحداث بتشتق A = السوينغ المكسور، وهو مش قمة الاندفاع. */
  const seq = biggestSequence(candles, structure.majorSwings, at, { ...options, events: structure.events });
  if (!seq) {
    /* ⚠️ التمييز بين أسباب الرفض مهم — «ما في سيكونز» بلا سبب ما بتعلّم
       إشي، و«انبطلت» غلط لما المرشّحات حيّة بس مستثناة بقيد تاني. */
    const cands = enumerateSequences(candles, structure.majorSwings, at);
    const alive = cands.filter((s) => s.alive);
    const past = (structure.events || []).filter((e) => Number.isFinite(e.index) && e.index <= at);
    const trend = past.length ? past[past.length - 1].direction : null;
    const aligned = trend ? alive.filter((s) => s.direction === trend) : alive;

    let stage = "none", reason = "ما في ثلاثي (0→A→B) باختراق مؤكَّد";
    if (cands.length && !alive.length) {
      stage = "invalidated"; reason = "كل السيكونزات المرشّحة انكسرت B تبعها";
    } else if (alive.length && !aligned.length) {
      stage = "counter-trend";
      reason = `في ${alive.length} سيكونز حيّة بس كلها بعكس الاتجاه القائم (${trend})`;
    } else if (aligned.length) {
      stage = "awaiting-c";
      reason = `في ${aligned.length} سيكونز حيّة بنفس الاتجاه بس C ما تأكّدت بولا وحدة`;
    }
    return { ok: false, stage, reason, candidates: cands.length, aliveCount: alive.length };
  }
  const { origin, A, B, direction, legLength } = seq;
  const event = { index: seq.breakIndex, type: "breakout", price: A.price, id: `SEQ:${direction}:${origin.index}` };

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
    /* كم مرشّحة كانت موجودة — عشان يبان إنه الاختيار مقصود مش وحيد. */
    candidates: enumerateSequences(candles, structure.majorSwings, at).length,
    alive: true,
    /* ملاحظة منهجية: «لا يوجد إغلاق جزئي للأرباح» — الأهداف بتنعرض كخريطة
       كاملة، بدون تقسيم حجم الصفقة بينها. */
    partialClose: false,
    reason: `${event.type} ${direction === "up" ? "صاعد" : "هابط"} · ساق ${legLength.toFixed(2)} · مسقطة من B ${projectFrom.toFixed(2)}`,
  };
}

/* يُصدَّر للاستعمال من طبقات تانية بتحتاج محاذاة زمنية بين فريمات. */
export { alignIndex };
