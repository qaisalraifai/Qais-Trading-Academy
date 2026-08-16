/* ============================================================================
   اختبارات حارس اتساق الفريمات
   `node --test lib/market-data/timeframe-consistency.test.js`

   الحالة المرجعية المستخدمة تحت مأخوذة من قياس حقيقي: الذهب ٢٠٢٦-٠٨-١٣،
   الشمعة اليومية H 4445.00 / L 4350.00 بينما تجميع شموعها H4 بيعطي
   H 4509.10 / L 4400.00.
   ============================================================================ */

import test from "node:test";
import assert from "node:assert/strict";

import { checkTimeframeConsistency, comparePair, tfSeconds } from "./timeframe-consistency.js";

const H4 = 14400;
const DAY = 86400;
const T0 = Date.UTC(2026, 0, 5) / 1000; // اثنين

/** يوم متّسق: ٦ شموع H4 وشمعة يومية بتحتويهم بالضبط. */
function consistentDay(dayIndex, base) {
  const start = T0 + dayIndex * DAY;
  const h4 = [];
  let hi = -Infinity;
  let lo = Infinity;
  for (let i = 0; i < 6; i++) {
    const o = base + i * 3;
    const c = o + 2;
    const high = c + 4;
    const low = o - 4;
    hi = Math.max(hi, high);
    lo = Math.min(lo, low);
    h4.push({ time: start + i * H4, open: o, high, low, close: c });
  }
  return { h4, d1: { time: start, open: h4[0].open, high: hi, low: lo, close: h4[5].close } };
}

function build(days, corrupt = null) {
  const h4 = [];
  const d1 = [];
  for (let d = 0; d < days; d++) {
    const { h4: bars, d1: day } = consistentDay(d, 4000 + d * 5);
    h4.push(...bars);
    d1.push(corrupt ? corrupt(day, d) : day);
  }
  return { h4, d1 };
}

/* ============================================================================
   ١) بيانات متّسقة
   ============================================================================ */
test("سلسلتان متّسقتان: ما في تحذير", () => {
  const { h4, d1 } = build(40);
  const r = checkTimeframeConsistency({ daily: d1, h4 });

  assert.equal(r.ok, true);
  assert.equal(r.severity, "none");
  assert.equal(r.warnings.length, 0);
  assert.equal(r.checks["daily/h4"].agreementRate, 1);
});

/* ============================================================================
   ٢) الحالة الحقيقية: الشمعة اليومية ما بتحتوي شموعها
   ============================================================================ */
test("الشمعة الكبيرة ما بتحتوي الصغيرة = تناقض حرج", () => {
  // نفس نسبة الخلل المقيسة على الذهب: القمة اليومية أقل من قمة الـH4
  const { h4, d1 } = build(40, (day) => ({ ...day, high: day.high - 60, low: day.low + 50 }));
  const r = checkTimeframeConsistency({ daily: d1, h4 });

  assert.equal(r.ok, false);
  assert.equal(r.severity, "critical");
  assert.ok(r.checks["daily/h4"].agreementRate < 0.1);
  assert.match(r.warnings[0], /من مصدرين\/عقدين مختلفين/);

  const s = r.checks["daily/h4"].samples[0];
  assert.ok(s.highOverflow > 0, "لازم يبان تجاوز القمة");
  assert.ok(s.lowOverflow > 0, "لازم يبان تجاوز القاع");
});

test("الحالة الحقيقية للذهب بتنكشف بأرقامها", () => {
  const start = T0;
  const h4 = [];
  for (let i = 0; i < 6; i++) {
    h4.push({ time: start + i * H4, open: 4450, high: i === 2 ? 4509.1 : 4470, low: i === 4 ? 4400 : 4430, close: 4460 });
  }
  const d1 = [{ time: start, open: 4450, high: 4445.0, low: 4350.0, close: 4363.6 }];

  const res = comparePair(d1, h4, DAY);
  assert.equal(res.compared, 1);
  assert.equal(res.agreeing, 0);
  assert.ok(res.samples[0].highOverflow > 60, `تجاوز القمة ${res.samples[0].highOverflow}`);
});

/* ============================================================================
   ٣) فرق بسيط ضمن التسامح ما بينحسب تناقض
   ============================================================================ */
test("فرق ضئيل جوّا التسامح بيعدّي", () => {
  const { h4, d1 } = build(40, (day) => ({ ...day, high: day.high * 1.0005 }));
  const r = checkTimeframeConsistency({ daily: d1, h4 }, { tolerance: 0.002 });
  assert.equal(r.ok, true, JSON.stringify(r.warnings));
});

test("الاحتواء غير متماثل: الكبيرة أوسع = سليم، أضيق = تناقض", () => {
  const wider = build(30, (day) => ({ ...day, high: day.high + 100, low: day.low - 100 }));
  assert.equal(checkTimeframeConsistency({ daily: wider.d1, h4: wider.h4 }).ok, true, "أوسع = احتواء سليم");

  const narrower = build(30, (day) => ({ ...day, high: day.high - 100 }));
  assert.equal(checkTimeframeConsistency({ daily: narrower.d1, h4: narrower.h4 }).ok, false, "أضيق = تناقض");
});

/* ============================================================================
   ٤) حالات لا تُقاس — بتنصرّح ما بتنخمّن
   ============================================================================ */
test("فريم واحد = ما في مقارنة، بدون ادعاء سلامة زائف", () => {
  const { h4 } = build(10);
  const r = checkTimeframeConsistency({ h4 });
  assert.equal(r.ok, true);
  assert.equal(r.severity, "none");
  assert.match(r.note, /ما في مقارنة ممكنة/);
});

test("تغطية ناقصة بالفريم الصغير بتنستثنى مش بتنحسب فشل", () => {
  const { h4, d1 } = build(20);
  // بنشيل كل شموع H4 ما عدا أول يوم — باقي الأيام ما إلها تغطية
  const sparse = h4.filter((c) => c.time < T0 + DAY);
  const r = checkTimeframeConsistency({ daily: d1, h4: sparse });
  assert.equal(r.checks["daily/h4"].compared, 1, "يوم واحد بس مغطّى");
  assert.equal(r.ok, true);
});

test("سلسلة فاضية أو مدخل غلط = INSUFFICIENT_DATA مش انهيار", () => {
  assert.equal(comparePair([], [{ time: 1, high: 1, low: 1 }], DAY).value, "INSUFFICIENT_DATA");
  assert.equal(comparePair(null, null, DAY).value, "INSUFFICIENT_DATA");

  const r = checkTimeframeConsistency({ daily: [], h4: [] });
  assert.equal(r.ok, true);
  assert.equal(r.severity, "none");
});

test("فريمات غير متضاعفة ما بتنقارن", () => {
  const { h4 } = build(20);
  // weekly/h4: 604800 % 14400 === 0 فبتنقارن؛ بس monthly/weekly مش مضاعف تام
  const r = checkTimeframeConsistency({ monthly: h4, weekly: h4 });
  assert.equal(Object.keys(r.checks).length, 0, "2592000 % 604800 ≠ 0 فما بتنقارن");
});

test("فريم مجهول بينتجاهل بدون كسر", () => {
  const { h4, d1 } = build(20);
  const r = checkTimeframeConsistency({ daily: d1, h4, tick: [{ time: 1, high: 1, low: 1 }] });
  assert.equal(r.ok, true);
  assert.ok(r.checks["daily/h4"]);
});

test("tfSeconds بتغطي فريمات المشروع", () => {
  assert.equal(tfSeconds("daily"), 86400);
  assert.equal(tfSeconds("h4"), 14400);
  assert.equal(tfSeconds("M15"), 900);
  assert.equal(tfSeconds("nope"), null);
});

/* ============================================================================
   ٥) الشدة بتفرّق بين ضجيج وتناقض بنيوي
   ============================================================================ */
test("خلل جزئي = warning، خلل شامل = critical", () => {
  const partial = build(40, (day, i) => (i % 4 === 0 ? { ...day, high: day.high - 80 } : day));
  const rp = checkTimeframeConsistency({ daily: partial.d1, h4: partial.h4 });
  assert.equal(rp.severity, "warning", `النسبة ${rp.worstAgreementRate}`);

  const total = build(40, (day) => ({ ...day, high: day.high - 80 }));
  const rt = checkTimeframeConsistency({ daily: total.d1, h4: total.h4 });
  assert.equal(rt.severity, "critical");
});
