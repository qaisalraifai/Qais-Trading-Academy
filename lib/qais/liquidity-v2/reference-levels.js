/* ============================================================================
   lib/qais/liquidity-v2/reference-levels.js
   المستويات المرجعية: قمة/قاع أمس · قمة/قاع الأسبوع الماضي · قمة/قاع الجلسة.

   هاي مستويات «بيشوفها الكل» — لهيك بيتجمّع فوقها وتحتها أكبر قدر من الأوامر
   المعلّقة. القيمة تبعها مش بشكل الشمعة، بل بإنها **مرجع مشترك**.

   السببية هون مباشرة وحاسمة:
     • قمة أمس بتصير معروفة **لحظة ما يبلّش اليوم الجديد** — ولا شمعة قبلها.
     • قمة الجلسة بتصير معروفة **بعد ما تسكّر آخر شمعة بالجلسة** — يعني من
       الشمعة اللي بعدها، مش من نفس الشمعة.

   عمر المستوى:
     • قمة/قاع أمس = مرجع لليوم الحالي بس. بينتهي بنهاية اليوم.
     • قمة/قاع الأسبوع الماضي = مرجع للأسبوع الحالي.
     • مستوى الجلسة = بيضل مرجع يوم تداولي كامل بعد ما تخلص الجلسة (بعدد
       الشموع النموذجي لليوم، المقيس من البيانات نفسها). ليش يوم كامل: جلسة
       نيويورك بتخلص عادةً مع آخر شمعة باليوم التداولي، فلو انتهى عمرها مع
       اليوم بتطلع بركة عمرها صفر شمعة — يعني ما بتنقاس أبداً. وقياس قمة
       جلسة الأمس هو بالضبط الاستعمال العملي إلها.
   ============================================================================ */

import { insufficient, isInsufficient, makePool, prominenceBars, strengthFromProminence } from "./pool.js";
import { modalBarCount } from "./time-spans.js";

/* ----------------------------------------------------------------------------
   البارزة بتتقاس من **بداية الفترة اللي ولّدت المستوى**، مش من لحظة إتاحته.

   أول تشغيل على بيانات حقيقية طلّع `Weak` لـ١٣٩٢ بركة من ١٥٠١ — لأن المسح
   الخلفي كان بيبلّش من لحظة الإتاحة، فبيصطدم فوراً بشمعة الفترة نفسها اللي
   عملت القمة (المسافة ١-٣ شموع دايماً). السؤال الصح مش «كم شمعة من الإتاحة»
   بل «قدّيش كان هالمستوى صامد **قبل** ما الفترة الحالية تلمسه».
   المسح لسا خلفي بالكامل، فالسببية محفوظة.
   ---------------------------------------------------------------------------- */

const KIND_META = {
  day: { high: "PreviousDayHigh", low: "PreviousDayLow", label: "أمس" },
  week: { high: "PreviousWeekHigh", low: "PreviousWeekLow", label: "الأسبوع الماضي" },
};

/**
 * مستويات الفترة السابقة (يوم/أسبوع) لكل فترة.
 *
 * @param spansResult  ناتج buildDaySpans/buildWeekSpans أو INSUFFICIENT_DATA
 * @param kind         "day" | "week"
 */
export function detectPreviousPeriodLevels(candles, spansResult, kind, options = {}) {
  const { timeframe = null, prominenceWindow = 200 } = options;
  const meta = KIND_META[kind];
  const pools = [];
  const skipped = [];

  if (isInsufficient(spansResult) || !spansResult?.spans) {
    return { pools, skipped, note: spansResult ?? insufficient(`ما في تقسيم ${meta.label}`) };
  }
  const spans = spansResult.spans;
  if (spans.length < 2) {
    return { pools, skipped, note: insufficient(`عدد فترات ${meta.label} (${spans.length}) أقل من ٢ — ما في فترة سابقة مكتملة`) };
  }

  for (let s = 1; s < spans.length; s++) {
    const cur = spans[s];

    /* المصدر لازم يكون فترة **مكتملة ومعروف إنها مكتملة**. مدى ناقص (متل
       شمعة الجمعة 20:00 اللي بتقع لحالها بيوم تداولي طوله شمعة وحدة) بيعطي
       «قمة أمس» طولها ٤ ساعات — رقم بيبان سليم وهو غلط. و`partial === null`
       يعني لسا ما في سابق كافٍ للحكم، وهاد كمان ما بينعتمد كمصدر.
       بنرجع لأقرب فترة مكتملة قبله، وبنسجّل التخطي بسببه بدل ما يمرق بصمت. */
    let p = s - 1;
    while (p >= 0 && spans[p].partial !== false) p--;
    if (p < 0) {
      skipped.push({
        spanIndex: s,
        startIndex: cur.startIndex,
        why: `ما في فترة ${meta.label} مكتملة ومتحقَّق منها قبل هالفترة — بداية العيّنة أو بيانات مقطوعة`,
      });
      continue;
    }
    if (p !== s - 1) {
      const bad = spans[s - 1];
      skipped.push({
        spanIndex: s - 1,
        startIndex: bad.startIndex,
        why:
          bad.partial === null
            ? `الفترة السابقة مباشرة ما بينعرف إذا مكتملة (ما في فترات سابقة كفاية للمقارنة) — انستُبدلت بأقرب فترة متحقَّق منها`
            : `الفترة السابقة مباشرة ناقصة (${bad.barCount} شمعة مقابل ${bad.modalBars ?? "؟"} نموذجي) — انستُبدلت بأقرب فترة مكتملة`,
      });
    }
    const prev = spans[p];

    const availableFromIndex = cur.startIndex;
    const expiresAtIndex = cur.endIndex;
    if (expiresAtIndex < availableFromIndex) continue;

    for (const [side, price, tag] of [
      ["buy", prev.high, "high"],
      ["sell", prev.low, "low"],
    ]) {
      const prom = prominenceBars(candles, prev.startIndex, price, side, prominenceWindow);
      pools.push(
        makePool({
          type: meta[tag],
          side,
          price,
          time: candles[availableFromIndex].time,
          index: availableFromIndex,
          timeframe,
          availableFromIndex,
          expiresAtIndex,
          strength: strengthFromProminence(prom.bars),
          measure: {
            prominenceBars: prom.bars,
            prominenceCapped: prom.capped,
            sourceSpanBars: prev.barCount,
            sourceSpanRange: +(prev.high - prev.low).toFixed(5),
            lifetimeBars: expiresAtIndex - availableFromIndex + 1,
          },
          source: {
            kind: `${kind}Span`,
            spansSource: spansResult.source,
            startIndex: prev.startIndex,
            endIndex: prev.endIndex,
            startTime: prev.startTime,
            endTime: prev.endTime,
          },
          reason:
            `${tag === "high" ? "قمة" : "قاع"} ${meta.label} عند ${Number(price).toFixed(2)} — ` +
            `مرجع مشترك بيتجمّع فوقه/تحته سيولة ${side === "buy" ? "شراء" : "بيع"}. ` +
            `صامد من ${prom.bars} شمعة${prom.capped ? "+ (حد البحث)" : ""}`,
          /* دليل واحد مقيس (البارزة). التحويل لثقة اصطلاحي ومكتوب هون صراحةً
             — نفس نمط events.js بالهيكل. */
          confidence: +Math.min(1, prom.bars / 120).toFixed(3),
        })
      );
    }
  }

  return { pools, skipped, note: null };
}

/**
 * مستويات الجلسات — بركة لكل حصة جلسة مكتملة.
 * `sessionsResult` = ناتج buildSessionRuns أو INSUFFICIENT_DATA.
 */
export function detectSessionLevels(candles, sessionsResult, daySpansResult, options = {}) {
  const { timeframe = null, prominenceWindow = 200 } = options;
  const pools = [];
  const skipped = [];

  if (isInsufficient(sessionsResult) || !sessionsResult?.runs) {
    return { pools, skipped, note: sessionsResult ?? insufficient("ما في تقسيم جلسات") };
  }
  for (const s of sessionsResult.skipped || []) skipped.push(s);

  /* عمر البركة = يوم تداولي كامل بعدد الشموع **المقيس** من العيّنة، مش رقم
     مكتوب بالكود — والمنوال بينحسب من الأيام **اللي خلصت قبل** الجلسة، مش
     من كل العيّنة، حتى ما ينبنى قرار على أيام لسا ما إجت.
     لو ما في أيام سابقة كفاية، بنرجع لطول الجلسة نفسها وبنسجّل هالتراجع. */
  const daySpans = !isInsufficient(daySpansResult) && Array.isArray(daySpansResult?.spans) ? daySpansResult.spans : [];

  for (const run of sessionsResult.runs) {
    const priorDays = daySpans.filter((d) => d.endIndex < run.endIndex);
    const modalBars = priorDays.length >= 3 ? modalBarCount(priorDays) : null;
    const lifetimeSource = Number.isFinite(modalBars) ? "modal_bars_per_prior_day" : "session_length_fallback";

    const availableFromIndex = run.endIndex + 1; // الجلسة بتصير معروفة بعد ما تسكّر آخر شمعة فيها
    if (availableFromIndex >= candles.length) {
      skipped.push({
        label: run.label,
        startIndex: run.startIndex,
        endIndex: run.endIndex,
        why: "الجلسة خلصت على آخر شمعة بالبيانات — ما في ولا شمعة بعدها للتفاعل معها",
      });
      continue;
    }
    const life = Number.isFinite(modalBars) ? modalBars : run.bars;
    const expiresAtIndex = Math.min(candles.length - 1, availableFromIndex + life);

    for (const [side, price, tag] of [
      ["buy", run.high, "High"],
      ["sell", run.low, "Low"],
    ]) {
      const prom = prominenceBars(candles, run.startIndex, price, side, prominenceWindow);
      pools.push(
        makePool({
          type: `Session${tag}`,
          side,
          price,
          time: candles[availableFromIndex].time,
          index: availableFromIndex,
          timeframe,
          availableFromIndex,
          expiresAtIndex,
          strength: strengthFromProminence(prom.bars),
          measure: {
            prominenceBars: prom.bars,
            prominenceCapped: prom.capped,
            sessionBars: run.bars,
            lifetimeBars: expiresAtIndex - availableFromIndex + 1,
            lifetimeSource,
          },
          source: {
            kind: "sessionRun",
            session: run.label,
            startIndex: run.startIndex,
            endIndex: run.endIndex,
            startTime: run.startTime,
            endTime: run.endTime,
          },
          reason:
            `${tag === "High" ? "قمة" : "قاع"} جلسة ${run.label} (${run.bars} شمعة) عند ${Number(price).toFixed(2)} — ` +
            `سيولة ${side === "buy" ? "شراء فوقها" : "بيع تحتها"}. صامد من ${prom.bars} شمعة`,
          confidence: +Math.min(1, prom.bars / 120).toFixed(3),
        })
      );
    }
  }

  return { pools, skipped, note: null };
}
