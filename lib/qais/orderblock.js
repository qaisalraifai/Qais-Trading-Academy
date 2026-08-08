/* ============================================================================
   lib/qais/orderblock.js
   محرك الـ Order Block (QAIS OB) — مطابق حرفياً لقواعد OB الخاصة (تاسعاً–ثالث عشر)

   السلسلة الإلزامية:
     العودة لمنطقة سيولة → حركة قوية وواضحة → FVG شرط أساسي (بدونه لا يُعتمد
     الـ OB إطلاقاً) → إغلاق فعلي (مش Wick) فوق/تحت آخر مجموعة شموع معاكسة
     متتالية = QAIS Order Block.

   المستويات الخمسة (مطابقة حرفياً لتوثيق RADAR — SK+ICT الجديد، الفصل ٤) —
   لـ Bullish OB، من الأعلى للأدنى سعرياً:
     LEVEL 1 = FVG        (أعلى ذيل لأعلى شمعة ضمن كامل المجموعة — شرط FVG إلزامي)
     LEVEL 2 = OPEN       (جسم أول شمعة بالمجموعة)
     LEVEL 5 = MT         (50% بين جسم أول شمعة وجسم آخر شمعة — أقوى مستوى داخل الـ OB)
     LEVEL 3 = CLOSE      (جسم آخر شمعة بالمجموعة)
     LEVEL 4 = OUTER WICK (الذيل الطرفي لآخر شمعة بالمجموعة فقط — وليس أدنى نقطة بكل المجموعة)
   (بالعكس تماماً للـ Bearish OB: LEVEL 1 = أدنى ذيل، LEVEL 4 = الذيل العلوي لآخر شمعة)

   قوة المستويات (ثاني عشر): MT > Open Body > Close Body > Outer Wick > FVG Level.

   حد الإبطال (الفصل ٧: "إذا أغلق السعر خلف آخر مستوى من مستويات الـ OB") =
   LEVEL 4 (الذيل الطرفي لآخر شمعة) حرفياً — أي إغلاق سعري خلفه = إلغاء كامل.
   إغلاق خلف MT فقط (بدون تجاوز LEVEL 4) = إضعاف الحالة، مش إلغاء.

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

/*
 * مسح الساق الفعّالة كاملة (window = MSS→للأمام، من structure.js) وبناء *كل*
 * الـ OBs الصالحة جواها — مش بس أول وحدة الحقت لمس السعر اللحظي. هاي هي
 * "ذاكرة" النظام: أي OB يتشكّل جوا الساق ولسا ما انلغى (Invalid) بيضل
 * بالقائمة ويصير قابل للتفاعل معه لو رجعله السعر بعد وقت طويل، بغض النظر
 * عن أي تشغيلة حالية "لمسته اللحظة" ولا لأ.
 *
 * بيستخدم نفس منطق analyzeOrderBlock (المستويات الخمسة + حد الإبطال) لكن
 * لكل حركة Displacement بنفس اتجاه الساق داخل [window.fromIndex, window.toIndex]
 * — مش بس أول حركة بعد لمس منطقة سيولة وحيدة.
 */
export function scanLegOrderBlocks(candles, window, fvgs, options = {}) {
  if (!window || !Array.isArray(candles) || !Array.isArray(fvgs)) return [];
  const { keepInvalid = false } = options;
  const { fromIndex, toIndex, direction } = window;
  const dirUp = direction === "up";
  const results = [];
  const seenStart = new Set();

  for (let i = fromIndex + 1; i <= toIndex && i < candles.length; i++) {
    if (!isDisplacement(candles, i)) continue;
    const moveDirUp = candles[i].close > candles[i].open;
    if (moveDirUp !== dirUp) continue; // بس حركات استمرارية بنفس اتجاه الساق — مش تصحيحات عكسية جواها

    const group = lastOppositeGroup(candles, i, moveDirUp);
    if (group.length === 0) continue;

    const startIdx = i - group.length;
    if (seenStart.has(startIdx)) continue; // تفادي تكرار نفس المجموعة من أكتر من شمعة زخم متتالية

    const dir = moveDirUp ? "up" : "down";
    if (!hasFvgInMove(fvgs, i - 1, i + 2, dir)) continue; // FVG شرط إلزامي — نفس قاعدة 3/6

    seenStart.add(startIdx);

    const lastGroupCandle = group[group.length - 1];
    const merged = {
      open: group[0].open,
      close: lastGroupCandle.close,
      high: Math.max(...group.map((c) => c.high)),
      low: Math.min(...group.map((c) => c.low)),
    };

    const levelFvg = moveDirUp ? merged.high : merged.low;
    const levelOpen = merged.open;
    const levelClose = merged.close;
    const levelMt = (merged.open + merged.close) / 2;
    const levelOuterWick = moveDirUp ? lastGroupCandle.low : lastGroupCandle.high;
    const invalidationLevel = levelOuterWick;

    // الحالة تُحسب ضد كامل تاريخ الشموع المتوفر (لغاية آخر شمعة فعلياً) —
    // مش بس لغاية toIndex — عشان نعرف هل انلغى فعلياً لليوم أو لسا صالح.
    const lastPrice = candles[candles.length - 1].close;
    const touchedSinceCreation = moveDirUp
      ? candles.slice(i + 1).some((c) => c.low <= merged.high)
      : candles.slice(i + 1).some((c) => c.high >= merged.low);
    /* الإبطال: **إغلاق أي شمعة** خلف آخر مستوى بالكتلة (الخط الأحمر) —
       مش مجرد موقع السعر الحالي. كان بيقارن lastPrice وبس، فكتلة انكسرت
       فعلاً وبعدين رجع السعر فوق كانت تضل تُحسب صالحة. */
    /* بنسجّل **فهرس** أول إغلاق خلف الحد، مش بس "انلغت أو لأ".
       السبب: إعادة بناء صفقة تاريخية لازم تقيّم صلاحية الكتلة **بلحظة
       الدخول**، مش بلحظة اليوم. كتلة اشتغلت عليها صفقة وانكسرت بعدها
       بشهور كانت بتنشال من القائمة كلياً، فالصفقة ما بتنبني أبداً. */
    let invalidIndex = -1;
    for (let k = i + 1; k < candles.length; k++) {
      const c = candles[k];
      if (moveDirUp ? c.close < invalidationLevel : c.close > invalidationLevel) {
        invalidIndex = k;
        break;
      }
    }
    const invalid = invalidIndex !== -1;
    const beyondMt = moveDirUp ? lastPrice < levelMt : lastPrice > levelMt;

    let status;
    if (invalid) status = "Invalid";
    else if (beyondMt) status = "Weak";
    else if (!touchedSinceCreation) status = "Strong";
    else status = "Normal";

    // الافتراضي: الصالحة بس — هاي القائمة يلي بتشكّل "الذاكرة" الحية بالرادار.
    // keepInvalid بيستخدمه مسار "آخر صفقة" حتى يقدر يقيّمها زمنياً.
    if (status === "Invalid" && !keepInvalid) continue;

    let quality = 60;
    if (isDisplacement(candles, i)) quality += 20;
    if (status === "Strong" || status === "Normal") quality += 20;
    quality = Math.min(100, quality);

    results.push({
      eligible: true,
      direction: dir,
      status,
      quality,
      fvgExists: true,
      levels: {
        mt: levelMt,
        open: levelOpen,
        close: levelClose,
        fvg: levelFvg,
        outerWick: levelOuterWick,
        invalidation: invalidationLevel,
      },
      strengthOrder: ["mt", "open", "close", "outerWick", "fvg"],
      merged,
      index: i,
      time: candles[i].time,
      candleCount: group.length,
      invalidIndex, // -1 = لسا صالحة لليوم
      invalidTime: invalidIndex !== -1 ? candles[invalidIndex].time : null,
    });
  }

  return results.sort((a, b) => b.index - a.index); // الأحدث (الأقرب زمنياً) أولاً
}

/** هل السعر الحالي داخل نطاق أي OB حي من قائمة scanLegOrderBlocks؟ */
export function findLiveOBAtPrice(obList, price) {
  if (!Array.isArray(obList) || !Number.isFinite(price)) return null;
  return (
    obList.find((ob) => {
      const top = Math.max(ob.levels.fvg, ob.levels.invalidation);
      const bottom = Math.min(ob.levels.fvg, ob.levels.invalidation);
      return price >= bottom && price <= top;
    }) || null
  );
}

/*
 * مسح *كل* السيقان التاريخية (مش بس الساق الفعّالة الحالية) وتجميع كل الـ OBs
 * الصالحة منها بقائمة واحدة — هاي الذاكرة الكاملة عبر الزمن. لو صار MSS جديد
 * وساق جديدة، الـ OBs الصالحة من السيقان القديمة بتضل موجودة بالقائمة (طالما
 * لسا ما انلغت سعرياً)، وممكن السعر يرجعلها ويتفاعل معها حتى لو بعد سيقان
 * وMSS تاليين كتار — بالظبط زي سيناريو الصورة التانية.
 */
export function scanAllLegsOrderBlocks(candles, legs, fvgs, options = {}) {
  if (!Array.isArray(legs) || !legs.length) return [];
  const all = [];
  const seen = new Set();
  for (const leg of legs) {
    const window = { fromIndex: leg.fromIndex, toIndex: leg.toIndex, direction: leg.direction };
    const obs = scanLegOrderBlocks(candles, window, fvgs, options);
    for (const ob of obs) {
      const key = `${ob.direction}-${ob.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(ob);
    }
  }
  return all.sort((a, b) => b.index - a.index); // الأحدث أولاً، بغض النظر من أي ساق تشكّل
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
  const lastGroupCandle = group[group.length - 1];
  const merged = {
    open: group[0].open,
    close: lastGroupCandle.close,
    high: Math.max(...group.map((c) => c.high)),
    low: Math.min(...group.map((c) => c.low)),
  };

  // المستويات الخمسة (توثيق RADAR الجديد، الفصل ٤ — النقاط ١-٥) — من الأعلى للأدنى سعرياً في Bullish:
  //   1) أعلى ذيل لأعلى شمعة ضمن كامل المجموعة  2) جسم أول شمعة  3) جسم آخر شمعة
  //   4) الذيل الطرفي لآخر شمعة بالمجموعة فقط (وليس أدنى نقطة بكل المجموعة)  5) 50% بين جسمي أول/آخر شمعة
  const levelFvg = dirUp ? merged.high : merged.low; // LEVEL 1 — أعلى ذيل بكل المجموعة (شرط FVG إلزامي)
  const levelOpen = merged.open; // LEVEL 2 — جسم أول شمعة بالمجموعة
  const levelClose = merged.close; // LEVEL 3 — جسم آخر شمعة بالمجموعة
  const levelMt = (merged.open + merged.close) / 2; // LEVEL 5 — 50% Open/Close (أقوى مستوى داخل الـ OB)
  const levelOuterWick = dirUp ? lastGroupCandle.low : lastGroupCandle.high; // LEVEL 4 — ذيل آخر شمعة فقط (الفصل ٤)
  // حد إبطال كتلة الـ OB (الفصل ٧: "إذا أغلق السعر خلف آخر مستوى من مستويات الـ OB") = LEVEL 4 حرفياً
  const invalidationLevel = levelOuterWick;

  // حالة الـ OB حسب مكان آخر إغلاق (ثالث عشر)
  const lastPrice = candles[lastIndex].close;
  let status;
  const touchedSinceCreation = dirUp
    ? candles.slice(moveIndex + 1).some((c) => c.low <= merged.high)
    : candles.slice(moveIndex + 1).some((c) => c.high >= merged.low);

  /* إغلاق أي شمعة خلف حد الإبطال = إلغاء كامل (مش السعر الحالي وبس) */
  const invalid = candles
    .slice(moveIndex + 1)
    .some((c) => (dirUp ? c.close < invalidationLevel : c.close > invalidationLevel));
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
      outerWick: levelOuterWick, // LEVEL 4 — ذيل آخر شمعة بالمجموعة (الفصل ٤) = نفس حد الإبطال
      invalidation: invalidationLevel,
    },
    strengthOrder: ["mt", "open", "close", "outerWick", "fvg"],
    merged,
    index: moveIndex,
    time: candles[moveIndex].time,
    candleCount: group.length,
    touchedZoneType: touchedZone.type,
  };
}
