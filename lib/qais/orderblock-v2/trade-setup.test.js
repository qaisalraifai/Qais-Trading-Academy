/* اختبارات السلسلة الكاملة: كتلة → ثلث → لمس → SMT → CISD → صفقة.

   الحالة المرجعية هي الكتلة المتحقَّقة يدوياً (٢٨ أبريل ٢٠٢٦) واللمس
   الحقيقي (٢٩ يوليو). كل الأصول من عيّنات مجمّدة.
*/

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeStructureV2 } from "../structure/index.js";
import { buildTradeSetup } from "./trade-setup.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const L = (n) => JSON.parse(fs.readFileSync(path.join(HERE, "verify/fixtures", n), "utf8"));
const NAS = L("nas100-h4-2026-context.json").candles;
const SPX = L("spx500-h4-2026-context.json").candles;
const D1 = L("nas100-d1-2024-2026.json").candles;
const M15 = L("nas100-m15-2026-07-entry.json").candles;
const SPX_M15 = L("spx500-m15-2026-07-entry.json").candles;

const ST = analyzeStructureV2(NAS, { timeframe: "h4" });
const ST_D1 = analyzeStructureV2(D1, { timeframe: "daily" });
const ST_SPX = analyzeStructureV2(SPX, { timeframe: "h4" });
const at = (C, ts) => { const i = C.findIndex((c) => c.time >= ts); return i < 0 ? C.length - 1 : i; };
const thirdContextFor = (i) => [
  { timeframe: "h4", majorSwings: ST.majorSwings, asOfIndex: i },
  { timeframe: "daily", majorSwings: ST_D1.majorSwings, asOfIndex: at(D1, NAS[i].time) },
];

const FORMED = at(NAS, Date.UTC(2026, 3, 28, 12) / 1000);
const BLOCK = {
  id: "OB-SK:up:apr28", direction: "up", top: 27377.22, bottom: 26875.83,
  levels: { open: 27355.22, mt: 27137.49, close: 26919.76, outerWick: 26875.83 },
  confirmedAtIndex: FORMED, invalidIndex: -1,
};
const baseCtx = {
  candles: NAS, structure: ST, thirdContextFor,
  correlate: { candles: SPX, swings: ST_SPX.majorSwings },
  lower: { candles: M15, timeframe: "M15" },
};

test("بلا مترابط = INSUFFICIENT_DATA مش رفض", () => {
  const r = buildTradeSetup(BLOCK, { ...baseCtx, correlate: null });
  assert.equal(r.value, "INSUFFICIENT_DATA", "غياب المترابط انقلب رفضاً");
  assert.equal(r.blockedAt, "smt");
});

test("بلا فريم أصغر = INSUFFICIENT_DATA عند CISD", () => {
  const m = smtM15();
  const r = buildTradeSetup(BLOCK, { ...baseCtx, smtPrimary: m.primary, smtCorrelate: m.correlate, lower: null });
  assert.equal(r.value, "INSUFFICIENT_DATA");
  assert.equal(r.blockedAt, "cisd", `وقفت عند ${r.blockedAt} مش cisd`);
});

test("السلسلة الكاملة على الكتلة المتحقَّقة", () => {
  const m = smtM15();
  const r = buildTradeSetup(BLOCK, { ...baseCtx, smtPrimary: m.primary, smtCorrelate: m.correlate });
  assert.equal(r.ok, true, r.reason || r.why);
  assert.equal(r.side, "شراء");

  /* اللمس بالتاريخ الحقيقي، والثلث متحقق بالفريمين. */
  assert.equal(new Date(r.chain.touch.time * 1000).toISOString().slice(0, 10), "2026-07-29");
  assert.equal(r.chain.touch.thirds.length, 2);
  for (const t of r.chain.touch.thirds) assert.equal(t.ok, true, `ثلث ${t.timeframe} ما تحقق`);

  /* الترتيب الزمني مُلزم: لمس ≤ SMT ≤ CISD. */
  assert.ok(r.chain.smt.time >= r.chain.touch.time, "SMT قبل اللمس");
  assert.ok(r.chain.cisd.time >= r.chain.smt.time, "CISD قبل الـSMT");

  /* الستوب تحت الدخول، والمخاطرة موجبة. */
  assert.ok(r.stop < r.entry, `ستوب ${r.stop} فوق دخول ${r.entry}`);
  assert.ok(r.risk > 0);
  assert.equal(r.stop, r.chain.smt.point, "الستوب مش نقطة الـSMT");

  /* ⚠️ الستوب لازم يكون **أعمق** كنس — لو أخدنا أول SMT بيطلع فوق الدخول. */
  assert.equal(r.chain.smt.scale, "internal");
  assert.equal(r.chain.smt.timeframe, "M15");
});

test("السلسلة بتوقف عند الثلث لو السعر ما رجع", () => {
  /* قبل ما يرجع السعر (مثلاً بمايو)، الحالة waiting مش entry. */
  const early = at(NAS, Date.UTC(2026, 4, 15) / 1000);
  const r = buildTradeSetup(BLOCK, { ...baseCtx, asOfIndex: early });
  assert.equal(r.ok, false);
  assert.equal(r.blockedAt, "third");
  assert.equal(r.state, "waiting");
});

test("SMT على سوينغات H4 الكبرى ما بتتكوّن — والسبب مسجَّل", () => {
  /* مقيس: آخر قاع H4 مؤكَّد كان مكسوراً قبل اللمس بخمس أيام، والنزول
     متواصل بلا ارتداد يثبّت قاعاً جديداً. الرفض صحيح ولازم يبان سببه. */
  const r = buildTradeSetup(BLOCK, baseCtx);
  assert.equal(r.ok, false);
  assert.equal(r.blockedAt, "smt");
  assert.ok(r.touch, "ما سجّل اللمس اللي وصله");
  assert.match(r.reason, /SMT/);
});

/* مصدر SMT على M15 بالبيفوتات الداخلية.
   ⚠️ البيفوت الداخلي بيتأكد بعد شمعتين (lookback 2) — فبنركّب
   `confirmedAtIndex` عشان تضل السببية محفوظة. */
const asConfirmed = (sw) => sw.map((s) => ({ ...s, confirmedAtIndex: s.index + 2 }));
function smtM15() {
  return {
    primary: {
      candles: M15,
      swings: asConfirmed(analyzeStructureV2(M15, { timeframe: "15min" }).internalSwings),
      scale: "internal", timeframe: "M15",
    },
    correlate: {
      candles: SPX_M15,
      swings: asConfirmed(analyzeStructureV2(SPX_M15, { timeframe: "15min" }).internalSwings),
    },
  };
}

test("الوحدة بتسجّل مقياس الـSMT بالمخرج مش بتفترضه", () => {
  const r = buildTradeSetup(BLOCK, baseCtx);
  /* لما ما ينمرّر مصدر، بتستعمل فريم الكتلة وبتقوله بالسبب. */
  assert.match(r.reason, /فريم الكتلة|major/, "ما ذكرت المقياس المستعمل");
});

test("حارس الاتجاه: صفقة شراء ستوبها فوق الدخول بتنرفض", () => {
  /* الخلل اللي صار فعلياً: الوحدة كانت تاخد **أول** SMT، والسعر بيكمّل
     لكنسة أعمق، فالستوب يطلع فوق الدخول بصفقة شراء. */
  const r = buildTradeSetup(BLOCK, baseCtx);
  if (r.ok) {
    const up = r.direction === "up";
    assert.ok(up ? r.stop < r.entry : r.stop > r.entry,
      `ستوب ${r.stop} مش ${up ? "تحت" : "فوق"} الدخول ${r.entry}`);
    assert.ok(r.risk > 0, "المخاطرة صفر");
  }
});

test("الأهداف `null` لما السيكونز ما اكتملت — مش مخترعة", () => {
  const r = buildTradeSetup(BLOCK, baseCtx);
  if (r.ok && r.targetsStage !== "complete") {
    assert.equal(r.targets, null, "طلّع أهدافاً والسيكونز ما اكتملت");
    assert.equal(r.rr, null);
  }
});

test("مراحل التوقّف كلها معرَّفة", () => {
  const stages = new Set(["third", "smt", "cisd", "stop"]);
  const cases = [
    buildTradeSetup(BLOCK, { ...baseCtx, asOfIndex: at(NAS, Date.UTC(2026, 4, 15) / 1000) }),
    buildTradeSetup(BLOCK, baseCtx),
    buildTradeSetup(BLOCK, { ...baseCtx, correlate: null }),
  ];
  for (const r of cases) {
    if (r.ok) continue;
    assert.ok(stages.has(r.blockedAt), `مرحلة توقّف غير معروفة: ${r.blockedAt}`);
    assert.ok(r.reason || r.why, "توقّف بلا سبب");
  }
});
