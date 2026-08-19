/* اختبارات SMT v2.

   ⚠️ الحالات مبنيّة بالكود مش مولّدة عشوائياً — بنفحص **منطق** التباعد
   معزولاً عن كشف السوينغات. وكل اختبار بيتأكد من شرطه المسبق: إنه الحالة
   اللي بيدّعي فحصها فعلاً موجودة بالمدخل.

   الاختبار الأهم: الحالة اللي الوحدة القديمة **ما بتقدر** تكشفها —
   «الأساسي كنس والمترابط ما كنس» — لازم ترجع valid هون.
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

test("الحالة القانونية: الأساسي كنس والمترابط ما كنس → SMT", () => {
  /* A: قاع مؤكَّد عند 100، وبعدين نزل لـ95 = كنس. */
  const A = { candles: mkCandles(30, 110, 0, { 25: 95 }), swings: [swingLow(10, 100, 12)] };
  /* B: قاع مؤكَّد عند 200، وما نزل تحته إطلاقاً. */
  const B = { candles: mkCandles(30, 210, 0, {}), swings: [swingLow(10, 200, 12)] };

  /* شرط مسبق: A فعلاً كنس وB فعلاً ما كنس. */
  assert.ok(A.candles[25].low < 100, "شرط مسبق: A كنس قاعه");
  assert.ok(Math.min(...B.candles.map((c) => c.low)) > 200, "شرط مسبق: B ما كنس قاعه");

  const r = detectSMT(A, B, 26, true);
  assert.equal(r.valid, true, r.reason || r.why);
  assert.equal(r.favors, "primary", "الإشارة مش لصالح الأصل الأساسي");
  assert.equal(r.point, 95, "نقطة الـSMT مش أقصى امتداد للكنس");
  assert.equal(r.sweptLevel, 100);
  assert.equal(r.correlateHeld, 200);
});

test("الاتنين كنسوا → ما في تباعد", () => {
  const A = { candles: mkCandles(30, 110, 0, { 25: 95 }), swings: [swingLow(10, 100, 12)] };
  const B = { candles: mkCandles(30, 210, 0, { 25: 195 }), swings: [swingLow(10, 200, 12)] };
  assert.ok(A.candles[25].low < 100 && B.candles[25].low < 200, "شرط مسبق: الاتنين كنسوا");

  const r = detectSMT(A, B, 26, true);
  assert.equal(r.valid, false);
  assert.match(r.reason, /الاتنين/);
});

test("الأساسي ما كنس → ما في SMT", () => {
  const A = { candles: mkCandles(30, 110, 0, {}), swings: [swingLow(10, 100, 12)] };
  const B = { candles: mkCandles(30, 210, 0, {}), swings: [swingLow(10, 200, 12)] };
  assert.ok(Math.min(...A.candles.map((c) => c.low)) > 100, "شرط مسبق: A ما كنس");

  const r = detectSMT(A, B, 26, true);
  assert.equal(r.valid, false);
  assert.match(r.reason, /ما كنس/);
});

test("سببية: سوينغ لسا ما تأكّد ما بينستعمل", () => {
  /* القاع موجود بالبيانات بس تأكيده بعد لحظة السؤال. */
  const A = { candles: mkCandles(30, 110, 0, { 25: 95 }), swings: [swingLow(10, 100, 28)] };
  const B = { candles: mkCandles(30, 210, 0, {}), swings: [swingLow(10, 200, 12)] };

  const early = detectSMT(A, B, 26, true);
  assert.equal(early.value, "INSUFFICIENT_DATA", "استعمل سوينغ ما تأكّد بعد");

  /* وبعد التأكيد بيشتغل — يعني الرفض كان سببياً مش عطلاً.
     ⚠️ السؤال عند ٢٨: التأكيد صار (28 ≤ 28) والكنس (@25) لسا جوّا نافذة
     التزامن. لو سألنا عند ٣٠، الكنس بيطلع برّا النافذة وبينرفض لسبب
     تاني تماماً — وهاد سلوك صحيح مش عطل. */
  const late = detectSMT(A, B, 28, true);
  assert.equal(late.valid, true, late.reason || late.why);

  /* وتأكيد إنه الرفض بعد النافذة سببه النافذة مش التأكيد. */
  const tooLate = detectSMT(A, B, 30, true);
  assert.equal(tooLate.valid, false);
  assert.match(tooLate.reason, /ما كنس/, "الرفض خارج النافذة إجا بسبب غلط");
});

test("المحاذاة بالوقت مش بالفهرس", () => {
  /* B ناقصة أول ٥ شموع — فنفس اللحظة إلها فهرس مختلف. */
  const A = { candles: mkCandles(30, 110, 0, { 25: 95 }), swings: [swingLow(10, 100, 12)] };
  const B = { candles: mkCandles(25, 210, 5 * H4, {}), swings: [swingLow(5, 200, 7)] };

  const tA = A.candles[25].time;
  const idxB = alignIndex(B.candles, tA, SMT_DEFAULTS.maxAlignSeconds);
  assert.equal(idxB, 20, "المحاذاة ما عوّضت الإزاحة");
  assert.equal(B.candles[idxB].time, tA, "الشمعة المقابلة مش بنفس الوقت");

  const r = detectSMT(A, B, 26, true);
  assert.equal(r.valid, true, r.reason || r.why);
});

test("شمعة مقابلة مفقودة = INSUFFICIENT_DATA مش «لأ»", () => {
  const A = { candles: mkCandles(30, 110, 0, { 25: 95 }), swings: [swingLow(10, 100, 12)] };
  /* B بتوقّف قبل لحظة الكنس بكتير. */
  const B = { candles: mkCandles(8, 210, 0, {}), swings: [swingLow(3, 200, 5)] };

  const r = detectSMT(A, B, 26, true);
  assert.equal(r.value, "INSUFFICIENT_DATA", "غياب البيانات انقلب رفضاً");
});

test("الاتجاه الهابط معكوس: كنس قمة", () => {
  const up = (n, base, dips = {}) =>
    Array.from({ length: n }, (_, i) => ({
      time: i * H4, open: base, high: dips[i] ?? base + 5, low: base - 5, close: base + 1,
    }));
  const A = { candles: up(30, 110, { 25: 130 }), swings: [swingHigh(10, 120, 12)] };
  const B = { candles: up(30, 210, {}), swings: [swingHigh(10, 220, 12)] };
  assert.ok(A.candles[25].high > 120, "شرط مسبق: A كنس قمته");
  assert.ok(Math.max(...B.candles.map((c) => c.high)) < 220, "شرط مسبق: B ما كنس قمته");

  const r = detectSMT(A, B, 26, false);
  assert.equal(r.valid, true, r.reason || r.why);
  assert.equal(r.direction, "down");
  assert.equal(r.point, 130, "نقطة الـSMT مش أقصى امتداد للكنس لفوق");
});

test("الكنس بالذيل مش بالإغلاق", () => {
  /* ذيل تحت القاع بس الإغلاق فوقه — كنس صحيح. */
  const A = {
    candles: Array.from({ length: 30 }, (_, i) => ({
      time: i * H4, open: 110, high: 115, low: i === 25 ? 95 : 105, close: 112,
    })),
    swings: [swingLow(10, 100, 12)],
  };
  const B = { candles: mkCandles(30, 210, 0, {}), swings: [swingLow(10, 200, 12)] };
  assert.ok(A.candles[25].close > 100, "شرط مسبق: الإغلاق فوق القاع — الكنس بالذيل بس");

  const r = detectSMT(A, B, 26, true);
  assert.equal(r.valid, true, "الكنس بالذيل ما انحسب");
});

test("firstSMT بترجّع أول لحظة مش أي لحظة", () => {
  const A = { candles: mkCandles(40, 110, 0, { 25: 95, 30: 90 }), swings: [swingLow(10, 100, 12)] };
  const B = { candles: mkCandles(40, 210, 0, {}), swings: [swingLow(10, 200, 12)] };
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
