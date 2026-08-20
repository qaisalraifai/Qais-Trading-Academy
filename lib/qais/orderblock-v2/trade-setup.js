/* ============================================================================
   lib/qais/orderblock-v2/trade-setup.js
   وصل السلسلة: كتلة → ثلث → لمس → SMT → CISD → صفقة.

   السلسلة كما نطقها صاحب المنهجية (٢٠٢٦-٠٨-١٨):
       «بتنعرض كمنتظرة، بس يرجعلها السعر مرة ثانية إذا صحّح — يعني وصارت
        شروط الدخول — بتطلع الصفقة والأهداف والستوب.»
       «الدخول بيكون بعد ما تتكوّن SMT عند أي مستوى ما بيفرق من الأوردر
        بلوك، بعد هيك بيكون في تأكيد ثاني عفريم أقل يلي هو CISD أول ما
        يصير وندخل. والستوب بيكون تحت الـSMT.»
       «الأهداف على السيكونز.»

   ---------------------------------------------------------------------------
   الترتيب **مقصود ومُلزم**:

     ١. الكتلة مؤكَّدة (R1–R7)                    → rules-sk.js
     ٢. السعر رجعلها وهو تحت الثلث (R8، فريمان)   → entry-window.js
     ٣. SMT: الأصل كنس والمترابط ما كنس (R10)     → smt-v2.js
     ٤. CISD على الفريم الأصغر (R9)               → cisd.js
     ٥. الدخول · الستوب تحت نقطة SMT · الأهداف    → sequence-v2.js

   ⚠️ كل خطوة **بوابة**: لو وحدة ما تحققت، ما بنكمّل. والسبب بينتسجّل
   بـ`blockedAt` عشان يبان **وين** وقفت مش بس إنها وقفت.

   ⚠️ `INSUFFICIENT_DATA` مش «لأ».
   ---------------------------------------------------------------------------
   لو طبقة ما قدرت تقيس (بيانات مترابط ناقصة، فريم أصغر مش متوفّر)،
   النتيجة بتكون `INSUFFICIENT_DATA` مش رفضاً. اعتبارها رفضاً بيخفي نقص
   بيانات ورا قرار يبان مقصوداً — وهاد بالضبط اللي بتمنعه قواعد المشروع.

   ⚠️ الستوب **تحت نقطة الـSMT** مش تحت الكتلة.
   ---------------------------------------------------------------------------
   قرار صريح. نقطة الـSMT هي أقصى امتداد للكنس — يعني الستوب خلف السيولة
   اللي انسحبت، مش خلف حدود الكتلة.
   ============================================================================ */

import { blockStateAt } from "./entry-window.js";
import { detectSMT, smtSourceFromLowerTF } from "./smt-v2.js";
import { findCISD } from "./cisd.js";
import { analyzeSequenceV2 } from "./sequence-v2.js";

const insufficient = (why, stage) => ({ ok: false, value: "INSUFFICIENT_DATA", why, blockedAt: stage });
const blocked = (stage, reason, extra = {}) => ({ ok: false, blockedAt: stage, reason, ...extra });

export const SETUP_DEFAULTS = {
  /* أقصى شموع (بفريم الكتلة) بينتظرها بين اللمس والـSMT. */
  smtSearchBars: 12,
  /* أقصى شموع (بالفريم الأصغر) بينتظرها بين الـSMT والـCISD. */
  cisdMaxBars: 60,
};

/**
 * الصفقة الكاملة من كتلة واحدة — أو وين وقفت السلسلة.
 *
 * @param block         كتلة من analyzeOrderBlocksSK
 * @param ctx {
 *   candles,            شموع فريم الكتلة
 *   structure,          ناتج analyzeStructureV2 لنفس الفريم
 *   thirdContextFor,    (index) => contexts لـR8 (H4 + يومي)
 *   correlate,          { candles, swings } للأصل المترابط — اختياري
 *   lower,              { candles, timeframe } للفريم الأصغر (M15/M5) — اختياري
 *   asOfIndex,
 * }
 */
export function buildTradeSetup(block, ctx, options = {}) {
  const cfg = { ...SETUP_DEFAULTS, ...options };
  const { candles, structure, thirdContextFor, correlate, lower } = ctx;
  const at = ctx.asOfIndex ?? candles.length - 1;
  const dirUp = block.direction === "up";

  /* ── ١+٢ · الكتلة والثلث ─────────────────────────────────────────── */
  const state = blockStateAt(candles, block, at, thirdContextFor);
  if (state.state !== "entry") {
    return blocked("third", state.reason, { state: state.state, since: state.since ?? null });
  }
  const touch = state.entry;

  /* ── ٣ · SMT ─────────────────────────────────────────────────────── */
  /* ⚠️ مصدر الـSMT **بينمرّر** — ما بينفرض.
     -----------------------------------------------------------------
     مقيس على الكتلة المتحقَّقة (٢٨ أبريل، لمس ٢٩ يوليو):

       H4 · سوينغات كبرى     → ما في SMT. آخر قاع مؤكَّد (28,231.79 من ١٧
                               يوليو) كان مكسوراً من ٢٤ يوليو، والنزول
                               للكتلة كان متواصلاً بلا ارتداد يثبّت قاعاً
                               جديداً — فما في سوينغ طازج ينكنس.
       M15 · سوينغات كبرى    → ما في. وبلحظة منهن: «المترابط كنس كمان».
       M15 · بيفوتات داخلية  → ✓ حلقتان، والثانية كنست لـ27,322.61 —
                               **بالضبط سعر لمس الكتلة**.

     **قراره (٢٠٢٦-٠٨-١٨): «عادي ما في مشكلة لو كان SMT عفريم ١٥ دقيقة».**
     فلما ينمرّر فريم أصغر ومترابط عليه، بينبنى المصدر منه تلقائياً
     بالبيفوتات الداخلية. وبيضل قابلاً للتجاوز بـ`smtPrimary`. */
  const autoSmt = ctx.smtPrimary ?? (
    lower?.candles?.length && ctx.structureOf
      ? smtSourceFromLowerTF(lower.candles, ctx.structureOf, lower.timeframe ?? "15min")
      : null
  );
  const smtPrimary = autoSmt ?? { candles, swings: structure.majorSwings, scale: "major", timeframe: "block" };
  const smtCorrelate = ctx.smtCorrelate ?? (
    ctx.correlateLower?.candles?.length && ctx.structureOf
      ? smtSourceFromLowerTF(ctx.correlateLower.candles, ctx.structureOf, lower?.timeframe ?? "15min")
      : correlate
  );
  if (!smtCorrelate?.candles?.length) {
    return insufficient("ما انمرّر أصل مترابط — SMT غير قابلة للتقييم", "smt");
  }

  /* اللمس بفريم الكتلة؛ لو الـSMT على فريم تاني بلزم محاذاة زمنية. */
  const touchTime = candles[touch.index].time;
  let sFrom = smtPrimary.candles === candles
    ? touch.index
    : smtPrimary.candles.findIndex((c) => c.time >= touchTime);
  if (sFrom < 0) return insufficient("لحظة اللمس برّا نطاق فريم الـSMT", "smt");

  const sTo = smtPrimary.candles === candles
    ? Math.min(at, touch.index + cfg.smtSearchBars)
    : Math.min(smtPrimary.candles.length - 1, sFrom + (cfg.smtSearchBarsLower ?? 48));

  /* ⚠️ كل الـSMT بالنافذة — مش أولها.
     -----------------------------------------------------------------
     أخذ الأولى بيكسر الصفقة: على الكتلة المتحقَّقة، أول SMT كنست لـ
     27,690.44 وبعدها السعر كمّل نزول لكنسة أعمق عند 27,322.61، والـCISD
     إجا عند 27,461.35. فالستوب طلع **فوق** الدخول بصفقة شراء — مستحيل.

     الستوب «تحت الـSMT» بيعني تحت **أعمق** سيولة انسحبت قبل الدخول. */
  const smts = [];
  for (let i = sFrom; i <= sTo; i++) {
    const r = detectSMT(smtPrimary, smtCorrelate, i, dirUp, cfg);
    if (r.value === "INSUFFICIENT_DATA" || !r.valid) continue;
    smts.push({ ...r, atIndex: i, timeframe: smtPrimary.timeframe ?? null, scale: smtPrimary.scale ?? null });
  }
  if (smts.length === 0) {
    return blocked("smt", `ما تكوّنت SMT خلال النافذة على ${smtPrimary.timeframe ?? "فريم الكتلة"} (${smtPrimary.scale ?? "major"})`, { touch });
  }
  const firstSmtTime = smtPrimary.candles[smts[0].atIndex].time;

  /* ── ٤ · CISD على فريمه الخاص ────────────────────────────────────── */
  /* ⚠️ فريمان **مختلفان** بقصد — قراره (٢٠٢٦-٠٨-١٩):
       «بس تصير عنا الـSMT ما بندخل مباشرة، بنستنى CISD عفريم ٥ دقايق
        بعدين بندخل.»
     فالـSMT على M15 والـCISD على M5. لو ما انمرّر فريم خاص للـCISD،
     بينستعمل فريم الـSMT نفسه — بس هاد مش المطلوب، فبينتسجّل بالمخرج
     بدل ما يمرق بصمت. */
  const cisdFrame = ctx.cisdFrame?.candles?.length ? ctx.cisdFrame : lower;
  const cisdOnOwnFrame = !!ctx.cisdFrame?.candles?.length;
  if (!cisdFrame?.candles?.length) {
    return insufficient("ما انمرّر فريم للـCISD — غير قابلة للتقييم", "cisd");
  }
  let from = cisdFrame.candles.findIndex((c) => c.time >= firstSmtTime);
  if (from < 0) {
    return insufficient("لحظة الـSMT برّا نطاق فريم الـCISD", "cisd");
  }
  const cisd = findCISD(cisdFrame.candles, from, dirUp, { maxBarsToBreak: cfg.cisdMaxBars });
  if (!cisd) return blocked("cisd", `ما صار CISD خلال ${cfg.cisdMaxBars} شمعة بعد الـSMT`, { touch, smtCount: smts.length });
  if (cisd.value === "INSUFFICIENT_DATA") return insufficient(cisd.why, "cisd");

  /* الـSMT المعتمدة = أعمق كنس **قبل** الـCISD. */
  const before = smts.filter((s) => smtPrimary.candles[s.atIndex].time <= cisd.time);
  if (before.length === 0) return blocked("smt", "كل الـSMT صارت بعد الـCISD — ترتيب غير صالح", { touch });
  const smt = before.reduce((m, s) => ((dirUp ? s.point < m.point : s.point > m.point) ? s : m));
  const smtTimeAbs = smtPrimary.candles[smt.atIndex].time;

  /* ── ٥ · الأهداف من السيكونز ─────────────────────────────────────── */
  /* ⚠️ بتنحسب عند **لحظة الدخول** مش عند آخر شمعة بالبيانات. حسابها
     بالآخر بيعطي أهدافاً ما كانت معروفة وقت الدخول — نظر للمستقبل. */
  let seqAt = at;
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].time <= cisd.time) { seqAt = Math.min(i, at); break; }
  }
  const seq = analyzeSequenceV2(candles, structure, { asOfIndex: seqAt });
  const targets = seq.stage === "complete" ? seq.targets : null;

  /* ⚠️ الستوب تحت نقطة الـSMT — قرار صريح، مش تحت الكتلة. */
  const stop = smt.point;
  const entry = cisd.breakPrice;
  const risk = Math.abs(entry - stop);

  /* ⚠️ حارس اتجاه: بالشراء الستوب لازم يكون **تحت** الدخول، وبالبيع فوقه.
     صار فعلياً لما كانت الوحدة تاخد أول SMT بدل أعمقها — طلعت صفقة شراء
     ستوبها فوق دخولها. صفقة مقلوبة أسوأ من ولا صفقة. */
  const stopValid = dirUp ? stop < entry : stop > entry;
  if (!stopValid) {
    return blocked("stop", `الستوب ${stop.toFixed(2)} مش ${dirUp ? "تحت" : "فوق"} الدخول ${entry.toFixed(2)} — إعداد غير صالح`,
      { touch, smt: { point: smt.point, time: smtTimeAbs }, cisd: { price: entry, time: cisd.time } });
  }
  if (!(risk > 0)) return blocked("stop", "المخاطرة صفر — الدخول والستوب بنفس السعر", { touch });

  return {
    ok: true,
    direction: block.direction,
    side: dirUp ? "شراء" : "بيع",
    block: { id: block.id, levels: block.levels, confirmedAtIndex: block.confirmedAtIndex },
    chain: {
      touch: { index: touch.index, time: touch.time, price: touch.price, thirds: touch.detail.perTimeframe },
      smt: { index: smt.atIndex, time: smtTimeAbs, point: smt.point,
             sweptLevel: smt.sweptLevel, correlateHeld: smt.correlateHeld,
             timeframe: smt.timeframe, scale: smt.scale, reason: smt.reason },
      cisd: { index: cisd.index, time: cisd.time, level: cisd.level, breakPrice: cisd.breakPrice,
              timeframe: cisdFrame.timeframe ?? null, reason: cisd.reason },
    },
    /* ⚠️ بينتسجّل صراحةً: `false` يعني الـCISD رجعت لفريم الـSMT لأن
       فريمها الخاص ما انمرّر — وهاد **خلاف القرار**، فما بيمرق بصمت. */
    cisdOnOwnFrame,
    cisdTimeframe: cisdFrame.timeframe ?? null,
    entry,
    stop,
    risk: +risk.toFixed(5),
    /* ⚠️ `null` لما السيكونز ما اكتملت — **مش** أهداف مخترعة. */
    targets,
    targetsStage: seq.stage,
    rr: targets
      ? targets.map((t) => ({ key: t.key, price: t.price, r: risk > 0 ? +(Math.abs(t.price - entry) / risk).toFixed(2) : null }))
      : null,
    reason:
      `كتلة ${dirUp ? "طلب" : "عرض"} · لمس تحت الثلث · SMT عند ${smt.point.toFixed(2)} · ` +
      `CISD ${lower.timeframe ?? ""} عند ${cisd.breakPrice.toFixed(2)}`,
  };
}
