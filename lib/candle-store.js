/* ════════════════════════════════════════════════════════════════════════
   lib/candle-store.js — مخزن الشموع التاريخية على الخادم
   ────────────────────────────────────────────────────────────────────────
   بقراره (٢٠٢٦-٠٨-٢٨): «المفروض احنا نجيب كل الشموع ونخزّنهم وما تكون
   بيانات حيّة زي سوق اللايف، لأن الشموع التاريخية ما رح تتغيّر».

   وهو صح: شمعة ٢٠٠٦ ما بتتغيّر أبداً، فسؤال Dukascopy عنها كل مرة هدر
   خالص — وأسوأ من هدر، لأنه بياكل حصة أرشيف **مشتركة بين كل وظائف
   Vercel**. مقيس اليوم: نفس النافذة بنفس الحجم بتنجح مرة وبتنرفض بعدها
   بدقيقة (٢٠٠٦ ✗ · ٢٠١٤ ✓ · ٢٠٢٠ ✗ · ٢٠٢٦ ✓).

   المخزن بيحوّل المشكلة من «كل طلب بيدفع من حصة مشتركة» لـ«كل نافذة
   بتنجلب مرة واحدة للأبد، ولكل المستخدمين».

   ═══ الدلاء ═══
   الدلو = `intervalSec × 180` ثانية، فكل دلو ~١٨٠ شمعة مهما كان الفريم:

       دقيقة   ٣ ساعات       ساعة     ٧.٥ يوم
       ٥ دقايق ١٥ ساعة       ٤ ساعات  ٣٠ يوم
       ١٥ دقيقة يومين        يومي     ١٨٠ يوم

   ⚠️ **الرقم ١٨٠ مقاس مش مختار.** جرّبت ١٤٤٠ أول (~١٠٠ ك.ب للصف)، وطلع
      عيب قاتل: الدلو على ٤ ساعات بيصير ٢٤٠ يوم، بينما **أصغر جلبة ناجحة
      مقيسة ٢٣٧ شمعة = ٣٩ يوم** (بعد ما يقلّص الخادم المدى للربع). يعني ولا
      دلو بيكتمل أبداً، والمخزن ما بيتعبّى ولا مرة — مخزن بشكل مخزن وبس.
      ١٨٠ بيخلّي دلو الـ٤ ساعات ٣٠ يوم، فالجلبة المقلَّصة بتملا واحداً كاملاً.

   ومدى الدلو للفريمات اللحظية بيضل **تحت عتبة الأرشيف المقيسة** (~٣٦٠ يوم)
   بفارق كبير — فأي دلو ناقص بينجلب بطلب واحد بينجح.

   ⚠️ **ما بينخزّن إلا دلو مكتمل.** الجلبة اللي بترجع ناقصة (تقليص مدى ·
      رفض جزئي · نافذة وقعت بفجوة) بتخزّن نقصها للأبد وما في شي بيصلحه
      بعدها. الشرط: النافذة المجلوبة لازم **تغطّي الدلو كله**.

   ⚠️ **والدلو اللي فيه «الآن» ما بينخزّن أبداً** — لسا عم يتعبّى.
   ════════════════════════════════════════════════════════════════════════ */

/* ⚠️ استيراد Supabase **كسول** عمداً: `supabase-server` بيجرّ `next/headers`
   ومعه بيئة Next كاملة، وهاد بيمنع فحص قواعد الدلاء بـ`node --test`. القواعد
   نقيّة وما بتحتاج قاعدة بيانات — وهي بالضبط اللي لازم تنفحص (حارس الاكتمال
   هو اللي بيمنع تجميد جلبة ناقصة للأبد). */
export const BUCKET_BARS = 180;

/** طول الدلو بالثواني لفريم طوله `intervalSec`. */
export function bucketSpanSec(intervalSec) {
  return intervalSec * BUCKET_BARS;
}

/** رقم الدلو اللي بيقع فيه وقت `ts`. */
export function bucketOf(ts, intervalSec) {
  return Math.floor(ts / bucketSpanSec(intervalSec));
}

/** كل أرقام الدلاء اللي بتغطّي [fromTs, toTs] — شاملة الطرفين. */
export function bucketsFor(fromTs, toTs, intervalSec) {
  if (!(toTs >= fromTs)) return [];
  const first = bucketOf(fromTs, intervalSec);
  const last = bucketOf(toTs, intervalSec);
  const out = [];
  for (let b = first; b <= last; b++) out.push(b);
  return out;
}

/**
 * بيقسّم شموعاً على دلائها، وبيرجّع **بس** الدلاء المكتملة.
 * @param {Array} candles شموع مرتّبة زمنياً
 * @param {number} intervalSec طول الشمعة بالثواني
 * @param {number} fetchedFrom بداية النافذة المجلوبة فعلياً (ثواني)
 * @param {number} fetchedTo نهايتها
 * @param {number} nowTs الوقت الحالي — الدلو اللي بيحويه ما بينخزّن
 */
export function completeBuckets(candles, intervalSec, fetchedFrom, fetchedTo, nowTs = Date.now() / 1000) {
  if (!Array.isArray(candles) || !candles.length) return [];
  const span = bucketSpanSec(intervalSec);
  const nowBucket = bucketOf(nowTs, intervalSec);
  const byBucket = new Map();
  for (const c of candles) {
    const b = bucketOf(c.time, intervalSec);
    if (!byBucket.has(b)) byBucket.set(b, []);
    byBucket.get(b).push(c);
  }
  const out = [];
  for (const [bucket, rows] of byBucket) {
    /* لسا عم يتعبّى — ممنوع يتجمّد. */
    if (bucket >= nowBucket) continue;
    /* النافذة المجلوبة لازم تغطّي الدلو كله، وإلا اللي عنا جزء منه بس. */
    const start = bucket * span;
    const end = start + span;
    if (fetchedFrom > start || fetchedTo < end) continue;
    out.push({ bucket, candles: rows });
  }
  return out;
}

/**
 * أطول سلسلة دلاء **متصلة** موجودة وبتحوي `target`.
 * ---------------------------------------------------------------------------
 * ⚠️ التغطية الجزئية بتنفع **بس لو متصلة**. لو خدمنا دلاء متفرقة (١٠ و١٢
 *    موجودين و١١ ناقص)، الشارت بيطلع فيه **ثقب** — وهاد أسوأ من الانتظار،
 *    لأن المستخدم بيقرا حركة سعر ما صارت.
 * بهيك بنقدر نخدم من المخزن فوراً بدل ما ننتظر المزوّد، بلا أي ثقب.
 * @param {Set<number>} have الدلاء المخزَّنة
 * @param {number} target الدلو اللي لازم يكون جوّا السلسلة (دلو المرساة)
 * @returns {{from: number, to: number}|null}
 */
export function contiguousAround(have, target) {
  if (!have || !have.has(target)) return null;
  let from = target;
  let to = target;
  while (have.has(from - 1)) from--;
  while (have.has(to + 1)) to++;
  return { from, to };
}

/* ══════════════ الوصول لقاعدة البيانات ══════════════ */

async function client() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const { createAdminClient } = await import("./supabase-server.js");
    return createAdminClient();
  } catch {
    return null;
  }
}

/**
 * بيقرا الشموع المخزَّنة اللي بتغطّي [fromTs, toTs].
 * @returns {Promise<{candles: Array, have: Set<number>, want: number[]}>}
 */
export async function readRange(symbol, interval, intervalSec, fromTs, toTs) {
  const want = bucketsFor(fromTs, toTs, intervalSec);
  const empty = { candles: [], have: new Set(), want, status: "off" };
  if (!want.length) return empty;
  const db = await client();
  if (!db) return empty;
  try {
    const { data, error } = await db
      .from("candle_cache")
      .select("bucket, candles")
      .eq("symbol", symbol)
      .eq("interval", interval)
      .gte("bucket", want[0])
      .lte("bucket", want[want.length - 1]);
    /* خطأ الاستعلام = الجدول غالباً ما انعمل. تمييزه عن «ما في بيانات»
       بيشيل التخمين: بلاه ما في فرق ظاهر بين مخزن فاضي ومخزن مش موجود. */
    if (error) return { ...empty, status: "error", detail: String(error.message || error).slice(0, 120) };
    if (!data?.length) return { ...empty, status: "miss" };
    const have = new Set();
    const all = [];
    for (const row of data) {
      have.add(Number(row.bucket));
      if (Array.isArray(row.candles)) all.push(...row.candles);
    }
    all.sort((a, b) => a.time - b.time);
    return { candles: all.filter((c) => c.time >= fromTs && c.time <= toTs), have, want, status: "hit" };
  } catch {
    /* المخزن تحسين — فشله ما بيوقف الطلب، بينزل للمزوّد زي قبل. */
    return empty;
  }
}

/** بيخزّن الدلاء المكتملة وبس. بيرجّع عددها. */
export async function writeRange(symbol, interval, intervalSec, candles, fetchedFrom, fetchedTo) {
  const db = await client();
  if (!db) return 0;
  const buckets = completeBuckets(candles, intervalSec, fetchedFrom, fetchedTo);
  if (!buckets.length) return 0;
  try {
    const rows = buckets.map((b) => ({
      symbol,
      interval,
      bucket: b.bucket,
      bars: b.candles.length,
      candles: b.candles,
    }));
    const { error } = await db.from("candle_cache").upsert(rows, { onConflict: "symbol,interval,bucket" });
    return error ? 0 : rows.length;
  } catch {
    return 0;
  }
}
