import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeCandles } from "./candle-cache.js";

const DAY = 86400;
const H = 3600;

/** شمعة يومية بطابع «منتصف ليل السوق» — بينزاح ساعة مع التوقيت الصيفي. */
function daily(dayIndex, hourOffset, close = 1) {
  return { time: dayIndex * DAY + hourOffset * H, open: close, high: close, low: close, close };
}

/* ══════════════ 🔴 العطل المقيس على الإنتاج ══════════════ */

test("🔴 نفس اليوم بساعتين مختلفتين = شمعة وحدة مش اتنتين", () => {
  /* الشمعة اليومية بتنختم بمنتصف ليل السوق لا UTC، فطابعها بينزاح ساعة مع
     تبديل التوقيت الصيفي. المحفوظ انجلب بالشتاء (٠٥:٠٠) والطازج بالصيف
     (٠٤:٠٠) — ونفس اليوم بيصير شمعتين.

     مقيس على الإنتاج (٢٠٢٦-٠٨-٢٧) على NAS100 يومي:
         bars 3974 · days 2486 · barsPerDay 1.6 · dupes 0 */
  const cached = [daily(100, 5, 10), daily(101, 5, 11), daily(102, 5, 12)];
  const fresh = [daily(101, 4, 111), daily(102, 4, 112), daily(103, 4, 113)];

  const out = mergeCandles(cached, fresh, DAY);
  const days = new Set(out.map((c) => Math.floor(c.time / DAY)));
  assert.equal(out.length, days.size, `شمعة لكل يوم — طلع ${out.length} شمعة بـ${days.size} يوم`);
  assert.equal(out.length, 4, "١٠٠ · ١٠١ · ١٠٢ · ١٠٣");
});

test("الطازج بيغلب عند تعارض نفس اليوم", () => {
  const out = mergeCandles([daily(100, 5, 10)], [daily(100, 4, 99)], DAY);
  assert.equal(out.length, 1);
  assert.equal(out[0].close, 99, "قيمة الطازج");
  assert.equal(out[0].time, 100 * DAY + 4 * H, "وطابع الطازج كمان — وإلا نصف السلسلة بتوقيت قديم");
});

test("⚠️ بلا طول الفريم بيرجع العطل — إثبات إنّ المعامل هو الفرق", () => {
  /* لو ما انمرّر `intervalSeconds`، الدمج بيرجع للطابع الخام. هالاختبار
     بيثبت إنّ الإصلاح بالمعامل مش بالصدفة. */
  const cached = [daily(100, 5, 10), daily(101, 5, 11)];
  const fresh = [daily(100, 4, 99), daily(101, 4, 98)];
  const out = mergeCandles(cached, fresh); // بلا intervalSeconds
  assert.equal(out.length, 4, "بلا المعامل بيصير أربع شموع ليومين");
});

/* ══════════════ الفريمات اللحظية ما بتتأثّر ══════════════ */

test("الفريم اللحظي بيضل يدمج بالطابع الخام", () => {
  /* ١٥ دقيقة: ما في انزياح توقيت صيفي على مستوى الشمعة، وشموع نفس اليوم
     **لازم** تضل منفصلة. */
  const M15 = 900;
  const base = 100 * DAY;
  const cached = [
    { time: base, open: 1, high: 1, low: 1, close: 1 },
    { time: base + M15, open: 2, high: 2, low: 2, close: 2 },
  ];
  const fresh = [
    { time: base + M15 * 2, open: 3, high: 3, low: 3, close: 3 },
    { time: base + M15 * 3, open: 4, high: 4, low: 4, close: 4 },
  ];
  const out = mergeCandles(cached, fresh, M15);
  assert.equal(out.length, 4, "أربع شموع بنفس اليوم — ما بتنلمّ");
});

test("تساوي الطابع تماماً: الطازج بيغلب بأي فريم", () => {
  const M15 = 900;
  const t = 100 * DAY;
  const out = mergeCandles(
    [{ time: t, open: 1, high: 1, low: 1, close: 1 }],
    [{ time: t, open: 9, high: 9, low: 9, close: 9 }],
    M15
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].close, 9);
});

/* ══════════════ حالات حدّية ══════════════ */

test("مصفوفة فاضية بترجّع التانية كما هي", () => {
  const c = [daily(1, 4)];
  assert.deepEqual(mergeCandles([], c, DAY), c);
  assert.deepEqual(mergeCandles(c, [], DAY), c);
  assert.deepEqual(mergeCandles([], [], DAY), []);
});

test("المخرج مرتّب زمنياً دايماً", () => {
  const cached = [daily(105, 5), daily(100, 5), daily(103, 5)];
  const fresh = [daily(101, 4), daily(107, 4)];
  const out = mergeCandles(cached, fresh, DAY);
  for (let i = 1; i < out.length; i++) {
    assert.ok(out[i].time > out[i - 1].time, `مش مرتّب عند ${i}`);
  }
});
