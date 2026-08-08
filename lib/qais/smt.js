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

/* ============================================================================
   الأزواج المترابطة المعتمدة للـ SMT.

   ⚠️ قاعدة إلزامية: **ارتباط طردي فقط**.
   منطق الفحص تحت بيعتبر اختلاف اتجاه الحدث الهيكلي بين الأصلين = تباعد (SMT):
       diverged = eventA.direction !== eventB.direction
   فلو حطينا زوج مترابط **عكسياً** (مثلاً EURUSD ↔ USDCHF)، اختلاف الاتجاه
   بينهم هو الوضع الطبيعي — فرح يطلع SMT كاذب كل الوقت. لهيك كل الأزواج تحت
   بتتحرك بنفس الاتجاه ببعضها.

   ⚠️ الترتيب مهم: getCorrelatedSymbol بترجع **أول** تطابق، فالشريك الأساسي
   لكل رمز لازم يجي أول مرة يُذكر فيها الرمز.

   كل الرموز تحت موجودة فعلياً بـ lib/assets.js (ماعدا XAUEUR اللي إلها
   YAHOO_OVERRIDE بالعميل والكرون معاً).
   ============================================================================ */
export const CORRELATED_PAIRS = [
  /* --- المعادن --- */
  /* الذهب ↔ الفضة أولاً: XAUEUR مش أصل بالمنصة (إله override ليوهو بس)،
     وعملياً XAUEUR=X ما بيرجّع شموع — فكان الذهب يطلّع "لا توجد بيانات
     أصل مترابط" وما تطلع عليه ولا إشارة بعد ما صار SMT إلزامي.
     الفضة أصل حقيقي ببيانات شغّالة، وهي الزوج الكلاسيكي للذهب أصلاً. */
  ["XAUUSD", "XAGUSD"], // ذهب ↔ فضة
  ["XAUEUR", "XAUUSD"], // محفوظ للتوافق مع توثيق RADAR (الفصل ٥)
  ["XPTUSD", "XPDUSD"], // بلاتين ↔ بلاديوم — معادن صناعية بنفس دورة الطلب
  ["COPPER", "XPTUSD"], // نحاس ↔ بلاتين — معدنين صناعيين بيتبعوا نفس دورة النمو

  /* --- المؤشرات الأمريكية (الثلاثي الكلاسيكي بمنهجية ICT) --- */
  ["US30", "SPX500"], // داو ↔ S&P — نص توثيق RADAR (الفصل ٥)
  ["NAS100", "SPX500"], // ناسداك ↔ S&P (SPX500 نفسه بيتطابق مع US30 أعلاه)

  /* --- الفوركس: عملات مقابل الدولار (الدولار بالمقام) --- */
  ["GBPUSD", "EURUSD"], // إسترليني ↔ يورو — نص توثيق RADAR (الفصل ٥)
  ["AUDUSD", "NZDUSD"], // أسترالي ↔ نيوزيلندي — من أقوى الارتباطات الطردية بالفوركس

  /* --- الفوركس: الدولار بالبسط (USD/xxx) — بيتحركوا مع بعض بقوة الدولار --- */
  ["USDCHF", "USDJPY"], // فرنك ↔ ين، الاثنين مقابل الدولار بنفس الاتجاه
  ["USDCAD", "USDCHF"], // كندي ↔ فرنك (ارتباط أضعف، بس بنفس المنطق)

  /* --- كروسات الين --- */
  ["EURJPY", "GBPJPY"], // كلاهما ين مقابل عملة أوروبية — بيتحركوا سوا
  ["EURGBP", "EURJPY"], // كروسين اليورو بالبسط — قوة اليورو بترفع الاثنين

  /* --- الكريبتو --- */
  ["BTCUSD", "ETHUSD"], // بتكوين ↔ إيثيريوم — قائد السوق ومتبوعه
  ["SOLUSD", "ETHUSD"], // سولانا ↔ إيثيريوم (ألتكوينات بنفس دورة المخاطرة)
  ["XRPUSD", "BTCUSD"],
  ["BNBUSD", "BTCUSD"],
  ["DOGEUSD", "BTCUSD"],

  /* --- أسهم التكنولوجيا الكبرى --- */
  ["AAPL", "MSFT"], // أبل ↔ مايكروسوفت
  ["AMZN", "NAS100"], // أمازون ↔ ناسداك (السهم مقابل مؤشره)
  ["TSLA", "NAS100"], // تسلا ↔ ناسداك
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
