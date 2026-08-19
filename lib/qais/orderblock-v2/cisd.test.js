/* اختبارات CISD — «كسر قمة آخر شمعة معاكسة على فريم ١٥ دقيقة أو ٥ دقائق».

   الحالة المرجعية حقيقية مش مصطنعة: نافذة الدخول على كتلة أبريل المتحقَّقة.
   اللمس على H4 يوم ٢٩ يوليو ٢٠:٠٠، والـCISD بعدها بـ١.٣ ساعة عند كسر
   27336.40 — قمة آخر شمعة حمرا.
*/

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { findCISD, lastOppositeRun, CISD_DEFAULTS } from "./cisd.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = JSON.parse(fs.readFileSync(path.join(HERE, "verify/fixtures/nas100-m15-2026-07-entry.json"), "utf8"));
const M15 = FX.candles;
const TOUCH = Date.UTC(2026, 6, 29, 20) / 1000;
const from = M15.findIndex((c) => c.time >= TOUCH);

test("العيّنة ما انتغيّرت", () => {
  assert.ok(M15.length > 100, "شرط مسبق: فيها شموع");
  const sha = crypto.createHash("sha256").update(JSON.stringify(M15)).digest("hex");
  assert.equal(sha, FX.sha256);
  assert.ok(from > 0, "شرط مسبق: لحظة اللمس موجودة بالعيّنة");
});

test("المستوى المرجعي = أعلى قمة بالسلسلة كلها مش آخر شمعة", () => {
  /* بنبني حالة فيها سلسلة هابطة أعلى قمة فيها **بأولها** — لو الكود أخد
     آخر شمعة بيطلع مستوى أوطى وبينكسر بدري. */
  const C = [
    { time: 1, open: 99, high: 100, low: 98.5, close: 100 },  // صاعدة — بتحدّ السلسلة
    { time: 2, open: 99.5, high: 105, low: 98, close: 98.5 }, // أعلى قمة بالسلسلة
    { time: 3, open: 98.5, high: 99, low: 97, close: 97.5 },
    { time: 4, open: 97.5, high: 98, low: 96, close: 96.5 },
  ];
  const run = lastOppositeRun(C, 4, true);
  assert.ok(run, "شرط مسبق: انلقت سلسلة");
  assert.equal(run.candles.length, 3, "السلسلة مش محدودة بالشمعة الصاعدة");
  assert.equal(run.startIndex, 1, "بداية السلسلة غلط");
  assert.equal(run.level, 105, "أخد قمة آخر شمعة بدل أعلى قمة بالسلسلة");
  assert.notEqual(run.level, 98, "أخد آخر شمعة — الخطأ اللي الاختبار موجود عشانه");
});

test("CISD الحقيقي: ٢٩ يوليو ٢٣:٠٠ بكسر 27336.40", () => {
  const r = findCISD(M15, from, true);
  assert.ok(r && !r.value, "ما صار CISD");
  assert.equal(new Date(r.time * 1000).toISOString().slice(0, 16), "2026-07-29T23:00");
  assert.ok(Math.abs(r.level - 27336.40) < 0.01, `المستوى ${r.level} مش 27336.40`);
  assert.equal(r.direction, "up");

  /* شمعة الكسر لازم تكون **باتجاه الصفقة**. */
  const c = M15[r.index];
  assert.ok(c.close > c.open, "شمعة الكسر هابطة — CISD بشمعة معاكسة");
  assert.ok(c.close > r.level, "الإغلاق مش فوق المستوى");

  /* وولا شمعة قبلها كسرت — «أول ما يصير». */
  for (let i = from; i < r.index; i++) {
    const p = M15[i];
    if (p.close <= p.open) continue;
    const run = lastOppositeRun(M15, i, true);
    if (!run) continue;
    assert.ok(p.close <= run.level, `في CISD أبكر @${i}`);
  }
});

test("الكسر بالإغلاق أضيق من الكسر بالذيل", () => {
  const byClose = findCISD(M15, from, true, { breakBy: "close" });
  const byWick = findCISD(M15, from, true, { breakBy: "wick" });
  assert.ok(byClose && !byClose.value, "ما في CISD بالإغلاق");
  assert.ok(byWick && !byWick.value, "ما في CISD بالذيل");
  /* الذيل ما بيتأخر عن الإغلاق أبداً — بيسبقه أو بيساويه. */
  assert.ok(byWick.index <= byClose.index, "الكسر بالذيل تأخر عن الإغلاق — مستحيل");
  assert.equal(byClose.breakBy, "close");
  assert.equal(CISD_DEFAULTS.breakBy, "close", "الافتراضي اتغيّر بلا قرار");
});

test("الاتجاه الهابط معكوس", () => {
  const C = [
    { time: 1, open: 100, high: 101, low: 100, close: 101 },
    { time: 2, open: 101, high: 103, low: 95, close: 102 },  // سلسلة صاعدة، أدنى قاع 95
    { time: 3, open: 102, high: 104, low: 101, close: 103 },
    { time: 4, open: 103, high: 103, low: 94, close: 94.5 }, // كسر لتحت
  ];
  const r = findCISD(C, 3, false);
  assert.ok(r && !r.value, "ما صار CISD هابط");
  assert.equal(r.direction, "down");
  assert.equal(r.level, 95, "المستوى مش أدنى قاع بالسلسلة");
  assert.ok(C[r.index].close < C[r.index].open, "شمعة الكسر صاعدة");
});

test("ما في CISD = null، ونقص البيانات = INSUFFICIENT_DATA", () => {
  /* شموع صاعدة كلها — ما في سلسلة معاكسة أصلاً. */
  const flat = Array.from({ length: 20 }, (_, i) => ({
    time: i, open: 100 + i, high: 101 + i, low: 99 + i, close: 100.5 + i,
  }));
  assert.equal(findCISD(flat, 1, true), null, "طلّع CISD بلا سلسلة معاكسة");

  const empty = findCISD([], 0, true);
  assert.equal(empty.value, "INSUFFICIENT_DATA", "مصفوفة فاضية ما رجّعت INSUFFICIENT_DATA");
  assert.equal(findCISD(null, 0, true).value, "INSUFFICIENT_DATA");
});

test("نافذة الانتظار محدودة", () => {
  const r = findCISD(M15, from, true, { maxBarsToBreak: 2 });
  const full = findCISD(M15, from, true);
  assert.ok(full && !full.value, "شرط مسبق: في CISD بالنافذة الكاملة");
  assert.ok(full.index - from > 2, "شرط مسبق: الـCISD أبعد من النافذة الضيقة");
  assert.equal(r, null, "النافذة الضيقة ما حدّت البحث");
});
