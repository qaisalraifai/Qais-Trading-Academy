/* ============================================================================
   verify/stop-buffer.mjs
   قياس: قدّيش هامش كان **لازم** تحت نقطة الـSMT لكل حالة مكتملة.

   ---------------------------------------------------------------------------
   ⚠️ هالسكربت بيقيس بس. **ما بيثبّت رقماً ولا بيعدّل المحرك.**
   قراره (٢٠٢٦-٠٨-٢٠): «اجمع الحالات المكتملة من العيّنة، احسب المضاعف
   الفعلي لكل حالة، ثم اعرض لي النتائج والتوزيع قبل تثبيت أي قاعدة.»

   ---------------------------------------------------------------------------
   تعريف «المضاعف الفعلي» — مصرَّح فيه لأنه **اختيار قياس مش قاعدة**:

         requiredBuffer = |smtPoint − أقصى امتداد معاكس بعد الدخول|
         requiredMult   = requiredBuffer / ATR(فريم الـSMT عند لحظة الـSMT)

   الامتداد بينقاس على **M5** من شمعة الدخول **نفسها** لآخر البيانات.

   ⚠️ نسختان سابقتان من هالقياس كانتا غلط — وانصلحتا:

     ١) كان بيبلّش من `entryIndex + 1` فبيتخطّى شمعة الدخول. على الكتلة
        المتحقَّقة، القاع 27,063.33 صار **بنفس شمعة الدخول** — فطلع إنه
        هامش 1.00× ATR «نجا»، والحقيقة إنه انضرب هو كمان. الرقم الوحيد
        اللي كان يبان دليلاً لصالح 1× كان من هالتخطّي.

     ٢) كان بيستثني الحالات اللي «ما رجعت لهدف» — بس الحالتين المقيستين
        **بلا أهداف أصلاً** (`targets: null`)، فمعيار النجاح ما بينطبق
        عليهن وبينستثنوا آلياً. يعني الاستثناء كان بيفضي القياس بدل ما
        يصفّيه. صار بينعرض الكل، والنتيجة بتنكتب جنب كل حالة.

   ⚠️ بلا أهداف ما في «لحد وين» طبيعية للقياس، فالامتداد بينقاس لآخر
   البيانات المتاحة — وهاد بيضخّم الرقم. بينتسجّل عدد الشموع عشان يبان.
   ============================================================================ */

import fs from "node:fs";
import path from "node:path";
import { analyzeStructureV2 } from "../../structure/index.js";
import { atrSeries, atrAt } from "../../structure/atr.js";
import { analyzeOrderBlocksSK } from "../rules-sk.js";
import { buildTradeSetup } from "../trade-setup.js";

const FX = path.join(import.meta.dirname, "fixtures");
const load = (f) => JSON.parse(fs.readFileSync(path.join(FX, f), "utf8")).candles;

/**
 * @param data { h4, daily, m15, m5, corrM15 }
 * @returns { cases, excluded, note }
 */
export function measureStopBuffer(data) {
  const { h4, daily, m15, m5, corrM15 } = data;
  const st = analyzeStructureV2(h4, { timeframe: "h4" });
  const stD = analyzeStructureV2(daily, { timeframe: "daily" });
  const blocks = analyzeOrderBlocksSK(h4, { timeframe: "h4", structure: st });

  const alignD = (t) => {
    let lo = 0, hi = daily.length - 1, best = 0;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (daily[m].time <= t) { best = m; lo = m + 1; } else hi = m - 1; }
    return best;
  };

  const ctx = {
    candles: h4,
    structure: st,
    thirdContextFor: (i) => [
      { timeframe: "h4", majorSwings: st.majorSwings, asOfIndex: i },
      { timeframe: "daily", majorSwings: stD.majorSwings, asOfIndex: alignD(h4[i].time) },
    ],
    lower: { candles: m15, timeframe: "m15" },
    correlateLower: { candles: corrM15 },
    cisdFrame: { candles: m5, timeframe: "m5" },
    structureOf: (c) => analyzeStructureV2(c, { timeframe: "m15" }),
  };

  const atrM15 = atrSeries(m15, 14);
  const cases = [];
  const excluded = [];
  const seen = new Set();

  for (const b of blocks.blocks) {
    let s;
    /* ⚠️ الهامش صفر بالقياس عمداً — بدنا نشوف السلوك **بلا** هامش عشان
       نعرف قدّيش كان لازم. تشغيله بهامش بيخبّي اللي بنقيسه. */
    try { s = buildTradeSetup(b, ctx, { stopBufferAtrMult: 0 }); } catch { continue; }
    if (!s?.ok) continue;

    /* صفقات متطابقة من كتل مختلفة = نفس الحالة، ما بتنعدّ مرتين. */
    const key = `${s.direction}:${s.entry}:${s.stop}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const up = s.direction === "up";
    const smtPoint = s.chain.smt.point;
    const atr = atrAt(atrM15, s.chain.smt.index);
    if (!Number.isFinite(atr) || atr <= 0) continue;

    /* التتبّع على M5 — أدق فريم متوفّر، فبيمسك الاختراق اللحظي. */
    const from = m5.findIndex((c) => c.time >= s.chain.cisd.time);
    if (from < 0) continue;

    const firstTarget = s.targets?.[0]?.price ?? null;
    let worst = smtPoint;          // أقصى امتداد معاكس
    let best = s.entry;            // أقصى امتداد مؤاتٍ
    let reachedTarget = false;
    /* ⚠️ `i = from` مش `from + 1` — شمعة الدخول نفسها بتحمل الحركة الحاسمة
       عادةً. تخطّيها كان بيعطي «الهامش نجا» وهو مضروب. */
    for (let i = from; i < m5.length; i++) {
      const c = m5[i];
      if (up ? c.low < worst : c.high > worst) worst = up ? c.low : c.high;
      if (up ? c.high > best : c.low < best) best = up ? c.high : c.low;
      if (firstTarget != null && (up ? c.high >= firstTarget : c.low <= firstTarget)) { reachedTarget = true; break; }
    }

    const requiredBuffer = up ? Math.max(0, smtPoint - worst) : Math.max(0, worst - smtPoint);
    cases.push({
      entryTime: new Date(s.chain.cisd.time * 1000).toISOString().slice(0, 16),
      direction: s.direction,
      entry: s.entry,
      smtPoint,
      worst: +worst.toFixed(2),
      atr: +atr.toFixed(2),
      requiredBuffer: +requiredBuffer.toFixed(2),
      requiredMult: +(requiredBuffer / atr).toFixed(3),
      /* أقصى ربح متاح بوحدات المخاطرة الأصلية — بيبيّن لو الصفقة كانت
         «صح بس ستوبها ضيّق» ولا «غلط أصلاً». */
      bestR: s.risk > 0 ? +(Math.abs(best - s.entry) / s.risk).toFixed(2) : null,
      outcome: firstTarget == null ? "بلا أهداف" : reachedTarget ? "وصلت هدفاً" : "ما وصلت هدفاً",
      barsTracked: m5.length - from,
    });
  }

  return {
    cases,
    excluded,
    blocksScanned: blocks.blocks.length,
    note: null,
  };
}

/* ── تشغيل مباشر ────────────────────────────────────────────────────── */
if (import.meta.filename === process.argv[1]) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")));
  const r = measureStopBuffer({
    h4: load(args["--h4"] ?? "nas100-h4-2026-context.json"),
    daily: load(args["--daily"] ?? "nas100-d1-2024-2026.json"),
    m15: load(args["--m15"] ?? "nas100-m15-2026-07-entry.json"),
    m5: load(args["--m5"] ?? "nas100-m5-2026-07-entry.json"),
    corrM15: load(args["--corr"] ?? "spx500-m15-2026-07-entry.json"),
  });

  console.log(`كتل مفحوصة: ${r.blocksScanned} · حالات مكتملة: ${r.cases.length}\n`);

  if (!r.cases.length) {
    console.log("⚠️ ما في حالة مكتملة — القياس فاضي. ما بينبنى عليه رقم.");
  } else {
    console.log("الوقت              اتجاه   نقطة SMT    أقصى تجاوز    ATR   الهامش   المضاعف  أقصى ربح  النتيجة");
    for (const c of r.cases.sort((a, b) => a.requiredMult - b.requiredMult)) {
      console.log(
        c.entryTime.padEnd(18) + (c.direction === "up" ? "شراء" : "بيع").padEnd(8) +
        c.smtPoint.toFixed(2).padStart(10) + c.worst.toFixed(2).padStart(13) +
        c.atr.toFixed(0).padStart(7) + c.requiredBuffer.toFixed(0).padStart(9) +
        c.requiredMult.toFixed(2).padStart(9) + String(c.bestR ?? "—").padStart(9) + "R  " + c.outcome
      );
    }
    const mults = r.cases.map((c) => c.requiredMult).sort((a, b) => a - b);
    const q = (p) => mults[Math.min(mults.length - 1, Math.floor(p * mults.length))];
    console.log(`\nالتوزيع: أدنى ${mults[0].toFixed(2)} · وسيط ${q(0.5).toFixed(2)} · p90 ${q(0.9).toFixed(2)} · أقصى ${mults[mults.length - 1].toFixed(2)}`);
    console.log(`ما احتاجت هامش أبداً: ${mults.filter((m) => m === 0).length} من ${mults.length}`);
    console.log(`\n⚠️ N = ${mults.length}. ما ينثبّت رقم بلا قرار صاحب المنهجية.`);
  }
}
