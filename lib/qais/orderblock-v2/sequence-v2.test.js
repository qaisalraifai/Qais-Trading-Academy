/* اختبارات السيكونز على المحرك الجديد.

   الغاية من النقل: حساب الأهداف بالوحدة القديمة **سليم**، بس مدخلها من
   المحرك القديم (٧٤٥ حدث على ٢٩٢٨ شمعة). فالاختبارات هون بتركّز على
   شغلتين: اشتقاق النقاط من `event.swingRef`، والسببية.
*/

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { analyzeStructureV2 } from "../structure/index.js";
import {
  analyzeSequenceV2, pointsFromEvent, PROJECTION_RATIOS,
  enumerateSequences, biggestSequence,
} from "./sequence-v2.js";

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

test("الميتة ما بتنعرض — بتنستثنى قبل الاختيار", () => {
  /* ⚠️ السلوك اتغيّر مع قاعدة «أكبر سيكونز حيّة»: قبل، السيكونز المنكسرة
     كانت بتنعرض بحالة invalidated. هلق بتنستثنى وبتنختار حيّة بدالها،
     و`invalidated` بتضل بس لما **كل** المرشّحات ميتة. */
  let selected = 0;
  for (let at = 200; at < C.length; at += 15) {
    const r = analyzeSequenceV2(C, ST, { asOfIndex: at });
    if (r.stage === "invalidated") {
      const alive = enumerateSequences(C, ST.majorSwings, at).filter((s) => s.alive);
      assert.equal(alive.length, 0, `@${at}: علّم invalidated وفي ${alive.length} حيّة`);
      continue;
    }
    if (!r.points?.B) continue;
    selected++;
    /* المختارة لازم تكون حيّة فعلاً — ما في إغلاق خلف B بعد الاختراق. */
    const dirUp = r.direction === "up";
    for (let i = r.event.index; i <= at; i++) {
      const c = C[i];
      const broke = dirUp ? c.close < r.points.B.price : c.close > r.points.B.price;
      assert.ok(!broke, `@${at}: المختارة ميتة — سكّرت خلف B @${i}`);
    }
  }
  assert.ok(selected > 5, `شرط مسبق: انفحصت ${selected} سيكونز مختارة بس`);
});

test("الاختيار: أكبر · حيّة · C مؤكَّدة · بنفس الاتجاه", () => {
  const at = C.length - 1;
  const all = enumerateSequences(C, ST.majorSwings, at);
  assert.ok(all.length > 3, `شرط مسبق: في مرشّحات، طلع ${all.length}`);
  assert.ok(all.some((s) => !s.alive), "شرط مسبق: في ميتة — وإلا قيد الحياة ما بينفحص");

  const picked = biggestSequence(C, ST.majorSwings, at, { events: ST.events });
  if (!picked) return;
  assert.equal(picked.alive, true, "اختار ميتة");

  /* ما في حيّة بنفس الاتجاه وC مؤكَّدة أكبر منها. */
  for (const s of all) {
    if (!s.alive || s.direction !== picked.direction) continue;
    if (s.legLength <= picked.legLength) continue;
    const want = s.direction === "up" ? "high" : "low";
    const hasC = ST.majorSwings.some(
      (w) => w.type === want && w.index > s.breakIndex &&
        Number.isFinite(w.confirmedAtIndex) && w.confirmedAtIndex <= at &&
        (s.direction === "up" ? w.price > s.A.price : w.price < s.A.price)
    );
    assert.ok(!hasC, `في أكبر منها (${s.legLength}) حيّة وC مؤكَّدة — الاختيار غلط`);
  }
});

test("مدخلات ناقصة ما بتنهار", () => {
  assert.equal(analyzeSequenceV2([], ST).value, "INSUFFICIENT_DATA");
  assert.equal(analyzeSequenceV2(C, { events: [], majorSwings: [] }).ok, false);
  assert.equal(analyzeSequenceV2(C, null).ok, false);
});

/* ══════════════════════════════════════════════════════════════════════
   حارس المرجع البشري: سيكونز رسمها صاحب المنهجية بإيده على ذهب H4.
   لو انكسر، المحرك ابتعد عن رسمه ولازم يوقف الشغل.
   ══════════════════════════════════════════════════════════════════════ */
const GOLD = JSON.parse(
  fs.readFileSync(path.join(HERE, "verify/fixtures/xauusd-h4-2026-seq.json"), "utf8")
);
const GC = GOLD.candles;
const GST = analyzeStructureV2(GC, { timeframe: "h4" });

test("عيّنة الذهب ما انتغيّرت", () => {
  assert.ok(GC.length > 300, "شرط مسبق: فيها شموع");
  const sha = crypto.createHash("sha256").update(JSON.stringify(GC)).digest("hex");
  assert.equal(sha, GOLD.sha256);
});

test("بتعيد إنتاج السيكونز اللي رسمها بإيده", () => {
  const r = analyzeSequenceV2(GC, GST);
  assert.equal(r.stage, "complete", r.reason);

  /* نقاطه: 0 3942.31 · A 4203.11 · B 3959.69 — الفروق زحزحة CFI. */
  assert.ok(Math.abs(r.points.origin.price - 3942.31) < 3, `Origin ${r.points.origin.price}`);
  assert.ok(Math.abs(r.points.A.price - 4203.11) < 3, `A ${r.points.A.price}`);
  assert.ok(Math.abs(r.points.B.price - 3959.69) < 3, `B ${r.points.B.price}`);
  assert.ok(Math.abs(r.legLength - 260.80) < 3, `الساق ${r.legLength}`);

  /* أهدافه الأربعة — كلها انطابقت بفرق أقل من نقطة. */
  const his = { TP2: 4220.49, TP3: 4381.66, TP4: 4431.48, TP5: 4481.29 };
  for (const [key, price] of Object.entries(his)) {
    const t = r.targets.find((x) => x.key === key);
    assert.ok(t, `${key} مفقود`);
    assert.ok(Math.abs(t.price - price) < 2, `${key}: ${t.price} مقابل ${price}`);
  }
});

test("القيود التلاتة كلها ضرورية — كل واحد بيغيّر الاختيار", () => {
  const at = GC.length - 1;
  const all = enumerateSequences(GC, GST.majorSwings, at);
  const his = (s) => Math.abs(s.legLength - 261.38) < 2;

  /* بلا قيد الاتجاه: أكبر حيّة+C بتصير هابطة — مش سيكونزه. */
  const noDir = all
    .filter((s) => s.alive)
    .filter((s) => GST.majorSwings.some(
      (w) => w.type === (s.direction === "up" ? "high" : "low") && w.index > s.breakIndex &&
        Number.isFinite(w.confirmedAtIndex) && w.confirmedAtIndex <= at &&
        (s.direction === "up" ? w.price > s.A.price : w.price < s.A.price)))
    .sort((a, b) => b.legLength - a.legLength);
  assert.ok(noDir.length > 1, "شرط مسبق: في أكتر من مرشّحة");
  assert.ok(!his(noDir[0]), "قيد الاتجاه صار بلا أثر — راجع");

  /* بلا قيد C: أكبر حيّة بنفس الاتجاه بتصير وحدة تانية. */
  const trend = GST.events[GST.events.length - 1].direction;
  const noC = all.filter((s) => s.alive && s.direction === trend).sort((a, b) => b.legLength - a.legLength);
  assert.ok(noC.length > 1, "شرط مسبق: في أكتر من حيّة بنفس الاتجاه");
  assert.ok(!his(noC[0]), "قيد C صار بلا أثر — راجع");

  /* وبالقيود التلاتة: سيكونزه. */
  const picked = biggestSequence(GC, GST.majorSwings, at, { events: GST.events });
  assert.ok(his(picked), `اختار ساق ${picked?.legLength} مش 261.38`);
});
