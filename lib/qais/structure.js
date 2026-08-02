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

/* -------------------- 2) محرك BOS + MSS + الاتجاه -------------------- */
export function analyzeStructure(candles, { lookback = 2 } = {}) {
  const rawSwings = findSwings(candles, lookback);
  const swings = alternateSwings(rawSwings);

  const events = [];
  let trend = null;
  let lastBOS = null;
  let lastMSS = null;
  let protectedLevel = null; // { price, type: 'low'|'high', index }

  // بنمشي على أزواج السوينغ المتتالية (leg = من سوينغ لسوينغ يلي بعده)
  // ونراقب هل تحقق شرط الـ 0.333 قبل أي كسر لاحق لقمة/قاع سابق.
  for (let i = 2; i < swings.length; i++) {
    const s0 = swings[i - 2];
    const s1 = swings[i - 1];
    const s2 = swings[i];

    // -------- احتمال BOS صاعد: s0=low -> s1=high (leg) -> s2=low (تصحيح) --------
    if (s0.type === "low" && s1.type === "high" && s2.type === "low") {
      const legRange = s1.price - s0.price;
      const retrace = s1.price - s2.price;
      const retracedEnough = legRange > 0 && retrace / legRange >= FIB_MIN_RETRACEMENT;

      if (retracedEnough) {
        // نفتش بعد s2 عن أول إغلاق شمعة يكسر s1.price للأعلى
        const brk = findCloseBreak(candles, s2.index, s1.price, "above");
        if (brk) {
          const displacement = isDisplacement(candles, brk.index);
          const event = {
            type: "BOS",
            direction: "up",
            time: brk.time,
            index: brk.index,
            level: s1.price,
            retracementRatio: +(retrace / legRange).toFixed(3),
            displacement,
            // نقاط الموجة (6.1): A=s0, B=s1, C=s2 — تُستخدم مباشرة لحساب أهداف السيكونز
            swingA: s0,
            swingB: s1,
            swingC: s2,
          };
          events.push(event);
          lastBOS = event;
          trend = "up"; // BOS الأول بيحدد اتجاه ابتدائي؛ تغيير الاتجاه اللاحق يشترط MSS فقط (1.5)
          protectedLevel = { price: s2.price, type: "low", index: s2.index };
        }
      }
    }

    // -------- احتمال BOS هابط: s0=high -> s1=low (leg) -> s2=high (تصحيح) --------
    if (s0.type === "high" && s1.type === "low" && s2.type === "high") {
      const legRange = s0.price - s1.price;
      const retrace = s2.price - s1.price;
      const retracedEnough = legRange > 0 && retrace / legRange >= FIB_MIN_RETRACEMENT;

      if (retracedEnough) {
        const brk = findCloseBreak(candles, s2.index, s1.price, "below");
        if (brk) {
          const displacement = isDisplacement(candles, brk.index);
          const event = {
            type: "BOS",
            direction: "down",
            time: brk.time,
            index: brk.index,
            level: s1.price,
            retracementRatio: +(retrace / legRange).toFixed(3),
            displacement,
            swingA: s0,
            swingB: s1,
            swingC: s2,
          };
          events.push(event);
          lastBOS = event;
          trend = "down";
          protectedLevel = { price: s2.price, type: "high", index: s2.index };
        }
      }
    }
  }

  // -------- MSS: كسر بإغلاق للمستوى المسؤول عن آخر BOS (1.4) --------
  // منفحص بعد كل BOS هل انكسر الـ protectedLevel تبعه لاحقاً بإغلاق شمعة
  if (lastBOS && protectedLevel) {
    const dir = protectedLevel.type === "low" ? "below" : "above";
    const brk = findCloseBreak(candles, protectedLevel.index, protectedLevel.price, dir);
    if (brk) {
      const displacement = isDisplacement(candles, brk.index);
      const event = {
        type: "MSS",
        direction: dir === "below" ? "down" : "up",
        time: brk.time,
        index: brk.index,
        level: protectedLevel.price,
        displacement,
      };
      events.push(event);
      lastMSS = event;
      trend = event.direction; // الاتجاه الرسمي ما بيتغير إلا هون (1.5)
    }
  }

  events.sort((a, b) => a.index - b.index);

  return { swings, events, trend, lastBOS, lastMSS, protectedLevel };
}

/*
 * analyzeStructure() بترجّع بس آخر MSS نسبةً لآخر BOS — مش تسلسل تاريخي.
 * هاي الدالة بتقسّم كامل تاريخ الشموع لسلسلة "سيقان" متتالية، كل وحدة
 * محدّدة بنقطة MSS البداية تبعها، عن طريق إعادة تشغيل analyzeStructure
 * على الجزء المتبقي من الشموع بعد كل MSS تم إيجاده لحد ما ننتهي من التاريخ.
 * هيك بنقدر نبني "ذاكرة" OB عبر أكتر من MSS/ساق — مش بس الساق الفعّالة الحالية —
 * بالظبط متل السيناريو اللي السعر بيرجع فيه لـ OB قديم بعد ما صار MSS وساق جديدة بالنص.
 */
export function getAllMSSLegs(candles, { lookback = 2, minCandles = 30 } = {}) {
  const legs = [];
  let offset = 0;
  let guard = 0; // حماية من أي حلقة لانهائية نظرياً
  while (offset < candles.length - minCandles && guard < 200) {
    guard++;
    const sub = candles.slice(offset);
    const result = analyzeStructure(sub, { lookback });
    if (!result.lastMSS) break;
    const mssIndexGlobal = offset + result.lastMSS.index;
    if (legs.length && mssIndexGlobal <= legs[legs.length - 1].fromIndex) break; // ماشي بمكانه، منوقف
    legs.push({
      fromIndex: mssIndexGlobal,
      direction: result.lastMSS.direction,
      mssTime: result.lastMSS.time,
    });
    offset = mssIndexGlobal + 1;
  }
  for (let i = 0; i < legs.length; i++) {
    legs[i].toIndex = i + 1 < legs.length ? legs[i + 1].fromIndex - 1 : candles.length - 1;
  }
  return legs; // [{ fromIndex, toIndex, direction, mssTime }, ...] بالترتيب الزمني
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
