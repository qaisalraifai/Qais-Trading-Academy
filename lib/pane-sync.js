/* ============================================================================
   lib/pane-sync.js — قرار مزامنة النافذة الزمنية بين لوحتَي الشارت.
   وحدة **نقيّة** بلا أي تبعية.

   ---------------------------------------------------------------------------
   🔴 **ليش انعزل هالقرار بوحدة لحاله:**

   محاولة سابقة زامنت اللوحتين بالوقت فطلع **تكبير متسارع** بالإنتاج. السبب:

       subscribeVisibleLogicalRangeChange(() => {   // اشتراك على المدى المنطقي
         other.timeScale().setVisibleRange(r);       // وضبط للمدى الزمني
       });

   ضبط الزمني بيغيّر المنطقي → بيشغّل الطرف التاني → بيرجّع للأول. والحارس
   كان بينمسح **فوراً** بينما النداء بيرجع **بالإطار اللي بعده**، فما مسك ولا
   دورة. وكل دورة بتخسر كسراً بالتقريب → المدى بيضيق باطّراد.

   ⚠️ والأخطر: ما كان عندي طريقة أشوف الشارت (البيئة ما بتركّب إطارات)، فما
   انكشف إلا بالإنتاج. لهيك القرار انعزل هون — **بينفحص بمحاكاة، بلا متصفّح**.

   ---------------------------------------------------------------------------
   القاعدة اللي بتكسر الحلقة: **ما بنضبط إذا المدى مطابق أصلاً** — ومطابق
   يعني ضمن تسامح، مش تساوي حرفي، لأن ضبط مدى زمني ما بيرجّع نفس القيمة
   بالضبط (تقريب لحدود الشموع).
   ============================================================================ */

/**
 * هل نطبّق المدى المطلوب على اللوحة الهدف؟
 *
 * @param {{from:number,to:number}|null} current مدى الهدف الحالي
 * @param {{from:number,to:number}|null} target  المدى المطلوب
 * @param {number} tolerance تسامح بالثواني (نص شمعة عادةً)
 * @returns {boolean}
 */
export function shouldApplyRange(current, target, tolerance) {
  if (!target || !Number.isFinite(target.from) || !Number.isFinite(target.to)) return false;
  if (target.to <= target.from) return false;
  if (!current || !Number.isFinite(current.from) || !Number.isFinite(current.to)) return true;

  const tol = Math.max(0, tolerance || 0);
  const same =
    Math.abs(current.from - target.from) <= tol &&
    Math.abs(current.to - target.to) <= tol;
  return !same;
}

/* ═══════════════════════════════════════════════════════════════════════════
   🔴 **المزامنة الزمنية لحالها ما كفّت — وهاد اللي بلّغ عنه بعد شيل الحشو.**
   ---------------------------------------------------------------------------
   الشارت الأساسي عنده `rightOffset: 6` — بيحجز ٦ شموع فاضية بعد آخر شمعة.
   ولوحة المقارنة عندها **صفر**.

   و`getVisibleRange()` بترجّع المدى **مقصوصاً على البيانات**: بتنتهي عند آخر
   شمعة، **مش** عند حافة الرسم. فلما بنضبطها على المقارنة:

       الأساسي   بيعرض [T1 … T_آخر] على العرض **ناقص ٦ شموع**
       المقارنة  بتعرض [T1 … T_آخر] على **كامل** العرض

   مقياسان مختلفين. نفس اللحظة بتنزل بمكانين، والفرق بيكبر كل ما رحنا لليمين
   — وهاد اللي بان بالصورة: شموع الأساسي بتخلص عند ٨٠٪ وخط التقاطع بمكانين.

   ---------------------------------------------------------------------------
   الحل: **الضبط بالفهرس المنطقي** (هو اللي بيحكم البكسل فعلاً وبيغطّي منطقة
   الإزاحة)، بس **بعد ترجمة الموضع عبر الوقت** — فهرس الأساسي → لحظة → فهرس
   المقارنة.

   هيك بناخد الاتنين مع بعض: المحاذاة بالبكسل مضبوطة (فهرس)، والموضع بيعني
   نفس اللحظة (وقت). والإزاحة بتنترجم لحالها: `آخر فهرس + ٦` بالأساسي بتصير
   `آخر فهرس + ٦` بالمقارنة تقريباً.

   ⚠️ **ما في نظر للمستقبل ولا اختراع بيانات** — الترجمة استيفاء بين شمعتين
   موجودتين، وخارج المدى تمديد بالمسافة الوسيطة. ولا قيمة سعر بتنمسّ.
   ═══════════════════════════════════════════════════════════════════════════ */

/** المسافة **الوسيطة** بين شمعتين — الوسيط مش المتوسط عشان عُطل نهاية
    الأسبوع ما تنفخ القيمة. بترجّع 0 لو ما في مسافة صالحة. */
export function medianInterval(times) {
  if (!times || times.length < 2) return 0;
  const gaps = [];
  for (let i = 1; i < times.length; i++) {
    const g = times[i] - times[i - 1];
    if (g > 0) gaps.push(g);
  }
  if (!gaps.length) return 0;
  gaps.sort((a, b) => a - b);
  return gaps[gaps.length >> 1];
}

/** الوقت عند فهرس منطقي. جوّا البيانات: استيفاء بين شمعتين. برّا: تمديد
    بالمسافة الوسيطة — وهيك منطقة الإزاحة إلها وقت. */
export function timeAtLogical(times, logical, interval) {
  const n = times?.length || 0;
  if (!n || !Number.isFinite(logical)) return null;
  if (n === 1) return times[0] + logical * (interval || 0);
  if (logical <= 0) return times[0] + logical * interval;
  if (logical >= n - 1) return times[n - 1] + (logical - (n - 1)) * interval;
  const i = Math.floor(logical);
  return times[i] + (logical - i) * (times[i + 1] - times[i]);
}

/** الفهرس المنطقي عند لحظة. عكس `timeAtLogical` بالضبط على نفس السلسلة. */
export function logicalAtTime(times, time, interval) {
  const n = times?.length || 0;
  if (!n || !Number.isFinite(time)) return null;
  if (n === 1 || time <= times[0]) return interval ? (time - times[0]) / interval : 0;
  if (time >= times[n - 1]) return n - 1 + (interval ? (time - times[n - 1]) / interval : 0);
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= time) lo = mid;
    else hi = mid;
  }
  const span = times[hi] - times[lo];
  return lo + (span > 0 ? (time - times[lo]) / span : 0);
}

/**
 * بيترجم مدى منطقي من سلسلة لسلسلة تانية، عبر الوقت.
 *
 * @param {number[]} srcTimes أوقات شموع اللوحة المصدر (مرتّبة)
 * @param {number[]} dstTimes أوقات شموع اللوحة الهدف (مرتّبة)
 * @param {{from:number,to:number}} range المدى المنطقي بالمصدر
 * @returns {{from:number,to:number}|null} `null` = ما بنقدر نترجم، فما بنزامن
 */
export function mapLogicalRange(srcTimes, dstTimes, range) {
  if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return null;
  if (range.to <= range.from) return null;
  if (!srcTimes?.length || !dstTimes?.length) return null;

  const si = medianInterval(srcTimes);
  const di = medianInterval(dstTimes);
  if (!si || !di) return null; // سلسلة بشمعة وحدة — ما بنخمّن

  const from = logicalAtTime(dstTimes, timeAtLogical(srcTimes, range.from, si), di);
  const to = logicalAtTime(dstTimes, timeAtLogical(srcTimes, range.to, si), di);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  return { from, to };
}

/* ═══════════════════════════════════════════════════════════════════════════
   قاطع دورة: حتى لو فشل شرط التطابق لأي سبب، هاد بيمنع الانفلات.
   ⚠️ **أسوأ حالة بتصير «اللوحتان ما بتتزامنا»** — مزعج بس غير مؤذٍ. وقبله
   كانت أسوأ حالة «تكبير جنوني يخرّب الشارت».
   ═══════════════════════════════════════════════════════════════════════════ */
export function createSyncBreaker({ maxPerWindow = 12, windowMs = 300 } = {}) {
  let count = 0;
  let windowStart = 0;
  let tripped = false;

  return {
    /** بيرجّع true لو مسموح نطبّق الآن. */
    allow(now = Date.now()) {
      if (tripped) {
        if (now - windowStart > windowMs * 4) { tripped = false; count = 0; windowStart = now; }
        else return false;
      }
      if (now - windowStart > windowMs) { count = 0; windowStart = now; }
      count += 1;
      if (count > maxPerWindow) { tripped = true; return false; }
      return true;
    },
    get isTripped() { return tripped; },
    reset() { count = 0; windowStart = 0; tripped = false; },
  };
}
