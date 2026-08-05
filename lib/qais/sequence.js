/* ============================================================================
   lib/qais/sequence.js
   Sequence Projection Engine — QAIS SK Engine (مُعاد بناؤه بالكامل)

   الهدف: نفس سلوك أداة "Trend-Based Fib Extension" بتريدنغ فيو، لكن بأربع
   نقاط ثابتة (Origin → A → B → C) وبشروط هيكلية صارمة لكل نقطة — مش أول
   Pullback أو أول شمعة كاسرة. الأولوية دايماً لقواعد الهيكلية (BOS/CHOCH/
   Pivot حقيقي) قبل أي حساب فيبوناتشي.

   0 (Origin)      = القاع/القمة الأساسية اللي بدأت منها الحركة
   A (Impulse)      = قمة/قاع الاندفاع الأول — نفس المستوى المسؤول عن الـ BOS
   B (Correction)   = تصحيح حقيقي وصل 0.333 فيبوناتشي على الأقل من الساق
                       Origin→A، وتأكَّد بكسر إغلاق فوق/تحت A (نفس تأكيد BOS
                       بمحرك الهيكلية structure.js — لا تُقبل نقطة B بدون هالكسر)
   C (Continuation) = أهم نقطة بالتسلسل: أول Pivot حقيقي (Fractal مؤكَّد من
                       findSwings، يعني تشكّل بعده Pullback كافي ليثبته) يتشكل
                       بعد كسر الـ BOS ويتجاوز سعرياً نقطة A. ما منعتمدها أبداً
                       لمجرد إغلاق شمعة كاسرة — لازم تكون سوينغ فعلي مؤكَّد.
                       طالما C ما تأكدت بعد، السيكونز بمرحلة "awaiting-c":
                       بنعرض 0/A/B بس، وما في أهداف بعد.

   الأهداف (Projection Levels) — تُحسب فقط بعد تأكيد C، بطول الساق الأساسية
   Origin→A، مسقطة من C (نفس منطق Extension بتريدنغ فيو حرفياً). النسب مطابقة
   حرفياً لتوثيق RADAR — SK+ICT الجديد (الفصل ١٠: "تظهر مستويات الامتداد
   المستخدمة كأهداف: 0.618 / 1.0 / 1.618 / 2.0"):
     TP1 = 0.618 (أخضر) | TP2 = 1.000 (أزرق) | TP3 = 1.618 (أزرق) | TP4 = 2.000 (أزرق)
   ملاحظة (الفصل ١٠ أيضاً): "لا يوجد إغلاق جزئي للأرباح ضمن هذه الاستراتيجية" —
   الأهداف الأربعة كلها تُعرض معاً كخريطة كاملة، بدون تقسيم حجم الصفقة بينها.

   الإلغاء/إعادة البناء التلقائي: لو رجع السعر وكسر نقطة B بالاتجاه المعاكس —
   سواء قبل ما C تتأكد أو بعدها — السيكونز كامل يُلغى فوراً (active=false)،
   وبما إنه ما في حالة محفوظة (كل تحليل بيعيد الحساب من الصفر من آخر BOS
   الفعلي بمحرك الهيكلية)، أي سيكونز جديد بيتبنى تلقائياً أول ما هيكلية جديدة
   تتشكل — بدون أي تدخل يدوي.
   ============================================================================ */

const PROJECTION_RATIOS = [
  { key: "TP1", ratio: 0.618, color: "أخضر" },
  { key: "TP2", ratio: 1.0, color: "أزرق" },
  { key: "TP3", ratio: 1.618, color: "أزرق" },
  { key: "TP4", ratio: 2.0, color: "أزرق" },
];

const MIN_LEG = 1e-9; // حماية من طول ساق صفري/سالب (بيانات فاسدة)

/* أول سوينغ حقيقي (مؤكَّد أصلاً بمنطق Fractal بمحرك الهيكلية — مش أي إغلاق
   عابر) بعد fromIndex، من النوع المطلوب (قمة للصاعد/قاع للهابط)، وسعره
   يتجاوز extremePrice (نقطة A) بنفس اتجاه الحركة. هاي هي نقطة C. */
function findConfirmedContinuation(swings, fromIndex, pivotType, extremePrice, direction, useLatest = false) {
  let result = null;
  for (const s of swings || []) {
    if (s.index <= fromIndex) continue;
    if (s.type !== pivotType) continue;
    const beyond = direction === "up" ? s.price > extremePrice : s.price < extremePrice;
    if (beyond) {
      if (!useLatest) return s; // أول تطابق وبس (سلوك السيكونز الصغيرة/المكتملة)
      result = s; // نحدّث لآخر تطابق ونكمل — C بيتبع أبعد نقطة وصلها السعر فعلاً
    }
  }
  return result;
}

/* هل انكسرت نقطة B بإغلاق شمعة بالاتجاه المعاكس بين fromIndex و toIndex؟
   (toIndex=null يعني لحد آخر شمعة متوفرة) — يعني إلغاء كامل للسيكونز (6.5) */
function brokenBack(candles, fromIndex, toIndex, level, direction) {
  const end = toIndex == null ? candles.length : toIndex + 1;
  for (let i = fromIndex + 1; i < end; i++) {
    const c = candles[i];
    if (!c) continue;
    if (direction === "up" && c.close < level) return true;
    if (direction === "down" && c.close > level) return true;
  }
  return false;
}

/* -------------------- أكبر سيكونز تاريخياً باتجاه مُعطى --------------------
   أحياناً بيصير دخول من OB بينما لسا ما تشكّلت سيكونز جديدة بالساق الحالية
   (خصوصاً مباشرة بعد MSS، قبل ما BOS استمراري يتأكد). بدل ما ننتظر، بندوّر
   على أكبر سيكونز مؤكَّدة (Confirmed) بكامل التاريخ (أي ساق) بنفس اتجاه
   الصفقة — ومبدأ المتوروشكا نفسه بيضمن إنو "الأكبر" هي الأكثر أهمية هيكلياً،
   حتى لو تشكّلت بساق سابقة. */
export function findBiggestSequence(candles, structureResult, direction) {
  const { events, swings } = structureResult || {};
  if (!Array.isArray(events) || !direction) return null;

  const candidates = events.filter((e) => e.type === "BOS" && e.direction === direction);
  let best = null;
  let bestLegLength = -Infinity;
  for (const bosEvent of candidates) {
    const seq = analyzeSequence(candles, { lastBOS: bosEvent, swings }, { useLatestC: true });
    if (seq.active && seq.stage === "confirmed" && seq.legLength > bestLegLength) {
      best = seq;
      bestLegLength = seq.legLength;
    }
  }
  return best;
}

/* -------------------- مبدأ المتوروشكا (طبقات سيكونز متداخلة) --------------------
   بنفس الفريم، أول BOS بيبني سيكونز صغيرة (Origin ضيّق) — توصل أهدافها، بعدين
   تصحيح وقمة/قاع جديد أبعد بيولّد BOS استمراري تاني (structure.js بيسجّله
   كحدث BOS منفصل بـ Origin أوسع)، وهيك سيكونز أكبر بتحتوي التانية جواها،
   وهي "الأساسية". هاد بيتكرر لحد آخر استمرار بالساق الفعّالة الحالية.

   بترجع مصفوفة طبقات مرتبة من الأكبر (Origin الأقدم = الدمية الخارجية،
   index=0) للأصغر (Origin الأحدث = الدمية الداخلية، آخر عنصر) — كل وحدة
   نفس شكل analyzeSequence() تماماً + isOutermost/isInnermost/layerIndex. */
export function analyzeSequenceLayers(candles, structureResult) {
  const { events, swings, lastMSS } = structureResult || {};
  if (!Array.isArray(events) || !events.length) return [];

  // كل أحداث BOS يلي بنفس الساق الفعّالة الحالية بس (بعد آخر MSS، أو من
  // بداية التاريخ لو ما صار MSS بعد) — مش كل BOS بكل التاريخ (سيقان قديمة
  // منتهية بالانعكاس مالها علاقة بالمتوروشكا الحالية)
  const legStartIndex = lastMSS ? lastMSS.index : -Infinity;
  const bosInLeg = events
    .filter((e) => e.type === "BOS" && e.index > legStartIndex)
    .sort((a, b) => a.swingA.index - b.swingA.index); // الأقدم Origin أولاً = الأكبر

  return bosInLeg.map((bosEvent, i) => {
    const seq = analyzeSequence(candles, { lastBOS: bosEvent, swings }, { useLatestC: i === 0 });
    return {
      ...seq,
      layerIndex: i,
      isOutermost: i === 0,
      isInnermost: i === bosInLeg.length - 1,
      bosIndex: bosEvent.index,
    };
  });
}

/* الطبقة "الأساسية" لمتوروشكا مُعطاة — حسب كلام المستخدم حرفياً: الأكبر
   (Origin الأقدم) هي الأساسية يلي تقود القرار، مش أصغر وحدة وصلت أهدافها.
   بنفضّل أكبر وحدة لسا فعّالة (active) أو قيد التكوين (awaiting-c)؛ لو كل
   الطبقات انلغت، بنرجع null. */
export function pickPrimaryLayer(layers) {
  if (!Array.isArray(layers) || !layers.length) return null;
  const usable = layers.filter((l) => l.active || l.stage === "awaiting-c");
  if (usable.length) return usable[0]; // أول وحدة (الأكبر) بالترتيب الأصلي
  // كل الطبقات ملغاة (نقطة B انكسرت فعلياً بكل وحدة منها) — لازم نرجع null
  // صراحةً، مش أكبر وحدة ملغاة "للسياق"، لأنو المستدعي (engine.js) بيعاملها
  // كسيكونز صالحة مباشرة (بيرسمها ويحسب أهداف منها) بدون ما يتأكد من active.
  // القرار الصح هون: مافي سيكونز صالحة بعد؛ الأهداف البديلة (أقرب قمة/أكبر
  // سيكونز تاريخية) بـdecision.js بتتكفّل بالحالة هاي أصلاً.
  return null;
}

/* بتاخد آخر BOS من analyzeStructure (فيه Origin/A/B جاهزين + قائمة swings
   الكاملة المؤكَّدة) وتبني السيكونز الرباعي + الأهداف إذا C تأكدت وما انكسرت */
/* -------------------- WCL: منطقة الدخول (قاعدة SK رقم 1) --------------------
   بعد ما يوصل السعر لمنطقة C، بنسحب تصحيح فيبوناتشي من Origin(0) إلى C،
   ومنطقة الدخول الصالحة الوحيدة هي "المستويات الذهبية" (0.5 – 0.66) من هاد
   التصحيح. */
export function computeWCL(origin, C, direction) {
  if (!origin || !C) return null;
  const range = direction === "up" ? C.price - origin.price : origin.price - C.price;
  if (!(range > 0)) return null;
  const levelAt = (ratio) => (direction === "up" ? C.price - range * ratio : C.price + range * ratio);
  const boundA = levelAt(0.5);
  const boundB = levelAt(0.66);
  return {
    ratioLow: 0.5,
    ratioHigh: 0.66,
    low: Math.min(boundA, boundB),
    high: Math.max(boundA, boundB),
  };
}

/* هل سعر مُعطى داخل منطقة WCL؟ */
export function priceInWCL(wcl, price) {
  if (!wcl || price == null) return false;
  return price >= wcl.low && price <= wcl.high;
}

export function analyzeSequence(candles, structureResult, { useLatestC = false } = {}) {
  const { lastBOS, swings } = structureResult || {};
  if (!lastBOS || !lastBOS.swingA || !lastBOS.swingB || !lastBOS.swingC) {
    return { active: false, stage: "none", reason: "لا يوجد BOS مؤكَّد بعد لبناء سيكونز عليه" };
  }

  const direction = lastBOS.direction; // 'up' | 'down'
  const origin = lastBOS.swingA; // 0 — بداية الحركة
  const A = lastBOS.swingB; // الاندفاع الأول (مستوى كسر الـ BOS)
  const B = lastBOS.swingC; // التصحيح المؤكَّد (0.333+ وكسر BOS فعلي)

  const legLength = Math.abs(A.price - origin.price);
  if (legLength <= MIN_LEG) {
    return { active: false, stage: "none", reason: "طول الساق الأساسية (0→A) غير صالح" };
  }

  const pivotType = direction === "up" ? "high" : "low";
  const C = findConfirmedContinuation(swings, lastBOS.index, pivotType, A.price, direction, useLatestC);

  // -------- إلغاء قبل ما C تتأكد أصلاً: رجع السعر وكسر B أو نقطة Origin(0)
  // بالاتجاه المعاكس (قاعدة SK رقم 4: "إذا تم كسر النقطة 0 او النقطة B
  // يتم اهمال السيكونس لأنها غير صالحة للدخول") --------
  if (brokenBack(candles, lastBOS.index, C?.index ?? null, B.price, direction)) {
    return {
      active: false,
      stage: "invalidated",
      direction,
      points: { origin, A, B },
      reason: "انكسرت نقطة B بالاتجاه المعاكس قبل تأكيد C — السيكونز أُلغيت بالكامل",
    };
  }
  if (brokenBack(candles, lastBOS.index, C?.index ?? null, origin.price, direction)) {
    return {
      active: false,
      stage: "invalidated",
      direction,
      points: { origin, A, B },
      reason: "انكسرت نقطة Origin (0) بالاتجاه المعاكس قبل تأكيد C — السيكونز أُلغيت بالكامل",
    };
  }

  if (!C) {
    // BOS تأكد، بس لسا ما تشكّل Pivot حقيقي يتجاوز A — منستنى، بدون أي أهداف
    return {
      active: false,
      stage: "awaiting-c",
      direction,
      points: { origin, A, B },
      legLength,
      reason: "بانتظار تأكيد نقطة C (سوينغ حقيقي يتجاوز A بعد كسر الهيكل)",
    };
  }

  // -------- إلغاء بعد تأكيد C: رجع السعر وكسر B أو Origin(0) بالاتجاه المعاكس --------
  if (brokenBack(candles, C.index, null, B.price, direction)) {
    return {
      active: false,
      stage: "invalidated",
      direction,
      points: { origin, A, B, C },
      legLength,
      reason: "رجع السعر وكسر نقطة B بعد تأكيد C — الهيكل انعكس والسيكونز أُلغيت",
    };
  }
  if (brokenBack(candles, C.index, null, origin.price, direction)) {
    return {
      active: false,
      stage: "invalidated",
      direction,
      points: { origin, A, B, C },
      legLength,
      reason: "رجع السعر وكسر نقطة Origin (0) بعد تأكيد C — الهيكل انعكس والسيكونز أُلغيت",
    };
  }

  // -------- الأهداف: امتدادات بطول الساق الأساسية (Origin→A)، مسقطة من C --------
  const targets = PROJECTION_RATIOS.map((t) => ({
    ...t,
    price: direction === "up" ? C.price + legLength * t.ratio : C.price - legLength * t.ratio,
  }));

  const lastPrice = candles[candles.length - 1].close;
  for (const t of targets) t.hit = direction === "up" ? lastPrice >= t.price : lastPrice <= t.price;

  const wcl = computeWCL(origin, C, direction);

  return {
    active: true,
    stage: "confirmed",
    direction,
    points: { origin, A, B, C },
    legLength,
    targets,
    reachedCount: targets.filter((t) => t.hit).length,
    nextTarget: targets.find((t) => !t.hit) || null,
    wcl, // منطقة الدخول الذهبية (0.5-0.66 من Origin إلى C) — قاعدة SK رقم 1
    priceInWCL: priceInWCL(wcl, lastPrice),
  };
}

/* -------------------- أولوية مصدر الأهداف (خامس عشر) --------------------
   الأهداف لازم يكون إلها سبب تحليلي واضح، مش RR عشوائي. الأولوية حرفياً كما
   وردت بالتوثيق: Sequence على 4H، ثم Daily، ثم موجات الفريم التنفيذي نفسه.
   sequencesByTF = { h4, daily, execution } — كل واحدة نتيجة analyzeSequence() أو null */
export function resolveSequence(sequencesByTF, priorityOrder = ["h4", "daily", "execution"], expectedDirection = null) {
  // expectedDirection = اتجاه الصفقة المعتمد فعلياً (نفس trend اللي بيبني عليه
  // القرار BUY/SELL). كل سيكونز على فريم مختلف بيحسب اتجاهه من آخر BOS على
  // نفس الفريم، وممكن يختلف عن اتجاه الفريم الرئيسي. لازم نرفض أي سيكونز
  // باتجاه مخالف — وإلا بتطلع أهداف BUY فوق السعر لصفقة SELL أو العكس.
  const matchesDirection = (seq) => !expectedDirection || !seq?.direction || seq.direction === expectedDirection;

  for (const tf of priorityOrder) {
    const seq = sequencesByTF[tf];
    if (seq?.active && matchesDirection(seq)) return { ...seq, sourceTF: tf };
  }
  // ولا وحدة تأكدت أهدافها بعد (C لسا ما تشكّلت) — منرجع أقرب وحدة بمرحلة
  // "awaiting-c" (لو موجودة) عشان الواجهة تقدر تعرض 0/A/B وهي منتظرة، بدل
  // ما تختفي الصفحة كلياً لحد ما ينضج السيكونز بالكامل. بنفس شرط تطابق الاتجاه.
  for (const tf of priorityOrder) {
    const seq = sequencesByTF[tf];
    if (seq?.stage === "awaiting-c" && matchesDirection(seq)) return { ...seq, sourceTF: tf };
  }
  return { active: false, sourceTF: null, stage: "none", reason: "لا يوجد سيكونز فعّال أو قيد التكوين يطابق اتجاه الصفقة المعتمد على أي فريم من فريمات الأولوية" };
}
