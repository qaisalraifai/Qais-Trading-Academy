/* ============================================================================
   اختبارات Structure Engine v2 — تشتغل بـ`node --test lib/qais/structure/`
   بدون أي تبعية خارجية.

   نطاق هالملف بالضبط: **دلالة القواعد**، مش واقعية السوق.
   الشموع هون مبنيّة يدوياً لتفعيل قاعدة واحدة كل مرة (كسر بالذيل، كسر
   كاذب، نظر للمستقبل، فصل المقياسين...). هالنوع من الاختبار صالح لإثبات
   إنه القاعدة بتنفّذ متل ما هي مكتوبة — وغير صالح لإثبات إنه المحرك
   بيقرا السوق صح. قياس الدقة على بيانات حقيقية هو المرحلة ٢/٣.
   ============================================================================ */

import test from "node:test";
import assert from "node:assert/strict";

import { analyzeStructureV2 } from "./index.js";
import { detectFractalPivots, alternate, buildMajorSwings, labelSwings } from "./swings.js";
import { classifyDisplacement } from "./displacement.js";
import { atrSeries } from "./atr.js";

/* -------------------- أدوات بناء الشموع --------------------
   ملاحظة مهمة اتعلّمناها من أول تشغيل: مولّد خطي بذيل ثابت بيخلّي آخر
   شمعة بالساق الصاعدة وأول شمعة بالهابطة **بنفس القمة بالضبط**. شرط
   الفراكتال (`>=`) بيرفض التعادل، فما بينكشف ولا بيفوت — وكل الاختبارات
   بتمرق على مصفوفات فاضية وتنجح كذباً.

   لهيك: عشوائية ثابتة البذرة (معادة الإنتاج ١٠٠٪) + شمعة طرف صريحة عند
   كل نقطة انعطاف. */

const H4 = 14400;
let clock = 1700000000;

function candle(open, high, low, close, volume) {
  clock += H4;
  return { time: clock, open, high, low, close, ...(volume != null ? { volume } : {}) };
}

/** مولّد عشوائي خطي ثابت البذرة — نفس السلسلة كل تشغيل. */
function makeRng(seed = 12345) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * بيبني مسار من نقاط انعطاف. كل نقطة انعطاف بتاخد شمعة طرف صارم (أعلى
 * من جيرانها بهامش apexMargin) حتى تنكشف كبيفوت فعلاً.
 */
function path(points, barsPerLeg = 8, { wick = 0.6, seed = 7, apexMargin = 2 } = {}) {
  const rng = makeRng(seed);
  const out = [];

  for (let p = 0; p < points.length - 1; p++) {
    const a = points[p];
    const b = points[p + 1];
    const up = b > a;

    for (let i = 0; i < barsPerLeg; i++) {
      const o = a + ((b - a) * i) / barsPerLeg;
      const c = a + ((b - a) * (i + 1)) / barsPerLeg;
      const j = 0.15 + rng() * wick;
      out.push(candle(o, Math.max(o, c) + j, Math.min(o, c) - j, c));
    }

    // شمعة الطرف — بس إذا في انعكاس فعلي بعدها
    const next = points[p + 2];
    if (next != null && ((up && next < b) || (!up && next > b))) {
      const o = b - (up ? 0.3 : -0.3);
      out.push(
        up
          ? candle(o, b + apexMargin, o - wick, b - 0.25)
          : candle(o, o + wick, b - apexMargin, b + 0.25)
      );
    }
  }
  return out;
}

/** ساق وحدة — غلاف رقيق فوق path للحالات البسيطة. */
function ramp(a, b, n, wick = 0.6) {
  return path([a, b], n, { wick, seed: 3 });
}

/** ذبذبة ضيقة حوالين مستوى: بتولّد بيفوتات داخلية بدون هيكل خارجي. */
function noise(level, n, amp = 1, seed = 99) {
  const rng = makeRng(seed);
  const out = [];
  let prev = level;
  for (let i = 0; i < n; i++) {
    const target = level + (rng() - 0.5) * amp * 2;
    const hi = Math.max(prev, target) + rng() * amp * 0.4;
    const lo = Math.min(prev, target) - rng() * amp * 0.4;
    out.push(candle(prev, hi, lo, target));
    prev = target;
  }
  return out;
}

/* ============================================================================
   ١) بيانات غير كافية — ما بيطلع أرقام مخترعة
   ============================================================================ */
test("بيانات غير كافية بترجع INSUFFICIENT_DATA بدون ثقة مخترعة", () => {
  const r = analyzeStructureV2(ramp(100, 110, 5));
  assert.equal(r.ok, false);
  assert.equal(r.state.state, "INSUFFICIENT_DATA");
  assert.equal(r.state.confidence, null);
  assert.equal(r.events.length, 0);
  assert.match(r.reason, /أقل من الحد الأدنى/);
});

test("مصفوفة فاضية أو مدخل غلط ما بتكسر المحرك", () => {
  for (const bad of [null, undefined, [], "x", 42]) {
    const r = analyzeStructureV2(bad);
    assert.equal(r.ok, false);
    assert.equal(r.events.length, 0);
  }
});

/* ============================================================================
   ٢) الكسر بالإغلاق مش بالذيل
   ============================================================================ */
test("تجاوز بالذيل بدون إغلاق: ما بيولّد حدث، وبينتسجّل بـwickBreaks", () => {
  clock = 1700000000;
  const c = [
    ...ramp(100, 130, 12), // صعود
    ...ramp(130, 112, 10), // تصحيح
    ...ramp(112, 128, 10), // ارتداد تحت القمة
    // ذيل بيتجاوز 130 بس الإغلاق تحتها
    candle(128, 136, 127, 129),
    ...ramp(129, 124, 8),
  ];
  const r = analyzeStructureV2(c, { timeframe: "h4" });

  const wickUp = r.wickBreaks.filter((w) => w.direction === "up");
  assert.ok(wickUp.length >= 1, "لازم ينتسجّل تجاوز بالذيل");

  // ما في BOS صاعد عند نفس شمعة الذيل
  const wickIdx = wickUp[wickUp.length - 1].index;
  assert.equal(
    r.events.some((e) => e.index === wickIdx && e.direction === "up"),
    false,
    "الذيل ما لازم يولّد حدث"
  );
});

test("إغلاق فوق المستوى بيولّد حدث فعلاً (الضابط المقابل)", () => {
  clock = 1700000000;
  const c = [
    ...ramp(100, 130, 12),
    ...ramp(130, 112, 10),
    ...ramp(112, 138, 14), // بيغلق فوق 130
    ...ramp(138, 134, 6),
  ];
  const r = analyzeStructureV2(c, { timeframe: "h4" });
  assert.ok(r.events.some((e) => e.direction === "up"), "لازم يطلع حدث كسر صاعد");
});

/* ============================================================================
   ٣) الكسر الكاذب بينتوسم مش بينحذف
   ============================================================================ */
test("كسر كاذب: الحدث بيضل ظاهر مع fakeBreak=true وثقة أقل", () => {
  clock = 1700000000;
  const c = [
    ...ramp(100, 130, 12),
    ...ramp(130, 112, 10),
    ...ramp(112, 129, 10),
    candle(129, 134, 128, 133), // إغلاق فوق 130
    candle(133, 133.5, 124, 125), // رجع بإغلاق تحتها فوراً
    ...ramp(125, 120, 6),
  ];
  const r = analyzeStructureV2(c, { timeframe: "h4" });
  const up = r.events.filter((e) => e.direction === "up");
  assert.ok(up.length >= 1, "الحدث لازم يضل موجود");
  const fake = up.find((e) => e.fakeBreak);
  assert.ok(fake, "لازم ينتوسم ككسر كاذب");
  assert.ok(fake.confidence != null && fake.confidence < 0.5, `الثقة لازم تنخفض، طلعت ${fake.confidence}`);
  assert.match(fake.reason, /كسر كاذب/);
});

/* ============================================================================
   ٤) ما في نظر للمستقبل
   ============================================================================ */
test("المستوى ما بينكسر قبل ما البيفوت يتأكد (lookback شمعة)", () => {
  clock = 1700000000;
  const c = [...ramp(100, 130, 12), ...ramp(130, 112, 10), ...ramp(112, 140, 14)];
  const r = analyzeStructureV2(c, { timeframe: "h4", lookback: 2 });

  for (const e of r.events) {
    assert.ok(
      e.swingRef == null || e.index >= e.swingRef.index + r.meta.config.lookback,
      `حدث عند ${e.index} استخدم سوينغ عند ${e.swingRef?.index} قبل تأكده`
    );
  }
});

/* ============================================================================
   ٥) فصل المقياسين: الضجيج بيضل داخلي
   ============================================================================ */
test("الذبذبة الصغيرة بتطلع internal وما بتصير هيكل خارجي", () => {
  clock = 1700000000;
  const c = [...ramp(100, 140, 20), ...noise(140, 24, 0.6), ...ramp(140, 175, 20)];
  const r = analyzeStructureV2(c, { timeframe: "h4" });

  assert.ok(r.internalSwings.length > 0, "لازم يطلع بيفوتات داخلية من الضجيج");
  assert.ok(r.internalSwings.length > r.majorSwings.length, "الداخلي لازم يكون أكتر من الخارجي");

  /* مع زجزاج التأكيد: ضجيج ضيّق ما بيأكد ولا سوينغ خارجي إطلاقاً — لأن
     ما في انعكاس بحجم العتبة. صفر هون هو الجواب الصح، مش «واحد مرساة». */
  const inNoise = r.majorSwings.filter((s) => Math.abs(s.price - 140) < 1.2);
  assert.equal(inNoise.length, 0, `طلع ${inNoise.length} سوينغ خارجي مؤكَّد جوّا الضجيج`);

  /* الطرف المؤقّت بيضل ظاهر — بس منفصل عن الهيكل المؤكَّد. */
  assert.ok(r.provisionalSwing, "لازم يضل في طرف مؤقّت معروض");
});

test("أول سوينغ مؤكَّد بينتوسم كمرساة، والباقي لأ", () => {
  clock = 1700000000;
  const c = path([100, 145, 118, 162, 130, 175], 12);
  const r = analyzeStructureV2(c, { timeframe: "h4" });

  assert.ok(r.majorSwings.length >= 2, `لازم يتأكد سوينغين على الأقل، طلع ${r.majorSwings.length}`);
  assert.equal(r.majorSwings[0].isAnchor, true, "أول سوينغ مؤكَّد = مرساة");
  assert.equal(
    r.majorSwings.filter((s) => s.isAnchor).length,
    1,
    "مرساة وحدة بالضبط"
  );
  for (const s of r.majorSwings) {
    assert.ok(Number.isFinite(s.confirmedAtIndex), "كل سوينغ مؤكَّد لازم يحمل لحظة تأكيده");
    assert.ok(s.confirmedAtIndex > s.index, "التأكيد لازم يجي بعد تشكّل البيفوت");
  }
});

test("عتبة أعلى بتقلّل السوينغات الخارجية (الفلتر فعّال فعلاً)", () => {
  clock = 1700000000;
  const c = [...ramp(100, 140, 20), ...noise(140, 20, 0.8), ...ramp(140, 120, 14), ...ramp(120, 165, 22)];
  const low = analyzeStructureV2(c, { majorAtrMult: 0.5 });
  const high = analyzeStructureV2(c, { majorAtrMult: 4 });
  assert.ok(
    high.majorSwings.length <= low.majorSwings.length,
    `عتبة ٤ طلّعت ${high.majorSwings.length} وعتبة ٠.٥ طلّعت ${low.majorSwings.length}`
  );
});

/* ============================================================================
   ٦) BOS مقابل MSS — نوعان فقط، وما في CHOCH
   ============================================================================ */
test("كسر السوينغ الحامي بعكس الاتجاه = MSS مباشرة", () => {
  clock = 1700000000;
  const c = [
    ...ramp(100, 140, 16), // صعود
    ...ramp(140, 122, 10), // الـHL الحامي ~122
    ...ramp(122, 152, 14), // BOS صاعد
    ...ramp(152, 118, 18), // كسر الـHL الحامي = MSS هابط
    ...ramp(118, 126, 8),
  ];
  const r = analyzeStructureV2(c, { timeframe: "h4" });
  const types = r.events.map((e) => `${e.type}:${e.direction}`);
  assert.ok(types.includes("MSS:down"), `ما طلع MSS هابط — الأحداث: ${types.join(", ")}`);
});

test("ما في نوع CHOCH بالمخرج إطلاقاً", () => {
  clock = 1700000000;
  const c = [
    ...ramp(100, 140, 16),
    ...ramp(140, 122, 10),
    ...ramp(122, 152, 14),
    ...ramp(152, 116, 18),
    ...ramp(116, 130, 8),
    ...ramp(130, 104, 14),
    ...ramp(104, 110, 6),
  ];
  const r = analyzeStructureV2(c, { timeframe: "h4" });
  assert.ok(r.events.length > 0, "لازم يطلع أحداث");
  for (const e of r.events) {
    assert.ok(["BOS", "MSS"].includes(e.type), `نوع غير متوقع: ${e.type}`);
  }
  assert.equal(r.meta.counts.choch, undefined, "ما لازم يضل عدّاد CHOCH");
});

test("MSS ما بيحتاج تأكيد لاحق — بينطلق لحظة الكسر", () => {
  clock = 1700000000;
  /* صعود ثم كسر الـHL الحامي بآخر البيانات: ما في أي BOS بعده،
     ومع هيك لازم يطلع MSS. */
  const c = [...ramp(100, 140, 16), ...ramp(140, 124, 10), ...ramp(124, 154, 14), ...ramp(154, 118, 16)];
  const r = analyzeStructureV2(c, { timeframe: "h4" });
  const mss = r.events.filter((e) => e.type === "MSS");
  assert.ok(mss.length >= 1, "لازم يطلع MSS بدون أي تأكيد بعده");

  const last = mss[mss.length - 1];
  const after = r.events.filter((e) => e.index > last.index && e.direction === last.direction && e.type === "BOS");
  assert.equal(after.length, 0, "ما في BOS مؤكِّد بعده — ومع هيك الحدث طلع");
});

test("مستوى الـMSS = سعر السوينغ الحامي، مش شمعة الكسر", () => {
  clock = 1700000000;
  const c = [...ramp(100, 140, 16), ...ramp(140, 124, 10), ...ramp(124, 154, 14), ...ramp(154, 118, 16)];
  const r = analyzeStructureV2(c, { timeframe: "h4" });

  for (const e of r.events) {
    assert.ok(e.swingRef, `${e.type} بلا مرجع سوينغ`);
    assert.equal(e.price, e.swingRef.price, "سعر الحدث لازم يساوي سعر السوينغ المكسور");
    const bc = e.breakCandle;
    assert.ok(
      e.price !== bc.close || e.price === e.swingRef.price,
      "المستوى ما بينؤخذ من إغلاق شمعة الكسر"
    );
  }
});

test("الاتجاه بينقلب لحظة الـMSS — ما بينعلّق", () => {
  clock = 1700000000;
  const c = [...ramp(100, 140, 16), ...ramp(140, 124, 10), ...ramp(124, 154, 14), ...ramp(154, 116, 18)];
  const r = analyzeStructureV2(c, { timeframe: "h4" });
  const mss = r.events.filter((e) => e.type === "MSS");
  if (mss.length) {
    /* بعد MSS هابط، أي كسر هابط تالي لازم يكون BOS (استمرار بالاتجاه
       الجديد) مش MSS تاني — دليل إنه الاتجاه انقلب فعلاً وقتها. */
    const last = mss[mss.length - 1];
    const nextSameDir = r.events.find((e) => e.index > last.index && e.direction === last.direction);
    if (nextSameDir) assert.equal(nextSameDir.type, "BOS", "الاتجاه ما انقلب عند الـMSS");
  }
});

test("كل حدث بيحمل الحقول المطلوبة كاملة", () => {
  clock = 1700000000;
  const c = [...ramp(100, 140, 16), ...ramp(140, 120, 12), ...ramp(120, 158, 16), ...ramp(158, 130, 14)];
  const r = analyzeStructureV2(c, { timeframe: "h4" });
  assert.ok(r.events.length > 0, "لازم يطلع أحداث");

  for (const e of r.events) {
    for (const k of ["id", "type", "direction", "timeframe", "time", "index", "price", "breakCandle", "strength", "reason"]) {
      assert.ok(e[k] !== undefined, `الحقل ${k} ناقص بحدث ${e.type}`);
    }
    assert.equal(e.timeframe, "h4");
    assert.ok(["BOS", "CHOCH", "MSS"].includes(e.type));
    assert.ok(["up", "down"].includes(e.direction));
    assert.ok(e.confidence === null || (e.confidence >= 0 && e.confidence <= 1), `ثقة خارج النطاق: ${e.confidence}`);
  }
});

/* ============================================================================
   ٧) الزخم: العامل غير المتوفر ما بينحسب ضده
   ============================================================================ */
test("غياب الفوليوم بينشال من الحساب ولا بينحسب فشلاً", () => {
  clock = 1700000000;
  const base = [...ramp(100, 104, 25, 0.4)];
  const withoutVol = [...base, candle(104, 118, 103.5, 117)];
  const d1 = classifyDisplacement(withoutVol, withoutVol.length - 1);

  assert.ok(d1.unavailable.includes("volume"), "الفوليوم لازم ينتسجّل غير متوفر");
  const volFactor = d1.factors.find((f) => f.name === "volume");
  assert.equal(volFactor.passed, null, "العامل غير المتوفر لازم يكون null مش false");

  clock = 1700000000;
  const baseV = [];
  for (let i = 0; i < 25; i++) baseV.push(candle(100 + i * 0.16, 100 + i * 0.16 + 0.4, 100 + i * 0.16 - 0.4, 100 + i * 0.16 + 0.16, 1000));
  const withVol = [...baseV, candle(104, 118, 103.5, 117, 5000)];
  const d2 = classifyDisplacement(withVol, withVol.length - 1);
  assert.ok(!d2.unavailable.includes("volume"));
  assert.ok(d2.confidence >= d1.confidence, "دليل إضافي متحقق ما لازم ينزّل الثقة");
});

test("شمعة ذيول طويلة بجسم صغير ما بتتصنّف زخم قوي", () => {
  clock = 1700000000;
  const base = ramp(100, 104, 25, 0.4);
  const doji = [...base, candle(104, 118, 90, 104.3)]; // مدى ضخم، جسم شبه صفر
  const d = classifyDisplacement(doji, doji.length - 1);
  assert.ok(d.level !== "Extreme", `تصنّفت ${d.level} رغم إنه الجسم شبه صفر`);
  const bodyFactor = d.factors.find((f) => f.name === "body");
  assert.equal(bodyFactor.passed, false);
});

/* ============================================================================
   ٨) استقلال المقياس — نفس الشكل بأسعار مختلفة = نفس الهيكل
   ============================================================================ */
test("ضرب كل الأسعار بمعامل ثابت ما بيغيّر عدد الأحداث ولا أنواعها", () => {
  clock = 1700000000;
  const shape = [...ramp(100, 140, 16), ...ramp(140, 120, 12), ...ramp(120, 158, 16), ...ramp(158, 128, 14)];
  const scaled = shape.map((c) => ({ ...c, open: c.open * 37, high: c.high * 37, low: c.low * 37, close: c.close * 37 }));

  const a = analyzeStructureV2(shape, { timeframe: "h4" });
  const b = analyzeStructureV2(scaled, { timeframe: "h4" });

  assert.deepEqual(
    a.events.map((e) => `${e.type}:${e.direction}:${e.index}`),
    b.events.map((e) => `${e.type}:${e.direction}:${e.index}`),
    "الهيكل لازم يكون واحد — العتبة بالـATR فبتتقاس بوحدة الرمز نفسه"
  );
  assert.equal(a.majorSwings.length, b.majorSwings.length);
  assert.equal(a.state.state, b.state.state);
});

test("الفريم بينتقل لكل عنصر بالمخرج", () => {
  clock = 1700000000;
  const c = [...ramp(100, 140, 16), ...ramp(140, 118, 12), ...ramp(118, 156, 16)];
  for (const tf of ["h4", "daily", "m15"]) {
    const r = analyzeStructureV2(c, { timeframe: tf });
    assert.equal(r.timeframe, tf);
    for (const s of r.majorSwings) assert.equal(s.timeframe, tf);
    for (const e of r.events) assert.equal(e.timeframe, tf);
    for (const w of r.wickBreaks) assert.equal(w.timeframe, tf);
  }
});

/* ============================================================================
   ٩) حدود البيانات التاريخية
   ============================================================================ */
test("ATR بيشتغل من بداية البيانات بدون NaN", () => {
  clock = 1700000000;
  const c = ramp(100, 130, 40);
  const s = atrSeries(c, 14);
  assert.equal(s.length, c.length);
  assert.ok(s.slice(14).every((v) => Number.isFinite(v) && v > 0), "ما لازم يكون في NaN بعد اكتمال الفترة");
});

test("ما في بيفوت بأول/آخر lookback شمعة (ما بينعرف بعد)", () => {
  clock = 1700000000;
  const c = [...ramp(100, 140, 20), ...ramp(140, 120, 14)];
  const pivots = detectFractalPivots(c, 2);
  assert.ok(pivots.every((p) => p.index >= 2 && p.index <= c.length - 3));
});

test("تناوب السوينغات: ما في نوعين متتاليين متطابقين", () => {
  clock = 1700000000;
  const c = [...ramp(100, 140, 18), ...noise(140, 14, 0.7), ...ramp(140, 116, 14), ...ramp(116, 150, 18)];
  const alt = alternate(detectFractalPivots(c, 2));
  for (let i = 1; i < alt.length; i++) {
    assert.notEqual(alt[i].type, alt[i - 1].type, `نوعين متتاليين متطابقين عند ${i}`);
  }
});

test("التسميات بتتحسب مقابل نفس النوع، وأول واحد بدون تسمية", () => {
  const swings = [
    { index: 0, time: 1, price: 100, type: "low" },
    { index: 5, time: 2, price: 120, type: "high" },
    { index: 10, time: 3, price: 108, type: "low" },
    { index: 15, time: 4, price: 132, type: "high" },
    { index: 20, time: 5, price: 104, type: "low" },
  ];
  const l = labelSwings(swings);
  assert.equal(l[0].label, null);
  assert.equal(l[1].label, null);
  assert.equal(l[2].label, "HL"); // 108 > 100
  assert.equal(l[3].label, "HH"); // 132 > 120
  assert.equal(l[4].label, "LL"); // 104 < 108
});

/* ============================================================================
   ١٠) ثبات وتكرارية
   ============================================================================ */
test("نفس المدخل بيعطي نفس المخرج بالضبط", () => {
  clock = 1700000000;
  const c = [...ramp(100, 145, 20), ...ramp(145, 118, 14), ...ramp(118, 160, 18), ...ramp(160, 132, 12)];
  const a = JSON.stringify(analyzeStructureV2(c, { timeframe: "h4" }));
  const b = JSON.stringify(analyzeStructureV2(c, { timeframe: "h4" }));
  assert.equal(a, b);
});

test("إضافة شموع جديدة ما بتغيّر الأحداث القديمة (سببية)", () => {
  clock = 1700000000;
  const head = [...ramp(100, 140, 16), ...ramp(140, 120, 12), ...ramp(120, 158, 16)];
  const tail = [...ramp(158, 126, 14), ...ramp(126, 170, 16)];

  const before = analyzeStructureV2(head, { timeframe: "h4" });
  const after = analyzeStructureV2([...head, ...tail], { timeframe: "h4" });

  const cut = head.length;
  const oldEvents = after.events.filter((e) => e.index < cut - 3); // هامش لتأكيد البيفوت
  for (const e of oldEvents) {
    const match = before.events.find((x) => x.index === e.index && x.direction === e.direction);
    assert.ok(match, `حدث عند ${e.index} ظهر بس بعد إضافة شموع مستقبلية`);
  }
});
