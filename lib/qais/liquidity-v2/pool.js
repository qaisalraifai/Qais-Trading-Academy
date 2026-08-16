/* ============================================================================
   lib/qais/liquidity-v2/pool.js
   الشكل المشترك لكل «بركة سيولة» (Liquidity Pool) + أدوات القياس المشتركة.

   بركة السيولة = مستوى سعري فيه أوامر معلّقة متراكمة (ستوبات/بريك آوت).
   مصدرها ممكن يكون قمم متساوية، سوينغ خارجي، قمة/قاع أمس، قمة/قاع جلسة...
   بس شكل المخرج **واحد** مهما كان المصدر، عشان طبقة الـSweep تشتغل عليها
   كلها بنفس الكود بدل ما ينكتب كاشف انسحاب لكل نوع.

   جهة السيولة (side):
   ---------------------------------------------------------------------------
     buy  = سيولة شراء **فوق** القمم — ستوبات البايعين + أوامر الاختراق.
            السعر لازم يطلع فوق ليوصلها.
     sell = سيولة بيع **تحت** القيعان. السعر لازم ينزل ليوصلها.

   هالتسمية مقلوبة عن الحدس أول مرة بتقراها، بس هي المتفق عليها: «سيولة
   بايسايد» يعني أوامر شراء مركونة فوق، مش إنه السوق صاعد.

   عن `strength`:
   ---------------------------------------------------------------------------
   كل نوع بركة بيشتق قوته من **مدخل مقيس فعلياً** (عدد اللمسات · طول الساق
   بالـATR · كم شمعة رجعنا لورا قبل ما نلاقي تجاوز للمستوى). عتبات التصنيف
   نفسها **اصطلاحية ومش معيَّرة** على مرجع بشري لحد الآن — لهيك الرقم المقيس
   بينحفظ بالمخرج (`measure`) حتى أي معايرة لاحقة تعيد التصنيف بدون ما تعيد
   الحساب، وحتى ما ينقرا التصنيف كأنه مقيس.
   ============================================================================ */

export const POOL_STRENGTHS = ["Weak", "Normal", "Strong", "Extreme"];

/** مقياس مش قابل للقياس — قيمة صريحة مع سببها، مش رقم مقدَّر ولا صفر. */
export function insufficient(why) {
  return { value: "INSUFFICIENT_DATA", why };
}

export function isInsufficient(x) {
  return !!x && typeof x === "object" && x.value === "INSUFFICIENT_DATA";
}

/** الوقت بالبيانات جاي بالثواني من بعض المزوّدين وبالمللي من غيرهم. */
export function toMs(time) {
  if (!Number.isFinite(time)) return null;
  // أي ختم زمني أصغر من 1e11 هو ثواني (1e11 ثانية = سنة 5138)
  return time < 1e11 ? time * 1000 : time;
}

/**
 * بارزة المستوى: كم شمعة رجعنا لورا قبل ما نلاقي شمعة تجاوزت المستوى.
 * **مسح خلفي فقط** — مقيس بلحظة إتاحة البركة، ما بيشوف ولا شمعة بعدها.
 *
 * ليش عدد شموع مش مسافة سعرية: البارزة سؤال «قدّيش زمن مرق والمستوى صامد»،
 * والمسافة السعرية محسوبة أصلاً بمكان تاني (الساق بالـATR).
 *
 * @returns {{bars: number, capped: boolean}}
 */
export function prominenceBars(candles, atIndex, level, side, maxLookback = 200) {
  const stop = Math.max(0, atIndex - maxLookback);
  for (let k = atIndex - 1; k >= stop; k--) {
    const c = candles[k];
    if (!c) continue;
    const exceeded = side === "buy" ? c.high >= level : c.low <= level;
    if (exceeded) return { bars: atIndex - k, capped: false };
  }
  return { bars: atIndex - stop, capped: true };
}

/* عتبات اصطلاحية — شوف الملاحظة برأس الملف. */
export function strengthFromProminence(bars) {
  if (bars >= 120) return "Extreme";
  if (bars >= 40) return "Strong";
  if (bars >= 10) return "Normal";
  return "Weak";
}

export function strengthFromTouchCount(count) {
  if (count >= 4) return "Extreme";
  if (count === 3) return "Strong";
  return "Normal"; // قمتين متساويتين = الحد الأدنى لتكوين بركة
}

export function strengthFromLegAtr(legAtr) {
  if (legAtr == null) return "Normal";
  if (legAtr >= 6) return "Extreme";
  if (legAtr >= 3) return "Strong";
  return "Normal";
}

export function strengthFromScore(score) {
  if (score >= 0.75) return "Extreme";
  if (score >= 0.5) return "Strong";
  if (score >= 0.25) return "Normal";
  return "Weak";
}

/**
 * متوسط الأدلة المتوفرة فقط. الدليل الغايب بينشال من المقام ولا بينحسب صفر —
 * نفس قاعدة displacement.js بمحرك الهيكل.
 * @returns {number|null} null = ما في ولا دليل، فما في ثقة (مش صفر)
 */
export function meanOfAvailable(parts) {
  const ok = parts.filter((p) => Number.isFinite(p));
  if (!ok.length) return null;
  return +(ok.reduce((a, b) => a + b, 0) / ok.length).toFixed(3);
}

/**
 * بناء بركة سيولة بالشكل الموحّد.
 * `availableFromIndex` هو بوابة السببية: البركة ما بتتفاعل مع ولا شمعة قبلها.
 */
export function makePool({
  type,
  side,
  price,
  time,
  index,
  timeframe = null,
  availableFromIndex,
  expiresAtIndex = null,
  strength,
  measure,
  source,
  reason,
  confidence = null,
  extra = {},
}) {
  return {
    /* معرّف مشتق من المحتوى — ثابت مهما امتدت البيانات، فقابل للمقارنة بين
       تشغيلة جزئية وتشغيلة كاملة (فحص السببية). */
    id: `LQ:${type}:${side}:${index}:${Number(price).toFixed(5)}`,
    type,
    side,
    direction: side === "buy" ? "up" : "down", // اتجاه الحركة اللازمة للوصول للبركة
    price,
    time,
    index,
    timeframe,
    availableFromIndex,
    expiresAtIndex,
    strength,
    /* الرقم المقيس اللي اشتُقت منه القوة — محفوظ حتى التصنيف يضل قابل للمراجعة. */
    measure,
    source,
    scope: null, // internal | external — بينتحدد بـindex.js بلحظة التقييم
    scopeReason: null,
    status: "remaining", // remaining | swept | breached
    sweeps: [],
    breach: null,
    takenAt: null,
    reason,
    confidence,
    ...extra,
  };
}
