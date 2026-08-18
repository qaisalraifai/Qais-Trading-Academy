/* بيبني أداة تسمية الزخم كملف HTML واحد مستقل — بلا شبكة وبلا تبعيات.
   تشغيل:
     node lib/qais/orderblock-v2/verify/build-displacement-tool.cjs
*/
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const HERE = __dirname;
const FX_PATH = path.join(HERE, "fixtures", "nas100-h4-2026q1q2.json");
const CASES_PATH = path.join(HERE, "fixtures", "displacement.candidates.json");
const TPL = path.join(HERE, "displacement-label.tpl.html");
const OUT = process.argv[2] || path.join(HERE, "fixtures", "displacement-label.html");

const fx = JSON.parse(fs.readFileSync(FX_PATH, "utf8"));
const cases = JSON.parse(fs.readFileSync(CASES_PATH, "utf8"));

/* حارس البصمة: الأداة ما بتنبنى على عيّنة انتغيّرت. أي تسمية بعد تغيير
   العيّنة بتكون مربوطة بشموع مش موجودة. */
const sha = crypto.createHash("sha256").update(JSON.stringify(fx.candles)).digest("hex");
if (sha !== fx.sha256) throw new Error(`بصمة العيّنة ما بتطابق:\n  بالملف ${fx.sha256}\n  محسوبة ${sha}`);
if (cases.sha256 !== fx.sha256) throw new Error("الحالات مبنية على عيّنة تانية");

/* حارس نطاق: كل فهرس بكل حالة لازم يكون جوّا حدود المصفوفة.
   تجاوز الحدود كان بيفضّي لوحة الأداة السابقة بالكامل. */
for (const k of cases.cases) {
  for (const key of ["moveIndex", "groupStartIndex", "groupEndIndex"]) {
    const v = k[key];
    if (!Number.isInteger(v) || v < 0 || v >= fx.candles.length) {
      throw new Error(`${k.id}.${key} = ${v} برّا حدود العيّنة (${fx.candles.length})`);
    }
  }
  if (k.groupStartIndex > k.groupEndIndex || k.groupEndIndex >= k.moveIndex) {
    throw new Error(`${k.id}: ترتيب الفهارس غلط`);
  }

  /* ⚠️ حارس: ولا حالة بتخالف قاعدة محسومة بتوصل للأداة.
     صار فعلياً — ٧ من ٢٤ حالة معروضة كانت مخالفة، وحدة كتلتها جسم ٣٪
     (ذيل صافي). الأداة بتسأل عن **الزخم وبس**؛ أي إشي تاني انحسم لازم
     ينفلتر قبل ما يوصلها. */
  const sr = k.settledRules;
  if (!sr) throw new Error(`${k.id}: بلا تقييم قواعد — أعد توليد الحالات`);
  for (const rule of ["R3", "R4", "R5", "R6"]) {
    if (sr[rule] !== true) throw new Error(`${k.id}: بتخالف ${rule} — ما بتنعرض`);
  }
}

const slim = {
  id: fx.id, symbol: fx.symbol, timeframe: fx.timeframe, provider: fx.provider,
  candleCount: fx.candleCount, from: fx.from, to: fx.to, sha256: fx.sha256, candles: fx.candles,
};

let html = fs.readFileSync(TPL, "utf8")
  .replace("__FIXTURE__", JSON.stringify(slim))
  .replace("__CASES__", JSON.stringify(cases));

for (const ph of ["__FIXTURE__", "__CASES__"]) {
  if (html.includes(ph)) throw new Error("placeholder ما انستبدل: " + ph);
}

fs.writeFileSync(OUT, html);
console.log(`✓ ${path.relative(process.cwd(), OUT)}  ${(html.length / 1024).toFixed(0)} KB`);
console.log(`  ${cases.cases.length} حالة · ${fx.candleCount} شمعة · ${fx.sha256.slice(0, 12)}`);
