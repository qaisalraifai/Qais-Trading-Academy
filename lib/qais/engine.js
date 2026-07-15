/* ============================================================================
   lib/qais/engine.js
   نقطة الدخول الموحّدة لمحرك QAIS SK Engine — بيجمع كل الفصول (1-9) بمحرك واحد
   يرجع نتيجة جاهزة لعرضها على Trading Radar.

   جدول الفريمات المعتمدة (5.5):
     Trend → Daily/H4/H1 | POI → Daily/H4/H1 (الأفضلية للأعلى) | SMT → M15+ | OB → M5/M15

   v1 (تبسيط عملي): بنستخدم H4 كفريم الاتجاه/الـ POI الرئيسي (أعلى فريم متوفر
   لدينا بشكل موثوق عبر Yahoo)، وH1 كفريم مساند، وM15 كفريم التنفيذ/OB/السيولة.
   ============================================================================ */

import { analyzeStructure, priceLocation } from "./structure.js";
import { analyzeLiquidity } from "./liquidity.js";
import { analyzeOrderBlock } from "./orderblock.js";
import { analyzeSequence } from "./sequence.js";
import { analyzeSMT, getCorrelatedSymbol } from "./smt.js";
import { makeDecision } from "./decision.js";

/**
 * @param {object} params
 * @param {string} params.symbol
 * @param {object} params.candlesByTF - { h4, h1, m15 } كل واحدة array من الشموع (تصاعدي)
 * @param {object} [params.correlated] - { symbol, candlesByTF } للأصل المترابط (لـ SMT)، اختياري
 * @param {object} [params.previousState] - آخر حالة محفوظة لنفس الرمز (لمعرفة الأحمر = "كانت جاهزة وانتهت")
 */
export function analyzeSymbol({ symbol, candlesByTF, correlated = null, previousState = null }) {
  const { h4, h1, m15 } = candlesByTF;
  if (!m15 || m15.length < 30) {
    return { symbol, error: "بيانات غير كافية على فريم M15 للتحليل" };
  }

  const structH4 = h4 && h4.length >= 30 ? analyzeStructure(h4) : null;
  const structH1 = h1 && h1.length >= 30 ? analyzeStructure(h1) : null;
  const structM15 = analyzeStructure(m15);

  // 1.6: عند تعارض الفريمات، الأولوية دائماً لاتجاه الفريم الأكبر
  const trend = structH4?.trend || structH1?.trend || null;

  const liquidity = analyzeLiquidity(m15, structM15);
  const ob = analyzeOrderBlock(m15, structM15, liquidity);
  const sequence = analyzeSequence(m15, structM15);
  const pLoc = priceLocation(h4 || h1 || m15, structH4 || structH1 || structM15);

  // SMT (اختياري — بيحتاج بيانات الأصل المترابط بنفس الفريم)
  let smt = null;
  if (correlated?.candlesByTF?.m15?.length >= 30) {
    const structCorrelated = analyzeStructure(correlated.candlesByTF.m15);
    smt = analyzeSMT(symbol, structM15, correlated.symbol, structCorrelated, { timeframe: "m15" });
  }

  const wasActiveBefore = previousState?.status === "green" || previousState?.status === "orange";

  const decision = makeDecision(m15, {
    trend,
    priceLocation: pLoc,
    liquidity,
    ob,
    sequence,
    smt,
    bosConfirmed: !!structM15.lastBOS,
    mssConfirmed: !!structM15.lastMSS,
    wasActiveBefore,
  });

  const lastCandle = m15[m15.length - 1];

  return {
    symbol,
    price: lastCandle.close,
    timeframe: "M15",
    updatedAt: new Date().toISOString(),
    ...decision,
  };
}

export { getCorrelatedSymbol };
