/* ============================================================================
   lib/qais/engine.js
   نقطة الدخول الموحّدة لمحرك QAIS SK Engine — Decision Engine مرتّب حسب
   التسلسل الحرفي المطلوب (أولاً + رابع عشر):

     1) الاتجاه والهيكلية الرئيسية (Daily → 4H → 1H، الأولوية للأعلى)
     2) External/Internal Structure (سلّم الفريمات)
     3) BOS/MSS على الهيكل الرئيسي (مُختار تلقائياً = أعلى فريم عنده اتجاه مؤكَّد)
     4) POI مقيّدة بالمنطقة بين آخر MSS وآخر BOS فقط (خامساً)
     5) مكان السعر بالنسبة لفيبوناتشي 0.333/0.5/0.666 (سادساً)
     6) SMT عند الحاجة (سابعاً)
     7) بعد اكتمال الشروط فقط: بحث عن OB على فريم تنفيذ أصغر (تلقائي 15m/5m — ثامناً)
     8) اعتماد الصفقة فقط عند اكتمال كل الشروط (decision.js)
     9) Entry/SL/Targets (تاسعاً + خامس عشر + سادس عشر)
     10) عرض نتيجة نظيفة (شكل المخرجات أدناه)

   Monthly/Weekly تُشتق محلياً من Daily وتُستخدم كسياق فقط (ثانياً) — ما بتدخل
   بقرار الاتجاه الأساسي إلا إذا Daily نفسه غير متوفر إطلاقاً.
   ============================================================================ */

import { analyzeStructure, priceLocation, getMainMoveWindow } from "./structure.js";
import { analyzeLiquidity } from "./liquidity.js";
import { analyzeOrderBlock } from "./orderblock.js";
import { analyzeSequence, resolveSequence } from "./sequence.js";
import { analyzeSMT, getCorrelatedSymbol } from "./smt.js";
import { makeDecision } from "./decision.js";
import { toWeeklyCandles, toMonthlyCandles } from "./timeframe-utils.js";
import { STRUCTURE_FRAME_ORDER, EXECUTION_FRAME_ORDER, SEQUENCE_PRIORITY } from "./config.js";

const MIN_CANDLES = 30;
const STATUS_RANK = { Strong: 3, Normal: 2, Weak: 1 }; // Invalid غير مؤهّل أصلاً (eligible=false منطقياً بالقرار)

function enoughData(candles) {
  return Array.isArray(candles) && candles.length >= MIN_CANDLES;
}

/**
 * @param {object} params
 * @param {string} params.symbol
 * @param {object} params.candlesByTF - { daily, h4, h1, m15, m5 } كل واحدة array من الشموع (تصاعدي)
 * @param {object} [params.correlated] - { symbol, candlesByTF } للأصل المترابط (لـ SMT)، اختياري
 * @param {object} [params.previousState] - آخر حالة محفوظة لنفس الرمز (لمعرفة الأحمر = "كانت جاهزة وانتهت")
 */
export function analyzeSymbol({ symbol, candlesByTF, correlated = null, previousState = null }) {
  const { daily, h4, h1, m15, m5 } = candlesByTF;

  // -------- 1) الهيكلية لكل فريم أساسي متوفر (Daily/4H/1H) --------
  const structByTF = {};
  if (enoughData(daily)) structByTF.daily = analyzeStructure(daily);
  if (enoughData(h4)) structByTF.h4 = analyzeStructure(h4);
  if (enoughData(h1)) structByTF.h1 = analyzeStructure(h1);

  if (!Object.keys(structByTF).length) {
    return { symbol, error: "بيانات غير كافية على أي من فريمات الهيكلية الأساسية (Daily/4H/1H)" };
  }

  // -------- سياق Monthly/Weekly (ثانياً) — مُشتقة محلياً من Daily، للعرض فقط --------
  let structMonthly = null;
  let structWeekly = null;
  if (enoughData(daily)) {
    const weeklyCandles = toWeeklyCandles(daily);
    const monthlyCandles = toMonthlyCandles(daily);
    if (enoughData(weeklyCandles)) structWeekly = analyzeStructure(weeklyCandles);
    if (enoughData(monthlyCandles)) structMonthly = analyzeStructure(monthlyCandles);
  }

  // -------- 2-3) اختيار الفريم الرئيسي (External) + الاتجاه المعتمد (١.٦) --------
  // أولوية صارمة: Daily فأعلى فأول فريم عنده اتجاه مؤكَّد (BOS/MSS فعلي)، مش مجرد بيانات متوفرة
  let mainTF = STRUCTURE_FRAME_ORDER.find((tf) => structByTF[tf]?.trend) || null;
  if (!mainTF) mainTF = STRUCTURE_FRAME_ORDER.find((tf) => structByTF[tf]) || null;

  const mainStruct = structByTF[mainTF];
  const mainCandles = candlesByTF[mainTF];
  const trend = mainStruct?.trend || null;

  // سلّم External/Internal للعرض (Daily=External دايماً لو متوفر، والي تحته Internal بالنسبة إله)
  const structureLadder = STRUCTURE_FRAME_ORDER.filter((tf) => structByTF[tf]).map((tf, i) => ({
    timeframe: tf,
    role: i === 0 ? "external" : "internal",
    trend: structByTF[tf].trend,
    hasBOS: !!structByTF[tf].lastBOS,
    hasMSS: !!structByTF[tf].lastMSS,
    isMain: tf === mainTF,
  }));

  // -------- 4) POI مقيّدة بنطاق آخر MSS↔آخر BOS على الفريم الرئيسي فقط (خامساً) --------
  const window = getMainMoveWindow(mainStruct);
  const liquidity = analyzeLiquidity(mainCandles, mainStruct, window);

  // -------- 5) مكان السعر بالنسبة لفيبوناتشي (سادساً) --------
  const pLoc = priceLocation(mainCandles, mainStruct);

  // -------- 6) SMT (سابعاً) — بفريم H1 (أعلى من الحد الأدنى المفضّل 15m) عند توفر أصل مترابط --------
  let smt = null;
  if (correlated?.candlesByTF?.h1 && enoughData(correlated.candlesByTF.h1) && enoughData(h1)) {
    const structH1Corr = analyzeStructure(correlated.candlesByTF.h1);
    const structH1Self = structByTF.h1 || analyzeStructure(h1);
    smt = analyzeSMT(symbol, structH1Self, correlated.symbol, structH1Corr, { timeframe: "h1" });
  }

  // -------- 7) OB على فريم تنفيذ أصغر — فقط بعد ما السعر يوصل POI (تاسعاً + رابع عشر) --------
  let ob = { eligible: false, reason: "لم يصل السعر بعد إلى POI ضمن نطاق آخر MSS↔BOS — لا داعي للبحث عن OB" };
  let obTF = null;
  if (liquidity.touchedZone) {
    const candidates = [];
    for (const tf of EXECUTION_FRAME_ORDER) {
      const execCandles = candlesByTF[tf];
      if (!enoughData(execCandles)) continue;
      const structExec = analyzeStructure(execCandles);
      const liquidityExec = analyzeLiquidity(execCandles, structExec); // فريم تنفيذ محلي — بدون تقييد نافذة
      const obExec = analyzeOrderBlock(execCandles, structExec, liquidityExec);
      if (obExec.eligible && obExec.status !== "Invalid") {
        candidates.push({ tf, ob: obExec, struct: structExec, candles: execCandles });
      }
    }
    // الاختيار التلقائي (ثامناً): أفضل حالة أولاً، وعند التعادل يفضَّل الفريم الأعلى (15m قبل 5m)
    candidates.sort((a, b) => (STATUS_RANK[b.ob.status] || 0) - (STATUS_RANK[a.ob.status] || 0) ||
      EXECUTION_FRAME_ORDER.indexOf(a.tf) - EXECUTION_FRAME_ORDER.indexOf(b.tf));
    if (candidates.length) {
      ob = candidates[0].ob;
      obTF = candidates[0].tf;
    } else {
      ob = { eligible: false, reason: "وصل السعر لمنطقة POI لكن لم يتشكّل OB مطابق لقواعدي بعد على 15m/5m" };
    }
  }

  // -------- الأهداف (خامس عشر): أولوية 4H ثم Daily ثم موجات فريم التنفيذ --------
  const sequencesByTF = {};
  if (structByTF.h4) sequencesByTF.h4 = analyzeSequence(h4, structByTF.h4);
  if (structByTF.daily) sequencesByTF.daily = analyzeSequence(daily, structByTF.daily);
  if (obTF) sequencesByTF.execution = analyzeSequence(candlesByTF[obTF], analyzeStructure(candlesByTF[obTF]));
  else if (enoughData(m15)) sequencesByTF.execution = analyzeSequence(m15, analyzeStructure(m15));
  const sequence = resolveSequence(sequencesByTF, SEQUENCE_PRIORITY);

  const wasActiveBefore = previousState?.status === "green" || previousState?.status === "orange";

  const decision = makeDecision(mainCandles, {
    trend,
    priceLocation: pLoc,
    liquidity,
    ob,
    sequence,
    smt,
    bosConfirmed: !!mainStruct?.lastBOS,
    mssConfirmed: !!mainStruct?.lastMSS,
    wasActiveBefore,
  });

  const lastCandle = mainCandles[mainCandles.length - 1];

  return {
    symbol,
    price: lastCandle.close,
    mainTimeframe: mainTF,
    executionTimeframe: obTF,
    timeframe: obTF || mainTF, // توافقاً مع أي كود قديم بيقرأ result.timeframe
    structureLadder,
    context: {
      weekly: structWeekly ? { trend: structWeekly.trend, hasBOS: !!structWeekly.lastBOS } : null,
      monthly: structMonthly ? { trend: structMonthly.trend, hasBOS: !!structMonthly.lastBOS } : null,
    },
    poi: {
      window,
      touchedZone: liquidity.touchedZone,
      rankedZones: liquidity.rankedZones?.slice(0, 8) || [],
    },
    updatedAt: new Date().toISOString(),
    ...decision,
  };
}

export { getCorrelatedSymbol };
