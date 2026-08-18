/* ============================================================================
   lib/qais/liquidity-v2/sweeps.js
   انسحاب السيولة (Sweep) — «اتاخدت ثم انعكس» مقابل «اتاخدت ثم كمّل».

   التعريف المعتمد (نفس تفريق محرك الهيكل بين الذيل والإغلاق):
     • تجاوز بالذيل بدون إغلاق خلف المستوى = **Sweep** (السيولة انقطفت
       والمستوى صمد على أساس الإغلاق).
     • إغلاق خلف المستوى = **Breach** (كسر نظيف — المستوى انتهى كمرجع).
   الاتنين «أخذ» للبركة، بس معناهم معاكس تماماً، فالمخرج بيفرقهم بالاسم مش
   بدرجة.

   ---------------------------------------------------------------------------
   تجميع اللمسات لحلقات (episodes) — وليش هو شرط قبل أي عدّ:

   `wickBreaks` بمحرك الهيكل بتسجّل مدخل **لكل شمعة** بتلمس نفس المستوى:
   الحلقة بـevents.js ما بتشيل `refHigh` إلا عند الكسر بالإغلاق، فعشر شموع
   بتتلاعب بنفس القمة بتطلّع عشر مداخل. عدّها كعشر انسحابات بيضخّم أي رقم
   بعدد الشموع اللامسة، مش بعدد المحاولات.

   قاعدة الفصل هون **مش «فجوة X شمعة»** (رقم اعتباطي بيتغيّر مع الفريم)، بل:
   الحلقة بتنتهي لما السعر **يتراجع فعلياً** عن المستوى بمقدار ≥ عتبة بالـATR.
   يعني: لمسة تانية بعد ما السعر ابتعد وارتد = محاولة جديدة؛ لمسات متلاصقة
   والسعر ملزّق بالمستوى = نفس المحاولة.
   ============================================================================ */

import { atrAtCausal, atrBandAt } from "./atr-causal.js";
import { insufficient, isInsufficient, meanOfAvailable, strengthFromScore } from "./pool.js";

export const SWEEP_DEFAULTS = {
  /* قدّيش لازم يتراجع السعر عن المستوى حتى نعتبر إنه «ترك» المستوى وأي لمسة
     بعدها محاولة جديدة. نصف ATR = تراجع محسوس مش تذبذب حول المستوى. */
  reentryAtrMult: 0.5,
  /* نافذة الحكم على نتيجة الحلقة. ٦ شموع = ٢٤ ساعة على H4 — قصيرة كفاية
     حتى تنسب الحركة للانسحاب، وطويلة كفاية حتى يبان الزخم. اصطلاحية. */
  reactionBars: 6,
  /* قدّيش لازم يبتعد الإغلاق عكس الانسحاب حتى ينحسب انعكاس. */
  reversalAtrMult: 0.5,
};

/**
 * مسح تفاعل السعر مع بركة واحدة — من لحظة إتاحتها لحد انتهاء صلاحيتها.
 * ما بيقرا ولا شمعة قبل `availableFromIndex`، ولا بعد `expiresAtIndex`.
 */
export function scanPoolInteractions(candles, pool, options = {}) {
  const cfg = { ...SWEEP_DEFAULTS, ...options };
  const { atr } = options;

  const from = Math.max(0, pool.availableFromIndex);
  const to = Math.min(candles.length - 1, pool.expiresAtIndex ?? candles.length - 1);
  const level = pool.price;
  const isBuy = pool.side === "buy";

  const episodes = [];
  let current = null;
  let breach = null;

  const closeEpisode = (closedBy) => {
    if (!current) return;
    current.closedBy = closedBy;
    episodes.push(current);
    current = null;
  };

  for (let i = from; i <= to; i++) {
    const c = candles[i];

    /* الإغلاق خلف المستوى بينهي البركة ككل: المستوى ما عاد مرجع. أي لمسات
       بعده بتخص مستوى تاني، فبنوقف المسح. */
    if (isBuy ? c.close > level : c.close < level) {
      closeEpisode("breach");
      breach = {
        index: i,
        time: c.time,
        close: c.close,
        beyond: +Math.abs(c.close - level).toFixed(5),
        reason: `إغلاق ${isBuy ? "فوق" : "تحت"} ${level.toFixed(2)} — كسر نظيف مش انسحاب`,
      };
      break;
    }

    const penetrated = isBuy ? c.high > level : c.low < level;
    if (penetrated) {
      const depth = isBuy ? c.high - level : level - c.low;
      if (!current) {
        current = {
          startIndex: i,
          endIndex: i,
          touchCandles: 0,
          maxPenetration: 0,
          maxPenetrationIndex: i,
        };
      }
      current.endIndex = i;
      current.touchCandles++;
      if (depth > current.maxPenetration) {
        current.maxPenetration = depth;
        current.maxPenetrationIndex = i;
      }
      continue;
    }

    if (current) {
      /* السعر تحت المستوى (لبركة شراء). هل ابتعد كفاية حتى نعتبر إنه ترك
         المستوى؟ بنقيس بأقرب طرف للمستوى بهالشمعة — لأن السؤال «قدّيش
         ابتعد أقصى اقتراب»، مش الإغلاق. */
      const band = atrBandAt(atr, i, cfg.reentryAtrMult);
      if (!band.ok) continue; // ما في تقلب مقيس → ما منقدر نحكم، بنكمّل نفس الحلقة
      const distance = isBuy ? level - c.high : c.low - level;
      if (distance >= band.value) closeEpisode("retreat");
    }
  }
  closeEpisode(current ? "end_of_scan" : null);

  return { episodes, breach, scannedFrom: from, scannedTo: to };
}

/**
 * الحكم على نتيجة حلقة انسحاب + معناها الهيكلي.
 *
 * السببية: الحكم بيقرا شموع **بعد** نهاية الحلقة — وهاد صح، لأن الشي اللي
 * عم ينحكم عليه هو نتيجة لاحقة، وبينتوسم بـ`resolvedAtIndex`. الممنوع هو
 * إنه **الحلقة نفسها** (وقتها/عمقها) تتغيّر بمعلومة لاحقة، وهاد ما بيصير.
 * ولما النافذة ما بتكتمل بالبيانات المتوفرة، النتيجة INSUFFICIENT_DATA —
 * مش «ما في انعكاس».
 */
export function resolveEpisode(candles, pool, episode, options = {}) {
  const cfg = { ...SWEEP_DEFAULTS, ...options };
  const { atr, displacements = [], events = [] } = options;

  const isBuy = pool.side === "buy";
  const level = pool.price;
  const sweepDirection = isBuy ? "up" : "down"; // اتجاه الحركة اللي قطفت السيولة
  const reversalDirection = isBuy ? "down" : "up";

  const start = episode.endIndex + 1;
  const end = start + cfg.reactionBars - 1;
  const available = Math.min(end, candles.length - 1);
  const complete = end <= candles.length - 1;

  const band = atrBandAt(atr, episode.endIndex, cfg.reversalAtrMult);

  if (!complete) {
    return {
      outcome: insufficient(
        `نافذة الحكم ${cfg.reactionBars} شمعة، المتوفر ${Math.max(0, available - start + 1)} — النتيجة لسا ما انحسمت`
      ),
      resolvedAtIndex: null,
      structural: null,
      window: { start, end, available },
    };
  }
  if (!band.ok) {
    return {
      outcome: insufficient(`ما في ATR مقيس عند الشمعة ${episode.endIndex} — عتبة الانعكاس غير قابلة للحساب`),
      resolvedAtIndex: null,
      structural: null,
      window: { start, end, available },
    };
  }

  /* بنمشي بالنافذة زمنياً وبناخد **أول** حسم — مش الأقوى ولا الأخير. اللي
     بصير أول هو اللي بيوصف رد فعل السوق على الانسحاب. */
  let outcome = "no_reaction";
  let resolvedAtIndex = available;
  for (let i = start; i <= available; i++) {
    const c = candles[i];
    if (isBuy ? c.close > level : c.close < level) {
      outcome = "continuation"; // المستوى اتاخد فعلاً بإغلاق — مش انسحاب، اختراق
      resolvedAtIndex = i;
      break;
    }
    const away = isBuy ? level - c.close : c.close - level;
    if (away >= band.value) {
      outcome = "reversal";
      resolvedAtIndex = i;
      break;
    }
  }

  const inWindow = (x) => x.index >= start && x.index <= available;
  const disp = displacements.find((d) => inWindow(d) && d.direction === reversalDirection) || null;
  const contDisp = displacements.find((d) => inWindow(d) && d.direction === sweepDirection) || null;

  /* الحدث الهيكلي بينتقسم حسب اتجاهه بالنسبة للانسحاب — مش بس «في حدث».
     أول تشغيل على بيانات حقيقية طلّع جملة متناقضة: انسحاب سيولة شراء انعكس،
     وبعدها بشمعتين BOS **صاعد**، والوصف قال «الهيكل تغيّر» وكأن الحدث بيأكد
     الانعكاس — وهو بالضبط عكسه. الاتجاه لازم ينقرا. */
  const alignedEvent = events.find((e) => inWindow(e) && e.direction === reversalDirection) || null;
  const opposedEvent = events.find((e) => inWindow(e) && e.direction === sweepDirection) || null;

  const structural = buildStructuralMeaning({
    pool,
    outcome,
    disp,
    contDisp,
    alignedEvent,
    opposedEvent,
    reactionBars: cfg.reactionBars,
  });

  return { outcome, resolvedAtIndex, structural, window: { start, end, available }, reversalThreshold: +band.value.toFixed(5) };
}

/**
 * المعنى الهيكلي للانسحاب — الطبقة اللي بتخلّي المخرج قابل للقراءة.
 * «في انسحاب» لحاله ما بيعني شي؛ اللي بيعني هو: السيولة انقطفت، وبعدها
 * الهيكل عمل شو.
 *
 * `code` بالإنجليزي للاستهلاك البرمجي، و`reason` بالعربي للعرض — نفس لغة
 * باقي المحرك.
 */
function buildStructuralMeaning({ pool, outcome, disp, contDisp, alignedEvent, opposedEvent, reactionBars }) {
  const sideAr = pool.side === "buy" ? "سيولة شراء" : "سيولة بيع";
  const whereAr = pool.side === "buy" ? "فوق" : "تحت";
  const poolAr = POOL_AR[pool.type] || pool.type;

  const evAr = (e) => `${e.type} ${e.direction === "up" ? "صاعد" : "هابط"} عند ${Number(e.price).toFixed(2)}`;
  const dispBit = disp ? `زخم ${disp.strength} معاكس` : null;

  let code;
  let tail;

  if (outcome === "continuation") {
    // «اتاخدت وكمّلت»: إغلاق خلف المستوى — اختراق، مش قطف سيولة
    code = contDisp ? "TAKEN_AND_CONTINUED_WITH_DISPLACEMENT" : "TAKEN_AND_CONTINUED";
    tail =
      `وبعدها السعر سكّر خلف المستوى${contDisp ? ` بزخم ${contDisp.strength}` : ""}` +
      `${opposedEvent ? ` مع ${evAr(opposedEvent)}` : ""} — يعني اختراق مكمّل، مش قطف سيولة`;
  } else if (outcome === "reversal") {
    if (disp && alignedEvent) {
      code = "SWEPT_REVERSED_WITH_DISPLACEMENT_AND_EVENT";
      tail = `وتبعها ${dispBit} و${evAr(alignedEvent)} — الهيكل انعكس فعلاً`;
    } else if (disp) {
      code = "SWEPT_REVERSED_WITH_DISPLACEMENT";
      tail = `وتبعها ${dispBit} بدون حدث هيكلي بنفس الاتجاه خلال ${reactionBars} شمعة — انعكاس بزخم، بس الهيكل لسا ما تغيّر`;
    } else if (alignedEvent) {
      code = "SWEPT_REVERSED_WITH_EVENT_NO_DISPLACEMENT";
      tail = `وطلع ${evAr(alignedEvent)} بنفس اتجاه الانعكاس بدون زخم معتبر — الهيكل تغيّر بس بحركة ضعيفة`;
    } else if (opposedEvent) {
      /* الحالة اللي كشفتها البيانات الحقيقية: السعر رجع عن المستوى، وبعدها
         بشمعات كسر الهيكل **بنفس اتجاه الانسحاب**. الارتداد كان مؤقّت، فما
         بينحسب انعكاس هيكلي مهما بان بمقياس المسافة. */
      code = "SWEPT_REVERSED_THEN_STRUCTURE_CONTINUED";
      tail =
        `والسعر ابتعد عن المستوى، بس بعدها طلع ${evAr(opposedEvent)} — أي بنفس اتجاه الانسحاب، ` +
        `فالارتداد كان مؤقّت والهيكل ما انعكس`;
    } else {
      code = "SWEPT_REVERSED_NO_DISPLACEMENT";
      tail = `والسعر ابتعد عن المستوى بدون زخم معتبر ولا حدث هيكلي خلال ${reactionBars} شمعة — ارتداد بلا تأكيد`;
    }
  } else {
    const anyEvent = alignedEvent || opposedEvent;
    code = anyEvent || disp || contDisp ? "SWEPT_NO_REACTION_BUT_STRUCTURE_MOVED" : "SWEPT_NO_REACTION";
    tail =
      anyEvent || disp || contDisp
        ? `وما ابتعد السعر عن المستوى، مع إنه صار ${[dispBit, anyEvent ? evAr(anyEvent) : null].filter(Boolean).join(" و")} — الحركة مش منسوبة للانسحاب`
        : `وما تبعها لا زخم معتبر ولا حدث هيكلي خلال ${reactionBars} شمعة — الهيكل ما انعكس`;
  }

  const evRef = (e) => (e ? { id: e.id, type: e.type, direction: e.direction, index: e.index, time: e.time, price: e.price } : null);

  return {
    code,
    /* ============================================================================
       `reversed` = **حدث هيكلي** بنفس اتجاه الانعكاس. قرار صاحب المنهجية:
       الانسحاب ما بينحسب ناجح إلا إذا إجا بعده BOS/MSS بالاتجاه المعاكس.
       ----------------------------------------------------------------------------
       قبل هيك كان الابتعاد السعري بزخم يكفي (`SWEPT_REVERSED_WITH_DISPLACEMENT`
       بدون حدث). وهاد اللي خلّى المصنّف بالكاد يميّز — معدل الانعكاس ٠.٥٢٥
       على ناسداك و٠.٤٨٩ على اليورو، يعني رمية عملة.

       الزخم بلا حدث هيكلي بيضل مسجّل ومشروح بالـcode، بس ما بيُحسب انعكاساً.
       والابتعاد السعري لحاله محفوظ بـ`priceReversed` لمين بده يقيسه.
       ============================================================================ */
    reversed: outcome === "reversal" && !!alignedEvent,
    priceReversed: outcome === "reversal",
    displacement: disp
      ? { index: disp.index, time: disp.time, direction: disp.direction, strength: disp.strength, confidence: disp.confidence ?? null }
      : null,
    continuationDisplacement: contDisp
      ? { index: contDisp.index, time: contDisp.time, direction: contDisp.direction, strength: contDisp.strength }
      : null,
    event: evRef(alignedEvent) ?? evRef(opposedEvent),
    alignedEvent: evRef(alignedEvent),
    opposedEvent: evRef(opposedEvent),
    reason: `${sideAr} ${whereAr} ${poolAr} عند ${Number(pool.price).toFixed(2)} انقطفت بالذيل، ${tail}`,
  };
}

const POOL_AR = {
  EqualHighs: "قمم متساوية",
  EqualLows: "قيعان متساوية",
  SwingHigh: "قمة سوينغ",
  SwingLow: "قاع سوينغ",
  PreviousDayHigh: "قمة أمس",
  PreviousDayLow: "قاع أمس",
  PreviousWeekHigh: "قمة الأسبوع الماضي",
  PreviousWeekLow: "قاع الأسبوع الماضي",
  SessionHigh: "قمة الجلسة",
  SessionLow: "قاع الجلسة",
};

/** بناء عنصر Sweep كامل بالشكل الموحّد للمخرج. */
export function buildSweep(candles, pool, episode, resolved, options = {}) {
  const { atr, timeframe = null } = options;
  const endCandle = candles[episode.endIndex];
  const atrVal = atrAtCausal(atr, episode.maxPenetrationIndex);
  const penetrationAtr = atrVal ? episode.maxPenetration / atrVal : null;

  /* الأدلة: عمق التجاوز · ثقة الزخم المعاكس (لو صار) · هل انحسم انعكاس.
     الدليل غير المتوفر بينشال من المقام — ما بينحسب صفر. */
  const parts = [];
  if (penetrationAtr != null) parts.push(Math.min(1, penetrationAtr / 0.5));
  if (resolved.structural?.displacement?.confidence != null) parts.push(resolved.structural.displacement.confidence);
  /* الدليل الثالث هو الانعكاس **الهيكلي** مش مجرد ابتعاد السعر — ارتداد
     تبعه كسر بنفس اتجاه الانسحاب ما بيأكد شي. */
  if (!isInsufficient(resolved.outcome)) parts.push(resolved.structural?.reversed ? 1 : 0);
  const confidence = meanOfAvailable(parts);

  return {
    id: `SW:${pool.id}:${episode.startIndex}`,
    type: "LiquiditySweep",
    side: pool.side,
    direction: pool.side === "buy" ? "up" : "down",
    timeframe,
    time: endCandle.time,
    index: episode.endIndex,
    price: pool.price,
    startIndex: episode.startIndex,
    startTime: candles[episode.startIndex].time,
    endIndex: episode.endIndex,
    /* عدد الشموع اللامسة محفوظ صراحةً: هو بالضبط الرقم اللي كان بيتحوّل
       لـ«عدد انسحابات» لو ما انعمل التجميع. */
    touchCandles: episode.touchCandles,
    closedBy: episode.closedBy,
    maxPenetration: +episode.maxPenetration.toFixed(5),
    maxPenetrationAtr: penetrationAtr != null ? +penetrationAtr.toFixed(3) : null,
    atrAtPenetration: atrVal != null ? +atrVal.toFixed(5) : null,
    outcome: resolved.outcome,
    resolvedAtIndex: resolved.resolvedAtIndex,
    resolvedAtTime: resolved.resolvedAtIndex != null ? candles[resolved.resolvedAtIndex]?.time ?? null : null,
    reactionWindow: resolved.window,
    structural: resolved.structural,
    /* `availableFromIndex` بينحفظ هون لأن دمج الكنسات المتلاقية بيرتّب
       على «أقدم مستوى قائم» — بدونه الترتيب بيصير اعتباطياً. */
    pool: {
      id: pool.id, type: pool.type, price: pool.price, side: pool.side,
      strength: pool.strength, availableFromIndex: pool.availableFromIndex ?? null,
    },
    strength: confidence != null ? strengthFromScore(confidence) : "Weak",
    reason:
      resolved.structural?.reason ??
      `انسحاب على ${POOL_AR[pool.type] || pool.type} عند ${Number(pool.price).toFixed(2)} — النتيجة لسا ما انحسمت`,
    confidence,
  };
}

/**
 * دمج الكنسات المتلاقية: نفس الشمعة · نفس الجهة · نفس السعر = **حدث واحد**.
 *
 * ⚠️ المشكلة اللي بتحلّها كانت بتضخّم العدّ ٢٥٪ وبتضيّع إشارة.
 * ---------------------------------------------------------------------------
 * كل بركة بتنمسح لحالها، فلما سعر واحد بيكون `EqualHighs` و`PreviousDayHigh`
 * و`SessionHigh` (مرتين) بنفس اللحظة، لمسة سعرية **وحدة** بتطلّع ٤ كنسات.
 * مقيس: ٤١٠ كنسة فائضة من ١٦٢٣ على ٢٧٢٩ شمعة.
 *
 * والأسوأ من التضخيم إنه التقاء ٤ أنواع سيولة على مستوى واحد هو **دليل قوة**
 * — وكان بينحوّل لتكرار بدل ما ينقاس. صار `confluence` حقل بينقاس.
 *
 * ⚠️ التعارض ما بينخبّى.
 * ---------------------------------------------------------------------------
 * النسخ ممكن تختلف: نهاية الحلقة بتختلف (٢٢ حالة) لأن نوافذ مسح البِرك
 * مختلفة، والنتيجة بتختلف (حالة واحدة من ٣٢٩). فالحلقة بتاخد **الاتحاد**
 * (أبعد نهاية)، والنتيجة بتنحفظ من بركة **أقدم مستوى قائم**، وأي اختلاف
 * بينتسجّل بـ`outcomeConflict` بدل ما ينضيع باختيار صامت.
 *
 * @param sweeps الكنسات الخام (وحدة لكل بركة)
 * @returns {{ sweeps, mergedCount, conflicts }}
 */
export function mergeConfluentSweeps(sweeps) {
  if (!Array.isArray(sweeps) || sweeps.length === 0) {
    return { sweeps: [], mergedCount: 0, conflicts: 0 };
  }

  const groups = new Map();
  for (const s of sweeps) {
    const key = `${s.startIndex}:${s.side}:${Number(s.price).toFixed(5)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  const out = [];
  let mergedCount = 0;
  let conflicts = 0;

  for (const arr of groups.values()) {
    if (arr.length === 1) {
      out.push({ ...arr[0], confluence: { poolCount: 1, poolTypes: [arr[0].pool.type], poolIds: [arr[0].pool.id] }, outcomeConflict: null });
      continue;
    }
    mergedCount += arr.length - 1;

    /* الأساس = بركة أقدم مستوى قائم. الترتيب حتمي بالمعرّف عند التعادل. */
    const ordered = [...arr].sort(
      (a, b) => (a.pool.availableFromIndex ?? a.startIndex) - (b.pool.availableFromIndex ?? b.startIndex)
        || String(a.pool.id).localeCompare(String(b.pool.id))
    );
    const base = ordered[0];

    /* الحلقة = الاتحاد. لمسة السعر وحدة، فامتدادها هو أبعد ما وصلته. */
    let endIndex = base.endIndex;
    let touchCandles = base.touchCandles;
    let maxPenetration = base.maxPenetration;
    let deepest = base;
    for (const s of ordered) {
      if (s.endIndex > endIndex) endIndex = s.endIndex;
      if (s.touchCandles > touchCandles) touchCandles = s.touchCandles;
      if (s.maxPenetration > maxPenetration) { maxPenetration = s.maxPenetration; deepest = s; }
    }

    const values = [...new Set(ordered.map((s) => s.outcome?.value ?? s.outcome))];
    const conflict = values.length > 1;
    if (conflict) conflicts++;

    out.push({
      ...base,
      endIndex,
      touchCandles,
      maxPenetration,
      maxPenetrationAtr: deepest.maxPenetrationAtr,
      atrAtPenetration: deepest.atrAtPenetration,
      confluence: {
        poolCount: ordered.length,
        poolTypes: [...new Set(ordered.map((s) => s.pool.type))].sort(),
        poolIds: ordered.map((s) => s.pool.id),
      },
      /* ⚠️ التعارض ظاهر — والنتيجة المعتمدة مذكور مصدرها. */
      outcomeConflict: conflict
        ? { values, resolvedFrom: base.pool.id, note: "نفس اللمسة انحسمت مختلف حسب نافذة البركة" }
        : null,
    });
  }

  out.sort((a, b) => a.index - b.index || a.price - b.price || String(a.id).localeCompare(String(b.id)));
  return { sweeps: out, mergedCount, conflicts };
}

/**
 * تجميع `wickBreaks` الخام لحلقات مميّزة — نفس قاعدة التراجع.
 *
 * هالدالة مش مستعملة ببناء البِرك (كل بركة بتنمسح لحالها)، بس نتيجتها
 * بتنحط بالمقاييس عشان يبان **معامل التضخيم**: كم مدخل خام مقابل كم محاولة
 * فعلية. بدون هالرقم أي مقارنة مع أدوات تانية بتكون على أساس مختلف.
 */
export function dedupeWickBreaks(candles, wickBreaks, options = {}) {
  const cfg = { ...SWEEP_DEFAULTS, ...options };
  const { atr } = options;
  if (!Array.isArray(wickBreaks) || !wickBreaks.length) {
    return { episodes: [], raw: 0, inflation: null };
  }

  const byLevel = new Map();
  for (const w of wickBreaks) {
    const key = `${w.direction}|${Number(w.level).toFixed(5)}`;
    if (!byLevel.has(key)) byLevel.set(key, []);
    byLevel.get(key).push(w);
  }

  const episodes = [];
  for (const [key, list] of byLevel) {
    list.sort((a, b) => a.index - b.index);
    const isBuy = list[0].direction === "up";
    const level = list[0].level;
    let cur = null;
    for (const w of list) {
      if (!cur) {
        cur = { key, level, direction: list[0].direction, startIndex: w.index, endIndex: w.index, touchCandles: 1 };
        continue;
      }
      /* بين لمستين: هل تراجع السعر عن المستوى بمقدار معتبر بأي شمعة بينهم؟ */
      let left = false;
      for (let i = cur.endIndex + 1; i < w.index; i++) {
        const band = atrBandAt(atr, i, cfg.reentryAtrMult);
        if (!band.ok) continue;
        const distance = isBuy ? level - candles[i].high : candles[i].low - level;
        if (distance >= band.value) {
          left = true;
          break;
        }
      }
      if (left) {
        episodes.push(cur);
        cur = { key, level, direction: list[0].direction, startIndex: w.index, endIndex: w.index, touchCandles: 1 };
      } else {
        cur.endIndex = w.index;
        cur.touchCandles++;
      }
    }
    if (cur) episodes.push(cur);
  }

  episodes.sort((a, b) => a.startIndex - b.startIndex);
  return {
    episodes,
    raw: wickBreaks.length,
    inflation: episodes.length ? +(wickBreaks.length / episodes.length).toFixed(3) : null,
  };
}
