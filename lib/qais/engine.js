/* ============================================================================
   lib/qais/engine.js
   نقطة الدخول الموحّدة — **على المحركات الجديدة وحدها**.

   ---------------------------------------------------------------------------
   ⚠️ المحركات القديمة انشالت (٢٠٢٦-٠٨-٢٠، بقراره: «شيل الارقام المخترعة
   وخلص من القديم»).

   كان `analyzeSymbol` بيشغّل محركين مع بعض: القديم (`structure.js` ·
   `liquidity.js` · `orderblock.js` · `sequence.js` · `smt.js` · `decision.js`
   = ٢٢٣٦ سطر) والجديد جنبه بحقل `skV2`. الشارت والكتل والأهداف كانوا من
   الجديد، بينما `signal` و`radarScore` و`aiConfidence` و`entryStatus` لسا
   من القديم — وبتنكتب بقاعدة البيانات.

   السبب اللي خلّى الازدواج غير مقبول:
     ١) المحرك القديم **معروف إنه بيرفض كتلة متحقَّقة يدوياً** (٢٨ أبريل).
     ٢) `aiConfidence` مجموع موزون ثابت — ما في نموذج ولا تكامل LLM بالمشروع،
        فالنسبة كانت بتوهم الطالب بدقة غير موجودة.
     ٣) أي تصليح كان بده يتعمل مرتين.

   ---------------------------------------------------------------------------
   الترتيب المنفَّذ هون:

     ١) الهيكل لكل فريم (`structure/` — مقياسان، بلا CHOCH، بلا نظر للمستقبل)
     ٢) الفريم الرئيسي = أعلى فريم عنده اتجاه مؤكَّد
     ٣) السيولة على الفريم الرئيسي (`liquidity-v2/`) → POI
     ٤) سلسلة QAIS SK كاملة (`orderblock-v2/`): كتلة → ثلث → SMT → CISD → أهداف
     ٥) الجاهزية (`symbol-readiness.js`) — خريطة شروط، **بلا أي نسبة**

   ⚠️ ما في `score` ولا `radarScore` ولا `aiConfidence` ولا `radarStrength`
   بالمخرج. المستهلك بياخد `readiness.metCount / readiness.totalCount` — عدّ
   صريح مش نسبة مرجّحة.
   ============================================================================ */

import { analyzeStructureV2 } from "./structure/index.js";
import { analyzeLiquidityV2 } from "./liquidity-v2/index.js";
import { analyzeSequenceV2 } from "./orderblock-v2/sequence-v2.js";
import { matryoshkaAt } from "./orderblock-v2/matryoshka.js";
import { runSkV2 } from "./orderblock-v2/adapter.js";
import { symbolReadiness } from "./symbol-readiness.js";
import { toWeeklyCandles, toMonthlyCandles } from "./timeframe-utils.js";
import { getMarketSession } from "./session.js";
import { checkTimeframeConsistency } from "../market-data/timeframe-consistency.js";
import { STRUCTURE_FRAME_ORDER } from "./config.js";
import { getCorrelatedSymbol } from "./correlation.js";

const MIN_CANDLES = 30;

function enoughData(candles) {
  return Array.isArray(candles) && candles.length >= MIN_CANDLES;
}

/* ── POI من بِرك السيولة ────────────────────────────────────────────────
   المنطقة اللي «لامسها السعر» = آخر كنسة مؤكَّدة. البِرك الباقية بترجع
   مرتّبة بالقوة المقيسة (`strength` من `liquidity-v2` — مشتقّة من بروز
   مقيس بالشموع، مش وزن مخترع). */
function poiFromLiquidity(liquidity) {
  if (!liquidity?.ok) {
    return { touchedZone: null, rankedZones: [], window: null, reason: liquidity?.reason ?? null };
  }
  const sweeps = liquidity.sweeps ?? [];
  const last = sweeps.length ? sweeps[sweeps.length - 1] : null;
  const RANK = { Extreme: 4, Strong: 3, Normal: 2, Weak: 1 };
  const remaining = (liquidity.pools ?? [])
    .filter((p) => p.status === "remaining")
    .sort((a, b) => (RANK[b.strength] || 0) - (RANK[a.strength] || 0) || b.index - a.index)
    .slice(0, 8)
    .map((p) => ({
      type: p.type,
      side: p.side,
      direction: p.direction,
      level: p.price,
      time: p.time,
      strength: p.strength,
      scope: p.scope,
      source: p.source,
    }));

  return {
    touchedZone: last
      ? {
          type: last.pool?.type ?? last.type ?? "pool",
          level: last.pool?.price ?? last.level ?? null,
          from: null,
          to: null,
          side: last.pool?.side ?? null,
          time: last.time ?? null,
          outcome: last.outcome ?? null,
        }
      : null,
    rankedZones: remaining,
    /* النطاق الخارجي القائم — بديل `getMainMoveWindow` القديمة. */
    window: liquidity.externalRange?.ok === false ? null : liquidity.externalRange ?? null,
    reason: null,
  };
}

/**
 * @param {object} params
 * @param {string} params.symbol
 * @param {object} params.candlesByTF - { daily, h4, h1, m15, m5 } كل واحدة array تصاعدي
 * @param {object} [params.correlated] - { symbol, candlesByTF } للأصل المترابط (لـ SMT)
 * @param {object|null} [params.newsBlocked] - نتيجة economic-calendar.getActiveNewsBlock()
 */
export function analyzeSymbol({ symbol, candlesByTF, correlated = null, newsBlocked = null }) {
  const { daily, h4, h1, m15 } = candlesByTF;

  // -------- ١) الهيكل لكل فريم أساسي متوفر --------
  const structByTF = {};
  for (const tf of STRUCTURE_FRAME_ORDER) {
    if (enoughData(candlesByTF[tf])) {
      structByTF[tf] = analyzeStructureV2(candlesByTF[tf], { timeframe: tf });
    }
  }
  if (!Object.keys(structByTF).length) {
    return { symbol, error: "بيانات غير كافية على أي من فريمات الهيكلية الأساسية (Daily/4H/1H)" };
  }

  // -------- سياق أسبوعي/شهري — مشتق من اليومي، للعرض وبس --------
  let structWeekly = null;
  let structMonthly = null;
  if (enoughData(daily)) {
    const wk = toWeeklyCandles(daily);
    const mo = toMonthlyCandles(daily);
    if (enoughData(wk)) structWeekly = analyzeStructureV2(wk, { timeframe: "weekly" });
    if (enoughData(mo)) structMonthly = analyzeStructureV2(mo, { timeframe: "monthly" });
  }

  // -------- ٢) الفريم الرئيسي + الاتجاه --------
  let mainTF = STRUCTURE_FRAME_ORDER.find((tf) => structByTF[tf]?.state?.trend) || null;
  if (!mainTF) mainTF = STRUCTURE_FRAME_ORDER.find((tf) => structByTF[tf]) || null;

  const mainStruct = structByTF[mainTF];
  const mainCandles = candlesByTF[mainTF];
  const direction = mainStruct?.state?.trend || null;

  const lastOf = (st) => (st?.events?.length ? st.events[st.events.length - 1] : null);
  const structureLadder = STRUCTURE_FRAME_ORDER.filter((tf) => structByTF[tf]).map((tf, i) => {
    const st = structByTF[tf];
    return {
      timeframe: tf,
      role: i === 0 ? "external" : "internal",
      trend: st.state?.trend || null,
      hasBOS: st.events.some((e) => e.type === "BOS"),
      hasMSS: st.events.some((e) => e.type === "MSS"),
      lastEvent: lastOf(st)?.type ?? null,
      isMain: tf === mainTF,
    };
  });

  // -------- ٣) السيولة → POI --------
  const liquidity = analyzeLiquidityV2(mainCandles, {
    timeframe: mainTF,
    structure: mainStruct,
    dailyCandles: mainTF === "daily" ? null : daily ?? null,
  });
  const poi = poiFromLiquidity(liquidity);

  // -------- ٤) سلسلة QAIS SK --------
  /* ⚠️ ما بترمي أبداً — أي نقص بيرجع INSUFFICIENT_DATA مع سبب. */
  const skV2 = runSkV2({
    symbol,
    candlesByTF,
    correlatedByTF: correlated?.candlesByTF || null,
  });

  // -------- ٥) الجاهزية — بديل decision.js --------
  const readiness = symbolReadiness(skV2);

  /* السيكونز للرسم: على فريم الكتل، وبنفس اتجاه الصفقة لو في صفقة.
     ⚠️ بلا صفقة ما بتنرسم — قراره (٢٠٢٦-٠٨-١٩): «السيكونز ما بتنرسم غير
     لما يكون في صفقة، وتكون أكبر سيكونز باتجاه الصفقة». */
  const seqTF = skV2?.blockTF ?? "h4";
  let sequence = null;
  if (readiness.tradeValid && structByTF[seqTF] && candlesByTF[seqTF]?.length) {
    const s = analyzeSequenceV2(candlesByTF[seqTF], structByTF[seqTF], {
      direction: readiness.direction,
    });
    if (s?.ok) sequence = { ...s, displayTF: seqTF, sourceTF: seqTF };
  }

  /* ── متروشكا: سيكونس أساسي جوّاه فرعيات ───────────────────────────
     ⚠️ **بتنحسب دايماً** — هي وصف بنية سوق مش إشارة دخول. قاعدته «السيكونز
     ما بتنرسم إلا لما يكون في صفقة» منطوقة عن **الشارت**، والشجرة بتنعرض
     باللوحة كنص. فما بينضاف ولا خط جديد على الشارت.

     ⚠️ ولا حقل دخول/ستوب بيطلع منها — من الملف تحديد السيكونز والأهداف
     وبس (قراره ٢٠٢٦-٠٨-٢١). */
  let matryoshka = null;
  if (structByTF[seqTF] && candlesByTF[seqTF]?.length) {
    try {
      const m = matryoshkaAt(candlesByTF[seqTF], structByTF[seqTF], { direction: readiness.direction });
      matryoshka = {
        ok: !!m.ok,
        reason: m.reason ?? m.why ?? null,
        timeframe: seqTF,
        /* الأساسي مختصر — التفاصيل الكاملة بـ`sequence` لما تكون في صفقة. */
        primary: m.ok
          ? {
              direction: m.primary.direction,
              legLength: m.primary.legLength,
              points: m.primary.points,
              targets: m.primary.targets ?? null,
              stage: m.primary.stage ?? null,
            }
          : null,
        subs: (m.subs ?? []).slice(0, 12),
        counts: m.counts ?? null,
      };
    } catch (e) {
      /* ⚠️ ما بتكسر التحليل — طبقة وصفية. */
      matryoshka = { ok: false, reason: `استثناء: ${e.message}`, primary: null, subs: [], counts: null };
    }
  }

  const lastCandle = mainCandles[mainCandles.length - 1];
  const session = getMarketSession(new Date());

  /* جودة البيانات: هل شموع الفريمات متّسقة مع بعضها؟ سلسلة المزوّدين
     بتتراجع بصمت لما يفشل الأساسي، وممكن تخلط سلسلتين من عقود مختلفة.
     ما منوقف التحليل — منكشفه والقرار للواجهة. */
  const dataQuality = checkTimeframeConsistency(candlesByTF);

  /* ── الكتل للرسم ───────────────────────────────────────────────────
     كل الكتل الحيّة بمستوياتها الخمسة + حالتها بالسلسلة. */
  const orderBlocks = (skV2?.setups ?? []).map((s) => ({
    id: s.blockId,
    direction: s.direction,
    levels: s.levels ?? null,
    high: s.direction === "up" ? s.levels?.close ?? null : s.levels?.outerWick ?? null,
    low: s.direction === "up" ? s.levels?.outerWick ?? null : s.levels?.close ?? null,
    mt: s.levels?.mt ?? null,
    invalidation: s.levels?.outerWick ?? null,
    status: s.setup?.ok ? "Active" : s.readiness?.status === "unknown" ? "Unknown" : "Waiting",
    waitingFor: s.readiness?.rows?.find((r) => r.state === "pending")?.label ?? null,
    metCount: s.readiness?.metCount ?? null,
    totalCount: s.readiness?.totalCount ?? null,
    /* ⚠️ وقت أول شمعة بالمجموعة — الشارت بيبلّش الخطوط من هون.
       بدونه `drawOrderBlocks` بتفلتر الكتل كلها وما بينرسم ولا وحدة. */
    time: s.groupStartTime ?? null,
    groupEndTime: s.groupEndTime ?? null,
    candleCount: s.candleCount ?? null,
    timeframe: skV2?.blockTF ?? null,
  }));

  /* SMT من السلسلة نفسها — مش وحدة منفصلة. `null` لو ما وصلتها الكتلة. */
  const chainSmt = skV2?.setups?.find((s) => s.setup?.chain?.smt)?.setup?.chain?.smt ?? null;

  return {
    symbol,
    price: lastCandle.close,
    updatedAt: new Date().toISOString(),
    dataQuality,

    mainTimeframe: mainTF,
    executionTimeframe: skV2?.entryTF ?? null,
    timeframe: mainTF,

    // -------- الهيكل --------
    direction,
    structureLadder,
    context: {
      weekly: structWeekly
        ? { trend: structWeekly.state?.trend ?? null, hasBOS: structWeekly.events.some((e) => e.type === "BOS") }
        : null,
      monthly: structMonthly
        ? { trend: structMonthly.state?.trend ?? null, hasBOS: structMonthly.events.some((e) => e.type === "BOS") }
        : null,
    },

    // -------- الطبقات --------
    poi,
    orderBlocks,
    sequence,
    matryoshka,
    smtSignal: chainSmt
      ? {
          point: chainSmt.point,
          sweptLevel: chainSmt.sweptLevel,
          correlatedWith: correlated?.symbol || null,
          timeframe: chainSmt.timeframe || null,
          reason: chainSmt.reason || null,
        }
      : null,

    /* ── الجاهزية — **بلا أي رقم مخترع** ──────────────────────────────
       `metCount/totalCount` عدّ صريح. ما في `score` ولا `aiConfidence`. */
    readiness,
    signal: readiness.signal,
    entryStatus: readiness.entryStatus,
    tradeValid: readiness.tradeValid,
    entry: readiness.entry,
    stopLoss: readiness.stopLoss,
    stopLabel: readiness.stopLabel ?? null,
    targets: readiness.targets,
    riskReward: readiness.riskReward,
    waitingFor: readiness.waitingFor,

    // -------- التفاصيل الكاملة --------
    skV2,
    chartTrade: skV2?.chartTrade ?? null,
    lastTrade: skV2?.chartTrade ?? null,

    session: session?.primary || "Closed",
    sessionLabel: session?.label || "Market Closed",
    /* الفصل ٩ — ما بينفتح دخول أثناء خبر مهم، مهما اكتملت الشروط. */
    newsBlock: newsBlocked || null,
  };
}

export { getCorrelatedSymbol };
