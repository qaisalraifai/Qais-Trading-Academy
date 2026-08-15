/* ============================================================================
   lib/qais/structure.js
   محرك الهيكلية (Market Structure) — الفصل الأول من توثيق QAIS SK Engine v1.0

   المدخل: candles = [{ time, open, high, low, close }, ...] مرتّبة تصاعدياً
   (نفس شكل بيانات lib/indicators.js تماماً — فريم واحد بكل استدعاء).

   المخرج: {
     swings,          // كل نقاط السوينغ المكتشفة (قمم/قيعان)
     events,          // تسلسل زمني كامل لكل BOS/MSS تم تأكيده
     trend,           // 'up' | 'down' | null (الاتجاه الحالي المعتمد بالنظام)
     lastBOS,         // آخر BOS مؤكَّد
     lastMSS,         // آخر MSS مؤكَّد
     protectedLevel,  // القاع/القمة المسؤول عن آخر BOS — كسره القادم = MSS
   }

   ملاحظات تنفيذية (v1):
   - كشف السوينغ بطريقة Fractal بسيطة (N شمعة قبل/بعد) — قياسي وسهل الاختبار.
   - شرط BOS (1.3): ما بيُعتمد كسر القمة/القاع فقط لكونه كسر، لازم يكون قبله
     تصحيح حقيقي وصل 0.333 فيبوناتشي على الأقل من الساق السابقة، وإلا الكسر
     ما بينعتبر BOS (بيبقى مجرد كسر سوينغ فرعي بدون قيمة هيكلية).
   - MSS (1.4): كسر بإغلاق جسم الشمعة للقاع/القمة المسؤول عن آخر BOS مؤكَّد.
     الزخم (Displacement) بيرفع قوة الإشارة لكنه مش شرط لتأكيدها.
   - الاتجاه المعتمد بالنظام (1.5) ما بيتغير إلا بعد اكتمال شرط الـ MSS كاملاً.
   ============================================================================ */

const FIB_MIN_RETRACEMENT = 0.333; // الحد الأدنى المعتمد لتفعيل الكسر كـ BOS (1.3)

/* -------------------- 1) كشف نقاط السوينغ (Fractals) -------------------- */
/* سوينغ قمة: شمعة أعلى من N شمعة قبلها وبعدها. سوينغ قاع: بالعكس.
   lookback أصغر = حساسية أعلى (سوينغات أكثر/أصغر)، أكبر = تصفية أقوى (Internal noise أقل) */
export function findSwings(candles, lookback = 2) {
  const swings = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) isHigh = false;
      if (candles[j].low <= c.low) isLow = false;
    }
    if (isHigh) swings.push({ index: i, time: c.time, price: c.high, type: "high" });
    if (isLow) swings.push({ index: i, time: c.time, price: c.low, type: "low" });
  }
  // لو شمعة وحدة طلعت قمة وقاع بنفس الوقت (نادر بس ممكن)، منفصلها بالترتيب الطبيعي
  swings.sort((a, b) => a.index - b.index);
  return swings;
}

/* بنفلتر السلسلة لتصير قمة/قاع/قمة/قاع بالتناوب (نحتفظ بالأكثر تطرفاً عند التكرار) —
   ده اللي بيمثل فعلياً "الهيكلية الخارجية" (External Structure) القابلة للقراءة */
function alternateSwings(swings) {
  const out = [];
  for (const s of swings) {
    const last = out[out.length - 1];
    if (!last) {
      out.push(s);
      continue;
    }
    if (last.type === s.type) {
      // نفس النوع متكرر: نحتفظ بالأقوى (أعلى قمة / أدنى قاع)
      if (s.type === "high" && s.price > last.price) out[out.length - 1] = s;
      if (s.type === "low" && s.price < last.price) out[out.length - 1] = s;
    } else {
      out.push(s);
    }
  }
  return out;
}

/* بناء حدث BOS كامل (نفس شكل الحدث الأصلي) من ثلاثية سوينغ + نقطة الكسر */
function buildBOSEvent(direction, s0, s1, s2, brk, candles) {
  const legRange = direction === "up" ? s1.price - s0.price : s0.price - s1.price;
  const retrace = direction === "up" ? s1.price - s2.price : s2.price - s1.price;
  return {
    type: "BOS",
    direction,
    time: brk.time,
    index: brk.index,
    level: s1.price,
    retracementRatio: legRange > 0 ? +(retrace / legRange).toFixed(3) : null,
    displacement: isDisplacement(candles, brk.index),
    // نقاط الموجة (6.1): A=s0, B=s1, C=s2 — تُستخدم مباشرة لحساب أهداف السيكونز
    swingA: s0,
    swingB: s1,
    swingC: s2,
  };
}

/* ============================================================================
   نقطة B الحقيقية = أقصى تصحيح فعلي بين A ولحظة كسر A.
   ----------------------------------------------------------------------------
   قاعدة SK: B هي "أدنى قاع تسبب بكسر النقطة A" (وبالهبوط: أعلى قمة).
   الكود القديم كان ياخد أول سوينغ بيحقق 0.333 حتى لو نزل السعر أنزل منه قبل
   ما يكسر A فعلياً — فنقطة انطلاق السيكونز (وبالتالي أهداف TP1..TP4 المحسوبة
   منها) كانت تطلع من مستوى غلط.

   منمسح الشموع من s2 لحد الشمعة اللي قبل الكسر مباشرة، ومناخد الأقصى الحقيقي.
   شمعة الكسر نفسها مستثناة — القاع اللي "تسبب" بالكسر لازم يسبقه.
   ============================================================================ */
function extremeBetween(candles, fromIndex, toIndex, type) {
  let best = null;
  const start = Math.max(0, fromIndex);
  const end = Math.min(candles.length - 1, toIndex);
  for (let i = start; i <= end; i++) {
    const c = candles[i];
    if (!c) continue;
    const price = type === "low" ? c.low : c.high;
    if (!Number.isFinite(price)) continue;
    const better = !best || (type === "low" ? price < best.price : price > best.price);
    if (better) best = { index: i, time: c.time, price, type };
  }
  return best;
}

/* هل الثلاثية (s0,s1,s2) تشكّل BOS صالح بالاتجاه المطلوب (شرط 0.333 + كسر إغلاق)؟
   requireBeyondLevel (اختياري): لازم s1 يتجاوزه سعرياً — بيُستخدم لفحص "الاستمرار"
   (BOS جديد بنفس الاتجاه لازم يكسر أبعد من آخر BOS سابق، مش أي تصحيح داخلي بسيط) */
function tryBOS(direction, s0, s1, s2, candles, requireBeyondLevel = null) {
  if (direction === "up") {
    if (!(s0.type === "low" && s1.type === "high" && s2.type === "low")) return null;
    if (requireBeyondLevel != null && s1.price <= requireBeyondLevel) return null;
    const legRange = s1.price - s0.price;
    const brk = findCloseBreak(candles, s2.index, s1.price, "above");
    if (!brk) return null;
    // B الفعلية = أدنى قاع بين s2 وشمعة الكسر (مش أول سوينغ بس)
    const b = extremeBetween(candles, s2.index, brk.index - 1, "low") || s2;
    const retrace = s1.price - b.price;
    const ratio = legRange > 0 ? retrace / legRange : -1;
    // ratio لازم يكون بين 0.333 و1 — لو تجاوز 1 يعني B كسرت تحت s0 بالكامل،
    // هاد مش تصحيح حقيقي (الساق الأصلية نفسها انكسرت، مش صالحة كنقطة انطلاق)
    if (!(ratio >= FIB_MIN_RETRACEMENT && ratio <= 1)) return null;
    return buildBOSEvent("up", s0, s1, b, brk, candles);
  }
  if (!(s0.type === "high" && s1.type === "low" && s2.type === "high")) return null;
  if (requireBeyondLevel != null && s1.price >= requireBeyondLevel) return null;
  const legRange = s0.price - s1.price;
  const brk = findCloseBreak(candles, s2.index, s1.price, "below");
  if (!brk) return null;
  // بالهبوط: B الفعلية = أعلى قمة بين s2 وشمعة الكسر
  const b = extremeBetween(candles, s2.index, brk.index - 1, "high") || s2;
  const retrace = b.price - s1.price;
  const ratio = legRange > 0 ? retrace / legRange : -1;
  if (!(ratio >= FIB_MIN_RETRACEMENT && ratio <= 1)) return null;
  return buildBOSEvent("down", s0, s1, b, brk, candles);
}

/* -------------------- 2) محرك BOS + MSS + الاتجاه --------------------
   مرور واحد تسلسلي (زمنياً) على كامل تاريخ السوينغات، بيتتبّع سلسلة
   BOS←MSS←BOS←MSS... كاملة، مش بس أول/آخر نمط رياضي بيحقق الشرط بمعزل عن
   التسلسل. هيك lastBOS/lastMSS دايماً بيمثّلوا الحالة الحاكمة *فعلياً* هلق
   (تماماً متل ما بيتتبعها متداول بعينه على الشارت) — مش أي BOS محلي/داخلي
   صغير صار يحقق شرط الـ 0.333 بمعزل عن الساق الكبيرة الحاكمة. */
export function analyzeStructure(candles, { lookback = 2 } = {}) {
  const rawSwings = findSwings(candles, lookback);
  const swings = alternateSwings(rawSwings);

  const events = [];
  let trend = null;
  let lastBOS = null;
  let lastMSS = null;
  let protectedLevel = null; // { price, type: 'low'|'high', index }

  /* ============================================================================
     بعد أي حدث مؤكَّد، المؤشر لازم يقفز لأول سوينغ عند/بعد **شمعة الكسر**.
     ----------------------------------------------------------------------------
     findCloseBreak بتدوّر للأمام بلا حد، فممكن يتأكد الكسر بعد مئات الشموع.
     وكان المؤشر يتقدّم خطوة/خطوتين بس — يعني كل السوينغات اللي بين الثلاثية
     وشمعة الكسر (وهي جوّا حركة التأكيد نفسها) بتنقرا من جديد كثلاثيات
     مستقلة، وكل وحدة بتولّد BOS/MSS على **نفس** الحركة.

     النتيجة كانت ٧٤٥ حدث على ٢٩٨٢ شمعة — ساق كل ٤ شموع — فالسيقان بتصير
     مجهرية والكتل بتتوزّع عليها بالقطّارة، والنقاط 0/A/B بتطلع من قمم صغيرة
     جوّا الاندفاع بدل حدوده الحقيقية.

     Math.max(..., current + 1) بيضمن التقدّم دايماً فما في حلقة لانهائية. */
  const advancePast = (breakIndex, current) => {
    const n = swings.findIndex((s) => s.index >= breakIndex);
    return n >= 0 ? Math.max(n, current + 1) : swings.length;
  };

  let i = 2;
  while (i < swings.length) {
    const s0 = swings[i - 2];
    const s1 = swings[i - 1];
    const s2 = swings[i];

    if (trend === null) {
      // -------- ما في اتجاه معتمد بعد: ندوّر على أول BOS (أي اتجاه) --------
      const bosUp = tryBOS("up", s0, s1, s2, candles);
      const bosDown = !bosUp ? tryBOS("down", s0, s1, s2, candles) : null;
      const found = bosUp || bosDown;
      if (found) {
        events.push(found);
        lastBOS = found;
        trend = found.direction;
        protectedLevel = { price: s2.price, type: found.direction === "up" ? "low" : "high", index: s2.index };
        i = advancePast(found.index, i);
        continue;
      }
      i++;
      continue;
    }

    // -------- في اتجاه معتمد: نفحص أيهما يصير أولاً زمنياً —
    // استمرار (BOS جديد بنفس الاتجاه، يكسر أبعد من آخر BOS) أو MSS (كسر
    // protectedLevel بعكس الاتجاه) --------
    const contEvent = tryBOS(trend, s0, s1, s2, candles, lastBOS.level);

    const mssDir = trend === "up" ? "below" : "above";
    const mssBrk = findCloseBreak(candles, protectedLevel.index, protectedLevel.price, mssDir);

    if (contEvent && (!mssBrk || contEvent.index <= mssBrk.index)) {
      // استمرار: بنحدّث lastBOS وprotectedLevel (تتبّع Trailing) ونكمل بنفس الاتجاه
      events.push(contEvent);
      lastBOS = contEvent;
      protectedLevel = { price: s2.price, type: trend === "up" ? "low" : "high", index: s2.index };
      i = advancePast(contEvent.index, i);
      continue;
    }

    if (mssBrk) {
      const event = {
        type: "MSS",
        direction: trend === "up" ? "down" : "up",
        time: mssBrk.time,
        index: mssBrk.index,
        level: protectedLevel.price,
        displacement: isDisplacement(candles, mssBrk.index),
        /* نقاط الموجة — الـMSS كان يطلع بدونها بينما BOS بيحملها، فأي كود
           بيقرا event.swingA/B/C (بناء الصفقة، حدود الساق) كان يلاقيها
           undefined على أحداث الـMSS ويرجع لافتراضات. */
        swingA: s0,
        swingB: s1,
        swingC: s2,
      };
      events.push(event);
      lastMSS = event;
      trend = null; // نرجع ندوّر على أول BOS تالي (بأي اتجاه) ابتداءً من نقطة الانعكاس
      /* منكمل من أول سوينغ عند/بعد شمعة كسر الـMSS. قبل هيك كان يرجع
         لـanchorIdx+2 (يعني i+2 تقريباً)، فالمنطقة بين نقطة الانعكاس وشمعة
         الكسر بتنقرا من جديد وبتولّد أحداث مكرّرة على نفس الحركة. */
      i = advancePast(mssBrk.index, i);
      protectedLevel = null;
      continue;
    }

    // ما في استمرار ولا MSS من هاي الثلاثية بالذات — منجرّب التالية (مش نوقف
    // التحليل كامل!). شرط توقف الحلقة الوحيد هو نفاذ السوينغات (شرط while).
    i++;
  }

  events.sort((a, b) => a.index - b.index);

  return { swings, events, trend, lastBOS, lastMSS, protectedLevel };
}

/*
 * كل الـ MSS المؤكَّدة عبر كامل التاريخ (من events، نتيجة المرور التسلسلي
 * الواحد بـ analyzeStructure أعلاه) — كل وحدة بتحدّد بداية "ساق" جديدة.
 * بنستخدمها لبناء "ذاكرة" OB عبر أكتر من MSS/ساق — مش بس الساق الفعّالة
 * الحالية — بالظبط متل السيناريو اللي السعر بيرجع فيه لـ OB قديم بعد ما صار
 * MSS وساق جديدة بالنص (أو أكتر من ساق).
 */
export function getAllMSSLegs(candles, structureResult) {
  const events = structureResult?.events || [];
  const mssEvents = events.filter((e) => e.type === "MSS").sort((a, b) => a.index - b.index);
  if (!mssEvents.length) return [];
  return mssEvents.map((mss, idx) => {
    /* بداية النافذة = سوينغ المنشأ (النقطة B) مش شمعة الكسر.
       ------------------------------------------------------------------
       `mss.index` هو **فهرس شمعة الكسر** (buildBOSEvent: index = brk.index).
       لما كانت النافذة تبلّش من هناك، ومسح الكتل بيبلّش من fromIndex+1،
       كانت شمعة الزخم اللي كسرت الهيكل تطلع بره كل النوافذ — والساق السابقة
       بتنتهي عند nextMSS.index-1 فبتستثنيها كمان. يعني الكتلة الأهم
       بالمنهجية كلها (الشموع المعاكسة اللي قبل شمعة الكسر مباشرة، اللي
       السعر بيرجعلها بعد الكسر) ما كانت تنكشف ولا مرة.

       swingC = القاع/القمة اللي سبقت الكسر — فبنبلّش من قبلها بشمعة حتى
       تدخل شمعة الكسر وكتلتها ضمن المسح. */
    const originIdx = Number.isFinite(mss.swingC?.index) ? mss.swingC.index : mss.index;
    const fromIndex = Math.max(0, Math.min(originIdx, mss.index) - 1);
    return {
      fromIndex,
      /* نهاية النافذة = شمعة كسر الـMSS التالي نفسها (مش قبلها بوحدة) —
         حتى ما تضيع كتلة الكسر بالفراغ بين ساقين. التداخل البسيط بين
         السيقان مضمون بإزالة التكرار بـ scanAllLegsOrderBlocks. */
      toIndex: idx + 1 < mssEvents.length ? mssEvents[idx + 1].index : candles.length - 1,
      direction: mss.direction,
      mssTime: mss.time,
    };
  });
}

/* -------------------- أقرب قمة/قاع فعلي كهدف أول (TP1 بديل) --------------------
   لما ما يكون في سيكونز جديدة متشكّلة بعد (مباشرة بعد MSS مثلاً) بس فيه دخول
   صالح من OB، أول هدف واقعي هو أقرب قمة/قاع فعلي تشكّل على الشارت بنفس
   اتجاه الصفقة (سيولة قريبة)، مش امتداد فيبوناتشي لسيكونز لسا ما تأكدت. */
export function nearestSwingTarget(swings, direction, fromPrice) {
  if (!Array.isArray(swings) || fromPrice == null) return null;
  const pivotType = direction === "up" ? "high" : "low";
  let nearest = null;
  let nearestDist = Infinity;
  for (const s of swings) {
    if (s.type !== pivotType) continue;
    const beyond = direction === "up" ? s.price > fromPrice : s.price < fromPrice;
    if (!beyond) continue;
    const dist = Math.abs(s.price - fromPrice);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = s;
    }
  }
  return nearest;
}

/* أول شمعة بعد fromIndex بتغلق فوق/تحت مستوى معيّن بجسم الشمعة (إغلاق، مش ذيل) */
function findCloseBreak(candles, fromIndex, level, direction) {
  for (let i = fromIndex + 1; i < candles.length; i++) {
    const c = candles[i];
    if (direction === "above" && c.close > level) return { index: i, time: c.time, price: c.close };
    if (direction === "below" && c.close < level) return { index: i, time: c.time, price: c.close };
  }
  return null;
}

/* زخم (Displacement): مدى الشمعة أكبر بوضوح من متوسط آخر 20 شمعة (>= 1.5x) */
export function isDisplacement(candles, index, period = 20, mult = 1.5) {
  const start = Math.max(0, index - period);
  const slice = candles.slice(start, index);
  if (slice.length < 5) return false;
  const avgRange = slice.reduce((s, c) => s + (c.high - c.low), 0) / slice.length;
  const range = candles[index].high - candles[index].low;
  return avgRange > 0 && range >= avgRange * mult;
}

/* -------------------- الحركة الهيكلية الرئيسية (خامساً + رابع عشر) --------------------
   نطاق استخراج POI/OB: الساق الجديدة الفعلية بعد تأكيد آخر MSS — من نقطة
   الانعكاس (MSS) للأمام لغاية آخر شمعة متوفرة (أو لغاية BOS تالٍ لو صار).
   هاد مطابق حرفياً لتوثيق RADAR: الـ OB بيتشكّل *جوا* الساق الجديدة نفسها
   (ممكن أكتر من OB جوا نفس الساق، زي استمرارية بعد بولباك داخلي)، مش بالساق
   التصحيحية اللي سبقت الـ MSS وأدت لتأكيده.
   - لو صار MSS: النطاق [lastMSS.index → آخر شمعة] (anchor: "MSS→forward").
   - لو ما صار MSS بعد (اتجاه مستمر بدون انعكاس): بنستخدم نفس الساق اللي
     ولّدت آخر BOS نفسه [swingA.index → lastBOS.index]، لأنه ما في نطاق
     "بعد الانعكاس" أصلاً بعد. */
export function getMainMoveWindow(structureResult, totalCandles) {
  const { lastBOS, lastMSS } = structureResult;
  if (!lastBOS) return null;

  if (lastMSS) {
    const lastIndex = Number.isFinite(totalCandles) ? totalCandles - 1 : lastMSS.index;
    return {
      fromIndex: lastMSS.index,
      toIndex: Math.max(lastMSS.index, lastIndex),
      anchor: "MSS→forward",
      direction: lastMSS.direction, // اتجاه الحركة الحالية بعد الانعكاس
    };
  }

  if (lastBOS.swingA) {
    return {
      fromIndex: lastBOS.swingA.index,
      toIndex: lastBOS.index,
      anchor: "BOS leg",
      direction: lastBOS.direction,
    };
  }
  return null;
}

/* Price Location (5.2): مكان السعر الحالي ضمن آخر موجة هيكلية معتمدة (فيبوناتشي) */
export function priceLocation(candles, structureResult) {
  const { lastBOS } = structureResult;
  if (!lastBOS) return null;
  // الساق المعتمدة: من المستوى المكسور (level) للنقطة الحالية (آخر سعر)
  const lastPrice = candles[candles.length - 1].close;
  const swingsUsed = structureResult.swings;
  // نلاقي آخر ساق فعلية (آخر سوينغين) لحساب الديسكاونت/بريميوم
  const last2 = swingsUsed.slice(-2);
  if (last2.length < 2) return null;
  const [a, b] = last2;
  const high = Math.max(a.price, b.price);
  const low = Math.min(a.price, b.price);
  const range = high - low;
  if (range <= 0) return null;
  const ratio = (high - lastPrice) / range; // 0 = عند القمة (Premium)، 1 = عند القاع (Discount)

  let zone;
  if (ratio <= 0.333) zone = "premium";
  else if (ratio >= 0.666) zone = "discount";
  else zone = "equilibrium";

  return { zone, ratio: +ratio.toFixed(3), high, low };
}
