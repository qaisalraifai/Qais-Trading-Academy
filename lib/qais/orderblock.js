/* ============================================================================
   lib/qais/orderblock.js
   محرك الـ Order Block (QAIS OB) — مطابق حرفياً لقواعد OB الخاصة (تاسعاً–ثالث عشر)

   السلسلة الإلزامية:
     العودة لمنطقة سيولة → حركة قوية وواضحة → FVG شرط أساسي (بدونه لا يُعتمد
     الـ OB إطلاقاً) → إغلاق فعلي (مش Wick) فوق/تحت آخر مجموعة شموع معاكسة
     متتالية = QAIS Order Block.

   المستويات الأربعة (حادي عشر) — لـ Bullish OB، من الأعلى للأدنى سعرياً:
     LEVEL 1 = FVG      (أعلى قمة الـ OB، بما إنه FVG شرط أساسي لتأكيده)
     LEVEL 2 = OPEN     (افتتاح الشمعة/المجموعة المدمجة)
     LEVEL 3 = CLOSE    (إغلاق الشمعة/المجموعة المدمجة)
     LEVEL 4 = MT       (50% بين Open وClose فقط، بدون الذيول — أقوى مستوى داخل الـ OB)
   (بالعكس تماماً للـ Bearish OB: LEVEL 1 = أدنى قاع، LEVEL 4 = MT بالأسفل)

   قوة المستويات (ثاني عشر): MT > Open Body > Close Body > FVG Level.

   حد الإبطال (ثالث عشر) هو حافة كتلة الـ OB الكاملة (أدنى سعر لمجموعة الشموع
   في Bullish، أعلى سعر في Bearish) — أي إغلاق سعري خلف هالحد = إلغاء كامل.
   إغلاق خلف MT فقط (بدون تجاوز حد الإبطال) = إضعاف الحالة، مش إلغاء.

   الحالة (ثالث عشر):
     Strong  = OB لم يُختبر بعد (Fresh) وفيه FVG + Displacement واضح
     Normal  = تم اختبار/إعادة لمس الـ OB لكنه لا يزال صالحاً فوق/تحت MT
     Weak    = أغلق السعر خلف MT لكن لم يتجاوز حد الإبطال بعد
     Invalid = أغلق السعر خلف حد إبطال كتلة الـ OB بالكامل
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
    return { eligible: false, reason: "لم يلمس السعر بعد أي منطقة من مناطق السيولة الست ضمن الحركة الرئيسية (تاسعاً-١)" };
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

  // المستويات الأربعة المسمّاة (حادي عشر) — من الأعلى للأدنى سعرياً في Bullish
  const levelFvg = dirUp ? merged.high : merged.low; // LEVEL 1 — أقصى حافة الـ OB (شرط FVG إلزامي)
  const levelOpen = merged.open; // LEVEL 2
  const levelClose = merged.close; // LEVEL 3
  const levelMt = (merged.open + merged.close) / 2; // LEVEL 4 — 50% Open/Close فقط — أقوى مستوى
  const invalidationLevel = dirUp ? merged.low : merged.high; // حد إبطال كامل كتلة الـ OB (ثالث عشر)

  // حالة الـ OB حسب مكان آخر إغلاق (ثالث عشر)
  const lastPrice = candles[lastIndex].close;
  let status;
  const touchedSinceCreation = dirUp
    ? candles.slice(moveIndex + 1).some((c) => c.low <= merged.high)
    : candles.slice(moveIndex + 1).some((c) => c.high >= merged.low);

  const invalid = dirUp ? lastPrice < invalidationLevel : lastPrice > invalidationLevel; // إغلاق خلف حد الإبطال = إلغاء كامل
  const beyondMt = dirUp ? lastPrice < levelMt : lastPrice > levelMt; // إغلاق خلف MT فقط = إضعاف

  if (invalid) status = "Invalid";
  else if (beyondMt) status = "Weak";
  else if (!touchedSinceCreation) status = "Strong"; // لم يُختبر بعد + فيه FVG وDisplacement
  else status = "Normal"; // اختُبر ولا يزال صالحاً فوق/تحت MT

  // جودة الـ OB — تقييم مبسّط من 100 يُستخدم داخل QAIS Score لاحقاً.
  // FVG مضمون الوجود دايماً هون (شرط إلزامي)، فالجودة الأساسية أعلى من البداية.
  let quality = 60; // أساس: OB صالح + FVG موجود (إلزامي)
  if (isDisplacement(candles, moveIndex)) quality += 20;
  if (status === "Strong" || status === "Normal") quality += 20;
  quality = Math.min(100, quality);

  return {
    eligible: true,
    direction,
    status, // Strong | Normal | Weak | Invalid
    quality,
    fvgExists: true, // دايماً true — شرط إلزامي وصلنا هون فقط لما تحقق
    // ترتيب القوة (ثاني عشر): MT الأقوى، ثم Open، ثم Close، ثم FVG
    levels: {
      mt: levelMt,
      open: levelOpen,
      close: levelClose,
      fvg: levelFvg,
      invalidation: invalidationLevel,
    },
    strengthOrder: ["mt", "open", "close", "fvg"],
    merged,
    index: moveIndex,
    time: candles[moveIndex].time,
    candleCount: group.length,
    touchedZoneType: touchedZone.type,
  };
}
