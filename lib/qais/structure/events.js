/* ============================================================================
   lib/qais/structure/events.js
   أحداث الهيكل: BOS · MSS — نوعان فقط.

     BOS = إغلاق جسم خلف آخر سوينغ خارجي **بنفس اتجاه** الهيكل القائم.
           استمرار الاتجاه.

     MSS = إغلاق جسم خلف **السوينغ الحامي** للاتجاه القائم = تغيّر اتجاه
           مباشرة، بدون مرحلة وسيطة وبدون تأكيد لاحق.

             صاعد : HH → HL → HH → كسر الـHL الحامي بإغلاق = MSS هابط
             هابط : LL → LH → LL → كسر الـLH الحامي بإغلاق = MSS صاعد

   ⚠️ ما في CHOCH بهالمنهجية — لا كنوع، ولا كمرحلة، ولا كشرط.
   ---------------------------------------------------------------------------
   نسخة سابقة كانت بتفصل CHOCH كإنذار وMSS كـ«CHOCH تأكّد بـBOS لاحق».
   القياس ضد المرجع البشري طلّع MSS recall = 0/1: المحلّل سمّى كسر المستوى
   الحامي MSS مباشرة، بينما المحرك كان مستنّي تأكيد ما إجا ضمن العيّنة.

   ⚠️ مستوى الـMSS = سعر **السوينغ الحامي المكسور**، مش أي سعر من شمعة
   الكسر. شمعة الكسر هي لحظة التأكيد وبس.

   الاتجاه بينقلب لحظة الـMSS — مش بينعلّق.

   ملاحظة: أول كسر لما ما يكون في اتجاه قائم بعد (trend = null) بينحسب
   BOS — ما في اتجاه سابق حتى ينقلب منه.

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
import { classifyDisplacement } from "./displacement.js";

/**
 * @param candles  شموع مرتبة تصاعدياً
 * @param majors   سوينغات خارجية مسمّاة (من swings.js)
 * @param options  { timeframe, lookback, fakeBreakBars, atrPeriod }
 */
export function detectEvents(candles, majors, options = {}) {
  const { timeframe = null, lookback = 2, fakeBreakBars = 3, atrPeriod = 14 } = options;

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
  let seq = 0;

  /* المستويات الحيّة: آخر قمة/قاع خارجي تأكد ولسا ما انكسر.
     بالاتجاه الصاعد `refLow` هو **السوينغ الحامي** (آخر HL)، وبالهابط
     `refHigh` هو الحامي (آخر LH) — فكسرهم بالإغلاق هو الـMSS بالضبط. */
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
      /* بالاتجاه الهابط، refHigh هو الـLH الحامي — كسره = تغيّر اتجاه.
         غير هيك (صاعد أو ما في اتجاه بعد) = استمرار. */
      const type = trend === "down" ? "MSS" : "BOS";
      events.push(buildEvent(type, "up", refHigh.price, refHigh, i));
      trend = "up"; // بينقلب فوراً — ما في تعليق ولا انتظار تأكيد
      refHigh = null; // انكسر — بيستنى سوينغ خارجي جديد
      continue;
    }

    /* --- كسر هابط بالإغلاق --- */
    if (refLow && c.close < refLow.price) {
      /* بالاتجاه الصاعد، refLow هو الـHL الحامي — كسره = تغيّر اتجاه. */
      const type = trend === "up" ? "MSS" : "BOS";
      events.push(buildEvent(type, "down", refLow.price, refLow, i));
      trend = "down";
      refLow = null;
      continue;
    }
  }

  events.sort((a, b) => a.index - b.index);
  return { events, wickBreaks };
}
