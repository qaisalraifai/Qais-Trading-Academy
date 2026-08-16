/* ============================================================================
   اختبارات محرك كتلة الأوامر
   `node --test lib/qais/orderblock-v2/orderblock.test.js`

   نطاق الملف: **دلالة القواعد**، مش واقعية السوق.

   درسان محفوران من هالمشروع، مطبَّقان هون:
     ١) مولّد خطي بذيل ثابت بيخلّي شمعتين متجاورتين بنفس القمة، فشرط
        الفراكتال بيرفض التعادل وبتمرق الاختبارات على مصفوفات فاضية.
        → عشوائية ثابتة البذرة + تأكيد الشرط المسبق قبل كل ادعاء.
     ٢) assertion وراء `if` ممكن ما ينفّذ أبداً والاختبار بينجح فاضي.
        → كل اختبار بيتأكد إنه طلّع البنية اللي بيدّعي فحصها.
   ============================================================================ */

import test from "node:test";
import assert from "node:assert/strict";

import { analyzeOrderBlocksV2, blocksAsOf, OB_DEFAULTS } from "./index.js";
import { findFVGs, indexFVGs, fvgAt } from "./fvg.js";
import { oppositeGroupBefore, levelsFromGroup, firstInvalidationIndex } from "./block.js";
import { atrSeries } from "../structure/atr.js";

const H4 = 14400;
let clock = 1700000000;
const reset = () => (clock = 1700000000);

function candle(open, high, low, close) {
  clock += H4;
  return { time: clock, open, high, low, close };
}

function makeRng(seed = 12345) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** شموع هادية بمدى صغير — أرضية حتى يصير الزخم لاحقاً بارزاً فعلاً. */
function calm(n, start = 100, seed = 5) {
  const rng = makeRng(seed);
  const out = [];
  let px = start;
  for (let i = 0; i < n; i++) {
    const drift = (rng() - 0.5) * 0.6;
    const o = px;
    const c = px + drift;
    out.push(candle(o, Math.max(o, c) + 0.2 + rng() * 0.2, Math.min(o, c) - 0.2 - rng() * 0.2, c));
    px = c;
  }
  return out;
}

/** شموع هابطة متتالية — مادة كتلة الطلب. */
function bearishRun(n, start, step = 0.5) {
  const out = [];
  let px = start;
  for (let i = 0; i < n; i++) {
    const o = px;
    const c = px - step;
    out.push(candle(o, o + 0.15, c - 0.15, c));
    px = c;
  }
  return out;
}

/** شمعة اندفاع صاعدة بجسم كبير بتخلّف فجوة فوق قمة الشمعة اللي قبلها بشمعة. */
function bullishImpulse(from, size) {
  return candle(from, from + size + 0.5, from - 0.1, from + size);
}

/* ============================================================================
   ١) بيانات غير كافية
   ============================================================================ */
test("بيانات غير كافية بترجع سبب صريح بدون كتل", () => {
  const r = analyzeOrderBlocksV2(calm(10));
  assert.equal(r.ok, false);
  assert.equal(r.blocks.length, 0);
  assert.match(r.reason, /أقل من الحد الأدنى/);
});

test("مدخل غلط ما بيكسر المحرك", () => {
  for (const bad of [null, undefined, [], "x", 42]) {
    const r = analyzeOrderBlocksV2(bad);
    assert.equal(r.ok, false);
    assert.equal(r.blocks.length, 0);
  }
});

/* ============================================================================
   ٢) الفجوة — مفهرسة على شمعة الاندفاع، وسببية
   ============================================================================ */
test("الفجوة مفهرسة على الشمعة الوسطى وما بتنعرف إلا بعد اللي بعدها", () => {
  reset();
  const c = [
    candle(100, 101, 99, 100),
    candle(100, 112, 99.9, 111), // اندفاع
    candle(111, 113, 102, 112), // قاعها 102 > قمة الأولى 101 = فجوة
    candle(112, 113, 111, 112),
  ];
  const f = findFVGs(c);
  assert.equal(f.length, 1);
  assert.equal(f[0].index, 1, "الفهرسة لازم تكون على شمعة الاندفاع مش الثالثة");
  assert.equal(f[0].direction, "up");
  assert.equal(f[0].confirmedAtIndex, 2, "ما بتنعرف إلا لما تسكّر الشمعة اللي بعدها");
  assert.ok(f[0].size > 0);
});

test("ما في فجوة لما الذيول بتتلامس", () => {
  reset();
  const c = [candle(100, 105, 99, 104), candle(104, 112, 103, 111), candle(111, 113, 104, 112)];
  assert.equal(findFVGs(c).length, 0, "قاع الثالثة 104 مش أعلى من قمة الأولى 105");
});

test("fvgAt بيرفض الفجوة المعاكسة لاتجاه الزخم", () => {
  reset();
  const c = [candle(112, 113, 111, 112), candle(111, 111.5, 100, 101), candle(101, 110, 99, 100)];
  const byIdx = indexFVGs(findFVGs(c));
  assert.ok(fvgAt(byIdx, 1, "down"), "الفجوة الهابطة موجودة");
  assert.equal(fvgAt(byIdx, 1, "up"), null, "ما بينفع تنعتمد لزخم صاعد");
});

/* ============================================================================
   ٣) المجموعة والمستويات
   ============================================================================ */
test("المجموعة بتمتد لكل الشموع المعاكسة المتتالية — ما في سقف", () => {
  reset();
  const c = [...calm(5), ...bearishRun(30, 100), bullishImpulse(85, 12)];
  const impulseIdx = c.length - 1;
  const g = oppositeGroupBefore(c, impulseIdx, true);

  assert.ok(g, "لازم تنلقى مجموعة");
  assert.equal(g.endIndex, impulseIdx - 1, "المجموعة لازم تنتهي عند الشمعة اللي قبل الزخم");

  /* الادعاء الصح هو **القاعدة** مش رقم ثابت: المجموعة بتمتد لكل الشموع
     المعاكسة المتتالية وبتوقف عند أول شمعة مش معاكسة. (الادعاء برقم ثابت
     هش — مولّد `calm` ممكن ينتهي بشمعة هابطة فتنضم للمجموعة بحق.) */
  assert.ok(g.candles.length >= 30, `المجموعة اتقصّت على ${g.candles.length} — ما في سقف بالمنهجية`);
  for (const x of g.candles) {
    assert.ok(x.close < x.open, "كل شمعة بالمجموعة لازم تكون معاكسة لاتجاه الزخم");
  }
  const before = c[g.startIndex - 1];
  assert.ok(before && before.close >= before.open, "الشمعة اللي قبل المجموعة لازم تكون غير معاكسة — وإلا المجموعة ناقصة");
});

test("المستويات الخمسة بتنحسب من مواقعها الصحيحة", () => {
  reset();
  const g = {
    startIndex: 0,
    endIndex: 2,
    candles: [
      { open: 110, high: 111, low: 108, close: 109 }, // أول
      { open: 109, high: 112, low: 104, close: 105 }, // أعلى قمة بالمجموعة
      { open: 105, high: 106, low: 100, close: 102 }, // آخر
    ],
  };
  const b = levelsFromGroup(g, true);

  assert.equal(b.levels.open, 110, "OPEN = جسم أول شمعة");
  assert.equal(b.levels.close, 102, "CLOSE = جسم آخر شمعة");
  assert.equal(b.levels.mt, 106, "MT = ٥٠٪ بين جسمي الأولى والأخيرة");
  assert.equal(b.levels.fvg, 112, "FVG = أقصى ذيل بكامل المجموعة");
  assert.equal(b.levels.outerWick, 100, "OUTER WICK = ذيل **آخر** شمعة وحدها مش أدنى نقطة بالمجموعة");
  assert.equal(b.levels.invalidation, b.levels.outerWick, "حد الإبطال = الذيل الطرفي حرفياً");
  assert.deepEqual(b.strengthOrder, ["mt", "open", "close", "outerWick", "fvg"]);
});

test("الإبطال بالإغلاق خلف الذيل الطرفي — مش بالذيل", () => {
  reset();
  const c = [
    candle(100, 101, 99, 100),
    candle(100, 101, 95, 100), // ذيل تحت 96 بس الإغلاق فوق
    candle(100, 101, 99, 94), // إغلاق تحت 96 = إبطال
  ];
  assert.equal(firstInvalidationIndex(c, 1, 96, true), 2, "الذيل ما بيبطّل، الإغلاق بيبطّل");
  assert.equal(firstInvalidationIndex(c, 1, 80, true), -1, "ما في إبطال = -1 مش 0");
});

/* ============================================================================
   ٤) الاكتشاف الكامل — ومعه الدرس الأهم بالجلسة
   ============================================================================ */
test("كتلة الطلب بتنكتشف من زخم صاعد بعد شموع هابطة مع فجوة", () => {
  reset();
  const c = [...calm(40), ...bearishRun(4, 100), bullishImpulse(98, 10), ...calm(6, 108, 9)];
  const r = analyzeOrderBlocksV2(c, { timeframe: "h4" });

  assert.equal(r.ok, true, r.reason);
  assert.ok(r.blocks.length >= 1, `ما انكشفت كتلة — الرفض: ${JSON.stringify(r.meta.counts.rejected)}`);

  const b = r.blocks[0];
  assert.equal(b.direction, "up");
  assert.equal(b.side, "demand");
  assert.equal(b.candleCount, 4, "المجموعة = الشموع الهابطة الأربعة");
  assert.ok(b.levels.mt > b.levels.outerWick, "MT فوق الذيل الطرفي بكتلة الطلب");
  assert.ok(b.fvg, "الفجوة شرط إلزامي فلازم تكون مسجّلة");
});

test("الكتلة اللي بتسبق شمعة الكسر بتنكتشف — ما في نافذة بتحجبها", () => {
  /* ⚠️ الدرس الأهم: المحرك القديم كان يمسح جوّا نوافذ سيقان MSS، وفهرس
     الـMSS هو فهرس شمعة الكسر، والمسح بيبلّش من fromIndex+1 — فشمعة
     الكسر نفسها كانت تطلع بره كل النوافذ. يعني الكتلة اللي **سبّبت**
     الكسر ما كانت تنكشف ولا مرة. هون ما في نوافذ إطلاقاً. */
  reset();
  const c = [...calm(40), ...bearishRun(3, 100), bullishImpulse(98.5, 11), ...calm(5, 109.5, 3)];
  const impulseIdx = 43;
  const r = analyzeOrderBlocksV2(c, { timeframe: "h4" });

  const atImpulse = r.blocks.find((b) => b.formedAtIndex === impulseIdx);
  assert.ok(
    atImpulse,
    `الكتلة عند شمعة الكسر ${impulseIdx} مش مكتشفة — الكتل: ${r.blocks.map((b) => b.formedAtIndex).join(",")}`
  );
  assert.equal(atImpulse.groupEndIndex, impulseIdx - 1, "المجموعة لازم تكون الشموع اللي **قبل** شمعة الكسر");
});

test("زخم بلا فجوة ما بيولّد كتلة — الفجوة شرط إلزامي", () => {
  reset();
  /* اندفاع صاعد بس الشمعة اللي بعده بترجع تحت قمة اللي قبله = ما في فجوة */
  const c = [...calm(40), ...bearishRun(3, 100), candle(98.5, 110, 98, 109), candle(109, 110, 96, 97), ...calm(5, 97, 4)];
  const r = analyzeOrderBlocksV2(c, { timeframe: "h4" });
  const atImpulse = r.blocks.find((b) => b.formedAtIndex === 43);
  assert.equal(atImpulse, undefined, "ما لازم تنعتمد كتلة بدون فجوة");
  assert.ok(r.meta.counts.rejected.noFvg > 0, "لازم ينتسجّل سبب الرفض");
});

test("شمعة ذيول ضخمة بجسم صفر ما بتولّد كتلة", () => {
  reset();
  const c = [...calm(40), ...bearishRun(3, 100), candle(98.5, 112, 90, 98.7), ...calm(5, 99, 7)];
  const r = analyzeOrderBlocksV2(c, { timeframe: "h4" });
  assert.equal(r.blocks.find((b) => b.formedAtIndex === 43), undefined, "بوابة الجسم لازم ترفضها");
});

/* ============================================================================
   ٥) السببية والصلاحية الزمنية
   ============================================================================ */
test("الكتلة ما بتنعرف قبل تأكيد فجوتها", () => {
  reset();
  const c = [...calm(40), ...bearishRun(4, 100), bullishImpulse(98, 10), ...calm(6, 108, 9)];
  const r = analyzeOrderBlocksV2(c, { timeframe: "h4" });
  assert.ok(r.blocks.length > 0);

  for (const b of r.blocks) {
    assert.ok(b.availableFromIndex >= b.formedAtIndex, "ما بتنعرف قبل شمعة تكوّنها");
    assert.ok(b.availableFromIndex >= b.fvg.index + 1, "ولا قبل ما تسكّر شمعة تأكيد الفجوة");
  }
});

test("الكتلة الملغاة بتضل مسجّلة بفهرس إلغائها — مش بتنشال", () => {
  reset();
  const c = [...calm(40), ...bearishRun(4, 100), bullishImpulse(98, 10), ...bearishRun(20, 108, 1.2)];
  const r = analyzeOrderBlocksV2(c, { timeframe: "h4" });
  assert.ok(r.blocks.length > 0);

  const invalidated = r.blocks.filter((b) => b.invalidIndex !== -1);
  assert.ok(invalidated.length >= 1, "السعر نزل بقوة فلازم تنلغي كتلة على الأقل");
  for (const b of invalidated) {
    assert.ok(b.invalidIndex > b.formedAtIndex, "الإلغاء لازم يكون بعد التكوّن");
    assert.ok(b.invalidTime != null, "لازم ينتسجّل وقت الإلغاء");
  }
});

test("blocksAsOf بترجّع الحالة بلحظتها — مش حالة اليوم", () => {
  reset();
  const c = [...calm(40), ...bearishRun(4, 100), bullishImpulse(98, 10), ...bearishRun(20, 108, 1.2)];
  const r = analyzeOrderBlocksV2(c, { timeframe: "h4" });
  const b = r.blocks.find((x) => x.invalidIndex !== -1);
  assert.ok(b, "بدنا كتلة انلغت حتى ينفحص الفرق");

  const before = blocksAsOf(r, c, b.invalidIndex - 1).find((x) => x.id === b.id);
  const after = blocksAsOf(r, c, b.invalidIndex).find((x) => x.id === b.id);

  assert.ok(before, "قبل الإلغاء لازم تكون موجودة وصالحة");
  assert.notEqual(before.status, "Invalid");
  assert.equal(after, undefined, "بعد الإلغاء بتنشال من القائمة الصالحة بلحظتها");
});

test("الكتلة ما بتظهر بلحظة قبل ما تصير متاحة", () => {
  reset();
  const c = [...calm(40), ...bearishRun(4, 100), bullishImpulse(98, 10), ...calm(6, 108, 9)];
  const r = analyzeOrderBlocksV2(c, { timeframe: "h4" });
  const b = r.blocks[0];
  assert.ok(b);
  assert.equal(blocksAsOf(r, c, b.availableFromIndex - 1).find((x) => x.id === b.id), undefined);
  assert.ok(blocksAsOf(r, c, b.availableFromIndex).find((x) => x.id === b.id), "لازم تظهر بلحظة إتاحتها");
});

/* ============================================================================
   ٦) سياق السيولة: دليل مش فلتر
   ============================================================================ */
test("غياب السيولة ما بيحذف كتلة — بينتسجّل ويتقاس أثره", () => {
  reset();
  const c = [...calm(40), ...bearishRun(4, 100), bullishImpulse(98, 10), ...calm(6, 108, 9)];

  const without = analyzeOrderBlocksV2(c, { timeframe: "h4" });
  const withEmpty = analyzeOrderBlocksV2(c, { timeframe: "h4", liquidity: { sweeps: [] } });

  assert.equal(withEmpty.blocks.length, without.blocks.length, "الكتل ما بتقل بغياب السيولة");
  assert.equal(withEmpty.blocks[0].liquidityContext, false, "بينتوسم إنه ما في تفاعل قريب");
  assert.equal(
    withEmpty.meta.counts.wouldExcludeIfLiquidityRequired,
    withEmpty.blocks.length,
    "لازم ينقاس كم كتلة كانت تختفي لو انفرض الشرط"
  );
  assert.equal(without.meta.counts.wouldExcludeIfLiquidityRequired, null, "بدون بيانات سيولة = null مش صفر");
});

/* ============================================================================
   ٧) ثبات وتكرارية
   ============================================================================ */
test("نفس المدخل بيعطي نفس المخرج بالضبط", () => {
  reset();
  const c = [...calm(40), ...bearishRun(4, 100), bullishImpulse(98, 10), ...calm(8, 108, 9)];
  const a = JSON.stringify(analyzeOrderBlocksV2(c, { timeframe: "h4" }));
  const b = JSON.stringify(analyzeOrderBlocksV2(c, { timeframe: "h4" }));
  assert.equal(a, b);
});

test("إضافة شموع جديدة ما بتلغي كتلة قديمة ولا بتغيّر مستوياتها", () => {
  reset();
  const head = [...calm(40), ...bearishRun(4, 100), bullishImpulse(98, 10), ...calm(6, 108, 9)];
  const tail = calm(10, 108, 21);

  const before = analyzeOrderBlocksV2(head, { timeframe: "h4" });
  const after = analyzeOrderBlocksV2([...head, ...tail], { timeframe: "h4" });
  assert.ok(before.blocks.length > 0, "لازم يكون في كتل حتى ينفحص الثبات");

  for (const b of before.blocks) {
    const same = after.blocks.find((x) => x.formedAtIndex === b.formedAtIndex);
    assert.ok(same, `كتلة عند ${b.formedAtIndex} اختفت بعد إضافة شموع`);
    assert.deepEqual(same.levels, b.levels, "المستويات ما لازم تتغيّر");
    assert.equal(same.groupStartIndex, b.groupStartIndex);
  }
});

test("كل كتلة بتحمل الحقول المطلوبة", () => {
  reset();
  const c = [...calm(40), ...bearishRun(4, 100), bullishImpulse(98, 10), ...calm(6, 108, 9)];
  const r = analyzeOrderBlocksV2(c, { timeframe: "h4" });
  assert.ok(r.blocks.length > 0);

  for (const b of r.blocks) {
    for (const k of ["id", "type", "direction", "side", "timeframe", "time", "formedAtIndex", "levels", "status", "reason"]) {
      assert.ok(b[k] !== undefined, `الحقل ${k} ناقص`);
    }
    assert.equal(b.timeframe, "h4");
    assert.ok(["Strong", "Normal", "Weak", "Invalid"].includes(b.status));
    assert.ok(b.confidence === null || (b.confidence >= 0 && b.confidence <= 1));
    for (const lv of ["mt", "open", "close", "fvg", "outerWick", "invalidation"]) {
      assert.ok(Number.isFinite(b.levels[lv]), `المستوى ${lv} مش رقم`);
    }
  }
});
