/* ============================================================================
   lib/qais/orderblock-v2/index.js
   محرك كتلة الأوامر — نقطة الدخول الوحيدة.

   السلسلة الإلزامية (قواعد QAIS SK):
       حركة زخم واضحة → FVG بنفس اتجاهها (شرط إلزامي) → آخر مجموعة شموع
       معاكسة متتالية قبلها = كتلة الأوامر، بمستوياتها الخمسة.

   ⚠️ ما في «سيقان» — وهاي أهم قرار تصميمي بالملف.
   ---------------------------------------------------------------------------
   المحرك القديم كان بيمسح الكتل **جوّا نوافذ سيقان MSS**. وبما إنه فهرس
   الـMSS هو فهرس **شمعة الكسر**، والمسح بيبلّش من `fromIndex + 1`، كانت
   شمعة الزخم اللي كسرت الهيكل تطلع بره كل النوافذ — والساق السابقة بتنتهي
   قبلها بوحدة. النتيجة: **الكتلة الأهم بالمنهجية كلها** (الشموع المعاكسة
   اللي قبل شمعة الكسر، اللي السعر بيرجعلها بعد الكسر) ما كانت تنكشف ولا
   مرة. صفقة حقيقية للمحلّل ضلّت مخفية جولات كاملة بسبب هالعتبة.

   الحل مش توسيع النافذة — الحل إلغاء فكرة النافذة. كل شمعة زخم بتنفحص
   بذاتها، واتجاه الكتلة هو اتجاه الزخم نفسه. ما في نطاق يقدر يحجب كتلة.

   ⚠️ سياق السيولة **بينتسجّل ولا بيفلتر**.
   ---------------------------------------------------------------------------
   التوثيق بيقول السلسلة بتبلّش بـ«العودة لمنطقة سيولة». بس تحويلها لشرط
   إقصاء بيعيد نفس الخطأ من باب تاني: كتلة حقيقية بتختفي لأن كاشف السيولة
   ما شافها. فبينتسجّل كـ«دليل» بيرفع الجودة، وبينقاس كم كتلة بتنستثنى لو
   انفرض الشرط (`wouldExcludeIfLiquidityRequired`) — رقم مقيس بدل افتراض.
   ============================================================================ */

import { atrSeries } from "../structure/atr.js";
import { classifyDisplacement, atLeast } from "../structure/displacement.js";
import { findFVGs, indexFVGs, fvgAt, FVG_DEFAULTS } from "./fvg.js";
import { oppositeGroupBefore, levelsFromGroup, firstInvalidationIndex, statusAt } from "./block.js";

export const OB_DEFAULTS = {
  ...FVG_DEFAULTS,
  atrPeriod: 14,
  /* أدنى تصنيف زخم يُعتمد. «Strong» يعني المدى ≥١.٥×ATR **مع** بوابة الجسم
     (الجسم ≥٥٥٪ من المدى) — فشمعة ذيول ضخمة بجسم صفر ما بتولّد كتلة. */
  minDisplacement: "Strong",
  /* نافذة البحث عن تفاعل سعري مع السيولة قبل شمعة الزخم — دليل مساند. */
  liquidityLookbackBars: 10,
  minCandles: 30,
};

/**
 * @param candles شموع مرتبة تصاعدياً
 * @param options {
 *   timeframe, liquidity (ناتج analyzeLiquidityV2 — اختياري كدليل),
 *   ...OB_DEFAULTS
 * }
 */
export function analyzeOrderBlocksV2(candles, options = {}) {
  const cfg = { ...OB_DEFAULTS, ...options };
  const timeframe = options.timeframe ?? null;
  const liquidity = options.liquidity ?? null;

  const empty = (reason) => ({
    ok: false,
    reason,
    timeframe,
    blocks: [],
    fvgs: [],
    meta: { config: cfg, candleCount: Array.isArray(candles) ? candles.length : 0 },
  });

  if (!Array.isArray(candles) || candles.length < cfg.minCandles) {
    return empty(
      `عدد الشموع (${Array.isArray(candles) ? candles.length : 0}) أقل من الحد الأدنى ${cfg.minCandles}`
    );
  }

  const atr = atrSeries(candles, cfg.atrPeriod);
  const fvgs = findFVGs(candles, { atr, timeframe, minSizeAtrMult: cfg.minSizeAtrMult });
  const fvgByIndex = indexFVGs(fvgs);

  /* أوقات تفاعل السعر مع بِرك السيولة — للدليل المساند وبس. */
  const sweepIndexes = [];
  for (const s of liquidity?.sweeps || []) {
    const idx = s.startIndex ?? s.index ?? null;
    if (Number.isFinite(idx)) sweepIndexes.push(idx);
  }
  sweepIndexes.sort((a, b) => a - b);

  const blocks = [];
  const rejected = { noDisplacement: 0, weakDisplacement: 0, noFvg: 0, noOppositeGroup: 0, duplicateGroup: 0 };
  let wouldExcludeIfLiquidityRequired = 0;
  const seenGroupStart = new Set();

  for (let i = 1; i < candles.length; i++) {
    const disp = classifyDisplacement(candles, i, { atrPeriod: cfg.atrPeriod, precomputedAtr: atr });
    if (!disp || !disp.direction) {
      rejected.noDisplacement++;
      continue;
    }
    if (!atLeast(disp.level, cfg.minDisplacement)) {
      rejected.weakDisplacement++;
      continue;
    }

    const dirUp = disp.direction === "up";

    /* FVG شرط إلزامي — والسؤال مباشر: هل **هالشمعة** خلّفت فجوة بنفس
       اتجاهها؟ بلا نافذة تقريبية. */
    const fvg = fvgAt(fvgByIndex, i, disp.direction);
    if (!fvg) {
      rejected.noFvg++;
      continue;
    }

    const group = oppositeGroupBefore(candles, i, dirUp);
    if (!group) {
      rejected.noOppositeGroup++;
      continue;
    }

    /* شمعتا زخم متتاليتان بترجعوا لنفس المجموعة — بتنحسب مرة وحدة. */
    const groupKey = `${disp.direction}:${group.startIndex}`;
    if (seenGroupStart.has(groupKey)) {
      rejected.duplicateGroup++;
      continue;
    }
    seenGroupStart.add(groupKey);

    const built = levelsFromGroup(group, dirUp);
    const invalidIndex = firstInvalidationIndex(candles, i + 1, built.levels.invalidation, dirUp);

    /* سياق السيولة: هل صار تفاعل مع بِركة خلال النافذة قبل الزخم؟ */
    const from = Math.max(0, i - cfg.liquidityLookbackBars);
    const liquidityContext = liquidity
      ? sweepIndexes.some((x) => x >= from && x <= i)
      : null;
    if (liquidityContext === false) wouldExcludeIfLiquidityRequired++;

    const block = {
      id: `OB:${disp.direction}:${i}:${built.levels.mt.toFixed(5)}`,
      type: "OrderBlock",
      direction: disp.direction,
      side: dirUp ? "demand" : "supply",
      timeframe,

      /* لحظة التكوّن = شمعة الزخم. والكتلة نفسها هي الشموع اللي قبلها. */
      formedAtIndex: i,
      time: candles[i].time,
      groupStartIndex: group.startIndex,
      groupEndIndex: group.endIndex,
      candleCount: group.candles.length,

      /* ⚠️ ما بتنعرف إلا بعد ما تسكّر شمعة تأكيد الفجوة. */
      availableFromIndex: Math.max(i, fvg.confirmedAtIndex),

      ...built,
      invalidIndex,
      invalidTime: invalidIndex !== -1 ? candles[invalidIndex].time : null,

      displacement: {
        level: disp.level,
        score: disp.score,
        rangeAtr: disp.rangeRatio,
        bodyRatio: disp.bodyRatio,
        confidence: disp.confidence,
        unavailable: disp.unavailable,
      },
      fvg: { index: fvg.index, from: fvg.from, to: fvg.to, size: fvg.size, sizeAtr: fvg.sizeAtr },
      liquidityContext,

      reason: [
        `زخم ${disp.level} ${dirUp ? "صاعد" : "هابط"}`,
        `فجوة ${fvg.sizeAtr == null ? "" : fvg.sizeAtr.toFixed(2) + "× ATR "}بنفس الاتجاه`,
        `${group.candles.length} شمعة معاكسة قبلها`,
        liquidityContext === true ? "بعد تفاعل مع سيولة" : liquidityContext === false ? "بدون تفاعل سيولة قريب" : null,
      ]
        .filter(Boolean)
        .join(" · "),

      /* الثقة = ثقة الزخم وبس. ما في عوامل تانية مقيسة بمرجع، فما منخترع
         مجموع موزون يبان دقيق وهو اصطلاحي. */
      confidence: disp.confidence ?? null,
    };

    const st = statusAt(candles, block, candles.length - 1, dirUp);
    block.status = st.status;
    block.firstTouchIndex = st.touchedAtIndex;
    block.weakFromIndex = st.weakFromIndex;

    blocks.push(block);
  }

  blocks.sort((a, b) => b.formedAtIndex - a.formedAtIndex); // الأحدث أولاً

  return {
    ok: true,
    reason: null,
    timeframe,
    blocks,
    fvgs,
    meta: {
      config: cfg,
      candleCount: candles.length,
      counts: {
        blocks: blocks.length,
        fvgs: fvgs.length,
        byStatus: blocks.reduce((a, b) => ((a[b.status] = (a[b.status] || 0) + 1), a), {}),
        byDirection: blocks.reduce((a, b) => ((a[b.direction] = (a[b.direction] || 0) + 1), a), {}),
        rejected,
        /* رقم مقيس: كم كتلة كانت تختفي لو خلّينا السيولة شرط إقصاء. */
        wouldExcludeIfLiquidityRequired: liquidity ? wouldExcludeIfLiquidityRequired : null,
      },
    },
  };
}

/**
 * الكتل الصالحة **بلحظة معيّنة** — مش «اليوم».
 * هاد اللي بيخلّي إعادة بناء صفقة تاريخية ممكنة.
 */
export function blocksAsOf(result, candles, asOfIndex) {
  return (result.blocks || [])
    .filter((b) => b.availableFromIndex <= asOfIndex)
    .filter((b) => b.invalidIndex === -1 || b.invalidIndex > asOfIndex)
    .map((b) => {
      const st = statusAt(candles, b, asOfIndex, b.direction === "up");
      return { ...b, status: st.status, firstTouchIndex: st.touchedAtIndex, weakFromIndex: st.weakFromIndex };
    });
}
