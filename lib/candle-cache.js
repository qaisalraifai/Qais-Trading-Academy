/* ============================================================================
   lib/candle-cache.js
   تخزين الشموع محلياً بالمتصفح (IndexedDB) — الشموع التاريخية ما بتتغيّر.

   ---------------------------------------------------------------------------
   ⚠️ ليش انبنت: فتح شارت الريبلاي كان بينتظر **٢.٧ لـ٦.٣ ثانية** قبل أول
   بايت. القياس (ES=F · ١٥ دقيقة · ٢٠٠٠٠ شمعة):

       أول بايت   ٢٧٠٦–٦٣١٧ ملّي ثانية
       باقي النقل     ٧–١٤ ملّي ثانية

   يعني الانتظار **كله** جلب من المزوّد بالخادم، مش حجم ولا شبكة. Dukascopy
   بتبني ١٦ ألف شمعة من ملفات أرشيف وهاد بطيء بطبيعته، وما في أي تخزين مؤقت
   بالمسار كله — فكل فتحة صفحة بتعيد نفس الشغل من الصفر.

   الملاحظة اللي بتحلّها: **شمعة تاريخية ما بتتغيّر أبداً.** شمعة ١٥ دقيقة من
   الشهر الماضي هي هي للأبد. الوحيدة المتحرّكة هي الجارية.

   فبدل ما نجيب ١٦ ألف شمعة كل مرة، منحفظهن هون ومنجيب **الذيل الجديد بس**.

   ---------------------------------------------------------------------------
   ⚠️ IndexedDB مش localStorage عمداً: ١.٥ ميجا للرمز الواحد، و`localStorage`
   حدّه ~٥ ميجا للأصل كله — يعني تلات رموز وبينفجر. وIndexedDB بيخزّن كائنات
   جاهزة بلا JSON.parse على ١٦ ألف عنصر بكل قراءة.

   ⚠️ كل الدوال **ما بترمي**. التخزين تحسين مش مصدر حقيقة: لو المتصفح رفض
   (وضع خاص · حصة ممتلئة · IndexedDB مقفول) بترجّع null والمسار العادي
   بيشتغل زي ما كان بالضبط.
   ============================================================================ */

const DB_NAME = "qta_candles_v1";
const STORE = "series";
const DB_VERSION = 1;

/* ⚠️ سقف عدد السلاسل المحفوظة. كل سلسلة ممكن توصل لبضع ميجات، والمستخدم
   بيتنقل بين عشرات الرموز والفريمات — بلا سقف بتكبر بلا حد.

   ⚠️ انرفع من ٢٤ لـ٤٨: صار لكل رمز **مفتاحان** — سلسلة المباشر ونافذة القص
   (`cutCacheKey`). بستة فريمات، الرمز الواحد ممكن ياخد ١٢ خانة، فسقف ٢٤ كان
   بيطرد رمزاً كامل مع أول تسخين لرمز تاني. */
const MAX_SERIES = 48;

let dbPromise = null;

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch { resolve(null); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function tx(db, mode, fn) {
  return new Promise((resolve) => {
    let t;
    try { t = db.transaction(STORE, mode); } catch { resolve(null); return; }
    const store = t.objectStore(STORE);
    let out = null;
    try { fn(store, (v) => { out = v; }); } catch { resolve(null); return; }
    t.oncomplete = () => resolve(out);
    t.onerror = () => resolve(null);
    t.onabort = () => resolve(null);
  });
}

/** مفتاح السلسلة — الرمز والفريم يحدّدانها بالكامل. */
export function cacheKey(symbol, interval) {
  return `${symbol}|${interval}`;
}

/* ============================================================================
   نافذة القص بتنخزّن تحت رمز مُزاح — **ممنوع تخلط مع سلسلة المباشر**.

   ⚠️ السبب: الجلب بمرساة بيرجّع تاريخاً حوالين نقطة القص وبينتهي عندها
   تقريباً — يعني **ما فيه «الآن»**. لو انخزّنت بمفتاح المباشر، أول تحميل
   مباشر بيقراها كأنها سلسلته، وبيبني عليها «ذيلاً» من آخر شمعة فيها لهلق —
   فبيصير ثقب بالنص بحجم الفجوة بين نقطة القص واليوم.

   الفصل بالمفتاح بيمنع هالخلط بنيوياً بدل ما نعتمد على فحص بكل مسار.
   ============================================================================ */
export function cutCacheKey(symbol) {
  return `${symbol}@cut`;
}

/**
 * الشموع المحفوظة لهاد الرمز/الفريم، أو null لو ما في.
 * @returns {Promise<{candles: Array, savedAt: number} | null>}
 */
export async function readSeries(symbol, interval) {
  const db = await openDb();
  if (!db) return null;
  const rec = await tx(db, "readonly", (store, set) => {
    const r = store.get(cacheKey(symbol, interval));
    r.onsuccess = () => set(r.result || null);
  });
  if (!rec || !Array.isArray(rec.candles) || rec.candles.length === 0) return null;
  return { candles: rec.candles, savedAt: rec.savedAt || 0 };
}

/**
 * بيحفظ السلسلة. بيتجاهل أي فشل بصمت.
 * ⚠️ آخر شمعة **بتنشال قبل الحفظ**: وهي الشمعة الجارية (لسا ما سكّرت)،
 * فقيمها بتتغيّر لحد ما ينتهي وقتها. حفظها بيثبّت قيمة نصف مكتملة بتضل
 * غلط للأبد بالتخزين.
 */
export async function writeSeries(symbol, interval, candles) {
  if (!Array.isArray(candles) || candles.length < 2) return;
  const db = await openDb();
  if (!db) return;
  const settled = candles.slice(0, -1);
  await tx(db, "readwrite", (store) => {
    store.put({ key: cacheKey(symbol, interval), candles: settled, savedAt: Date.now() });
  });
  pruneIfNeeded(db);
}

/** بيشيل الأقدم لما يتجاوز العدد السقف. */
async function pruneIfNeeded(db) {
  const all = await tx(db, "readonly", (store, set) => {
    const r = store.getAll();
    r.onsuccess = () => set(r.result || []);
  });
  if (!all || all.length <= MAX_SERIES) return;
  const doomed = all.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0)).slice(0, all.length - MAX_SERIES);
  await tx(db, "readwrite", (store) => { for (const d of doomed) store.delete(d.key); });
}

/**
 * بيدمج شموعاً جديدة فوق محفوظة — الجديدة بتغلب عند تساوي الوقت.
 *
 * ⚠️ الدمج **بالوقت مش بالفهرس**. الفهارس بتختلف بين طلبين (مدى مختلف،
 * مرساة مختلفة)، والوقت هو المعرّف الوحيد الثابت للشمعة.
 */
export function mergeCandles(oldCandles, freshCandles) {
  if (!oldCandles?.length) return freshCandles || [];
  if (!freshCandles?.length) return oldCandles;
  const byTime = new Map();
  for (const c of oldCandles) byTime.set(c.time, c);
  for (const c of freshCandles) byTime.set(c.time, c);
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/**
 * هل المحفوظ صالح كنقطة انطلاق؟
 *
 * ⚠️ مش سؤال «قديم ولا جديد» — هو «الفجوة صغيرة كفاية إنه طلب الذيل يسدّها».
 * طلب الذيل بيروح بـ`anchor`، والخادم بيرجّع من «المرساة ناقص ~٣٠٠ شمعة»
 * لحد الآن. فلو الفجوة أكبر من هيك بكتير، بيضل في ثقب بالنص — والثقب أسوأ
 * من التحميل الكامل لأنه بيمرق بصمت.
 */
export function canExtendFrom(candles, intervalSeconds, maxGapBars = 250) {
  if (!candles?.length || !intervalSeconds) return false;
  const last = candles[candles.length - 1].time;
  const gapBars = (Date.now() / 1000 - last) / intervalSeconds;
  return gapBars >= 0 && gapBars <= maxGapBars;
}
