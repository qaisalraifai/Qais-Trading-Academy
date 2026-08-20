/* ============================================================================
   lib/qais/orderblock-v2/adapter.js
   مُهايئ: بيشغّل سلسلة QAIS SK الجديدة من نفس مدخلات `analyzeSymbol`.

   ---------------------------------------------------------------------------
   ⚠️ **تشغيل موازٍ، مش استبدال.**

   `analyzeSymbol` بيغذّي الكرون ولوحتين، والواجهة بتقرا من مخرجه بآلاف
   الأسطر. استبدال المحركات القديمة دفعة وحدة بيغيّر كل اللي بيشوفه
   المستخدمون بضربة، وبلا مرجع للمقارنة.

   فالمُهايئ بيضيف حقلاً **جديداً** (`skV2`) جنب المخرج القائم بلا ما يلمس
   ولا حقل موجود. هيك بينعرض الاتنين جنب بعض، وبينقارنوا على بيانات حقيقية،
   وبعدها بينقرر التبديل — مش قبله.

   ⚠️ ما بيرمي أبداً.
   ---------------------------------------------------------------------------
   بيشتغل جوّا المحلّل الحيّ. أي استثناء هون بيكسر التحليل كله لكل الرموز.
   كل شي مغلّف، وأي نقص بيرجع `INSUFFICIENT_DATA` مع سبب.

   ⚠️ مسقوف بالأداء.
   ---------------------------------------------------------------------------
   `analyzeOrderBlocksSK` على آلاف الشموع + سلسلة كاملة لكل كتلة بيثقّل
   الكرون. فبينفحص **الكتل الحديثة الحيّة** بس (`maxBlocks` من الأحدث).
   ============================================================================ */

import { analyzeStructureV2 } from "../structure/index.js";
import { analyzeOrderBlocksSK } from "./rules-sk.js";
import { buildTradeSetup } from "./trade-setup.js";
import { findLastTradeV2 } from "./last-trade.js";
import { blockReadiness } from "./readiness.js";

export const ADAPTER_DEFAULTS = {
  /* فريم الكتل. الثلث بيستعمله مع اليومي. */
  blockTF: "h4",
  /* فريم الـSMT. */
  entryTF: "m15",
  /* فريم الـCISD — منفصل بقرار صريح: SMT على M15 وCISD على M5. */
  cisdTF: "m5",
  /* ⚠️ سقف بتقييم **السلسلة** — مش بعرض الكتل.
     -----------------------------------------------------------------
     كان ٥ وبيقصّ من الأحدث، فكتلة صاحب المنهجية المتحقَّقة (٢٨ أبريل،
     MT 27137.49) اختفت: هي رقم ١٣ من ١٨ كتلة حيّة. وهي بالضبط الكتلة
     اللي انتظرت ٦٨ يوم قبل ما تصير صفقة — يعني القصّ كان بيرمي أهم
     حالة بالمنهجية.

     الكتل الحيّة **كلها** بتنعرض. السقف بيحدّ تقييم السلسلة الكاملة
     (SMT + CISD لكل كتلة) لأنه هو الثقيل. */
  maxChainEval: 40,
  minCandles: 60,
};

const insufficient = (why) => ({ ok: false, value: "INSUFFICIENT_DATA", why });

/**
 * @param candlesByTF { daily, h4, h1, m15, m5 }
 * @param correlatedByTF نفس الشكل للأصل المترابط — اختياري
 */
export function runSkV2({ symbol, candlesByTF, correlatedByTF = null }, options = {}) {
  const cfg = { ...ADAPTER_DEFAULTS, ...options };
  try {
    const block = candlesByTF?.[cfg.blockTF];
    const daily = candlesByTF?.daily;
    const lower = candlesByTF?.[cfg.entryTF];

    if (!Array.isArray(block) || block.length < cfg.minCandles) {
      return insufficient(`شموع ${cfg.blockTF} أقل من ${cfg.minCandles}`);
    }

    const structure = analyzeStructureV2(block, { timeframe: cfg.blockTF });
    const blocks = analyzeOrderBlocksSK(block, { timeframe: cfg.blockTF, structure });
    if (!blocks.ok) return { ok: false, reason: blocks.reason, blocks: [], setups: [] };

    /* ── سياق الثلث: فريم الكتلة + اليومي (قراره «ج») ─────────────── */
    let thirdContextFor = null;
    let dailyNote = null;
    if (Array.isArray(daily) && daily.length >= 30) {
      const stD = analyzeStructureV2(daily, { timeframe: "daily" });
      const alignD = (t) => {
        let lo = 0, hi = daily.length - 1, best = 0;
        while (lo <= hi) { const m = (lo + hi) >> 1; if (daily[m].time <= t) { best = m; lo = m + 1; } else hi = m - 1; }
        return best;
      };
      thirdContextFor = (i) => [
        { timeframe: cfg.blockTF, majorSwings: structure.majorSwings, asOfIndex: i },
        { timeframe: "daily", majorSwings: stD.majorSwings, asOfIndex: alignD(block[i].time) },
      ];
    } else {
      /* ⚠️ بلا يومي، R8 بتنقاس على فريم واحد — وهاد **مخالف لقراره**
         («الاتنين»). بينتسجّل بدل ما ينمرّ بصمت. */
      dailyNote = "ما في شموع يومية كافية — الثلث انقاس على فريم الكتلة وحده، خلافاً للقرار";
      thirdContextFor = (i) => [
        { timeframe: cfg.blockTF, majorSwings: structure.majorSwings, asOfIndex: i },
      ];
    }

    /* ── الكتل الحيّة — **كلها** ────────────────────────────────────
       «حيّة» = ما سكّر السعر خلف ذيلها الطرفي أبداً. الكتلة القديمة
       الحيّة مش أقل أهمية من الحديثة — بالعكس، هي اللي بتستنى عودة
       السعر. */
    const live = blocks.blocks
      .filter((b) => b.invalidIndex === -1 || b.invalidIndex >= block.length - 1)
      .slice(0, cfg.maxChainEval);

    const ctx = {
      candles: block,
      structure,
      thirdContextFor,
      correlate: null,
      lower: Array.isArray(lower) && lower.length ? { candles: lower, timeframe: cfg.entryTF } : null,
      correlateLower: correlatedByTF?.[cfg.entryTF]?.length ? { candles: correlatedByTF[cfg.entryTF] } : null,
      cisdFrame: candlesByTF?.[cfg.cisdTF]?.length
        ? { candles: candlesByTF[cfg.cisdTF], timeframe: cfg.cisdTF }
        : null,
      structureOf: (c) => analyzeStructureV2(c, { timeframe: cfg.entryTF }),
    };

    const setups = [];
    for (const b of live) {
      let s;
      try { s = buildTradeSetup(b, ctx); }
      catch (e) { s = { ok: false, blockedAt: "error", reason: `استثناء: ${e.message}` }; }
      setups.push({
        blockId: b.id, direction: b.direction, levels: b.levels, setup: s,
        /* ⚠️ أوقات الكتلة لازم تطلع هون — الشارت بيربط المستويات بشمعتها
           عبر `groupStartTime`، وبدونها الكتل **ما بتنرسم أبداً**. */
        time: b.groupStartTime,
        groupStartTime: b.groupStartTime,
        groupEndTime: b.groupEndTime,
        candleCount: b.candleCount,
        confirmedAtTime: b.confirmedAtTime,
        invalidIndex: b.invalidIndex,
        /* خريطة الشروط — بديل «الإشارة والنسبة». كل سطر بيرجع لقاعدة. */
        readiness: blockReadiness(b, s, block[block.length - 1].close),
      });
    }

    /* آخر صفقة تاريخية — نفس اللي بيرسمه الشارت، بس على المحرك الجديد.
       مغلّفة لحالها: فشلها ما لازم يمنع باقي المخرج. */
    let lastTrade = null;
    try { lastTrade = findLastTradeV2({ ...ctx, timeframe: cfg.blockTF }); }
    catch (e) { lastTrade = { ok: false, reason: `استثناء: ${e.message}` }; }

    /* ── شكل جاهز للرسم على الشارت ──────────────────────────────────
       الشارت كان بياخد الستوب من `points.B.price` تبع المحرك القديم —
       يعني تحت نقطة التصحيح. وقاعدة صاحب المنهجية: **الستوب تحت نقطة
       الـSMT**. فالشكل الجديد بيمرّر `stop` صراحةً بدل ما يخبّيه بحقل
       اسمه بيقول إشي تاني. */
    let chartTrade = null;
    if (lastTrade?.ok) {
      const t = lastTrade.trade, o = lastTrade.outcome;
      chartTrade = {
        direction: t.direction,
        side: t.side,
        entry: { time: o.entryTime, price: t.entry },
        stop: t.stop,
        risk: t.risk,
        targets: t.targets ?? null,
        targetsStage: t.targetsStage ?? null,
        displayTF: cfg.blockTF,
        outcome: {
          stopped: o.stopped, stoppedAtTime: o.stoppedAtTime,
          reachedCount: o.reachedCount, riskReward: o.riskReward,
        },
        source: "skV2",
        reason: t.reason,
      };
    }

    const active = setups.filter((s) => s.setup?.ok);
    return {
      ok: true,
      symbol,
      blockTF: cfg.blockTF,
      entryTF: cfg.entryTF,
      cisdTF: cfg.cisdTF,
      counts: {
        blocks: blocks.blocks.length,
        live: live.length,
        active: active.length,
        perHundred: blocks.meta.counts.perHundredCandles,
      },
      /* أول صفقة جاهزة — أو `null`. ما في «أقرب صفقة» ولا تقريب. */
      activeSetup: active[0]?.setup ?? null,
      lastTrade,
      chartTrade,
      setups,
      barsToConfirmation: blocks.meta.barsToConfirmation,
      notes: [
        dailyNote,
        ctx.correlateLower ? null : "ما في شموع مترابط على فريم الدخول — SMT غير قابلة للتقييم",
        ctx.lower ? null : `ما في شموع ${cfg.entryTF} — SMT غير قابلة للتقييم`,
        ctx.cisdFrame ? null : `ما في شموع ${cfg.cisdTF} — الـCISD بترجع لفريم الـSMT، خلافاً للقرار`,
      ].filter(Boolean),
      pendingRules: blocks.meta.pendingRules,
    };
  } catch (e) {
    /* ⚠️ ما بينكسر المحلّل. */
    return { ok: false, value: "ERROR", why: `استثناء بالمُهايئ: ${e.message}` };
  }
}
