/* ============================================================================
   lib/qais/structure/events.js
   أحداث الهيكل: BOS · CHOCH · MSS — مفصولة فعلياً لأول مرة.

   بالمحرك القديم CHOCH كان مجرد اسم تاني للـMSS (نفس الشرط، نفس الحدث).
   التعريفات هون منفصلة ولكل وحدة شرط خاص:

     BOS   = إغلاق جسم خلف آخر سوينغ خارجي **بنفس اتجاه** الهيكل القائم.
             تأكيد استمرار.
     CHOCH = أول إغلاق جسم خلف المستوى المحمي **بعكس** الهيكل القائم.
             تغيّر طابع — إنذار، مش انعكاس مؤكد.
     MSS   = CHOCH **تأكّد** بـBOS تالي بالاتجاه الجديد. هون بس بينقلب
             الهيكل رسمياً.

   ثلاث قواعد صارمة:
   ---------------------------------------------------------------------------
   ١) الكسر بالإغلاق مش بالذيل. الذيل اللي بيتجاوز بدون إغلاق بينتسجّل
      بقائمة `wickBreaks` منفصلة (هو مادة الـSweep لاحقاً) وما بيولّد حدث.

   ٢) ما في نظر للمستقبل (no lookahead). البيفوت الفراكتالي عند الفهرس p
      ما بينعرف إلا عند p + lookback — فالمستوى ما بيصير قابل للكسر إلا من
      لحظة تأكده. بدون هالقيد أي قياس دقة تاريخي بيطلع مضخّم وكاذب.

   ٣) الكسر الكاذب بينتوسم مش بينحذف. إغلاق خلف المستوى ورجوع بإغلاق
      للجهة التانية خلال نافذة قصيرة = `fakeBreak: true` مع بقاء الحدث
      ظاهر — حتى يكون قابل للفحص بدل ما يختفي بصمت.
   ============================================================================ */

import { atrSeries, atrAt } from "./atr.js";
import { classifyDisplacement, atLeast } from "./displacement.js";

/**
 * @param candles  شموع مرتبة تصاعدياً
 * @param majors   سوينغات خارجية مسمّاة (من swings.js)
 * @param options  { timeframe, lookback, fakeBreakBars, atrPeriod, mssMinDisplacement }
 */
export function detectEvents(candles, majors, options = {}) {
  const {
    timeframe = null,
    lookback = 2,
    fakeBreakBars = 3,
    atrPeriod = 14,
    mssMinDisplacement = "Normal",
  } = options;

  const events = [];
  const wickBreaks = [];
  /* سوينغ خارجي مؤكَّد **واحد** بيكفي: هو مستوى صالح للكسر بحد ذاته.
     الحارس كان `< 2` — بقايا من نسخة كانت بدها أزواج — وكان بيبلع كل
     الأحداث بصمت لما يكون في مستوى واحد مؤكَّد. */
  if (!Array.isArray(candles) || !Array.isArray(majors) || majors.length < 1) {
    return { events, wickBreaks };
  }

  const atr = atrSeries(candles, atrPeriod);

  /* لحظة إتاحة المستوى = لحظة **تأكيده** كسوينغ خارجي (من زجزاج التأكيد
     بـswings.js)، مش مجرد تشكّل البيفوت. بدون هالتمييز كان بينكتشف كسر
     لمستوى ما كان خارجي وقتها — اكتشاف بأثر رجعي. تراجع لـindex+lookback
     بس لو التأكيد مش متوفر. */
  const availableAt = new Map(
    majors.map((s) => [s.index, Number.isFinite(s.confirmedAtIndex) ? s.confirmedAtIndex : s.index + lookback])
  );

  let trend = null; // 'up' | 'down' | null
  let pendingChoch = null; // CHOCH مستنّي تأكيد بـBOS
  let seq = 0;

  /* المستويات الحيّة: آخر قمة/قاع خارجي تأكد ولسا ما انكسر. */
  let refHigh = null;
  let refLow = null;
  let mi = 0; // مؤشر على majors

  const takeAvailable = (i) => {
    while (mi < majors.length && availableAt.get(majors[mi].index) <= i) {
      const s = majors[mi];
      if (s.type === "high") refHigh = s;
      else refLow = s;
      mi++;
    }
  };

  /** هل رجع السعر خلف المستوى بإغلاق خلال النافذة؟ (كسر كاذب) */
  const isFakeBreak = (i, level, dirUp) => {
    const end = Math.min(candles.length - 1, i + fakeBreakBars);
    for (let k = i + 1; k <= end; k++) {
      const c = candles[k];
      if (dirUp ? c.close < level : c.close > level) return { at: k, time: c.time };
    }
    return null;
  };

  const buildEvent = (type, direction, level, swingRef, i) => {
    const c = candles[i];
    const disp = classifyDisplacement(candles, i, { atrPeriod, precomputedAtr: atr });
    const atrVal = atrAt(atr, i);

    // حسم الكسر: كم تجاوز الإغلاق المستوى بوحدة ATR
    const beyond = Math.abs(c.close - level);
    const decisiveness = atrVal && atrVal > 0 ? beyond / atrVal : null;

    // دلالة السوينغ المكسور: طول الساق اللي وصلت له بوحدة ATR
    const legAtr =
      swingRef?.legLength != null && atrVal && atrVal > 0 ? swingRef.legLength / atrVal : null;

    const fake = isFakeBreak(i, level, direction === "up");

    /* الثقة من ٣ أدلة حقيقية فقط — كل وحدة مقصوصة على [0,1]:
       قوة الزخم · حسم الكسر · دلالة المستوى المكسور.
       العامل غير المتوفر بينشال من المتوسط بدل ما ينحسب صفر. */
    const parts = [];
    if (disp?.confidence != null) parts.push(disp.confidence);
    if (decisiveness != null) parts.push(Math.min(1, decisiveness / 0.5));
    if (legAtr != null) parts.push(Math.min(1, legAtr / 3));
    let confidence = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
    if (confidence != null && fake) confidence *= 0.4; // كسر كاذب = ثقة منخفضة، مش حذف

    const reasonBits = [
      `إغلاق ${direction === "up" ? "فوق" : "تحت"} ${level.toFixed(2)}`,
      swingRef?.label ? `المستوى ${swingRef.label}` : null,
      disp ? `زخم ${disp.level}` : null,
      decisiveness != null ? `تجاوز ${decisiveness.toFixed(2)}× ATR` : null,
      fake ? "رجع خلف المستوى بعدها — كسر كاذب" : null,
    ].filter(Boolean);

    return {
      id: `${type}-${direction}-${i}-${seq++}`,
      type,
      direction,
      timeframe,
      time: c.time,
      index: i,
      price: level,
      breakCandle: { index: i, time: c.time, open: c.open, high: c.high, low: c.low, close: c.close },
      swingRef: swingRef
        ? { index: swingRef.index, time: swingRef.time, price: swingRef.price, type: swingRef.type, label: swingRef.label ?? null }
        : null,
      strength: disp?.level ?? null,
      displacement: disp,
      decisiveness: decisiveness != null ? +decisiveness.toFixed(3) : null,
      fakeBreak: !!fake,
      fakeBreakAt: fake ? fake.time : null,
      confirmedBy: null, // بينتعبّى على CHOCH لما يتأكد كـMSS
      reason: reasonBits.join(" · "),
      confidence: confidence != null ? +confidence.toFixed(3) : null,
    };
  };

  for (let i = 0; i < candles.length; i++) {
    takeAvailable(i);
    const c = candles[i];

    /* --- كسر بالذيل بدون إغلاق: بينتسجّل ولا بيولّد حدث --- */
    if (refHigh && c.high > refHigh.price && c.close <= refHigh.price) {
      wickBreaks.push({
        direction: "up",
        level: refHigh.price,
        index: i,
        time: c.time,
        timeframe,
        swingRef: { index: refHigh.index, time: refHigh.time, price: refHigh.price, type: "high", label: refHigh.label ?? null },
        reason: "الذيل تجاوز القمة بدون إغلاق فوقها",
      });
    }
    if (refLow && c.low < refLow.price && c.close >= refLow.price) {
      wickBreaks.push({
        direction: "down",
        level: refLow.price,
        index: i,
        time: c.time,
        timeframe,
        swingRef: { index: refLow.index, time: refLow.time, price: refLow.price, type: "low", label: refLow.label ?? null },
        reason: "الذيل تجاوز القاع بدون إغلاق تحته",
      });
    }

    /* --- كسر صاعد بالإغلاق --- */
    if (refHigh && c.close > refHigh.price) {
      const type = trend === "down" ? "CHOCH" : "BOS";
      const ev = buildEvent(type, "up", refHigh.price, refHigh, i);
      events.push(ev);

      if (type === "CHOCH") {
        pendingChoch = ev;
        trend = null; // طابع متغيّر — الاتجاه معلّق لحد التأكيد
      } else {
        trend = "up";
        // BOS صاعد بيأكد CHOCH صاعد سابق => MSS
        if (pendingChoch && pendingChoch.direction === "up") {
          if (atLeast(pendingChoch.strength ?? "Weak", mssMinDisplacement) && !pendingChoch.fakeBreak) {
            events.push(promoteToMSS(pendingChoch, ev, seq++));
          }
          pendingChoch = null;
        }
      }
      refHigh = null; // انكسر — بيستنى سوينغ خارجي جديد
      continue;
    }

    /* --- كسر هابط بالإغلاق --- */
    if (refLow && c.close < refLow.price) {
      const type = trend === "up" ? "CHOCH" : "BOS";
      const ev = buildEvent(type, "down", refLow.price, refLow, i);
      events.push(ev);

      if (type === "CHOCH") {
        pendingChoch = ev;
        trend = null;
      } else {
        trend = "down";
        if (pendingChoch && pendingChoch.direction === "down") {
          if (atLeast(pendingChoch.strength ?? "Weak", mssMinDisplacement) && !pendingChoch.fakeBreak) {
            events.push(promoteToMSS(pendingChoch, ev, seq++));
          }
          pendingChoch = null;
        }
      }
      refLow = null;
      continue;
    }
  }

  events.sort((a, b) => a.index - b.index);
  return { events, wickBreaks };
}

/** MSS = نسخة مؤكَّدة من الـCHOCH، مربوطة بالـBOS اللي أكّدها. */
function promoteToMSS(choch, confirmingBos, seq) {
  return {
    ...choch,
    id: `MSS-${choch.direction}-${choch.index}-${seq}`,
    type: "MSS",
    /* الوقت/الفهرس بيضلوا وقت الـCHOCH — هناك صار التحوّل فعلياً.
       لحظة التأكيد منفصلة بـconfirmedBy حتى ما نخلط بينهم. */
    confirmedBy: {
      index: confirmingBos.index,
      time: confirmingBos.time,
      price: confirmingBos.price,
      eventId: confirmingBos.id,
    },
    chochId: choch.id,
    reason: `${choch.reason} · تأكّد بـBOS ${confirmingBos.direction} عند ${confirmingBos.price.toFixed(2)}`,
    /* ثقة الـMSS = متوسط ثقة الـCHOCH وثقة الـBOS المؤكِّد — دليلان مستقلان. */
    confidence:
      choch.confidence != null && confirmingBos.confidence != null
        ? +((choch.confidence + confirmingBos.confidence) / 2).toFixed(3)
        : (choch.confidence ?? confirmingBos.confidence ?? null),
  };
}
