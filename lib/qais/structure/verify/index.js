/* ============================================================================
   lib/qais/structure/verify/index.js
   منسّق التحقق: بيانات حقيقية → المحرك → مقارنة → تقرير رقمي.

   مبدأ التقرير: **ما ينخبّى شي جوّا رقم واحد**، ولا يُكتب رقم ما إله مرجع.
   أي مقياس ما بنقدر نقيسه من البيانات المتوفرة بينكتب INSUFFICIENT_DATA
   مع سبب — مش نسبة تقديرية.
   ============================================================================ */

import { analyzeStructureV2 } from "../index.js";
import { atrSeries, atrAt } from "../atr.js";
import { replayIncremental } from "./replay.js";
import { inferPrecision, resolveTolerance } from "./precision.js";
import { scanEdgeCases } from "./edge-cases.js";
import { matchTrade, describe, MATCH_STATUS, tfSeconds } from "./match.js";

const INSUFFICIENT = (why) => ({ value: "INSUFFICIENT_DATA", why });

/**
 * @param input {
 *   symbol, candlesByTF: { h4: [...], daily: [...] }, trades: [...],
 *   engineOptions, replayOptions, matchOptions
 * }
 */
export function verifyStructure(input) {
  const {
    symbol,
    candlesByTF = {},
    trades = [],
    engineOptions = {},
    replayOptions = {},
    matchOptions = {},
  } = input;

  const perTF = {};
  const allMatches = [];

  for (const [tf, candles] of Object.entries(candlesByTF)) {
    if (!Array.isArray(candles) || candles.length === 0) {
      perTF[tf] = { ok: false, reason: "ما في شموع", candleCount: 0 };
      continue;
    }

    const precision = inferPrecision(candles, { instrument: symbol });
    const structure = analyzeStructureV2(candles, { ...engineOptions, timeframe: tf });

    if (!structure.ok) {
      perTF[tf] = { ok: false, reason: structure.reason, candleCount: candles.length, precision };
      continue;
    }

    const atr = atrSeries(candles, engineOptions.atrPeriod ?? 14);
    const tolerance = resolveTolerance(precision, atrAt(atr, candles.length - 1));

    const replay = replayIncremental(candles, { ...engineOptions, ...replayOptions, timeframe: tf });
    const edges = scanEdgeCases(candles, structure, precision, {
      lookback: engineOptions.lookback ?? 2,
    });

    // -------- مطابقة الصفقات اللي على هالفريم --------
    const tfTrades = trades.filter((t) => String(t.timeframe || "").toLowerCase() === tf.toLowerCase());
    const matches = tfTrades.map((t) => matchTrade(t, structure.events, candles, precision, matchOptions));
    allMatches.push(...matches);

    perTF[tf] = {
      ok: true,
      candleCount: candles.length,
      dateRange: {
        from: candles[0].time,
        to: candles[candles.length - 1].time,
      },
      instrument: {
        instrument: symbol,
        tickSize: precision.tickSize ?? "unknown",
        precision: precision.precision,
        tickSizeSource: precision.tickSizeSource,
        tickSizeConfidence: precision.tickSizeConfidence,
        coverage: precision.coverage,
        distinctPrices: precision.distinctPrices ?? null,
      },
      tolerance: {
        mode: tolerance.mode ?? "none",
        value: tolerance.value,
        description: tolerance.description,
        trustworthy: tolerance.trustworthy,
      },
      counts: structure.meta.counts,
      swings: swingMetrics(structure),
      displacement: displacementMetrics(structure),
      replay: replayMetrics(replay),
      edgeCases: edges,
      tradesOnThisTF: tfTrades.length,
      matches,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    symbol,
    dataset: datasetSummary(symbol, candlesByTF, trades, perTF),
    perTF,
    overall: overallMetrics(allMatches, perTF),
    timing: timingMetrics(allMatches),
    failures: failureDetails(allMatches),
    limitations: knownLimitations(perTF),
  };
}

/* -------------------------------------------------------------------------- */

function datasetSummary(symbol, candlesByTF, trades, perTF) {
  const tfs = Object.keys(candlesByTF);
  let totalCandles = 0;
  for (const tf of tfs) totalCandles += candlesByTF[tf]?.length || 0;

  return {
    symbols: [symbol],
    timeframes: tfs,
    totalCandles,
    perTFCandles: Object.fromEntries(tfs.map((tf) => [tf, candlesByTF[tf]?.length || 0])),
    dateRanges: Object.fromEntries(tfs.map((tf) => [tf, perTF[tf]?.dateRange ?? null])),
    contextRecords: trades.length,
    contextRecordsByTF: trades.reduce((acc, t) => {
      const k = t.timeframe || "unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
  };
}

function swingMetrics(structure) {
  const majors = structure.majorSwings || [];
  const labels = { HH: 0, HL: 0, LH: 0, LL: 0, unlabeled: 0 };
  for (const s of majors) {
    if (s.label) labels[s.label]++;
    else labels.unlabeled++;
  }
  return {
    internal: structure.internalSwings?.length ?? 0,
    major: majors.length,
    anchors: majors.filter((s) => s.isAnchor).length,
    labels,
    /* ما في مرجع خارجي لتسمية السوينغات — التسمية مشتقّة حسابياً من
       التعريف نفسه، فقياس «دقتها» بلا معنى بدون تعليم بشري. */
    accuracy: INSUFFICIENT("ما في سوينغات معلَّمة بشرياً للمقارنة"),
  };
}

function displacementMetrics(structure) {
  const d = structure.displacements || [];
  return {
    total: d.length,
    byLevel: d.reduce((acc, x) => {
      acc[x.strength] = (acc[x.strength] || 0) + 1;
      return acc;
    }, {}),
    byDirection: d.reduce((acc, x) => {
      acc[x.direction || "flat"] = (acc[x.direction || "flat"] || 0) + 1;
      return acc;
    }, {}),
    accuracy: INSUFFICIENT("ما في تصنيف زخم مرجعي بالبيانات التاريخية"),
  };
}

/**
 * مقاييس مستقلة تماماً عن الصفقات — بتقيس **سلامة المحرك بذاته**:
 * تأخير الاكتشاف، وثبات الأحداث (هل بيظهر حدث وبعدين يختفي؟).
 */
function replayMetrics(replay) {
  if (!replay?.ok) return { ok: false, reason: replay?.reason ?? "ما اشتغل" };

  /* ============================================================================
     الأحداث اللي فهرسها قبل نهاية الإحماء بتنستثنى من إحصاء التأخير.
     ----------------------------------------------------------------------------
     التشغيل بيبلّش من الخطوة `warmup`، فأي حدث فهرسه أقل منها بينشاف أول
     مرة عند الخطوة `warmup` — يعني تأخير مفتعل يوصل +warmup شمعة. الرقم
     أثر أداة قياس مش سلوك محرك، وإدخاله بيضخّم المتوسط والوسيط.
     ============================================================================ */
  const warmup = replay.warmup ?? 0;
  const usable = replay.latencies.filter((l) => l.eventIndex - (replay.skippedFromStart ?? 0) >= warmup);
  const excluded = replay.latencies.length - usable.length;

  const byType = {};
  for (const l of usable) {
    (byType[l.type] ||= []).push(l.latencyCandles);
  }

  return {
    ok: true,
    replayedCandles: replay.replayedCandles,
    steps: replay.steps,
    eventsSeen: replay.latencies.length,
    latencyExcludedInWarmup: excluded,
    detectionLatencyByType: Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [k, describe(v)])
    ),
    /* حدث ظهر ثم اختفى = المحرك سحب كلامه. لازم يكون صفر. */
    unstableEvents: {
      count: replay.disappeared.length,
      samples: replay.disappeared.slice(0, 5),
    },
    /* تأخير سالب = نظر للمستقبل. ملاحظة: بالتصميم الحالي التأخير غير
       سالب بنيوياً (الحدث بيجي من تشغيلة على [0..i] فما بيقدر فهرسه
       يتجاوز i)، فهاد الرقم حارس تراجع مش كشف نشط. */
    causalityViolations: usable.filter((l) => l.latencyCandles < 0).length,
  };
}

function overallMetrics(matches, perTF) {
  const total = matches.length;
  const by = (s) => matches.filter((m) => m.status === s).length;

  const engineEventTotals = Object.values(perTF).reduce(
    (acc, r) => {
      if (!r?.ok) return acc;
      acc.bos += r.counts.bos;
      acc.mss += r.counts.mss;
      acc.fakeBreaks += r.counts.fakeBreaks;
      acc.wickBreaks += r.counts.wickBreaks;
      return acc;
    },
    { bos: 0, mss: 0, fakeBreaks: 0, wickBreaks: 0 }
  );

  const matchedByType = matches
    .filter((m) => m.status === MATCH_STATUS.MATCHED)
    .reduce((acc, m) => {
      const t = m.engineEvent?.type || "unknown";
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});

  const matchedByDirection = matches
    .filter((m) => m.status === MATCH_STATUS.MATCHED)
    .reduce((acc, m) => {
      acc[m.direction] = (acc[m.direction] || 0) + 1;
      return acc;
    }, {});

  return {
    contextRecordsEvaluated: total,
    matched: by(MATCH_STATUS.MATCHED),
    directionMismatch: by(MATCH_STATUS.DIRECTION_MISMATCH),
    unmatched: by(MATCH_STATUS.UNMATCHED),
    insufficientData: by(MATCH_STATUS.INSUFFICIENT_DATA),
    agreementRate:
      total - by(MATCH_STATUS.INSUFFICIENT_DATA) > 0
        ? +(by(MATCH_STATUS.MATCHED) / (total - by(MATCH_STATUS.INSUFFICIENT_DATA))).toFixed(4)
        : null,
    matchedByType,
    matchedByDirection,
    engineEventTotals,
    /* ⚠️ مش قابلة للقياس من الصفقات: المتداول ما بياخد كل حدث هيكلي،
       فحدث بلا صفقة **مش** إشارة كاذبة. بدها تعليم بشري لعيّنة أحداث. */
    falsePositives: INSUFFICIENT(
      "الصفقات ما بتغطي كل الأحداث الهيكلية — حدث بلا صفقة مش دليل على خطأ"
    ),
    falseNegatives: {
      note: "«unmatched» هو أقرب تقدير متاح لكنه مش false negative مؤكد",
      count: by(MATCH_STATUS.UNMATCHED),
    },
  };
}

function timingMetrics(matches) {
  const matched = matches.filter((m) => m.status === MATCH_STATUS.MATCHED && m.timing);
  const candles = matched.map((m) => m.timing.diffCandles);
  const minutes = matched.map((m) => m.timing.diffMinutes);

  if (matched.length === 0) {
    return { ...INSUFFICIENT("ما في مطابقات لحساب الفارق الزمني"), n: 0 };
  }

  return {
    n: matched.length,
    diffCandles: describe(candles),
    diffMinutes: describe(minutes),
    lateCount: matched.filter((m) => m.timing.diffCandles > 0).length,
    earlyCount: matched.filter((m) => m.timing.diffCandles < 0).length,
    exactCount: matched.filter((m) => m.timing.diffCandles === 0).length,
  };
}

function failureDetails(matches) {
  return matches
    .filter((m) => m.status !== MATCH_STATUS.MATCHED)
    .map((m) => ({
      tradeId: m.tradeId,
      timestamp: m.refTime ? new Date(m.refTime * 1000).toISOString() : null,
      timeframe: m.timeframe,
      referenceContext: {
        direction: m.direction,
        entryPrice: m.refPrice,
      },
      engineOutput: m.engineEvent,
      status: m.status,
      whyDifferent: m.reason,
      /* اقتراح تصنيف — **مش حكم**. القرار بعد المراجعة البشرية. */
      suggestedClass: suggestClass(m),
    }));
}

function suggestClass(m) {
  if (m.status === MATCH_STATUS.INSUFFICIENT_DATA) {
    return { code: "F", label: "Insufficient Evidence", note: m.reason };
  }
  if (m.status === MATCH_STATUS.DIRECTION_MISMATCH) {
    return {
      code: "D",
      label: "Reference Ambiguity (محتمل)",
      note: "المرجع من المحرك القديم اللي أثبتنا فيه أخطاء اتجاه — لازم فحص يدوي للحالة",
    };
  }
  if (m.status === MATCH_STATUS.UNMATCHED) {
    return {
      code: "B/E",
      label: "Rule Definition أو سلوك متوقع",
      note: "ما في حدث بالنافذة: يا إما تعريف الحدث أضيق من المرجع، يا إما المرجع كان إعداد مش تحوّل هيكلي",
    };
  }
  return { code: "F", label: "Insufficient Evidence", note: null };
}

function knownLimitations(perTF) {
  const lims = [
    {
      id: "equal-highs-lows",
      severity: "معروف ومتفق عليه",
      text: "القمم/القيعان المتساوية بالضبط غير مرئية لكاشف البيفوت (شرط الفراكتال بيرفض التعادل). بدها Liquidity Detector مستقل — مؤجلة لطبقة السيولة، مش مصلَّحة هون.",
      measured: Object.fromEntries(
        Object.entries(perTF).map(([tf, r]) => [
          tf,
          r?.ok ? r.edgeCases.pivotsSuppressedByExactTie.count : null,
        ])
      ),
    },
    {
      id: "reference-not-ground-truth",
      severity: "منهجي",
      text: "qais_ai_trades مصدره المحرك القديم اللي أثبتنا فيه أخطاء (فهرسة شمعة الكسر، تضخّم الأحداث، CHOCH اسم مكرّر للـMSS). فأي «عدم تطابق» مش دليل خطأ بالمحرك الجديد.",
    },
    {
      id: "false-positives-unmeasurable",
      severity: "منهجي",
      text: "معدل الإشارات الكاذبة ما بينقاس من الصفقات — بده تعليم بشري لعيّنة أحداث عشوائية.",
    },
    {
      id: "replay-window",
      severity: "أداء",
      text: "التشغيل شمعة-بشمعة O(n²) فبينقصّ على آخر maxCandles شمعة. التحليل الكامل بيشتغل على كل البيانات؛ القص بيخص قياس التأخير والثبات بس.",
    },
  ];

  for (const [tf, r] of Object.entries(perTF)) {
    if (r?.ok && r.instrument.tickSize === "unknown") {
      lims.push({
        id: `tick-unknown-${tf}`,
        severity: "قياس",
        text: `${tf}: حجم التِك ما انستنتج (${r.instrument.tickSizeSource}) — الفروقات السعرية بتتقاس بـ${r.tolerance.description} بدل مضاعفات التِك.`,
      });
    }
  }
  return lims;
}
