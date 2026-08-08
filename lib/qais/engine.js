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

import { analyzeStructure, priceLocation, getMainMoveWindow, getAllMSSLegs, nearestSwingTarget } from "./structure.js";
import { analyzeLiquidity } from "./liquidity.js";
import { analyzeOrderBlock, scanLegOrderBlocks, scanAllLegsOrderBlocks, findLiveOBAtPrice } from "./orderblock.js";
import { analyzeSequence, analyzeSequenceLayers, pickPrimaryLayer, resolveSequence, findBiggestSequence, findLastTrade } from "./sequence.js";
import { analyzeSMT, getCorrelatedSymbol } from "./smt.js";
import { makeDecision } from "./decision.js";
import { toWeeklyCandles, toMonthlyCandles } from "./timeframe-utils.js";
import { getMarketSession } from "./session.js";
import { STRUCTURE_FRAME_ORDER, EXECUTION_FRAME_ORDER, SEQUENCE_PRIORITY, SMT_FRAME_ORDER } from "./config.js";

const MIN_CANDLES = 30;
const STATUS_RANK = { Strong: 3, Normal: 2, Weak: 1 }; // Invalid غير مؤهّل أصلاً (eligible=false منطقياً بالقرار)

function enoughData(candles) {
  return Array.isArray(candles) && candles.length >= MIN_CANDLES;
}

/* Smart Market Radar v2 (إضافي): تأكيد الحجم — حجم آخر شمعة أعلى بوضوح من
   متوسط آخر 20 شمعة على فريم التنفيذ. لو ما في بيانات حجم (بعض رموز الفوركس
   عند يوهو ما بترجع volume)، منرجع false بأمان بدل ما نكسر السكور. */
function checkVolumeConfirmed(candles) {
  if (!Array.isArray(candles) || candles.length < 21) return false;
  const period = candles.slice(-21, -1);
  const hasVolume = period.some((c) => (c.volume || 0) > 0);
  if (!hasVolume) return false;
  const avg = period.reduce((s, c) => s + (c.volume || 0), 0) / period.length;
  const last = candles[candles.length - 1].volume || 0;
  return avg > 0 && last >= avg * 1.2;
}

/**
 * @param {object} params
 * @param {string} params.symbol
 * @param {object} params.candlesByTF - { daily, h4, h1, m15, m5 } كل واحدة array من الشموع (تصاعدي)
 * @param {object} [params.correlated] - { symbol, candlesByTF } للأصل المترابط (لـ SMT)، اختياري
 * @param {object} [params.previousState] - آخر حالة محفوظة لنفس الرمز (لمعرفة الأحمر = "كانت جاهزة وانتهت")
 * @param {object|null} [params.newsBlocked] - نتيجة economic-calendar.getActiveNewsBlock() الجاهزة
 *   (أو null إذا ما في خبر مهم قريب). توثيق RADAR الجديد، الفصل ٩: "لا يسمح النظام
 *   بفتح أي صفقة أثناء صدور الأخبار الاقتصادية المهمة، بغض النظر عن اكتمال باقي الشروط".
 */
export function analyzeSymbol({ symbol, candlesByTF, correlated = null, previousState = null, newsBlocked = null }) {
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

  // -------- 4) POI مقيّدة بالساق الفعّالة (MSS→للأمام) على الفريم الرئيسي فقط (خامساً) --------
  const window = getMainMoveWindow(mainStruct, mainCandles.length);
  const liquidity = analyzeLiquidity(mainCandles, mainStruct, window);

  // -------- 4.ب) "ذاكرة" الـ OB: كل الـ OBs الصالحة جوا الساق الفعّالة على
  // الفريم الرئيسي (Daily/H4/H1) — مش بس أول وحدة السعر لامسها هلق. أي OB
  // هون بيضل بالقائمة (ومتفاعل معه محتمَل) حتى لو مر عليه وقت طويل، لغاية
  // ما ينلغى فعلياً بإغلاق سعر خلف حد إبطاله (levels.invalidation). --------
  // -------- 4.ب) "ذاكرة" الـ OB الكاملة: كل الـ OBs الصالحة عبر *كل* السيقان
  // التاريخية (مش بس الساق الفعّالة الحالية) على الفريم الرئيسي (Daily/H4/H1).
  // لو صار MSS جديد وساق جديدة، الـ OBs الصالحة من السيقان القديمة بتضل
  // بالقائمة (طالما ما انلغت سعرياً)، وممكن السعر يرجعلها ويتفاعل معها حتى
  // لو بعد سيقان وMSS تاليين كتار. --------
  const mssLegs = getAllMSSLegs(mainCandles, mainStruct);
  const htfOrderBlocks = mssLegs.length
    ? scanAllLegsOrderBlocks(mainCandles, mssLegs, liquidity.fvgs)
    : window
      ? scanLegOrderBlocks(mainCandles, window, liquidity.fvgs)
      : [];
  const liveHtfOB = findLiveOBAtPrice(htfOrderBlocks, mainCandles[mainCandles.length - 1].close);

  // -------- 5) مكان السعر بالنسبة لفيبوناتشي (سادساً) --------
  const pLoc = priceLocation(mainCandles, mainStruct);

  // -------- 6) SMT (توثيق RADAR الجديد، الفصل ٥/٦): "وجود SMT مؤكد على 1H أو 15M" --------
  // نفحص H1 أولاً (أقوى/أوثق حسب SMT_FRAME_ORDER)، وإذا ما تأكد ننزل لـ 15M —
  // أي واحد من الفريمين يكفي لاعتماد SMT (شرط "أو" مش "و" بالتوثيق).
  let smt = null;
  if (correlated?.candlesByTF) {
    for (const tf of SMT_FRAME_ORDER) {
      const selfCandles = candlesByTF[tf];
      const corrCandles = correlated.candlesByTF[tf];
      if (!enoughData(selfCandles) || !enoughData(corrCandles)) continue;
      const structSelf = tf === "h1" && structByTF.h1 ? structByTF.h1 : analyzeStructure(selfCandles);
      const structCorr = analyzeStructure(corrCandles);
      const attempt = analyzeSMT(symbol, structSelf, correlated.symbol, structCorr, { timeframe: tf });
      if (attempt?.valid) {
        smt = attempt;
        break;
      }
      if (!smt) smt = attempt; // نحتفظ بآخر محاولة (حتى لو غير صالحة) لعرض السبب لو الكل فشل
    }
  }

  // -------- 7) OB على فريم تنفيذ أصغر — فقط بعد ما السعر يوصل POI (تاسعاً + رابع عشر) --------
  let ob = { eligible: false, reason: "لم يصل السعر بعد إلى POI ضمن الساق الفعّالة (MSS→للأمام) — لا داعي للبحث عن OB" };
  let obTF = null;
  const poiTriggered = liquidity.touchedZone || liveHtfOB;
  if (poiTriggered) {
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
  const sequenceLayersByTF = {};
  const sequencesByTF = {};
  if (structByTF.h4) {
    sequenceLayersByTF.h4 = analyzeSequenceLayers(h4, structByTF.h4);
    sequencesByTF.h4 = pickPrimaryLayer(sequenceLayersByTF.h4) || analyzeSequence(h4, structByTF.h4);
  }
  if (structByTF.daily) {
    sequenceLayersByTF.daily = analyzeSequenceLayers(daily, structByTF.daily);
    sequencesByTF.daily = pickPrimaryLayer(sequenceLayersByTF.daily) || analyzeSequence(daily, structByTF.daily);
  }
  if (obTF) {
    const execStruct = analyzeStructure(candlesByTF[obTF]);
    sequenceLayersByTF.execution = analyzeSequenceLayers(candlesByTF[obTF], execStruct);
    sequencesByTF.execution = pickPrimaryLayer(sequenceLayersByTF.execution) || analyzeSequence(candlesByTF[obTF], execStruct);
  } else if (enoughData(m15)) {
    const execStruct = analyzeStructure(m15);
    sequenceLayersByTF.execution = analyzeSequenceLayers(m15, execStruct);
    sequencesByTF.execution = pickPrimaryLayer(sequenceLayersByTF.execution) || analyzeSequence(m15, execStruct);
  }
  // اتجاه الصفقة المعتمد (trend) لازم يكون هو نفسه اتجاه أي سيكونز نعرضه —
  // وإلا ممكن تُبنى أهداف BUY لصفقة SELL (أو العكس) لو الفريم صاحب الأولوية
  // (4H مثلاً) عنده هيكلية بعكس اتجاه الفريم الرئيسي المعتمد.
  const sequence = resolveSequence(sequencesByTF, SEQUENCE_PRIORITY, trend);
  // "execution" مش فريم حقيقي — نترجمه لفريم العرض الفعلي (obTF أو m15) عشان
  // الواجهة تعرف بالضبط فوق أي شموع تقع نقاط A/B/C فعلياً (لرسم دقيق 100%)
  if (sequence.sourceTF === "execution") sequence.displayTF = obTF || "m15";
  else if (sequence.sourceTF) sequence.displayTF = sequence.sourceTF;

  const wasActiveBefore = previousState?.status === "green" || previousState?.status === "orange";

  // -------- Smart Market Radar v2 (إضافي بالكامل — ما بيغيّر أي حساب فوق) --------
  const mainIdx = STRUCTURE_FRAME_ORDER.indexOf(mainTF);
  const htfKey = mainIdx > 0 ? STRUCTURE_FRAME_ORDER[mainIdx - 1] : "weekly";
  const htfStruct = mainIdx > 0 ? structByTF[htfKey] : structWeekly;
  const htfTrend = htfStruct?.trend || trend;
  const htfAligned = !!trend && !!htfTrend && trend === htfTrend;
  const marketStructure = trend === "up" ? "Bullish (HH / HL)" : trend === "down" ? "Bearish (LH / LL)" : "Ranging";
  const session = getMarketSession(new Date());
  const volumeConfirmed = checkVolumeConfirmed(enoughData(m15) ? m15 : mainCandles);

  // -------- TP1 واقعي (أقرب قمة/قاع فعلي) + أكبر سيكونز مؤكَّدة تاريخياً
  // (مبدأ المتوروشكا) — للحالات يلي فيها دخول صالح من OB بينما لسا ما
  // تشكّلت سيكونز جديدة بالساق الحالية (خصوصاً مباشرة بعد MSS) --------
  /* آخر صفقة كاملة تكوّنت فعلياً على فريم العرض — مستخرجة من التاريخ مباشرة
     (بدون تخزين)، بتتعرض على الشارت حتى لو حققت أهدافها. منحسبها على نفس
     فريم عرض السيكونز حتى تنرسم فوق نفس الشموع. */
  const lastTradeTF = sequence.displayTF || mainTF;
  const lastTradeCandles = candlesByTF[lastTradeTF];
  const lastTrade =
    lastTradeCandles?.length && structByTF[lastTradeTF]
      ? findLastTrade(lastTradeCandles, structByTF[lastTradeTF])
      : null;
  if (lastTrade) lastTrade.displayTF = lastTradeTF;

  const nearestPeak = trend ? nearestSwingTarget(mainStruct?.swings, trend, mainCandles[mainCandles.length - 1]?.close) : null;
  const biggestSequence = trend ? findBiggestSequence(mainCandles, mainStruct, trend) : null;

  const decision = makeDecision(mainCandles, {
    trend,
    priceLocation: pLoc,
    liquidity,
    ob,
    sequence,
    sequenceLayers: sequence.sourceTF ? sequenceLayersByTF[sequence.sourceTF] || [] : [],
    nearestPeak,
    biggestSequence,
    smt,
    bosConfirmed: !!mainStruct?.lastBOS,
    mssConfirmed: !!mainStruct?.lastMSS,
    wasActiveBefore,
    // -------- v2 --------
    htfTrend,
    htfAligned,
    marketStructure,
    session,
    volumeConfirmed,
    newsBlocked, // الفصل ٩ — فلتر الأخبار الاقتصادية
  });

  const lastCandle = mainCandles[mainCandles.length - 1];

  return {
    symbol,
    price: lastCandle.close,
    mainTimeframe: mainTF,
    executionTimeframe: obTF,
    timeframe: obTF || mainTF, // توافقاً مع أي كود قديم بيقرأ result.timeframe
    structureLadder,
    lastTrade, // آخر صفقة كاملة تكوّنت تاريخياً — للعرض على الشارت
    context: {
      weekly: structWeekly ? { trend: structWeekly.trend, hasBOS: !!structWeekly.lastBOS } : null,
      monthly: structMonthly ? { trend: structMonthly.trend, hasBOS: !!structMonthly.lastBOS } : null,
    },
    poi: {
      window,
      touchedZone: liquidity.touchedZone,
      rankedZones: liquidity.rankedZones?.slice(0, 8) || [],
      htfOrderBlocks, // كل الـ OBs الصالحة جوا الساق الفعّالة على mainTF — "الذاكرة"
      liveHtfOB, // الـ OB (لو وجد) اللي السعر الحالي جواه هلق
    },
    updatedAt: new Date().toISOString(),
    ...decision,
  };
}

export { getCorrelatedSymbol };
