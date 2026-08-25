import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldApplyRange, createSyncBreaker } from "./pane-sync.js";

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
