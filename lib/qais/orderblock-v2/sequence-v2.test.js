/* اختبارات السيكونز على المحرك الجديد.

   الغاية من النقل: حساب الأهداف بالوحدة القديمة **سليم**، بس مدخلها من
   المحرك القديم (٧٤٥ حدث على ٢٩٢٨ شمعة). فالاختبارات هون بتركّز على
   شغلتين: اشتقاق النقاط من `event.swingRef`، والسببية.
*/

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeStructureV2 } from "../structure/index.js";
import { analyzeSequenceV2, pointsFromEvent, PROJECTION_RATIOS } from "./sequence-v2.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const C = JSON.parse(
  fs.readFileSync(path.join(HERE, "verify/fixtures/nas100-h4-2026-context.json"), "utf8")
).candles;
const ST = analyzeStructureV2(C, { timeframe: "h4" });

test("النسب مطابقة للمنهجية", () => {
  assert.deepEqual(PROJECTION_RATIOS.map((t) => t.ratio), [1.0, 1.618, 1.809, 2.0]);
  /* ⚠️ 1.809 تحديداً: ترويسة الوحدة القديمة كانت بتعدّد 0.618 بدلها،
     وتصليح الكود ليطابق التعليق كان بيكسر الأهداف. */
  assert.ok(PROJECTION_RATIOS.some((t) => t.ratio === 1.809), "1.809 اختفت");
  assert.ok(!PROJECTION_RATIOS.some((t) => t.ratio === 0.618), "0.618 رجعت من الترويسة القديمة");
});

test("النقاط بتنشتق من swingRef وبالترتيب الصح", () => {
  assert.ok(ST.events.length > 10, `شرط مسبق: في أحداث كافية، طلع ${ST.events.length}`);
  let derived = 0;
  for (const e of ST.events) {
    const p = pointsFromEvent(e, ST.majorSwings, C.length - 1);
    if (!p) continue;
    derived++;
    assert.equal(p.A.index, e.swingRef.index, `${e.id}: A مش السوينغ المكسور`);
    assert.ok(p.origin.index < p.A.index, `${e.id}: Origin بعد A`);
    assert.ok(p.A.index < p.B.index, `${e.id}: B قبل A`);
    assert.ok(p.B.index < e.index, `${e.id}: B بعد شمعة الكسر`);
    assert.equal(p.origin.type, p.B.type, `${e.id}: Origin وB مش نفس النوع`);
    assert.notEqual(p.origin.type, p.A.type, `${e.id}: A بنفس نوع Origin`);
  }
  assert.ok(derived > ST.events.length * 0.8, `اشتق ${derived}/${ST.events.length} بس`);
});

test("حدث بلا تصحيح مؤكَّد ما بيعطي نقاط — مش خلل", () => {
  /* الكسر صار مباشرة بعد A بلا سوينغ معاكس بينهم، فما في B.
     السيكونز بتعريفها بتحتاج تصحيحاً — الرفض صحيح. */
  const failing = ST.events.filter((e) => !pointsFromEvent(e, ST.majorSwings, C.length - 1));
  for (const e of failing) {
    const opp = e.swingRef.type === "high" ? "low" : "high";
    const between = ST.majorSwings.filter(
      (s) => s.type === opp && s.index > e.swingRef.index && s.index < e.index &&
        Number.isFinite(s.confirmedAtIndex) && s.confirmedAtIndex <= C.length - 1
    );
    const before = ST.majorSwings.filter(
      (s) => s.type === opp && s.index < e.swingRef.index && Number.isFinite(s.confirmedAtIndex)
    );
    assert.ok(between.length === 0 || before.length === 0,
      `${e.id}: انرفض مع إنه في نقاط متاحة — خلل مش سلوك`);
  }
});

test("سببية: C ما بتسبق لحظة السؤال أبداً", () => {
  let checked = 0;
  for (const at of [150, 200, 300, 400, 500, 600, 700, 800, 900, C.length - 1]) {
    const r = analyzeSequenceV2(C, ST, { asOfIndex: at });
    if (r.points?.C) {
      assert.ok(r.points.C.index <= at, `@${at}: C عند ${r.points.C.index} — نظر للمستقبل`);
      assert.ok(r.points.C.confirmedAtIndex <= at, `@${at}: C ما تأكّدت بعد`);
      checked++;
    }
    for (const k of ["origin", "A", "B"]) {
      const p = r.points?.[k];
      if (p) assert.ok(p.index <= at, `@${at}: ${k} من المستقبل`);
    }
  }
  assert.ok(checked > 3, `شرط مسبق: في سيكونزات مكتملة انفحصت، طلع ${checked}`);
});

test("الأهداف مسقطة من B مش من C", () => {
  let found = null;
  for (let at = 100; at < C.length; at += 25) {
    const r = analyzeSequenceV2(C, ST, { asOfIndex: at });
    if (r.stage === "complete") { found = r; break; }
  }
  assert.ok(found, "شرط مسبق: في سيكونز مكتملة بالعيّنة");
  assert.equal(found.projectedFrom, +found.points.B.price.toFixed(5), "الإسقاط مش من B");
  assert.notEqual(found.projectedFrom, +found.points.C.price.toFixed(5), "الإسقاط من C — الخطأ المعروف");

  /* وطول الساق = |A − Origin| مش أي إشي تاني. */
  const leg = Math.abs(found.points.A.price - found.points.origin.price);
  assert.ok(Math.abs(found.legLength - leg) < 0.01, "طول الساق مش Origin→A");

  /* والأهداف محسوبة صح من الاتنين. */
  const tp2 = found.targets.find((t) => t.key === "TP2");
  const expected = found.direction === "up" ? found.projectedFrom + leg : found.projectedFrom - leg;
  assert.ok(Math.abs(tp2.price - expected) < 0.01, `TP2 ${tp2.price} مش ${expected}`);
});

test("TP1 مستوى حقيقي مش نسبة", () => {
  for (let at = 100; at < C.length; at += 25) {
    const r = analyzeSequenceV2(C, ST, { asOfIndex: at });
    if (r.stage !== "complete") continue;
    const tp1 = r.targets.find((t) => t.key === "TP1");
    if (!tp1) continue;
    assert.equal(tp1.ratio, null, "TP1 صار نسبة");
    assert.equal(tp1.isRealLevel, true);
    /* ولازم يكون سوينغ فعلي مؤكَّد بالبيانات. */
    const match = ST.majorSwings.some((s) => Math.abs(s.price - tp1.price) < 0.01);
    assert.ok(match, `TP1 ${tp1.price} مش سوينغ موجود`);
    return;
  }
  assert.fail("شرط مسبق: ما في سيكونز مكتملة فيها TP1");
});

test("الإبطال بكسر B أو النقطة 0", () => {
  let invalidated = 0;
  for (let at = 100; at < C.length; at += 10) {
    const r = analyzeSequenceV2(C, ST, { asOfIndex: at });
    if (r.stage !== "invalidated") continue;
    invalidated++;
    const { origin, B } = r.points;
    const c = C[r.invalidatedAt.index];
    const beyond = r.direction === "up"
      ? c.close < Math.max(B.price, origin.price)
      : c.close > Math.min(B.price, origin.price);
    assert.ok(beyond, "علّم إبطالاً والإغلاق ما تجاوز B ولا النقطة 0");
  }
  assert.ok(invalidated > 0, "ولا سيكونز انبطلت بالعيّنة — الفحص ما اشتغل");
});

test("مدخلات ناقصة ما بتنهار", () => {
  assert.equal(analyzeSequenceV2([], ST).value, "INSUFFICIENT_DATA");
  assert.equal(analyzeSequenceV2(C, { events: [], majorSwings: [] }).ok, false);
  assert.equal(analyzeSequenceV2(C, null).ok, false);
});
