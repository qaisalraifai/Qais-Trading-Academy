/* ============================================================================
   lib/qais/decision.js
   QAIS Decision Engine — الفصول 5 (الدخول)، 7 (المخاطر)، 8 (محرك القرار
   والتقييم)، 9 (منطق Trading Radar) من توثيق QAIS SK Engine v1.0

   المدخل ctx (يجمّعه lib/qais/engine.js من كل الفريمات):
   {
     trend,             // 'up' | 'down' | null — الاتجاه المعتمد (بعد تسوية تعارض الفريمات 1.6)
     priceLocation,     // من structure.priceLocation() على فريم الـ POI
     liquidity,         // من liquidity.analyzeLiquidity() على فريم التنفيذ
     ob,                // من orderblock.analyzeOrderBlock()
     sequence,          // من sequence.analyzeSequence()
     smt,               // من smt.analyzeSMT() أو null إذا ما في زوج مترابط معروف
     wasActiveBefore,   // bool — كانت الفرصة نشطة/جاهزة بالفحص السابق؟ (لتحديد الأحمر = انتهت)
   }

   8.3 نظام الأوزان (من 100): الهيكلية 20 | السيولة 15 | SMT 20 | جودة الـ OB 20 |
       الزخم 10 | توافق الأهداف 15
   8.3 ملاحظة: يُفضَّل عدم إرسال إشعار إلا إذا تجاوزت الفرصة 85/100.
   7: الحد الأقصى للمخاطرة 2% من رأس المال لكل صفقة (هذا الشرط مستوى تنفيذ صفقة
      فردية للطالب — بسياق الرادار العام منعتبره ✅ افتراضياً لأنه مش قرار آلي بمقدار اللوت).
   ============================================================================ */

const WEIGHTS = {
  structure: 20,
  liquidity: 15,
  smt: 20,
  obQuality: 20, // نسبة مئوية من quality الـ OB (0-100) × 0.20
  displacement: 10,
  targets: 15,
};

export const NOTIFY_THRESHOLD = 85; // 8.3: لا إشعار إلا إذا تجاوزت 85/100

/* أقرب منطقة سيولة لم تُلمس بعد، للحكم إذا السعر "يقترب" منها (الحالة الصفراء) */
function findApproachingZone(candles, liquidity) {
  const lastPrice = candles[candles.length - 1]?.close;
  if (lastPrice == null) return null;
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

  // -------- 8.2 تسلسل الفحص (Decision Flow) --------
  const checks = {
    trend: !!trend,
    externalStructure: !!trend, // نفس اعتماد الاتجاه (مبني على External Structure أصلاً — 1.2/1.6)
    liquidityHit: !!liquidity?.touchedZone,
    bosConfirmed: !!ctx.bosConfirmed,
    mssConfirmed: !!ctx.mssConfirmed,
    smtPresent: !!smt?.valid,
    obCreated: !!ob?.eligible && ob.status !== "Invalid",
    retest: ob?.eligible && (ob.status === "Active" || ob.status === "Weak"),
    riskOk: true, // 7: قيد تنفيذ فردي (حجم اللوت) — خارج نطاق تقييم الرادار العام
    targetsCalculated: !!sequence?.active,
  };

  const mandatory = [
    checks.trend,
    checks.liquidityHit,
    checks.bosConfirmed,
    checks.obCreated,
    checks.targetsCalculated,
  ];
  const tradeValid = mandatory.every(Boolean);

  // -------- 8.3 QAIS Score (من 100) --------
  let score = 0;
  score += checks.trend && checks.bosConfirmed ? WEIGHTS.structure : checks.trend ? WEIGHTS.structure * 0.4 : 0;
  score += checks.liquidityHit ? WEIGHTS.liquidity : 0;
  score += checks.smtPresent ? WEIGHTS.smt : 0;
  score += ob?.eligible ? (ob.quality / 100) * WEIGHTS.obQuality : 0;
  score += ob?.eligible && ob.merged ? WEIGHTS.displacement : 0; // OB ما بينخلق أصلاً بدون Displacement (3.1)
  score += checks.targetsCalculated ? WEIGHTS.targets : 0;
  score = Math.round(Math.min(100, score));

  // -------- 9: حالة الرادار (اللون) --------
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

  // -------- سبب الإشارة (نفس أسلوب المثال: Sweep + MSS + FVG + OB) --------
  const reasonTags = [];
  if (liquidity?.touchedZone) reasonTags.push(liquidity.touchedZone.type);
  if (checks.mssConfirmed) reasonTags.push("MSS");
  else if (checks.bosConfirmed) reasonTags.push("BOS");
  if (ob?.fvgExists) reasonTags.push("FVG");
  if (checks.obCreated) reasonTags.push("OB");
  if (checks.smtPresent) reasonTags.push("SMT");

  const reasonsChecklist = [
    { key: "trend", label: "Trend", ok: checks.trend },
    { key: "externalStructure", label: "External Structure", ok: checks.externalStructure },
    { key: "liquidityHit", label: "Liquidity Hit", ok: checks.liquidityHit },
    { key: "bosConfirmed", label: "BOS Confirmed", ok: checks.bosConfirmed },
    { key: "mssConfirmed", label: "MSS Confirmed", ok: checks.mssConfirmed },
    { key: "smtPresent", label: "SMT Present", ok: checks.smtPresent },
    { key: "obCreated", label: "OB Created", ok: checks.obCreated },
    { key: "retest", label: "Retest", ok: checks.retest },
    { key: "riskOk", label: "Risk < 2%", ok: checks.riskOk },
    { key: "targetsCalculated", label: "Targets Calculated", ok: checks.targetsCalculated },
  ];

  return {
    status, // للدائرة على الرادار
    score,
    confidence: score, // نفس القيمة — تُعرض كنسبة جودة الإشارة (Confidence)
    tradeValid,
    direction: trend,
    priceLocation,
    reasonTags,
    reasonsChecklist,
    shouldNotify: status === "green" && score >= NOTIFY_THRESHOLD,
    approachingZone: approachingZone ? { type: approachingZone.type, direction: approachingZone.direction } : null,
    ob,
    sequence,
    smt,
  };
}
