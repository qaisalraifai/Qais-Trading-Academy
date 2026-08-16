/* ============================================================================
   lib/qais/liquidity-v2/index.js
   Liquidity Layer v2 — نقطة الدخول الوحيدة.

   بتاخد شموع (وناتج محرك الهيكل، أو بتشغّله لحالها) وبترجّع:

     pools[]            كل بِرك السيولة بشكل موحّد: متساوية · سوينغ · أمس/
                        الأسبوع الماضي · جلسات — مع جهتها (buy/sell)، نطاقها
                        (داخلي/خارجي)، وحالتها (باقية/انقطفت/انكسرت)
     sweeps[]           حلقات انسحاب **مميّزة** (مش لمسات) مع معناها الهيكلي
     trend              مشتق من `events` — شوف الملاحظة تحت
     externalRange      إطار الهيكل الخارجي الحالي أو INSUFFICIENT_DATA
     spans              التقسيم اليومي/الأسبوعي/الجلسات مع مصدر كل واحد
     metrics            أرقام قابلة للتدقيق، وكل رقم مش قابل للقياس بيطلع
                        INSUFFICIENT_DATA مع سببه

   ---------------------------------------------------------------------------
   ثلاث حقول بناتج الهيكل **ما بينبنى عليها** هون، عن قصد:

     • `state.trend` — مشتق من تسميات السوينغات مش من الأحداث، فبيقدر يقول
       "up" مباشرةً بعد MSS هابط. الاتجاه هون بينشتق من `events` مباشرة:
       آخر MSS هو اللي بيحدد الاتجاه (المنهجية: الاتجاه بينقلب لحظة الـMSS).
     • `state` بيرجّع INSUFFICIENT_DATA بلا `lastEvent` لما السوينغات
       الخارجية أقل من ٤ — حتى لو طلعت أحداث فعلية. لهيك بنقرا `events`
       مباشرة ولا مرة `state`.
     • `meta.counts.choch` مش موجود (وهاد صح — ما في CHOCH بالمنهجية)، فأي
       جمع بيمرق عليه بيطلع NaN. ما منلمسه.
   ============================================================================ */

import { analyzeStructureV2 } from "../structure/index.js";
import { atrSeries } from "./atr-causal.js";
import { insufficient, isInsufficient } from "./pool.js";
import { buildTimeSpans } from "./time-spans.js";
import { detectEqualLevels, EQUAL_DEFAULTS } from "./equal-levels.js";
import { detectSwingLevels } from "./swing-levels.js";
import { detectPreviousPeriodLevels, detectSessionLevels } from "./reference-levels.js";
import { SWEEP_DEFAULTS, scanPoolInteractions, resolveEpisode, buildSweep, dedupeWickBreaks } from "./sweeps.js";

export const LIQUIDITY_DEFAULTS = {
  atrPeriod: 14,
  minCandles: 30,
  ...EQUAL_DEFAULTS,
  ...SWEEP_DEFAULTS,
  prominenceWindow: 200,
  sessionMinBars: 2,
  sessionsEnabled: true,
  /* البِرك من البيفوتات الداخلية مطفية افتراضياً — بالمئات على أي عيّنة
     حقيقية، فبتغرق القائمة. بتنفتح للقياس مع توسيم scale. */
  includeInternalSwings: false,
  /* القمم المتساوية بتنبنى من البيفوتات الداخلية: القمم المتساوية بتتشكّل
     غالباً جوّا الحركة، والفلتر الخارجي (٣× ATR) بيشيلها قبل ما تُشاف. */
  equalFromScale: "internal",
};

/**
 * الاتجاه من الأحداث — مش من تسميات السوينغات.
 * آخر MSS بيحدد الاتجاه. ما في MSS → آخر BOS. ما في أحداث → null مع سببه.
 */
export function trendFromEvents(events, asOfIndex = Infinity) {
  const upto = (events || []).filter((e) => e.index <= asOfIndex);
  if (!upto.length) {
    return { trend: null, source: null, reason: "ما في أحداث هيكلية بعد — الاتجاه غير قابل للاشتقاق", eventRef: null, conflict: false };
  }
  const last = upto[upto.length - 1];
  const lastMss = [...upto].reverse().find((e) => e.type === "MSS") || null;

  if (lastMss) {
    /* بعد MSS، أي كسر بالاتجاه المعاكس لازم يكون MSS كمان (بحكم تعريف
       السوينغ الحامي). فـBOS معاكس بيعني تناقض داخلي بناتج الهيكل —
       بينتوسم ولا بينخبّى. */
    const conflict = last.type === "BOS" && last.direction !== lastMss.direction;
    return {
      trend: lastMss.direction,
      source: "MSS",
      reason: `آخر MSS ${lastMss.direction === "up" ? "صاعد" : "هابط"} عند ${Number(lastMss.price).toFixed(2)} (شمعة ${lastMss.index}) — الاتجاه بينقلب لحظة الـMSS`,
      eventRef: { id: lastMss.id, type: lastMss.type, direction: lastMss.direction, index: lastMss.index, time: lastMss.time, price: lastMss.price },
      conflict,
    };
  }
  return {
    trend: last.direction,
    source: "BOS",
    reason: `ما في MSS بعد — الاتجاه من آخر BOS ${last.direction === "up" ? "صاعد" : "هابط"} عند ${Number(last.price).toFixed(2)}`,
    eventRef: { id: last.id, type: last.type, direction: last.direction, index: last.index, time: last.time, price: last.price },
    conflict: false,
  };
}

/**
 * إطار الهيكل الخارجي بلحظة معيّنة: آخر قمة وآخر قاع خارجيين **تأكدوا** قبل
 * تلك اللحظة. البركة جوّا الإطار = سيولة داخلية، وعند حدوده أو خلفهم = خارجية.
 */
export function externalRangeAt(majorSwings, asOfIndex) {
  const avail = (majorSwings || []).filter((s) => (Number.isFinite(s.confirmedAtIndex) ? s.confirmedAtIndex : Infinity) <= asOfIndex);
  const high = [...avail].reverse().find((s) => s.type === "high") || null;
  const low = [...avail].reverse().find((s) => s.type === "low") || null;
  if (!high || !low) {
    return insufficient(
      `ما في قمة وقاع خارجيين مؤكَّدين لحد الشمعة ${asOfIndex} (قمم: ${avail.filter((s) => s.type === "high").length}، قيعان: ${avail.filter((s) => s.type === "low").length}) — التصنيف داخلي/خارجي غير قابل للحساب`
    );
  }
  return {
    high: { price: high.price, index: high.index, time: high.time, label: high.label ?? null },
    low: { price: low.price, index: low.index, time: low.time, label: low.label ?? null },
    asOfIndex,
  };
}

export function analyzeLiquidityV2(candles, options = {}) {
  const cfg = { ...LIQUIDITY_DEFAULTS, ...options };
  const timeframe = options.timeframe ?? null;

  const empty = (reason) => ({
    ok: false,
    reason,
    timeframe,
    pools: [],
    sweeps: [],
    trend: { trend: null, source: null, reason, eventRef: null, conflict: false },
    externalRange: insufficient(reason),
    spans: null,
    skipped: [],
    metrics: {
      pools: insufficient(reason),
      sweeps: insufficient(reason),
      wickBreakDeduplication: insufficient(reason),
    },
    meta: { config: cfg, candleCount: Array.isArray(candles) ? candles.length : 0 },
  });

  if (!Array.isArray(candles) || candles.length < cfg.minCandles) {
    return empty(`عدد الشموع (${Array.isArray(candles) ? candles.length : 0}) أقل من الحد الأدنى ${cfg.minCandles}`);
  }

  const structure = options.structure ?? analyzeStructureV2(candles, { timeframe, atrPeriod: cfg.atrPeriod });
  const lookback = structure?.meta?.config?.lookback ?? 2;
  const atr = atrSeries(candles, cfg.atrPeriod);
  const asOfIndex = candles.length - 1;

  // -------- ١) التقسيم الزمني (مقيس، مش مفترَض) --------
  const spans = buildTimeSpans(candles, {
    dailyCandles: options.dailyCandles ?? null,
    weeklyCandles: options.weeklyCandles ?? null,
    sessionMinBars: cfg.sessionMinBars,
    sessionsEnabled: cfg.sessionsEnabled,
  });

  // -------- ٢) بناء البِرك --------
  const skipped = [];
  const notes = {};
  const pools = [];

  const equalSource = cfg.equalFromScale === "major" ? structure.majorSwings : structure.internalSwings;
  const equal = detectEqualLevels(candles, equalSource || [], {
    atr,
    lookback,
    timeframe,
    tolAtrMult: cfg.tolAtrMult,
    minBarsApart: cfg.minBarsApart,
    maxBarsApart: cfg.maxBarsApart,
    minMembers: cfg.minMembers,
  });
  pools.push(...equal.pools);
  skipped.push(...equal.skipped.map((s) => ({ ...s, from: "equalLevels" })));
  if (equal.note) notes.equalLevels = equal.note;

  const swing = detectSwingLevels(candles, structure.majorSwings || [], { atr, lookback, timeframe, scale: "major" });
  pools.push(...swing.pools);
  skipped.push(...swing.skipped.map((s) => ({ ...s, from: "swingLevels" })));

  if (cfg.includeInternalSwings) {
    const internal = detectSwingLevels(candles, structure.internalSwings || [], { atr, lookback, timeframe, scale: "internal" });
    pools.push(...internal.pools);
    skipped.push(...internal.skipped.map((s) => ({ ...s, from: "swingLevels:internal" })));
  }

  const prevDay = detectPreviousPeriodLevels(candles, spans.day, "day", { timeframe, prominenceWindow: cfg.prominenceWindow });
  pools.push(...prevDay.pools);
  skipped.push(...prevDay.skipped.map((s) => ({ ...s, from: "previousDay" })));
  if (prevDay.note) notes.previousDay = prevDay.note;

  const prevWeek = detectPreviousPeriodLevels(candles, spans.week, "week", { timeframe, prominenceWindow: cfg.prominenceWindow });
  pools.push(...prevWeek.pools);
  skipped.push(...prevWeek.skipped.map((s) => ({ ...s, from: "previousWeek" })));
  if (prevWeek.note) notes.previousWeek = prevWeek.note;

  const session = detectSessionLevels(candles, spans.sessions, spans.day, { timeframe, prominenceWindow: cfg.prominenceWindow });
  pools.push(...session.pools);
  skipped.push(...session.skipped.map((s) => ({ ...s, from: "sessionLevels" })));
  if (session.note) notes.sessionLevels = session.note;

  /* -------- ٣) داخلي مقابل خارجي --------

     مقياسان، ومحتاجينهم الاتنين — أول تشغيل على بيانات حقيقية وضّح ليش:
     تصنيف ١٥٠١ بركة تاريخية مقابل الإطار الخارجي **الحالي** طلّع ١١٤٢
     «خارجية»، لأن الإطار الحالي ضيّق وأغلب البِرك القديمة برّاته أصلاً.
     الرقم صحيح حسابياً وبلا معنى تحليلياً.

       scope        = مقابل الإطار الخارجي بلحظة **تكوّن البركة** — سؤال
                      تاريخي عن كل بركة، سببي، وله معنى دايماً.
       currentScope = مقابل الإطار **الحالي**، ومحصور بالبِرك اللي لسا حيّة
                      (باقية وما انتهت صلاحيتها). هاد هو «السيولة الداخلية
                      مقابل الخارجية» اللي بتستهلكه طبقة السيناريو.
  */
  const range = externalRangeAt(structure.majorSwings || [], asOfIndex);
  const classify = (price, frame) =>
    price >= frame.high.price || price <= frame.low.price ? "external" : "internal";

  for (const p of pools) {
    const frameAtBirth = externalRangeAt(structure.majorSwings || [], p.availableFromIndex);
    if (isInsufficient(frameAtBirth)) {
      p.scope = null;
      p.scopeReason = frameAtBirth.why;
    } else {
      /* الحدّ نفسه بينحسب خارجي: بركة سعرها = القمة الخارجية هي بالتحديد
         السيولة اللي فوق حدّ الهيكل. */
      p.scope = classify(p.price, frameAtBirth);
      p.scopeReason =
        `${Number(p.price).toFixed(2)} ${p.scope === "external" ? "عند حدّ الهيكل الخارجي أو خلفه" : "جوّا الساق الخارجية"} ` +
        `وقت تكوّنها (${frameAtBirth.low.price.toFixed(2)} … ${frameAtBirth.high.price.toFixed(2)})`;
    }
    // currentScope بينتحدد بعد المسح — بيعتمد على status اللي لسا ما انحسب
  }

  // -------- ٤) التفاعل: انقطفت · انكسرت · باقية --------
  const sweeps = [];
  for (const pool of pools) {
    const { episodes, breach, scannedFrom, scannedTo } = scanPoolInteractions(candles, pool, {
      atr,
      reentryAtrMult: cfg.reentryAtrMult,
    });
    pool.scanned = { from: scannedFrom, to: scannedTo, bars: Math.max(0, scannedTo - scannedFrom + 1) };

    for (const ep of episodes) {
      const resolved = resolveEpisode(candles, pool, ep, {
        atr,
        displacements: structure.displacements || [],
        events: structure.events || [],
        reactionBars: cfg.reactionBars,
        reversalAtrMult: cfg.reversalAtrMult,
      });
      const sweep = buildSweep(candles, pool, ep, resolved, { atr, timeframe });
      sweeps.push(sweep);
      pool.sweeps.push({
        id: sweep.id,
        index: sweep.index,
        time: sweep.time,
        touchCandles: sweep.touchCandles,
        outcome: sweep.outcome,
        maxPenetrationAtr: sweep.maxPenetrationAtr,
      });
    }

    /* الحالة النهائية مقابل لحظة الاستهلاك — شيئان مختلفان:
       بركة ممكن تنقطف بالذيل أول (السيولة راحت وقتها) وبعدها بشموع تنكسر
       بإغلاق. الحالة النهائية `breached`، بس **وقت الاستهلاك** هو أول
       الاتنين زمنياً. خلطهم بيأخّر كل الأوقات لتاريخ الكسر. */
    const firstSweep = pool.sweeps[0] ?? null;
    pool.status = breach ? "breached" : firstSweep ? "swept" : "remaining";
    if (breach) pool.breach = breach;

    if (firstSweep && (!breach || firstSweep.index <= breach.index)) {
      pool.takenAt = { index: firstSweep.index, time: firstSweep.time, how: "wick_sweep" };
    } else if (breach) {
      pool.takenAt = { index: breach.index, time: breach.time, how: "close_break" };
    } else {
      pool.takenAt = null;
    }
  }

  /* البِرك الحيّة بلحظة آخر شمعة: باقية (ما انقطفت ولا انكسرت) وصلاحيتها
     لسا سارية. هاي وحدها اللي إلها «نطاق حالي». */
  for (const p of pools) {
    const live = p.status === "remaining" && (p.expiresAtIndex == null || p.expiresAtIndex >= asOfIndex);
    if (!live) {
      p.currentScope = null;
      p.currentScopeReason =
        p.status !== "remaining"
          ? `البركة ${p.status === "swept" ? "انقطفت" : "انكسرت"} — ما عادت سيولة قائمة`
          : "انتهت صلاحية المستوى كمرجع قبل آخر شمعة";
    } else if (isInsufficient(range)) {
      p.currentScope = null;
      p.currentScopeReason = range.why;
    } else {
      p.currentScope = classify(p.price, range);
      p.currentScopeReason = `${Number(p.price).toFixed(2)} مقابل الإطار الخارجي الحالي (${range.low.price.toFixed(2)} … ${range.high.price.toFixed(2)})`;
    }
  }

  pools.sort((a, b) => a.availableFromIndex - b.availableFromIndex || a.price - b.price || a.type.localeCompare(b.type));
  sweeps.sort((a, b) => a.index - b.index || a.price - b.price || a.id.localeCompare(b.id));

  // -------- ٥) المقاييس --------
  const trend = trendFromEvents(structure.events || [], asOfIndex);
  const dedupe = dedupeWickBreaks(candles, structure.wickBreaks || [], { atr, reentryAtrMult: cfg.reentryAtrMult });

  const byKey = (list, key) => {
    const out = {};
    for (const x of list) {
      const k = typeof key === "function" ? key(x) : x[key];
      out[k] = (out[k] || 0) + 1;
    }
    return out;
  };

  const resolvedSweeps = sweeps.filter((s) => !isInsufficient(s.outcome));
  const unresolved = sweeps.length - resolvedSweeps.length;
  const livePools = pools.filter((p) => p.currentScope != null);

  const metrics = {
    pools: {
      total: pools.length,
      byType: byKey(pools, "type"),
      bySide: byKey(pools, "side"),
      byStrength: byKey(pools, "strength"),
      byStatus: byKey(pools, "status"),
      /* النطاق وقت التكوّن — لكل البِرك. */
      byScope: byKey(pools, (p) => p.scope ?? "unknown"),
      /* النطاق الحالي — للبِرك الحيّة بس. هاي القائمة اللي بتتقرا للقرار. */
      live: livePools.length
        ? {
            total: livePools.length,
            byCurrentScope: byKey(livePools, (p) => p.currentScope ?? "unknown"),
            bySide: byKey(livePools, "side"),
          }
        : insufficient("ما في ولا بركة سيولة حيّة عند آخر شمعة"),
    },
    sweeps: {
      total: sweeps.length,
      byOutcome: resolvedSweeps.length
        ? byKey(resolvedSweeps, "outcome")
        : insufficient("ما في ولا حلقة انسحاب انحسمت نتيجتها ضمن البيانات"),
      unresolved,
      byStructuralCode: resolvedSweeps.length
        ? byKey(resolvedSweeps, (s) => s.structural?.code ?? "unknown")
        : insufficient("ما في ولا حلقة انسحاب انحسمت نتيجتها ضمن البيانات"),
      /* معدّلان مختلفان عن قصد، والفرق بينهم هو المعلومة:

           priceReversalRate      = السعر ابتعد عن المستوى بمقدار العتبة.
           structuralReversalRate = وكمان الهيكل ما كمّل بنفس اتجاه الانسحاب.

         الأول وحده تقريباً بيقسم العيّنة نصّين (قياس على NAS100 H4: ٠.٥٢)
         — يعني ما بيميّز شي لحاله. التاني هو الادعاء اللي بينبنى عليه.
         الاتنين بينرجعوا حتى ما ينقرا الأول كأنه التاني.

         كلاهما من الحلقات **المحسومة** فقط؛ حط غير المحسوم بالمقام بينزّل
         الرقم لأسباب ما إلها علاقة بالسوق. */
      priceReversalRate: resolvedSweeps.length
        ? +(resolvedSweeps.filter((s) => s.outcome === "reversal").length / resolvedSweeps.length).toFixed(3)
        : insufficient("ما في حلقات محسومة — النسبة غير قابلة للحساب"),
      structuralReversalRate: resolvedSweeps.length
        ? +(resolvedSweeps.filter((s) => s.structural?.reversed).length / resolvedSweeps.length).toFixed(3)
        : insufficient("ما في حلقات محسومة — النسبة غير قابلة للحساب"),
      touchCandlesTotal: sweeps.reduce((a, s) => a + s.touchCandles, 0),
    },
    /* الرقم اللي بيوضّح ليش التجميع شرط: كم مدخل خام مقابل كم محاولة فعلية. */
    wickBreakDeduplication: dedupe.raw
      ? { rawEntries: dedupe.raw, distinctEpisodes: dedupe.episodes.length, inflationFactor: dedupe.inflation }
      : insufficient("ما في wickBreaks بناتج الهيكل — معامل التضخيم غير قابل للقياس"),
    structureInputs: {
      majorSwings: (structure.majorSwings || []).length,
      internalSwings: (structure.internalSwings || []).length,
      events: (structure.events || []).length,
      displacements: (structure.displacements || []).length,
    },
  };

  return {
    ok: true,
    reason: null,
    timeframe,
    pools,
    sweeps,
    trend,
    externalRange: range,
    spans,
    skipped,
    notes,
    metrics,
    meta: {
      config: cfg,
      candleCount: candles.length,
      asOfIndex,
      firstTime: candles[0]?.time ?? null,
      lastTime: candles[asOfIndex]?.time ?? null,
      structureOk: !!structure?.ok,
      lookback,
    },
  };
}
