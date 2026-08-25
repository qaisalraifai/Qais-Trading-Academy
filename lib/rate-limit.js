/* ============================================================================
   lib/rate-limit.js — عدّاد نوافذ ثابتة بذاكرة العملية. وحدة **نقيّة**.

   ---------------------------------------------------------------------------
   ⚠️ **الحدّ الأساسي — اقرأه قبل ما تعتمد عليه:**

   التخزين **بذاكرة العملية**. وVercel بيشغّل عدّة instances، وكل وحدة إلها
   عدّادها. يعني الحدّ الفعلي = `limit × عدد الـinstances`، وبينصفّر مع كل
   بداية عملية باردة.

   هاد **مقصود ومقبول** كخطوة أولى (قراره ٢٠٢٦-٠٨-٢٥): بيوقف الإغراق الغبي
   والسكربتات البسيطة بصفر تبعيات وصفر حساب خارجي. مش حدّاً حقيقياً موحَّداً —
   لهاد بدها مخزَّن مشترك (Redis)، والتبديل بيصير بتغيير هالوحدة وحدها لأن
   المسارات بتنادي واجهة واحدة.

   ⚠️ وكمان: التمييز بالـIP. شبكة وراء NAT واحد بتنعدّ عميلاً واحداً، ومهاجم
   بيبدّل IP بيتخطّاه. الغاية رفع كلفة الإساءة، مش منعها.

   ---------------------------------------------------------------------------
   النافذة **بتبلّش من أول طلب** لكل مفتاح، مش من حدّ ساعة ثابت — أبسط،
   وذاكرتها مدخل واحد لكل مفتاح.

   ⚠️ الثمن: بيمرق **ضِعف الحدّ** لو صار رشقة بآخر نافذة ورشقة بأول اللي
   بعدها. مقبول لهالغرض (إيقاف إغراق، مش حدّ محاسبي)، ومثبَّت باختبار حتى ما
   ينحسب عطلاً بعدين.
   ============================================================================ */

/** أقصى عدد مفاتيح بالذاكرة — حارس ضد نمو غير محدود من IPات متغيّرة. */
const MAX_KEYS = 10000;

const buckets = new Map();

/** بيشيل المنتهية، وإذا ضلّت كبيرة بيشيل الأقدم. */
function prune(now) {
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
  if (buckets.size > MAX_KEYS) {
    // `Map` بتحافظ على ترتيب الإدخال — الأقدم أول
    const excess = buckets.size - MAX_KEYS;
    let i = 0;
    for (const k of buckets.keys()) {
      buckets.delete(k);
      if (++i >= excess) break;
    }
  }
}

/**
 * بيسجّل محاولة ويرجّع إذا مسموحة.
 *
 * @param {string} key      معرّف العميل + المسار
 * @param {object} opts
 * @param {number} opts.limit     أقصى محاولات بالنافذة
 * @param {number} opts.windowMs  طول النافذة
 * @param {number} [opts.now]     للاختبار
 * @returns {{ok: boolean, remaining: number, retryAfterSec: number}}
 */
export function hit(key, { limit, windowMs, now = Date.now() }) {
  if (buckets.size > MAX_KEYS) prune(now);

  const b = buckets.get(key);

  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: Math.ceil(windowMs / 1000) };
  }

  b.count += 1;
  const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));

  if (b.count > limit) return { ok: false, remaining: 0, retryAfterSec };
  return { ok: true, remaining: limit - b.count, retryAfterSec };
}

/** للاختبار — بيصفّي الحالة بين الحالات. */
export function resetAll() {
  buckets.clear();
}

/** للاختبار والمراقبة. */
export function size() {
  return buckets.size;
}

/* ═══════════════════════════════════════════════════════════════════════════
   الحدود المعتمدة لكل مسار.

   ⚠️ **سخيّة عن قصد.** الغاية إيقاف الإغراق، مش مضايقة مستخدم حقيقي — ومكتب
   أو مدرسة كلها وراء IP واحد. أي حدّ بيعضّ استعمالاً شرعياً بيصير أسوأ من
   المشكلة اللي بيحلّها.
   ═══════════════════════════════════════════════════════════════════════════ */
const MINUTE = 60 * 1000;

export const LIMITS = {
  /* بلا مصادقة + بيكتب صفوفاً بمفتاح خدمة — أكتر واحد يستاهل حدّاً. */
  createProfile: { limit: 10, windowMs: 10 * MINUTE },
  /* رفع ملفات: كل محاولة كتابة تخزين. */
  upload: { limit: 20, windowMs: 10 * MINUTE },
  /* إنشاء فواتير/عمليات دفع. */
  payment: { limit: 30, windowMs: 10 * MINUTE },
  /* تسليم اختبار — سخيّ (طالب بيعيد المحاولة)، بس بيوقف التخمين الآلي
     على الإجابات بعد ما صار التصحيح على الخادم. */
  quiz: { limit: 40, windowMs: 10 * MINUTE },
};
