/* ============================================================================
   lib/qais/orderblock-v2/rules-sk.js
   محرك كتلة الأوامر — بقواعد صاحب المنهجية كما نطقها، مش كما استنتجتها.

   الشروط الأربعة (٢٠٢٦-٠٨-١٧) وحالة كل واحد:

   R1 · الزخم       «واضحة وقوية ومباشرة بما يكفي لتُعتبر زخماً حقيقياً
                     **في سياق الهيكل**» — وصراحةً: ممنوع شرط ATR أو نسبة ثابتة.
   R2 · السيولة     «لازم تكون راجعة لمنطقة سيولة».
   R3 · حدود الكتلة «بالسيناريو الشرائي الكتلة = آخر شموع هابطة قبل الصعود».
   R4 · الأجسام     «لازم تكون الأجسام واضحة، ما تكون الكتلة عبارة عن ذيل».

   ---------------------------------------------------------------------------
   ⚠️ R1 مُصاغ **بلا رقم** — وهاد لبّ الملف.

   العتبة القديمة (`1.5×ATR` على الشمعة الملاصقة) رفضت كتلة حقيقية متحقَّقة
   يدوياً. والحل ما كان تخفيض العتبة — هو منعه صراحةً. فبدل ما أخترع رقم،
   أخدت كلامه حرفياً: «مباشرة **في سياق الهيكل**» = **أول حدث هيكل بعد
   الكتلة لازم يكون بنفس اتجاهها**. ولا عتبة ATR، ولا نافذة شموع، ولا نسبة.

   لو أول حدث إجا بالاتجاه المعاكس، الحركة ما كانت زخماً — الهيكل نفسه
   بيحكم، مش رقم.

   ⚠️ R4 بينقاس على الكتلة **ككل** مش على كل شمعة.
   ---------------------------------------------------------------------------
   حسمتها حالته المتحقَّقة: آخر شمعة بكتلته جسمها ١٦.٦٪ — ذيل رفض طويل —
   بينما الكتلة ككل ٨٦.٩٪. قياس «أضعف شمعة» كان بيرفض كتلته بأي حد فوق ٢٠٪.
   والحد `0.5` **مش معيَّر**: هو الحد الدلالي لـ«جسم أكبر من ذيول» = المعنى
   الحرفي لـ«ما تكون عبارة عن ذيل». وقابل للتغيير بالإعدادات.

   ⚠️ R2 مسجَّل ومعطَّل — وهاد قرار مقيس مش إهمال.
   ---------------------------------------------------------------------------
   بالتعريف الحالي للسيولة، ١٠٠٪ من الحالات (٣٣٦/٣٣٦) فيها كنسة خلال ١٢
   شمعة قبل الكتلة، و٩٠.٥٪ خلال ٣ شموع. السبب: ٧٠٪ من البِرك `SessionHigh/Low`
   وكل جلسة بتولّد بِركتين. شرط بيتحقق ١٠٠٪ ما بيفلتر — فتشغيله بيوهم بصرامة
   مش موجودة. بينتسجّل كدليل، و`requireLiquidity` بيشتغل لما التعريف يتضيّق.

   ⚠️ التكوّن ≠ التأكيد.
   ---------------------------------------------------------------------------
   بما إنه R1 بيتّكل على حدث هيكل لاحق، الكتلة ما بتصير معروفة **كـكتلة**
   إلا لما يصير الحدث. بكتلة يونيو المتحقَّقة إجا الحدث بعد ٢٩ شمعة (وبالعيّنة
   في حالة ١١٩ شمعة). فالفهرسان منفصلان: `formedAtIndex` وقت الشموع،
   و`confirmedAtIndex` وقت ما انطبقت القاعدة. `blocksAsOf` بتستعمل التاني —
   وإلا بيصير نظر للمستقبل.
   ============================================================================ */

import { atrSeries } from "../structure/atr.js";
import { findFVGs, indexFVGs, fvgAt, FVG_DEFAULTS } from "./fvg.js";
import { oppositeGroupBefore, levelsFromGroup, firstInvalidationIndex, statusAt } from "./block.js";
import { analyzeStructureV2 } from "../structure/index.js";

export const SK_DEFAULTS = {
  ...FVG_DEFAULTS,
  atrPeriod: 14,

  /* R4 — حد دلالي («جسم أكبر من ذيول»)، مش رقم معيَّر على حالة. */
  minBlockBodyRatio: 0.5,

  /* السلسلة الموثّقة بتحطّ الفجوة كشرط إلزامي. كلفتها مقيسة: ١٧٠ → ١٦٥ كتلة. */
  requireFvg: true,

  /* R1 — «مباشرة»: أول حدث هيكل بعد الكتلة لازم يكون بنفس اتجاهها.
     لو `false`، بيكفي **أي** حدث بنفس الاتجاه قبل الإبطال. */
  requireFirstEventAligned: true,

  /* R2 — معطَّل لأنه بالتعريف الحالي بيتحقق ١٠٠٪. */
  requireLiquidity: false,
  liquidityLookbackBars: 12,

  minCandles: 30,
};

/**
 * @param candles شموع مرتبة تصاعدياً
 * @param options { timeframe, liquidity, structure, ...SK_DEFAULTS }
 */
export function analyzeOrderBlocksSK(candles, options = {}) {
  const cfg = { ...SK_DEFAULTS, ...options };
  const timeframe = options.timeframe ?? null;
  const liquidity = options.liquidity ?? null;

  const empty = (reason) => ({
    ok: false, reason, timeframe, blocks: [], fvgs: [],
    meta: { config: cfg, candleCount: Array.isArray(candles) ? candles.length : 0 },
  });

  if (!Array.isArray(candles) || candles.length < cfg.minCandles) {
    return empty(`عدد الشموع (${Array.isArray(candles) ? candles.length : 0}) أقل من الحد الأدنى ${cfg.minCandles}`);
  }

  const atr = atrSeries(candles, cfg.atrPeriod);
  const fvgs = findFVGs(candles, { atr, timeframe, minSizeAtrMult: cfg.minSizeAtrMult });
  const fvgByIndex = indexFVGs(fvgs);

  const structure = options.structure ?? analyzeStructureV2(candles, { timeframe });
  const events = (structure.events || [])
    .map((e) => ({ index: e.index ?? e.breakIndex, direction: e.direction, type: e.type, price: e.price }))
    .filter((e) => Number.isFinite(e.index))
    .sort((a, b) => a.index - b.index);

  if (events.length === 0) {
    return empty("ما في أحداث هيكل — قاعدة الزخم (R1) غير قابلة للتطبيق");
  }

  const sweepIndexes = [];
  for (const s of liquidity?.sweeps || []) {
    const i = s.startIndex ?? s.index;
    if (Number.isFinite(i)) sweepIndexes.push(i);
  }

  const blocks = [];
  const seenGroup = new Set();
  const rejected = {
    noGroup: 0, wickBlock: 0, notCompleted: 0,
    firstEventOpposite: 0, noEvent: 0, noFvg: 0, noLiquidity: 0, duplicate: 0,
  };

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    if (c.close === c.open) continue;          // بلا جسم = بلا اتجاه
    const dirUp = c.close > c.open;
    const direction = dirUp ? "up" : "down";

    /* ── R3 · حدود الكتلة ──────────────────────────────────────────── */
    const group = oppositeGroupBefore(candles, i, dirUp);
    if (!group) { rejected.noGroup++; continue; }

    const key = `${direction}:${group.startIndex}`;
    if (seenGroup.has(key)) { rejected.duplicate++; continue; }

    const built = levelsFromGroup(group, dirUp);
    const { levels, merged } = built;

    /* ── R4 · وضوح الأجسام (على الكتلة ككل) ───────────────────────── */
    const blockRange = merged.high - merged.low;
    const blockBodyRatio = blockRange > 0 ? Math.abs(merged.open - merged.close) / blockRange : 0;
    if (blockBodyRatio <= cfg.minBlockBodyRatio) { rejected.wickBlock++; continue; }

    /* ⚠️ الفحص بيبلّش من **شمعة الحركة نفسها** (`i`) مش من اللي بعدها.
       قاعدة صاحب المنهجية: «ما لازم بعد ما يتكون ينزل السعر ويسكّر تحته
       بحال كان سيناريو شرائي، والعكس بالبيعي».

       البدء من `i + 1` كان بيتخطّى شمعة الحركة. مقيس على ٢٧٢٩ شمعة: كتلة
       (`OB-SK:up:2511`) شمعة حركتها صاعدة بس سكّرت عند 29056.13 — تحت حد
       الإبطال 29075.71 — وضلّت تنعدّ كتلة وانتأكدت بعدها بـ١١ شمعة.
       شمعة صاعدة بتقدر تسكّر تحت الكتلة لو فتحت بفجوة هابطة.

       والنتيجة بتنسحب لحالها: `lastValid` بيصير قبل أي حدث، فالكتلة
       بتنرفض من R1 بدل ما تنولد ميتة. */
    const invalidIndex = firstInvalidationIndex(candles, i, levels.invalidation, dirUp);
    const lastValid = invalidIndex === -1 ? candles.length - 1 : invalidIndex - 1;

    /* ── R1 · الزخم «في سياق الهيكل» ──────────────────────────────── */
    const after = events.filter((e) => e.index > group.endIndex && e.index <= lastValid);
    if (after.length === 0) { rejected.noEvent++; continue; }

    let event;
    if (cfg.requireFirstEventAligned) {
      /* «مباشرة» = أول حدث، مش أي حدث. لو إجا معاكس، الحركة ما كانت زخماً. */
      if (after[0].direction !== direction) { rejected.firstEventOpposite++; continue; }
      event = after[0];
    } else {
      event = after.find((e) => e.direction === direction);
      if (!event) { rejected.noEvent++; continue; }
    }

    /* ── R6 · اكتمال الكتلة ───────────────────────────────────────── */
    /* «أول شمعة من سلسلة الشموع الهابطة، يعني أعلاهم سعراً، بس يغلق السعر
       فوقها — هذا آخر شرط من شروط تكوّن الـOB.» (٢٠٢٦-٠٨-١٨)

       أول شمعة بالمجموعة فتحها هو **مستوى Open**. فالشرط إغلاق خلفه قبل
       الإبطال. ⚠️ شرط **تكوّن** مش دورة حياة: قبل ما يتحقق ما في كتلة
       أصلاً — مش «كتلة ضعيفة». والحالة اللي أوقفت الشغل عليه: مجموعة ٧
       شموع، السعر ارتد منها بس ما وصل مستوى Open ولا مرة. */
    let completedAtIndex = null;
    for (let k = i; k <= lastValid; k++) {
      const c = candles[k];
      if (dirUp ? c.close > levels.open : c.close < levels.open) {
        completedAtIndex = k;
        break;
      }
    }
    if (completedAtIndex === null) { rejected.notCompleted++; continue; }

    /* ── الفجوة: بين الكتلة والحدث ────────────────────────────────── */
    let fvg = null;
    for (let k = i; k <= event.index; k++) {
      const f = fvgAt(fvgByIndex, k, direction);
      if (f) { fvg = f; break; }
    }
    if (cfg.requireFvg && !fvg) { rejected.noFvg++; continue; }

    /* ── R2 · السيولة ─────────────────────────────────────────────── */
    const from = Math.max(0, group.startIndex - cfg.liquidityLookbackBars);
    const liquidityContext = liquidity
      ? sweepIndexes.some((x) => x >= from && x <= group.endIndex)
      : null;
    if (cfg.requireLiquidity && liquidityContext !== true) { rejected.noLiquidity++; continue; }

    seenGroup.add(key);

    /* ⚠️ التأكيد بيصير عند الحدث — مش عند الشموع. */
    /* ⚠️ `completedAtIndex` داخل بالحساب: قبل ما تكتمل الكتلة (R6) ما في
       كتلة أصلاً، فاعتبارها معروفة قبلها بيكون نظر للمستقبل. */
    const confirmedAtIndex = Math.max(event.index, fvg ? fvg.confirmedAtIndex : 0, completedAtIndex, i);

    const block = {
      id: `OB-SK:${direction}:${group.startIndex}:${levels.mt.toFixed(5)}`,
      type: "OrderBlock",
      ruleSet: "QAIS-SK",
      direction,
      side: dirUp ? "demand" : "supply",
      timeframe,

      formedAtIndex: i,
      time: candles[i].time,
      groupStartIndex: group.startIndex,
      groupEndIndex: group.endIndex,
      groupStartTime: candles[group.startIndex].time,
      groupEndTime: candles[group.endIndex].time,
      candleCount: group.candles.length,

      completedAtIndex,
      completedAfterBars: completedAtIndex - i,
      confirmedAtIndex,
      confirmedAtTime: candles[confirmedAtIndex].time,
      barsToConfirmation: confirmedAtIndex - group.endIndex,
      availableFromIndex: confirmedAtIndex,

      ...built,
      blockBodyRatio: +blockBodyRatio.toFixed(3),

      invalidIndex,
      invalidTime: invalidIndex !== -1 ? candles[invalidIndex].time : null,

      structureEvent: { type: event.type, direction: event.direction, index: event.index, price: event.price ?? null },
      fvg: fvg ? { index: fvg.index, from: fvg.from, to: fvg.to, size: fvg.size, sizeAtr: fvg.sizeAtr } : null,
      liquidityContext,

      rules: {
        R1: `${event.type} ${event.direction === "up" ? "صاعد" : "هابط"} بعد ${event.index - group.endIndex} شمعة — أول حدث بعد الكتلة`,
        R3: `${group.candles.length} شمعة ${dirUp ? "هابطة" : "صاعدة"} قبل ${dirUp ? "الصعود" : "الهبوط"}`,
        R4: `جسم الكتلة ${(blockBodyRatio * 100).toFixed(1)}% من مداها`,
        R6: `اكتملت بعد ${completedAtIndex - i} شمعة — إغلاق ${dirUp ? "فوق" : "تحت"} ${levels.open.toFixed(2)}`,
        R2: liquidityContext === null ? "ما انفحص — ما انمرّرت طبقة سيولة"
          : liquidityContext ? "كنسة سيولة قبل الكتلة" : "بلا كنسة قريبة",
      },

      reason: [
        `${group.candles.length} شمعة ${dirUp ? "هابطة" : "صاعدة"}`,
        `جسم ${(blockBodyRatio * 100).toFixed(0)}%`,
        `${event.type} بعد ${event.index - group.endIndex} شمعة`,
        fvg ? "مع فجوة" : null,
      ].filter(Boolean).join(" · "),

      /* ⚠️ ما في رقم ثقة. كل شرط بالقاعدة إما تحقق أو لأ — ما في وزن مقيس
         بينهم، فأي مجموع موزون بيكون اصطلاحياً بيبان دقيقاً. */
      confidence: null,
    };

    const st = statusAt(candles, block, candles.length - 1, dirUp);
    block.status = st.status;
    block.firstTouchIndex = st.touchedAtIndex;
    block.weakFromIndex = st.weakFromIndex;

    blocks.push(block);
  }

  blocks.sort((a, b) => b.groupEndIndex - a.groupEndIndex);

  const confBars = blocks.map((b) => b.barsToConfirmation).sort((a, b) => a - b);
  return {
    ok: true, reason: null, timeframe, blocks, fvgs,
    meta: {
      config: cfg,
      candleCount: candles.length,
      structureEventCount: events.length,
      counts: {
        blocks: blocks.length,
        perHundredCandles: +((blocks.length / candles.length) * 100).toFixed(2),
        byStatus: blocks.reduce((a, b) => ((a[b.status] = (a[b.status] || 0) + 1), a), {}),
        bySide: blocks.reduce((a, b) => ((a[b.side] = (a[b.side] || 0) + 1), a), {}),
        byEvent: blocks.reduce((a, b) => ((a[b.structureEvent.type] = (a[b.structureEvent.type] || 0) + 1), a), {}),
        rejected,
      },
      /* ⚠️ رقم لازم ينعرض: الكتلة ما بتتأكد إلا بعد هالعدد من الشموع. */
      barsToConfirmation: confBars.length
        ? { median: confBars[confBars.length >> 1], p90: confBars[Math.floor(confBars.length * 0.9)], max: confBars[confBars.length - 1] }
        : null,
      pendingRules: {
        R1: "مُصاغ بلا رقم. بينتحقق نهائياً لما تكتمل تسميات الزخم.",
        R2: `معطَّل — التعريف الحالي للسيولة بيتحقق ١٠٠٪ فما بيفلتر. requireLiquidity=${cfg.requireLiquidity}`,
        R4: `الحد ${cfg.minBlockBodyRatio} دلالي مش معيَّر — قابل للمراجعة من التسميات.`,
      },
    },
  };
}

/**
 * الكتل الصالحة **بلحظة معيّنة**.
 * ⚠️ بتستعمل `confirmedAtIndex` مش `formedAtIndex` — الكتلة ما بتنعرف
 * كـكتلة إلا لما يصير حدث الهيكل، فاستعمال وقت الشموع بيكون نظر للمستقبل.
 */
export function blocksAsOfSK(result, candles, asOfIndex) {
  return (result.blocks || [])
    .filter((b) => b.confirmedAtIndex <= asOfIndex)
    .filter((b) => b.invalidIndex === -1 || b.invalidIndex > asOfIndex)
    .map((b) => {
      const st = statusAt(candles, b, asOfIndex, b.direction === "up");
      return { ...b, status: st.status, firstTouchIndex: st.touchedAtIndex, weakFromIndex: st.weakFromIndex };
    });
}
