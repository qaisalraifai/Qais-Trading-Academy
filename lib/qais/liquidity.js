/* ============================================================================
   lib/qais/liquidity.js
   محرك مناطق السيولة — الفصل الثاني من توثيق QAIS SK Engine v1.0
   الأنواع الستة: FVG, Void, BRKR, MTG, RJB, Sweep

   القاعدة الأهم (2 - ملاحظة): النظام ما بيبدأ يبحث عن Order Block إلا بعد ما
   السعر يرجع ويلمس واحدة من هالمناطق الست. هاد الملف مسؤول بس عن اكتشاف
   المناطق نفسها + هل انلمست، والقرار (البحث عن OB) بصير بملف orderblock.js
   ============================================================================ */

/* -------------------- 2.1 FVG (Fair Value Gap) -------------------- */
/* فجوة سعرية بين شمعتين: عدم تداخل بين نطاق الشمعة الأولى والثالثة حول شمعة وسطى قوية */
export function findFVGs(candles) {
  const zones = [];
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];
    // FVG صاعد: قاع الشمعة الثالثة أعلى من قمة الشمعة الأولى
    if (c3.low > c1.high) {
      zones.push({ type: "FVG", direction: "up", from: c1.high, to: c3.low, index: i, time: candles[i - 1].time });
    }
    // FVG هابط: قمة الشمعة الثالثة أدنى من قاع الشمعة الأولى
    if (c3.high < c1.low) {
      zones.push({ type: "FVG", direction: "down", from: c3.high, to: c1.low, index: i, time: candles[i - 1].time });
    }
  }
  return zones;
}

/* -------------------- 2.2 Void -------------------- */
/* أوسع من FVG: يتشكّل من عدة فجوات متتالية/متجاورة تُدمج بمنطقة فراغ واحدة أكبر */
export function findVoids(candles, fvgs) {
  if (fvgs.length === 0) return [];
  const sorted = [...fvgs].sort((a, b) => a.index - b.index);
  const merged = [];
  let cur = null;

  for (const z of sorted) {
    if (!cur) {
      cur = { ...z, type: "Void", count: 1 };
      continue;
    }
    // فجوات متتالية (فرق شمعة أو شمعتين بينهم) بنفس الاتجاه ومتجاورة سعرياً => ندمجهم
    const adjacent = z.index - cur.index <= 3 && z.direction === cur.direction;
    const overlapping =
      z.direction === "up" ? z.from <= cur.to * 1.001 : z.from <= cur.to && z.to >= cur.from * 0.999;
    if (adjacent && overlapping) {
      cur.from = z.direction === "up" ? Math.min(cur.from, z.from) : Math.min(cur.from, z.from);
      cur.to = Math.max(cur.to, z.to);
      cur.index = z.index;
      cur.count += 1;
    } else {
      if (cur.count >= 2) merged.push(cur); // Void لازم أكثر من فجوة وحدة (وإلا هو FVG عادي)
      cur = { ...z, type: "Void", count: 1 };
    }
  }
  if (cur && cur.count >= 2) merged.push(cur);
  return merged;
}

/* -------------------- 2.6 Sweep -------------------- */
/* نزول تحت قاع رئيسي (أو صعود فوق قمة رئيسية) بذيل الشمعة فقط (بدون إغلاق) ثم ارتداد فوري */
export function findSweeps(candles, swings) {
  const sweeps = [];
  const majorSwings = swings.filter((s) => true); // كل السوينغات المعتمدة كمرشح "رئيسي"

  for (const sw of majorSwings) {
    // نبحث بعد نقطة السوينغ عن شمعة بتخترق بالذيل بدون إغلاق، وبعدها ارتداد مباشر
    for (let i = sw.index + 1; i < candles.length - 1; i++) {
      const c = candles[i];
      const next = candles[i + 1];
      if (sw.type === "low") {
        const wicked = c.low < sw.price && c.close >= sw.price;
        const rebounded = next.close > c.close;
        if (wicked && rebounded) {
          sweeps.push({ type: "Sweep", direction: "up", level: sw.price, index: i, time: c.time, wickLow: c.low });
          break;
        }
      } else {
        const wicked = c.high > sw.price && c.close <= sw.price;
        const rebounded = next.close < c.close;
        if (wicked && rebounded) {
          sweeps.push({ type: "Sweep", direction: "down", level: sw.price, index: i, time: c.time, wickHigh: c.high });
          break;
        }
      }
    }
  }
  return sweeps;
}

/* -------------------- 2.3 BRKR + 2.4 MTG -------------------- */
/* نفس منطق تحديد الشموع لـ BRKR وMTG — الفرق الوحيد إن BRKR بيشترط وجود BOS مصاحب،
   وMTG نفس الآلية بدون هالشرط. منبني الاثنين فوق أحداث الهيكلية (structure events). */
export function findBrkrAndMtg(candles, structureEvents) {
  const results = [];
  const bosEvents = structureEvents.filter((e) => e.type === "BOS");

  for (const bos of bosEvents) {
    const dirUp = bos.direction === "up";
    // نرجع للخلف من نقطة الكسر لنلاقي آخر حركة "هبوط داخل صعود" (أو العكس) قبل الـ BOS
    // الحالة 1: هبوط جديد (MSS داخلي) قبل الصعود اللي عمل BOS
    // الحالة 2: أول صعود مباشرة بعد آخر MSS هو نفسه الـ BRKR
    // v1: بناخد آخر سلسلة شموع متتالية بعكس اتجاه الـ BOS مباشرة قبل شمعة الكسر
    const oppositeCandles = [];
    for (let i = bos.index - 1; i >= 0; i--) {
      const c = candles[i];
      const isOpposite = dirUp ? c.close < c.open : c.close > c.open;
      if (isOpposite) oppositeCandles.unshift(candles[i]);
      else break;
    }
    if (oppositeCandles.length === 0) continue;

    const zoneHigh = Math.max(...oppositeCandles.map((c) => c.high));
    const zoneLow = Math.min(...oppositeCandles.map((c) => c.low));

    results.push({
      type: "BRKR",
      direction: bos.direction,
      from: zoneLow,
      to: zoneHigh,
      index: bos.index,
      time: bos.time,
      candleCount: oppositeCandles.length,
    });
  }

  // MTG: نفس الآلية بس بدون اشتراط BOS — منطبقها حول أي انعكاس شموع محلي (بدون تأكيد هيكلي)
  const swings = []; // placeholder — يُحسب فعلياً بـ engine.js اللي بيمرر سوينغات جاهزة عند الحاجة
  return results;
}

export function findMtg(candles, swings) {
  const results = [];
  for (let s = 1; s < swings.length; s++) {
    const sw = swings[s];
    const dirUp = sw.type === "low"; // ارتداد صاعد من قاع = MTG صاعد محتمل
    const startIdx = sw.index;
    // الشموع المعاكسة مباشرة قبل نقطة الارتداد
    const oppositeCandles = [];
    for (let i = startIdx; i >= 0; i--) {
      const c = candles[i];
      const isOpposite = dirUp ? c.close < c.open : c.close > c.open;
      if (isOpposite) oppositeCandles.unshift(candles[i]);
      else break;
    }
    if (oppositeCandles.length === 0) continue;
    results.push({
      type: "MTG",
      direction: dirUp ? "up" : "down",
      from: Math.min(...oppositeCandles.map((c) => c.low)),
      to: Math.max(...oppositeCandles.map((c) => c.high)),
      index: sw.index,
      time: sw.time,
      candleCount: oppositeCandles.length,
    });
  }
  return results;
}

/* -------------------- 2.5 RJB (Rejection) -------------------- */
/* رفض سعري قوي (ذيل طويل بعكس اتجاه الإغلاق) يتبعه حركة قوية بعكس اتجاه الرفض */
export function findRJB(candles, { wickRatio = 0.6 } = {}) {
  const zones = [];
  for (let i = 0; i < candles.length - 2; i++) {
    const c = candles[i];
    const range = c.high - c.low;
    if (range <= 0) continue;
    const body = Math.abs(c.close - c.open);
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    const rejectedDown = lowerWick / range >= wickRatio && body / range < 0.35;
    const rejectedUp = upperWick / range >= wickRatio && body / range < 0.35;

    if (rejectedDown) {
      const next2 = candles.slice(i + 1, i + 3);
      const strong = next2.every((n) => n.close > n.open) && next2.length === 2;
      if (strong) zones.push({ type: "RJB", direction: "up", level: c.low, index: i, time: c.time });
    }
    if (rejectedUp) {
      const next2 = candles.slice(i + 1, i + 3);
      const strong = next2.every((n) => n.close < n.open) && next2.length === 2;
      if (strong) zones.push({ type: "RJB", direction: "down", level: c.high, index: i, time: c.time });
    }
  }
  return zones;
}

/* -------------------- تجميع كل مناطق السيولة الستة + فحص اللمس -------------------- */
export function analyzeLiquidity(candles, structureResult) {
  const fvgs = findFVGs(candles);
  const voids = findVoids(candles, fvgs);
  const sweeps = findSweeps(candles, structureResult.swings);
  const brkr = findBrkrAndMtg(candles, structureResult.events);
  const mtg = findMtg(candles, structureResult.swings);
  const rjb = findRJB(candles);

  const allZones = [...fvgs, ...voids, ...sweeps, ...brkr, ...mtg, ...rjb].sort((a, b) => a.index - b.index);

  const lastPrice = candles[candles.length - 1]?.close;
  const lastIndex = candles.length - 1;

  // هل السعر الحالي لامس إحدى المناطق الست؟ (شرط أساسي قبل البحث عن OB — 2 ملاحظة)
  // مهم: بندور من الأحدث للأقدم (مش العكس) — لأنه ممكن يصادف سعر منطقة قديمة
  // جداً (من أسابيع) لسا ضمن نطاقها بالصدفة، وهاد كان يخلي الأداة تعتمد فرصة
  // قديمة ملغاة عملياً بدل آخر فرصة فعلية حصلت بالسوق.
  const touched = [...allZones].reverse().find((z) => {
    if (z.type === "Sweep" || z.type === "RJB") return z.index >= lastIndex - 5; // حدث حديث كفاية
    const lo = z.from ?? z.level;
    const hi = z.to ?? z.level;
    if (lo == null || hi == null) return false;
    return lastPrice >= Math.min(lo, hi) && lastPrice <= Math.max(lo, hi);
  });

  return { fvgs, voids, sweeps, brkr, mtg, rjb, allZones, touchedZone: touched || null };
}
