/* ============================================================================
   lib/qais/structure/swings.js
   المقياسان: Internal Swings و Major Swings — الطبقة الأولى بمحرك الهيكل.

   ليش مقياسين:
   ---------------------------------------------------------------------------
   المحرك القديم كان بمقياس واحد (فراكتال ثابت lookback=2 لكل رمز وكل فريم).
   نتيجته إنه كل قمة صغيرة صارت «قمة هيكلية»، فطلعت أحداث كل بضع شموع
   والنقاط 0/A/B انحطّت على قمم داخلية بدل حدود الحركة الحقيقية.

   الحل مش رفع الرقم — رقم أكبر بيصير غلط بالاتجاه المعاكس (بيفوّت هيكل
   حقيقي على الفريمات السريعة). الحل مقياسان صريحان:

     Internal  = فراكتال صغير — كل بيفوت. هاد «الحركة الداخلية».
     Major     = بيفوتات ناجية من فلتر دلالة مبني على ATR — هاد «الهيكل
                 الخارجي» اللي بتتحدد منه HH/HL/LH/LL والاتجاه والأحداث.

   الفلتر بالـATR (مش نسبة مئوية ثابتة) لأنه هو الوحيد اللي بيتأقلم مع
   الرمز والفريم مع بعض: ٢٠٠ نقطة على ناسداك حركة عادية، وعلى اليورو/دولار
   انهيار.
   ============================================================================ */

import { atrSeries, atrAt } from "./atr.js";

/**
 * بيفوتات فراكتال: شمعة أعلى (أو أدنى) من lookback شمعة على كل جهة.
 *
 * المقارنة بالذيول (high/low) مش بالإغلاق — البيفوت مكان وصله السعر فعلياً.
 * (تمييز الذيل عن الإغلاق بيدخل عند **الكسر** لا عند البيفوت — شوف events.js)
 */
export function detectFractalPivots(candles, lookback = 2) {
  const out = [];
  if (!Array.isArray(candles) || candles.length < lookback * 2 + 1) return out;

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) isHigh = false;
      if (candles[j].low <= c.low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) out.push({ index: i, time: c.time, price: c.high, type: "high" });
    if (isLow) out.push({ index: i, time: c.time, price: c.low, type: "low" });
  }
  out.sort((a, b) => a.index - b.index || (a.type === "low" ? -1 : 1));
  return out;
}

/**
 * تناوب قمة/قاع/قمة/قاع مع الاحتفاظ بالأكثر تطرفاً عند التكرار.
 * سلسلة غير متناوبة ما بتنقرا كهيكل (ما في «تصحيح» بين قمتين متتاليتين).
 */
export function alternate(pivots) {
  const out = [];
  for (const p of pivots) {
    const last = out[out.length - 1];
    if (!last) {
      out.push(p);
      continue;
    }
    if (last.type === p.type) {
      const moreExtreme = p.type === "high" ? p.price > last.price : p.price < last.price;
      if (moreExtreme) out[out.length - 1] = p;
    } else {
      out.push(p);
    }
  }
  return out;
}

/**
 * الهيكل الخارجي: زجزاج بعتبة ATR فوق البيفوتات الداخلية.
 *
 * بيفوت بيصير Major لما تكون المسافة السعرية بينه وبين آخر Major معاكس
 * >= atrMult × ATR(عند البيفوت). لو نفس النوع وأكثر تطرفاً، بيستبدله
 * (الحركة لسا ماشية بنفس الاتجاه فالقمة الحقيقية هي الأبعد).
 *
 * `minLegBars` بيمنع «قمتين» بشمعة أو شمعتين من بعض تنعدّوا هيكل خارجي —
 * حالة الـoverlapping swings بمناطق التذبذب.
 */
export function buildMajorSwings(candles, internalSwings, options = {}) {
  const { atrPeriod = 14, atrMult = 1.5, minLegBars = 3, lookback = 2 } = options;
  const confirmed = [];
  if (!Array.isArray(internalSwings) || internalSwings.length === 0) {
    return Object.assign([], { provisional: null });
  }

  const atr = atrSeries(candles, atrPeriod);

  /* ============================================================================
     زجزاج **بتأكيد**: السوينغ بيضل مؤقّت (provisional) لحد ما يصير انعكاس
     معاكس بحجم العتبة — وقتها بينثبّت ولا بيتغيّر أبداً.

     ليش هيك ومش «أبعد نقطة لحد الآن»:
     ---------------------------------------------------------------------------
     التشغيل شمعة-بشمعة كشف مشكلتين حقيقيتين بالنسخة السابقة:
       • ٦ أحداث ظهرت ثم **اختفت** — لأن السوينغ اللي انكسر انستبدل لاحقاً
         بقمة أبعد، فالمستوى المكسور ما عاد موجود بالتشغيلة النهائية.
       • CHOCH بتأخير **١٩ شمعة** — لأن المستوى ما صار «خارجي» إلا بعد ما
         الحركة كبرت، فالكسر انكتشف بأثر رجعي.

     الاتنين نفس السبب: مجموعة السوينغات الخارجية كانت **قابلة للتعديل
     بأثر رجعي**. محرك هيكل بيسحب كلامه بعد ما يقوله ما بينفع للتداول.

     مع التثبيت: المستوى ما بينكسر إلا بعد ما يتأكد، فما في اكتشاف رجعي،
     وما في حدث بيختفي. الثمن المقبول: كسر مستوى ما تأكد بعد **مش حدث** —
     وهاد صحيح سببياً، ما بتقدر تتداول مستوى ما كان موجود وقتها.
     ============================================================================ */
  let provisional = null;

  const confirm = (swing, atIndex) => {
    confirmed.push({
      ...swing,
      /* أول سوينغ مثبّت ما إله ساق داخلة مقيسة — الانعكاس اللي بعده أكّده
         بس المسار اللي أوصله مش مفحوص. بينتوسم حتى ما يبان بنفس وزن غيره. */
      isAnchor: confirmed.length === 0,
      confirmedAtIndex: atIndex,
    });
  };

  for (const p of internalSwings) {
    if (!provisional) {
      provisional = p;
      continue;
    }

    if (provisional.type === p.type) {
      const moreExtreme = p.type === "high" ? p.price > provisional.price : p.price < provisional.price;
      if (moreExtreme) provisional = p; // الطرف لسا بيمتد — لسا مؤقّت
      continue;
    }

    /* بدون ATR ما في وحدة قياس للدلالة — فما منأكد. كان الكود يحط عتبة
       صفر (`?? 0`) لما ATR ناقص، يعني **كل** بيفوت بيصير سوينغ خارجي
       بمنطقة الإحماء. التصريح بعدم القدرة أصح من عتبة تقبل كل شي. */
    const atrHere = atrAt(atr, p.index);
    if (!Number.isFinite(atrHere) || atrHere <= 0) continue;

    const threshold = atrHere * atrMult;
    const legPrice = Math.abs(p.price - provisional.price);
    const legBars = p.index - provisional.index;

    if (legPrice >= threshold && legBars >= minLegBars) {
      /* الانعكاس أكّد المؤقّت. لحظة التأكيد = لحظة ما بينعرف البيفوت
         المعاكس فعلياً (p.index + lookback) — مش p.index، لأن البيفوت
         نفسه ما بينكشف إلا بعد lookback شمعة. */
      confirm(provisional, p.index + lookback);
      provisional = p;
    }
    // غير هيك: ضجيج داخلي — ما بيأكد ولا بيلغي المؤقّت
  }

  /* المؤقّت الأخير **ما بينضاف** للهيكل المؤكَّد — لسا ممكن يمتد.
     بينعرض على حدة لمين بده يعرف «الطرف الحالي». */
  return Object.assign(confirmed, { provisional });
}

/**
 * تسمية HH / HL / LH / LL بمقارنة كل سوينغ بآخر سوينغ **من نفس النوع**.
 * أول سوينغ من كل نوع ما إله تسمية (ما في مرجع) — بينحط null بدل تخمين.
 */
export function labelSwings(swings) {
  let prevHigh = null;
  let prevLow = null;

  return swings.map((s) => {
    let label = null;
    if (s.type === "high") {
      if (prevHigh) label = s.price > prevHigh.price ? "HH" : "LH";
      prevHigh = s;
    } else {
      if (prevLow) label = s.price < prevLow.price ? "LL" : "HL";
      prevLow = s;
    }
    return { ...s, label };
  });
}

/**
 * اتجاه الهيكل من آخر تسميتين مؤكدتين (قمة + قاع).
 * صاعد = HH مع HL. هابط = LL مع LH. أي خليط تاني = range.
 * بيرجّع سبب نصّي دايماً — ما في نتيجة بدون تفسير.
 */
export function trendFromLabels(labeled) {
  const lastHigh = [...labeled].reverse().find((s) => s.type === "high" && s.label);
  const lastLow = [...labeled].reverse().find((s) => s.type === "low" && s.label);

  if (!lastHigh || !lastLow) {
    return { trend: null, reason: "ما في قمة وقاع مسمّيتين بعد — بيانات غير كافية لتحديد الاتجاه" };
  }
  if (lastHigh.label === "HH" && lastLow.label === "HL") {
    return { trend: "up", reason: `قمة أعلى (${lastHigh.label}) مع قاع أعلى (${lastLow.label})` };
  }
  if (lastHigh.label === "LH" && lastLow.label === "LL") {
    return { trend: "down", reason: `قمة أدنى (${lastHigh.label}) مع قاع أدنى (${lastLow.label})` };
  }
  return { trend: "range", reason: `تسميات متعارضة (${lastHigh.label} / ${lastLow.label}) — تذبذب` };
}
