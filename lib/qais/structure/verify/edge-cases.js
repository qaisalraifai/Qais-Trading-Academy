/* ============================================================================
   lib/qais/structure/verify/edge-cases.js
   مسح الحالات الصعبة على بيانات حقيقية — **عدّ وتوثيق، مش إصلاح**.

   الهدف إنه التقرير يقول بالأرقام كم مرة صادف المحرك كل حالة وشو عمل،
   بدل ما تنخبّى الحالات جوّا رقم دقة إجمالي.

   Equal Highs / Equal Lows بالذات: متفقين إنها بدها Liquidity Detector
   مستقل لاحقاً. هون بنقيس **حجم العمى** بس: كم بيفوت حقيقي ضاع لأن جاره
   بنفس القمة بالضبط.
   ============================================================================ */

import { atrSeries } from "../atr.js";

/**
 * @param candles    شموع حقيقية
 * @param structure  ناتج analyzeStructureV2 على نفس الشموع
 * @param precision  ناتج inferPrecision
 */
export function scanEdgeCases(candles, structure, precision, options = {}) {
  const {
    lookback = 2,
    sweepReturnBars = 3,
    consolidationWindow = 20,
    consolidationAtrMult = 1.2,
    volatilityPercentile = 0.9,
  } = options;

  const n = candles.length;
  /* «التساوي» بيتعرّف بنصف تِك لما يكون التِك مستنتَج بثقة. بدونه بنرجع
     للمساواة الحرفية — وبينتسجّل بالمخرج أي معيار استُعمل، حتى ما ينقرا
     رقم التعادلات كأنه مقيس بنفس الدقة بالحالتين. */
  const tick = precision?.tickSize && precision.tickSizeConfidence !== "low" ? precision.tickSize : null;
  const eqMode = tick != null ? `half_tick(${tick})` : "exact_equality";
  const eq = (a, b) => (tick != null ? Math.abs(a - b) < tick / 2 : a === b);

  const atr = atrSeries(candles, 14);

  /* ============================================================================
     شموع متجاورة بنفس القمة/القاع — **مش** «القمم المتساوية» بمعنى السيولة.
     ----------------------------------------------------------------------------
     القمم المتساوية اللي بتهم كسيولة هي **سوينغين** بنفس السعر بينهم مسافة
     شموع — وهاي شغل كاشف السيولة المستقل (مؤجّل). اللي بينقاس هون مجرد
     تسطّح بين شمعتين متلاصقتين، فانسمّى باسمه حتى ما ينقرا كحجم الفجوة
     المؤجّلة. الرقم اللي بيمثّل القيد فعلاً هو pivotsSuppressedByExactTie.
     ============================================================================ */
  const adjacentFlatHighs = [];
  const adjacentFlatLows = [];
  for (let i = 1; i < n; i++) {
    if (eq(candles[i].high, candles[i - 1].high)) adjacentFlatHighs.push({ index: i, time: candles[i].time, price: candles[i].high });
    if (eq(candles[i].low, candles[i - 1].low)) adjacentFlatLows.push({ index: i, time: candles[i].time, price: candles[i].low });
  }

  /* ---------- بيفوتات ضاعت بسبب التعادل ----------
     شرط الفراكتال بيرفض التعادل (`>=`). فشمعة هي فعلياً أعلى نقطة بالنافذة
     بس جارها بنفس القمة بالضبط => ما بتنكشف. هون بنعدّها. */
  const suppressedByTie = [];
  for (let i = lookback; i < n - lookback; i++) {
    const c = candles[i];
    let tiedHigh = false;
    let strictlyHighest = true;
    let tiedLow = false;
    let strictlyLowest = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high > c.high) strictlyHighest = false;
      else if (eq(candles[j].high, c.high)) tiedHigh = true;
      if (candles[j].low < c.low) strictlyLowest = false;
      else if (eq(candles[j].low, c.low)) tiedLow = true;
    }
    if (strictlyHighest && tiedHigh) suppressedByTie.push({ index: i, time: c.time, price: c.high, type: "high" });
    if (strictlyLowest && tiedLow) suppressedByTie.push({ index: i, time: c.time, price: c.low, type: "low" });
  }

  /* ============================================================================
     تجميع التجاوزات المتلاصقة بـ«نوبة» واحدة قبل أي عد.
     ----------------------------------------------------------------------------
     `refHigh`/`refLow` بالمحرك ما بينمسحوا إلا بكسر **بالإغلاق**، فكل شمعة
     بتلمس المستوى بذيلها بتسجّل تجاوزاً جديداً. ست شموع بتلمس نفس المستوى
     = ٥ مدخلات لنفس النوبة. بدون تجميع، «كسر بالذيل» و«Sweep → Return»
     بيتضخّموا بعدد الشموع اللامسة مش بعدد النوبات — نفس مرض تضخّم الأحداث
     اللي انتقدناه بالمحرك القديم.

     النوبة = تجاوزات متتالية لنفس المستوى وبنفس الاتجاه، بفاصل ≤ sweepGapBars.
     ============================================================================ */
  const rawWicks = structure.wickBreaks || [];
  const sweepEpisodes = [];
  for (const w of rawWicks) {
    const prev = sweepEpisodes[sweepEpisodes.length - 1];
    const sameLevel = prev && prev.direction === w.direction && eq(prev.level, w.level);
    if (sameLevel && w.index - prev.lastIndex <= sweepReturnBars) {
      prev.lastIndex = w.index;
      prev.touches++;
    } else {
      sweepEpisodes.push({
        index: w.index,
        lastIndex: w.index,
        time: w.time,
        direction: w.direction,
        level: w.level,
        touches: 1,
      });
    }
  }

  /* ---------- Sweep ثم رجوع ----------
     نوبة تجاوز بالذيل ثم إغلاق راجع لجهة المستوى خلال نافذة قصيرة **بعد
     آخر لمسة بالنوبة** — مش بعد أول وحدة، وإلا الشرط شبه تحصيل حاصل. */
  const sweepReturns = [];
  for (const w of sweepEpisodes) {
    const end = Math.min(n - 1, w.lastIndex + sweepReturnBars);
    for (let k = w.lastIndex + 1; k <= end; k++) {
      const back = w.direction === "up" ? candles[k].close < w.level : candles[k].close > w.level;
      if (back) {
        sweepReturns.push({
          index: w.index,
          time: w.time,
          direction: w.direction,
          level: w.level,
          touches: w.touches,
          returnedAtIndex: k,
          returnedAtTime: candles[k].time,
          bars: k - w.lastIndex,
        });
        break;
      }
    }
  }

  /* ---------- تذبذب / تقلب عالي ---------- */
  const consolidations = [];
  const volatile = [];
  const atrVals = atr.filter(Number.isFinite).sort((a, b) => a - b);
  const hiAtr = atrVals.length ? atrVals[Math.floor(atrVals.length * volatilityPercentile)] : null;

  for (let i = consolidationWindow; i < n; i++) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let k = i - consolidationWindow + 1; k <= i; k++) {
      if (candles[k].high > hi) hi = candles[k].high;
      if (candles[k].low < lo) lo = candles[k].low;
    }
    const a = atr[i];
    if (!Number.isFinite(a) || a <= 0) continue;
    if (hi - lo <= a * consolidationAtrMult * 2) {
      consolidations.push({ index: i, time: candles[i].time, rangeAtr: +((hi - lo) / a).toFixed(2) });
    }
    if (hiAtr != null && a >= hiAtr) {
      volatile.push({ index: i, time: candles[i].time, atr: +a.toFixed(4) });
    }
  }

  /* ---------- سوينغات متداخلة ---------- */
  const internals = structure.internalSwings || [];
  const overlapping = [];
  for (let i = 1; i < internals.length; i++) {
    const gap = internals[i].index - internals[i - 1].index;
    if (gap <= lookback) {
      overlapping.push({ index: internals[i].index, time: internals[i].time, gapBars: gap });
    }
  }

  /* ---------- هيكل داخلي جوّا هيكل خارجي ---------- */
  const majors = structure.majorSwings || [];
  let internalInsideMajor = 0;
  const majorIdx = new Set(majors.map((m) => m.index));
  for (let m = 1; m < majors.length; m++) {
    const from = majors[m - 1].index;
    const to = majors[m].index;
    for (const s of internals) {
      if (s.index > from && s.index < to && !majorIdx.has(s.index)) internalInsideMajor++;
    }
  }

  const events = structure.events || [];

  return {
    /* تسطّح بين شمعتين متلاصقتين — **مش** قمم متساوية بمعنى السيولة. */
    adjacentFlatHighs: summarize(adjacentFlatHighs),
    adjacentFlatLows: summarize(adjacentFlatLows),
    equalHighs: {
      value: "INSUFFICIENT_DATA",
      why: "القمم المتساوية كسيولة = سوينغين بنفس السعر بينهم مسافة — بدها كاشف سيولة مستقل، مؤجّل",
    },
    equalLows: {
      value: "INSUFFICIENT_DATA",
      why: "نفس السبب — القياس هون على الشموع المتلاصقة بس، شوف adjacentFlatLows",
    },
    /* هاد الرقم هو حجم القيد المتفق عليه — بينتسجّل ولا بينعالج هلأ. */
    pivotsSuppressedByExactTie: summarize(suppressedByTie),
    /* التجاوزات الخام مقابل النوبات المجمّعة — الفرق بينهم بيبيّن التضخّم. */
    wickBreaksRaw: { count: rawWicks.length },
    wickBreaks: summarize(sweepEpisodes),
    closeBreaks: summarize(events),
    fakeBreaks: summarize(events.filter((e) => e.fakeBreak)),
    sweepThenReturn: summarize(sweepReturns),
    strongDisplacements: summarize((structure.displacements || []).filter((d) => d.strength === "Strong")),
    extremeDisplacements: summarize((structure.displacements || []).filter((d) => d.strength === "Extreme")),
    consolidationBars: summarize(consolidations),
    highVolatilityBars: summarize(volatile),
    overlappingSwings: summarize(overlapping),
    internalInsideMajor: { count: internalInsideMajor, samples: [] },
    equalityCriterion: eqMode,
    tickUsed: tick,
  };
}

function summarize(list, sampleN = 5) {
  return {
    count: list.length,
    samples: list.slice(0, sampleN).map((x) => ({ ...x })),
  };
}
