/* ============================================================================
   lib/qais/orderblock-v2/matryoshka.js
   مبدأ المتروشكا — سيكونس أساسي جوّاه سيكونسات فرعية.

   ---------------------------------------------------------------------------
   نصّ وثيقته «SK System – Part 1»:

     «١ – السيكونس الأساسي: يمثّل الاتجاه الأكبر أو الحركة الأساسية للسوق…
       تخيّلها كعمود فقري لاتجاه السوق، وهي تشمل العديد من السيكونس الفرعية.

      ٢ – السيكونس الفرعية: هي نمط أصغر وحركة سعرية ضمن حركة سعرية أكبر…
       وتشمل أيضاً التصحيحات… تُستخدم لتحديد نقاط الدخول أو الخروج المحتملة
       ضمن الاتجاه العام.

      السيكونس الفرعية تشبه قطع الألغاز الصغيرة، بينما السيكونس الأساسي
      الصورة الكاملة لحركة السوق.»

   ---------------------------------------------------------------------------
   ⚠️ **من الوثيقة: تحديد السيكونز والأهداف وبس.**
   قراره (٢٠٢٦-٠٨-٢١): «يلي بدي إياك تاخذه من الملف بس كيف بيتم تحديد
   السيكونز والأهداف. أما الستوب والدخول وكل إشي تاني فمن النظام يلي عملنا.»

   فهالوحدة **ما بتلمس** الدخول (الثلث · SMT · CISD) ولا الستوب. بتبني
   الشجرة وبتعطي أهداف كل مستوى، والسلسلة القائمة بتضل هي اللي بتقرر
   الدخول.

   ⚠️ المنطقة الذهبية 0.5–0.66 المذكورة بالوثيقة **ما انطبّقت** — هي قاعدة
   دخول، وقواعد الدخول بتضل كما هي بقراره.

   ---------------------------------------------------------------------------
   ⚠️ «فرعي» = **محتوى فعلياً** جوّا الأساسي — زمنياً وسعرياً.
   ما في افتراض إنه أي سيكونز أصغر هو فرعي: لازم نقاطه الأربع تقع ضمن
   نطاق الأساسي. وهاد بينقاس، مش بينفترض.

   المقياسان مختلفان بقصد: الأساسي من **السوينغات الكبرى** والفرعية من
   **البيفوتات الداخلية** — نفس التفريق اللي بيستعمله محرك الهيكل.
   ============================================================================ */

import { enumerateSequences, analyzeSequenceV2 } from "./sequence-v2.js";

/* ⚠️ شكل واحد للرفض والنجاح: `primary` و`subs` موجودين دايماً. بدونهن
   المستهلك بيقرا `undefined` وبينكسر على `.length` أو `.map`. */
const insufficient = (why) => ({ ok: false, value: "INSUFFICIENT_DATA", why, reason: why, primary: null, subs: [], counts: null });

/** المدى الزمني والسعري لسيكونز — حدوده من نقاطه المتوفرة. */
function extentOf(seq) {
  const pts = [seq.origin, seq.A, seq.B, seq.C].filter(Boolean);
  if (!pts.length) return null;
  return {
    fromIndex: Math.min(...pts.map((p) => p.index)),
    toIndex: Math.max(...pts.map((p) => p.index)),
    low: Math.min(...pts.map((p) => p.price)),
    high: Math.max(...pts.map((p) => p.price)),
  };
}

/** هل `inner` محتوى بالكامل جوّا `outer`؟ */
export function isNestedIn(inner, outer) {
  const a = extentOf(inner), b = extentOf(outer);
  if (!a || !b) return false;
  return a.fromIndex >= b.fromIndex && a.toIndex <= b.toIndex && a.low >= b.low && a.high <= b.high;
}

/**
 * شجرة المتروشكا عند لحظة معيّنة.
 *
 * @param candles    شموع الفريم
 * @param structure  ناتج analyzeStructureV2 (بده majorSwings وinternalSwings)
 * @param options    { asOfIndex, direction }
 *
 * @returns {{
 *   ok, primary, subs, counts, reason
 * }}  `primary` سيكونز كامل بأهدافه · `subs` مصفوفة السيكونسات الفرعية.
 */
export function matryoshkaAt(candles, structure, options = {}) {
  const at = options.asOfIndex ?? (Array.isArray(candles) ? candles.length - 1 : 0);
  if (!Array.isArray(candles) || candles.length < 2) return insufficient("ما في شموع كافية");
  if (!structure?.majorSwings?.length) return insufficient("ما في سوينغات كبرى");

  /* ── ١ · السيكونس الأساسي: العمود الفقري ─────────────────────────
     نفس اختيار `analyzeSequenceV2` بالضبط — «أكبر سيكونز» بقيوده
     التلاتة (حيّة · C مؤكَّدة · نفس الاتجاه). ما في اختيار جديد هون. */
  const primary = analyzeSequenceV2(candles, structure, { asOfIndex: at, direction: options.direction ?? null });
  if (!primary?.ok) {
    return { ok: false, reason: primary?.reason ?? "ما في سيكونز أساسي", stage: primary?.stage ?? "none", primary: null, subs: [] };
  }

  /* ── ٢ · السيكونسات الفرعية ──────────────────────────────────────
     من **البيفوتات الداخلية** — المقياس الأصغر. وبتنفلتر بالاحتواء
     الفعلي جوّا الأساسي، مش بافتراض إنها أصغر فهي جوّاه. */
  const internal = structure.internalSwings || [];
  const primaryShape = { origin: primary.points.origin, A: primary.points.A, B: primary.points.B, C: primary.points.C };

  let candidates = [];
  if (internal.length >= 2) {
    /* ⚠️ البيفوت الداخلي ما إله `confirmedAtIndex` بمخرج المحرك — بنركّبه
       (lookback 2) زي ما بتعمل `smtSourceFromLowerTF`، وإلا بتنكسر
       السببية ويصير السوينغ «معروفاً» قبل ما يتشكّل. */
    const withConfirm = internal.map((s) => ({ ...s, confirmedAtIndex: s.confirmedAtIndex ?? s.index + 2 }));
    candidates = enumerateSequences(candles, withConfirm, at);
  }

  const subs = candidates
    .filter((s) => isNestedIn(s, primaryShape))
    /* ⚠️ **بلا فلترة اتجاه** — الوثيقة بتقول الفرعية «تشمل أيضاً
       التصحيحات»، والتصحيح بتعريفه بعكس الأساسي. */
    .map((s) => ({
      direction: s.direction,
      origin: s.origin, A: s.A, B: s.B,
      legLength: s.legLength,
      retracement: s.retracement,
      alive: s.alive,
      breakTime: s.breakTime,
      /* تصحيح أم امتداد: نفس اتجاه الأساسي = امتداد · معاكس = تصحيح. */
      role: s.direction === primary.direction ? "extension" : "correction",
    }))
    .sort((a, b) => b.legLength - a.legLength);

  return {
    ok: true,
    reason: null,
    primary,
    subs,
    counts: {
      candidates: candidates.length,
      nested: subs.length,
      corrections: subs.filter((s) => s.role === "correction").length,
      extensions: subs.filter((s) => s.role === "extension").length,
      alive: subs.filter((s) => s.alive).length,
    },
  };
}
