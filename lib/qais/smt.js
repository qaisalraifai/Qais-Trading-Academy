/* ============================================================================
   lib/qais/smt.js
   الـ SMT (Smart Money Technique) — الفصل الرابع من توثيق QAIS SK Engine v1.0

   4.1 الأزواج المترابطة المعتمدة افتراضياً (قابلة للتوسعة):
       XAUUSD <-> XAUEUR | US100 <-> SP500 | GBPUSD <-> EURUSD

   4.2 شرط الصلاحية: أصل ما بيكسر قاعه/قمته الرئيسية بينما الأصل المترابط
   يكسر قاعه/قمته بنفس التوقيت تقريباً => SMT إيجابي لصالح الأصل اللي لم يكسر.
   الحد الأدنى المفضّل للفريم: M15. كل ما ارتفع الفريم، كانت الإشارة أقوى.

   ملاحظة v1: هاد فحص مبسّط (best-effort) يعتمد على مقارنة MSS/BOS الأخيرة
   لكل أصل من الاثنين على نفس الفريم — مش بديل كامل عن تحليل بصري دقيق.
   ============================================================================ */

export const CORRELATED_PAIRS = [
  ["XAUUSD", "XAUEUR"], // Gold/USD ↔ Gold/EUR — مثال حرفي بتوثيق RADAR الجديد (الفصل ٥)
  ["US30", "SPX500"], // US30 ↔ SP500 — مثال حرفي بتوثيق RADAR الجديد (الفصل ٥)
  ["NAS100", "SPX500"], // إضافة مفيدة عملياً (نفس فكرة US100↔SP500 بالتوثيق القديم)
  ["GBPUSD", "EURUSD"], // EUR/USD ↔ GBP/USD — مثال حرفي بتوثيق RADAR الجديد (الفصل ٥)
];

export function getCorrelatedSymbol(symbol) {
  for (const [a, b] of CORRELATED_PAIRS) {
    if (a === symbol) return b;
    if (b === symbol) return a;
  }
  return null;
}

/* structResultA لأصلنا الأساسي، structResultB للأصل المترابط — نفس الفريم لكليهما */
export function analyzeSMT(symbolA, structResultA, symbolB, structResultB, { timeframe } = {}) {
  if (!structResultA?.lastMSS && !structResultA?.lastBOS) {
    return { valid: false, reason: "لا يوجد حدث هيكلي حديث على الأصل الأساسي للمقارنة" };
  }
  const eventA = structResultA.lastMSS || structResultA.lastBOS;
  const eventB = structResultB?.lastMSS || structResultB?.lastBOS;

  if (!eventB) {
    return { valid: false, reason: "لا يوجد حدث هيكلي مقابل على الأصل المترابط" };
  }

  // بنفحص هل الأحداث قريبة زمنياً (نفس التوقيت تقريباً — v1: ضمن 10 شموع من بعض)
  const closeInTime = Math.abs(eventA.index - eventB.index) <= 10;
  if (!closeInTime) {
    return { valid: false, reason: "الحدثان الهيكليان مش متزامنين تقريباً بين الأصلين" };
  }

  // تباعد الاتجاه = SMT: أصل كسر بجهة، والتاني ما كسرش (أو كسر بالجهة المعاكسة)
  const diverged = eventA.direction !== eventB.direction;
  if (!diverged) {
    return { valid: false, reason: "الأصلان تحركا بنفس الاتجاه — لا يوجد تباعد (لا SMT)" };
  }

  const weak = timeframe && ["1m", "5m"].includes(timeframe);

  // نقطة الـ SMT الفعلية (سادس عشر): السوينغ (قاع/قمة) اللي حصل عندها التباعد —
  // هاي هي النقطة اللي بيُبنى عليها الـ Stop Loss (أسفلها في Bullish، فوقها في Bearish)
  const point = eventA.swingC ? eventA.swingC.price : eventA.level;
  const pointType = eventA.direction === "up" ? "low" : "high"; // Bullish => SL أسفل قاع الـ SMT

  return {
    valid: true,
    favors: symbolA, // الأصل اللي "لم يكسر" (أو كسر بجهة مغايرة) هو المفضّل عادة — القرار النهائي بمحرك القرار
    symbolB,
    eventA,
    eventB,
    point,
    pointType,
    strength: weak ? "ضعيف (فريم أقل من M15)" : "معتبر", // سابعاً: يُفضَّل M15 فأعلى
    timeframe: timeframe || null,
  };
}
