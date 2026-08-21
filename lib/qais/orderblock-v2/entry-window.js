/* ============================================================================
   lib/qais/orderblock-v2/entry-window.js
   R8 — قاعدة الثلث. **شرط دخول، مش شرط كشف.**

   نصّ صاحب المنهجية (٢٠٢٦-٠٨-١٨):
       «المهم يكون راجع لمنطقة سيولة وتكون تحت الثلث وبعد هيك تصير اندفاع
        سعري أو أي حركة قوية.»
       و«بنحدد كتل نشتري منها **بس يرجعلها السعر**.»

   ---------------------------------------------------------------------------
   ⚠️ الفرق بين «شرط كشف» و«شرط دخول» هو لبّ الملف.

   ضيّعت وقت طويل بمحاولة تطبيق الثلث **لحظة تكوّن الكتلة** — وكل التعريفات
   فشلت: كتلته المتحقَّقة (٢٨ أبريل، MT 27137.49) طلعت **فوق** الثلث بكل
   ساق ممكنة، بالفريمين:

       ٢٨ أبريل · H4    الثلث 25,721   الكتلة 27,137   فوق
       ٢٨ أبريل · يومي  الثلث 25,587   الكتلة 27,137   فوق

   السبب إنه الساق ما كانت اكتملت بعد. قمتها إجت ٣ يونيو — بعد الكتلة
   بشهر ونص. ولما رجع السعر للكتلة يوم ٢٩ يوليو، كانت الساق مكتملة
   والثلث عند 28,102.79 والسعر عند 27,322.61 — **تحت الثلث** ✓.

   فالقاعدة بتحكم **متى تدخل**، مش **أي كتلة ترسم**. كتلة سليمة ممكن
   تستنى شهرين لحد ما يجي وقتها.

   ⚠️ الساق: «آخر قاع كبير **قبل** أعلى قمة» — مش آخر قاع زمنياً.
   ---------------------------------------------------------------------------
   بيوليو كان في قاع يومي أحدث (٢٨,٢٣٤ يوم ١٠ يونيو) وهو **مش** المقصود.
   المقصود القاع اللي بلّش منه الصعود: ٢٢,٧٨٠.٥٤ يوم ٣١ مارس.

   التعريف انتحقق: بيعيد إنتاج فيبو صاحب المنهجية المرسوم يدوياً بالكامل —
   قاع 22780.54 · قمة 30759.92 · ثلث 28102.79، مقابل 22783.60 / 30760.10 /
   28103.93 عنده. الفروق (٣.٠٦ · ٠.١٧ · ١.١٤) كلها زحزحة CFI عن Dukascopy.

   ⚠️ الفريمان **مش بديلين** — لازم الاتنين (قراره: «ج»).
   ---------------------------------------------------------------------------
   مقيس عند لحظة العودة نفسها: ساق H4 بتعطي ثلثاً عند 30,405 وساق اليومي
   عند 28,103 — فرق ٢٣٠٢ نقطة. H4 بتاخد آخر قاع كبير زمنياً (٢٨ مايو، قبل
   القمة بأسبوع) واليومي بياخد بداية الصعود كله. اعتماد واحد منهم بيغيّر
   عدد الدخولات جذرياً، فالشرط لازم يتحقق **بالاتنين**.
   ============================================================================ */

/** نسبة التصحيح المطلوبة قبل الدخول. */
export const THIRD = 1 / 3;

const insufficient = (why) => ({ value: "INSUFFICIENT_DATA", why });

/**
 * ساق الاندفاع **كما هي معروفة عند لحظة معيّنة**.
 *
 * صاعدة (للكتل الشرائية): آخر قاع كبير قبل أعلى قمة → أعلى قمة.
 * هابطة (للكتل البيعية):  آخر قمة كبيرة قبل أدنى قاع → أدنى قاع.
 *
 * ⚠️ سببية: بس الأطراف اللي **تأكّدت** لحد `asOfIndex`. سوينغ موجود
 * بالبيانات بس لسا ما تأكد = ما بينعرف بعد.
 *
 * @param majorSwings ناتج analyzeStructureV2().majorSwings
 * @param asOfIndex   فهرس الشمعة اللي بنسأل عندها
 * @param dirUp       اتجاه الكتلة (صاعد = ساق صاعدة)
 */
/* ============================================================================
   ⚠️ `anchor` — مرساة الطرف البعيد. **الافتراضي `"global"` = السلوك القائم.**

   `"global"`  الطرف البعيد = أقصى قمة/قاع بكل التاريخ المتاح.
   `"mirror"`  الطرف البعيد = أقصى قمة/قاع **بعد** الطرف المقابل العالمي.

   ليش انبنى الخيار: بسوق صاعد، «أعلى قمة» حديثة فالساق الصاعدة سليمة —
   والنسخة القائمة بتعيد إنتاج ثلثيه المرسومين بإيده بالضبط (يومي 28,100
   مقابل 28,104 · H4 30,405). بس «أدنى قاع» سحيق، فالساق الهابطة بتنسحب
   لسنين ورا. مقيس على ١٠٥ كتلة:

       النسخة    الاتجاه   INSUFFICIENT   عبثي(>20×ATR)   حقيقي
       الحالي    شرائي             0            22          94
       الحالي    بيعي             47            47           0     ← ولا واحد
       المرآة    شرائي            13            16          87
       المرآة    بيعي              5             3          86

   بـ`"mirror"` الصاعد **ما بيتغيّر** بسوق صاعد (أعلى قمة بعد أدنى قاع =
   أعلى قمة)، والثلثان المتحقَّقان يدوياً بيضلوا كما هما — متحقَّق باختبار.

   ⚠️ ما في رقم جديد. التصحيح **تماثل** مش معايرة. والافتراضي ما تغيّر —
   القرار إله.
   ============================================================================ */
export function impulseLegAt(majorSwings, asOfIndex, dirUp, options = {}) {
  const anchorMode = options.anchor ?? "global";
  const avail = (majorSwings || []).filter(
    (s) => Number.isFinite(s.confirmedAtIndex) && s.confirmedAtIndex <= asOfIndex
  );
  if (avail.length < 2) {
    return insufficient(`أقل من سوينغين مؤكَّدين لحد الشمعة ${asOfIndex} — الساق غير قابلة للتحديد`);
  }

  /* الطرف البعيد: أعلى قمة (للصاعدة) أو أدنى قاع (للهابطة). */
  const farType = dirUp ? "high" : "low";
  let pool = avail;
  if (anchorMode === "mirror") {
    /* المرساة = الطرف المقابل العالمي؛ والبعيد بينختار من بعدها وبس. */
    const oppType = dirUp ? "low" : "high";
    const opps = avail.filter((s) => s.type === oppType);
    if (!opps.length) return insufficient(`ما في ${dirUp ? "قاع" : "قمة"} كبير مؤكَّد للمرساة`);
    const anchor = opps.reduce((m, s) => ((dirUp ? s.price < m.price : s.price > m.price) ? s : m));
    pool = avail.filter((s) => s.index > anchor.index);
  }
  const fars = pool.filter((s) => s.type === farType);
  if (!fars.length) return insufficient(`ما في ${dirUp ? "قمة" : "قاع"} كبير مؤكَّد لحد الشمعة ${asOfIndex}`);
  const far = fars.reduce((m, s) => (dirUp ? s.price > m.price : s.price < m.price) ? s : m);

  /* الطرف القريب: **آخر** طرف معاكس قبله زمنياً — مش أبعده سعرياً،
     ومش آخر واحد زمنياً بشكل مطلق (ممكن يكون بعد القمة). */
  const nears = avail.filter((s) => s.type !== farType && s.index < far.index);
  if (!nears.length) {
    return insufficient(`ما في ${dirUp ? "قاع" : "قمة"} كبير قبل ${dirUp ? "القمة" : "القاع"} @${far.index}`);
  }
  const near = nears.reduce((m, s) => (s.index > m.index ? s : m));

  const span = Math.abs(far.price - near.price);
  if (!(span > 0)) return insufficient("طول الساق صفر — الثلث غير قابل للحساب");

  return {
    direction: dirUp ? "up" : "down",
    low: dirUp ? near : far,
    high: dirUp ? far : near,
    span: +span.toFixed(5),
    /* حد الثلث: للشرائي تحت هالسعر · للبيعي فوقه. */
    threshold: +(dirUp ? far.price - THIRD * span : far.price + THIRD * span).toFixed(5),
    knownFromIndex: Math.max(near.confirmedAtIndex, far.confirmedAtIndex),
    asOfIndex,
  };
}

/**
 * هل السعر «تحت الثلث» (أو فوقه للبيعي) عند لحظة معيّنة، بفريم واحد؟
 */
export function belowThird(price, leg, dirUp) {
  if (!leg || leg.value === "INSUFFICIENT_DATA") return null;
  return dirUp ? price <= leg.threshold : price >= leg.threshold;
}

/**
 * R8 كاملة: الدخول مسموح بس لما **كل** الفريمات تحقق الشرط.
 *
 * ⚠️ قراره كان «ج» — الاتنين مش واحد. فريم واحد بيمرّر بيخلّي الشرط
 * أرخى بمقدار ٢٣٠٠ نقطة على الحالة المقيسة.
 *
 * ⚠️ `null` من أي فريم = `INSUFFICIENT_DATA` للنتيجة كلها، مش «لأ».
 * اعتبار «ما انقاس» = «مرفوض» بيخفي نقص البيانات ورا رفض يبان مقصود.
 *
 * @param price     السعر اللي بنسأل عنه (عادةً سعر لمس الكتلة)
 * @param dirUp     اتجاه الكتلة
 * @param contexts  [{ timeframe, majorSwings, asOfIndex }, ...]
 */
export function entryAllowed(price, dirUp, contexts) {
  if (!Array.isArray(contexts) || contexts.length === 0) {
    return insufficient("ما انمرّر ولا سياق فريم — R8 غير قابلة للتقييم");
  }
  const perTimeframe = [];
  for (const ctx of contexts) {
    const leg = impulseLegAt(ctx.majorSwings, ctx.asOfIndex, dirUp);
    if (leg.value === "INSUFFICIENT_DATA") {
      return insufficient(`${ctx.timeframe}: ${leg.why}`);
    }
    perTimeframe.push({
      timeframe: ctx.timeframe,
      threshold: leg.threshold,
      ok: belowThird(price, leg, dirUp),
      leg: { low: leg.low.price, high: leg.high.price, span: leg.span },
    });
  }
  const allowed = perTimeframe.every((r) => r.ok === true);
  return {
    allowed,
    price,
    direction: dirUp ? "up" : "down",
    perTimeframe,
    reason: allowed
      ? `تحت الثلث بكل الفريمات (${perTimeframe.map((r) => `${r.timeframe} ${r.threshold.toFixed(0)}`).join(" · ")})`
      : `فوق الثلث بـ${perTimeframe.filter((r) => !r.ok).map((r) => r.timeframe).join(" · ")}`,
  };
}

/**
 * حالة الكتلة **عند لحظة معيّنة** — قرار صاحب المنهجية (٢٠٢٦-٠٨-١٨):
 *
 *     «بتنعرض كمنتظرة، بس يرجعلها السعر مرة ثانية إذا صحّح — يعني وصارت
 *      شروط الدخول — بتطلع الصفقة والأهداف والستوب.»
 *
 *   forming  الكتلة تكوّنت بس لسا ما تأكّدت (R1/R6 ما اكتملوا)
 *   waiting  مؤكَّدة ومعروضة — بس السعر ما رجعلها أو الثلث ما تحقق
 *   entry    رجع السعر **وتحققت الشروط** → صفقة
 *   invalid  سكّر السعر خلف الذيل الطرفي
 *
 * ⚠️ `waiting` مش «ضعيفة» — هي الحالة الطبيعية وممكن تطول. كتلة أبريل
 * المتحقَّقة ضلّت `waiting` **٣ شهور** (٢٨ أبريل → ٢٩ يوليو) وعبرها ٦
 * لمسات كلها مرفوضة، وبعدين صارت صفقة.
 */
export function blockStateAt(candles, block, asOfIndex, ctxFor) {
  const dirUp = block.direction === "up";

  if (block.invalidIndex !== -1 && block.invalidIndex <= asOfIndex) {
    return { state: "invalid", since: block.invalidIndex, reason: "سكّر السعر خلف الذيل الطرفي" };
  }
  if (asOfIndex < block.confirmedAtIndex) {
    return { state: "forming", reason: "لسا ما تأكّدت — شروط التكوّن ما اكتملت" };
  }

  const e = firstEntryIndex(candles.slice(0, asOfIndex + 1), block, ctxFor);
  if (e) return { state: "entry", since: e.index, entry: e, reason: e.detail.reason };

  return { state: "waiting", since: block.confirmedAtIndex, reason: "مؤكَّدة — بانتظار عودة السعر تحت الثلث" };
}

/**
 * أول لحظة بيصير فيها الدخول مسموحاً بعد تكوّن الكتلة.
 *
 * بيرجّع الفهرس، أو `null` لو ما إجت لحد آخر البيانات. اللمس وحده ما
 * بيكفي: لازم يكون اللمس **و** الشرط متحققين بنفس الشمعة.
 *
 * @param candles شموع فريم الكتلة
 * @param block   كتلة من analyzeOrderBlocksSK
 * @param ctxFor  (index) => contexts — بيرجّع سياقات الفريمات عند فهرس معيّن
 */
export function firstEntryIndex(candles, block, ctxFor) {
  const dirUp = block.direction === "up";
  const from = block.confirmedAtIndex;
  const to = block.invalidIndex === -1 ? candles.length - 1 : block.invalidIndex - 1;

  for (let i = from; i <= to; i++) {
    const c = candles[i];
    if (!c) continue;
    /* لمس الكتلة: دخول السعر لنطاقها. */
    const touched = dirUp ? c.low <= block.top : c.high >= block.bottom;
    if (!touched) continue;
    /* السعر اللي بينحكم عليه = حافة الكتلة اللي وصلها السعر. */
    const px = dirUp ? Math.max(c.low, block.bottom) : Math.min(c.high, block.top);
    const r = entryAllowed(px, dirUp, ctxFor(i));
    if (r.value === "INSUFFICIENT_DATA") continue;
    if (r.allowed) return { index: i, time: c.time, price: px, detail: r };
  }
  return null;
}
