/* ============================================================================
   lib/qais/liquidity-v2/swing-levels.js
   سيولة السوينغات: أوامر مركونة فوق كل قمة خارجية مؤكَّدة وتحت كل قاع.

   المصدر: `majorSwings` من محرك الهيكل — سوينغات ناجية من فلتر ٣× ATR ومثبّتة
   بزجزاج تأكيد ما بيتراجع. `confirmedAtIndex` جاهز عليها، فبوابة السببية
   بتنقرا مباشرة بدون إعادة حساب.

   ليش الخارجي بس (وليش الداخلي وراء علم):
   ---------------------------------------------------------------------------
   كل بيفوت داخلي كمان فوقه ستوبات، بس عددهم بالمئات على أي عيّنة، فقائمة
   «كل بركة سيولة» بتصير ضجيج ما بينقرا. الافتراضي: الخارجي فقط. الداخلي
   بينفتح بعلم `includeInternal` لمين بده يقيس، مع توسيم `scale` حتى ما
   ينخلطوا بالعدّ.
   ============================================================================ */

import { atrAtCausal } from "./atr-causal.js";
import { makePool, meanOfAvailable, strengthFromLegAtr } from "./pool.js";

/**
 * @param candles
 * @param swings   majorSwings (أو internalSwings لما includeInternal)
 * @param options  { atr, lookback, timeframe, scale }
 */
export function detectSwingLevels(candles, swings, options = {}) {
  const { atr, lookback = 2, timeframe = null, scale = "major" } = options;
  const pools = [];
  const skipped = [];

  if (!Array.isArray(swings) || !swings.length) return { pools, skipped };

  for (const s of swings) {
    const availableFromIndex = Number.isFinite(s.confirmedAtIndex) ? s.confirmedAtIndex : s.index + lookback;
    if (availableFromIndex >= candles.length) {
      skipped.push({
        index: s.index,
        time: s.time,
        price: s.price,
        why: "السوينغ ما تأكد ضمن البيانات المتوفرة — ما بيصير مستوى قابل للتفاعل",
      });
      continue;
    }

    const side = s.type === "high" ? "buy" : "sell";
    const atrVal = atrAtCausal(atr, s.index);
    /* طول الساق الواصلة للسوينغ بوحدة ATR = «قدّيش المستوى مهم». محسوبة
       بالهيكل (`legLength`) وبنعيد تطبيعها بتقلب لحظة السوينغ. أول سوينغ
       خارجي ما إله ساق داخلة مقيسة → null مش صفر. */
    const legAtr = s.legLength != null && atrVal ? s.legLength / atrVal : null;

    pools.push(
      makePool({
        type: s.type === "high" ? "SwingHigh" : "SwingLow",
        side,
        price: s.price,
        time: s.time,
        index: s.index,
        timeframe,
        availableFromIndex,
        strength: strengthFromLegAtr(legAtr),
        measure: {
          legLength: s.legLength ?? null,
          legAtr: legAtr != null ? +legAtr.toFixed(3) : null,
          atrAtSwing: atrVal != null ? +atrVal.toFixed(5) : null,
          confirmedAtIndex: availableFromIndex,
        },
        source: {
          kind: "structureSwing",
          scale,
          label: s.label ?? null,
          isAnchor: !!s.isAnchor,
          index: s.index,
          time: s.time,
        },
        reason:
          `سيولة ${side === "buy" ? "شراء فوق" : "بيع تحت"} سوينغ ${scale === "major" ? "خارجي" : "داخلي"}` +
          `${s.label ? ` (${s.label})` : ""} عند ${Number(s.price).toFixed(2)}` +
          (legAtr != null ? ` — الساق الواصلة له ${legAtr.toFixed(2)}× ATR` : " — أول سوينغ بالنطاق، ما إله ساق مقيسة"),
        /* الثقة من دليل واحد متوفر (دلالة الساق). ما في ساق مقيسة = ما في
           ثقة — null، مش نص ولا صفر. */
        confidence: legAtr != null ? meanOfAvailable([Math.min(1, legAtr / 6)]) : null,
        extra: { scale },
      })
    );
  }

  pools.sort((a, b) => a.availableFromIndex - b.availableFromIndex || a.price - b.price);
  return { pools, skipped };
}
