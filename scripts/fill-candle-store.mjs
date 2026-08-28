/* ════════════════════════════════════════════════════════════════════════
   scripts/fill-candle-store.mjs — تعبئة مخزن الشموع من جهاز محلي
   ────────────────────────────────────────────────────────────────────────
   ليش هالسكربت موجود: التعبئة من جلسة المستخدم **ما بتكفي**. مقيس على
   الإنتاج (ذهب · ٤ ساعات):

       rounds ["1:+475", "2.1:رفض" … "7.3:رفض"]

   الجولة الأولى نجحت وبعدها ١٨ رفضاً متتالياً — يعني رقم خروج Vercel
   (مشترك بين وظائف كتيرة) بياخد نافذة وحدة ثم بينقفل. الجلسة الوحدة بتجيب
   ~دلوين، و٢٠٠٣→٢٠٠٨ بده ٦٠ دلو. بهالمعدّل ما بنوصل أبداً.

   بينما نفس الطلب من جهاز محلي مقيس **٨٠٠ شمعة بـ٤٢٠ ملّي ثانية**.

   فالتعبئة بتصير مرة وحدة من هون، وبعدها التطبيق بيخدم من القاعدة للأبد
   ولكل المستخدمين — بلا ما يلمس الأرشيف.

   ⚠️ بيكتب **بس** الدلاء المكتملة (نفس حارس `completeBuckets`)، وبيتخطّى
      الموجود، وبيتراجع عند الرفض.

   التشغيل:
       node scripts/fill-candle-store.mjs xauusd 4h 2003
       node scripts/fill-candle-store.mjs <رمز-dukascopy> <فريم> <سنة-البداية>
   ════════════════════════════════════════════════════════════════════════ */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getHistoricalRates } from "dukascopy-node";
import { completeBuckets, bucketSpanSec, bucketOf } from "../lib/candle-store.js";

/* ── مفاتيح البيئة من .env.local (بلا طباعتها) ── */
const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const SYMBOL = process.argv[2] || "xauusd";
const TF_APP = process.argv[3] || "4h";
const FROM_YEAR = Number(process.argv[4] || 2003);
const LIMIT = Number(process.argv[5] || 0); // 0 = بلا حد

const TF_DUK = { "1min": "m1", "5min": "m5", "15min": "m15", "1h": "h1", "4h": "h4", "1day": "d1" }[TF_APP];
const SECS = { "1min": 60, "5min": 300, "15min": 900, "1h": 3600, "4h": 14400, "1day": 86400 }[TF_APP];
if (!TF_DUK) throw new Error(`فريم غير مدعوم: ${TF_APP}`);

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const span = bucketSpanSec(SECS);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const d = (s) => new Date(s * 1000).toISOString().slice(0, 10);

/* آخر دلو مكتمل (الدلو اللي فيه «الآن» لسا عم يتعبّى). */
const nowBucket = bucketOf(Date.now() / 1000 - 2 * 3600, SECS);
const firstBucket = bucketOf(Date.UTC(FROM_YEAR, 0, 1) / 1000, SECS);

console.log(`${SYMBOL} · ${TF_APP} · دلو = ${Math.round(span / 86400)} يوم`);
console.log(`المدى: ${d(firstBucket * span)} → ${d(nowBucket * span)}  (${nowBucket - firstBucket} دلو)\n`);

/* ── الموجود أصلاً ── */
const { data: existing, error: readErr } = await db
  .from("candle_cache")
  .select("bucket")
  .eq("symbol", SYMBOL)
  .eq("interval", TF_APP)
  .gte("bucket", firstBucket)
  .lte("bucket", nowBucket);
if (readErr) throw new Error(`قراءة المخزن فشلت: ${readErr.message}`);
const have = new Set((existing || []).map((r) => Number(r.bucket)));
console.log(`موجود: ${have.size} دلو · ناقص: ${nowBucket - firstBucket - have.size}\n`);

let gap = 700;
let wrote = 0;
let failed = 0;
let done = 0;

/* من الأحدث للأقدم — الأقرب للحاضر أنفع للمستخدم أول. */
for (let b = nowBucket - 1; b >= firstBucket; b--) {
  if (have.has(b)) continue;
  if (LIMIT && done >= LIMIT) break;
  done++;

  const from = new Date(b * span * 1000);
  const to = new Date((b + 1) * span * 1000);
  let raw = null;
  let err = "";
  try {
    raw = await getHistoricalRates({
      instrument: SYMBOL,
      dates: { from, to },
      timeframe: TF_DUK,
      priceType: "bid",
      format: "json",
      volumes: true,
      ignoreFlats: true,
      useCache: false,
      batchSize: 20,
      pauseBetweenBatchesMs: 150,
      retryCount: 2,
      pauseBetweenRetriesMs: 400,
    });
  } catch (e) {
    err = (e?.message || String(e)).slice(0, 40);
  }

  if (!raw?.length) {
    failed++;
    /* رفض = نتراجع. فاضي بلا خطأ = ما في بيانات بهالمدى (قبل بداية الأداة). */
    if (err) gap = Math.min(20000, Math.round(gap * 2));
    console.log(`  ✗ ${d(b * span)}  ${err || "فاضي"}`);
    await sleep(gap);
    continue;
  }

  const candles = raw
    .map((v) => ({
      time: Math.floor(v.timestamp / 1000),
      open: Number(v.open), high: Number(v.high), low: Number(v.low), close: Number(v.close),
      volume: Number.isFinite(Number(v.volume)) ? Number(v.volume) : 0,
    }))
    .filter((c) => [c.time, c.open, c.high, c.low, c.close].every(Number.isFinite))
    .sort((x, y) => x.time - y.time);

  /* نفس حارس الاكتمال المستعمل بالخادم — بلا تكرار منطق. */
  const rows = completeBuckets(candles, SECS, b * span, (b + 1) * span, Date.now() / 1000);
  if (!rows.length) {
    failed++;
    console.log(`  ⚠ ${d(b * span)}  ${candles.length} شمعة بس الدلو مش مكتمل`);
    await sleep(gap);
    continue;
  }

  const { error } = await db.from("candle_cache").upsert(
    rows.map((r) => ({ symbol: SYMBOL, interval: TF_APP, bucket: r.bucket, bars: r.candles.length, candles: r.candles })),
    { onConflict: "symbol,interval,bucket" }
  );
  if (error) {
    console.log(`  ✗ ${d(b * span)}  كتابة فشلت: ${error.message.slice(0, 50)}`);
    failed++;
  } else {
    wrote += rows.length;
    gap = Math.max(400, Math.round(gap * 0.8));
    console.log(`  ✓ ${d(b * span)}  ${rows[0].candles.length} شمعة  (المجموع ${wrote})`);
  }
  await sleep(gap);
}

console.log(`\n>>> انكتب ${wrote} دلو · فشل ${failed} · من ${done} محاولة`);
