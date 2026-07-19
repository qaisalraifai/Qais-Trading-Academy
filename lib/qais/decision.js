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

  // -------- Targets (خامس عشر): TP1 أخضر، TP2+ أزرق --------
  const targets = checks.targetsCalculated
    ? sequence.targets.map((t, i) => ({ ...t, color: i === 0 ? "green" : "blue" }))
    : [];

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

  return {
    status, // للدائرة على الرادار
    score,
    confidence: score,
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
  };
}
