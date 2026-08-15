/* ============================================================================
   اختبارات الهارنس نفسه — `node --test lib/qais/structure/verify/verify.test.js`

   نطاق الملف: **سلامة أدوات القياس**، مش دقة المحرك.
   أداة قياس معطّلة بتطلّع أرقام دقة مقنعة وغلط، فلازم تنفحص لحالها قبل ما
   نصدّق أي رقم بتطلّعه على بيانات حقيقية.
   ============================================================================ */

import test from "node:test";
import assert from "node:assert/strict";

import { inferPrecision, resolveTolerance, priceDeltaInTicks, TOLERANCE_MODES } from "./precision.js";
import { replayIncremental } from "./replay.js";
import { matchTrade, describe, MATCH_STATUS, tfSeconds } from "./match.js";
import { verifyStructure } from "./index.js";
import { renderReport } from "./render.js";

/* -------------------- بناء شموع على شبكة سعرية معلومة -------------------- */
function makeRng(seed = 5) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** شموع أسعارها كلها مضاعفات tick بالضبط — لفحص استنتاج الشبكة. */
function gridCandles(n, start, tick, seed = 5, tfSecs = 14400) {
  const rng = makeRng(seed);
  const snap = (v) => Math.round(v / tick) * tick;
  const out = [];
  let px = start;
  let t = 1700000000;
  for (let i = 0; i < n; i++) {
    const drift = (rng() - 0.45) * tick * 12;
    const o = snap(px);
    const c = snap(px + drift);
    const hi = snap(Math.max(o, c) + rng() * tick * 6);
    const lo = snap(Math.min(o, c) - rng() * tick * 6);
    t += tfSecs;
    out.push({ time: t, open: o, high: hi, low: lo, close: c, volume: 1000 + Math.floor(rng() * 500) });
    px = c;
  }
  return out;
}

/* ============================================================================
   ١) استنتاج شبكة السوق — مش عدد الخانات العشرية
   ============================================================================ */
test("شبكة 0.25 بتنستنتج 0.25 مش 0.01 (الخانات العشرية ٢ بالحالتين)", () => {
  const c = gridCandles(400, 29834.75, 0.25);
  const p = inferPrecision(c, { instrument: "NAS100" });

  assert.equal(p.tickSize, 0.25, `طلعت ${p.tickSize}`);
  assert.equal(p.precision, 2, "دقة العرض خانتين — وهاد بالضبط اللي ما لازم يتخلط مع التِك");
  assert.equal(p.tickSizeSource, "inferred_from_market_data");
  assert.notEqual(p.tickSizeConfidence, "low");
});

test("شبكة 0.01 بتنستنتج 0.01", () => {
  const c = gridCandles(400, 1.2345, 0.01, 11);
  const p = inferPrecision(c, { instrument: "EURUSD" });
  assert.equal(p.tickSize, 0.01);
});

test("شبكة 0.00001 (فوركس ٥ خانات) بتنستنتج صح", () => {
  const c = gridCandles(600, 1.08321, 0.00001, 21);
  const p = inferPrecision(c, { instrument: "EURUSD" });
  assert.equal(p.tickSize, 0.00001);
  assert.equal(p.precision, 5);
});

test("أسعار بلا شبكة متّسقة: ما بينخترع تِك", () => {
  const rng = makeRng(3);
  const c = [];
  let t = 1700000000;
  for (let i = 0; i < 400; i++) {
    const o = 100 + rng() * 10;
    const cl = 100 + rng() * 10;
    t += 14400;
    c.push({ time: t, open: o, high: Math.max(o, cl) + rng(), low: Math.min(o, cl) - rng(), close: cl });
  }
  const p = inferPrecision(c);
  assert.ok(
    p.tickSize === null || p.tickSizeConfidence === "low" || p.tickSizeSource !== "inferred_from_market_data",
    `ادّعى تِك ${p.tickSize} من ثقة ${p.tickSizeConfidence} على أسعار عشوائية`
  );
});

test("عيّنة صغيرة أو تنوّع قليل: بينصرّح بالسبب بدل ما يخمّن", () => {
  const tiny = gridCandles(10, 100, 0.25);
  const p1 = inferPrecision(tiny);
  assert.equal(p1.tickSize, null);
  assert.equal(p1.tickSizeSource, "insufficient_sample");

  const flat = Array.from({ length: 300 }, (_, i) => ({
    time: 1700000000 + i * 14400,
    open: 100,
    high: 100.25,
    low: 99.75,
    close: 100,
  }));
  const p2 = inferPrecision(flat);
  assert.equal(p2.tickSize, null);
  assert.equal(p2.tickSizeSource, "insufficient_price_variation");
});

/* ============================================================================
   ٢) التسامح: معلَن دايماً، وبيرجع لـATR لما التِك مجهول
   ============================================================================ */
test("مع تِك موثوق: التسامح مضاعف تِك", () => {
  const p = inferPrecision(gridCandles(400, 29834.75, 0.25));
  const tol = resolveTolerance(p, 50);
  assert.equal(tol.mode, TOLERANCE_MODES.TICK);
  assert.equal(tol.value, 0.25 * 4);
  assert.equal(tol.trustworthy, true);
});

test("بدون تِك: التسامح بيصير نسبة من ATR وبينكتب صراحةً", () => {
  const tol = resolveTolerance({ tickSize: null, tickSizeConfidence: "low" }, 40);
  assert.equal(tol.mode, TOLERANCE_MODES.ATR);
  assert.equal(tol.value, 4);
  assert.match(tol.description, /التِك غير معروف/);
});

test("بدون تِك ولا ATR: ما بينحسب فرق سعري إطلاقاً", () => {
  const tol = resolveTolerance({ tickSize: null, tickSizeConfidence: "low" }, null);
  assert.equal(tol.trustworthy, false);
  assert.equal(tol.value, null);
  assert.equal(priceDeltaInTicks(5, { tickSize: null, tickSizeConfidence: "low" }), null);
});

/* ============================================================================
   ٣) التشغيل شمعة-بشمعة: سببية وثبات
   ============================================================================ */
test("ما في خرق سببية ولا أحداث غير مستقرة", () => {
  const c = gridCandles(400, 20000, 0.25, 77);
  const r = replayIncremental(c, { timeframe: "h4", maxCandles: 300 });

  assert.equal(r.ok, true);
  assert.equal(r.latencies.filter((l) => l.latencyCandles < 0).length, 0, "تأخير سالب = نظر للمستقبل");
  assert.equal(r.disappeared.length, 0, `${r.disappeared.length} حدث ظهر ثم اختفى`);
});

test("BOS/CHOCH بينكتشفوا بلحظة الكسر (تأخير صفر)", () => {
  const c = gridCandles(400, 20000, 0.25, 91);
  const r = replayIncremental(c, { timeframe: "h4", maxCandles: 300 });
  for (const l of r.latencies) {
    if (l.type === "BOS" || l.type === "CHOCH") {
      assert.equal(l.latencyCandles, 0, `${l.type} تأخيره ${l.latencyCandles} شمعة`);
    }
  }
});

/* ============================================================================
   ٤) المطابقة: كل حالة بترجع سبب واضح
   ============================================================================ */
test("tfSeconds بتغطي الفريمات المستعملة وبترجع null للمجهول", () => {
  assert.equal(tfSeconds("h4"), 14400);
  assert.equal(tfSeconds("daily"), 86400);
  assert.equal(tfSeconds("M15"), 900);
  assert.equal(tfSeconds("weird"), null);
});

test("بيانات صفقة ناقصة بترجع insufficient_data مع السبب", () => {
  const candles = gridCandles(100, 100, 0.25);
  const cases = [
    [{ direction: null, timeframe: "h4", created_at: "2026-01-01" }, /اتجاه/],
    [{ direction: "up", timeframe: "h4", created_at: "لا شي" }, /وقت مرجعي/],
    [{ direction: "up", timeframe: "nope", created_at: "2026-01-01" }, /فريم غير معروف/],
  ];
  for (const [trade, re] of cases) {
    const m = matchTrade(trade, [], candles, null);
    assert.equal(m.status, MATCH_STATUS.INSUFFICIENT_DATA);
    assert.match(m.reason, re);
  }
});

test("وقت الصفقة خارج نطاق الشموع = insufficient_data مش unmatched", () => {
  const candles = gridCandles(100, 100, 0.25);
  const m = matchTrade(
    { direction: "up", timeframe: "h4", created_at: "1990-01-01T00:00:00Z", entry: 100 },
    [],
    candles,
    null
  );
  assert.equal(m.status, MATCH_STATUS.INSUFFICIENT_DATA);
  assert.match(m.reason, /خارج نطاق الشموع/);
});

test("مطابقة ناجحة بتحسب الفارق الزمني والسعري بالتِك", () => {
  const candles = gridCandles(200, 29800, 0.25);
  const refTime = candles[100].time;
  const precision = inferPrecision(candles);

  const events = [
    { id: "e1", type: "CHOCH", direction: "up", time: refTime + 14400 * 3, index: 103, price: 29812.5, strength: "Strong", confidence: 0.8, fakeBreak: false, reason: "x" },
  ];
  const m = matchTrade(
    { id: 1, direction: "up", timeframe: "h4", created_at: new Date(refTime * 1000).toISOString(), entry: 29800 },
    events,
    candles,
    precision,
    { windowCandles: 20 }
  );

  assert.equal(m.status, MATCH_STATUS.MATCHED);
  assert.equal(m.timing.diffCandles, 3);
  assert.equal(m.timing.diffMinutes, 720);
  assert.equal(m.timing.engineIsLate, true);
  assert.equal(m.price.absoluteDiff, 12.5);
  assert.equal(m.price.diffInTicks, 50); // 12.5 / 0.25
});

test("حدث بالنافذة بس بعكس الاتجاه = direction_mismatch مش matched", () => {
  const candles = gridCandles(200, 29800, 0.25);
  const refTime = candles[100].time;
  const events = [{ id: "e1", type: "BOS", direction: "down", time: refTime, index: 100, price: 29800 }];
  const m = matchTrade(
    { direction: "up", timeframe: "h4", created_at: new Date(refTime * 1000).toISOString(), entry: 29800 },
    events,
    candles,
    null
  );
  assert.equal(m.status, MATCH_STATUS.DIRECTION_MISMATCH);
});

test("ما في حدث بالنافذة = unmatched مع ذكر عرض النافذة", () => {
  const candles = gridCandles(200, 29800, 0.25);
  const refTime = candles[100].time;
  const events = [{ id: "e1", type: "BOS", direction: "up", time: refTime + 14400 * 500, index: 600, price: 30000 }];
  const m = matchTrade(
    { direction: "up", timeframe: "h4", created_at: new Date(refTime * 1000).toISOString(), entry: 29800 },
    events,
    candles,
    null,
    { windowCandles: 20 }
  );
  assert.equal(m.status, MATCH_STATUS.UNMATCHED);
  assert.match(m.reason, /±20 شمعة/);
});

test("describe بترجع أصفار نظيفة بدون عيّنة", () => {
  assert.deepEqual(describe([]), { n: 0, mean: null, median: null, min: null, max: null });
  assert.equal(describe([1, 2, 3, 4]).median, 2.5);
});

/* ============================================================================
   ٥) التقرير كامل: بيشتغل وبيصرّح بالمقاييس غير القابلة للقياس
   ============================================================================ */
test("التقرير بيتبنى وبينعرض بدون أخطاء، وبدون صفقات بيصرّح INSUFFICIENT_DATA", () => {
  const report = verifyStructure({
    symbol: "NAS100",
    candlesByTF: { h4: gridCandles(400, 29800, 0.25, 31) },
    trades: [],
    replayOptions: { maxCandles: 200 },
  });

  assert.equal(report.symbol, "NAS100");
  assert.equal(report.perTF.h4.ok, true);
  assert.equal(report.perTF.h4.instrument.tickSize, 0.25);

  // بدون صفقات: ما في معدل توافق — ولا رقم مخترع
  assert.equal(report.overall.agreementRate, null);
  assert.equal(report.overall.falsePositives.value, "INSUFFICIENT_DATA");
  assert.equal(report.timing.value, "INSUFFICIENT_DATA");

  // مقاييس ما إلها مرجع لازم تكون معلَنة
  assert.equal(report.perTF.h4.swings.accuracy.value, "INSUFFICIENT_DATA");
  assert.equal(report.perTF.h4.displacement.accuracy.value, "INSUFFICIENT_DATA");

  const text = renderReport(report);
  assert.match(text, /STRUCTURE ENGINE VALIDATION REPORT/);
  assert.match(text, /tickSizeSource\s*:\s*inferred_from_market_data/);
  assert.match(text, /INSUFFICIENT_DATA/);
  assert.match(text, /KNOWN LIMITATIONS/);
});

test("قيد القمم المتساوية بينقاس ويُدرج بالقيود دايماً", () => {
  const report = verifyStructure({
    symbol: "NAS100",
    candlesByTF: { h4: gridCandles(400, 29800, 0.25, 44) },
    trades: [],
    replayOptions: { maxCandles: 200 },
  });
  const lim = report.limitations.find((l) => l.id === "equal-highs-lows");
  assert.ok(lim, "قيد القمم المتساوية لازم يكون مُدرج");
  assert.ok(Number.isFinite(lim.measured.h4), "لازم يكون رقم مقيس مش وصف");
  assert.ok(report.limitations.some((l) => l.id === "reference-not-ground-truth"));
  assert.ok(report.limitations.some((l) => l.id === "false-positives-unmeasurable"));
});
