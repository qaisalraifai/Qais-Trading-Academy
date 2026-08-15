/* ============================================================================
   اختبارات المُصحِّح — `node --test lib/qais/structure/verify/reference.test.js`

   نفس المبدأ اللي طبّقناه على الهارنس: **أداة القياس بتنفحص قبل ما نصدّق
   أي رقم بتطلّعه**. مُصحِّح فيه خلل بيعطي precision/recall مقنعين وغلط.
   ============================================================================ */

import test from "node:test";
import assert from "node:assert/strict";

import { validateReference, scoreEvents, scoreSwings, EVENT_TYPES } from "./reference.js";

const H4 = 14400;
const T0 = 1700000000;
const candles = Array.from({ length: 60 }, (_, i) => ({
  time: T0 + i * H4,
  open: 100 + i,
  high: 101 + i,
  low: 99 + i,
  close: 100.5 + i,
}));
const at = (i) => T0 + i * H4;

const fixture = { id: "test-fixture", sha256: "abc123", candles };

/* حدث مرجعي كامل: السعر = مستوى السوينغ المكسور، والسوينغ سابق لشمعة الكسر.
   هاي دلالة المحرك نفسها (events.js: price = level). */
const ev = (i, type, direction, level = 100, brokenAt = null) => {
  const bi = brokenAt == null ? Math.max(0, i - 5) : brokenAt;
  return {
    time: at(i),
    type,
    direction,
    price: level,
    brokenSwingTime: at(bi),
    brokenSwingIndex: bi,
    brokenSwingPrice: level,
    reason: "سبب",
  };
};

/* حدث قديم بصيغة ما فيها سوينغ مكسور — لفحص needs-review */
const legacyEv = (i, type, direction, price = 100) => ({ time: at(i), type, direction, price, reason: "قديم" });

/* ============================================================================
   ١) فحص صلاحية المرجع
   ============================================================================ */
test("مرجع سليم بيعدّي", () => {
  const r = validateReference({ fixtureId: "test-fixture", sha256: "abc123", events: [ev(10, "BOS", "up")] }, fixture);
  assert.equal(r.ok, true);
  assert.equal(r.eventCount, 1);
});

test("بصمة مختلفة = المرجع باطل (الشموع اتبدّلت بعد التسمية)", () => {
  const r = validateReference({ fixtureId: "test-fixture", sha256: "SHA-تاني", events: [ev(10, "BOS", "up")] }, fixture);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /بصمة العيّنة تغيّرت/.test(e)));
});

test("عيّنة مختلفة = مرفوض", () => {
  const r = validateReference({ fixtureId: "عيّنة-تانية", events: [ev(10, "BOS", "up")] }, fixture);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /عيّنة تانية/.test(e)));
});

test("وقت مش واقع على شمعة = خطأ بالمرجع مش بالمحرك", () => {
  const bad = { fixtureId: "test-fixture", sha256: "abc123", events: [{ time: at(10) + 77, type: "BOS", direction: "up", price: 100, reason: "x" }] };
  const r = validateReference(bad, fixture);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /مش موجود بالعيّنة/.test(e)));
});

test("نوع أو اتجاه غير معروف = مرفوض، ومرجع فاضي = مرفوض", () => {
  const r1 = validateReference(
    { fixtureId: "test-fixture", sha256: "abc123", events: [{ time: at(5), type: "SWEEP", direction: "sideways", price: 1, reason: "x" }] },
    fixture
  );
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some((e) => /نوع غير معروف/.test(e)));
  assert.ok(r1.errors.some((e) => /اتجاه غير صالح/.test(e)));

  const r2 = validateReference({ fixtureId: "test-fixture", sha256: "abc123", events: [], swings: [] }, fixture);
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some((e) => /فاضي/.test(e)));
});

test("حدث بدون سبب = تحذير مش خطأ", () => {
  const r = validateReference(
    { fixtureId: "test-fixture", sha256: "abc123", events: [{ time: at(10), type: "BOS", direction: "up", price: 100 }] },
    fixture
  );
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => /بدون سبب/.test(w)));
});

/* ============================================================================
   ٢) قياس الأحداث
   ============================================================================ */
test("تطابق تام = precision و recall = 1، وصفر أخطاء", () => {
  const refs = [ev(10, "BOS", "up"), ev(20, "MSS", "down"), ev(30, "MSS", "down")];
  const s = scoreEvents(refs, refs.map((r) => ({ ...r })), candles, { windowCandles: 2 });
  assert.equal(s.truePositives, 3);
  assert.equal(s.precision, 1);
  assert.equal(s.recall, 1);
  assert.equal(s.falsePositives, 0);
  assert.equal(s.falseNegatives, 0);
  assert.equal(s.f1, 1);
});

test("المحرك فوّت حدث = False Negative مؤكد", () => {
  const refs = [ev(10, "BOS", "up"), ev(30, "MSS", "down")];
  const s = scoreEvents(refs, [ev(10, "BOS", "up")], candles, { windowCandles: 2 });
  assert.equal(s.falseNegatives, 1);
  assert.equal(s.recall, 0.5);
  assert.match(s.details.falseNegatives[0].why, /ما في حدث محرك/);
});

test("المحرك اخترع حدث = False Positive مؤكد (هاد اللي الصفقات ما كانت تقيسه)", () => {
  const refs = [ev(10, "BOS", "up")];
  const s = scoreEvents(refs, [ev(10, "BOS", "up"), ev(40, "BOS", "down")], candles, { windowCandles: 2 });
  assert.equal(s.falsePositives, 1);
  assert.equal(s.precision, 0.5);
  assert.equal(s.recall, 1);
});

test("نفس اللحظة بنوع مختلف = التباس تصنيف، مش True Positive", () => {
  const refs = [ev(20, "MSS", "down")];
  const s = scoreEvents(refs, [ev(20, "BOS", "down")], candles, { windowCandles: 2 });
  assert.equal(s.truePositives, 0);
  assert.equal(s.typeConfusion, 1);
  assert.equal(s.falseNegatives, 0, "انطابق زمنياً فمش مفقود — بس مصنّف غلط");
  assert.equal(s.details.typeConfusion[0].engine.type, "BOS");
  assert.equal(s.details.typeConfusion[0].reference.type, "MSS");
});

test("اتجاه معاكس بينتسجّل كخطأ اتجاه", () => {
  const refs = [ev(20, "BOS", "up")];
  const s = scoreEvents(refs, [ev(20, "BOS", "down")], candles, { windowCandles: 2 });
  assert.equal(s.truePositives, 0);
  assert.equal(s.directionErrors, 1);
});

test("حدث محرك واحد ما بينحسب مطابقة لتسميتين", () => {
  const refs = [ev(20, "BOS", "up"), ev(21, "BOS", "up")];
  const s = scoreEvents(refs, [ev(20, "BOS", "up")], candles, { windowCandles: 3 });
  assert.equal(s.truePositives, 1);
  assert.equal(s.falseNegatives, 1, "الثاني لازم يطلع مفقود مش مطابق مرة تانية");
});

test("نافذة التسامح بتنحترم", () => {
  const refs = [ev(20, "BOS", "up")];
  const near = scoreEvents(refs, [ev(22, "BOS", "up")], candles, { windowCandles: 2 });
  assert.equal(near.truePositives, 1);
  assert.equal(near.details.matches[0].timingDiffCandles, 2);

  const far = scoreEvents(refs, [ev(24, "BOS", "up")], candles, { windowCandles: 2 });
  assert.equal(far.truePositives, 0);
  assert.equal(far.falseNegatives, 1);
  assert.equal(far.falsePositives, 1);
});

test("الفارق الزمني والسعري بينحسبوا بإشارة صحيحة", () => {
  const refs = [ev(20, "BOS", "up", 100, 12)];
  const s = scoreEvents(refs, [{ time: at(18), type: "BOS", direction: "up", price: 105 }], candles, { windowCandles: 3 });
  const m = s.details.matches[0];
  assert.equal(m.timingDiffCandles, -2, "سالب = المحرك أبكر من المرجع");
  assert.equal(m.timingDiffMinutes, -480);
  assert.equal(m.priceDiff, 5, "الفرق بين مستويي السوينغ المكسور");
  assert.equal(m.pricePct, 5);
});

/* ============================================================================
   ٢.ب) المستوى المكسور — الدلالة الجديدة
   ============================================================================ */
test("مقارنة السعر بتتم على مستوى السوينغ المكسور، مش على شمعة الكسر", () => {
  // شمعة الكسر عند ٢٠ إغلاقها 120.5، ومستوى السوينغ المكسور 100
  const refs = [ev(20, "BOS", "up", 100, 12)];
  const s = scoreEvents(refs, [{ time: at(20), type: "BOS", direction: "up", price: 100 }], candles, { windowCandles: 2 });
  const m = s.details.matches[0];

  assert.equal(m.priceDiff, 0, "المستويان متطابقين");
  assert.notEqual(candles[20].close, 100, "شمعة الكسر إغلاقها مختلف — وما لازم يدخل بالحساب");
  assert.equal(s.brokenLevel.exactLevel, 1);
});

test("نفس اللحظة بمستوى مكسور مختلف = خطأ هيكلي بينكشف", () => {
  const refs = [ev(20, "BOS", "up", 100, 12)];
  const eng = [{ time: at(20), type: "BOS", direction: "up", price: 108, swingRef: { time: at(15) } }];
  const s = scoreEvents(refs, eng, candles, { windowCandles: 2 });

  assert.equal(s.truePositives, 1, "النوع والاتجاه والتوقيت مضبوطين");
  assert.equal(s.brokenLevel.exactLevel, 0, "بس المستوى المكسور غلط");
  assert.equal(s.brokenLevel.sameBrokenSwing, 0);
  assert.equal(s.brokenLevel.swingIdentityRate, 0, "كسر قمة تانية غير اللي حدّدها المحلّل");
  assert.equal(s.details.matches[0].priceDiff, 8);
});

test("هوية السوينغ بتتقارن بالوقت مش بالسعر بس", () => {
  const refs = [ev(20, "BOS", "up", 100, 12)];
  const eng = [{ time: at(20), type: "BOS", direction: "up", price: 100, swingRef: { time: at(12) } }];
  const s = scoreEvents(refs, eng, candles, { windowCandles: 2 });
  assert.equal(s.brokenLevel.sameBrokenSwing, 1);
  assert.equal(s.brokenLevel.swingIdentityRate, 1);
});

test("أحداث needs-review بتنستثنى من قياس المستوى وبينذكر عددها", () => {
  const refs = [legacyEv(20, "BOS", "up", 100)];
  const s = scoreEvents(refs, [{ time: at(20), type: "BOS", direction: "up", price: 100 }], candles, { windowCandles: 2 });

  assert.equal(s.truePositives, 1, "بينقاس زمنياً ونوعياً عادي");
  assert.equal(s.details.matches[0].levelScorable, false);
  assert.equal(s.details.matches[0].priceDiff, null, "ما بينحسب فرق سعري لحدث بلا مستوى");
  assert.equal(s.brokenLevel.value, "INSUFFICIENT_DATA");
});

test("التحقق: حدث بلا سوينغ مكسور = تحذير needs-review مش خطأ", () => {
  const r = validateReference(
    { fixtureId: "test-fixture", sha256: "abc123", events: [legacyEv(20, "BOS", "up")] },
    fixture
  );
  assert.equal(r.ok, true, "ما بينرفض — التسمية بتضل موجودة");
  assert.equal(r.needsReview, 1);
  assert.equal(r.scorableForLevel, 0);
  assert.ok(r.warnings.some((w) => /needs-review/.test(w)));
});

test("التحقق: سوينغ مكسور بعد شمعة الكسر = خطأ", () => {
  const bad = { ...ev(10, "BOS", "up", 100, 10), brokenSwingTime: at(15), brokenSwingIndex: 15 };
  const r = validateReference({ fixtureId: "test-fixture", sha256: "abc123", events: [bad] }, fixture);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /لازم يسبق شمعة الكسر/.test(e)));
});

test("التحقق: price لازم يطابق brokenSwingPrice", () => {
  const bad = { ...ev(20, "BOS", "up", 100, 12), price: 118 };
  const r = validateReference({ fixtureId: "test-fixture", sha256: "abc123", events: [bad] }, fixture);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /price لازم يساوي brokenSwingPrice/.test(e)));
});

test("نوع غايب عن الطرفين = INSUFFICIENT_DATA مش دقة صفر", () => {
  const refs = [ev(10, "BOS", "up")];
  const s = scoreEvents(refs, [ev(10, "BOS", "up")], candles, { windowCandles: 2 });
  assert.equal(s.byType.MSS.value, "INSUFFICIENT_DATA");
  assert.equal(s.byType.MSS.value, "INSUFFICIENT_DATA");
  assert.equal(s.byType.BOS.recall, 1);
  for (const t of EVENT_TYPES) assert.ok(s.byType[t], `${t} ناقص من التقرير`);
});

test("ترتيب إدخال التسميات ما بيغيّر النتيجة", () => {
  const refs = [ev(30, "MSS", "down"), ev(10, "BOS", "up"), ev(20, "MSS", "down")];
  const eng = [ev(20, "MSS", "down"), ev(30, "MSS", "down"), ev(10, "BOS", "up")];
  const a = scoreEvents(refs, eng, candles, { windowCandles: 2 });
  const b = scoreEvents([...refs].reverse(), [...eng].reverse(), candles, { windowCandles: 2 });
  assert.equal(a.truePositives, b.truePositives);
  assert.equal(a.falsePositives, b.falsePositives);
  assert.equal(a.falseNegatives, b.falseNegatives);
});

/* ============================================================================
   ٣) قياس السوينغات + سؤال الكثافة
   ============================================================================ */
test("نسبة الكثافة بتجاوب مباشرة على «هل الهيكل الخارجي ناعم؟»", () => {
  const refs = [
    { time: at(10), type: "high", label: "HH", price: 111 },
    { time: at(20), type: "low", label: "HL", price: 119 },
  ];
  const engine = [
    { time: at(10), type: "high", label: "HH", price: 111 },
    { time: at(14), type: "low", label: "HL", price: 113 },
    { time: at(17), type: "high", label: "LH", price: 118 },
    { time: at(20), type: "low", label: "HL", price: 119 },
  ];
  const s = scoreSwings(refs, engine, candles, { windowCandles: 1 });

  assert.equal(s.matched, 2);
  assert.equal(s.extra, 2, "سوينغين ما اعتبرهم المحلّل هيكل");
  assert.equal(s.recall, 1);
  assert.equal(s.precision, 0.5);
  assert.equal(s.densityRatio, 2, "المحرك بيطلّع ضعف اللي بيشوفه المحلّل");
  assert.equal(s.labelAccuracy, 1);
});

test("تسمية غلط بتنكشف بمعزل عن المطابقة", () => {
  const refs = [{ time: at(10), type: "high", label: "HH", price: 111 }];
  const engine = [{ time: at(10), type: "high", label: "LH", price: 111 }];
  const s = scoreSwings(refs, engine, candles, { windowCandles: 1 });
  assert.equal(s.matched, 1, "انطابق زمنياً");
  assert.equal(s.labelAccuracy, 0, "بس التسمية غلط");
});

test("سوينغ مرجعي مفقود بينتسجّل مع سببه", () => {
  const refs = [{ time: at(10), type: "high", label: "HH", price: 111 }];
  const s = scoreSwings(refs, [], candles, { windowCandles: 1 });
  assert.equal(s.missed, 1);
  assert.equal(s.recall, 0);
  assert.match(s.details.missed[0].why, /ما في سوينغ خارجي/);
});

test("تسمية قمة على قاع = تناقض داخلي بينكشف", () => {
  const r = validateReference(
    {
      fixtureId: "test-fixture",
      sha256: "abc123",
      events: [ev(10, "BOS", "up")],
      swings: [{ time: at(20), type: "low", label: "LH", price: 99, reason: "قاع أدنى من السابق" }],
    },
    fixture
  );
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /ما بتنطبق على قاع/.test(e)), r.errors.join(" | "));
});

test("التسميات المتوافقة مع نوعها بتعدّي", () => {
  const r = validateReference(
    {
      fixtureId: "test-fixture",
      sha256: "abc123",
      events: [ev(10, "BOS", "up")],
      swings: [
        { time: at(20), type: "low", label: "LL", price: 99, reason: "x" },
        { time: at(25), type: "low", label: "HL", price: 99, reason: "x" },
        { time: at(30), type: "high", label: "HH", price: 130, reason: "x" },
        { time: at(35), type: "high", label: "LH", price: 128, reason: "x" },
        { time: at(40), type: "high", label: null, price: 128, reason: "أول قمة" },
      ],
    },
    fixture
  );
  assert.equal(r.ok, true, r.errors.join(" | "));
});

test("بدون تسميات بالطرفين: دقة التسمية INSUFFICIENT_DATA", () => {
  const refs = [{ time: at(10), type: "high", price: 111 }];
  const engine = [{ time: at(10), type: "high", price: 111, label: null }];
  const s = scoreSwings(refs, engine, candles, { windowCandles: 1 });
  assert.equal(s.labelAccuracy.value, "INSUFFICIENT_DATA");
});

/* ============================================================================
   ٤) العيّنة المجمّدة نفسها
   ============================================================================ */
test("العيّنة المجمّدة سليمة ومطابقة لبصمتها", async () => {
  const { createHash } = await import("node:crypto");
  const { readFileSync } = await import("node:fs");
  const url = new URL("./fixtures/nas100-h4-2026.json", import.meta.url);
  const fx = JSON.parse(readFileSync(url, "utf8"));

  assert.equal(fx.candles.length, fx.candleCount);
  const sha = createHash("sha256").update(JSON.stringify(fx.candles)).digest("hex");
  assert.equal(sha, fx.sha256, "بصمة العيّنة ما بتطابق محتواها — العيّنة اتعدّلت");

  for (let i = 1; i < fx.candles.length; i++) {
    assert.ok(fx.candles[i].time > fx.candles[i - 1].time, `الأوقات مش تصاعدية عند ${i}`);
  }
  for (const c of fx.candles) {
    assert.ok(c.high >= c.low, "قمة تحت القاع");
    assert.ok(c.high >= c.open && c.high >= c.close, "القمة مش الأعلى");
    assert.ok(c.low <= c.open && c.low <= c.close, "القاع مش الأدنى");
  }
});
