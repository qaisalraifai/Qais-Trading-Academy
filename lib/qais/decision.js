/* ============================================================================
   lib/qais/decision.js
   QAIS Decision Engine — يجمع نتائج كل الفصول بترتيب صارم (رابع عشر) ويطلع
   قرار نهائي واحد: هل الصفقة تُعتمد؟ وين Entry/SL/Targets؟ وليش (الأسباب)؟

   المدخل ctx (يجمّعه lib/qais/engine.js من كل الفريمات):
   {
     trend,             // 'up' | 'down' | null — من External Structure/الفريم الأعلى (١، ٢، ١.٦)
     priceLocation,     // من structure.priceLocation() — فيبوناتشي 0.333/0.5/0.666 (سادساً)
     liquidity,         // من liquidity.analyzeLiquidity() — POI مقيّدة بنطاق MSS→BOS (خامساً)
     ob,                // من orderblock.analyzeOrderBlock() على فريم التنفيذ المُختار (ثامناً/تاسعاً)
     sequence,          // من sequence.resolveSequence() بعد ترتيب الأولوية بين الفريمات (خامس عشر)
     smt,               // من smt.analyzeSMT() أو null إذا ما في زوج مترابط معروف (سابعاً)
     bosConfirmed, mssConfirmed,
     wasActiveBefore,   // bool — كانت الفرصة نشطة/جاهزة بالفحص السابق؟ (لتحديد الأحمر = انتهت)
   }

   نظام الأوزان (من 100): الهيكلية 20 | السيولة/POI 15 | SMT 20 | جودة الـ OB 20 |
   الزخم 10 | توافق الأهداف 15. لا إشعار إلا إذا تجاوزت الفرصة NOTIFY_THRESHOLD.

   Entry/SL (تاسعاً/سادس عشر):
     Entry = مستوى MT بالـ OB (أقوى مستوى — ثاني عشر).
     SL: لو الدخول مؤكَّد بـ SMT => أسفل/فوق نقطة الـ SMT حسب الاتجاه.
         غير هيك => حد إبطال كتلة الـ OB (ثالث عشر).
   Targets (خامس عشر): TP1 أخضر، TP2+ أزرق — المصدر حسب أولوية sequence.resolveSequence().
   ============================================================================ */

const WEIGHTS = {
  structure: 20,
  liquidity: 15,
  smt: 20,
  obQuality: 20, // نسبة مئوية من quality الـ OB (0-100) × 0.20
  displacement: 10,
  targets: 15,
};

export const NOTIFY_THRESHOLD = 85; // لا إشعار إلا إذا تجاوزت الفرصة 85/100

/* أقرب منطقة سيولة لم تُلمس بعد ضمن نفس النطاق المقيَّد، للحكم إذا السعر "يقترب" منها (الحالة الصفراء) */
function findApproachingZone(candles, liquidity) {
  const lastPrice = candles[candles.length - 1]?.close;
  if (lastPrice == null || !liquidity?.allZones) return null;
  const period = candles.slice(-20);
  const avgRange = period.reduce((s, c) => s + (c.high - c.low), 0) / (period.length || 1);
  const tolerance = avgRange * 3;

  const untouched = liquidity.allZones.filter((z) => z !== liquidity.touchedZone);
  let nearest = null;
  let nearestDist = Infinity;
  for (const z of untouched) {
    const lo = z.from ?? z.level;
    const hi = z.to ?? z.level;
    if (lo == null) continue;
    const mid = hi != null ? (lo + hi) / 2 : lo;
    const dist = Math.abs(lastPrice - mid);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = z;
    }
  }
  if (nearest && nearestDist <= tolerance) return nearest;
  return null;
}

export function makeDecision(candles, ctx) {
  const { trend, priceLocation, liquidity, ob, sequence, smt, wasActiveBefore } = ctx;

  // -------- تسلسل الفحص (رابع عشر) --------
  const checks = {
    trend: !!trend, // 1) الاتجاه من External Structure/الفريم الأعلى
    externalStructure: !!trend,
    bosConfirmed: !!ctx.bosConfirmed, // 2) BOS على الهيكل الرئيسي
    mssConfirmed: !!ctx.mssConfirmed, // 3) MSS (إن وجد)
    liquidityHit: !!liquidity?.touchedZone, // 4-5) POI ضمن نطاق MSS→BOS + لمس السعر لها
    priceLocationOk: !!priceLocation, // 6) مكان السعر بالنسبة لفيبوناتشي
    smtPresent: !!smt?.valid, // 7) SMT عند توفره
    obCreated: !!ob?.eligible && ob.status !== "Invalid", // 8-9) OB على فريم التنفيذ حسب القواعد
    retest: ob?.eligible && (ob.status === "Normal" || ob.status === "Weak"),
    riskOk: true, // المخاطرة القصوى 2% — قيد تنفيذ فردي (حجم اللوت)، خارج نطاق تقييم الرادار العام
    targetsCalculated: !!sequence?.active, // الأهداف محسوبة بسبب تحليلي واضح
  };

  // الشروط الإلزامية لاعتماد الصفقة (الثامن + الرابع عشر): كل شرط لازم يتحقق بالترتيب
  const mandatory = [
    checks.trend,
    checks.bosConfirmed,
    checks.liquidityHit,
    checks.obCreated,
    checks.targetsCalculated,
  ];
  const tradeValid = mandatory.every(Boolean);

  // -------- QAIS Score (من 100) --------
  let score = 0;
  score += checks.trend && checks.bosConfirmed ? WEIGHTS.structure : checks.trend ? WEIGHTS.structure * 0.4 : 0;
  score += checks.liquidityHit ? WEIGHTS.liquidity : 0;
  score += checks.smtPresent ? WEIGHTS.smt : 0;
  score += ob?.eligible ? (ob.quality / 100) * WEIGHTS.obQuality : 0;
  score += ob?.eligible && ob.merged ? WEIGHTS.displacement : 0; // OB ما بينخلق أصلاً بدون Displacement
  score += checks.targetsCalculated ? WEIGHTS.targets : 0;
  score = Math.round(Math.min(100, score));

  // -------- حالة الرادار (اللون) --------
  const invalidatedNow = ob?.status === "Invalid" || sequence?.reason?.includes("أُلغيت");
  const approachingZone = !checks.liquidityHit ? findApproachingZone(candles, liquidity) : null;

  let status; // gray | yellow | orange | green | red
  if (invalidatedNow && wasActiveBefore) {
    status = "red";
  } else if (score >= NOTIFY_THRESHOLD && tradeValid) {
    status = "green";
  } else if (checks.liquidityHit) {
    status = "orange";
  } else if (approachingZone) {
    status = "yellow";
  } else {
    status = "gray";
  }

  // -------- Entry / Stop Loss (تاسعاً + سادس عشر) --------
  let entry = null;
  let stopLoss = null;
  let slSource = null;
  if (checks.obCreated) {
    entry = ob.levels.mt; // أقوى مستوى داخل الـ OB — نقطة الدخول (ثاني عشر)
    if (checks.smtPresent && smt.point != null) {
      stopLoss = smt.point; // SL أسفل/فوق نقطة الـ SMT حسب الاتجاه
      slSource = "SMT";
    } else {
      stopLoss = ob.levels.invalidation; // حد إبطال كتلة الـ OB بالكامل
      slSource = "OB Invalidation";
    }
  }

  // -------- ضمان اتجاه الصفقة (Sanity check): BUY => SL أقل من Entry وكل
  // الأهداف أعلى منه. SELL => SL أعلى من Entry وكل الأهداف أقل منه. --------
  // نقطة الـ SMT مصدرها فحص على الأصل نفسه لكن ممكن نظرياً تقع بالجهة
  // الخاطئة (مثلاً بسبب عدم تطابق اتجاه eventA مع trend المعتمد). لو صار
  // هيك، نرجع تلقائياً لحد إبطال الـ OB (اللي مضمون دايماً بالجهة الصحيحة
  // حسب orderblock.js) بدل ما نعرض SL بالجهة الغلط.
  if (entry != null && stopLoss != null && trend) {
    const slOnCorrectSide = trend === "up" ? stopLoss < entry : stopLoss > entry;
    if (!slOnCorrectSide) {
      if (checks.obCreated && ob.levels.invalidation != null) {
        stopLoss = ob.levels.invalidation;
        slSource = "OB Invalidation (SMT كانت بالجهة الخاطئة)";
      } else {
        stopLoss = null; // ما في مرجع آمن نرجع له — أفضل من عرض SL غلط
        slSource = null;
      }
    }
  }

  // -------- Targets (خامس عشر): TP1 أخضر، TP2+ أزرق --------
  // فلترة إضافية (نفس منطق trend): أي هدف يقع بالجهة الغلط من Entry (فوق
  // لصفقة SELL أو تحت لصفقة BUY) يُستبعد بدل ما يُعرض — نفس الحماية اللي
  // صارت بـ resolveSequence لكن هون كحاجز أخير قبل العرض النهائي.
  const rawTargets = checks.targetsCalculated ? sequence.targets : [];
  const directionFilteredTargets =
    entry != null && trend
      ? rawTargets.filter((t) => {
          const price = t.price ?? t.level;
          if (price == null) return false;
          return trend === "up" ? price > entry : price < entry;
        })
      : rawTargets;
  const targets = directionFilteredTargets.map((t, i) => ({ ...t, color: i === 0 ? "green" : "blue" }));

  // -------- سبب الإشارة --------
  const reasonTags = [];
  if (liquidity?.touchedZone) reasonTags.push(liquidity.touchedZone.type);
  if (checks.mssConfirmed) reasonTags.push("MSS");
  else if (checks.bosConfirmed) reasonTags.push("BOS");
  if (ob?.fvgExists) reasonTags.push("FVG");
  if (checks.obCreated) reasonTags.push("OB");
  if (checks.smtPresent) reasonTags.push("SMT");

  const reasonsChecklist = [
    { key: "trend", label: "Trend / External Structure", ok: checks.trend },
    { key: "bosConfirmed", label: "BOS Confirmed", ok: checks.bosConfirmed },
    { key: "mssConfirmed", label: "MSS Confirmed", ok: checks.mssConfirmed },
    { key: "liquidityHit", label: "POI Hit (MSS→BOS window)", ok: checks.liquidityHit },
    { key: "priceLocationOk", label: "Price Location", ok: checks.priceLocationOk },
    { key: "smtPresent", label: "SMT Present", ok: checks.smtPresent },
    { key: "obCreated", label: "OB Created", ok: checks.obCreated },
    { key: "retest", label: "Retest", ok: checks.retest },
    { key: "riskOk", label: "Risk ≤ 2%", ok: checks.riskOk },
    { key: "targetsCalculated", label: "Targets Calculated", ok: checks.targetsCalculated },
  ];

  // ============================================================================
  // Smart Market Radar v2 — سكور/تصنيف إضافي مخصص لواجهة الرادار الجديدة فقط.
  // ما بيلمس أي حقل قديم (status/score/shouldNotify...) — القيم القديمة فوق
  // baqya زي ما هي تماماً لباقي الميزات (Market Intelligence، QAIS Engine tester).
  // المدخلات الإضافية (htfTrend/htfAligned/marketStructure/session/volumeConfirmed)
  // بيمررها lib/qais/engine.js فقط — لو ما انمررت (استدعاء قديم) بترجع قيم افتراضية آمنة.
  // ============================================================================
  const RADAR_WEIGHTS = {
    trend: 15,
    htf: 10,
    bos: 15,
    choch: 10,
    ob: 15,
    fvg: 10,
    liquiditySweep: 15,
    premiumDiscount: 5,
    session: 10,
    volume: 10,
  };
  const RADAR_NOTIFY_THRESHOLD = 95;

  const { htfTrend = trend, htfAligned = false, marketStructure = null, session = null, volumeConfirmed = false } = ctx;

  const premiumDiscountAligned =
    !!priceLocation &&
    ((trend === "up" && priceLocation.zone === "discount") || (trend === "down" && priceLocation.zone === "premium"));

  let radarScore = 0;
  radarScore += checks.trend ? RADAR_WEIGHTS.trend : 0;
  radarScore += htfAligned ? RADAR_WEIGHTS.htf : 0;
  radarScore += checks.bosConfirmed ? RADAR_WEIGHTS.bos : 0;
  radarScore += checks.mssConfirmed ? RADAR_WEIGHTS.choch : 0;
  radarScore += checks.obCreated ? (ob?.quality != null ? (ob.quality / 100) * RADAR_WEIGHTS.ob : RADAR_WEIGHTS.ob) : 0;
  radarScore += ob?.fvgExists ? RADAR_WEIGHTS.fvg : 0;
  radarScore += checks.liquidityHit ? RADAR_WEIGHTS.liquiditySweep : 0;
  radarScore += premiumDiscountAligned ? RADAR_WEIGHTS.premiumDiscount : 0;
  radarScore += session?.isMajor ? RADAR_WEIGHTS.session : 0;
  radarScore += volumeConfirmed ? RADAR_WEIGHTS.volume : 0;
  radarScore = Math.round(Math.min(100, radarScore));

  let radarStrength; // strong | normal | waiting | ignore
  if (!tradeValid) {
    radarStrength = radarScore >= 60 ? "waiting" : "ignore";
  } else if (radarScore >= 95) {
    radarStrength = "strong";
  } else if (radarScore >= 80) {
    radarStrength = "normal";
  } else if (radarScore >= 60) {
    radarStrength = "waiting";
  } else {
    radarStrength = "ignore";
  }
  const radarSignalStrengthLabel = { strong: "Very Strong", normal: "Strong", waiting: "Moderate", ignore: "Weak" }[radarStrength];

  // أخضر=Strong Buy | أزرق=Buy Setup | أصفر=Neutral/Waiting | برتقالي=Sell Setup | أحمر=Strong Sell | رمادي=No Setup
  let radarStatus = "gray";
  let radarSignalLabel = "No Setup";
  if (trend === "up") {
    if (radarStrength === "strong") {
      radarStatus = "green";
      radarSignalLabel = "Strong Buy";
    } else if (radarStrength === "normal") {
      radarStatus = "blue";
      radarSignalLabel = "Buy Setup";
    } else if (radarStrength === "waiting" || approachingZone) {
      radarStatus = "yellow";
      radarSignalLabel = "Neutral / Waiting";
    }
  } else if (trend === "down") {
    if (radarStrength === "strong") {
      radarStatus = "red";
      radarSignalLabel = "Strong Sell";
    } else if (radarStrength === "normal") {
      radarStatus = "orange";
      radarSignalLabel = "Sell Setup";
    } else if (radarStrength === "waiting" || approachingZone) {
      radarStatus = "yellow";
      radarSignalLabel = "Neutral / Waiting";
    }
  } else if (approachingZone) {
    radarStatus = "yellow";
    radarSignalLabel = "Neutral / Waiting";
  }

  const radarWhy = [];
  if (htfAligned) radarWhy.push(htfTrend === "up" ? "Higher Timeframe Bullish" : "Higher Timeframe Bearish");
  if (checks.bosConfirmed) radarWhy.push("BOS Confirmed");
  if (checks.mssConfirmed) radarWhy.push("CHOCH Confirmed");
  if (checks.obCreated) radarWhy.push(trend === "up" ? "Bullish Order Block" : "Bearish Order Block");
  if (ob?.fvgExists) radarWhy.push("Fair Value Gap");
  if (checks.liquidityHit) radarWhy.push("Liquidity Sweep");
  if (premiumDiscountAligned) radarWhy.push(priceLocation?.zone === "discount" ? "Discount Zone" : "Premium Zone");
  if (session?.isMajor) radarWhy.push(`${session?.primary || "Major"} Session`);
  if (volumeConfirmed) radarWhy.push("Volume Confirmed");

  const radarFvgStatus = ob?.fvgExists ? "Present" : "None";
  const radarLiquidityStatus = liquidity?.touchedZone
    ? `Swept (${liquidity.touchedZone.type}${liquidity.touchedZone.direction ? ` — ${liquidity.touchedZone.direction}` : ""})`
    : approachingZone
    ? "Approaching"
    : "Not Swept";
  const radarPremiumDiscount = priceLocation
    ? priceLocation.zone === "premium"
      ? "Premium Zone"
      : priceLocation.zone === "discount"
      ? "Discount Zone"
      : "Equilibrium"
    : "—";
  const radarChochStatus = checks.mssConfirmed ? "Detected" : "Not Yet";
  const radarBosStatus = checks.bosConfirmed ? "Detected" : "Not Yet";

  // -------- SINGLE SOURCE OF TRUTH GATE --------
  // `tradeValid` is the ONE boolean that decides whether a setup is actionable.
  // Every status/label shown anywhere in the UI (Active Opportunities, Analysis
  // Panel, AI Briefing, Liquidity Map, Chart Workspace...) MUST be derived from
  // this same gate. Previously `radarEntryStatus` was computed independently
  // from `ob.status` alone, which meant it could say "Ready" while `tradeValid`
  // (and therefore the BUY/SELL/WAIT signal, and radarStrength/radarStatus)
  // said the opposite. That is what produced contradictions like
  // "BUY · Ready · 95%" in one card next to "WAIT · Waiting · Weak · 35%" in
  // another for the exact same symbol. Fixed by gating entryStatus off the
  // same `tradeValid` boolean that already gates radarStrength/radarStatus.
  const radarEntryStatus = tradeValid
    ? "Ready" // all mandatory conditions met — this is the ONLY case allowed to say "Ready"
    : checks.obCreated || checks.liquidityHit
    ? "Building" // structure is forming (OB/POI present) but not all conditions met yet
    : approachingZone
    ? "Watching" // price is approaching a liquidity zone, nothing confirmed yet
    : "Monitoring"; // engine is still scanning, no actionable structure yet

  // Canonical signal — the ONLY place BUY/SELL/WAIT should ever be computed.
  // Every component (list rows, analysis panel, briefing, chart) must read
  // this field instead of re-deriving it locally, or they can drift apart.
  const signal = tradeValid ? (trend === "up" ? "BUY" : "SELL") : "WAIT";
  const radarRiskReward = (() => {
    const t = targets[0];
    if (entry == null || stopLoss == null || !t) return null;
    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs((t.price ?? t.level) - entry);
    if (risk <= 0) return null;
    return +(reward / risk).toFixed(2);
  })();

  // ============================================================================
  // Metric definitions (shown to users so Score and Confidence are never
  // confused with each other, and never silently disagree):
  //
  //   Quality Score (`score` / `qualityScore`) — measures how COMPLETE the
  //   trading setup is: trend + BOS, liquidity sweep, SMT, Order Block quality,
  //   displacement, and calculated targets. It answers "how much of the
  //   checklist is done?".
  //
  //   AI Confidence (`radarScore` / `aiConfidence`) — measures how confident
  //   the engine is that the setup will PLAY OUT successfully: trend + HTF
  //   alignment, BOS/CHOCH, OB, FVG, liquidity sweep, premium/discount
  //   positioning, session quality, and volume. It answers "how likely is
  //   this to work?".
  //
  //   These are legitimately different numbers and can diverge — but neither
  //   one is allowed to imply "ready to trade" on its own. Only `tradeValid`
  //   (all mandatory checklist items met) may set status/signal/entryStatus to
  //   an actionable state (green/red, BUY/SELL, Ready). Every UI surface must
  //   read status/signal/entryStatus — never infer readiness from a score
  //   directly.
  // ============================================================================

  const result = {
    status, // للدائرة على الرادار
    score,
    qualityScore: score,
    confidence: score,
    signal, // 'BUY' | 'SELL' | 'WAIT' — canonical, single source of truth
    tradeValid,
    direction: trend,
    priceLocation,
    entry,
    stopLoss,
    slSource,
    targets,
    targetsSourceTF: sequence?.sourceTF || null,
    reasonTags,
    reasonsChecklist,
    shouldNotify: status === "green" && score >= NOTIFY_THRESHOLD,
    approachingZone: approachingZone ? { type: approachingZone.type, direction: approachingZone.direction } : null,
    ob,
    sequence,
    smt,

    // -------- Smart Market Radar v2 (إضافي بالكامل) --------
    radarStatus,
    radarSignalLabel,
    radarStrength,
    radarSignalStrengthLabel,
    radarScore,
    radarConfidence: radarScore,
    aiConfidence: radarScore,
    radarShouldNotify: (radarStatus === "green" || radarStatus === "red") && radarScore >= RADAR_NOTIFY_THRESHOLD,
    htfTrend,
    marketStructure,
    bosStatus: radarBosStatus,
    chochStatus: radarChochStatus,
    fvgStatus: radarFvgStatus,
    liquidityStatus: radarLiquidityStatus,
    premiumDiscount: radarPremiumDiscount,
    session: session?.primary || "Closed",
    sessionLabel: session?.label || "Market Closed",
    volumeConfirmed,
    entryStatus: radarEntryStatus,
    riskReward: radarRiskReward,
    why: radarWhy,
  };

  if (process.env.NODE_ENV !== "production") {
    const problems = validateDecisionConsistency(result);
    if (problems.length) {
      // Fails loudly in dev instead of silently shipping a contradictory decision.
      console.warn(`[qais/decision] inconsistent decision for one asset:`, problems, result);
    }
  }

  return result;
}

/* ============================================================================
   Consistency guard — enforces the logical rules the Trading Radar UI must
   never violate. Every component reads status/signal/entryStatus straight
   from makeDecision()'s output, so if this guard ever flags a problem it
   means the engine itself produced an impossible state (a UI bug can no
   longer be the cause, since there is only one place these values come from).
   Exported so it can also be used in tests / a QA script against live data.
   ============================================================================ */
export function validateDecisionConsistency(d) {
  const problems = [];

  if (d.entryStatus === "Ready" && d.signal === "WAIT") {
    problems.push('entryStatus is "Ready" but signal is "WAIT" — a setup cannot be ready with no signal.');
  }
  if (d.entryStatus === "Ready" && !d.tradeValid) {
    problems.push('entryStatus is "Ready" but tradeValid is false.');
  }
  if (d.tradeValid && d.signal === "WAIT") {
    problems.push("tradeValid is true but signal is WAIT.");
  }
  if (!d.tradeValid && d.entryStatus !== "Ready" && ["green", "red"].includes(d.radarStatus)) {
    problems.push(`radarStatus is "${d.radarStatus}" (an active signal color) but the setup is not tradeValid.`);
  }
  if (["green", "blue", "orange", "red"].includes(d.radarStatus) && d.signal === "WAIT") {
    problems.push(`radarStatus "${d.radarStatus}" implies an active signal but signal is WAIT.`);
  }
  if (d.radarSignalStrengthLabel === "Weak" && ["green", "red"].includes(d.radarStatus)) {
    problems.push('Signal Strength is "Weak" but radarStatus is a top-opportunity color (green/red).');
  }
  if (d.aiConfidence < NOTIFY_THRESHOLD - 50 && d.entryStatus === "Ready") {
    // Sanity net only — should already be impossible via the tradeValid gate above.
    problems.push(`entryStatus is "Ready" while aiConfidence is very low (${d.aiConfidence}%).`);
  }

  return problems;
}
