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
