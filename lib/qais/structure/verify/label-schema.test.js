/* ============================================================================
   اختبارات منطق التسمية — `node --test lib/qais/structure/verify/label-schema.test.js`

   الادعاء المركزي اللي بينفحص هون:
   **مستوى خط الحدث = سعر السوينغ المكسور، ولا علاقة له بشمعة الكسر.**
   ============================================================================ */

import test from "node:test";
import assert from "node:assert/strict";

import { detectPivots, swingCandidates, lineLevelOf, normalizeEvent } from "./label-schema.js";

const H4 = 14400;
const T0 = 1700000000;
const at = (i) => T0 + i * H4;

/* شموع بقمة واضحة عند ١٠ (قمة 120) وقاع واضح عند ٢٠ (قاع 80)،
   وشمعة كسر عند ٣٠ بتغلق فوق 120 بكتير. */
function build() {
  const c = [];
  for (let i = 0; i < 40; i++) {
    let high = 105, low = 95, open = 100, close = 100;
    if (i === 10) { high = 120; low = 108; open = 110; close = 118; }
    if (i === 20) { high = 92; low = 80; open = 90; close = 82; }
    if (i === 30) { high = 140; low = 118; open = 119; close = 138; }
    c.push({ time: at(i), open, high, low, close });
  }
  return c;
}
const candles = build();

/* ============================================================================
   ١) الادعاء المركزي
   ============================================================================ */
test("مستوى الخط = سعر السوينغ المكسور، مش سعر شمعة الحدث", () => {
  const evt = normalizeEvent(
    {
      time: at(30), // شمعة الكسر: high 140 · low 118 · close 138
      type: "BOS",
      direction: "up",
      brokenSwingTime: at(10),
      brokenSwingPrice: 120, // قمة السوينغ المكسور
      reason: "إغلاق فوق قمة 120",
    },
    candles
  );

  assert.equal(lineLevelOf(evt), 120, "الخط لازم يكون عند مستوى السوينغ");

  const breaker = candles[30];
  for (const wrong of [breaker.high, breaker.low, breaker.close, breaker.open]) {
    assert.notEqual(lineLevelOf(evt), wrong, `الخط انربط بسعر شمعة الكسر (${wrong})`);
  }
  assert.equal(evt.price, evt.brokenSwingPrice, "price لازم يطابق مستوى السوينغ — نفس دلالة المحرك");
  assert.equal(evt.needsReview, false);
});

test("حدث بلا سوينغ مكسور: needs-review، بدون تخمين مستوى", () => {
  const legacy = normalizeEvent({ time: at(30), type: "BOS", direction: "up", price: 138, reason: "قديم" }, candles);

  assert.equal(legacy.needsReview, true);
  assert.equal(legacy.price, null, "ما بينخمّن مستوى");
  assert.equal(lineLevelOf(legacy), null);
  assert.equal(legacy.legacyPrice, 138, "السعر القديم بينحفظ حتى ما يضيع شغل المحلّل");
  assert.equal(legacy.reason, "قديم");
});

test("الترقية بتحفظ الفهرس والوقت وما بتفقد أحداث", () => {
  const e = normalizeEvent(
    { time: at(30), type: "MSS", direction: "down", brokenSwingTime: at(20), brokenSwingPrice: 80, reason: "x" },
    candles
  );
  assert.equal(e.index, 30);
  assert.equal(e.brokenSwingIndex, 20);
  assert.equal(e.type, "MSS");
  assert.equal(e.direction, "down");
});

/* ============================================================================
   ٢) كشف البيفوتات
   ============================================================================ */
test("بيفوتات الفراكتال بتلاقي القمة والقاع الواضحين", () => {
  const p = detectPivots(candles, 2);
  assert.ok(p.some((x) => x.index === 10 && x.type === "high" && x.price === 120));
  assert.ok(p.some((x) => x.index === 20 && x.type === "low" && x.price === 80));
});

/* ============================================================================
   ٣) مرشّحات السوينغ المكسور
   ============================================================================ */
test("صاعد بيرجّع قمم سابقة فقط، وهابط قيعان سابقة فقط", () => {
  const p = detectPivots(candles, 2);

  const up = swingCandidates(candles, p, [], 30, "up");
  assert.ok(up.length > 0);
  assert.ok(up.every((x) => x.type === "high"), "لازم قمم بس");
  assert.ok(up.every((x) => x.index < 30), "لازم سابقة لشمعة الحدث");

  const down = swingCandidates(candles, p, [], 30, "down");
  assert.ok(down.every((x) => x.type === "low"));
});

test("وسم plausible بيميّز الكسر بالإغلاق", () => {
  const p = detectPivots(candles, 2);
  const up = swingCandidates(candles, p, [], 30, "up");
  const broken = up.find((x) => x.index === 10);

  assert.ok(broken, "قمة 120 لازم تكون بالمرشّحات");
  assert.equal(broken.plausible, true, "إغلاق 138 فوق 120 = كسر معقول");
  assert.equal(broken.barsBack, 20);

  // مستوى أعلى من إغلاق شمعة الحدث ما بينعتبر مكسور
  const fake = swingCandidates(candles, [{ index: 5, time: at(5), price: 999, type: "high" }], [], 30, "up");
  assert.equal(fake[0].plausible, false, "إغلاق 138 ما بيكسر 999");
});

test("سوينغات المحلّل بتغلب المكتشفة عند نفس الوقت", () => {
  const p = detectPivots(candles, 2);
  const mine = [{ time: at(10), type: "high", price: 121.5, label: "HH" }];
  const list = swingCandidates(candles, p, mine, 30, "up");
  const hit = list.filter((x) => x.time === at(10));

  assert.equal(hit.length, 1, "ما لازم يتكرر نفس الوقت");
  assert.equal(hit[0].source, "labeled");
  assert.equal(hit[0].price, 121.5, "سعر المحلّل هو المعتمد");
  assert.equal(hit[0].label, "HH");
});

test("المرشّحات مرتّبة من الأحدث وبتحترم الحد", () => {
  const many = [];
  for (let i = 1; i <= 20; i++) many.push({ index: i, time: at(i), price: 100 + i, type: "high" });
  const list = swingCandidates(candles, many, [], 30, "up", 5);

  assert.equal(list.length, 5);
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i].index < list[i - 1].index, "الترتيب لازم يكون من الأحدث للأقدم");
  }
});

test("ما في مرشّحات لحدث بأول البيانات = قائمة فاضية مش خطأ", () => {
  const p = detectPivots(candles, 2);
  assert.deepEqual(swingCandidates(candles, p, [], 0, "up"), []);
  assert.deepEqual(swingCandidates(candles, p, [], 1, "down"), []);
});

test("فهرس حدث غير صالح ما بيكسر الأداة", () => {
  assert.deepEqual(swingCandidates(candles, [], [], 9999, "up"), []);
});
