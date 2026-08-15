const fs = require("fs");
const [, , tpl, fixturePath, schemaPath, out] = process.argv;

let html = fs.readFileSync(tpl, "utf8");
const fx = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const slim = {
  id: fx.id, symbol: fx.symbol, timeframe: fx.timeframe, provider: fx.provider,
  candleCount: fx.candleCount, from: fx.from, to: fx.to, sha256: fx.sha256, candles: fx.candles,
};

// حقن المنطق المشترك: نفس مصدر المُصحِّح، بدون سطر التصدير
const schema = fs.readFileSync(schemaPath, "utf8")
  .split("\n").filter((l) => !/^export\s/.test(l.trim())).join("\n");

html = html.replace("__SCHEMA__", schema).replace("__FIXTURE__", JSON.stringify(slim));
for (const ph of ["__SCHEMA__", "__FIXTURE__"]) {
  if (html.includes(ph)) throw new Error("placeholder not replaced: " + ph);
}
if (/\bexport\s*\{/.test(html)) throw new Error("سطر تصدير تسرّب للأداة — رح يكسر الجافاسكربت");
fs.writeFileSync(out, html);

const m = html.match(/<script>([\s\S]*)<\/script>/);
fs.writeFileSync(out + ".check.mjs", m[1]);
console.log("KB:", (html.length / 1024).toFixed(0));
