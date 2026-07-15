/* ============================================================================
   lib/qais/orderblock.js
   محرك الـ Order Block (QAIS OB) — الفصل الثالث من توثيق QAIS SK Engine v1.0

   شرط الإنشاء (3.1): يُبحث عن OB فقط بعد وصول السعر لمنطقة سيولة (touchedZone
   من liquidity.js)، وبعد الوصول لازم تحصل حركة قوية (Displacement).
   وجود FVG داخل الحركة يرفع الجودة لكنه مش شرط إلزامي.

   المستويات الأربعة + MT (3.3):
     Level 1 = أعلى قمة الـ OB (شراء) — بشرط وجود FVG فوقها، وإلا يُتجاهل هذا المستوى
     Level 2 = سعر الافتتاح (Open) للشمعة/المجموعة المدمجة
     Level 3 = سعر الإغلاق (Close)
     Level 4 = أدنى سعر (شراء) / أعلى سعر (بيع) — كسره بإغلاق = إلغاء الـ OB بالكامل
     MT      = 50% بين Open وClose فقط (بدون الذيول) — أقوى مستوى (Main Fresh Hold)

   الحالة (3.2 جدول الحالات):
     Fresh   = لم يُلمس بعد إطلاقاً
     Active  = لُمس، والسعر لا يزال فوق/تحت MT (منطقة صحية)
     Weak    = أغلق السعر عكس MT — تنخفض نسبة النجاح
     Invalid = أغلق السعر عكس Level 4 — يُلغى بالكامل
   ============================================================================ */

import { isDisplacement } from "./structure.js";

/* آخر مجموعة شموع متتالية بعكس اتجاه الحركة القوية مباشرة قبلها (نفس منطق BRKR/MTG) */
function lastOppositeGroup(candles, beforeIndex, dirUp) {
  const group = [];
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const c = candles[i];
    const isOpposite = dirUp ? c.close < c.open : c.close > c.open;
    if (isOpposite) group.unshift(c);
    else break;
  }
  return group;
}

/* هل في FVG (من قائمة fvgs) يقع ضمن نطاق حركة الـ Displacement (من obIndex لـ moveIndex)؟ */
function hasFvgInMove(fvgs, fromIndex, toIndex, direction) {
  return fvgs.some((z) => z.direction === direction && z.index >= fromIndex && z.index <= toIndex + 1);
}

export function analyzeOrderBlock(candles, structureResult, liquidityResult) {
  const { touchedZone } = liquidityResult;
  if (!touchedZone) {
    return { eligible: false, reason: "لم يلمس السعر بعد أي منطقة من مناطق السيولة الست (شرط 3.1)" };
  }

  const touchIndex = touchedZone.index;
  const lastIndex = candles.length - 1;

  // نفتش عن أول حركة Displacement بعد نقطة اللمس
  let moveIndex = null;
  let dirUp = null;
  for (let i = touchIndex + 1; i <= lastIndex; i++) {
    if (isDisplacement(candles, i)) {
      dirUp = candles[i].close > candles[i].open;
      moveIndex = i;
      break;
    }
  }

  if (moveIndex == null) {
    return { eligible: false, reason: "لم تحصل حركة زخم (Displacement) بعد بعد لمس منطقة السيولة (شرط 3.1)" };
  }

  const group = lastOppositeGroup(candles, moveIndex, dirUp);
  if (group.length === 0) {
    return { eligible: false, reason: "لا توجد شمعة معاكسة واضحة تسبق حركة الـ Displacement" };
  }

  // دمج المجموعة كشمعة واحدة (3.2: إذا أكثر من شمعة، تُعامل كشمعة مدمجة واحدة)
  const merged = {
    open: group[0].open,
    close: group[group.length - 1].close,
    high: Math.max(...group.map((c) => c.high)),
    low: Math.min(...group.map((c) => c.low)),
  };

  const fvgs = liquidityResult.fvgs;
  const direction = dirUp ? "up" : "down";
  const fvgExists = hasFvgInMove(fvgs, moveIndex - 1, moveIndex + 2, direction);

  const level1 = fvgExists ? (dirUp ? merged.high : merged.low) : null;
  const level2 = merged.open;
  const level3 = merged.close;
  const level4 = dirUp ? merged.low : merged.high;
  const mt = (merged.open + merged.close) / 2;

  // حالة الـ OB بناءً على آخر سعر بالسلسلة
  const lastPrice = candles[lastIndex].close;
  let status;
  const touchedSinceCreation = dirUp
    ? candles.slice(moveIndex + 1).some((c) => c.low <= merged.high)
    : candles.slice(moveIndex + 1).some((c) => c.high >= merged.low);

  const invalid = dirUp ? lastPrice < level4 : lastPrice > level4;
  const weak = dirUp ? lastPrice < mt : lastPrice > mt;

  if (invalid) status = "Invalid";
  else if (!touchedSinceCreation) status = "Fresh";
  else if (weak) status = "Weak";
  else status = "Active";

  // جودة الـ OB (3.4) — تقييم مبسّط من 100 يُستخدم داخل QAIS Score لاحقاً
  let quality = 40; // أساس لوجود OB صالح
  if (fvgExists) quality += 30;
  if (isDisplacement(candles, moveIndex)) quality += 20;
  if (status === "Fresh" || status === "Active") quality += 10;
  quality = Math.min(100, quality);

  return {
    eligible: true,
    direction,
    status,
    quality,
    fvgExists,
    levels: { level1, level2, level3, level4, mt },
    merged,
    index: moveIndex,
    time: candles[moveIndex].time,
    candleCount: group.length,
    touchedZoneType: touchedZone.type,
  };
}
