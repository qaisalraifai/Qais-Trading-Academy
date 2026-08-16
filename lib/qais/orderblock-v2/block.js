/* ============================================================================
   lib/qais/orderblock-v2/block.js
   بناء كتلة الأوامر من شمعة زخم: مجموعة الشموع المعاكسة + المستويات الخمسة.

   المستويات (لكتلة صاعدة — من الأعلى للأدنى سعرياً):
       FVG        أقصى ذيل بكامل المجموعة (الحد الخارجي من جهة الحركة)
       OPEN       جسم **أول** شمعة بالمجموعة
       MT         ٥٠٪ بين جسم أول شمعة وجسم آخر شمعة — أقوى مستوى
       CLOSE      جسم **آخر** شمعة بالمجموعة
       OUTER WICK الذيل الطرفي لآخر شمعة بالمجموعة **وحدها**
   (معكوسة تماماً للكتلة الهابطة)

   ترتيب القوة: MT > Open > Close > OuterWick > FVG.
   حد الإبطال = OUTER WICK حرفياً — إغلاق أي شمعة خلفه = إلغاء كامل.

   ⚠️ ما في سقف لعدد شموع المجموعة (قرار صاحب المنهجية).
   ---------------------------------------------------------------------------
   انفرض سقف مرة بناءً على «٢٥ شمعة متتالية» ظهروا بفحص — وتبيّن إنهم أثر
   بيانات مصطنعة (٢٤ شمعة هابطة متتالية بمولّد خطي)، مش سلوك سوق. القرار
   انلغى صراحةً: المجموعة بتمتد لآخر شمعة معاكسة متتالية مهما كان عددها.

   ⚠️ الذيل الطرفي من **آخر شمعة بالمجموعة وحدها** — مش أدنى نقطة بكل
   المجموعة. الفرق مهم لأنه هو حد الإبطال.
   ============================================================================ */

/**
 * آخر مجموعة شموع متتالية بعكس اتجاه الحركة، المنتهية قبل `beforeIndex`.
 * @returns {{ startIndex, endIndex, candles }|null}
 */
export function oppositeGroupBefore(candles, beforeIndex, dirUp) {
  const group = [];
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const c = candles[i];
    if (!c) break;
    const isOpposite = dirUp ? c.close < c.open : c.close > c.open;
    if (!isOpposite) break;
    group.unshift(c);
  }
  if (group.length === 0) return null;
  return {
    startIndex: beforeIndex - group.length,
    endIndex: beforeIndex - 1,
    candles: group,
  };
}

/**
 * المستويات الخمسة من مجموعة الشموع.
 * @param group  ناتج oppositeGroupBefore
 * @param dirUp  اتجاه حركة الزخم (صاعد = كتلة طلب)
 */
export function levelsFromGroup(group, dirUp) {
  const g = group.candles;
  const first = g[0];
  const last = g[g.length - 1];

  const merged = {
    open: first.open,
    close: last.close,
    high: Math.max(...g.map((c) => c.high)),
    low: Math.min(...g.map((c) => c.low)),
  };

  const fvg = dirUp ? merged.high : merged.low; // أقصى ذيل بكامل المجموعة
  const open = merged.open;
  const close = merged.close;
  const mt = (merged.open + merged.close) / 2;
  const outerWick = dirUp ? last.low : last.high; // آخر شمعة **وحدها**

  return {
    levels: { fvg, open, close, mt, outerWick, invalidation: outerWick },
    strengthOrder: ["mt", "open", "close", "outerWick", "fvg"],
    merged,
    /* حدود الكتلة كنطاق سعري — للمس والرسم. */
    top: Math.max(fvg, outerWick, open, close),
    bottom: Math.min(fvg, outerWick, open, close),
  };
}

/**
 * أول شمعة **تسكّر** خلف حد الإبطال بعد تكوّن الكتلة.
 * بيرجّع الفهرس، أو -1 لو لسا صالحة لآخر البيانات.
 *
 * ⚠️ بيرجّع الفهرس مش بوليان: صلاحية الكتلة سؤال **بلحظة معيّنة**. كتلة
 * بنت صفقة وانكسرت بعدها بشهور كانت تنشال من القائمة كلياً فالصفقة
 * التاريخية ما بتنبني أبداً.
 */
export function firstInvalidationIndex(candles, fromIndex, invalidationLevel, dirUp) {
  for (let k = fromIndex; k < candles.length; k++) {
    const c = candles[k];
    if (!c) continue;
    if (dirUp ? c.close < invalidationLevel : c.close > invalidationLevel) return k;
  }
  return -1;
}

/**
 * حالة الكتلة **كما هي عند فهرس معيّن** — مش «كما هي اليوم».
 *
 *   Strong  = ما انلمست بعد
 *   Normal  = انلمست ولسا صالحة فوق/تحت MT
 *   Weak    = السعر سكّر خلف MT بدون ما يتجاوز حد الإبطال
 *   Invalid = سكّر خلف حد الإبطال
 */
export function statusAt(candles, block, asOfIndex, dirUp) {
  const { levels } = block;
  const from = block.formedAtIndex + 1;
  const to = Math.min(asOfIndex, candles.length - 1);
  if (to < from) return { status: "Strong", touchedAtIndex: null, weakFromIndex: null };

  if (block.invalidIndex !== -1 && block.invalidIndex <= to) {
    return { status: "Invalid", touchedAtIndex: block.firstTouchIndex, weakFromIndex: null };
  }

  let touchedAtIndex = null;
  let weakFromIndex = null;
  for (let k = from; k <= to; k++) {
    const c = candles[k];
    if (!c) continue;
    const touched = dirUp ? c.low <= block.top : c.high >= block.bottom;
    if (touched && touchedAtIndex == null) touchedAtIndex = k;
    const beyondMt = dirUp ? c.close < levels.mt : c.close > levels.mt;
    if (beyondMt && weakFromIndex == null) weakFromIndex = k;
  }

  if (weakFromIndex != null) return { status: "Weak", touchedAtIndex, weakFromIndex };
  if (touchedAtIndex != null) return { status: "Normal", touchedAtIndex, weakFromIndex: null };
  return { status: "Strong", touchedAtIndex: null, weakFromIndex: null };
}
