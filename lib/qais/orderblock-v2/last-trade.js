/* ============================================================================
   lib/qais/orderblock-v2/last-trade.js
   آخر صفقة كاملة تكوّنت تاريخياً — على المحرك الجديد.

   ---------------------------------------------------------------------------
   ⚠️ ليش انبنت: **الصفقة كانت تطلع صغيرة**.

   صاحب المنهجية وقف على صفقة ذهب: دخول 4036.10 وTP5 عند 4132.90 — يعني
   ٩٦.٨ نقطة لآخر هدف، بينما السعر فعلياً راح من 4036 لـ4554 (٥١٨ نقطة).
   خمسة أهداف كلها تحت خُمس الحركة.

   السبب: `findLastTrade` بالوحدة القديمة بتاخد `bos.swingA/swingB/swingC`
   من `lib/qais/structure.js`، و`legLength = |swingB − swingA|`. وذاك
   المحرك بيطلّع سوينغ كل ٤.٨ شمعة (١٥٧ على ٧٥٣). فالساق بتنبني على
   تعرّج مجهري، والأهداف = الساق × النسبة، فبتطلع كلها قريبة.

   مقيس على نافذة متحركة:
       ذهب H1    · القديم وسيط 3.42× ATR  ·  الجديد 5.23×  (أطول ١.٥×)
       ناسداك H4 · القديم وسيط 2.94× ATR  ·  الجديد 5.78×  (أطول ٢.٠×)

   ⚠️ الفرق بالوسيط ما بيفسّر وحده ساقاً بـ0.55× ATR. حالته أضعف من أدنى
   ساق مقيسة بالمحرك القديم (1.26×) — يعني في احتمال حالة حدّية إضافية
   بالمسار القديم. النقل هون بيشيل السبب البنيوي؛ الحالة الحدّية بتنقفل
   لما نشوف الصفقة بالضبط.

   ⚠️ الفرق عن `buildTradeSetup`: هاي **تاريخية**.
   ---------------------------------------------------------------------------
   `buildTradeSetup` بتجاوب «في صفقة الآن؟». هاي بتجاوب «شو آخر صفقة
   تكوّنت؟» — فبتمشي على الكتل من الأحدث للأقدم وبتشغّل السلسلة عند
   **وقتها هي**، مش عند آخر شمعة. تشغيلها عند الآخر بيعطي صفقة ما كانت
   معروفة وقتها.
   ============================================================================ */

import { analyzeStructureV2 } from "../structure/index.js";
import { analyzeOrderBlocksSK } from "./rules-sk.js";
import { buildTradeSetup } from "./trade-setup.js";
import { analyzeSequenceV2 } from "./sequence-v2.js";

export const LAST_TRADE_DEFAULTS = {
  /* أقصى كتل بتنفحص — من الأحدث. بلا سقف بتثقّل الكرون.
     ⚠️ كان ٢٠ وكتلة صاحب المنهجية المتحقَّقة طلعت برّاه (هي ضمن ٦٥ كتلة،
     وترتيبها بالتأكيد بعد العشرين الأولى) — فـ`findLastTradeV2` رجّعت
     «ما في صفقة» بينما السلسلة الحيّة كانت شايفتها. مساوٍ لـmaxChainEval
     بالمُهايئ عشان الاتنين يشوفوا نفس المجموعة. */
  maxBlocks: 40,
  minCandles: 60,
};

/**
 * @param ctx نفس سياق `buildTradeSetup` (candles · structure · thirdContextFor · lower · correlateLower · structureOf)
 * @returns {{ ok, trade, outcome }|{ ok:false, reason }}
 */
export function findLastTradeV2(ctx, options = {}) {
  const cfg = { ...LAST_TRADE_DEFAULTS, ...options };
  const { candles, structure } = ctx;
  if (!Array.isArray(candles) || candles.length < cfg.minCandles) {
    return { ok: false, reason: `شموع أقل من ${cfg.minCandles}` };
  }

  const st = structure ?? analyzeStructureV2(candles, { timeframe: ctx.timeframe ?? null });
  const blocks = analyzeOrderBlocksSK(candles, { timeframe: ctx.timeframe ?? null, structure: st });
  if (!blocks.ok) return { ok: false, reason: blocks.reason };

  /* من الأحدث للأقدم — أول وحدة أعطت صفقة هي المطلوبة. */
  const ordered = [...blocks.blocks].sort((a, b) => b.confirmedAtIndex - a.confirmedAtIndex).slice(0, cfg.maxBlocks);

  for (const b of ordered) {
    let setup;
    try {
      /* ⚠️ التشغيل عند وقت الكتلة نفسها — مش عند آخر شمعة. */
      setup = buildTradeSetup(b, { ...ctx, structure: st, asOfIndex: candles.length - 1 }, options);
    } catch (e) {
      continue;
    }
    if (!setup?.ok) continue;

    /* ── مصير الصفقة بعد الدخول ─────────────────────────────────── */
    const dirUp = setup.direction === "up";
    const entryIdx = candles.findIndex((c) => c.time >= setup.chain.cisd.time);
    const from = entryIdx < 0 ? setup.chain.touch.index : entryIdx;

    let stoppedAt = null;
    for (let i = from + 1; i < candles.length; i++) {
      const c = candles[i];
      const hitStop = dirUp ? c.low <= setup.stop : c.high >= setup.stop;
      if (hitStop) { stoppedAt = i; break; }
    }
    const scanEnd = stoppedAt == null ? candles.length - 1 : stoppedAt;

    /* الأهداف المحققة قبل الستوب. `null` لو ما في أهداف — مش صفر. */
    let reached = null;
    if (setup.targets) {
      reached = [];
      for (const t of setup.targets) {
        let hitIdx = null;
        for (let i = from; i <= scanEnd; i++) {
          const c = candles[i];
          if (dirUp ? c.high >= t.price : c.low <= t.price) { hitIdx = i; break; }
        }
        reached.push({ key: t.key, price: t.price, hit: hitIdx != null, atIndex: hitIdx, atTime: hitIdx != null ? candles[hitIdx].time : null });
      }
    }

    /* أقصى امتداد فعلي — بيبيّن لو الأهداف كانت أقصر من الحركة. */
    let extreme = dirUp ? -Infinity : Infinity;
    for (let i = from; i <= scanEnd; i++) {
      const c = candles[i];
      if (dirUp ? c.high > extreme : c.low < extreme) extreme = dirUp ? c.high : c.low;
    }
    const moved = Math.abs(extreme - setup.entry);
    const lastTarget = setup.targets ? setup.targets[setup.targets.length - 1] : null;

    return {
      ok: true,
      trade: setup,
      outcome: {
        entryIndex: from,
        entryTime: candles[from].time,
        stopped: stoppedAt != null,
        stoppedAtIndex: stoppedAt,
        stoppedAtTime: stoppedAt != null ? candles[stoppedAt].time : null,
        targetsReached: reached,
        reachedCount: reached ? reached.filter((t) => t.hit).length : null,
        /* ⚠️ الرقم اللي بيكشف الأهداف القصيرة: كم تحرّك السعر فعلاً مقابل
           أبعد هدف. لو النسبة كبيرة، الأهداف ما بتغطي الحركة. */
        maxFavorableMove: +moved.toFixed(5),
        lastTargetDistance: lastTarget ? +Math.abs(lastTarget.price - setup.entry).toFixed(5) : null,
        moveVsLastTarget: lastTarget && Math.abs(lastTarget.price - setup.entry) > 0
          ? +(moved / Math.abs(lastTarget.price - setup.entry)).toFixed(2)
          : null,
        riskReward: setup.risk > 0 ? +(moved / setup.risk).toFixed(2) : null,
      },
    };
  }

  return { ok: false, reason: `ما في صفقة كاملة بآخر ${ordered.length} كتلة` };
}
