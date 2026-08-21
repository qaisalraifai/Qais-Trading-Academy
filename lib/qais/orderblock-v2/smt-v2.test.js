/* اختبارات SMT v2.

   ⚠️ الحالات مبنيّة بالكود مش مولّدة عشوائياً — بنفحص **منطق** التباعد
   معزولاً عن كشف السوينغات. وكل اختبار بيتأكد من شرطه المسبق: إنه الحالة
   اللي بيدّعي فحصها فعلاً موجودة بالمدخل.

   ⚠️ الأدوار **انعكست** (٢٠٢٦-٠٨-٢١) بقراره «كلام اليوم هو المعتمد»:
       المترابط (S&P) **بيكنس** قاعه · الأصل الأساسي (ناسداك) **بيصمد**.
       ونقطة الـSMT = القاع اللي صمد عليه الأساسي، والستوب تحتها.
   الاختبارات تحت انكتبت من جديد على هالقاعدة — كانت بتوثّق العكس.
*/

import { test } from "node:test";
import assert from "node:assert/strict";

import { detectSMT, firstSMT, alignIndex, SMT_DEFAULTS } from "./smt-v2.js";

const H4 = 4 * 3600;
/** شموع بأوقات منتظمة؛ `dips` بتحدد قيعان مخصّصة لفهارس معيّنة. */
const mkCandles = (n, base, startTime = 0, dips = {}) =>
  Array.from({ length: n }, (_, i) => {
    const low = dips[i] ?? base - 5;
    return { time: startTime + i * H4, open: base, high: base + 5, low, close: base + 1 };
  });

const swingLow = (index, price, confirmedAtIndex) => ({ type: "low", index, price, confirmedAtIndex });
const swingHigh = (index, price, confirmedAtIndex) => ({ type: "high", index, price, confirmedAtIndex });

test("الحالة القانونية: المترابط كنس والأساسي صمد → SMT", () => {
  /* A (ناسداك): قاع مؤكَّد عند 100، وأدنى ما وصله 103 — **صمد فوقه**. */
  const A = { candles: mkCandles(30, 110, 0, { 25: 103 }), swings: [swingLow(10, 100, 12)] };
  /* B (S&P): قاع مؤكَّد عند 200، ونزل لـ195 = **كنس**. */
  const B = { candles: mkCandles(30, 210, 0, { 25: 195 }), swings: [swingLow(10, 200, 12)] };

  assert.ok(Math.min(...A.candles.map((c) => c.low)) > 100, "شرط مسبق: A صمد فوق قاعه");
  assert.ok(B.candles[25].low < 200, "شرط مسبق: B كنس قاعه");

  const r = detectSMT(A, B, 26, true);
  assert.equal(r.valid, true, r.reason || r.why);
  assert.equal(r.favors, "primary", "الإشارة مش لصالح الأصل الصامد");
  /* النقطة = أدنى قاع وصله الأساسي بالنافذة — الستوب تحتها. */
  assert.equal(r.point, 103, "نقطة الـSMT مش القاع الصامد");
  assert.equal(r.heldLevel, 100, "المستوى اللي صمد فوقه مش مسجَّل");
  assert.equal(r.sweptLevel, 200, "المستوى اللي كنسه المترابط مش مسجَّل");
  assert.equal(r.correlateExtreme, 195);
});

test("الاتنين كنسوا → ما في تباعد", () => {
  const A = { candles: mkCandles(30, 110, 0, { 25: 95 }), swings: [swingLow(10, 100, 12)] };
  const B = { candles: mkCandles(30, 210, 0, { 25: 195 }), swings: [swingLow(10, 200, 12)] };
  assert.ok(A.candles[25].low < 100 && B.candles[25].low < 200, "شرط مسبق: الاتنين كنسوا");

  const r = detectSMT(A, B, 26, true);
  assert.equal(r.valid, false, "الأساسي كنس كمان — المطلوب يصمد");
  assert.match(r.reason, /كنس/);
});

test("الأساسي كنس كمان → ما في SMT (الأدوار معكوسة)", () => {
  /* A كنس وB صمد = القاعدة **القديمة**. لازم تنرفض هلق. */
  const A = { candles: mkCandles(30, 110, 0, { 25: 95 }), swings: [swingLow(10, 100, 12)] };
  const B = { candles: mkCandles(30, 210, 0, {}), swings: [swingLow(10, 200, 12)] };
  assert.ok(A.candles[25].low < 100, "شرط مسبق: A كنس");
  assert.ok(Math.min(...B.candles.map((c) => c.low)) > 200, "شرط مسبق: B صمد");

  const r = detectSMT(A, B, 26, true);
  assert.equal(r.valid, false, "لسا بيقبل القاعدة القديمة (الأساسي بيكنس)");
  assert.match(r.reason, /المطلوب يصمد/);
});

test("الاتنين صمدوا → ما في تباعد", () => {
  const A = { candles: mkCandles(30, 110, 0, {}), swings: [swingLow(10, 100, 12)] };
  const B = { candles: mkCandles(30, 210, 0, {}), swings: [swingLow(10, 200, 12)] };
  const r = detectSMT(A, B, 26, true);
  assert.equal(r.valid, false);
  assert.match(r.reason, /المترابط ما كنس/);
});

test("سببية: سوينغ لسا ما تأكّد ما بينستعمل", () => {
  /* قاع الأساسي موجود بالبيانات بس تأكيده بعد لحظة السؤال. */
  const A = { candles: mkCandles(30, 110, 0, { 25: 103 }), swings: [swingLow(10, 100, 28)] };
  const B = { candles: mkCandles(30, 210, 0, { 25: 195 }), swings: [swingLow(10, 200, 12)] };

  const early = detectSMT(A, B, 26, true);
  assert.equal(early.value, "INSUFFICIENT_DATA", "استعمل سوينغ ما تأكّد بعد");

  /* وبعد التأكيد بيشتغل — يعني الرفض كان سببياً مش عطلاً. */
  const late = detectSMT(A, B, 28, true);
  assert.equal(late.valid, true, late.reason || late.why);
});

test("مرجع مش طازج بينرفض — الأساسي كان تحت مستواه أصلاً", () => {
  /* الأصل الأساسي نزل تحت قاعه من بدري وضل تحته: المستوى متروك ورا،
     فـ«صموده» فوقه بلا معنى. الخلل الأصلي المقيس كان بالاتجاه التاني
     (كنس بعيد بـ٢٦٧٧ نقطة)، ونفس الحارس بيمنع الحالتين. */
  const A = {
    candles: Array.from({ length: 40 }, (_, i) => ({
      time: i * H4, open: 110, high: 115, low: i >= 15 ? 90 : 105, close: 112,
    })),
    swings: [swingLow(10, 100, 12)],
  };
  const B = { candles: mkCandles(40, 210, 0, { 35: 195 }), swings: [swingLow(10, 200, 12)] };

  assert.ok(A.candles[15].low < 100, "شرط مسبق: المستوى انتجاوز بدري");
  assert.ok(A.candles[35].low < 100, "شرط مسبق: السعر لسا تحته");

  const r = detectSMT(A, B, 36, true);
  assert.equal(r.valid, false, "عدّ مستوى متروكاً ورا مرجعاً صالحاً");
  assert.match(r.reason, /متجاوَز/);
});

test("المحاذاة بالوقت مش بالفهرس", () => {
  /* B ناقصة أول ٥ شموع — فنفس اللحظة إلها فهرس مختلف. */
  const A = { candles: mkCandles(30, 110, 0, { 25: 103 }), swings: [swingLow(10, 100, 12)] };
  const B = { candles: mkCandles(25, 210, 5 * H4, { 20: 195 }), swings: [swingLow(5, 200, 7)] };

  const tA = A.candles[25].time;
  const idxB = alignIndex(B.candles, tA, SMT_DEFAULTS.maxAlignSeconds);
  assert.equal(idxB, 20, "المحاذاة ما عوّضت الإزاحة");
  assert.equal(B.candles[idxB].time, tA, "الشمعة المقابلة مش بنفس الوقت");

  const r = detectSMT(A, B, 26, true);
  assert.equal(r.valid, true, r.reason || r.why);
});

test("شمعة مقابلة مفقودة = INSUFFICIENT_DATA مش «لأ»", () => {
  const A = { candles: mkCandles(30, 110, 0, { 25: 103 }), swings: [swingLow(10, 100, 12)] };
  /* B بتوقّف قبل اللحظة بكتير. */
  const B = { candles: mkCandles(8, 210, 0, { 5: 195 }), swings: [swingLow(3, 200, 5)] };

  const r = detectSMT(A, B, 26, true);
  assert.equal(r.value, "INSUFFICIENT_DATA", "غياب البيانات انقلب رفضاً");
});

test("الاتجاه الهابط معكوس: المترابط كنس قمته والأساسي صمد", () => {
  const up = (n, base, peaks = {}) =>
    Array.from({ length: n }, (_, i) => ({
      time: i * H4, open: base, high: peaks[i] ?? base + 5, low: base - 5, close: base + 1,
    }));
  /* A (الأساسي): قمة مؤكَّدة 120، وأعلى ما وصله 117 → **صمد تحتها**. */
  const A = { candles: up(30, 110, { 25: 117 }), swings: [swingHigh(10, 120, 12)] };
  /* B (المترابط): قمة مؤكَّدة 220، وطلع لـ230 → **كنس**. */
  const B = { candles: up(30, 210, { 25: 230 }), swings: [swingHigh(10, 220, 12)] };
  assert.ok(Math.max(...A.candles.map((c) => c.high)) < 120, "شرط مسبق: A صمد تحت قمته");
  assert.ok(B.candles[25].high > 220, "شرط مسبق: B كنس قمته");

  const r = detectSMT(A, B, 26, false);
  assert.equal(r.valid, true, r.reason || r.why);
  assert.equal(r.direction, "down");
  /* بالبيعي النقطة = **أعلى قمة** وصلها الأساسي، والستوب فوقها. */
  assert.equal(r.point, 117, "نقطة الـSMT مش أعلى قمة صامدة");
  assert.equal(r.heldLevel, 120);
  assert.equal(r.sweptLevel, 220);
});

test("الكنس بالذيل مش بالإغلاق", () => {
  /* ذيل تحت القاع بس الإغلاق فوقه — كنس صحيح. */
  const A = {
    candles: Array.from({ length: 30 }, (_, i) => ({
      time: i * H4, open: 110, high: 115, low: 105, close: 112,
    })),
    swings: [swingLow(10, 100, 12)],
  };
  /* المترابط بيكنس **بالذيل** بس: ذيله تحت قاعه والإغلاق فوقه. */
  const B = {
    candles: Array.from({ length: 30 }, (_, i) => ({
      time: i * H4, open: 210, high: 215, low: i === 25 ? 195 : 205, close: 212,
    })),
    swings: [swingLow(10, 200, 12)],
  };
  assert.ok(B.candles[25].close > 200, "شرط مسبق: إغلاق المترابط فوق قاعه — الكنس بالذيل بس");

  const r = detectSMT(A, B, 26, true);
  assert.equal(r.valid, true, "كنس المترابط بالذيل ما انحسب");
});

test("firstSMT بترجّع أول لحظة مش أي لحظة", () => {
  const A = { candles: mkCandles(40, 110, 0, {}), swings: [swingLow(10, 100, 12)] };
  const B = { candles: mkCandles(40, 210, 0, { 25: 195, 30: 190 }), swings: [swingLow(10, 200, 12)] };
  const r = firstSMT(A, B, 20, true);
  assert.ok(r, "ما لقى SMT");
  assert.ok(r.atIndex <= 28, `أول SMT عند ${r.atIndex} — متأخر عن الكنس الأول`);
});

test("مدخلات ناقصة = INSUFFICIENT_DATA", () => {
  const ok = { candles: mkCandles(10, 110), swings: [swingLow(2, 100, 4)] };
  for (const [A, B] of [[null, ok], [ok, null], [{ candles: [], swings: [] }, ok], [ok, { candles: ok.candles, swings: [] }]]) {
    const r = detectSMT(A, B, 5, true);
    assert.equal(r.value, "INSUFFICIENT_DATA", "مدخل ناقص ما رجّع INSUFFICIENT_DATA");
  }
});
