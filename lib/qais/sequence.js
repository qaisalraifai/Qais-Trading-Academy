/* ============================================================================
   lib/qais/sequence.js
   السيكونز وحساب الأهداف — الفصل السادس من توثيق QAIS SK Engine v1.0

   A = القاع/القمة الأساسية اللي تبدأ منها الموجة
   B = أول قمة/قاع مقابل — نهاية الساق الأولى (AB)
   C = آخر قاع/قمة تصحيح قبل حدوث BOS (وليس بالضرورة عند 0.333 بالضبط — ده حد أدنى للتفعيل فقط)

   6.2 شرط التفعيل: التصحيح من B لازم يوصل 0.333 فيبوناتشي على الأقل من الساق AB.
   6.3 تأكيد BOS: كسر نقطة B بعد التصحيح = تفعيل مرحلة حساب الأهداف.
   6.4 الأهداف: امتدادات فيبوناتشي بنفس طول الساق AB، لكن مسقطة من نقطة C:
       TP1 = 1.000 (أخضر) | TP2 = 1.618 (أزرق) | TP3 = 1.809 (أزرق) | TP4 = 2.000 (أزرق)
   6.5 الإلغاء: كسر نقطة B بالاتجاه المعاكس (رجوع وكسر نقطة الـ BOS نفسها) = إلغاء كامل للسيكونز.
   ============================================================================ */

const TP_LEVELS = [
  { key: "TP1", ratio: 1.0, color: "أخضر" },
  { key: "TP2", ratio: 1.618, color: "أزرق" },
  { key: "TP3", ratio: 1.809, color: "أزرق" },
  { key: "TP4", ratio: 2.0, color: "أزرق" },
];

/* بتاخد آخر BOS من analyzeStructure (فيه A/B/C جاهزين) وترجع السيكونز + الأهداف إذا لسا صالحة */
export function analyzeSequence(candles, structureResult) {
  const { lastBOS } = structureResult;
  if (!lastBOS || !lastBOS.swingA || !lastBOS.swingB || !lastBOS.swingC) {
    return { active: false, reason: "لا يوجد BOS مؤكَّد بعد لبناء سيكونز عليه" };
  }

  const { swingA: A, swingB: B, swingC: C, direction } = lastBOS;
  const legLength = Math.abs(B.price - A.price);
  if (legLength <= 0) return { active: false, reason: "طول الساق AB غير صالح" };

  // 6.5: هل انكسرت نقطة B بالاتجاه المعاكس بعد تأكيد الـ BOS؟ (إلغاء كامل)
  const afterBos = candles.slice(lastBOS.index + 1);
  const invalidated =
    direction === "up" ? afterBos.some((c) => c.close < B.price) : afterBos.some((c) => c.close > B.price);

  if (invalidated) {
    return { active: false, reason: "انكسرت نقطة B بالاتجاه المعاكس — السيكونز أُلغيت بالكامل (6.5)" };
  }

  const targets = TP_LEVELS.map((t) => ({
    ...t,
    price: direction === "up" ? C.price + legLength * t.ratio : C.price - legLength * t.ratio,
  }));

  const lastPrice = candles[candles.length - 1].close;
  const hitTargets = targets.filter((t) =>
    direction === "up" ? lastPrice >= t.price : lastPrice <= t.price
  );

  return {
    active: true,
    direction,
    points: { A, B, C },
    legLength,
    targets,
    reachedCount: hitTargets.length,
    nextTarget: targets.find((t) => !hitTargets.includes(t)) || null,
  };
}

/* -------------------- أولوية مصدر الأهداف (خامس عشر) --------------------
   الأهداف لازم يكون إلها سبب تحليلي واضح، مش RR عشوائي. الأولوية حرفياً كما
   وردت بالتوثيق: Sequence على 4H، ثم Daily، ثم موجات الفريم التنفيذي نفسه
   (الأقرب فعلياً للسعر الحالي — تُستخدم كحد أدنى/fallback دايماً متوفر).
   sequencesByTF = { h4, daily, execution } — كل واحدة نتيجة analyzeSequence() أو null */
export function resolveSequence(sequencesByTF, priorityOrder = ["h4", "daily", "execution"]) {
  for (const tf of priorityOrder) {
    const seq = sequencesByTF[tf];
    if (seq?.active) return { ...seq, sourceTF: tf };
  }
  return { active: false, sourceTF: null, reason: "لا يوجد سيكونز فعّال على أي فريم من فريمات الأولوية" };
}
