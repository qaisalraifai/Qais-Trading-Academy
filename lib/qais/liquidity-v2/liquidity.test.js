/* ============================================================================
   اختبارات Liquidity Layer v2 — `node --test lib/qais/liquidity-v2/*.test.js`
   بدون أي تبعية خارجية.

   نطاق هالملف: **دلالة القواعد**، مش واقعية السوق. الشموع مبنيّة لتفعيل قاعدة
   وحدة كل مرة. قياس الدقة على بيانات حقيقية شي تاني ومكانه تقرير مستقل.

   درسان مأخوذان حرفياً من اختبارات محرك الهيكل — الاتنين كانوا فشل حقيقي:

   ١) مولّد شموع خطي بيطلّع **تعادلات بنقاط الانعطاف**، فشرط الفراكتال (`>=`)
      بيرفضها، فصفر بيفوت بينكشف، فأربعطعش اختبار «نجحوا» وهنّي بيمرقوا على
      مصفوفات فاضية. الحل: عشوائية ثابتة البذرة + شمعة طرف صريحة عند كل
      انعطاف، و**كل اختبار بيتأكد إنه طلّع البنية اللي بيدّعي فحصها قبل ما
      يفحصها**.

   ٢) اختبار محروس بـ`if` متداخلين نفّذ **صفر تأكيد** ونجح. لهيك: ما في تأكيد
      وراء شرط ممكن يكون false بصمت — الشرط نفسه بينتأكد أولاً.
   ============================================================================ */

import test from "node:test";
import assert from "node:assert/strict";

import { analyzeLiquidityV2, trendFromEvents, externalRangeAt } from "./index.js";
import { analyzeStructureV2 } from "../structure/index.js";
import { atrSeries, atrAtCausal } from "./atr-causal.js";
import { atrAt as structureAtrAt } from "../structure/atr.js";
import { detectEqualLevels } from "./equal-levels.js";
import { scanPoolInteractions, dedupeWickBreaks, SWEEP_DEFAULTS } from "./sweeps.js";
import { buildTimeSpans, detectBarSpacing, inferDayOpenHour, detectWeekStarts } from "./time-spans.js";
import { isInsufficient, makePool } from "./pool.js";

/* ============================================================================
   أدوات بناء البيانات
   ============================================================================ */

const H4 = 14400;
const DAY = 86400;
/* اليوم التداولي بيفتح **20:00 UTC** مش منتصف الليل — هاد اللي قاسيناه على
   بيانات حقيقية (٢٦ فجوة نهاية أسبوع من ٢٦ بتبدأ الساعة ٢٠). كل الأختام
   الزمنية بهالملف مبنيّة على هالافتتاح عن قصد، عشان أي كاشف بيفترض منتصف
   الليل يفشل هون بدل ما يفشل بالإنتاج. */
const OPEN_HOUR = 20;

/** مولّد عشوائي خطي ثابت البذرة — نفس السلسلة كل تشغيل. */
function makeRng(seed = 12345) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * أختام زمنية H4 بيوم تداولي بيفتح `openHour` مع فجوة نهاية أسبوع بعد كل
 * `daysPerWeek` يوم — الفجوة هي اللي بيستنتج منها المحرك ساعة الافتتاح.
 */
function tradingTimes(n, { openHour = OPEN_HOUR, barsPerDay = 6, daysPerWeek = 5, lastDayBars = null } = {}) {
  const times = [];
  let t = Date.UTC(2026, 1, 15, openHour, 0, 0) / 1000; // أحد
  let dayInWeek = 0;
  while (times.length < n) {
    const bars = lastDayBars != null && dayInWeek === daysPerWeek - 1 ? lastDayBars : barsPerDay;
    for (let b = 0; b < bars && times.length < n; b++) {
      times.push(t);
      t += H4;
    }
    // القفز لافتتاح اليوم التالي حتى لو اليوم كان ناقص
    t = Math.ceil((t - openHour * 3600) / DAY) * DAY + openHour * 3600;
    dayInWeek++;
    if (dayInWeek === daysPerWeek) {
      dayInWeek = 0;
      t += 2 * DAY;
    }
  }
  return times;
}

/**
 * مسار أسعار من نقاط انعطاف. كل انعطاف بياخد شمعة طرف صارم (أعلى/أوطى من
 * جيرانها بهامش) حتى ينكشف كبيفوت فعلاً — مش تعادل يبلعه الفراكتال.
 * (نفس منهج `path` باختبارات الهيكل، معاد كتابته هون حتى يضل الملفان مستقلين.)
 */
function pricePath(points, barsPerLeg = 8, { wick = 0.6, seed = 7, apexMargin = 2 } = {}) {
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
      out.push({ open: o, high: Math.max(o, c) + j, low: Math.min(o, c) - j, close: c });
    }
    const next = points[p + 2];
    if (next != null && ((up && next < b) || (!up && next > b))) {
      const o = b - (up ? 0.3 : -0.3);
      out.push(
        up
          ? { open: o, high: b + apexMargin, low: o - wick, close: b - 0.25 }
          : { open: o, high: o + wick, low: b - apexMargin, close: b + 0.25 }
      );
    }
  }
  return out;
}

/** لصق الأختام الزمنية على مسار الأسعار. */
function withTimes(bars, opts = {}) {
  const times = tradingTimes(bars.length, opts);
  return bars.map((b, i) => ({ ...b, time: times[i] }));
}

function series(points, barsPerLeg = 8, opts = {}) {
  return withTimes(pricePath(points, barsPerLeg, opts), opts);
}

/** شموع مسطّحة حول مستوى — قاعدة لبناء حالات يدوية دقيقة. */
function flat(n, level, { amp = 1, seed = 5 } = {}) {
  const rng = makeRng(seed);
  const out = [];
  let prev = level;
  for (let i = 0; i < n; i++) {
    const target = level + (rng() - 0.5) * amp;
    out.push({ open: prev, high: Math.max(prev, target) + rng() * amp * 0.5, low: Math.min(prev, target) - rng() * amp * 0.5, close: target });
    prev = target;
  }
  return out;
}

const utcHour = (t) => new Date(t * 1000).getUTCHours();

/* ============================================================================
   ١) مدخلات ناقصة — ما بيطلع أرقام مخترعة
   ============================================================================ */

test("مدخل فاضي أو غلط: ok=false وكل المقاييس INSUFFICIENT_DATA بسبب مكتوب", () => {
  for (const bad of [null, undefined, [], "x", 42, {}]) {
    const r = analyzeLiquidityV2(bad);
    assert.equal(r.ok, false, `المدخل ${JSON.stringify(bad)} لازم يترفض`);
    assert.equal(r.pools.length, 0);
    assert.equal(r.sweeps.length, 0);
    assert.ok(isInsufficient(r.externalRange), "النطاق الخارجي لازم يطلع INSUFFICIENT_DATA");
    assert.ok(isInsufficient(r.metrics.pools), "مقياس البِرك لازم يطلع INSUFFICIENT_DATA");
    assert.ok(typeof r.metrics.pools.why === "string" && r.metrics.pools.why.length > 0, "لازم يكون في سبب مكتوب");
    assert.equal(r.trend.trend, null);
  }
});

test("شموع أقل من الحد الأدنى بترفض بدل ما تطلّع بِرك من ولا شي", () => {
  const c = series([100, 108], 5);
  assert.ok(c.length < 30, `العيّنة لازم تكون تحت الحد الأدنى فعلاً، طلعت ${c.length}`);
  const r = analyzeLiquidityV2(c);
  assert.equal(r.ok, false);
  assert.match(r.reason, /أقل من الحد الأدنى/);
});

/* ============================================================================
   ٢) السببية: ATR ما بيمسح للأمام
   ============================================================================ */

test("ATR سببي: ما بياخد قيمة من المستقبل", () => {
  const s = [null, null, null, 5, 7];
  /* الاختبار انكتب أصلاً كـ**تباين**: نسخة الهيكل كانت تمسح للأمام
     وترجّع ٥ للفهرس ٠ (قيمة من الفهرس ٣)، فانبنى بديل سببي بهالطبقة.
     العيب انصلح بالمصدر، فالاتنين صاروا نفس الدالة — والادعاء صار
     إنهم **الاتنين** سببيين، مش إنهم بيختلفوا. */
  assert.equal(structureAtrAt(s, 0), null, "نسخة الهيكل صارت سببية كمان");
  assert.equal(atrAtCausal(s, 0), null, "ما في قيمة قبل الفهرس ٠");
  assert.equal(atrAtCausal(s, 3), 5);
  assert.equal(atrAtCausal(s, 4), 7);
  assert.equal(atrAtCausal(s, 99), 7, "خارج المدى بيرجع لآخر قيمة متوفرة (خلفياً)");
  assert.equal(atrAtCausal, structureAtrAt, "مصدر واحد — مش نسختين بتتفرّقوا");
});

test("إضافة شموع جديدة ما بتغيّر بركة ولا انسحاب انحسموا قبل نقطة القطع", () => {
  const c = series([100, 150, 118, 168, 130, 190, 150, 205, 160], 20, { seed: 21 });
  assert.ok(c.length >= 150, `لازم عيّنة كبيرة كفاية للقطع، طلعت ${c.length}`);
  const cut = Math.floor(c.length * 0.65);

  const prefix = analyzeLiquidityV2(c.slice(0, cut), { timeframe: "h4" });
  const full = analyzeLiquidityV2(c, { timeframe: "h4" });
  assert.ok(prefix.ok && full.ok, "التشغيلتان لازم تنجحا");

  const fullPools = new Map(full.pools.map((p) => [p.id, p]));
  let checkedPools = 0;
  for (const p of prefix.pools) {
    if (p.expiresAtIndex == null || p.expiresAtIndex >= cut - 1) continue; // لسا حيّة عند القطع
    checkedPools++;
    const f = fullPools.get(p.id);
    assert.ok(f, `بركة ${p.id} اختفت لما امتدت البيانات`);
    assert.equal(f.status, p.status, `حالة ${p.id} تغيّرت بأثر رجعي`);
    assert.equal(f.price, p.price);
    assert.equal(f.availableFromIndex, p.availableFromIndex);
    assert.equal(f.strength, p.strength, `قوة ${p.id} تغيّرت بأثر رجعي`);
  }
  assert.ok(checkedPools > 0, "لازم يكون في بِرك منتهية الصلاحية قبل القطع حتى يكون الفحص فعلي");

  const fullSweeps = new Map(full.sweeps.map((s) => [s.id, s]));
  let checkedSweeps = 0;
  for (const s of prefix.sweeps) {
    if (isInsufficient(s.outcome)) continue;
    if (s.reactionWindow.end >= cut - 1) continue; // نافذة الحكم بتمتد بعد القطع
    checkedSweeps++;
    const f = fullSweeps.get(s.id);
    assert.ok(f, `انسحاب ${s.id} اختفى لما امتدت البيانات`);
    assert.equal(f.outcome, s.outcome, `نتيجة ${s.id} تغيّرت بأثر رجعي`);
    assert.equal(f.touchCandles, s.touchCandles);
  }
  assert.ok(checkedSweeps > 0, "لازم يكون في انسحابات محسومة قبل القطع حتى يكون الفحص فعلي");
});

/* ============================================================================
   ٣) القمم/القيعان المتساوية
   ============================================================================ */

/**
 * قمتان سوينغ بسعرين محددين بينهم تصحيح.
 * الساق الأولى (100→118→106) موجودة عشان **تسخين الـATR**: نطاق التسامح
 * بينحسب بـATR سببي، فقبل اكتمال فترة الـ١٤ ما في تقلب مقيس والسوينغ بينشال
 * من العنقدة (وهاد الصح). بدونها الاختبار بيفشل لسبب ما إله علاقة بالقاعدة.
 */
function twoHighs(secondHigh) {
  const c = series([100, 118, 106, 140, 124, secondHigh, 120, 132], 10, { seed: 11 });
  const st = analyzeStructureV2(c, { timeframe: "h4" });
  return { candles: c, structure: st };
}

test("قمتان ضمن نطاق التسامح بتتجمّعوا ببركة EqualHighs وحدة", () => {
  const { candles, structure } = twoHighs(140.1);

  // شرط مسبق: القمتان انكشفوا فعلاً كبيفوتات
  const highs = structure.internalSwings.filter((s) => s.type === "high" && Math.abs(s.price - 140) < 3);
  assert.ok(highs.length >= 2, `لازم ينكشف بيفوتين قريبين من 140، انكشف ${highs.length}`);
  assert.ok(highs[1].index - highs[0].index >= 3, "لازم يكونوا مفصولين بشموع — مش نفس الذروة");

  const atr = atrSeries(candles, 14);
  const { pools } = detectEqualLevels(candles, structure.internalSwings, { atr, lookback: 2, timeframe: "h4" });
  const eq = pools.filter((p) => p.type === "EqualHighs" && Math.abs(p.price - 140) < 3);
  assert.ok(eq.length >= 1, `لازم تطلع بركة قمم متساوية، طلع ${pools.length} بركة بلا وحدة قريبة من 140`);
  assert.ok(eq[0].measure.members >= 2, "البركة لازم تحمل عدد أعضائها");
  assert.ok(eq[0].measure.spread <= eq[0].measure.tolerance, "الفرق الفعلي لازم يكون جوّا النطاق");
  assert.equal(eq[0].side, "buy", "سيولة فوق القمم = جهة شراء");
});

test("قمتان خارج نطاق التسامح ما بتتجمّعوا — الكاشف مش بيبلع أي فرق", () => {
  const { candles, structure } = twoHighs(152);

  const highs = structure.internalSwings.filter((s) => s.type === "high" && s.price > 135);
  assert.ok(highs.length >= 2, `لازم ينكشف قمتين، انكشف ${highs.length}`);

  const atr = atrSeries(candles, 14);
  const tolerance = atrAtCausal(atr, highs[highs.length - 1].index) * 0.1;
  const gap = Math.abs(highs[highs.length - 1].price - highs[0].price);
  assert.ok(gap > tolerance, `الفرق (${gap.toFixed(2)}) لازم يكون أكبر من النطاق (${tolerance.toFixed(2)}) حتى يكون الفحص فعلي`);

  const { pools } = detectEqualLevels(candles, structure.internalSwings, { atr, lookback: 2, timeframe: "h4" });
  const joined = pools.find(
    (p) =>
      p.type === "EqualHighs" &&
      p.source.members.some((m) => m.index === highs[0].index) &&
      p.source.members.some((m) => m.index === highs[highs.length - 1].index)
  );
  assert.equal(joined, undefined, "قمتان بفرق أكبر من النطاق ما لازم ينحطوا بنفس البركة");
});

test("شمعتان متجاورتان بنفس القمة مش «قمم متساوية» — الغلط اللي بـedge-cases.js", () => {
  /* القمم المتساوية بالمعنى السيولي = **سوينغين** بينهم تصحيح، مش شمعتين
     جنب بعض بنفس السقف. الكاشف الموجود بـverify/edge-cases.js بيقارن
     candles[i].high بـcandles[i-1].high — هالاختبار بيثبّت إنّا ما كرّرناه. */
  const base = flat(30, 100, { seed: 3 });
  const twin = { open: 100, high: 112, low: 99, close: 101 };
  const bars = [...base, twin, { ...twin, open: 101, close: 100.5 }, ...flat(20, 100, { seed: 4 })];
  const candles = withTimes(bars);

  // شرط مسبق: الشمعتان فعلاً متجاورتان وبنفس القمة بالضبط
  const i = base.length;
  assert.equal(candles[i].high, candles[i + 1].high, "لازم يكون التعادل موجود فعلاً");
  assert.equal(candles[i + 1].time - candles[i].time, H4, "لازم يكونوا متجاورتين");

  const swings = [
    { index: i, time: candles[i].time, price: candles[i].high, type: "high" },
    { index: i + 1, time: candles[i + 1].time, price: candles[i + 1].high, type: "high" },
  ];
  const atr = atrSeries(candles, 14);
  const { pools } = detectEqualLevels(candles, swings, { atr, lookback: 2, timeframe: "h4" });
  assert.equal(pools.length, 0, "شمعتان متجاورتان ما لازم يطلّعوا بركة — المسافة أقل من الحد الأدنى");
});

/* ============================================================================
   ٤) الانسحاب مقابل الكسر النظيف
   ============================================================================ */

/** بركة يدوية عند مستوى معيّن — لفحص قواعد المسح لحالها. */
function poolAt(price, side, availableFromIndex) {
  return makePool({
    type: side === "buy" ? "SwingHigh" : "SwingLow",
    side,
    price,
    time: 0,
    index: availableFromIndex,
    timeframe: "h4",
    availableFromIndex,
    strength: "Normal",
    measure: {},
    source: { kind: "test" },
    reason: "بركة اختبار",
  });
}

test("تجاوز بالذيل بدون إغلاق = انسحاب · إغلاق خلف المستوى = كسر نظيف", () => {
  const LEVEL = 110;
  const base = flat(30, 100, { seed: 9 });

  const sweptBars = [...base, { open: 104, high: 113, low: 103, close: 105 }, ...flat(10, 100, { seed: 2 })];
  const brokenBars = [...base, { open: 104, high: 113, low: 103, close: 112 }, ...flat(10, 112, { seed: 2 })];
  const swept = withTimes(sweptBars);
  const broken = withTimes(brokenBars);
  const hit = base.length;

  // شرط مسبق: الحالتان مبنيّتان صح — نفس القمة، إغلاق مختلف
  assert.ok(swept[hit].high > LEVEL && swept[hit].close <= LEVEL, "حالة الانسحاب: ذيل فوق المستوى وإغلاق تحته");
  assert.ok(broken[hit].high > LEVEL && broken[hit].close > LEVEL, "حالة الكسر: إغلاق فوق المستوى");

  const a = scanPoolInteractions(swept, poolAt(LEVEL, "buy", 20), { atr: atrSeries(swept, 14) });
  assert.equal(a.breach, null, "تجاوز بالذيل ما لازم ينحسب كسر");
  assert.equal(a.episodes.length, 1, `لازم حلقة انسحاب وحدة، طلع ${a.episodes.length}`);
  assert.equal(a.episodes[0].touchCandles, 1);

  const b = scanPoolInteractions(broken, poolAt(LEVEL, "buy", 20), { atr: atrSeries(broken, 14) });
  assert.ok(b.breach, "الإغلاق فوق المستوى لازم ينحسب كسر نظيف");
  assert.equal(b.breach.index, hit);
  assert.equal(b.episodes.length, 0, "الكسر النظيف مش انسحاب");
});

test("حلقة الانسحاب بتتجمّع: عشر شموع لامسة نفس المستوى = محاولة وحدة مش عشرة", () => {
  const LEVEL = 110;
  const base = flat(30, 100, { seed: 9 });
  const touching = [];
  for (let i = 0; i < 10; i++) touching.push({ open: 108, high: 110 + 0.3 + i * 0.05, low: 107.5, close: 109 });
  const bars = [...base, ...touching, ...flat(10, 100, { seed: 6 })];
  const candles = withTimes(bars);

  // شرط مسبق: عشر شموع فعلاً بتتجاوز المستوى بالذيل بدون إغلاق
  const wicking = candles.filter((c) => c.high > LEVEL && c.close <= LEVEL);
  assert.equal(wicking.length, 10, `لازم ١٠ شموع لامسة، طلع ${wicking.length}`);

  const { episodes } = scanPoolInteractions(candles, poolAt(LEVEL, "buy", 20), { atr: atrSeries(candles, 14) });
  assert.equal(episodes.length, 1, `١٠ لمسات متلاصقة = حلقة وحدة، طلع ${episodes.length}`);
  assert.equal(episodes[0].touchCandles, 10, "عدد اللمسات لازم يضل محفوظ صراحةً");
});

test("لمسة بعد تراجع فعلي = محاولة جديدة (مش نفس الحلقة)", () => {
  const LEVEL = 110;
  const atrHint = 1.6; // تقريباً ATR الشموع المسطّحة
  const base = flat(30, 100, { seed: 9 });
  const bars = [
    ...base,
    { open: 108, high: 111, low: 107, close: 109 }, // لمسة أولى
    ...flat(6, 100, { seed: 7 }), // تراجع واضح تحت المستوى
    { open: 108, high: 111.5, low: 107, close: 109 }, // لمسة تانية
    ...flat(10, 100, { seed: 8 }),
  ];
  const candles = withTimes(bars);
  const atr = atrSeries(candles, 14);

  // شرط مسبق: التراجع بين اللمستين أكبر من عتبة «ترك المستوى»
  const between = candles.slice(base.length + 1, base.length + 7);
  const maxHigh = Math.max(...between.map((c) => c.high));
  const threshold = atrAtCausal(atr, base.length + 3) * SWEEP_DEFAULTS.reentryAtrMult;
  assert.ok(
    LEVEL - maxHigh >= threshold,
    `التراجع (${(LEVEL - maxHigh).toFixed(2)}) لازم يتجاوز العتبة (${threshold.toFixed(2)}) وإلا الاختبار ما بيفحص شي`
  );
  assert.ok(atrHint > 0);

  const { episodes } = scanPoolInteractions(candles, poolAt(LEVEL, "buy", 20), { atr });
  assert.equal(episodes.length, 2, `لازم حلقتين منفصلتين، طلع ${episodes.length}`);
  assert.equal(episodes[0].touchCandles, 1);
  assert.equal(episodes[1].touchCandles, 1);
});

test("dedupeWickBreaks بيرجّع معامل التضخيم بدل ما يبلع التكرار بصمت", () => {
  const LEVEL = 110;
  const base = flat(30, 100, { seed: 9 });
  const bars = [...base];
  for (let i = 0; i < 4; i++) bars.push({ open: 108, high: 111, low: 107, close: 109 });
  bars.push(...flat(20, 100, { seed: 4 }));
  const candles = withTimes(bars);

  // wickBreaks خام متل ما بيطلّعها محرك الهيكل: مدخل لكل شمعة لامسة
  const raw = [];
  for (let i = base.length; i < base.length + 4; i++) {
    raw.push({ direction: "up", level: LEVEL, index: i, time: candles[i].time });
  }
  assert.equal(raw.length, 4, "شرط مسبق: أربع مداخل خام");

  const d = dedupeWickBreaks(candles, raw, { atr: atrSeries(candles, 14) });
  assert.equal(d.raw, 4);
  assert.equal(d.episodes.length, 1, `أربع مداخل على نفس المستوى ومتلاصقة = محاولة وحدة، طلع ${d.episodes.length}`);
  assert.equal(d.inflation, 4, "معامل التضخيم لازم ينكتب صراحةً");
});

/* ============================================================================
   ٥) اتاخدت مقابل باقية
   ============================================================================ */

test("بركة ما انلمست بتضل remaining بلا takenAt، واللي انلمست بتنتوسم بوقتها", () => {
  const LEVEL_HIT = 110;
  const LEVEL_FAR = 200;
  const base = flat(30, 100, { seed: 9 });
  const bars = [...base, { open: 104, high: 113, low: 103, close: 105 }, ...flat(15, 100, { seed: 2 })];
  const candles = withTimes(bars);
  const atr = atrSeries(candles, 14);
  const hit = base.length;

  // شرط مسبق: مستوى منلمس ومستوى ما انلمس أبداً
  assert.ok(candles.some((c) => c.high > LEVEL_HIT), "لازم يكون في شمعة بتتجاوز المستوى القريب");
  assert.ok(!candles.some((c) => c.high > LEVEL_FAR), "المستوى البعيد ما لازم ينلمس إطلاقاً");

  const touched = scanPoolInteractions(candles, poolAt(LEVEL_HIT, "buy", 20), { atr });
  assert.equal(touched.episodes.length, 1);
  assert.equal(touched.episodes[0].startIndex, hit, "وقت الاستهلاك لازم يكون شمعة اللمس بالضبط");

  const untouched = scanPoolInteractions(candles, poolAt(LEVEL_FAR, "buy", 20), { atr });
  assert.equal(untouched.episodes.length, 0);
  assert.equal(untouched.breach, null);
});

test("المخرج الكامل بيصنّف كل بركة لواحدة من ثلاث حالات، وكل مستهلكة بتحمل وقتها", () => {
  const c = series([100, 150, 120, 170, 132, 195, 150], 10, { seed: 33 });
  const r = analyzeLiquidityV2(c, { timeframe: "h4" });
  assert.ok(r.ok && r.pools.length > 0, `لازم يطلع بِرك، طلع ${r.pools.length}`);

  const statuses = new Set(r.pools.map((p) => p.status));
  for (const s of statuses) assert.ok(["remaining", "swept", "breached"].includes(s), `حالة غير متوقعة: ${s}`);
  assert.ok(statuses.has("remaining"), "لازم يضل بِرك باقية");
  assert.ok(statuses.has("swept") || statuses.has("breached"), "لازم يكون في بِرك مستهلكة كمان");

  for (const p of r.pools) {
    if (p.status === "remaining") {
      assert.equal(p.takenAt, null, `بركة باقية ${p.id} ما لازم يكون إلها وقت استهلاك`);
    } else {
      assert.ok(p.takenAt && Number.isFinite(p.takenAt.index), `بركة ${p.status} ${p.id} لازم تحمل وقت استهلاكها`);
      assert.ok(p.takenAt.index >= p.availableFromIndex, "الاستهلاك ما بيصير قبل إتاحة البركة");
      assert.ok(["wick_sweep", "close_break"].includes(p.takenAt.how));
    }
  }
});

/* ============================================================================
   ٦) داخلي مقابل خارجي
   ============================================================================ */

test("externalRangeAt بياخد آخر قمة وقاع **مؤكَّدين قبل اللحظة** بس", () => {
  const majors = [
    { index: 5, time: 1, price: 100, type: "low", confirmedAtIndex: 9 },
    { index: 20, time: 2, price: 140, type: "high", confirmedAtIndex: 24 },
    { index: 40, time: 3, price: 118, type: "low", confirmedAtIndex: 44 },
    { index: 60, time: 4, price: 175, type: "high", confirmedAtIndex: 64 },
  ];
  const early = externalRangeAt(majors, 30);
  assert.equal(early.high.price, 140);
  assert.equal(early.low.price, 100, "القاع عند 118 لسا ما تأكد عند الشمعة ٣٠");

  const later = externalRangeAt(majors, 70);
  assert.equal(later.high.price, 175);
  assert.equal(later.low.price, 118);

  const tooEarly = externalRangeAt(majors, 10);
  assert.ok(isInsufficient(tooEarly), "ما في قمة مؤكَّدة بعد — لازم INSUFFICIENT_DATA مش تخمين");
  assert.match(tooEarly.why, /غير قابل للحساب/);
});

test("كل بركة بتنصنّف داخلية أو خارجية مقابل إطار لحظة تكوّنها، والصنفان موجودان", () => {
  const c = series([100, 150, 120, 170, 132, 195, 150, 210, 165], 10, { seed: 41 });
  const r = analyzeLiquidityV2(c, { timeframe: "h4" });
  const st = analyzeStructureV2(c, { timeframe: "h4" });

  const scoped = r.pools.filter((p) => p.scope != null);
  assert.ok(scoped.length > 0, `لازم تنصنّف بِرك، انصنّف ${scoped.length}`);

  const internal = scoped.filter((p) => p.scope === "internal");
  const external = scoped.filter((p) => p.scope === "external");
  assert.ok(internal.length > 0, "لازم يطلع بِرك داخلية — وإلا التصنيف ما انفحص");
  assert.ok(external.length > 0, "لازم يطلع بِرك خارجية — وإلا التصنيف ما انفحص");

  for (const p of scoped) {
    const frame = externalRangeAt(st.majorSwings, p.availableFromIndex);
    assert.ok(!isInsufficient(frame), `بركة مصنّفة ${p.id} بلا إطار — تناقض`);
    const beyond = p.price >= frame.high.price || p.price <= frame.low.price;
    assert.equal(p.scope, beyond ? "external" : "internal", `تصنيف غلط لـ${p.id}`);
    assert.ok(typeof p.scopeReason === "string" && p.scopeReason.length > 0, "لازم سبب مكتوب للتصنيف");
  }

  // النطاق الحالي محصور بالبِرك الحيّة بس — مع عدّاد حتى ما يمرق الفحص فاضي
  let liveChecked = 0;
  for (const p of r.pools) {
    if (p.currentScope == null) continue;
    liveChecked++;
    assert.equal(p.status, "remaining", `بركة ${p.status} ما لازم يكون إلها نطاق حالي`);
    assert.ok(["internal", "external"].includes(p.currentScope));
  }
  assert.ok(liveChecked > 0, "لازم يضل بِرك حيّة عند آخر شمعة، وإلا هالفحص ما نفّذ ولا تأكيد");
});

/* ============================================================================
   ٧) حدود اليوم/الأسبوع/الجلسة — يوم تداولي مش بمنتصف الليل
   ============================================================================ */

test("ساعة افتتاح اليوم بتنستنتج من فجوات السوق — 20:00 مش 00:00", () => {
  const c = series([100, 130, 112, 145, 120, 160, 135, 175], 18, { seed: 51 });
  assert.ok(c.length >= 120, `لازم عيّنة فيها فجوات نهاية أسبوع، طلعت ${c.length}`);

  const spacing = detectBarSpacing(c);
  assert.equal(spacing.seconds, H4, "المسافة النموذجية لازم تنقاس ٤ ساعات");

  const { gaps } = detectWeekStarts(c, spacing.seconds);
  assert.ok(gaps.length >= 2, `لازم ينقاس فجوتين نهاية أسبوع على الأقل، انقاس ${gaps.length}`);

  const inferred = inferDayOpenHour(c, gaps);
  assert.equal(inferred.hour, OPEN_HOUR, "ساعة الافتتاح المستنتَجة لازم تكون ٢٠");
  assert.equal(inferred.agreement, 1, "كل الفجوات لازم تتفق");
});

test("التقسيم اليومي بيتبع اليوم التداولي، وبيختلف فعلياً عن التقسيم بمنتصف الليل", () => {
  const c = series([100, 130, 112, 145, 120, 160, 135, 175], 18, { seed: 51 });
  const spans = buildTimeSpans(c, {});
  assert.ok(spans.day.spans, `التقسيم اليومي لازم ينجح: ${JSON.stringify(spans.day)}`);
  assert.equal(spans.day.source, "inferred_open_hour");
  assert.equal(spans.day.openHour, OPEN_HOUR);
  assert.equal(spans.day.validation.ratio, 1, "كل يوم لازم يبدأ عند الساعة المستنتَجة");

  for (let i = 1; i < spans.day.spans.length; i++) {
    assert.equal(utcHour(c[spans.day.spans[i].startIndex].time), OPEN_HOUR, `اليوم ${i} ما بيبدأ عند ٢٠:٠٠`);
  }

  /* الضابط الحاسم: لو انجمعوا بـfloor(time/86400) — الطريقة اللي حذّرنا منها —
     بتطلع قمم أيام مختلفة. الاختبار بيثبّت إنه الفرق حقيقي مش نظري. */
  const naive = new Map();
  for (const k of c) {
    const key = Math.floor(k.time / DAY);
    const cur = naive.get(key) || { high: -Infinity, low: Infinity };
    naive.set(key, { high: Math.max(cur.high, k.high), low: Math.min(cur.low, k.low) });
  }
  assert.ok(naive.size >= 3, `شرط مسبق: التقسيم الساذج لازم يطلّع دلاء متعددة، طلّع ${naive.size}`);

  let differing = 0;
  for (const s of spans.day.spans) {
    const key = Math.floor(c[s.startIndex].time / DAY);
    const n = naive.get(key);
    if (!n) continue;
    if (n.high !== s.high || n.low !== s.low) differing++;
  }
  assert.ok(differing > 0, "التقسيم بمنتصف الليل لازم يعطي نتيجة مختلفة — وإلا الاختبار ما بيثبت شي");
});

test("قمة/قاع أمس بتتاخد من اليوم التداولي السابق المكتمل، ومتاحة من أول شمعة باليوم الجديد", () => {
  const c = series([100, 130, 112, 145, 120, 160, 135, 175], 18, { seed: 51 });
  const r = analyzeLiquidityV2(c, { timeframe: "h4" });
  const spans = r.spans.day.spans;
  assert.ok(spans && spans.length >= 5, `لازم أيام متعددة، طلع ${spans?.length}`);

  const pdh = r.pools.filter((p) => p.type === "PreviousDayHigh");
  assert.ok(pdh.length > 0, `لازم تطلع مستويات «قمة أمس»، طلع ${pdh.length}`);

  for (const p of pdh) {
    const span = spans.find((s) => s.startIndex === p.availableFromIndex);
    assert.ok(span, `بركة قمة أمس عند ${p.availableFromIndex} مش عند بداية يوم`);
    const src = spans.find((s) => s.startIndex === p.source.startIndex);
    assert.ok(src, "لازم مرجع لليوم المصدر");
    assert.equal(p.price, src.high, "السعر لازم يساوي قمة اليوم المصدر بالضبط");
    assert.ok(src.endIndex < p.availableFromIndex, "اليوم المصدر لازم يكون خلص قبل إتاحة المستوى");
    assert.equal(src.partial, false, "اليوم المصدر لازم يكون مكتمل ومتحقَّق منه");
    assert.equal(p.expiresAtIndex, span.endIndex, "مستوى أمس بينتهي بنهاية اليوم الحالي");
  }
});

test("يوم ناقص ما بينعتمد كمصدر لقمة أمس — وبينتسجّل سبب التخطي", () => {
  /* آخر يوم بالأسبوع بشمعة وحدة — نفس شكل شمعة الجمعة 20:00 بالبيانات
     الحقيقية. لو انعتمدت كـ«أمس» بيصير المرجع مدى ٤ ساعات. */
  const bars = pricePath([100, 130, 112, 145, 120, 160, 135, 175], 9, { seed: 51 });
  const c = withTimes(bars, { lastDayBars: 1 });
  const r = analyzeLiquidityV2(c, { timeframe: "h4" });

  const spans = r.spans.day.spans;
  const partials = spans.filter((s) => s.partial === true);
  assert.ok(partials.length > 0, `شرط مسبق: لازم يطلع أيام ناقصة، طلع ${partials.length}`);

  const partialStarts = new Set(partials.map((s) => s.startIndex));
  const pdh = r.pools.filter((p) => p.type === "PreviousDayHigh");
  assert.ok(pdh.length > 0, "لازم يضل في مستويات قمة أمس من أيام مكتملة");
  for (const p of pdh) {
    assert.ok(!partialStarts.has(p.source.startIndex), `بركة ${p.id} مصدرها يوم ناقص`);
  }

  const skips = r.skipped.filter((s) => s.from === "previousDay");
  assert.ok(skips.length > 0, "التخطي لازم ينتسجّل بسببه مش يمرق بصمت");
  assert.ok(skips.every((s) => typeof s.why === "string" && s.why.length > 0));
});

test("مستويات الجلسات بتنبنى من حصص متتالية، والقمة بتساوي قمة شموع الحصة", () => {
  const c = series([100, 130, 112, 145, 120, 160, 135, 175], 18, { seed: 51 });
  const r = analyzeLiquidityV2(c, { timeframe: "h4" });

  assert.ok(r.spans.sessions.runs, `تقسيم الجلسات لازم ينجح: ${JSON.stringify(r.spans.sessions)}`);
  assert.ok(r.spans.sessions.runs.length > 0, "لازم تطلع حصص جلسات");

  const sh = r.pools.filter((p) => p.type === "SessionHigh");
  assert.ok(sh.length > 0, `لازم تطلع مستويات قمة جلسة، طلع ${sh.length}`);

  for (const p of sh.slice(0, 25)) {
    const { startIndex, endIndex } = p.source;
    let high = -Infinity;
    for (let i = startIndex; i <= endIndex; i++) high = Math.max(high, c[i].high);
    assert.equal(p.price, high, "قمة الجلسة لازم تساوي أعلى قمة بشموع الحصة");
    assert.equal(p.availableFromIndex, endIndex + 1, "الجلسة بتصير معروفة بعد ما تسكّر آخر شمعة فيها");
    assert.ok(["Sydney", "Tokyo", "London", "New York"].includes(p.source.session));
  }

  // كل حصة لازم تكون متتالية فعلاً (مش مجمّعة من شموع متفرقة)
  for (const run of r.spans.sessions.runs) {
    assert.equal(run.endIndex - run.startIndex + 1, run.bars, "حصة الجلسة لازم تكون شموع متتالية");
  }
});

test("شموع «فريم أكبر» مش أكبر فعلاً بترفض — العيب اللي صار مع المزوّد", () => {
  /* صار وقت القياس: `interval=1d` مش مدعوم عند Dukascopy فتراجع ليوهو،
     ويوهو خدم شموع ١٥ دقيقة. من غير حارس، المحرك بيبني منها «أيام». */
  const c = series([100, 130, 112, 145, 120, 160, 135, 175], 18, { seed: 51 });
  const fake = c.slice(0, 200).map((k, i) => ({ ...k, time: k.time - i })); // مسافة أصغر بكتير
  const spans = buildTimeSpans(c, { dailyCandles: fake });
  assert.ok(isInsufficient(spans.day), "لازم ترفض شموع مش أكبر من الفريم الأساسي");
  assert.match(spans.day.why, /مش أكبر|غير قابلة للقياس/);

  // الضابط: شموع أكبر فعلاً بتنقبل
  const realDaily = [];
  for (let i = 0; i < c.length; i += 6) {
    const chunk = c.slice(i, i + 6);
    if (chunk.length < 6) break;
    realDaily.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map((x) => x.high)),
      low: Math.min(...chunk.map((x) => x.low)),
      close: chunk[chunk.length - 1].close,
    });
  }
  assert.ok(realDaily.length >= 5, `شرط مسبق: لازم شموع يومية مبنيّة، طلع ${realDaily.length}`);
  const ok = buildTimeSpans(c, { dailyCandles: realDaily });
  assert.ok(ok.day.spans, `شموع أكبر فعلاً لازم تنقبل: ${JSON.stringify(ok.day)}`);
  assert.equal(ok.day.definition, "provider_daily_bar");
  assert.equal(ok.day.containment.ratio, 1, "شموع مبنيّة من نفس المصدر لازم تحتوي شموعها بالكامل");
});

test("فريم أكبر من ٤ ساعات: مستويات الجلسات بترفض بدل ما تطلّع رقم بلا معنى", () => {
  const bars = pricePath([100, 140, 118, 165, 130], 10, { seed: 61 });
  const daily = bars.map((b, i) => ({ ...b, time: Date.UTC(2026, 1, 15, 22, 0, 0) / 1000 + i * DAY }));
  const spans = buildTimeSpans(daily, {});
  assert.ok(isInsufficient(spans.sessions), "على فريم يومي لازم ترفض الجلسات");
  assert.match(spans.sessions.why, /غير قابلة للقياس/);
});

/* ============================================================================
   ٨) المعنى الهيكلي للانسحاب
   ============================================================================ */

test("كل انسحاب محسوم بيحمل معنى هيكلي مكتوب مع كود قابل للقراءة برمجياً", () => {
  const c = series([100, 150, 120, 170, 132, 195, 150, 210, 165], 10, { seed: 41 });
  const r = analyzeLiquidityV2(c, { timeframe: "h4" });
  const resolved = r.sweeps.filter((s) => !isInsufficient(s.outcome));
  assert.ok(resolved.length > 0, `لازم يطلع انسحابات محسومة، طلع ${resolved.length} من ${r.sweeps.length}`);

  const VALID = new Set([
    "TAKEN_AND_CONTINUED",
    "TAKEN_AND_CONTINUED_WITH_DISPLACEMENT",
    "SWEPT_REVERSED_WITH_DISPLACEMENT_AND_EVENT",
    "SWEPT_REVERSED_WITH_DISPLACEMENT",
    "SWEPT_REVERSED_WITH_EVENT_NO_DISPLACEMENT",
    "SWEPT_REVERSED_THEN_STRUCTURE_CONTINUED",
    "SWEPT_REVERSED_NO_DISPLACEMENT",
    "SWEPT_NO_REACTION_BUT_STRUCTURE_MOVED",
    "SWEPT_NO_REACTION",
  ]);
  for (const s of resolved) {
    assert.ok(VALID.has(s.structural.code), `كود غير معروف: ${s.structural.code}`);
    assert.ok(s.structural.reason.length > 20, "المعنى الهيكلي لازم يكون جملة مفهومة مش «في انسحاب»");
    assert.equal(typeof s.structural.reversed, "boolean");
    // انعكاس هيكلي مدّعى بدون دليل ممنوع
    if (s.structural.reversed) {
      assert.ok(
        s.structural.displacement || s.structural.alignedEvent || s.structural.code === "SWEPT_REVERSED_NO_DISPLACEMENT",
        `${s.id} ادّعى انعكاس بلا دليل`
      );
    }
    // حدث بنفس اتجاه الانسحاب ما بينحسب تأكيد انعكاس
    if (s.structural.code === "SWEPT_REVERSED_THEN_STRUCTURE_CONTINUED") {
      assert.equal(s.structural.reversed, false, "ارتداد سعري تبعه كسر بنفس اتجاه الانسحاب مش انعكاس هيكلي");
      assert.ok(s.structural.opposedEvent, "لازم يكون في حدث معاكس للانعكاس هو سبب التصنيف");
    }
  }
});

test("انسحاب على آخر البيانات: النتيجة INSUFFICIENT_DATA مش «ما في انعكاس»", () => {
  const LEVEL = 110;
  const base = flat(40, 100, { seed: 9 });
  const bars = [...base, { open: 104, high: 113, low: 103, close: 105 }, { open: 105, high: 106, low: 104, close: 105 }];
  const candles = withTimes(bars);
  const r = analyzeLiquidityV2(candles, { timeframe: "h4" });

  const late = r.sweeps.filter((s) => s.endIndex >= candles.length - 1 - SWEEP_DEFAULTS.reactionBars);
  assert.ok(late.length > 0, `شرط مسبق: لازم يطلع انسحاب قريب من آخر البيانات، طلع ${late.length}`);
  for (const s of late) {
    assert.ok(isInsufficient(s.outcome), `انسحاب عند ${s.endIndex} لازم يكون غير محسوم`);
    assert.match(s.outcome.why, /لسا ما انحسمت|غير قابلة للحساب/);
    assert.equal(s.resolvedAtIndex, null);
  }
  assert.ok(LEVEL > 0);
});

/* ============================================================================
   ٩) الاتجاه من الأحداث — مش من state.trend
   ============================================================================ */

test("الاتجاه بينشتق من آخر MSS بالأحداث، مش من تسميات السوينغات", () => {
  const events = [
    { id: "a", type: "BOS", direction: "up", index: 10, time: 1, price: 100 },
    { id: "b", type: "BOS", direction: "up", index: 20, time: 2, price: 110 },
    { id: "c", type: "MSS", direction: "down", index: 30, time: 3, price: 95 },
  ];
  const t = trendFromEvents(events);
  assert.equal(t.trend, "down", "آخر MSS هابط = الاتجاه هابط فوراً");
  assert.equal(t.source, "MSS");
  assert.equal(t.eventRef.id, "c");
  assert.equal(t.conflict, false);

  // قبل الـMSS الاتجاه لسا صاعد
  assert.equal(trendFromEvents(events, 25).trend, "up");
  assert.equal(trendFromEvents(events, 25).source, "BOS");

  const none = trendFromEvents([]);
  assert.equal(none.trend, null);
  assert.ok(none.reason.length > 0, "غياب الاتجاه لازم يجي مع سببه");
});

test("الطبقة ما بتقرا state.trend حتى لما يتناقض مع الأحداث", () => {
  const c = series([100, 150, 120, 170, 132, 195, 150], 10, { seed: 33 });
  const st = analyzeStructureV2(c, { timeframe: "h4" });
  assert.ok(st.events.length > 0, `شرط مسبق: لازم يطلع أحداث هيكلية، طلع ${st.events.length}`);

  // حقن حالة متناقضة عمداً — لازم ما تأثر على شي
  const poisoned = { ...st, state: { ...st.state, state: "EXPANSION", trend: "___BOGUS___" } };
  const r = analyzeLiquidityV2(c, { timeframe: "h4", structure: poisoned });
  const expected = trendFromEvents(st.events, c.length - 1);
  assert.equal(r.trend.trend, expected.trend, "الاتجاه لازم ينشتق من الأحداث بغض النظر عن state");
  assert.notEqual(r.trend.trend, "___BOGUS___");
});

test("meta.counts.choch مش موجود — وما في جمع بيمرق عليه", () => {
  const c = series([100, 150, 120, 170, 132], 10, { seed: 33 });
  const st = analyzeStructureV2(c, { timeframe: "h4" });
  assert.equal(st.meta.counts.choch, undefined, "شرط مسبق: عدّاد CHOCH مش موجود بالهيكل");

  const r = analyzeLiquidityV2(c, { timeframe: "h4", structure: st });
  const json = JSON.stringify(r);
  assert.ok(!json.includes("NaN"), "ما لازم يطلع NaN بالمخرج");
  assert.ok(!json.toLowerCase().includes("choch"), "ما لازم يظهر CHOCH بمخرج طبقة السيولة");
});

/* ============================================================================
   ١٠) شكل المخرج
   ============================================================================ */

test("كل بركة وكل انسحاب بيحملوا الحقول المطلوبة كاملة", () => {
  const c = series([100, 150, 120, 170, 132, 195, 150, 210, 165], 10, { seed: 41 });
  const r = analyzeLiquidityV2(c, { timeframe: "h4" });
  assert.ok(r.pools.length > 0 && r.sweeps.length > 0, `لازم بِرك وانسحابات، طلع ${r.pools.length}/${r.sweeps.length}`);

  for (const p of r.pools) {
    for (const k of ["id", "type", "side", "direction", "price", "time", "timeframe", "strength", "source", "reason", "status"]) {
      assert.ok(p[k] !== undefined, `الحقل ${k} ناقص ببركة ${p.type}`);
    }
    assert.equal(p.timeframe, "h4");
    assert.ok(["buy", "sell"].includes(p.side));
    assert.equal(p.direction, p.side === "buy" ? "up" : "down");
    assert.ok(["Weak", "Normal", "Strong", "Extreme"].includes(p.strength));
    assert.ok(p.reason.length > 10, "السبب لازم يكون جملة مفهومة");
    assert.ok(
      p.confidence === null || (p.confidence >= 0 && p.confidence <= 1),
      `ثقة خارج النطاق ببركة ${p.id}: ${p.confidence}`
    );
    assert.ok(Number.isFinite(p.availableFromIndex), "بوابة السببية لازم تكون رقم");
  }

  for (const s of r.sweeps) {
    for (const k of ["id", "type", "side", "direction", "price", "time", "timeframe", "strength", "pool", "reason", "outcome"]) {
      assert.ok(s[k] !== undefined, `الحقل ${k} ناقص بانسحاب`);
    }
    assert.equal(s.type, "LiquiditySweep");
    assert.ok(s.touchCandles >= 1, "كل حلقة لازم تحمل عدد شموعها اللامسة");
    assert.ok(s.startIndex <= s.endIndex);
    assert.ok(
      s.confidence === null || (s.confidence >= 0 && s.confidence <= 1),
      `ثقة انسحاب خارج النطاق: ${s.confidence}`
    );
  }
});

test("الثقة بتطلع null لما ما يكون في دليل — مش صفر ولا تقدير", () => {
  /* أول سوينغ خارجي ما إله ساق داخلة مقيسة، فما في دليل لحساب ثقة. */
  const c = series([100, 150, 120, 170, 132, 195, 150], 10, { seed: 33 });
  const r = analyzeLiquidityV2(c, { timeframe: "h4" });
  const anchors = r.pools.filter((p) => p.source?.isAnchor === true);
  assert.ok(anchors.length > 0, `شرط مسبق: لازم يكون في بركة من سوينغ مرساة، طلع ${anchors.length}`);
  for (const p of anchors) {
    assert.equal(p.confidence, null, "بركة بلا ساق مقيسة لازم ثقتها null");
    assert.equal(p.measure.legAtr, null);
  }
});

/* ============================================================================
   ١١) ثبات وتكرارية
   ============================================================================ */

test("نفس المدخل بيعطي نفس المخرج بالضبط", () => {
  const c = series([100, 145, 118, 160, 132, 180, 150], 10, { seed: 77 });
  const a = JSON.stringify(analyzeLiquidityV2(c, { timeframe: "h4" }));
  const b = JSON.stringify(analyzeLiquidityV2(c, { timeframe: "h4" }));
  assert.equal(a, b);
  assert.ok(a.length > 5000, `المخرج لازم يكون فيه محتوى فعلي، طوله ${a.length}`);
});

test("ضرب كل الأسعار بمعامل ثابت ما بيغيّر البنية — العتبات كلها بالـATR", () => {
  const c = series([100, 145, 118, 160, 132, 180, 150], 10, { seed: 77 });
  const scaled = c.map((k) => ({ ...k, open: k.open * 37, high: k.high * 37, low: k.low * 37, close: k.close * 37 }));

  const a = analyzeLiquidityV2(c, { timeframe: "h4" });
  const b = analyzeLiquidityV2(scaled, { timeframe: "h4" });
  assert.ok(a.pools.length > 0, `شرط مسبق: لازم يطلع بِرك، طلع ${a.pools.length}`);

  assert.deepEqual(
    a.pools.map((p) => `${p.type}:${p.side}:${p.index}:${p.status}`),
    b.pools.map((p) => `${p.type}:${p.side}:${p.index}:${p.status}`),
    "أي عتبة بمبلغ سعري ثابت بتكسر هالاختبار"
  );
  assert.deepEqual(
    a.sweeps.map((s) => `${s.startIndex}:${s.endIndex}:${s.touchCandles}`),
    b.sweeps.map((s) => `${s.startIndex}:${s.endIndex}:${s.touchCandles}`)
  );
});
