/* ⚠️ هالسكربت **بيضيف ما بيستبدل**. النسخة القديمة كانت بتعمل
   `REF.statedRules = [...]` من الصفر فمسحت R5–R13 مرتين. */
import fs from "node:fs";
const R = "file:///C:/Users/Qais/Desktop/Qais-Trading-Academy-New/Qais-Trading-Academy/lib/qais/";
const { analyzeLiquidityV2 } = await import(R + "liquidity-v2/index.js");
const { collectDisplacementCases, stratifiedSample, eligibleForLabeling } = await import(R + "orderblock-v2/verify/candidates.js");
const P = "lib/qais/orderblock-v2/verify/fixtures/";
const FX = JSON.parse(fs.readFileSync(P + "nas100-h4-2026q1q2.json", "utf8"));
const REF = JSON.parse(fs.readFileSync(P + "displacement.reference.json", "utf8"));
const C = FX.candles;

const r = collectDisplacementCases(C, { timeframe: "h4" });
const eligible = eligibleForLabeling(r.cases);

/* الحالات اللي سمّاها سلفاً — بتنستثنى عشان الجولة الجاية تضيف بيانات
   جديدة بدل ما تعيد نفس الأربعة وعشرين. */
const labeled = new Set((REF.labels || []).map((l) => l.caseId));
const fresh = eligible.filter((c) => !labeled.has(c.id));
console.log(`مؤهَّلة ${eligible.length} · مسمّاة سلفاً ${labeled.size} · جديدة ${fresh.length}`);

/* ⚠️ الحالات اللي بتحسم القواعد المعلّقة — بتنفرض بالعيّنة:
   C125·C159·C190 (زخم بلا حدث) وC170 (حدث بلا حركة). */
const decisive = ["C125", "C159", "C190", "C170"].filter((id) => eligible.some((c) => c.id === id));
const pool = [...fresh, ...eligible.filter((c) => decisive.includes(c.id))];
const sample = stratifiedSample(pool, { size: 24, by: "extLeg", mustInclude: decisive });

/* السيولة للعرض */
const L = analyzeLiquidityV2(C, { timeframe: "h4" });
const seen = new Set(); const sweeps = [];
for (const s of L.sweeps) {
  const i = s.startIndex ?? s.index, px = s.price;
  if (!Number.isFinite(i) || !Number.isFinite(px)) continue;
  const k = `${i}:${s.side}:${px.toFixed(4)}`;
  if (seen.has(k)) continue; seen.add(k);
  const o = s.outcome?.value ?? s.outcome ?? null;
  sweeps.push({ index: i, side: s.side, price: +px.toFixed(2), outcome: typeof o === "string" ? o : null });
}
for (const c of sample) {
  const near = sweeps.filter((s) => s.index >= c.groupStartIndex - 12 && s.index <= c.groupEndIndex + 2);
  c.liquidity = { sweepsNearBlock: near, sweepCount: near.length,
                  reversalCount: near.filter((s) => s.outcome === "reversal").length,
                  note: near.length ? null : "ما في كنسة بالنافذة" };
}

fs.writeFileSync(P + "displacement.candidates.json", JSON.stringify({
  fixtureId: FX.id, sha256: FX.sha256, generatedAt: new Date().toISOString(),
  totalCases: r.cases.length, eligibleCases: eligible.length,
  alreadyLabeled: labeled.size, sampleSize: sample.length,
  samplingNote: "حالات **جديدة** ما انسمّت قبل، من المؤهَّل (R3·R4·R5·R6 + صمود ≥٥)، بتوزيع متساوي على extLeg. R1 مستثنى — هو المجهول.",
  decisiveIncluded: decisive,
  cases: sample,
}, null, 1));
console.log(`✓ ${sample.length} حالة · الحاسمة ضمنها: ${decisive.join(" · ") || "—"}`);
console.log(`  جديدة كلياً: ${sample.filter(c => !labeled.has(c.id)).length}/${sample.length}`);
