/* ════════════════════════════════════════════════════════════════════════
   حراسة المزوّدين — رمية المزوّد ≠ سقوط الطلب
   ────────────────────────────────────────────────────────────────────────
   🔴 العطل المقيس (٢٠٢٦-٠٨-٢٧، إنتاج):

       5× "Failed to load resource: 500" على /api/replay-candles
       duk=xauusd · duk=usatechidxusd
       loadSource: null   ← الشارت عاش على الكاش وحده

   السبب مش المزوّد — السبب `Promise.race`. لما `fetchDukascopyCandles`
   **ترمي** بدل ما ترجّع `{ error }`، الـrace بترفض، ومسار `GET` كان بلا أي
   `try/catch` — فالنتيجة **500 عارية بلا جسم**، وأسوأ من هيك: سلسلة
   التراجع (Twelve Data → يوهو) بتنتخطّى بالكامل. يعني رمية من المزوّد
   الأول بتضيّع المزوّدين الباقيين الشغّالين.

   الحل: الرمية بتنقلب لنفس شكل الفشل العادي (`{ error }`)، فالسلسلة بتكمل
   زي أي مزوّد فاشل — والسبب بيوصل بـ`providerErrors` بدل ما يضيع.

   ⚠️ هاد **ما بيمسك** قتل العملية (OOM) — هديك ما بتنمسك بأي `catch`. بس
   هيك بينفصل الصنفان: لو صارت البيانات ترجع من يوهو مع `providerErrors`
   فيها نص الرمية، السبب كان رمية. ولو ضلّت 500 عارية، السبب على مستوى
   المنصّة (OOM أو انتهاء مهلة الدالة) — وهاد قياس مختلف كلياً.
   ════════════════════════════════════════════════════════════════════════ */

/** نص مقروء من أي مرمي — Error أو نص أو غرض. */
function reasonOf(e) {
  if (e instanceof Error) return e.message || e.name || "رمية بلا رسالة";
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/**
 * بتحوّل رمية المزوّد لفشل مزوّد عادي.
 * @param {Promise<any>} promise
 * @returns {Promise<{error?: string}>}
 */
export function safeProvider(promise) {
  return Promise.resolve(promise).catch((e) => ({ error: `رمية من المزوّد: ${reasonOf(e)}` }));
}

/**
 * سباق مع مهلة — **بلا** تمرير الرفض.
 * @param {Promise<any>} promise
 * @param {number} ms
 * @param {any} timeoutResult القيمة اللي بترجع لو انتهت المهلة.
 */
export function withTimeout(promise, ms, timeoutResult) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(timeoutResult), ms);
  });
  /* ⚠️ الـcatch **لازم** يكون على الوعد قبل الـrace مش بعدها: لو انحط بعدها
     بيبلع كمان أي رمية جاية من مسار المهلة، وبيخفي أعطال مش من المزوّد. */
  return Promise.race([safeProvider(promise), timeout]).finally(() => clearTimeout(timer));
}
