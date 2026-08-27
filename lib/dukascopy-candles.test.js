import { test } from "node:test";
import assert from "node:assert/strict";
import { toCandles, fetchDukascopyCandles } from "./dukascopy-candles.js";

/* ══════════════════════════════════════════════════════════════════════
   🔴 العطل المقيس — مسار النجاح كان بلا أي اختبار

   شيل استكمال العمق (`4b61026`) حذف معه كتلة تحويل مخرج المكتبة، وضلّ
   الـ`return` تحت بيشير لـ`candles` المحذوفة → `ReferenceError` على **كل
   جلب ناجح** → 500 على كل طلب Dukascopy شغّال.

   ⚠️ `npm run build` مرق نظيف و٣٨٤ اختبار نجحوا. متغيّر غير معرّف جوّا جسم
   دالة عطل **تشغيل**، وهالملف ما كان عليه ولا اختبار — فمسار النجاح كله
   كان عمياً. هالملف بيسدّها.
   ══════════════════════════════════════════════════════════════════════ */

const row = (tsMs, o = 1, h = 2, l = 0.5, c = 1.5, v = 10) => ({
  timestamp: tsMs,
  open: o,
  high: h,
  low: l,
  close: c,
  volume: v,
});

test("🔴 التحويل موجود وبيشتغل — الكتلة اللي انحذفت", () => {
  assert.equal(typeof toCandles, "function", "الدالة انحذفت مرة — لازم تضل مصدَّرة");
  const out = toCandles([row(1_700_000_000_000)]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], { time: 1_700_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 });
});

test("الطابع بينتحوّل من ملّي لثانية", () => {
  /* المكتبة بترجّع ملّي ثانية، وlightweight-charts بدها ثواني. الخلط بيطلّع
     تواريخ سنة ٥٤٠٠٠ بلا أي خطأ. */
  assert.equal(toCandles([row(1_600_000_123_456)])[0].time, 1_600_000_123);
});

test("الصفوف الفاسدة بتنرمى مش بتمرق كـNaN", () => {
  const out = toCandles([
    row(1_700_000_000_000),
    { timestamp: 1_700_000_100_000, open: "x", high: 2, low: 1, close: 1.5 },
    { timestamp: NaN, open: 1, high: 2, low: 1, close: 1.5 },
    row(1_700_000_200_000),
  ]);
  assert.equal(out.length, 2, "بس الصفّان السليمان");
  assert.ok(out.every((c) => Number.isFinite(c.open) && Number.isFinite(c.time)));
});

test("المخرج مرتّب زمنياً", () => {
  const out = toCandles([row(1_700_000_200_000), row(1_700_000_000_000), row(1_700_000_100_000)]);
  for (let i = 1; i < out.length; i++) assert.ok(out[i].time > out[i - 1].time, `مش مرتّب عند ${i}`);
});

test("الطوابع المكرّرة بتنشال", () => {
  const out = toCandles([row(1_700_000_000_000, 1), row(1_700_000_000_000, 9), row(1_700_000_100_000)]);
  assert.equal(out.length, 2);
});

test("الحجم الناقص بيصير صفر مش NaN", () => {
  const out = toCandles([{ timestamp: 1_700_000_000_000, open: 1, high: 2, low: 1, close: 1.5 }]);
  assert.equal(out[0].volume, 0);
});

test("مدخل فاضي أو غير مصفوفة بيرجّع مصفوفة فاضية", () => {
  assert.deepEqual(toCandles([]), []);
  assert.deepEqual(toCandles(null), []);
  assert.deepEqual(toCandles(undefined), []);
  assert.deepEqual(toCandles("مش مصفوفة"), []);
});

/* ══════════════ الرفض المبكّر — بلا شبكة ══════════════ */

test("فريم غير مدعوم بيرجّع خطأ مش رمية", async () => {
  const out = await fetchDukascopyCandles("xauusd", "7min");
  assert.match(out.error, /فريم غير مدعوم/);
});

test("رمز ناقص بيرجّع خطأ مش رمية", async () => {
  const out = await fetchDukascopyCandles("", "4h");
  assert.match(out.error, /لا يوجد رمز/);
});

/* ══════════════════════════════════════════════════════════════════════
   مسار النجاح — هون بالضبط وقع العطل

   بلا حقن `getRates` هالمسار بيحتاج شبكة، فما كان ينفحص أبداً. متحقَّق
   بالطفرة: حذف `const candles = toCandles(raw)` بيفشّل الاختبارات تحت.
   ══════════════════════════════════════════════════════════════════════ */

/** مزوّد مزيّف: بيرمي 429 لأول `failFirst` محاولة وبعدها بينجح. */
function fakeRates(bars, failFirst = 0) {
  let calls = 0;
  const fn = async () => {
    fn.calls = ++calls;
    if (calls <= failFirst) throw new Error("Request failed with status 429");
    return bars;
  };
  fn.calls = 0;
  return fn;
}

const H4 = 4 * 3600 * 1000;

test("🔴 الجلب الناجح بيرجّع شموع — مش ReferenceError", async () => {
  const base = Date.UTC(2024, 0, 1);
  const bars = Array.from({ length: 50 }, (_, i) => row(base + i * H4));
  const out = await fetchDukascopyCandles("usatechidxusd", "4h", 1000, null, 0, { getRates: fakeRates(bars) });

  assert.equal(out.error, undefined, `رجع خطأ: ${out.error}`);
  assert.equal(out.candles.length, 50);
  assert.equal(out.candles[0].time, Math.floor(base / 1000), "بالثواني مش الملّي");
  assert.equal(out.duk.bars, 50);
});

test("بيقصّ لآخر `count` شمعة", async () => {
  const base = Date.UTC(2024, 0, 1);
  const bars = Array.from({ length: 200 }, (_, i) => row(base + i * H4));
  const out = await fetchDukascopyCandles("usatechidxusd", "4h", 30, null, 0, { getRates: fakeRates(bars) });

  assert.equal(out.candles.length, 30);
  assert.equal(out.candles.at(-1).time, Math.floor((base + 199 * H4) / 1000), "آخر شمعة مش أول وحدة");
});

test("رفض 429 بيقلّص المدى وبيكمل — والتقليص بيطلع بالتتبّع", async () => {
  const base = Date.UTC(2024, 0, 1);
  const bars = Array.from({ length: 10 }, (_, i) => row(base + i * H4));
  const rates = fakeRates(bars, 1); // الأولى بترفض، التانية بتنجح
  const out = await fetchDukascopyCandles("usatechidxusd", "4h", 1000, null, 0, { getRates: rates });

  assert.equal(rates.calls, 2, "لازم يعيد المحاولة بمدى أقصر");
  assert.equal(out.candles.length, 10);
  assert.ok(out.duk.spanFactor < 1, `التقليص لازم يكون معلَن — طلع ${out.duk.spanFactor}`);
});

test("الرفض الكامل بيرجّع خطأ مش رمية", async () => {
  const out = await fetchDukascopyCandles("usatechidxusd", "4h", 1000, null, 0, { getRates: fakeRates([], 99) });
  assert.match(out.error, /429/);
  assert.equal(out.candles, undefined);
});

test("خطأ مش 429 بيوقف فوراً بلا محاولات ميؤوسة", async () => {
  const rates = fakeRates([], 99);
  const boom = async () => {
    rates.calls++;
    throw new Error("رمز غير مدعوم");
  };
  boom.calls = 0;
  await fetchDukascopyCandles("nope", "4h", 1000, null, 0, { getRates: boom });
  assert.equal(rates.calls, 1, "محاولة وحدة بس — التقليص ما بيصلّح رمزاً غلط");
});

test("كل الشموع فاسدة = خطأ صريح مش مصفوفة فاضية", async () => {
  const junk = [{ timestamp: 1, open: "x", high: "y", low: "z", close: "w" }];
  const out = await fetchDukascopyCandles("usatechidxusd", "4h", 1000, null, 0, { getRates: fakeRates(junk) });
  assert.match(out.error, /غير صالحة/);
});

/* ══════════════════════════════════════════════════════════════════════
   🔴 سقف المدى — الطلب اللي كان بيحرق ميزانية الأرشيف

   العتبة مقيسة: ٣٦٠ يوم ✓ · ٤٠٠ و٤٨٠ ✗. والتسخين الخلفي بيطلب
   `count=3000`، وهي على ٤ ساعات **٦٧٥ يوم** — ضعف العتبة.
   ══════════════════════════════════════════════════════════════════════ */

const DAY_MS = 86400000;

/** بيسجّل المدى المطلوب فعلياً بدل ما يجيب شي. */
function spyRates(bars = []) {
  const fn = async ({ dates }) => {
    fn.days = (dates.to - dates.from) / DAY_MS;
    fn.from = dates.from;
    fn.to = dates.to;
    return bars.length ? bars : [row(dates.to.getTime() - DAY_MS)];
  };
  return fn;
}

test("🔴 count=3000 على ٤ ساعات — ٦٧٥ يوم بينقصّ لـ٣٠٠", async () => {
  const spy = spyRates();
  await fetchDukascopyCandles("usatechidxusd", "4h", 3000, null, 0, { getRates: spy });
  assert.ok(spy.days <= 300, `المدى المطلوب ${Math.round(spy.days)} يوم — فوق السقف`);
});

test("🔴 والمرساة داخلة بالحساب — الهامش بيضيف ٥٠ يوم على ٤ ساعات", async () => {
  const spy = spyRates();
  const anchor = Math.floor(Date.UTC(2024, 5, 15) / 1000);
  await fetchDukascopyCandles("usatechidxusd", "4h", 3000, anchor, 0, { getRates: spy });
  assert.ok(spy.days <= 300, `بمرساة: ${Math.round(spy.days)} يوم — السقف لازم يكون على المدى الكامل`);
});

test("المدى السليم ما بينمسّ — count=1000 على ٤ ساعات", async () => {
  /* ٢٥٨ يوم بمرساة: تحت السقف أصلاً، فالسقف ما إله يقصّه. */
  const spy = spyRates();
  const anchor = Math.floor(Date.UTC(2024, 5, 15) / 1000);
  await fetchDukascopyCandles("usatechidxusd", "4h", 1000, anchor, 0, { getRates: spy });
  assert.ok(spy.days > 250 && spy.days <= 300, `طلع ${Math.round(spy.days)} يوم — كان لازم يضل ~٢٥٨`);
});

test("⚠️ اليومي مستثنى — ملفات شهرية، مقيس ١١٧٠ يوم بـ315ms", async () => {
  const spy = spyRates();
  await fetchDukascopyCandles("usatechidxusd", "1day", 1000, null, 0, { getRates: spy });
  assert.ok(spy.days > 1000, `اليومي انقصّ لـ${Math.round(spy.days)} يوم — بيخسر عمقاً بلا سبب`);
});

test("الفريمات اللحظية التانية ما بتتأثّر", async () => {
  for (const [tf, maxDays] of [["15min", 45], ["1h", 175]]) {
    const spy = spyRates();
    await fetchDukascopyCandles("usatechidxusd", tf, 3000, null, 0, { getRates: spy });
    assert.ok(spy.days <= maxDays, `${tf}: ${Math.round(spy.days)} يوم`);
    assert.ok(spy.days <= 300, `${tf} فوق السقف`);
  }
});
