import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { analyzeSymbol } from "./engine.js";

/* ============================================================================
   حارس: الواجهة ما بتقرا حقلاً ما عاد المحرك يطلّعه.

   ---------------------------------------------------------------------------
   ⚠️ ليش انبنى: تلات لوحات، وبكل وحدة **رقم ميت** — وما مسكه لا البناء ولا
   الاختبارات ولا فحص المخرج. مسكه بس تشغيل الواجهة والنظر فيها:

     الرادار            «100% confidence» · `marketStatus.avgConfidence` مشال
     QAIS Engine        «QAIS Score 0/100» من `result.score` و`result.status`
                        — الحقلان مشالان، فالشارة كانت ترسم صفراً على كل رمز
     تفاصيل الصفقة      «Confidence —» من عمود صار `null` دايماً

   الصنف واحد: **قراءة حقل انشال**. JavaScript بترجّع `undefined` بصمت،
   فالواجهة بترسم «—» أو «0» بدل ما تنكسر. هاد أخطر من العطل الصريح.

   ⚠️ الحارس بيقارن **قراءات الواجهة** بـ**حقول المخرج الفعلية** — مش بقائمة
   مكتوبة بالإيد، عشان ما يصير هو نفسه قديماً.
   ============================================================================ */

const HERE = import.meta.dirname;
const ROOT = path.join(HERE, "..", "..");
const FX = path.join(HERE, "orderblock-v2", "verify", "fixtures");
const load = (f) => JSON.parse(fs.readFileSync(path.join(FX, f), "utf8")).candles;

const result = analyzeSymbol({
  symbol: "NAS100",
  candlesByTF: {
    daily: load("nas100-d1-2026-ext.json"), h4: load("nas100-h4-2026-ext.json"),
    h1: null, m15: load("nas100-m15-2026-ext.json"), m5: load("nas100-m5-2026-ext.json"),
  },
});

/** الملفات اللي بتستهلك ناتج `analyzeSymbol` مباشرة. */
const CONSUMERS = [
  "app/dashboard/components/MarketIntelligenceView.js",
  "app/dashboard/components/QaisEngineView.js",
];

/** أسماء المتغيّرات اللي بتحمل ناتج التحليل بهالملفات. */
const ANALYSIS_VARS = ["r", "result", "analysis"];

/* ⚠️ استثناءات **مبرَّرة**، مش كنس تحت السجادة:
   · `error` بيطلع بمسار الفشل وحده (`{ symbol, error }`) — مش بالنجاح.
   · الباقي أسماء متغيّرات تانية بتصادف نفس الحرف (تواريخ، إحداثيات). */
const ALLOWED = new Set([
  "error",
  /* كائنات تانية اسمها `r` بنطاقات ضيّقة — رسم وإحداثيات. */
  "x", "y", "color", "label", "value", "lines", "dash", "glow", "labelY", "key", "idx", "hit", "ratio", "price",
  /* دوال Date */
  "getUTCHours", "getUTCMinutes", "getUTCSeconds", "getTime", "toISOString",
  /* حقول صفوف قاعدة البيانات (مش ناتج التحليل) */
  "decision", "updated_at", "radar_status", "entry_status", "radar_signal_label", "symbol",
]);

/** بيشيل التعليقات عشان الحارس ما يمسك نصاً توثيقياً. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function readsIn(src) {
  const code = stripComments(src);
  const found = new Map();
  const re = new RegExp(`\\b(${ANALYSIS_VARS.join("|")})\\s*\\??\\.\\s*([A-Za-z_]\\w*)`, "g");
  let m;
  while ((m = re.exec(code))) {
    const field = m[2];
    if (!found.has(field)) found.set(field, m[1]);
  }
  return found;
}

test("شرط مسبق: المخرج فيه حقول والملفات موجودة", () => {
  assert.ok(Object.keys(result).length > 10, "المخرج فاضي — الحارس بيصير بلا معنى");
  for (const f of CONSUMERS) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), `الملف ${f} مش موجود — حدّث القائمة`);
  }
});

test("⚠️ ولا حقل بتقراه الواجهة انشال من المخرج", () => {
  const emitted = new Set(Object.keys(result));
  const dead = [];

  for (const rel of CONSUMERS) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    for (const [field, varName] of readsIn(src)) {
      if (emitted.has(field) || ALLOWED.has(field)) continue;
      dead.push(`${rel}: ${varName}.${field}`);
    }
  }

  assert.deepEqual(
    dead, [],
    "الواجهة بتقرا حقولاً ما عاد المحرك يطلّعها — بترسم «—» أو «0» بصمت:\n  " + dead.join("\n  ")
  );
});

test("الحارس بيمسك فعلاً — فحص ذاتي", () => {
  /* ⚠️ حارس بلا فحص ذاتي ممكن يكون بيقرا صفر ملفات وينجح. */
  const fake = "const x = result.someFieldThatWasRemoved; if (r?.anotherDeadOne) {}";
  const found = readsIn(fake);
  assert.ok(found.has("someFieldThatWasRemoved"), "ما مسك القراءة العادية");
  assert.ok(found.has("anotherDeadOne"), "ما مسك القراءة بـ`?.`");

  /* والتعليقات ما بتنعدّ — وإلا كل توثيق لحقل مشال بيفشّل الحارس. */
  const commented = "/* result.oldField انشال */\n// r.anotherOld كمان";
  assert.equal(readsIn(commented).size, 0, "عدّ نصاً بتعليق كأنه قراءة");

  /* وبيقرا ملفات فعلاً. */
  let total = 0;
  for (const rel of CONSUMERS) total += readsIn(fs.readFileSync(path.join(ROOT, rel), "utf8")).size;
  assert.ok(total > 15, `قرا ${total} حقل بس — الحارس شبه فاضي`);
});
