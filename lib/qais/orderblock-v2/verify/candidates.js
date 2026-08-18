/* ============================================================================
   lib/qais/orderblock-v2/verify/candidates.js
   تجميع حالات الزخم المرشّحة من عيّنة مجمّدة — **للتسمية البشرية**.

   ⚠️ هالملف ما بيصنّف ولا بيحكم. بيقيس وبس.
   ---------------------------------------------------------------------------
   قرار صاحب المنهجية (٢٠٢٦-٠٨-١٧) بعد ما حالة حقيقية انرفضت من المحرك:

       «لا تستخدم شرط ATR أو نسبة ثابتة لتحديد الزخم. القاعدة عندي ليست أن
        الحركة لازم تكون بعدد شموع معين أو رقم ATR معين... لا تعمم من هذه
        الحالة وحدها رقمًا ثابتًا. اجمع عدة حالات مشابهة، وأنا أحدد لك أيها
        زخم وأيها ليس زخمًا، وبعدها استخرج القاعدة المشتركة بينها.»

   فالترتيب: نجمع كل الحالات **بلا فلتر** → يسمّيها → نشتق القاعدة من
   تسمياته. مش العكس. أي عتبة نحطها هون بتحدد النتيجة قبل ما يشوفها.

   ⚠️ الـATR مسجَّل كـ**وحدة قياس** مش كشرط.
   ---------------------------------------------------------------------------
   بلا تطبيع، حركة ٢٠٠ نقطة بيناير ما بتنقارن بحركة ٢٠٠ نقطة بمايو. التطبيع
   بيخلّي الأرقام قابلة للمقارنة بين الحالات — وهاد شرط لاستخراج قاعدة منها.
   لو طلع من تسمياته إنه الـATR مش العامل الفاصل، منشيله. القرار من الأرقام.

   ⚠️ آفاق متعددة، مش أفق واحد.
   ---------------------------------------------------------------------------
   أول قياس كتبته كان «أقصى امتداد قبل الإبطال» — وطلع بيعطي الحالة المسمّاة
   ٢٤.٨×ATR بعد ١٦١ شمعة، والحد الأقصى بكل العيّنة `Infinity`. هاد بيقيس
   **كم ضلّت الكتلة صامدة**، مش قوة الحركة. فانستبدل بآفاق قصيرة مسقوفة،
   وبتنسجّل كلها — لأنه أي أفق نختاره لحاله بيكون افتراض مش قياس.
   ============================================================================ */

import { atrSeries } from "../../structure/atr.js";
import { findFVGs, indexFVGs, fvgAt } from "../fvg.js";
import { oppositeGroupBefore, levelsFromGroup, firstInvalidationIndex } from "../block.js";
import { analyzeStructureV2 } from "../../structure/index.js";

/** آفاق الامتداد بالشموع — كلها بتنسجّل، ولا وحدة بتنعتمد. */
export const HORIZONS = [1, 2, 3, 5, 8];

/** سقف البحث عن الفجوة/نهاية الساق — لمنع القياس غير المسقوف. */
export const SEARCH_CAP = 30;

export const CANDIDATE_DEFAULTS = { atrPeriod: 14, timeframe: null };

/**
 * كل حالة = مجموعة شموع متتالية بلون واحد، وبعدها شمعة بالاتجاه المعاكس.
 * ما في عتبة ولا فلتر — هاي كل الحالات بالعيّنة.
 *
 * @returns {{ ok, cases, meta }}
 */
export function collectDisplacementCases(candles, options = {}) {
  const cfg = { ...CANDIDATE_DEFAULTS, ...options };

  if (!Array.isArray(candles) || candles.length < cfg.atrPeriod + 5) {
    return {
      ok: false,
      reason: `عدد الشموع (${Array.isArray(candles) ? candles.length : 0}) ما بيكفي لـATR بفترة ${cfg.atrPeriod}`,
      cases: [],
      meta: { config: cfg },
    };
  }

  const atr = atrSeries(candles, cfg.atrPeriod);
  const fvgByIndex = indexFVGs(findFVGs(candles, { atr, timeframe: cfg.timeframe }));

  /* أحداث الهيكل بتنسجّل كـ**واقعة مقيسة** حول الحالة — مش كشرط قبول. */
  const events = (analyzeStructureV2(candles, { timeframe: cfg.timeframe }).events || [])
    .map((e) => ({ index: e.index ?? e.breakIndex, direction: e.direction, type: e.type }))
    .filter((e) => Number.isFinite(e.index));

  const cases = [];
  const seenGroup = new Set();
  let skippedAtrWarmup = 0;
  let skippedDoji = 0;

  for (let i = 1; i < candles.length - 1; i++) {
    const c1 = candles[i];

    /* شمعة بلا جسم ما إلها اتجاه — ما بتصلح تبلّش حركة. */
    if (c1.close === c1.open) {
      skippedDoji++;
      continue;
    }
    const dirUp = c1.close > c1.open;
    const direction = dirUp ? "up" : "down";

    const group = oppositeGroupBefore(candles, i, dirUp);
    if (!group) continue;

    /* شمعتين متتاليتين بيرجعوا لنفس المجموعة = حالة وحدة. */
    const key = `${direction}:${group.startIndex}`;
    if (seenGroup.has(key)) continue;

    /* ⚠️ ATR لسا ما اكتمل → الحالة تنستثنى وينتسجّل عددها.
       التطبيع بصفر بيطلّع Infinity وبيلوّث كل الإحصاءات اللي بعده. */
    const atrAtGroup = atr[group.endIndex];
    if (!Number.isFinite(atrAtGroup) || atrAtGroup <= 0) {
      skippedAtrWarmup++;
      continue;
    }
    seenGroup.add(key);

    const built = levelsFromGroup(group, dirUp);
    const { levels } = built;
    const invalidationIndex = firstInvalidationIndex(candles, i + 1, levels.invalidation, dirUp);
    const lastValid = invalidationIndex === -1 ? candles.length - 1 : invalidationIndex - 1;

    /* نقطة انطلاق الحركة = إغلاق آخر شمعة بالمجموعة. */
    const base = candles[group.endIndex].close;
    const norm = (p) => +(((dirUp ? p - base : base - p) / atrAtGroup).toFixed(3));
    const extremeOf = (from, to) => {
      let e = base;
      for (let k = from; k <= to; k++) {
        const c = candles[k];
        if (!c) continue;
        if (dirUp ? c.high > e : c.low < e) e = dirUp ? c.high : c.low;
      }
      return e;
    };

    const extension = {};
    for (const h of HORIZONS) {
      extension[`ext${h}`] = norm(extremeOf(i, Math.min(i + h - 1, lastValid)));
    }

    /* الساق: بتكمل لحد ما يسكّر السعر راجع جوّا الكتلة (خلف مستوى Close).
       نهاية طبيعية للحركة، ومسقوفة بـSEARCH_CAP. */
    let legExtreme = base;
    let legBars = 0;
    for (let k = i; k <= Math.min(lastValid, i + SEARCH_CAP - 1); k++) {
      const c = candles[k];
      if (dirUp ? c.close < levels.close : c.close > levels.close) break;
      if (dirUp ? c.high > legExtreme : c.low < legExtreme) {
        legExtreme = dirUp ? c.high : c.low;
        legBars = k - group.endIndex;
      }
    }

    /* أول فجوة بنفس الاتجاه بعد المجموعة — بالشموع، مش بوليان.
       «بعد كم شمعة» هو بالضبط اللي بيفرّق التعريفات المطروحة. */
    let fvgIndex = null;
    for (let k = i; k <= Math.min(lastValid, i + SEARCH_CAP - 1); k++) {
      if (fvgAt(fvgByIndex, k, direction)) {
        fvgIndex = k;
        break;
      }
    }

    const event = events.find(
      (e) => e.index > group.endIndex && e.index <= lastValid && e.direction === direction
    );

    const range1 = c1.high - c1.low;

    /* ── وضوح أجسام الكتلة ──────────────────────────────────────────────
       شرط صاحب المنهجية (٢٠٢٦-٠٨-١٧): «لازم تكون الأجسام واضحة، ما تكون
       الكتلة عبارة عن ذيل».

       ⚠️ بينقاس على **الكتلة ككل**، مش على كل شمعة لحالها.
       الحالة المسمّاة بتحسم الالتباس: آخر شمعة فيها جسمها ١٦.٦٪ — ذيل
       طويل لتحت — ومع هيك هي كتلة صحيحة عنده. وككل، جسم الكتلة ٨٦.٩٪ من
       مداها. فقياس «أضعف شمعة» كان بيرفض كتلته بأي حد فوق ٢٠٪، وقياس
       «الكتلة ككل» بيحطها بأعلى ١٣٪ من العيّنة.

       التلات مقاييس بتنسجّل — بس بلا حد. الحد بيجي من التسميات. */
    const gm = built.merged;
    const groupRange = gm.high - gm.low;
    let sumBody = 0;
    let sumRange = 0;
    let weakest = null;
    for (const gc of group.candles) {
      const rg = gc.high - gc.low;
      const bd = Math.abs(gc.close - gc.open);
      sumBody += bd;
      sumRange += rg;
      const ratio = rg > 0 ? bd / rg : 0;
      if (weakest == null || ratio < weakest) weakest = ratio;
    }

    cases.push({
      id: `C${cases.length + 1}`,
      moveIndex: i,
      moveTime: c1.time,
      direction,

      groupStartIndex: group.startIndex,
      groupEndIndex: group.endIndex,
      groupStartTime: candles[group.startIndex].time,
      groupEndTime: candles[group.endIndex].time,
      groupCandleCount: group.candles.length,

      levels: {
        open: +levels.open.toFixed(2),
        mt: +levels.mt.toFixed(2),
        close: +levels.close.toFixed(2),
        outerWick: +levels.outerWick.toFixed(2),
        fvg: +levels.fvg.toFixed(2),
      },

      /* ── قياسات خام. ما في منها ولا وحدة عتبة. ── */
      measurements: {
        atrAtGroup: +atrAtGroup.toFixed(2),
        firstCandleRangeAtr: +(range1 / atrAtGroup).toFixed(3),
        firstCandleBodyPct: range1 > 0 ? +(Math.abs(c1.close - c1.open) / range1).toFixed(3) : null,

        /* وضوح أجسام الكتلة — القراءة المعتمدة هي الأولى (الكتلة ككل). */
        blockBodyRatio: groupRange > 0 ? +(Math.abs(gm.open - gm.close) / groupRange).toFixed(3) : null,
        blockBodySumRatio: sumRange > 0 ? +(sumBody / sumRange).toFixed(3) : null,
        blockWeakestBodyPct: weakest == null ? null : +weakest.toFixed(3),
        ...extension,
        extLeg: norm(legExtreme),
        extLegBars: legBars,
        fvgAfterBars: fvgIndex == null ? null : fvgIndex - group.endIndex,
        eventAfterBars: event ? event.index - group.endIndex : null,
        eventType: event?.type ?? null,
        invalidationAfterBars: invalidationIndex === -1 ? null : invalidationIndex - group.endIndex,
      },

      /* ← بيعبّيها صاحب المنهجية. `null` = لسا ما انسمّت. */
      label: null,
      labelReason: null,
    });
  }

  return {
    ok: true,
    reason: null,
    cases,
    meta: {
      config: cfg,
      candleCount: candles.length,
      caseCount: cases.length,
      skippedAtrWarmup,
      skippedDoji,
      structureEventCount: events.length,
      horizons: HORIZONS,
      searchCap: SEARCH_CAP,
      note: "قياسات خام بلا تصنيف. القاعدة بتنشتق من التسميات البشرية، مش من عتبة هون.",
    },
  };
}

/**
 * عيّنة موزّعة على طيف القوة — عشان التسميات تغطي الضعيف والقوي.
 *
 * ⚠️ هاد **توزيع عيّنة** مش فلتر قبول. الفرق: الفلتر بيرمي حالات وبيقرر
 * النتيجة سلفاً؛ التوزيع بيضمن إنه التسميات تشمل الطرفين — وبدونه ممكن
 * يسمّي ٢٤ حالة كلها قوية وما نطلع بحد فاصل أبداً.
 *
 * @param mustInclude فهارس/معرّفات حالات لازم تكون بالعيّنة (الحالات المسمّاة سلفاً)
 */
export function stratifiedSample(cases, { size = 24, by = "extLeg", mustInclude = [] } = {}) {
  const pool = [...cases].sort((a, b) => a.measurements[by] - b.measurements[by]);
  if (pool.length <= size) return pool;

  const forced = new Set(mustInclude);
  const picked = new Map();
  for (const c of pool) if (forced.has(c.id)) picked.set(c.id, c);

  const remaining = size - picked.size;
  if (remaining > 0) {
    /* أخذ متساوي التباعد على الترتيب التصاعدي = تغطية كل الشرائح. */
    const step = (pool.length - 1) / (remaining - 1 || 1);
    for (let n = 0; n < remaining; n++) {
      for (let off = 0; off < pool.length; off++) {
        const idx = Math.min(pool.length - 1, Math.round(n * step) + off);
        if (!picked.has(pool[idx].id)) {
          picked.set(pool[idx].id, pool[idx]);
          break;
        }
      }
    }
  }
  return [...picked.values()].sort((a, b) => a.moveIndex - b.moveIndex);
}
