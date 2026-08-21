import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { analyzeSymbol } from "./engine.js";

/* ============================================================================
   عقد المخرج ↔ الواجهة.

   ---------------------------------------------------------------------------
   ⚠️ ليش انبنى: **الواجهة طفيت بالكامل** بعد ما انشال المحرك القديم.

   السبب كان صنف واحد بسيط: `sequence-v2` بتحط `ratio: null` على TP1 لأنه
   **سوينغ حقيقي مش نسبة فيبو**، والشارت كان بينادي `row.ratio.toFixed(3)`
   من أيام المحرك القديم اللي كل نسبه أرقام. → TypeError → صفحة سودا.

   وبنفس الجولة انكشف صنف تاني ما بيرمي بس بيخفي: `orderBlocks[].time` كانت
   بتطلع `null` دايماً، و`drawOrderBlocks` بتفلتر على `o.time != null` —
   فالكتل **ما كانت بتنرسم أبداً** وما في ولا خطأ يدلّ عليها.

   الدرس: البناء الناجح والاختبارات على المحركات ما بتمسك **عدم تطابق
   الشكل** بين المخرج والواجهة. هالملف بيمسكه: بيشغّل `analyzeSymbol` على
   عيّنة مجمّدة وبيفحص كل حقل بتقراه الواجهة فعلياً.

   ⚠️ لما تتغيّر بنية مخرج، ضيف الفحص هون قبل ما تعدّل الواجهة.
   ============================================================================ */

const FX = path.join(import.meta.dirname, "orderblock-v2", "verify", "fixtures");
const load = (f) => JSON.parse(fs.readFileSync(path.join(FX, f), "utf8")).candles;

const h4 = load("nas100-h4-2026q1q2.json");
const daily = load("nas100-d1-2024-2026.json");
const m15 = load("nas100-m15-2026-07-entry.json");
const m5 = load("nas100-m5-2026-07-entry.json");

const result = analyzeSymbol({ symbol: "NAS100", candlesByTF: { daily, h4, h1: null, m15, m5 } });

test("شرط مسبق: التحليل اشتغل على العيّنة المجمّدة", () => {
  assert.equal(result.error, undefined, result.error);
  assert.ok(result.orderBlocks.length > 0, "لازم يطلّع كتل — بلاها الفحوص تحت فاضية");
});

test("الشارت بيقدر يرسم الكتل: كل كتلة إلها وقت ومستويات رقمية", () => {
  /* `drawOrderBlocks` بتفلتر على `o.levels?.mt != null` وعلى `o.time != null`.
     أي واحد منهن `null` = الكتلة بتختفي بصمت. */
  for (const o of result.orderBlocks) {
    assert.ok(Number.isFinite(o.time), `الكتلة ${o.id} بلا وقت — ما رح تنرسم`);
    assert.ok(o.levels, `الكتلة ${o.id} بلا مستويات`);
    for (const k of ["mt", "open", "close", "outerWick"]) {
      assert.ok(Number.isFinite(o.levels[k]), `الكتلة ${o.id}: المستوى ${k} مش رقم`);
    }
    assert.ok(["up", "down"].includes(o.direction), `اتجاه غير صالح: ${o.direction}`);
  }
});

test("وقت الكتلة موجود فعلاً بشموع فريمها — وإلا `timeSet.has` بترفضها", () => {
  const times = new Set(h4.map((c) => c.time));
  for (const o of result.orderBlocks) {
    assert.ok(times.has(o.time), `وقت الكتلة ${o.id} (${o.time}) مش من شموع H4`);
  }
});

test("⚠️ الأهداف: كل هدف إما نسبة رقمية أو معلّم `isRealLevel` — بلا الاتنين بينكسر الرسم", () => {
  /* هاد بالضبط اللي طفّى الصفحة: `row.ratio.toFixed(3)` على `ratio: null`. */
  const seqs = [result.sequence, result.chartTrade].filter(Boolean);
  let checked = 0;
  for (const s of seqs) {
    for (const t of s.targets || []) {
      checked++;
      assert.ok(Number.isFinite(t.price), `هدف ${t.key} بلا سعر`);
      const usable = Number.isFinite(t.ratio) || t.isRealLevel === true;
      assert.ok(usable, `هدف ${t.key}: ratio=${t.ratio} وisRealLevel=${t.isRealLevel} — الرسم بينادي ratio.toFixed()`);
    }
  }
  /* ⚠️ لو ما في أهداف بهالعيّنة، الاختبار ما فحص إشي — بينقال صراحةً بدل
     ما يمرق كنجاح كاذب. */
  if (checked === 0) {
    assert.equal(result.tradeValid, false, "ما في أهداف بس في صفقة صالحة — تناقض");
  }
});

test("نقاط السيكونز إلها وقت وسعر — الشارت بيحوّلهن لإحداثيات", () => {
  if (!result.sequence) return; // ما بتنرسم بلا صفقة، وهاد قراره
  for (const k of ["origin", "A", "B", "C"]) {
    const p = result.sequence.points?.[k];
    if (!p) continue;
    assert.ok(Number.isFinite(p.time), `نقطة ${k} بلا وقت`);
    assert.ok(Number.isFinite(p.price), `نقطة ${k} بلا سعر`);
  }
  assert.ok(result.sequence.displayTF, "بلا displayTF الشارت ما بيعرف فوق أي شموع يرسم");
});

test("SMT: النقطة **رقم** مش كائن — `priceToY` بتاخد سعراً", () => {
  if (!result.smtSignal) return;
  assert.ok(Number.isFinite(result.smtSignal.point), `نقطة SMT مش رقم: ${JSON.stringify(result.smtSignal.point)}`);
});

test("صفقة الشارت: دخول وستوب رقميان، والدخول إله وقت", () => {
  const t = result.chartTrade;
  if (!t) return;
  assert.ok(Number.isFinite(t.entry?.price), "سعر الدخول مش رقم");
  assert.ok(Number.isFinite(t.entry?.time), "وقت الدخول مش رقم");
  assert.ok(Number.isFinite(t.stop), "الستوب مش رقم — الشارت بيرسم منطقة المخاطرة منه");
  assert.ok(["up", "down"].includes(t.direction));
});

test("خريطة الشروط: كل سطر نصّه قابل للعرض — ما في كائن بينرسم كـReact child", () => {
  /* React بترمي «Objects are not valid as a React child» وبتطفّي الصفحة. */
  for (const row of result.readiness.rows) {
    for (const k of ["id", "label", "detail"]) {
      assert.equal(typeof row[k], "string", `الحقل ${k} بالسطر ${row.id} مش نص`);
    }
    if (row.note != null) {
      assert.equal(typeof row.note, "string", `note بالسطر ${row.id} كائن — بيكسر الرسم`);
    }
    assert.ok(["met", "pending", "unknown"].includes(row.state));
  }
});

test("سلّم الهيكل: كل درجة إلها فريم نصّي — الواجهة بتنادي toUpperCase()", () => {
  for (const s of result.structureLadder) {
    assert.equal(typeof s.timeframe, "string", "الفريم مش نص");
    assert.ok(s.trend === null || ["up", "down"].includes(s.trend));
  }
});

test("POI: المستويات أرقام لما تكون موجودة", () => {
  const tz = result.poi.touchedZone;
  if (tz) assert.ok(Number.isFinite(tz.level), "مستوى المنطقة الملموسة مش رقم");
  for (const z of result.poi.rankedZones) {
    assert.ok(Number.isFinite(z.level), `بركة ${z.type} بلا مستوى رقمي`);
  }
});

test("⚠️ صفقة بلا أهداف شكل صالح — الشارت بيرسمها بالمخاطرة وبس", () => {
  /* عطل كامن مثبت: `drawLastTrade` كانت بتقرا `finalTarget.key` بلا حارس،
     و`finalTarget` بيكون `null` لما ما في أهداف → TypeError بيطفّي الشارت.
     صار احتماله أعلى بعد ما المحرك بلّش يرمي الأهداف المحقَّقة قبل الدخول.

     الشرط هون: لما `targets` تكون `null` لازم يضل الدخول والستوب
     والمخاطرة أرقاماً — هي اللي بينرسم منها الصندوق. */
  const t = result.chartTrade;
  if (!t) return;
  if (t.targets == null) {
    assert.ok(Number.isFinite(t.risk) && t.risk > 0, "بلا أهداف، `risk` هو اللي بيحدد امتداد الصندوق");
    assert.ok(Number.isFinite(t.entry?.price));
    assert.ok(Number.isFinite(t.stop));
  }
});

test("⚠️ ولا هدف معروض خلف الدخول أو محقَّق قبله", () => {
  /* هاد اللي خلّى الصفقة تبان سخيفة: أهداف تحت دخول شرائي، وR:R بالمئات
     لأن الحساب كان بـ`Math.abs`. */
  const t = result.chartTrade;
  if (!t?.targets) return;
  const up = t.direction === "up";
  for (const x of t.targets) {
    assert.ok(up ? x.price > t.entry.price : x.price < t.entry.price, `${x.key} خلف الدخول`);
    assert.notEqual(x.hit, true, `${x.key} محقَّق قبل الدخول`);
  }
});

/* ⚠️ عيّنة تانية **بتطلّع متروشكا فعلاً**.
   -----------------------------------------------------------------
   العيّنة الأولى بترجّع `ok:false` وصفر فرعيات، فكل تأكيدات المتروشكا
   كانت بتتخطّى بصمت. جرّبت أرجّع عطلين (حذف `retracement` وتسريب حقل
   `stop`) و**الاختبار مرق ناجحاً** — يعني كان بيفحص صفر. */
const mData = {
  h4: load("nas100-h4-2026-ext.json"), daily: load("nas100-d1-2026-ext.json"),
  m15: load("nas100-m15-2026-ext.json"), m5: load("nas100-m5-2026-ext.json"),
};
const withM = analyzeSymbol({ symbol: "NAS100", candlesByTF: { ...mData, h1: null } });

test("شرط مسبق: العيّنة التانية بتطلّع شجرة متروشكا غير فاضية", () => {
  assert.equal(withM.matryoshka?.ok, true, withM.matryoshka?.reason);
  assert.ok(withM.matryoshka.subs.length > 0, "صفر فرعيات — الفحوص تحت بتصير فاضية");
});

test("المتروشكا: كل حقل بتقراه اللوحة موجود وبالنوع الصح", () => {
  /* اللوحة بتقرا: ok · reason · timeframe · primary.{direction,legLength,
     points.{origin,A,B,C}.price, targets[].{key,price}} · subs[].{role,
     direction,origin,A,B,legLength,retracement,alive} · counts.{nested,
     corrections,extensions}. أي واحد ناقص = صفحة بيضا أو NaN. */
  const m = withM.matryoshka;
  assert.equal(typeof m.ok, "boolean");
  if (!m.ok) { assert.equal(typeof (m.reason ?? ""), "string"); return; }

  assert.equal(typeof m.timeframe, "string");
  const p = m.primary;
  assert.ok(p, "ok=true بلا أساسي");
  assert.ok(["up", "down"].includes(p.direction));
  assert.ok(Number.isFinite(p.legLength) && p.legLength > 0);
  for (const k of ["origin", "A", "B"]) {
    assert.ok(Number.isFinite(p.points?.[k]?.price), `النقطة ${k} بلا سعر رقمي`);
    assert.ok(Number.isFinite(p.points?.[k]?.index), `النقطة ${k} بلا فهرس`);
  }
  for (const t of p.targets || []) {
    assert.equal(typeof t.key, "string");
    assert.ok(Number.isFinite(t.price), `هدف ${t.key} بلا سعر`);
  }

  for (const s of m.subs || []) {
    assert.ok(["correction", "extension"].includes(s.role), `دور غير معروف: ${s.role}`);
    assert.ok(["up", "down"].includes(s.direction));
    assert.ok(Number.isFinite(s.legLength) && s.legLength > 0);
    assert.ok(Number.isFinite(s.retracement), "نسبة التصحيح مش رقم — اللوحة بتضربها ×100");
    assert.ok(s.retracement >= 0.382, `تصحيح ${s.retracement} تحت قانونه ٣`);
    for (const k of ["origin", "A", "B"]) assert.ok(Number.isFinite(s[k]?.price), `فرعية: ${k} بلا سعر`);
  }
  for (const k of ["nested", "corrections", "extensions"]) {
    assert.equal(typeof m.counts?.[k], "number", `العدّاد ${k} مفقود`);
  }
});

test("⚠️ المتروشكا ما بتسرّب دخولاً ولا ستوباً للمخرج", () => {
  /* قراره: من الملف تحديد السيكونز والأهداف وبس. */
  const blob = JSON.stringify(withM.matryoshka ?? {});
  for (const k of ["entry", "stop", "risk", "cisd", "smt"]) {
    assert.equal(blob.includes(`"${k}"`), false, `المتروشكا بتطلّع «${k}» — خارج نطاق الملف`);
  }
});

test("الفرعيات محتواة فعلاً جوّا الأساسي — بالمخرج مش بالوحدة بس", () => {
  const m = withM.matryoshka;
  assert.equal(m.ok, true, "شرط مسبق: الشجرة موجودة");
  const pts = [m.primary.points.origin, m.primary.points.A, m.primary.points.B, m.primary.points.C].filter(Boolean);
  const lo = Math.min(...pts.map((p) => p.price));
  const hi = Math.max(...pts.map((p) => p.price));
  const from = Math.min(...pts.map((p) => p.index));
  const to = Math.max(...pts.map((p) => p.index));
  for (const s of m.subs || []) {
    for (const k of ["origin", "A", "B"]) {
      assert.ok(s[k].price >= lo && s[k].price <= hi, `فرعية ${k} برّا نطاق الأساسي سعرياً`);
      assert.ok(s[k].index >= from && s[k].index <= to, `فرعية ${k} برّا نطاق الأساسي زمنياً`);
    }
  }
});
