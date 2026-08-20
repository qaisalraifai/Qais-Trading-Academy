/* ============================================================================
   lib/qais/symbol-readiness.js
   جاهزية الرمز — بديل `decision.js`.

   ---------------------------------------------------------------------------
   ⚠️ ليش انبنت: `decision.js` كانت بتطلّع `score` و`radarScore` و`aiConfidence`
   و`radarStrength` — **كلهن مجاميع موزونة ثابتة مكتوبة بالكود**. ما في نموذج،
   وما في تكامل LLM بالمشروع أصلاً. طالب بيشوف «٧٥٪» بيفهم إنه في نموذج قدّر
   احتمال نجاح. ما في. الرقم كان بيوهم بدقة غير موجودة.

   البديل مش رقم أنضف — هو **الخريطة نفسها**: `blockReadiness` بترجّع سطر لكل
   قاعدة بحالتها، والوحدة هاي بترفعها من مستوى الكتلة لمستوى الرمز.

   ⚠️ العدّاد الوحيد هون هو `metCount/totalCount` — **عدّ مش نسبة مرجّحة**.
   ---------------------------------------------------------------------------
   ما بينضرب بأوزان، وما بينحوّل لنسبة مئوية، وما بيتحوّل لـ«ثقة». هو كم شرط
   تحقق من كم شرط. أي مستهلك بده يعرضه لازم يعرضه هيك: «٧ من ١٠».

   ⚠️ ما في «أقرب صفقة» ولا تقريب.
   ---------------------------------------------------------------------------
   إما السلسلة اكتملت فالصفقة موجودة بدخولها وستوبها وأهدافها، وإما لأ فبيطلع
   اسم الشرط اللي واقفة عنده. ما في حالة تالتة.
   ============================================================================ */

/* ترتيب مراحل سلسلة الدخول — من `buildTradeSetup`. مش تقييم ولا وزن:
   هو ترتيب المنهجية نفسها (الثلث → SMT → CISD). بينستعمل عشان نعرف أي
   كتلة وصلت أبعد. */
const STAGE_ORDER = ["third", "smt", "cisd"];

/** أبعد نقطة وصلتها الكتلة بالسلسلة. الأعلى = أبعد. */
function stageReach(setup) {
  if (!setup) return -1;
  if (setup.ok) return STAGE_ORDER.length; // اكتملت
  const i = STAGE_ORDER.indexOf(setup.blockedAt);
  return i < 0 ? -1 : i;
}

/**
 * بتختار الكتلة اللي بتمثّل الرمز.
 *
 * ⚠️ القاعدة مصرّح فيها لأنها **اختيار عرض**، مش قاعدة منهجية:
 *   ١) أي كتلة سلسلتها اكتملت (صفقة فعلية) بتسبق كل شي.
 *   ٢) وإلا: الكتلة اللي وصلت أبعد مرحلة بالسلسلة.
 *   ٣) وعند التعادل: الأحدث تكوّناً.
 *
 * ما في ترجيح ولا «الأقرب للسعر» — الأخيرة بتحتاج عتبة مسافة، وأي عتبة هون
 * رقم مخترع.
 */
export function pickRepresentative(setups) {
  if (!Array.isArray(setups) || !setups.length) return null;
  let best = null;
  let bestReach = -2;
  for (const s of setups) {
    const reach = stageReach(s.setup);
    if (
      reach > bestReach ||
      (reach === bestReach && (s.blockId ?? "") > (best?.blockId ?? ""))
    ) {
      best = s;
      bestReach = reach;
    }
  }
  return best;
}

/**
 * جاهزية الرمز من ناتج `runSkV2`.
 *
 * @returns {{
 *   available: boolean, why: string|null,
 *   signal: 'BUY'|'SELL'|'WAIT',
 *   entryStatus: 'Ready'|'Waiting'|'Unavailable',
 *   tradeValid: boolean,
 *   rows: Array, metCount: number|null, totalCount: number|null,
 *   headline: string|null, blockId: string|null, direction: 'up'|'down'|null,
 *   entry: number|null, stopLoss: number|null, targets: Array|null,
 *   riskReward: number|null, waitingFor: string|null
 * }}
 */
export function symbolReadiness(skV2) {
  const none = (why) => ({
    available: false,
    why,
    signal: "WAIT",
    entryStatus: "Unavailable",
    tradeValid: false,
    rows: [],
    /* ⚠️ `null` مش صفر. صفر بيقول «ولا شرط تحقق»، والحقيقة «ما انقاس». */
    metCount: null,
    totalCount: null,
    headline: null,
    blockId: null,
    direction: null,
    entry: null,
    stopLoss: null,
    targets: null,
    riskReward: null,
    waitingFor: null,
  });

  if (!skV2 || skV2.ok !== true) {
    return none(skV2?.why ?? skV2?.reason ?? "سلسلة SK ما اشتغلت");
  }
  const rep = pickRepresentative(skV2.setups);
  if (!rep) return none("ما في كتلة حيّة على فريم الكتل");

  const { setup, readiness, direction } = rep;
  const ok = !!setup?.ok;

  /* الشرط الواقفة عنده — من الخريطة نفسها، مش من نص محفور. */
  const pendingRow = (readiness?.rows ?? []).find((r) => r.state === "pending");

  return {
    available: true,
    why: null,
    /* ⚠️ الإشارة **مشتقّة من وجود صفقة**، مش من رقم يتخطى عتبة.
       بلا سلسلة مكتملة ما في BUY ولا SELL — في انتظار. */
    signal: ok ? (direction === "up" ? "BUY" : "SELL") : "WAIT",
    entryStatus: ok ? "Ready" : readiness?.status === "unknown" ? "Unavailable" : "Waiting",
    tradeValid: ok,
    rows: readiness?.rows ?? [],
    metCount: readiness?.metCount ?? null,
    totalCount: readiness?.totalCount ?? null,
    headline: readiness?.headline ?? null,
    blockId: rep.blockId ?? null,
    direction: direction ?? null,
    entry: ok ? setup.entry ?? null : null,
    stopLoss: ok ? setup.stop ?? null : null,
    targets: ok ? setup.targets ?? null : null,
    /* R:R حقيقي محسوب من الأهداف — مش تقدير. `null` لو ما في أهداف. */
    riskReward:
      ok && setup.rr?.length ? setup.rr[setup.rr.length - 1].r ?? null : null,
    waitingFor: ok ? null : pendingRow?.label ?? null,
  };
}

/* ============================================================================
   صف الرادار — الشكل اللي بينكتب بقاعدة البيانات وبتقراه اللوحتان.

   ⚠️ أسماء الأعمدة ما تغيّرت (`radar_score` · `bos_status` · …) لأن تغيير
   المخطط قرار منفصل. اللي تغيّر هو **المحتوى**:

     · `score` و`radar_score` بيطلعوا `null` — كانوا مجموع موزون ثابت من
       `decision.js`. `null` بيقول «ما في رقم»، وصفر بيقول «الرقم صفر».
     · `bos_status` · `choch_status` · `fvg_status` · `liquidity_status` ·
       `premium_discount` · `market_structure` · `htf_trend` — مصدرهن انشال،
       فبينكتبوا `null` صراحةً بدل ما تضل قيمة قديمة معلّقة بالصف.
     · `reason_tags` صارت **معرّفات القواعد المتحققة فعلاً** (R3 · R4 · …) —
       كل واحدة بترجع لسطر بالخريطة.
   ============================================================================ */
export function radarRow(analysis) {
  const rd = analysis?.readiness ?? null;
  const met = (rd?.rows ?? []).filter((r) => r.state === "met").map((r) => r.id);
  return {
    symbol: analysis?.symbol ?? null,
    status: analysis?.tradeValid ? "green" : "neutral",
    /* ⚠️ لا رقم. */
    score: null,
    direction: analysis?.direction ?? null,
    price: analysis?.price ?? null,
    timeframe: analysis?.timeframe ?? null,
    reason_tags: met.length ? met : null,
    radar_status: analysis?.tradeValid ? "green" : "neutral",
    radar_score: null,
    radar_signal_label: analysis?.signal ?? "WAIT",
    radar_signal_strength: null,
    htf_trend: null,
    market_structure: null,
    bos_status: null,
    choch_status: null,
    fvg_status: null,
    liquidity_status: null,
    premium_discount: null,
    session: analysis?.session ?? null,
    session_label: analysis?.sessionLabel ?? null,
    entry_status: analysis?.entryStatus ?? "Unavailable",
    risk_reward: analysis?.riskReward ?? null,
    /* ⚠️ العدّاد (`metCount/totalCount`) **ما بينكتب بعمود جديد**. هو جوّا
       `decision` (jsonb) تحت `readiness` — إضافة عمود تغيير مخطط، وهاد قرار
       منفصل ما انطلب. */
    why: analysis?.tradeValid
      ? analysis?.chartTrade?.reason ?? null
      : rd?.waitingFor
        ? `بانتظار ${rd.waitingFor}`
        : rd?.why ?? null,
  };
}
