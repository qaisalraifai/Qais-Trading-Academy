import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shouldApplyRange,
  createSyncBreaker,
  medianInterval,
  timeAtLogical,
  logicalAtTime,
  mapLogicalRange,
} from "./pane-sync.js";

const DAY = 86400;
const TOL = DAY / 2;

test("مدى مطابق تماماً → ما بينطبّق", () => {
  const r = { from: 1000, to: 2000 };
  assert.equal(shouldApplyRange(r, { ...r }, TOL), false);
});

test("مدى مختلف فعلياً → بينطبّق", () => {
  assert.equal(shouldApplyRange({ from: 0, to: 100 * DAY }, { from: 50 * DAY, to: 150 * DAY }, TOL), true);
});

test("🔴 فرق أصغر من التسامح → ما بينطبّق (هون بتنكسر الحلقة)", () => {
  /* ضبط مدى زمني ما بيرجّع نفس القيمة بالضبط — بينقرّب لحدود الشموع. بلا
     تسامح، كل دورة بتشوف «فرق» وبتعيد الضبط → الانفلات. */
  const cur = { from: 1_000_000, to: 1_000_000 + 100 * DAY };
  const near = { from: cur.from + DAY / 4, to: cur.to - DAY / 4 };
  assert.equal(shouldApplyRange(cur, near, TOL), false);
});

test("بلا مدى حالي → بينطبّق (أول محاذاة)", () => {
  assert.equal(shouldApplyRange(null, { from: 0, to: DAY }, TOL), true);
});

test("مدى غير صالح بينترفض بلا انهيار", () => {
  const cur = { from: 0, to: DAY };
  assert.equal(shouldApplyRange(cur, null, TOL), false);
  assert.equal(shouldApplyRange(cur, { from: 5, to: 5 }, TOL), false, "to = from");
  assert.equal(shouldApplyRange(cur, { from: 10, to: 5 }, TOL), false, "to < from");
  assert.equal(shouldApplyRange(cur, { from: NaN, to: 5 }, TOL), false);
});

/* ══════════════ 🔴 محاكاة الحلقة اللي كسرت الإنتاج ══════════════ */

test("🔴 الحلقة بتنتهي — نفس السيناريو اللي عمل تكبيراً متسارعاً", () => {
  /* نمذجة السلوك الفعلي: كل ضبط بيرجّع مدى مزحزحاً شوي (تقريب لحدود
     الشموع). بلا شرط التطابق، الطرفان بيضلوا يتبادلوا الضبط بلا نهاية
     والمدى بيضيق كل دورة — وهاد اللي شافه المستخدم.

     مع الشرط: لازم توقف بعد عدد صغير من الدورات. */
  const DRIFT = DAY / 5; // انزياح تقريب أصغر من التسامح
  let a = { from: 0, to: 200 * DAY };
  let b = null;
  let applies = 0;

  for (let i = 0; i < 500; i++) {
    // أ → ب
    if (shouldApplyRange(b, a, TOL)) {
      b = { from: a.from + DRIFT, to: a.to - DRIFT };
      applies++;
    } else break;
    // ب → أ
    if (shouldApplyRange(a, b, TOL)) {
      a = { from: b.from + DRIFT, to: b.to - DRIFT };
      applies++;
    } else break;
  }

  assert.ok(applies < 10, `الحلقة ما وقفت — ${applies} تطبيق`);
  assert.ok(a.to - a.from > 150 * DAY, `المدى ضاق بشكل خطر: ${(a.to - a.from) / DAY} يوم`);
});

test("⚠️ بلا شرط التطابق الحلقة ما بتنتهي — إثبات إنّ الشرط هو اللي بيكسرها", () => {
  const DRIFT = DAY / 5;
  let a = { from: 0, to: 200 * DAY };
  for (let i = 0; i < 200; i++) {
    a = { from: a.from + DRIFT, to: a.to - DRIFT }; // تطبيق أعمى، بلا فحص
  }
  assert.ok(a.to - a.from <= 120 * DAY, "المدى لازم ينهار بلا الشرط");
});

/* ══════════════ قاطع الدورة — الحارس الأخير ══════════════ */

test("القاطع بيسمح بالمعدّل الطبيعي", () => {
  const br = createSyncBreaker({ maxPerWindow: 12, windowMs: 300 });
  let t = 1000;
  for (let i = 0; i < 20; i++) { assert.equal(br.allow(t), true, `عند ${t}`); t += 400; }
  assert.equal(br.isTripped, false);
});

test("🔴 القاطع بيقطع الانفلات", () => {
  const br = createSyncBreaker({ maxPerWindow: 12, windowMs: 300 });
  let allowed = 0;
  for (let i = 0; i < 200; i++) if (br.allow(1000 + i)) allowed++;
  assert.ok(allowed <= 12, `سمح بـ${allowed} — القاطع مش شغّال`);
  assert.equal(br.isTripped, true);
});

test("القاطع بيتعافى بعد هدوء", () => {
  const br = createSyncBreaker({ maxPerWindow: 12, windowMs: 300 });
  for (let i = 0; i < 100; i++) br.allow(1000 + i);
  assert.equal(br.isTripped, true);
  assert.equal(br.allow(1000 + 2000), true, "لازم يتعافى بعد هدوء");
  assert.equal(br.isTripped, false);
});

/* ══════════════ ترجمة الفهرس عبر الوقت ══════════════ */

/** أيام تداول: خمسة أيام وعطلة نهاية أسبوع. `skip` = أرقام أيام مفقودة (عطل). */
function tradingDays(count, startDay = 0, skip = new Set()) {
  const times = [];
  let d = startDay;
  while (times.length < count) {
    const dow = d % 7;
    if (dow < 5 && !skip.has(d)) times.push(d * DAY);
    d++;
  }
  return times;
}

test("المسافة الوسيطة بتتجاهل عطلة نهاية الأسبوع", () => {
  const t = tradingDays(40);
  assert.equal(medianInterval(t), DAY, "لازم يوم واحد، مش متوسط منفوخ بالعطل");
  assert.equal(medianInterval([5]), 0, "شمعة وحدة → ما في مسافة");
  assert.equal(medianInterval([]), 0);
});

test("الوقت والفهرس عكس بعض بالضبط على نفس السلسلة", () => {
  const t = tradingDays(60);
  const I = medianInterval(t);
  for (const L of [0, 1, 7.5, 23.25, 59, -4, 64.5]) {
    const back = logicalAtTime(t, timeAtLogical(t, L, I), I);
    assert.ok(Math.abs(back - L) < 1e-9, `L=${L} رجع ${back}`);
  }
});

test("فهرس شمعة موجودة بيرجّع رقمها بالضبط", () => {
  const t = tradingDays(30);
  const I = medianInterval(t);
  for (const i of [0, 1, 14, 29]) assert.ok(Math.abs(logicalAtTime(t, t[i], I) - i) < 1e-9);
});

/* ══════════════ 🔴 العطل المبلَّغ عنه ══════════════ */

test("🔴 منطقة الإزاحة بتنترجم — الخلل اللي بان بالصورة", () => {
  /* الأساسي عنده rightOffset: 6 فمداه المنطقي بيمتدّ ٦ شموع بعد آخر وحدة.
     `getVisibleRange()` كانت تقصّ هالمنطقة (بترجّع لَحدّ آخر شمعة فقط)، فلوحة
     المقارنة كانت تمدّد نفس الفترة على كامل عرضها → مقياسان مختلفان.

     بالترجمة عبر الوقت: آخر فهرس + ٦ بالأساسي لازم يصير آخر فهرس + ٦ تقريباً
     بالمقارنة — يعني الإزاحة بتنتقل بدل ما تنقصّ. */
  const main = tradingDays(100);
  const cmp = tradingDays(100);
  const lastMain = main.length - 1;

  const out = mapLogicalRange(main, cmp, { from: lastMain - 50, to: lastMain + 6 });
  assert.ok(out, "لازم يترجم");
  assert.ok(
    Math.abs(out.to - (cmp.length - 1 + 6)) < 1e-6,
    `الإزاحة انقصّت: to=${out.to} والمتوقّع ${cmp.length - 1 + 6}`
  );
});

test("🔴 أعماق مختلفة — نفس اللحظة بتنزل بنفس الموضع", () => {
  /* الحالة الفعلية: ناسداك ٤٥٥١ شمعة تبلّش ٢٠٢٣، وSPX ٢٩٧٣ تبلّش ٢٠٢٤.
     الفهرس N ما بيعني نفس اللحظة — فلازم الترجمة تصلّحه. */
  const main = tradingDays(400);              // أعمق
  const cmp = tradingDays(400).slice(150);    // بتبلّش متأخر

  const t = main[300];
  const Lmain = logicalAtTime(main, t, medianInterval(main));
  const out = mapLogicalRange(main, cmp, { from: Lmain - 20, to: Lmain });
  const Lcmp = logicalAtTime(cmp, t, medianInterval(cmp));

  assert.ok(Math.abs(out.to - Lcmp) < 1e-6, "نفس اللحظة لازم تنزل على نفس الفهرس بالمقارنة");
  assert.ok(Math.abs(out.to - Lmain) > 100, "وبالفهرس الخام كانت بتنزل غلط بفرق كبير");
});

test("عطلة عند طرف واحد بس — الانزياح بيضل تحت نص شمعة", () => {
  /* مزوّدان بيختلفوا بيوم عطلة. هون بتبان قيمة الترجمة: بدل ما ينزاح كل شي
     بعد العطلة شمعة كاملة، الانزياح بيتوزّع وبيضل صغير. */
  const main = tradingDays(200);
  const cmp = tradingDays(200, 0, new Set([37, 38, 101])); // ٣ عطل زيادة
  for (const idx of [50, 120, 199]) {
    const t = main[idx];
    const got = logicalAtTime(cmp, t, medianInterval(cmp));
    const want = cmp.findIndex((x) => x >= t);
    assert.ok(Math.abs(got - want) <= 0.5, `عند ${idx}: انزياح ${Math.abs(got - want)} شمعة`);
  }
});

test("مدخلات فاسدة بترجّع null بدل ما تخمّن", () => {
  const t = tradingDays(30);
  assert.equal(mapLogicalRange(t, t, null), null);
  assert.equal(mapLogicalRange(t, t, { from: 5, to: 5 }), null, "to = from");
  assert.equal(mapLogicalRange(t, t, { from: 9, to: 3 }), null, "to < from");
  assert.equal(mapLogicalRange(t, t, { from: NaN, to: 3 }), null);
  assert.equal(mapLogicalRange([], t, { from: 0, to: 5 }), null, "مصدر فاضي");
  assert.equal(mapLogicalRange(t, [], { from: 0, to: 5 }), null, "هدف فاضي");
  assert.equal(mapLogicalRange([5], [7], { from: 0, to: 5 }), null, "شمعة وحدة → ما بنخمّن");
});

/* ══════════════ 🔴 الحلقة مع الترجمة الفعلية ══════════════ */

test("🔴 الحلقة بتنتهي بالترجمة الحقيقية بين سلسلتين مختلفتين", () => {
  /* أهم اختبار: الترجمة ذهاب-إياب بين سلسلتين مختلفتي العمق والعطل، مع شرط
     التطابق. لازم توقف — وإلا رجع التكبير المتسارع. */
  const main = tradingDays(300);
  const cmp = tradingDays(300, 0, new Set([12, 44, 45, 160])).slice(40);
  const TOL_LOGICAL = 0.25;

  let a = { from: 200, to: 260 };
  let b = null;
  let applies = 0;

  for (let i = 0; i < 500; i++) {
    const tb = mapLogicalRange(main, cmp, a);
    if (tb && shouldApplyRange(b, tb, TOL_LOGICAL)) { b = tb; applies++; } else break;
    const ta = mapLogicalRange(cmp, main, b);
    if (ta && shouldApplyRange(a, ta, TOL_LOGICAL)) { a = ta; applies++; } else break;
  }

  assert.ok(applies < 10, `الحلقة ما وقفت — ${applies} تطبيق`);
  assert.ok(Math.abs(a.to - a.from - 60) < 2, `عرض النافذة انزاح: ${a.to - a.from}`);
});
