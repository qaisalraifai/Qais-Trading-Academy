/* اختبارات وحدة تجميع حالات الزخم + حارس المرجع البشري.

   ⚠️ كل اختبار بيتأكد من **شرطه المسبق** قبل ما يفحص.
   قاعدة انفرضت بعد ما ١٤ اختبار «نجحوا» على مصفوفات فاضية: اختبار بيمرّ
   على لا-شي ما بيثبت شي.
*/

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { collectDisplacementCases, stratifiedSample, HORIZONS, SEARCH_CAP } from "./candidates.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = JSON.parse(fs.readFileSync(path.join(HERE, "fixtures", "nas100-h4-2026q1q2.json"), "utf8"));
const REF = JSON.parse(fs.readFileSync(path.join(HERE, "fixtures", "displacement.reference.json"), "utf8"));

const result = collectDisplacementCases(FX.candles, { timeframe: "h4" });

test("العيّنة المجمّدة ما انتغيّرت — البصمة مطابقة", () => {
  assert.ok(FX.candles.length > 0, "شرط مسبق: العيّنة فيها شموع");
  const sha = crypto.createHash("sha256").update(JSON.stringify(FX.candles)).digest("hex");
  assert.equal(sha, FX.sha256, "بصمة العيّنة اتغيّرت — كل التسميات المبنية عليها بطلت");
});

test("التجميع بيطلّع حالات فعلية", () => {
  assert.equal(result.ok, true, result.reason);
  assert.ok(result.cases.length > 50, `شرط مسبق: عدد كافٍ من الحالات، طلع ${result.cases.length}`);
});

test("ما في حالة مبنية على ATR ناقص", () => {
  assert.ok(result.cases.length > 0, "شرط مسبق: في حالات");
  for (const c of result.cases) {
    const a = c.measurements.atrAtGroup;
    assert.ok(Number.isFinite(a) && a > 0, `${c.id}: atrAtGroup = ${a}`);
  }
  assert.ok(result.meta.skippedAtrWarmup > 0, "شرط مسبق: فعلاً انستثنت حالات بفترة الإحماء");
});

test("كل القياسات محدودة — ولا وحدة Infinity أو NaN", () => {
  assert.ok(result.cases.length > 0, "شرط مسبق: في حالات");
  const keys = [
    ...HORIZONS.map((h) => `ext${h}`), "extLeg", "firstCandleRangeAtr",
    "blockBodyRatio", "blockBodySumRatio", "blockWeakestBodyPct",
  ];
  for (const c of result.cases) {
    for (const k of keys) {
      const v = c.measurements[k];
      assert.ok(Number.isFinite(v), `${c.id}.${k} = ${v} — قياس غير محدود`);
    }
    assert.ok(c.measurements.extLegBars <= SEARCH_CAP, `${c.id}: extLegBars تجاوز السقف`);
  }
});

test("ترتيب الفهارس سليم — المجموعة قبل الحركة", () => {
  assert.ok(result.cases.length > 0, "شرط مسبق: في حالات");
  for (const c of result.cases) {
    assert.ok(c.groupStartIndex <= c.groupEndIndex, `${c.id}: بداية المجموعة بعد نهايتها`);
    assert.ok(c.groupEndIndex < c.moveIndex, `${c.id}: المجموعة ما بتنتهي قبل الحركة`);
    assert.ok(c.moveIndex < FX.candles.length, `${c.id}: moveIndex برّا الحدود`);
    assert.equal(c.groupEndIndex - c.groupStartIndex + 1, c.groupCandleCount, `${c.id}: عدد الشموع مش متّسق`);
  }
});

test("مجموعة الشموع كلها بعكس اتجاه الحركة", () => {
  assert.ok(result.cases.length > 0, "شرط مسبق: في حالات");
  for (const c of result.cases) {
    for (let i = c.groupStartIndex; i <= c.groupEndIndex; i++) {
      const k = FX.candles[i];
      const bearish = k.close < k.open;
      assert.equal(
        bearish, c.direction === "up",
        `${c.id}: شمعة @${i} مش معاكسة لاتجاه الحركة`
      );
    }
  }
});

test("وضوح الأجسام بينقاس على الكتلة ككل مش على كل شمعة (R4)", () => {
  const lab = REF.labels.find((l) => l.levels.mt === 27137.49);
  assert.ok(lab, "شرط مسبق: الحالة المسمّاة موجودة");
  const c = result.cases.find((x) => x.id === lab.caseId);
  const M = c.measurements;

  /* الحالة اللي حسمت الالتباس: أضعف شمعة بالكتلة ذيل شبه صافي، والكتلة
     ككل جسم واضح. لو انعكست هالعلاقة، الحسم اللي بُني عليه بطل. */
  assert.ok(M.blockWeakestBodyPct < 0.25, `أضعف شمعة ${M.blockWeakestBodyPct} — ما عادت ذيل`);
  assert.ok(M.blockBodyRatio > 0.8, `الكتلة ككل ${M.blockBodyRatio} — ما عادت جسم واضح`);
  assert.ok(
    M.blockBodyRatio - M.blockWeakestBodyPct > 0.5,
    "التناقض بين القياسين اختفى — راجع حسم R4"
  );

  /* والمقياس المعتمد لازم يفرّق فعلاً بين الحالات، مش يمرّرها كلها. */
  const ratios = result.cases.map((x) => x.measurements.blockBodyRatio).filter(Number.isFinite);
  assert.ok(ratios.length > 300, "شرط مسبق: القياس محسوب لكل الحالات");
  const tail = ratios.filter((v) => v < 0.4).length;
  assert.ok(tail > 30, `بس ${tail} حالة تحت ٤٠٪ — القياس ما عاد يميّز`);
  assert.ok(tail < ratios.length * 0.6, "أغلب الحالات تحت ٤٠٪ — القياس صار يرفض كل إشي");
});

test("الشروط المعلنة مسجّلة وما في واحد منها مُشغَّل بلا قرار", () => {
  assert.ok(Array.isArray(REF.statedRules) && REF.statedRules.length >= 4, "شرط مسبق: الشروط مسجّلة");
  for (const r of REF.statedRules) {
    assert.ok(r.id && r.rule && r.status, `شرط ${r.id ?? "?"} ناقص حقول`);
  }
  const r3 = REF.statedRules.find((r) => r.id === "R3");
  assert.match(r3.status, /مُشغَّل/, "R3 (حدود الكتلة) المفروض مُشغَّل ومتحقَّق");
});

test("المستويات مشتقّة من شموع المجموعة نفسها", () => {
  assert.ok(result.cases.length > 0, "شرط مسبق: في حالات");
  for (const c of result.cases) {
    const first = FX.candles[c.groupStartIndex];
    const last = FX.candles[c.groupEndIndex];
    assert.equal(c.levels.open, +first.open.toFixed(2), `${c.id}: Open مش من أول شمعة`);
    assert.equal(c.levels.close, +last.close.toFixed(2), `${c.id}: Close مش من آخر شمعة`);
    assert.equal(
      c.levels.outerWick,
      +(c.direction === "up" ? last.low : last.high).toFixed(2),
      `${c.id}: الذيل الطرفي مش من آخر شمعة وحدها`
    );
  }
});

test("ولا حالة إجاها تصنيف من الوحدة — التسمية بشرية بس", () => {
  assert.ok(result.cases.length > 0, "شرط مسبق: في حالات");
  for (const c of result.cases) {
    assert.equal(c.label, null, `${c.id}: انتصنّف تلقائياً — ممنوع`);
    assert.equal(c.labelReason, null, `${c.id}: إله سبب تلقائي — ممنوع`);
  }
});

test("العيّنة الموزّعة بتغطي الطيف وبتحتوي المفروضات", () => {
  assert.ok(result.cases.length > 30, "شرط مسبق: البركة أكبر من حجم العيّنة");
  const forced = result.cases[7].id;
  const s = stratifiedSample(result.cases, { size: 24, by: "extLeg", mustInclude: [forced] });
  assert.equal(s.length, 24);
  assert.ok(s.some((c) => c.id === forced), "الحالة المفروضة ما دخلت العيّنة");
  assert.equal(new Set(s.map((c) => c.id)).size, 24, "في تكرار بالعيّنة");

  const all = result.cases.map((c) => c.measurements.extLeg).sort((a, b) => a - b);
  const got = s.map((c) => c.measurements.extLeg).sort((a, b) => a - b);
  assert.ok(got[0] <= all[Math.floor(all.length * 0.1)], "العيّنة ما فيها حالات ضعيفة");
  assert.ok(got[got.length - 1] >= all[Math.floor(all.length * 0.9)], "العيّنة ما فيها حالات قوية");
});

test("المرجع البشري لسا بيشير لنفس الحالة بنفس المستويات", () => {
  assert.equal(REF.sha256, FX.sha256, "المرجع مبني على عيّنة تانية");
  assert.ok(REF.labels.length > 0, "شرط مسبق: في تسميات بالمرجع");

  for (const lab of REF.labels) {
    const c = result.cases.find((x) => x.id === lab.caseId);
    assert.ok(c, `التسمية ${lab.caseId} ما عاد إلها حالة مقابلة — التجميع تغيّر وبطّل المرجع`);
    assert.equal(c.moveTime, lab.moveTime, `${lab.caseId}: وقت الحركة اتغيّر`);
    assert.deepEqual(c.levels, lab.levels, `${lab.caseId}: المستويات اتغيّرت`);
    assert.ok(["valid", "invalid"].includes(lab.label), `${lab.caseId}: تسمية غير معروفة`);
  }
});

test("حالة صاحب المنهجية بمستوياتها المتحقَّقة يدوياً", () => {
  const lab = REF.labels.find((l) => l.levels.mt === 27137.49);
  assert.ok(lab, "شرط مسبق: الحالة المسمّاة موجودة بالمرجع");
  assert.equal(lab.label, "valid");
  assert.deepEqual(lab.levels, {
    open: 27355.22, mt: 27137.49, close: 26919.76, outerWick: 26875.83, fvg: 27377.22,
  }, "المستويات اللي تطابقت مع رسمه اليدوي اتغيّرت");

  /* ⚠️ تعارض مثبت: المحرك الحالي بيرفض هالحالة والمرجع البشري بيقبلها.
     الاختبار بيثبّت التعارض عشان ما ينحل بالصدفة ولا ينتنسى. */
  const c = result.cases.find((x) => x.id === lab.caseId);
  assert.ok(c.measurements.firstCandleRangeAtr < 1.5, "الشمعة الملاصقة صارت تعدّي عتبة Strong — التعارض تغيّر، راجع القرار");
  assert.notEqual(c.measurements.fvgAfterBars, 1, "صارت في فجوة ملاصقة — التعارض تغيّر، راجع القرار");
});
