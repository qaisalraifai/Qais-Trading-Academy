/* ============================================================================
   lib/qais/liquidity-v2/time-spans.js
   حدود اليوم والأسبوع والجلسة — **مقيسة من البيانات، مش مفترَضة**.

   الغلط اللي هالملف موجود عشانه:
   ---------------------------------------------------------------------------
   الطريقة البديهية لتجميع الشموع بأيام هي `floor(time / 86400)` — أي القسمة
   على اليوم بافتراض إنه اليوم بيبدأ 00:00 UTC. هاد **غلط على أغلب الرموز**:
   العقود المستقبلية والفوركس بتفتح مساءً بتوقيت UTC.

   القياس على بيانات حقيقية (NAS100 H4 من Dukascopy، ٨٢١ شمعة، فبراير→أغسطس
   ٢٠٢٦): كل ٢٦ فجوة نهاية أسبوع بالعيّنة بتبدأ الساعة **20:00 UTC** — بلا
   استثناء واحد. يعني اليوم التداولي بيمتد 20:00 → 20:00، فالتجميع بـ86400
   بيقصّ كل يوم بنصّه وبيخلط قمة اليوم بقمة اللي قبله.

   لهيك هون ثلاث طرق، بترتيب الثقة:
     ١) شموع يومية ممرَّرة → المدى الحقيقي لكل شمعة يومية. ما في استنتاج.
     ٢) استنتاج ساعة الافتتاح من فجوات نهاية الأسبوع (مقيس، مع دليله)، ثم
        **فحص** الاستنتاج على كل الأيام قبل ما ينتعمد.
     ٣) ولا وحدة نجحت → INSUFFICIENT_DATA بسبب مكتوب. ما منخمّن.

   حدود الأسبوع ما بتحتاج استنتاج إطلاقاً: الفجوة نفسها هي الحد.
   ============================================================================ */

import { getMarketSession } from "../session.js";
import { insufficient, isInsufficient, toMs } from "./pool.js";

/** المسافة الزمنية النموذجية بين شمعتين (وسيط، عشان الفجوات ما تجرّه). */
export function detectBarSpacing(candles) {
  if (!Array.isArray(candles) || candles.length < 3) {
    return insufficient(`عدد الشموع (${candles?.length ?? 0}) ما بيكفي لقياس المسافة الزمنية`);
  }
  const diffs = [];
  for (let i = 1; i < candles.length; i++) {
    const a = toMs(candles[i - 1].time);
    const b = toMs(candles[i].time);
    if (a == null || b == null || b <= a) continue;
    diffs.push((b - a) / 1000);
  }
  if (!diffs.length) return insufficient("أختام زمنية غير صالحة أو غير تصاعدية");
  diffs.sort((a, b) => a - b);
  const median = diffs[Math.floor(diffs.length / 2)];
  return { seconds: median, samples: diffs.length };
}

/**
 * حدود الأسابيع = فهارس الشموع اللي قبلها فجوة أكبر بكتير من المسافة العادية.
 * هاد **مقيس مباشرةً**: عطلة السوق بتترك أثر بالبيانات، ما بتحتاج تقويم.
 */
export function detectWeekStarts(candles, spacingSeconds, gapMult = 1.5) {
  const starts = [0];
  const gaps = [];
  for (let i = 1; i < candles.length; i++) {
    const a = toMs(candles[i - 1].time);
    const b = toMs(candles[i].time);
    if (a == null || b == null) continue;
    const gap = (b - a) / 1000;
    if (gap > spacingSeconds * gapMult) {
      starts.push(i);
      gaps.push({ index: i, gapSeconds: gap, utcHour: new Date(b).getUTCHours() });
    }
  }
  return { starts, gaps };
}

/**
 * ساعة افتتاح اليوم التداولي، مستنتجة من ساعة أول شمعة بعد كل فجوة.
 * بترجّع الساعة **مع دليلها** (نسبة الاتفاق) — أو INSUFFICIENT_DATA لو
 * الفجوات قليلة أو مش متفقة.
 */
export function inferDayOpenHour(candles, gaps, { minGaps = 2, minAgreement = 0.8 } = {}) {
  if (!gaps.length) {
    return insufficient("ما في ولا فجوة نهاية أسبوع بالعيّنة — ساعة افتتاح اليوم غير قابلة للقياس");
  }
  if (gaps.length < minGaps) {
    return insufficient(`عدد فجوات نهاية الأسبوع (${gaps.length}) أقل من ${minGaps} — دليل غير كافٍ لتثبيت ساعة الافتتاح`);
  }
  const hist = new Map();
  for (const g of gaps) hist.set(g.utcHour, (hist.get(g.utcHour) || 0) + 1);
  let best = null;
  for (const [hour, count] of hist) {
    if (!best || count > best.count || (count === best.count && hour < best.hour)) best = { hour, count };
  }
  const agreement = best.count / gaps.length;
  if (agreement < minAgreement) {
    return insufficient(
      `ساعات ما بعد الفجوات مش متفقة (${best.count}/${gaps.length} على الساعة ${best.hour}) — غالباً تغيّر توقيت صيفي بالعيّنة`
    );
  }
  return {
    hour: best.hour,
    agreement: +agreement.toFixed(3),
    gapsSeen: gaps.length,
    histogram: Object.fromEntries([...hist.entries()].sort((a, b) => a[0] - b[0])),
  };
}

function spanFrom(candles, startIndex, endIndex, key) {
  let high = -Infinity;
  let low = Infinity;
  for (let i = startIndex; i <= endIndex; i++) {
    if (candles[i].high > high) high = candles[i].high;
    if (candles[i].low < low) low = candles[i].low;
  }
  return {
    key,
    startIndex,
    endIndex,
    startTime: candles[startIndex].time,
    endTime: candles[endIndex].time,
    high,
    low,
    barCount: endIndex - startIndex + 1,
    partial: false,
  };
}

/**
 * تقسيم الشموع لأيام تداولية باستخدام ساعة افتتاح **مقيسة**، ثم **فحص**
 * القسمة: لو أغلب الأيام ما بتبدأ عند تلك الساعة يعني الاستنتاج فشل
 * (توقيت صيفي مثلاً) — وقتها بنرجّع INSUFFICIENT_DATA بدل ما نمشي بقسمة غلط.
 */
export function buildDaySpansFromOpenHour(candles, openHour, { minValidation = 0.9 } = {}) {
  const offset = openHour * 3600;
  const spans = [];
  let start = 0;
  let curKey = null;

  const keyOf = (i) => {
    const ms = toMs(candles[i].time);
    return Math.floor((ms / 1000 - offset) / 86400);
  };

  for (let i = 0; i < candles.length; i++) {
    const k = keyOf(i);
    if (curKey === null) {
      curKey = k;
      start = i;
      continue;
    }
    if (k !== curKey) {
      spans.push(spanFrom(candles, start, i - 1, curKey));
      curKey = k;
      start = i;
    }
  }
  if (curKey !== null) spans.push(spanFrom(candles, start, candles.length - 1, curKey));

  /* الفحص: كم يوم فعلاً بيبدأ عند الساعة المستنتَجة. أول يوم مستثنى — البيانات
     ممكن تبدأ بنص يوم. */
  let checked = 0;
  let matched = 0;
  for (let s = 1; s < spans.length; s++) {
    checked++;
    if (new Date(toMs(candles[spans[s].startIndex].time)).getUTCHours() === openHour) matched++;
  }
  const ratio = checked ? matched / checked : 0;
  if (checked === 0) {
    return insufficient("ما طلع غير يوم واحد — ما بيكفي لفحص القسمة");
  }
  if (ratio < minValidation) {
    return insufficient(
      `القسمة على الساعة ${openHour} فشلت الفحص: ${matched}/${checked} يوم بس بيبدأ عندها — الساعة المستنتَجة مش ثابتة عبر العيّنة`
    );
  }

  markPartials(spans);
  return { spans, source: "inferred_open_hour", openHour, validation: { checked, matched, ratio: +ratio.toFixed(3) } };
}

/**
 * تقسيم بشموع الفريم الأكبر: كل شمعة كبيرة بتعرّف مداها الزمني، والشموع
 * الصغيرة بتنحط جوّا المدى اللي بيحتويها فعلاً.
 * هاي الطريقة الوحيدة اللي ما فيها ولا افتراض تقويمي.
 */
export function buildSpansFromHigherCandles(candles, higher, options = {}) {
  const { baseSpacingSeconds = null, minRatio = 2 } = options;
  if (!Array.isArray(higher) || higher.length < 2) {
    return insufficient(`عدد شموع الفريم الأكبر (${higher?.length ?? 0}) أقل من ٢ — ما بيعرّف ولا مدى مغلق`);
  }

  /* حارس: «شموع الفريم الأكبر» لازم تكون فعلاً أكبر.
     صار فعلياً وقت القياس: طلب `interval=1d` من `/api/replay-candles` رجّع
     خطأ «فريم غير مدعوم عند Dukascopy» فتراجع ليوهو، ويوهو خدم شموع **١٥
     دقيقة**. المحرك قبلها كـ«شموع يومية» وبنى منها ٢٦ «يوم» — أرقام شكلها
     سليم ومعناها صفر. من غير هالفحص العيب بيوصل للمخرج بصمت. */
  const higherSpacing = detectBarSpacing(higher);
  if (isInsufficient(higherSpacing)) {
    return insufficient(`المسافة الزمنية لشموع الفريم الأكبر غير قابلة للقياس: ${higherSpacing.why}`);
  }
  if (baseSpacingSeconds != null && higherSpacing.seconds < baseSpacingSeconds * minRatio) {
    return insufficient(
      `شموع «الفريم الأكبر» مسافتها ${higherSpacing.seconds / 3600} ساعة مقابل ${baseSpacingSeconds / 3600} ساعة للفريم الأساسي — ` +
        `مش أكبر بـ${minRatio}× على الأقل. غالباً المزوّد رجّع فريم غير المطلوب.`
    );
  }

  const spans = [];
  let contained = 0;
  let checked = 0;
  for (let h = 0; h < higher.length; h++) {
    const from = toMs(higher[h].time);
    const to = h + 1 < higher.length ? toMs(higher[h + 1].time) : Infinity;
    let startIndex = -1;
    let endIndex = -1;
    for (let i = 0; i < candles.length; i++) {
      const t = toMs(candles[i].time);
      if (t >= from && t < to) {
        if (startIndex < 0) startIndex = i;
        endIndex = i;
      }
    }
    if (startIndex < 0) continue;
    /* المدى بيتاخد من الشمعة الكبيرة نفسها مش من تجميع الصغيرة: لو المزوّد
       بيخدم عقدين مختلفين للفريمين (عيب معروف على الذهب) لازم التناقض يبان
       بدل ما ينطمس بتجميع محلي.

       وعشان يبان: بنقيس الاحتواء — هل الشمعة الكبيرة فعلاً بتحوي شموعها
       الصغيرة؟ الرقم بينرجع مع المدَيات، فلو المزوّد متناقض بيبان بالمخرج
       بدل ما يمرق كمستوى «قمة أمس» من عقد تاني. */
    let aggHigh = -Infinity;
    let aggLow = Infinity;
    for (let i = startIndex; i <= endIndex; i++) {
      if (candles[i].high > aggHigh) aggHigh = candles[i].high;
      if (candles[i].low < aggLow) aggLow = candles[i].low;
    }
    const tol = Math.max(1e-9, Math.abs(higher[h].high) * 2e-5);
    const contains = higher[h].high >= aggHigh - tol && higher[h].low <= aggLow + tol;
    if (contains) contained++;
    checked++;

    spans.push({
      key: higher[h].time,
      startIndex,
      endIndex,
      startTime: candles[startIndex].time,
      endTime: candles[endIndex].time,
      high: higher[h].high,
      low: higher[h].low,
      barCount: endIndex - startIndex + 1,
      partial: false,
      contains,
    });
  }
  if (!spans.length) return insufficient("ما في ولا شمعة صغيرة جوّا مدى شمعة كبيرة — الفريمان مش متطابقين زمنياً");
  markPartials(spans);
  return {
    spans,
    source: "higher_timeframe_candles",
    higherSpacingSeconds: higherSpacing.seconds,
    containment: checked ? { checked, contained, ratio: +(contained / checked).toFixed(4) } : insufficient("ما في مدى فيه شموع صغيرة كفاية لفحص الاحتواء"),
  };
}

/** تقسيم بالأسابيع من فجوات السوق المقيسة مباشرة. */
export function buildWeekSpans(candles, weekStarts) {
  if (weekStarts.length < 2) {
    return insufficient(`عدد بدايات الأسابيع المقيسة (${weekStarts.length}) أقل من ٢ — ما في أسبوع مكتمل سابق`);
  }
  const spans = [];
  for (let w = 0; w < weekStarts.length; w++) {
    const start = weekStarts[w];
    const end = w + 1 < weekStarts.length ? weekStarts[w + 1] - 1 : candles.length - 1;
    if (end < start) continue;
    spans.push(spanFrom(candles, start, end, `w${w}`));
  }
  markPartials(spans);
  return { spans, source: "measured_market_gaps" };
}

/** منوال أطوال المدَيات ضمن قائمة (بيرجّع null لو القائمة فاضية). */
export function modalBarCount(spans) {
  if (!spans.length) return null;
  const counts = new Map();
  for (const s of spans) counts.set(s.barCount, (counts.get(s.barCount) || 0) + 1);
  let modal = null;
  for (const [bars, n] of counts) {
    if (!modal || n > modal.n || (n === modal.n && bars > modal.bars)) modal = { bars, n };
  }
  return modal.bars;
}

/**
 * توسيم المدى «الناقص» — **بمنوال المدَيات السابقة فقط**.
 *
 * ليش لازم أصلاً: بالبيانات الحقيقية شمعة الجمعة 20:00 بتقع لحالها بيوم
 * تداولي طوله شمعة وحدة (بعدها فجوة نهاية الأسبوع مباشرة). لو انحسبت
 * «يوم أمس» بيصير مرجع «قمة أمس» مدى ٤ ساعات — رقم بيبان سليم وهو غلط.
 *
 * ليش المنوال من السابق مش من كل العيّنة: المنوال على كل العيّنة بيقرا
 * أطوال أيام **لسا ما إجت**. صحيح إنه معلومة جدول مش معلومة سعر، بس القاعدة
 * بهالمشروع «ما في نظر للمستقبل» بلا استثناءات مريحة — والثمن هون تافه:
 * أول ٣ أيام بينتوسموا `partial = null` (غير معروف) وبينشالوا من المصادر
 * مع تسجيل السبب، بدل ما ينمرّروا بتقدير.
 */
function markPartials(spans, { minPriorSpans = 3 } = {}) {
  for (let i = 0; i < spans.length; i++) {
    const prior = spans.slice(0, i);
    if (prior.length < minPriorSpans) {
      spans[i].partial = null; // غير معروف — ما في سابق كافٍ للمقارنة
      spans[i].modalBars = null;
      continue;
    }
    const modal = modalBarCount(prior);
    spans[i].modalBars = modal;
    spans[i].partial = spans[i].barCount < Math.ceil(modal / 2);
  }
  return spans;
}

export const SESSION_LABELS = ["Sydney", "Tokyo", "London", "New York"];

/**
 * تقسيم الشموع لـ«حصص جلسات»: كل حصة = سلسلة شموع **متتالية** ناشطة بنفس
 * الجلسة (حسب lib/qais/session.js).
 *
 * ليش الاشتراط على التتابع: الجلسة بتعبر حدّ اليوم التداولي. مع افتتاح
 * 20:00، شمعة الـ20:00 ناشطة بجلسة نيويورك تبع اليوم **السابق**، وشموع
 * 12:00 و16:00 هي جلسة نيويورك تبع اليوم الحالي. تجميعهم كلهم كـ«جلسة
 * نيويورك لهاليوم» بيخلط ذروتين من يومين — فبينقسموا لحصتين متتاليتين.
 */
export function buildSessionRuns(candles, { minBars = 2 } = {}) {
  const open = new Map(); // label -> {startIndex, endIndex}
  const runs = [];
  const skipped = [];

  const closeRun = (label, run) => {
    if (run.endIndex - run.startIndex + 1 < minBars) {
      skipped.push({
        label,
        startIndex: run.startIndex,
        endIndex: run.endIndex,
        bars: run.endIndex - run.startIndex + 1,
        why: `حصة الجلسة فيها ${run.endIndex - run.startIndex + 1} شمعة فقط — أقل من ${minBars}، القمة/القاع منها مش تمثيلي`,
      });
      return;
    }
    let high = -Infinity;
    let low = Infinity;
    for (let i = run.startIndex; i <= run.endIndex; i++) {
      if (candles[i].high > high) high = candles[i].high;
      if (candles[i].low < low) low = candles[i].low;
    }
    runs.push({
      label,
      startIndex: run.startIndex,
      endIndex: run.endIndex,
      startTime: candles[run.startIndex].time,
      endTime: candles[run.endIndex].time,
      bars: run.endIndex - run.startIndex + 1,
      high,
      low,
    });
  };

  for (let i = 0; i < candles.length; i++) {
    const ms = toMs(candles[i].time);
    if (ms == null) continue;
    const active = new Set(getMarketSession(new Date(ms)).active);
    for (const label of SESSION_LABELS) {
      const cur = open.get(label);
      if (active.has(label)) {
        if (cur && cur.endIndex === i - 1) cur.endIndex = i;
        else {
          if (cur) closeRun(label, cur);
          open.set(label, { startIndex: i, endIndex: i });
        }
      } else if (cur) {
        closeRun(label, cur);
        open.delete(label);
      }
    }
  }
  /* الحصص اللي لسا مفتوحة بآخر البيانات ما بتنغلق — الجلسة ما خلصت، فقمتها
     لسا ممكن تتغيّر. إغلاقها هون بيكون اختراع نتيجة. */
  for (const [label, run] of open) {
    skipped.push({
      label,
      startIndex: run.startIndex,
      endIndex: run.endIndex,
      bars: run.endIndex - run.startIndex + 1,
      why: "الجلسة لسا مفتوحة بآخر البيانات — قمتها/قاعها لسا قابلين للتغيّر",
    });
  }

  runs.sort((a, b) => a.endIndex - b.endIndex || a.label.localeCompare(b.label));
  return { runs, skipped };
}

/**
 * نقطة الدخول: كل التقسيمات الزمنية بمرّة وحدة.
 * كل نتيجة إما مدى مقيس مع مصدره، أو INSUFFICIENT_DATA مع سببه.
 */
export function buildTimeSpans(candles, options = {}) {
  const { dailyCandles = null, weeklyCandles = null, sessionMinBars = 2, sessionsEnabled = true, maxSessionBarSeconds = 4 * 3600 } = options;

  const spacing = detectBarSpacing(candles);
  const spacingSeconds = spacing?.seconds ?? null;

  const week = spacingSeconds
    ? detectWeekStarts(candles, spacingSeconds)
    : { starts: [0], gaps: [] };

  /* ---- أيام ----

     تنبيه مقيس، مش نظري: «اليوم» إله تعريفان مختلفان بنفس الرمز ونفس المزوّد.
     على NAS100 من Dukascopy:
       • الشمعة اليومية تبع المزوّد مختومة 00:00 UTC، وبتطابق تجميع شموع H4
         بمدى [00:00, 00:00) بنسبة **١٠٠٪** (١٣٣ يوم مفحوص).
       • بينما اليوم **التداولي** المستنتَج من فجوات نهاية الأسبوع بيفتح
         20:00 UTC — ومطابقته للشمعة اليومية ٤٣.٦٪ بس.
     الاتنين صح لسؤالين مختلفين، وما في مرجع بشري بالمشروع بيحسم أي واحد
     تقصده المنهجية بـ«قمة أمس». لهيك المخرج بيصرّح `definition` صراحةً
     بدل ما يوهم إنهم نفس الشي.
  */
  let day;
  if (Array.isArray(dailyCandles) && dailyCandles.length >= 2) {
    day = buildSpansFromHigherCandles(candles, dailyCandles, { baseSpacingSeconds: spacingSeconds });
    if (day.spans) day.definition = "provider_daily_bar";
  } else if (spacingSeconds == null) {
    day = insufficient("المسافة الزمنية بين الشموع غير قابلة للقياس — ما بينبنى تقسيم يومي");
  } else {
    const openHour = inferDayOpenHour(candles, week.gaps);
    day = openHour.hour != null ? buildDaySpansFromOpenHour(candles, openHour.hour) : openHour;
    if (day.spans) {
      day.openHourEvidence = openHour;
      day.definition = "session_day_from_weekend_gaps";
    }
  }

  // ---- أسابيع ----
  let weekSpans;
  if (Array.isArray(weeklyCandles) && weeklyCandles.length >= 2) {
    weekSpans = buildSpansFromHigherCandles(candles, weeklyCandles, { baseSpacingSeconds: spacingSeconds });
    if (weekSpans.spans) weekSpans.definition = "provider_weekly_bar";
  } else {
    weekSpans = buildWeekSpans(candles, week.starts);
    if (weekSpans.spans) weekSpans.definition = "trading_week_from_measured_gaps";
  }

  // ---- جلسات ----
  let sessions;
  if (!sessionsEnabled) {
    sessions = insufficient("الجلسات مطفية بالإعدادات");
  } else if (spacingSeconds == null) {
    sessions = insufficient("المسافة الزمنية غير معروفة — ما بينحدد إذا الفريم يسمح بتحليل جلسات");
  } else if (spacingSeconds > maxSessionBarSeconds) {
    /* شمعة أطول من ٤ ساعات بتغطي جلسة كاملة أو أكتر، فـ«قمة الجلسة» بتصير
       نفس قمة الشمعة — مقياس بلا معنى. الرفض هون أصح من رقم شكله سليم. */
    sessions = insufficient(
      `طول الشمعة ${spacingSeconds / 3600} ساعة أكبر من ${maxSessionBarSeconds / 3600} — مستويات الجلسات غير قابلة للقياس على هالفريم`
    );
  } else {
    sessions = buildSessionRuns(candles, { minBars: sessionMinBars });
  }

  return { spacing, weekStarts: week.starts, weekGaps: week.gaps, day, week: weekSpans, sessions };
}
