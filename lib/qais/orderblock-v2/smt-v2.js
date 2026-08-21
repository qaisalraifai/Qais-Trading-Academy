/* ============================================================================
   lib/qais/orderblock-v2/smt-v2.js
   SMT — التباعد بين أصلين مترابطين طردياً، كبوابة دخول.

   نصّ صاحب المنهجية (٢٠٢٦-٠٨-٢١) — **وهو المعتمد**:
       «أول إشي السعر بينزل للـOB، بعدها بيصير SMT: يعني مثلاً الـS&P500
        بينزل تحت قاع بس الـUS100 ما بينزل تحته. هون بنستنى CISD على
        ناسداك وبندخل، وبنخلي الستوب **تحت القاع يلي ما نزل النازداك
        تحته**.»

   ⚠️ **هاد بيعكس قراراً مسجَّلاً سابقاً** (٢٠٢٦-٠٨-١٨) كان بيقول الإشارة
   لصالح الأصل **اللي كنس**. انسأل صراحةً عن التعارض، والجواب:
   «كلام اليوم هو المعتمد». فالأدوار انعكست:

       الأصل الأساسي (ناسداك)  →  **بيصمد** فوق قاعه
       المترابط (S&P)          →  **بيكنس** قاعه
       نقطة الـSMT             →  أدنى قاع وصله الأساسي (اللي صمد عليه)
       الستوب                  →  تحت هالنقطة

   الدليل من شارته (٣٠ يوليو ٢٠٢٦): ستوب 27,672.98 تحت قاع 27,675.78،
   وذاك القاع كان **٣٢٩ نقطة فوق** آخر قاع سابق (27,346.45) — يعني صمد
   بوضوح، ما كنس. القاعدة القديمة كانت بتحط الستوب تحت قاع **مكنوس**.

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
 *
 * ⚠️ الكنس لازم يكون **طازجاً**: المستوى ما كان متجاوَزاً قبل النافذة.
 * ---------------------------------------------------------------------------
 * بدون هالشرط، سوينغ قديم والسعر بعيد فوقه بيتعدّ «مكنوساً» كل شمعة.
 * مقيس على ناسداك: حلقة بتقول كنس 24,328.89 والامتداد 27,005.93 — ٢٦٧٧
 * نقطة فوق المستوى. هاد سعر بعيد عن قمة مارس، مش كنس سيولة. باقي الحلقات
 * كانت بين ٢٣٤ و٩٢٣ نقطة.
 *
 * @returns {{ swept, level, extremeIndex, extreme, stale }|null}
 */
function sweptWithin(candles, swing, fromIndex, toIndex, dirUp) {
  if (!swing) return null;

  /* المستوى لازم يكون سليماً من لحظة تكوّن السوينغ لبداية النافذة —
     يعني السعر كان لسا بالجهة التانية منه. */
  for (let i = swing.index + 1; i < fromIndex; i++) {
    const c = candles[i];
    if (!c) continue;
    const px = dirUp ? c.low : c.high;
    if (dirUp ? px < swing.price : px > swing.price) {
      return { swept: false, stale: true, level: swing.price, swingIndex: swing.index, extreme: null, extremeIndex: null };
    }
  }

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
  return { swept: extreme !== null, stale: false, level: swing.price, swingIndex: swing.index, extreme, extremeIndex };
}

/**
 * أقصى امتداد للأصل جوّا نافذة — بغضّ النظر عن أي مستوى.
 *
 * ⚠️ مختلفة عن `sweptWithin`: تلك بترجّع امتداداً **بس لو تجاوز** السوينغ.
 * هون بدنا القاع اللي صمد عليه الأصل — يعني أدنى قاع بالنافذة حتى لو ما
 * كسر أي مستوى. بدونها ما في مرجع للستوب لما الأصل يصمد.
 */
function extremeWithin(candles, fromIndex, toIndex, dirUp) {
  let price = null, index = null;
  for (let i = Math.max(0, fromIndex); i <= Math.min(toIndex, candles.length - 1); i++) {
    const c = candles[i];
    if (!c) continue;
    const px = dirUp ? c.low : c.high;
    if (price === null || (dirUp ? px < price : px > price)) { price = px; index = i; }
  }
  return price === null ? null : { price, index };
}

/**
 * SMT عند لحظة معيّنة على الأصل الأساسي.
 *
 * الشرط: **المترابط كنس** سوينغه، والأصل الأساسي **صمد** فوق سوينغه
 * المقابل خلال نفس النافذة. الإشارة لصالح الأصل اللي صمد.
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
  if (sweepA.stale) {
    return {
      valid: false,
      reason: `المستوى ${swingA.price.toFixed(2)} كان متجاوَزاً قبل النافذة — مرجع غير طازج`,
    };
  }
  /* ⚠️ **الأصل الأساسي لازم يصمد** — مش يكنس. */
  if (sweepA.swept) {
    return {
      valid: false,
      reason: `الأصل الأساسي كنس ${dirUp ? "قاعه" : "قمته"} (${swingA.price.toFixed(2)}) — المطلوب يصمد`,
      sweepA,
    };
  }

  /* نقطة الـSMT = **أقصى امتداد للأصل الأساسي جوّا النافذة** — أي القاع
     اللي ما نزل تحته (القمة اللي ما طلع فوقها بالبيعي). الستوب تحتها. */
  const held = extremeWithin(A.candles, from, asOfIndex, dirUp);
  if (!held) return insufficient("ما في شموع بالنافذة على الأصل الأساسي");

  /* المحاذاة بالوقت — الفهارس بين أصلين ما بتتطابق. */
  const tA = A.candles[held.index].time;
  const idxB = alignIndex(B.candles, tA, cfg.maxAlignSeconds);
  if (idxB == null) return insufficient(`ما في شمعة مقابلة على المترابط عند ${new Date(tA * 1000).toISOString()}`);

  const swingB = lastConfirmedSwing(B.swings, type, idxB);
  if (!swingB) return insufficient(`ما في ${dirUp ? "قاع" : "قمة"} مؤكَّد على المترابط قبل ${idxB}`);

  const fromB = Math.max(swingB.index + 1, idxB - cfg.syncBars);
  const sweepB = sweptWithin(B.candles, swingB, fromB, idxB + cfg.syncBars, dirUp);

  /* ⚠️ **المترابط لازم يكنس** — هو اللي بياخد السيولة. */
  if (!sweepB.swept) {
    return {
      valid: false,
      reason: `المترابط ما كنس ${dirUp ? "قاعه" : "قمته"} (${swingB.price.toFixed(2)}) — ما في تباعد`,
      sweepA, sweepB,
    };
  }

  /* ⚠️ نقطة الـSMT = **القاع اللي صمد عليه الأصل الأساسي** (القمة بالبيعي).
     الستوب تحتها — نصّه (٢٠٢٦-٠٨-٢١): «بنخلي الستوب تحت القاع يلي ما نزل
     النازداك تحته». */
  return {
    valid: true,
    favors: "primary",
    direction: dirUp ? "up" : "down",
    point: +held.price.toFixed(5),
    pointIndex: held.index,
    pointTime: tA,
    /* المرجع اللي صمد فوقه الأصل الأساسي. */
    heldLevel: +swingA.price.toFixed(5),
    /* المستوى اللي كنسه المترابط، وأقصى امتداد كنسه. */
    sweptLevel: +swingB.price.toFixed(5),
    correlateExtreme: +sweepB.extreme.toFixed(5),
    correlateIndex: idxB,
    reason:
      `المترابط كنس ${dirUp ? "قاعه" : "قمته"} ${swingB.price.toFixed(2)} لـ${sweepB.extreme.toFixed(2)} ` +
      `والأصل الأساسي صمد فوق ${swingA.price.toFixed(2)} — ` +
      `${dirUp ? "أدنى قاع" : "أعلى قمة"} عنده ${held.price.toFixed(2)}`,
  };
}

/**
 * بناء مصدر SMT من شموع فريم أصغر — قرار صاحب المنهجية (٢٠٢٦-٠٨-١٨):
 * «عادي ما في مشكلة لو كان SMT عفريم ١٥ دقيقة.»
 *
 * ⚠️ بيستعمل **البيفوتات الداخلية** مش السوينغات الكبرى.
 * ---------------------------------------------------------------------------
 * مقيس على الكتلة المتحقَّقة: السوينغات الكبرى بعتبتها المعايَرة على H4/D1
 * بتعطي ٢٥ سوينغ بس على ٤٣٧ شمعة M15 — خشنة جداً لمقياس الدخول، وما
 * طلّعت ولا SMT. البيفوتات الداخلية (٩٧ سوينغ) طلّعت حلقتين، والثانية
 * كنست لـ27,322.61 — بالضبط سعر لمس الكتلة.
 *
 * ⚠️ البيفوت الداخلي بيتأكد بعد شمعتين (lookback 2)، وما إله
 * `confirmedAtIndex` بمخرج المحرك. بنركّبه هون — بدونه بتنكسر السببية
 * وبيصير السوينغ «معروفاً» قبل ما يتشكّل.
 *
 * @param structureOf (candles) => ناتج analyzeStructureV2
 */
export function smtSourceFromLowerTF(candles, structureOf, timeframe = "15min") {
  if (!Array.isArray(candles) || !candles.length) return null;
  const st = structureOf(candles);
  const swings = (st?.internalSwings || []).map((s) => ({ ...s, confirmedAtIndex: s.index + 2 }));
  return { candles, swings, scale: "internal", timeframe };
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
