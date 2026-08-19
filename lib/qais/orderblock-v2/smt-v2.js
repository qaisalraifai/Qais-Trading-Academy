/* ============================================================================
   lib/qais/orderblock-v2/smt-v2.js
   SMT — التباعد بين أصلين مترابطين طردياً، كبوابة دخول.

   نصّ صاحب المنهجية (٢٠٢٦-٠٨-١٨):
       «الدخول بيكون بعد ما تتكوّن SMT… والستوب بيكون تحت الـSMT.»
   وحسم اتجاه الإشارة:
       «لما ناسداك يكنس قاعه وS&P ما يكنس → الإشارة **لصالح ناسداك**
        (اللي كنس)، لأن الكنس بلا تأكيد من المترابط يعني السيولة انسحبت
        والحركة مستنفدة، فبتشتري ناسداك من الكتلة.»

   ---------------------------------------------------------------------------
   ⚠️ ليش وحدة جديدة بدل تعديل `lib/qais/smt.js`.

   الوحدة القديمة فيها خللان مثبتان بالقياس:

   ١) بتنفّذ ظاهرة **غير** اللي بتوثيقها. التوثيق (٤.٢) بيقول «أصل ما
      بيكسر بينما المترابط يكسر»، والكود بيطلب **الاتنين يكسروا** وبعدين
      بيقارن الاتجاه (`eventA.direction !== eventB.direction`). فحص مباشر
      على أربع حالات مصنوعة:

          ناسداك كسر · S&P ما كسر            → false  ← الحالة الأساسية!
          ناسداك كسر · S&P بلا حدث           → false
          الاتنين كسروا بنفس الاتجاه          → false  (صح)
          الاتنين كسروا باتجاهين متعاكسين    → true

      يعني جوهر الـSMT **غير قابل للكشف**، واللي بترجع `true` ظاهرة نادرة
      تانية (كسر متعاكس بين أصلين مترابطين **طردياً**).

   ٢) بتتغذّى من `structResult.lastMSS / lastBOS` — شكل مخرج المحرك القديم
      `lib/qais/structure.js`، اللي أثبتنا إنه بيطلّع ٧٤٥ حدث على ٢٩٨٢
      شمعة. `analyzeStructureV2` ما بيرجّع هالحقول أصلاً.

   القديمة انتركت لأن الواجهة والكرون موصولين فيها؛ فصلها شغل منفصل.

   ⚠️ الكنس بالذيل مش بالإغلاق.
   ---------------------------------------------------------------------------
   «يكنس قاعه» = ياخد السيولة تحته. وهاد بالذيل — الإغلاق خلف السوينغ
   بيصير **حدث هيكل** (MSS/BOS) وهاد إشي تاني. القاعدة المحسومة بالمشروع:
   «التجاوز بالذيل بيروح لقائمة wickBreaks (مادة الـSweep) وما بيولّد حدث».

   ⚠️ المحاذاة بالوقت مش بالفهرس.
   ---------------------------------------------------------------------------
   الأصلان ممكن يكون عندهم شموع ناقصة بأوقات مختلفة (عطل مزوّد، عطلة
   مختلفة). المقارنة بالفهرس بتزحزح الأصلين عن بعض بصمت.
   ============================================================================ */

const insufficient = (why) => ({ value: "INSUFFICIENT_DATA", why });

export const SMT_DEFAULTS = {
  /* نافذة التزامن: كم شمعة فرق مسموح بين كنس الأصلين.
     ⚠️ رقم **مكشوف بلا مرجع بشري**. */
  syncBars: 3,
  /* أقصى فرق زمني مقبول عند محاذاة شمعة من أصل لأصل (بالثواني).
     أكبر من هيك = الشمعة المقابلة مفقودة، مش «قريبة». */
  maxAlignSeconds: 4 * 3600,
};

/** فهرس الشمعة المقابلة بالوقت — أو `null` لو مفقودة. */
export function alignIndex(candles, time, maxSeconds) {
  let lo = 0, hi = candles.length - 1, best = null, bestD = Infinity;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const d = Math.abs(candles[mid].time - time);
    if (d < bestD) { bestD = d; best = mid; }
    if (candles[mid].time < time) lo = mid + 1;
    else hi = mid - 1;
  }
  return bestD <= maxSeconds ? best : null;
}

/** آخر سوينغ مؤكَّد من النوع المطلوب قبل فهرس معيّن. */
function lastConfirmedSwing(swings, type, beforeIndex) {
  let out = null;
  for (const s of swings || []) {
    if (s.type !== type) continue;
    if (!Number.isFinite(s.confirmedAtIndex) || s.confirmedAtIndex > beforeIndex) continue;
    if (s.index >= beforeIndex) continue;
    if (!out || s.index > out.index) out = s;
  }
  return out;
}

/**
 * هل كنس الأصل سوينغه خلال نافذة؟ (بالذيل)
 * @returns {{ swept, level, extremeIndex, extreme }|null}
 */
function sweptWithin(candles, swing, fromIndex, toIndex, dirUp) {
  if (!swing) return null;
  /* شرائي = كنس **قاع** (السيولة تحت). بيعي = كنس قمة. */
  let extreme = null, extremeIndex = null;
  for (let i = fromIndex; i <= Math.min(toIndex, candles.length - 1); i++) {
    const c = candles[i];
    if (!c) continue;
    const px = dirUp ? c.low : c.high;
    const beyond = dirUp ? px < swing.price : px > swing.price;
    if (!beyond) continue;
    if (extreme === null || (dirUp ? px < extreme : px > extreme)) {
      extreme = px;
      extremeIndex = i;
    }
  }
  return { swept: extreme !== null, level: swing.price, swingIndex: swing.index, extreme, extremeIndex };
}

/**
 * SMT عند لحظة معيّنة على الأصل الأساسي.
 *
 * الشرط: الأصل الأساسي **كنس** سوينغه، والمترابط **ما كنس** سوينغه
 * المقابل خلال نفس النافذة. الإشارة لصالح الأصل الأساسي (قراره).
 *
 * @param A { candles, swings }  الأصل اللي بنتداول عليه
 * @param B { candles, swings }  المترابط
 * @param asOfIndex فهرس على A
 * @param dirUp اتجاه الصفقة (صاعد = بندوّر على كنس قاع)
 */
export function detectSMT(A, B, asOfIndex, dirUp, options = {}) {
  const cfg = { ...SMT_DEFAULTS, ...options };
  if (!A?.candles?.length || !A?.swings?.length) return insufficient("ما في بيانات كافية للأصل الأساسي");
  if (!B?.candles?.length || !B?.swings?.length) return insufficient("ما في بيانات كافية للأصل المترابط");

  const type = dirUp ? "low" : "high";
  const swingA = lastConfirmedSwing(A.swings, type, asOfIndex);
  if (!swingA) return insufficient(`ما في ${dirUp ? "قاع" : "قمة"} مؤكَّد على الأصل الأساسي قبل ${asOfIndex}`);

  const from = Math.max(swingA.index + 1, asOfIndex - cfg.syncBars);
  const sweepA = sweptWithin(A.candles, swingA, from, asOfIndex, dirUp);
  if (!sweepA.swept) {
    return { valid: false, reason: `الأصل الأساسي ما كنس ${dirUp ? "قاعه" : "قمته"} (${swingA.price.toFixed(2)})` };
  }

  /* المحاذاة بالوقت — الفهارس بين أصلين ما بتتطابق. */
  const tA = A.candles[sweepA.extremeIndex].time;
  const idxB = alignIndex(B.candles, tA, cfg.maxAlignSeconds);
  if (idxB == null) return insufficient(`ما في شمعة مقابلة على المترابط عند ${new Date(tA * 1000).toISOString()}`);

  const swingB = lastConfirmedSwing(B.swings, type, idxB);
  if (!swingB) return insufficient(`ما في ${dirUp ? "قاع" : "قمة"} مؤكَّد على المترابط قبل ${idxB}`);

  const fromB = Math.max(swingB.index + 1, idxB - cfg.syncBars);
  const sweepB = sweptWithin(B.candles, swingB, fromB, idxB + cfg.syncBars, dirUp);

  if (sweepB.swept) {
    return {
      valid: false,
      reason: "المترابط كنس سوينغه كمان — الاتنين أخدوا السيولة، ما في تباعد",
      sweepA, sweepB,
    };
  }

  /* ⚠️ نقطة الـSMT = **أقصى امتداد للكنس** على الأصل الأساسي. الستوب
     تحتها (فوقها بالبيعي) — قراره: «الستوب بيكون تحت الـSMT». */
  return {
    valid: true,
    favors: "primary",
    direction: dirUp ? "up" : "down",
    point: +sweepA.extreme.toFixed(5),
    pointIndex: sweepA.extremeIndex,
    pointTime: tA,
    sweptLevel: +swingA.price.toFixed(5),
    correlateHeld: +swingB.price.toFixed(5),
    correlateIndex: idxB,
    reason:
      `كنس ${dirUp ? "قاع" : "قمة"} ${swingA.price.toFixed(2)} لـ${sweepA.extreme.toFixed(2)} ` +
      `والمترابط ما كنس ${swingB.price.toFixed(2)} — السيولة انسحبت بلا تأكيد`,
  };
}

/** أول SMT بعد فهرس معيّن — بيرجّع أول لحظة تحقق الشرط. */
export function firstSMT(A, B, fromIndex, dirUp, options = {}) {
  const cfg = { ...SMT_DEFAULTS, ...options };
  const to = Math.min(A.candles.length - 1, fromIndex + (cfg.searchBars ?? 200));
  for (let i = Math.max(1, fromIndex); i <= to; i++) {
    const r = detectSMT(A, B, i, dirUp, cfg);
    if (r.valid === true) return { ...r, atIndex: i };
  }
  return null;
}
