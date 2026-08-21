/* اختبارات مبدأ المتروشكا — سيكونس أساسي ⊃ سيكونسات فرعية.

   المرجع: وثيقته «SK System – Part 1». اللي انأخذ منها **تحديد السيكونز
   والأهداف وبس** — قواعد الدخول والستوب من النظام القائم بقراره
   (٢٠٢٦-٠٨-٢١).
*/

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeStructureV2 } from "../structure/index.js";
import { enumerateSequences, analyzeSequenceV2, MIN_B_RETRACEMENT } from "./sequence-v2.js";
import { matryoshkaAt, isNestedIn } from "./matryoshka.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const L = (n) => JSON.parse(fs.readFileSync(path.join(HERE, "verify/fixtures", n), "utf8")).candles;
const GOLD = L("xauusd-h4-2026-seq.json");
const ST = analyzeStructureV2(GOLD, { timeframe: "h4" });

test("قانونه ٣: الموجة B لازم تصحّح 0.382 على الأقل", () => {
  assert.equal(MIN_B_RETRACEMENT, 0.382, "الرقم منصوص عليه بوثيقته — ما بينعاير");

  const all = enumerateSequences(GOLD, ST.majorSwings, GOLD.length - 1, { minRetracement: 0 });
  const kept = enumerateSequences(GOLD, ST.majorSwings, GOLD.length - 1);
  assert.ok(all.length > 0, "شرط مسبق: في مرشّحات");
  assert.ok(kept.length < all.length, "القاعدة ما رمت ولا مرشّح — يعني ما انطبّقت");

  for (const s of kept) {
    assert.ok(s.retracement >= MIN_B_RETRACEMENT, `تصحيح ${s.retracement} تحت الحد`);
  }
  /* والمرميّات فعلاً تحت الحد — مش انرمت لسبب تاني. */
  const keptKeys = new Set(kept.map((s) => `${s.direction}:${s.origin.index}:${s.A.index}`));
  for (const s of all) {
    if (keptKeys.has(`${s.direction}:${s.origin.index}:${s.A.index}`)) continue;
    assert.ok(s.retracement < MIN_B_RETRACEMENT, `انرمى مرشّح تصحيحه ${s.retracement} فوق الحد`);
  }
});

test("⚠️ القاعدة ما بتكسر السيكونس المتحقَّق يدوياً", () => {
  /* مرجعه اليدوي على الذهب: 0 3942.31 · A 4203.11 · B 3959.69.
     أي قاعدة جديدة لازم تحافظ عليه — وإلا هي غلط مهما بدت منطقية. */
  const before = analyzeSequenceV2(GOLD, ST, { minRetracement: 0 });
  const after = analyzeSequenceV2(GOLD, ST, {});
  assert.equal(after.ok, true, after.reason);
  assert.equal(after.points.origin.price, before.points.origin.price, "النقطة 0 تغيّرت");
  assert.equal(after.points.A.price, before.points.A.price, "النقطة A تغيّرت");
  assert.equal(after.points.B.price, before.points.B.price, "النقطة B تغيّرت");

  /* وقريبة من رسمه اليدوي (الفرق زحزحة CFI عن Dukascopy). */
  assert.ok(Math.abs(after.points.origin.price - 3942.31) < 2, `0 = ${after.points.origin.price}`);
  assert.ok(Math.abs(after.points.A.price - 4203.11) < 2, `A = ${after.points.A.price}`);
  assert.ok(Math.abs(after.points.B.price - 3959.69) < 2, `B = ${after.points.B.price}`);
});

test("الشجرة: أساسي واحد وفرعيات محتواة جوّاه", () => {
  const m = matryoshkaAt(GOLD, ST, {});
  assert.equal(m.ok, true, m.reason);
  assert.ok(m.primary?.ok, "ما في سيكونس أساسي");
  assert.ok(m.subs.length > 0, "ولا سيكونس فرعي — الشجرة فاضية");

  const shape = {
    origin: m.primary.points.origin, A: m.primary.points.A,
    B: m.primary.points.B, C: m.primary.points.C,
  };
  for (const s of m.subs) {
    assert.ok(isNestedIn(s, shape), "سيكونس فرعي برّا حدود الأساسي");
    /* أصغر فعلاً — «نمط أصغر ضمن حركة أكبر». */
    assert.ok(s.legLength <= m.primary.legLength, `ساق فرعية ${s.legLength} أكبر من الأساسي ${m.primary.legLength}`);
  }
});

test("الفرعيات بتشمل التصحيحات — مش بس نفس الاتجاه", () => {
  /* نصّ الوثيقة: «تشمل أيضاً التصحيحات». فلترة الاتجاه بتلغي نص المبدأ. */
  const m = matryoshkaAt(GOLD, ST, {});
  assert.equal(m.ok, true);
  assert.ok(m.counts.corrections > 0, "ولا تصحيح بالشجرة — الفلترة بتخالف الوثيقة");
  for (const s of m.subs) {
    assert.equal(s.role, s.direction === m.primary.direction ? "extension" : "correction");
  }
});

test("الاحتواء بينقاس مش بينفترض", () => {
  const outer = {
    origin: { index: 10, price: 100 }, A: { index: 20, price: 200 },
    B: { index: 25, price: 150 }, C: { index: 30, price: 190 },
  };
  /* جوّا المدى الزمني والسعري. */
  assert.equal(isNestedIn({ origin: { index: 12, price: 110 }, A: { index: 18, price: 180 }, B: { index: 19, price: 140 } }, outer), true);
  /* برّا زمنياً. */
  assert.equal(isNestedIn({ origin: { index: 5, price: 110 }, A: { index: 18, price: 180 }, B: { index: 19, price: 140 } }, outer), false);
  /* برّا سعرياً. */
  assert.equal(isNestedIn({ origin: { index: 12, price: 110 }, A: { index: 18, price: 260 }, B: { index: 19, price: 140 } }, outer), false);
});

test("بلا سيكونس أساسي ما في شجرة — والسبب مذكور", () => {
  const short = GOLD.slice(0, 40);
  const st = analyzeStructureV2(short, { timeframe: "h4" });
  const m = matryoshkaAt(short, st, {});
  assert.equal(m.ok, false);
  assert.ok(m.reason || m.why, "رفض بلا سبب");
  assert.deepEqual(m.subs, []);
});

test("⚠️ المتروشكا ما بتلمس الدخول ولا الستوب", () => {
  /* قراره: من الملف تحديد السيكونز والأهداف وبس. الوحدة لازم تطلّع
     سيكونسات وأهدافاً — ولا حقل دخول/ستوب/ثلث/SMT/CISD. */
  const m = matryoshkaAt(GOLD, ST, {});
  assert.equal(m.ok, true);
  const banned = ["entry", "stop", "third", "smt", "cisd", "risk"];
  const keys = new Set([...Object.keys(m), ...m.subs.flatMap((s) => Object.keys(s))]);
  for (const k of banned) assert.equal(keys.has(k), false, `الوحدة بتطلّع «${k}» — خارج نطاق الملف`);
});
