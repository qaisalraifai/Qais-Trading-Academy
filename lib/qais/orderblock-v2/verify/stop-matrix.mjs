/* ============================================================================
   verify/stop-matrix.mjs
   مصفوفة واحدة: كل مرشّحات الستوب × كل الحالات المكتملة.

   ---------------------------------------------------------------------------
   ⚠️ بيقيس بس. **ما بيثبّت رقماً ولا بيعدّل المحرك.**

   ليش انبنى: تلات أسئلة معلّقة (هامش الستوب · شرط الملاصقة بالـCISD ·
   مصدر الستوب) وكلها معلّقة على نفس الشي — عدد الحالات. لما تكبر العيّنة،
   لازم يتقاسوا **مع بعض** على نفس الحالات، مش كل واحد لحاله، وإلا ما
   بينعرف أي تركيبة بتشتغل.

   ⚠️ «نجت» = الستوب ما انضرب قبل ما يوصل السعر أول هدف، أو — بلا أهداف —
   ما انضرب أبداً خلال البيانات المتاحة. التعريف التاني بيتأثر بطول
   البيانات، فبينتسجّل `barsTracked` جنبه.

   ⚠️ الأرقام تحت **وصفية**. اختيار تركيبة منها بلا قرار صاحب المنهجية
   بيكون تعييراً على العيّنة — وهاد ممنوع بقواعد المشروع.
   ============================================================================ */

import fs from "node:fs";
import path from "node:path";
import { analyzeStructureV2 } from "../../structure/index.js";
import { atrSeries, atrAt } from "../../structure/atr.js";
import { analyzeOrderBlocksSK } from "../rules-sk.js";
import { buildTradeSetup } from "../trade-setup.js";

const FX = path.join(import.meta.dirname, "fixtures");
const load = (f) => JSON.parse(fs.readFileSync(path.join(FX, f), "utf8")).candles;

/** كل التركيبات المطروحة — بلا ترجيح وبلا تفضيل. */
export const VARIANTS = [
  { id: "الحالي", stopSource: "smt", stopBufferAtrMult: 0, requireAdjacentRun: true },
  { id: "SMT +0.5×", stopSource: "smt", stopBufferAtrMult: 0.5, requireAdjacentRun: true },
  { id: "SMT +1×", stopSource: "smt", stopBufferAtrMult: 1, requireAdjacentRun: true },
  { id: "SMT +2×", stopSource: "smt", stopBufferAtrMult: 2, requireAdjacentRun: true },
  { id: "حد الإبطال", stopSource: "block", stopBufferAtrMult: 0, requireAdjacentRun: true },
  { id: "الحالي · بلا ملاصقة", stopSource: "smt", stopBufferAtrMult: 0, requireAdjacentRun: false },
  { id: "الإبطال · بلا ملاصقة", stopSource: "block", stopBufferAtrMult: 0, requireAdjacentRun: false },
];

/* ============================================================================
   ⚠️ حارس تغطية — انبنى بعد ما خدعني القياس فعلياً.

   العيّنة الممتدة أعطت **صفقة وحدة** بينما العيّنة الأقصر أعطت اتنتين.
   السبب ما كان بالمنهجية: سلسلة **المترابط** كان فيها ٥ فجوات مجموعها
   ٨٧ يوم (وحدة منهن ٣٩ يوم) — ١٦٤ يوم مغطّى من ٢٧٢. وبلا شموع مترابط ما
   في SMT، فالسلسلة بتوقف بصمت وبيبان إنه «المنهجية بتعطي صفقة وحدة».

   يعني بيانات أكتر أعطت نتيجة **أسوأ**، والسبب ثقوب مش سوق. أي استنتاج
   من ذاك التشغيل كان بيكون غلط.
   ============================================================================ */
export function coverageReport(data) {
  const check = (label, candles, maxGapDays = 3.2) => {
    const gaps = [];
    for (let i = 1; i < candles.length; i++) {
      const d = (candles[i].time - candles[i - 1].time) / 86400;
      if (d > maxGapDays) gaps.push({ from: candles[i - 1].time, to: candles[i].time, days: +d.toFixed(1) });
    }
    const span = (candles.at(-1).time - candles[0].time) / 86400;
    const days = new Set(candles.map((c) => new Date(c.time * 1000).toISOString().slice(0, 10))).size;
    return { label, candles: candles.length, spanDays: +span.toFixed(0), coveredDays: days, gaps };
  };
  return [
    check("M15 أساسي", data.m15),
    check("M15 مترابط", data.corrM15),
    check("M5", data.m5),
  ];
}

export function buildContext(data) {
  const { h4, daily, m15, m5, corrM15 } = data;
  const st = analyzeStructureV2(h4, { timeframe: "h4" });
  const stD = analyzeStructureV2(daily, { timeframe: "daily" });
  const alignD = (t) => {
    let lo = 0, hi = daily.length - 1, best = 0;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (daily[m].time <= t) { best = m; lo = m + 1; } else hi = m - 1; }
    return best;
  };
  return {
    st,
    blocks: analyzeOrderBlocksSK(h4, { timeframe: "h4", structure: st }),
    atrM15: atrSeries(m15, 14),
    ctx: {
      candles: h4, structure: st,
      thirdContextFor: (i) => [
        { timeframe: "h4", majorSwings: st.majorSwings, asOfIndex: i },
        { timeframe: "daily", majorSwings: stD.majorSwings, asOfIndex: alignD(h4[i].time) },
      ],
      lower: { candles: m15, timeframe: "m15" },
      correlateLower: { candles: corrM15 },
      cisdFrame: { candles: m5, timeframe: "m5" },
      structureOf: (c) => analyzeStructureV2(c, { timeframe: "m15" }),
    },
  };
}

/**
 * ⚠️ `prepared` بينمرّر من برّا عمداً: `buildContext` بتشغّل تحليل الهيكل
 * على كل الفريمات، وإعادتها لكل تركيبة بتضرب الوقت بعدد التركيبات — على
 * عيّنة ١٥ ألف شمعة هاد الفرق بين ثواني ودقايق.
 */
export function runVariant(data, opts, prepared = null) {
  const { m5 } = data;
  const { blocks, ctx, atrM15 } = prepared ?? buildContext(data);
  const seen = new Set();
  const rows = [];
  for (const b of blocks.blocks) {
    let s;
    try { s = buildTradeSetup(b, ctx, opts); } catch { continue; }
    if (!s?.ok) continue;
    const key = `${s.direction}:${s.entry}:${s.stop}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const up = s.direction === "up";
    const from = m5.findIndex((c) => c.time >= s.chain.cisd.time);
    if (from < 0) continue;
    const firstTarget = s.targets?.[0]?.price ?? null;

    let stopped = false, won = false, best = s.entry;
    for (let i = from; i < m5.length; i++) {
      const c = m5[i];
      if (up ? c.high > best : c.low < best) best = up ? c.high : c.low;
      if (up ? c.low <= s.stop : c.high >= s.stop) { stopped = true; break; }
      if (firstTarget != null && (up ? c.high >= firstTarget : c.low <= firstTarget)) { won = true; break; }
    }
    rows.push({
      time: new Date(s.chain.cisd.time * 1000).toISOString().slice(0, 16),
      dir: s.direction,
      entry: s.entry, stop: s.stop, risk: s.risk,
      riskAtr: +(s.risk / (atrAt(atrM15, s.chain.smt.index) || 1)).toFixed(2),
      stopped, won,
      bestR: s.risk > 0 ? +(Math.abs(best - s.entry) / s.risk).toFixed(2) : null,
      barsTracked: m5.length - from,
    });
  }
  return rows;
}

if (import.meta.filename === process.argv[1]) {
  const a = Object.fromEntries(process.argv.slice(2).map((x) => x.split("=")));
  const data = {
    h4: load(a["--h4"]), daily: load(a["--daily"]),
    m15: load(a["--m15"]), m5: load(a["--m5"]), corrM15: load(a["--corr"]),
  };
  console.log(`شموع: H4 ${data.h4.length} · M15 ${data.m15.length} · M5 ${data.m5.length} · مترابط ${data.corrM15.length}`);
  /* ⚠️ التغطية بتنعرض **قبل** أي رقم — بلاها ممكن تنقرا ثقوب البيانات
     كنتيجة منهجية. */
  let holed = false;
  for (const c of coverageReport(data)) {
    const lost = c.gaps.reduce((s2, g) => s2 + g.days, 0);
    if (c.gaps.length) holed = true;
    console.log(`  ${c.label.padEnd(12)} ${String(c.candles).padStart(6)} شمعة · ${c.coveredDays} يوم من ${c.spanDays}` +
      (c.gaps.length ? `  ⚠️ ${c.gaps.length} فجوة (${lost.toFixed(0)} يوم ضايع)` : "  ✓ بلا فجوات"));
  }
  if (holed) console.log("\n⚠️ في فجوات — الأرقام تحت **ما بتمثّل** المنهجية، بتمثّل نقص البيانات.\n");
  const prepared = buildContext(data);
  console.log(`كتل: ${prepared.blocks.blocks.length}\n`);
  console.log("التركيبة".padEnd(22) + "صفقات  نجت  انضربت   وسيط المخاطرة   وسيط أقصى ربح");
  for (const v of VARIANTS) {
    const rows = runVariant(data, v, prepared);
    if (!rows.length) { console.log(v.id.padEnd(22) + "  ولا صفقة"); continue; }
    const survived = rows.filter((r) => !r.stopped).length;
    const med = (xs) => { const s = [...xs].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
    console.log(
      v.id.padEnd(22) + String(rows.length).padStart(5) + String(survived).padStart(6) +
      String(rows.length - survived).padStart(8) +
      (med(rows.map((r) => r.riskAtr)).toFixed(2) + "× ATR").padStart(15) +
      (med(rows.map((r) => r.bestR ?? 0)).toFixed(1) + "R").padStart(15)
    );
  }
  console.log("\n⚠️ أرقام وصفية. اختيار تركيبة منها بلا قرار صاحب المنهجية = تعيير على العيّنة.");
}
