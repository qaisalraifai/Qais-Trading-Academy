/* اختبارات دمج الكنسات المتلاقية.

   الخلل اللي بتحرسه: كل بركة كانت تنمسح لحالها، فلمسة سعرية وحدة على مستوى
   بتلتقي عليه كذا بركة (EqualHighs + PreviousDayHigh + SessionHigh…) كانت
   تطلّع كنسة لكل بركة. مقيس: ٤١٠ كنسة فائضة من ١٦٢٣ على ٢٧٢٩ شمعة —
   تضخيم ٢٥٪ بكل إحصاء سيولة.
*/

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeLiquidityV2 } from "./index.js";
import { mergeConfluentSweeps } from "./sweeps.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const Q1Q2 = JSON.parse(
  fs.readFileSync(path.join(HERE, "../orderblock-v2/verify/fixtures/nas100-h4-2026q1q2.json"), "utf8")
).candles;
const STRUCT = JSON.parse(
  fs.readFileSync(path.join(HERE, "../structure/verify/fixtures/nas100-h4-2026.json"), "utf8")
).candles;

const L = analyzeLiquidityV2(Q1Q2, { timeframe: "h4" });
const LS = analyzeLiquidityV2(STRUCT, { timeframe: "h4" });

test("الدمج فعلاً صار — مش اختبار على لا-شي", () => {
  assert.equal(L.ok, true, L.reason);
  const m = L.metrics.sweeps;
  assert.ok(m.poolInteractions > 0, "شرط مسبق: في تفاعلات بِرك");
  assert.ok(m.mergedByConfluence > 0, `شرط مسبق: في التقاء فعلي، طلع ${m.mergedByConfluence}`);
  assert.equal(m.total, m.poolInteractions - m.mergedByConfluence, "العدّ ما بيقفل");
});

test("ولا كنستين بنفس (شمعة · جهة · سعر)", () => {
  for (const [name, r] of [["q1q2", L], ["هيكل", LS]]) {
    assert.ok(r.sweeps.length > 0, `شرط مسبق: ${name} فيها كنسات`);
    const seen = new Set();
    for (const s of r.sweeps) {
      const k = `${s.startIndex}:${s.side}:${Number(s.price).toFixed(5)}`;
      assert.ok(!seen.has(k), `${name}: كنسة مكرّرة عند ${k}`);
      seen.add(k);
    }
  }
});

test("الالتقاء مسجَّل بكل أنواعه — مش مرمي", () => {
  const conf = L.sweeps.filter((s) => s.confluence.poolCount > 1);
  assert.ok(conf.length > 0, "شرط مسبق: في كنسات متلاقية");
  for (const s of conf) {
    assert.equal(s.confluence.poolIds.length, s.confluence.poolCount);
    assert.ok(s.confluence.poolTypes.length >= 1);
    assert.ok(s.confluence.poolTypes.length <= s.confluence.poolCount);
    /* الأنواع فريدة ومرتّبة — عشان المقارنة بين تشغيلتين تكون ممكنة. */
    assert.deepEqual(s.confluence.poolTypes, [...new Set(s.confluence.poolTypes)].sort());
  }
  assert.equal(L.metrics.sweeps.confluent, conf.length);
  assert.ok(L.metrics.sweeps.maxConfluence >= 2);
});

test("الكنسة المفردة كمان إلها سجل التقاء (بعدد ١)", () => {
  const solo = L.sweeps.filter((s) => s.confluence.poolCount === 1);
  assert.ok(solo.length > 0, "شرط مسبق: في كنسات مفردة");
  for (const s of solo) {
    assert.equal(s.confluence.poolTypes.length, 1);
    assert.equal(s.confluence.poolTypes[0], s.pool.type);
    assert.equal(s.outcomeConflict, null);
  }
});

/* مدخل مصنوع — لأن امتداد الحلقة ما بينفحص من `pool.sweeps` (بتحفظ نهاية
   الحلقة مش مطلعها، فما بتنعاد منها المجموعات). الدالة بتنفحص مباشرة.
   ⚠️ والاختبار بيتأكد إنه المدخل فعلاً فيه مجموعة متلاقية قبل ما يحكم. */
const mkSweep = (o) => ({
  id: o.id, side: o.side ?? "buy", price: o.price ?? 100,
  index: o.endIndex, startIndex: o.startIndex, endIndex: o.endIndex,
  touchCandles: o.touchCandles ?? 1, maxPenetration: o.pen ?? 1,
  maxPenetrationAtr: o.penAtr ?? 0.1, atrAtPenetration: 10,
  outcome: o.outcome ?? "reversal",
  pool: { id: o.poolId, type: o.poolType, price: o.price ?? 100, side: o.side ?? "buy",
          strength: "Normal", availableFromIndex: o.avail },
});

test("امتداد الحلقة = اتحاد النسخ مش أول وحدة", () => {
  const input = [
    mkSweep({ id: "A", startIndex: 10, endIndex: 12, poolId: "P1", poolType: "SessionHigh", avail: 5, touchCandles: 2, pen: 3 }),
    mkSweep({ id: "B", startIndex: 10, endIndex: 17, poolId: "P2", poolType: "EqualHighs", avail: 8, touchCandles: 5, pen: 9, penAtr: 0.9 }),
    mkSweep({ id: "C", startIndex: 40, endIndex: 41, poolId: "P3", poolType: "SessionHigh", avail: 30 }),
  ];
  const groups = new Set(input.map((s) => `${s.startIndex}:${s.side}:${s.price}`));
  assert.equal(groups.size, 2, "شرط مسبق: المدخل فيه مجموعة متلاقية وحدة ومفردة وحدة");

  const r = mergeConfluentSweeps(input);
  assert.equal(r.sweeps.length, 2);
  assert.equal(r.mergedCount, 1);

  const m = r.sweeps.find((s) => s.startIndex === 10);
  assert.equal(m.endIndex, 17, "الحلقة ما أخدت أبعد نهاية");
  assert.equal(m.touchCandles, 5, "عدد اللمسات ما أخد الأكبر");
  assert.equal(m.maxPenetration, 9, "أقصى تجاوز ما أخد الأعمق");
  assert.equal(m.maxPenetrationAtr, 0.9, "التجاوز بالـATR ما إجا من الأعمق");
  assert.equal(m.id, "A", "الأساس المفروض بركة أقدم مستوى قائم (avail 5)");
  assert.deepEqual(m.confluence.poolTypes, ["EqualHighs", "SessionHigh"]);

  const solo = r.sweeps.find((s) => s.startIndex === 40);
  assert.equal(solo.confluence.poolCount, 1);
  assert.equal(solo.endIndex, 41, "الكنسة المفردة انتغيّرت");
});

test("تعارض النتيجة بينتسجّل والأساس أقدم بركة", () => {
  const r = mergeConfluentSweeps([
    mkSweep({ id: "X", startIndex: 3, endIndex: 4, poolId: "PX", poolType: "SessionLow", avail: 1, outcome: "continuation" }),
    mkSweep({ id: "Y", startIndex: 3, endIndex: 4, poolId: "PY", poolType: "PreviousDayLow", avail: 2, outcome: "reversal" }),
  ]);
  assert.equal(r.conflicts, 1);
  const s = r.sweeps[0];
  assert.equal(s.outcome, "continuation", "النتيجة المفروض من أقدم بركة");
  assert.deepEqual(s.outcomeConflict.values.sort(), ["continuation", "reversal"]);
  assert.equal(s.outcomeConflict.resolvedFrom, "PX");
});

test("تعارض النتيجة بينظهر ما بينخبّى", () => {
  const all = [...L.sweeps, ...LS.sweeps];
  const conflicted = all.filter((s) => s.outcomeConflict);
  /* العيّنتان فيهن تعارض واحد على الأقل — مقيس قبل ما ينكتب الاختبار. */
  assert.ok(conflicted.length > 0, "شرط مسبق: في تعارض فعلي بالعيّنات");
  for (const s of conflicted) {
    assert.ok(s.outcomeConflict.values.length > 1, `${s.id}: علّم تعارض بقيمة وحدة`);
    assert.ok(s.outcomeConflict.resolvedFrom, `${s.id}: مصدر النتيجة المعتمدة مش مذكور`);
    assert.ok(s.confluence.poolCount > 1, `${s.id}: تعارض بلا التقاء — مستحيل`);
  }
  assert.equal(LS.metrics.sweeps.outcomeConflicts, LS.sweeps.filter((s) => s.outcomeConflict).length);
});

test("سجل البركة بيضل خام — كل بركة انكنست فعلاً", () => {
  const totalPoolSweeps = L.pools.reduce((a, p) => a + p.sweeps.length, 0);
  assert.ok(totalPoolSweeps > 0, "شرط مسبق: البِرك فيها سجلات");
  assert.equal(totalPoolSweeps, L.metrics.sweeps.poolInteractions,
    "سجلات البِرك انتأثرت بالدمج — المفروض تضل خام");
  assert.ok(totalPoolSweeps > L.sweeps.length, "ما في فرق بين الخام والأحداث — الدمج ما اشتغل");
});

test("الدمج حتمي — نفس المدخل نفس المخرج", () => {
  const a = analyzeLiquidityV2(Q1Q2, { timeframe: "h4" }).sweeps.map((s) => s.id);
  const b = analyzeLiquidityV2(Q1Q2, { timeframe: "h4" }).sweeps.map((s) => s.id);
  assert.ok(a.length > 0, "شرط مسبق: في كنسات");
  assert.deepEqual(a, b);
});

test("mergeConfluentSweeps بترجّع فاضي على مدخل فاضي بدل ما تنهار", () => {
  for (const bad of [[], null, undefined]) {
    const r = mergeConfluentSweeps(bad);
    assert.deepEqual(r, { sweeps: [], mergedCount: 0, conflicts: 0 });
  }
});

test("التضخيم انزال فعلاً — الرقم مقيس مش مدّعى", () => {
  const m = L.metrics.sweeps;
  const inflation = m.mergedByConfluence / m.poolInteractions;
  assert.ok(inflation > 0.1, `التضخيم المقيس ${(inflation * 100).toFixed(0)}% — أقل من المتوقع، راجع`);
  assert.ok(inflation < 0.5, `التضخيم ${(inflation * 100).toFixed(0)}% — الدمج شال أكتر من اللازم`);
});
