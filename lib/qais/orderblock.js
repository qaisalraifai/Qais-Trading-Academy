/* ============================================================================
   lib/qais/orderblock.js
   محرك الـ Order Block (QAIS OB) — مطابق حرفياً لـ QAIS ORDER BLOCK RULES

   السلسلة الإلزامية (القاعدة الأساسية):
     Liquidity Area → Strong Displacement → FVG MUST EXIST → Last Consecutive
     Opposite Candles = QAIS Order Block
   وجود FVG داخل الحركة القوية شرط إلزامي (قاعدة 3 و6) — بدونه ما يُعتمد الـ OB
   إطلاقاً، بغض النظر عن قوة الحركة.

   المستويات الخمسة (قاعدة 5) — لـ Bullish OB:
     LEVEL 1 = FVG LEVEL   (أعلى قمة الـ OB، بما إنه FVG شرط أساسي)
     LEVEL 2 = OPEN        (افتتاح الشمعة/المجموعة المدمجة)
     LEVEL 3 = MT          (50% بين Open وClose فقط، بدون الذيول — أقوى مستوى)
     LEVEL 4 = CLOSE       (إغلاق الشمعة/المجموعة المدمجة)
     LEVEL 5 = OB LOW      (أدنى سعر — كسره بإغلاق = إلغاء الـ OB بالكامل)
   (بالعكس تماماً للـ Bearish OB: LEVEL 1 = أدنى قاع، LEVEL 5 = OB HIGH)

   الحالة (قاعدة 8):
     Fresh   = لم يُختبر الـ OB بعد
     Active  = لا يزال صالحًا والسعر يتعامل معه
     Weak    = أغلق السعر عكس MT (Level 3) لكن لم يكسر Level 5 — الجودة تقل
     Invalid = أغلق السعر عكس Level 5 — يُلغى بالكامل
   ============================================================================ */

import { isDisplacement } from "./structure.js";

/* آخر مجموعة شموع متتالية بعكس اتجاه الحركة القوية مباشرة قبلها (قاعدة 4) */
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

/* هل في FVG (من قائمة fvgs) يقع ضمن نطاق حركة الـ Displacement؟ (قاعدة 3) */
function hasFvgInMove(fvgs, fromIndex, toIndex, direction) {
  return fvgs.some((z) => z.direction === direction && z.index >= fromIndex && z.index <= toIndex + 1);
}

export function analyzeOrderBlock(candles, structureResult, liquidityResult) {
  const { touchedZone } = liquidityResult;
  if (!touchedZone) {
    return { eligible: false, reason: "لم يلمس السعر بعد أي منطقة من مناطق السيولة الست (قاعدة 1)" };
  }

  const touchIndex = touchedZone.index;
  const lastIndex = candles.length - 1;

  // نفتش عن أول حركة Displacement بعد نقطة اللمس (قاعدة 2)
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
    return { eligible: false, reason: "لم تحصل حركة زخم قوية (Displacement) بعد لمس منطقة السيولة (قاعدة 2)" };
  }

  // قاعدة 3: FVG داخل الحركة القوية شرط إلزامي — بدونه ما يُعتمد الـ OB إطلاقاً
  const fvgs = liquidityResult.fvgs;
  const direction = dirUp ? "up" : "down";
  const fvgExists = hasFvgInMove(fvgs, moveIndex - 1, moveIndex + 2, direction);
  if (!fvgExists) {
    return { eligible: false, reason: "حصلت حركة قوية بس بدون FVG — القاعدة 3/6 بتلغي اعتماد الـ OB بدون FVG" };
  }

  const group = lastOppositeGroup(candles, moveIndex, dirUp);
  if (group.length === 0) {
    return { eligible: false, reason: "لا توجد شمعة معاكسة واضحة تسبق حركة الـ Displacement (قاعدة 4)" };
  }

  // دمج المجموعة كشمعة واحدة (قاعدة 4: إذا أكثر من شمعة، تُعامل كشمعة مدمجة واحدة)
  const merged = {
    open: group[0].open,
    close: group[group.length - 1].close,
    high: Math.max(...group.map((c) => c.high)),
    low: Math.min(...group.map((c) => c.low)),
  };

  // المستويات الخمسة (قاعدة 5)
  const level1 = dirUp ? merged.high : merged.low; // FVG LEVEL — أقصى حافة الـ OB
  const level2 = merged.open; // OPEN
  const level3 = (merged.open + merged.close) / 2; // MT — 50% بين Open وClose فقط
  const level4 = merged.close; // CLOSE
  const level5 = dirUp ? merged.low : merged.high; // OB LOW/HIGH — حد الإبطال الكامل

  // حالة الـ OB بناءً على آخر سعر بالسلسلة (قاعدة 7 و8)
  const lastPrice = candles[lastIndex].close;
  let status;
  const touchedSinceCreation = dirUp
    ? candles.slice(moveIndex + 1).some((c) => c.low <= merged.high)
    : candles.slice(moveIndex + 1).some((c) => c.high >= merged.low);

  const invalid = dirUp ? lastPrice < level5 : lastPrice > level5; // كسر Level 5 = إلغاء كامل
  const weak = dirUp ? lastPrice < level3 : lastPrice > level3; // كسر MT (Level 3) بس = ضعف

  if (invalid) status = "Invalid";
  else if (!touchedSinceCreation) status = "Fresh";
  else if (weak) status = "Weak";
  else status = "Active";

  // جودة الـ OB — تقييم مبسّط من 100 يُستخدم داخل QAIS Score لاحقاً.
  // FVG صار مضمون الوجود دايماً (شرط إلزامي)، فالجودة الأساسية صارت أعلى.
  let quality = 60; // أساس: OB صالح + FVG موجود (إلزامي الآن)
  if (isDisplacement(candles, moveIndex)) quality += 20;
  if (status === "Fresh" || status === "Active") quality += 20;
  quality = Math.min(100, quality);

  return {
    eligible: true,
    direction,
    status,
    quality,
    fvgExists: true, // دايماً true — لأنه شرط إلزامي وصلنا هون فقط لما تحقق
    levels: { level1, level2, level3, level4, level5 },
    merged,
    index: moveIndex,
    time: candles[moveIndex].time,
    candleCount: group.length,
    touchedZoneType: touchedZone.type,
  };
}
