import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketSpanSec, bucketOf, bucketsFor, completeBuckets, contiguousAround, BUCKET_BARS } from "./candle-store.js";

const H4 = 4 * 3600;
const M1 = 60;
const DAY = 86400;

/* ══════════════ حجم الدلو ══════════════ */

test("الدلو ~١٨٠ شمعة لأي فريم — فحجم الصف ثابت تقريباً", () => {
  for (const sec of [M1, 300, 900, 3600, H4, DAY]) {
    assert.equal(bucketSpanSec(sec) / sec, BUCKET_BARS);
  }
});

test("مدى الدلو اللحظي تحت عتبة الأرشيف المقيسة (~٣٦٠ يوم)", () => {
  /* الفريمات اللحظية بتنبني من ملفات أرشيف يومية، فالكلفة بعدد الأيام.
     أي دلو ناقص لازم ينجلب بطلب **واحد بينجح**. */
  for (const sec of [M1, 300, 900, 3600, H4]) {
    const days = bucketSpanSec(sec) / DAY;
    assert.ok(days <= 360, `فريم ${sec}s: دلو ${Math.round(days)} يوم — فوق العتبة`);
  }
  assert.equal(bucketSpanSec(H4) / DAY, 30, "٤ ساعات = ٣٠ يوم");
});

test("bucketsFor بتغطّي الطرفين", () => {
  const span = bucketSpanSec(H4);
  const from = 10 * span + 5;
  const to = 12 * span + 5;
  assert.deepEqual(bucketsFor(from, to, H4), [10, 11, 12]);
  assert.deepEqual(bucketsFor(from, from, H4), [10]);
  assert.deepEqual(bucketsFor(to, from, H4), [], "مدى مقلوب = فاضي");
});

test("bucketOf ثابت داخل الدلو", () => {
  const span = bucketSpanSec(H4);
  assert.equal(bucketOf(7 * span, H4), 7);
  assert.equal(bucketOf(7 * span + span - 1, H4), 7);
  assert.equal(bucketOf(8 * span, H4), 8);
});

/* ══════════════ 🔴 حارس الاكتمال ══════════════ */

const span = bucketSpanSec(H4);
const bar = (t) => ({ time: t, open: 1, high: 2, low: 0.5, close: 1.5 });
/** شموع تملأ الدلو رقم `b`. */
const fill = (b, n = 20) => Array.from({ length: n }, (_, i) => bar(b * span + i * H4));
const NOW = 100 * span;

test("🔴 الدلو الناقص ما بينخزّن — النقص بينجمّد للأبد لو انخزّن", () => {
  /* مقيس على الإنتاج: التقليص رجّع ٢٣٧ شمعة من ٨٠٠ مطلوبة. تخزين هالرد
     بيجمّد النافذة الضحلة وما في إعادة بتصلحها. */
  const rows = completeBuckets(fill(10), H4, 10 * span + span / 2, 11 * span, NOW);
  assert.equal(rows.length, 0, "النافذة بتبلّش بنص الدلو — ما بتغطّيه");
});

test("الدلو المغطّى بالكامل بينخزّن", () => {
  const rows = completeBuckets(fill(10), H4, 10 * span, 11 * span, NOW);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bucket, 10);
});

test("النهاية الناقصة بترمي الدلو كمان", () => {
  const rows = completeBuckets(fill(10), H4, 10 * span, 11 * span - 1, NOW);
  assert.equal(rows.length, 0, "ناقص ثانية وحدة = ناقص");
});

test("🔴 دلو «الآن» ما بينخزّن أبداً — لسا عم يتعبّى", () => {
  const nowBucket = bucketOf(NOW, H4);
  const rows = completeBuckets(fill(nowBucket), H4, nowBucket * span, (nowBucket + 1) * span, NOW);
  assert.equal(rows.length, 0);
});

test("والدلاء المستقبلية كمان مرفوضة", () => {
  const b = bucketOf(NOW, H4) + 3;
  const rows = completeBuckets(fill(b), H4, b * span, (b + 1) * span, NOW);
  assert.equal(rows.length, 0);
});

test("جلبة على عدة دلاء: المكتمل بينخزّن والناقص لأ", () => {
  /* النافذة بتبلّش بنص الدلو ١٠ وبتنتهي بنص الدلو ١٣ — فالمكتملان ١١ و١٢. */
  const candles = [...fill(10), ...fill(11), ...fill(12), ...fill(13)];
  const rows = completeBuckets(candles, H4, 10 * span + 5, 13 * span + 5, NOW);
  assert.deepEqual(rows.map((r) => r.bucket).sort((a, b) => a - b), [11, 12]);
});

test("كل شمعة بتروح لدلوها", () => {
  const candles = [...fill(11, 3), ...fill(12, 4)];
  const rows = completeBuckets(candles, H4, 11 * span, 13 * span, NOW);
  const byBucket = Object.fromEntries(rows.map((r) => [r.bucket, r.candles.length]));
  assert.equal(byBucket[11], 3);
  assert.equal(byBucket[12], 4);
});

/* ══════════════ 🔴 التغطية الجزئية — بلا ثقوب ══════════════ */

test("🔴 السلسلة المتصلة بس — الدلاء المتفرقة بتعمل ثقب بالشارت", () => {
  /* لو خدمنا ١٠ و١٢ والـ١١ ناقص، المستخدم بيقرا حركة سعر **ما صارت**.
     أسوأ من الانتظار بكتير. */
  const have = new Set([8, 9, 10, 12, 13]);
  assert.deepEqual(contiguousAround(have, 10), { from: 8, to: 10 }, "بتوقف عند الثقب");
  assert.deepEqual(contiguousAround(have, 12), { from: 12, to: 13 });
});

test("دلو المرساة نفسه لازم يكون موجود", () => {
  assert.equal(contiguousAround(new Set([8, 9, 11]), 10), null, "المرساة نفسها ناقصة = ما بنخدم");
  assert.equal(contiguousAround(new Set(), 5), null);
  assert.equal(contiguousAround(null, 5), null);
});

test("التغطية الكاملة بترجّع المدى كله", () => {
  assert.deepEqual(contiguousAround(new Set([1, 2, 3, 4, 5]), 3), { from: 1, to: 5 });
});

test("دلو وحيد بيرجّع حاله", () => {
  assert.deepEqual(contiguousAround(new Set([7]), 7), { from: 7, to: 7 });
});

test("مدخل فاضي بيرجّع فاضي", () => {
  assert.deepEqual(completeBuckets([], H4, 0, span, NOW), []);
  assert.deepEqual(completeBuckets(null, H4, 0, span, NOW), []);
});
