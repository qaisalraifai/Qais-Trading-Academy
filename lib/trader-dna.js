/* ============================================================
   Trader DNA — محرك اختبار الشخصية التداولية + تحليل الصفقات
   ============================================================ */

/* أنواع المتداولين */
export const TRADER_TYPES = {
  sniper: { label: "القناص", icon: "🎯", desc: "بتستنى نقطة الدخول المثالية بصبر، وبتدخل بدقة عالية." },
  scalper: { label: "المضارب السريع", icon: "⚡", desc: "بتفتح وبتسكر صفقات كتير بوقت قصير، وسرعة القرار أهم شي عندك." },
  day_trader: { label: "المتداول اليومي", icon: "📆", desc: "بتفتح وبتسكر صفقاتك خلال نفس اليوم، ومرتاح بمتابعة الشارت لحظياً." },
  swing_trader: { label: "متداول السوينغ", icon: "🌙", desc: "بتحتفظ بصفقاتك لأيام أو أسابيع، وبتفكر على المدى الأبعد." },
};

export const RISK_LABELS = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
};

export const SESSION_LABELS = {
  london: "جلسة لندن",
  newyork: "جلسة نيويورك",
  asia: "الجلسة الآسيوية",
  flexible: "بدون تفضيل ثابت",
};

/* بنك نصوص نقاط القوة والضعف */
const STRENGTH_TEXT = {
  patience: "صبور بانتظار نقطة الدخول المثالية",
  capital_mgmt: "ممتاز بإدارة رأس المال وحساب حجم الصفقة",
  structure: "قوي بقراءة الهيكلية والسيولة (ICT/SMC)",
  discipline: "ملتزم بخطته ووقف الخسارة بدون تردد",
  journaling: "منضبط بتوثيق صفقاته أول بأول",
  risk_control: "بيقفل جزء من الصفقة ويؤمّن الربح بذكاء",
};

const WEAKNESS_TEXT = {
  early_entry: "بيدخل مبكر قبل اكتمال شروط الدخول",
  move_sl: "بيحرك وقف الخسارة تحت ضغط اللحظة",
  revenge: "بيحاول يعوّض الخسارة فوراً بصفقة جديدة (انتقام من السوق)",
  fomo: "بيلحق الفرصة بعد ما تفوته (FOMO)",
  greed: "بيسحب هدف الربح بعد ما يتحقق طمعاً بربح أكبر",
  no_plan: "بيدخل الصفقات بدون خطة أو نموذج ثابت",
  no_journal: "ما بيوثق صفقاته، فصعب يطوّر نفسه",
  emotional: "بيتصرف بعشوائية لما السوق يتحرك عكسه بقوة",
};

/* بنك المهام الأسبوعية حسب نقطة الضعف */
const WEEKLY_TASK_BANK = {
  early_entry: "التزم بقائمة تأكيد (checklist) قبل كل دخول، وما تدخل إلا لما تتحقق كل نقاطها.",
  move_sl: "حط وقف الخسارة وقت فتح الصفقة، وامنع نفسك من تعديله لمدة أسبوع كامل مهما حصل.",
  revenge: "بعد أي صفقة خاسرة، خذ استراحة إجبارية ساعة على الأقل قبل الصفقة الجاية.",
  fomo: "لو فاتتك الفرصة، اكتبها بالسجل وسمّها 'فرصة فائتة' بدل ما تلاحقها بسعر أسوأ.",
  greed: "حدد هدف الربح مسبقاً وسكّر الصفقة عليه، ولو حابب تجرب الإمساك بحركة أطول قسّم الصفقة لجزئين.",
  no_plan: "اختر نموذج دخول واحد بس هالأسبوع (مثلاً Liquidity Sweep + MSS) وما تدخل إلا فيه.",
  no_journal: "وثّق كل صفقة أول ما تسكرها: السبب، الشعور، والنتيجة — ولو بجملتين بس.",
  emotional: "قبل كل صفقة اسأل نفسك 'هل هاد قرار مبني على تحليل ولا على مزاج؟' واكتب الجواب.",
};

/* ============================================================
   أسئلة الاختبار (16 سؤال)
   كل خيار بيحمل نقاط لـ: traderType, risk, strengths[], weaknesses[], session
   ============================================================ */
export const DNA_QUESTIONS = [
  {
    id: "q1",
    text: "كم مرة بتفتح صفقات خلال اليوم الواحد عادة؟",
    options: [
      { id: "a", text: "أقل من صفقة — بعض الأيام بدون صفقات إطلاقاً", type: "sniper", strengths: ["patience"] },
      { id: "b", text: "1 إلى 3 صفقات ضمن نفس اليوم", type: "day_trader" },
      { id: "c", text: "أكثر من 5 صفقات باليوم", type: "scalper" },
      { id: "d", text: "بفتح صفقة وبسكرها بعد أيام", type: "swing_trader" },
    ],
  },
  {
    id: "q2",
    text: "قد إيش بتحتفظ بالصفقة المفتوحة عادة؟",
    options: [
      { id: "a", text: "دقائق معدودة", type: "scalper" },
      { id: "b", text: "ساعات ضمن نفس اليوم", type: "day_trader" },
      { id: "c", text: "من يوم لعدة أيام", type: "swing_trader" },
      { id: "d", text: "لحد ما يتحقق الهدف مهما طال الوقت", type: "sniper", strengths: ["patience"] },
    ],
  },
  {
    id: "q3",
    text: "وأنت مستني نقطة الدخول المثالية، شو بتعمل؟",
    options: [
      { id: "a", text: "بستنى بصبر لين تتوفر كل الشروط حتى لو طال الوقت", type: "sniper", strengths: ["patience", "discipline"] },
      { id: "b", text: "بدخل بسرعة قبل ما تفوتني الفرصة", type: "scalper", weaknesses: ["fomo"] },
      { id: "c", text: "بتابع الشارت لحظياً وبقرر حسب الحركة", type: "day_trader" },
      { id: "d", text: "بحلل وبنتظر تأكيد على فريم أكبر", type: "swing_trader", strengths: ["structure"] },
    ],
  },
  {
    id: "q4",
    text: "لو خسرت 3 صفقات متتالية، شو ردة فعلك؟",
    options: [
      { id: "a", text: "بوقف وبراجع خطتي قبل أي صفقة جديدة", risk: "low", strengths: ["discipline"] },
      { id: "b", text: "بقلل حجم الصفقة وبكمل بحذر", risk: "medium" },
      { id: "c", text: "بضاعف حجم الصفقة الجاية عشان أعوّض اللي خسرته", risk: "high", weaknesses: ["revenge"] },
    ],
  },
  {
    id: "q5",
    text: "قبل ما تدخل صفقة، شو بتعتمد بشكل أساسي؟",
    options: [
      { id: "a", text: "تحليل الهيكلية والسيولة بالتفصيل (ICT / SMC)", strengths: ["structure"] },
      { id: "b", text: "مؤشرات فنية كلاسيكية (RSI، MACD...)" },
      { id: "c", text: "أنماط شموع وبرايس أكشن" },
      { id: "d", text: "إحساس اللحظة بدون تحليل ثابت", weaknesses: ["no_plan"] },
    ],
  },
  {
    id: "q6",
    text: "وقف الخسارة (Stop Loss)... شو بيصير فيه بعد ما تحطه؟",
    options: [
      { id: "a", text: "بحطه وما بلمسه أبداً لحد ما تنتهي الصفقة", strengths: ["discipline"] },
      { id: "b", text: "أحياناً بحركه شوي لو حسيت السوق رح يرجع", weaknesses: ["move_sl"] },
      { id: "c", text: "بحركه غالباً حسب شعوري باللحظة", weaknesses: ["move_sl", "emotional"] },
    ],
  },
  {
    id: "q7",
    text: "نسبة المخاطرة يلي بتستخدمها بالصفقة الواحدة عادة؟",
    options: [
      { id: "a", text: "أقل من 1% من رأس المال", risk: "low" },
      { id: "b", text: "بين 1% و 2%", risk: "medium" },
      { id: "c", text: "أكثر من 3%", risk: "high" },
    ],
  },
  {
    id: "q8",
    text: "إذا الصفقة حققت هدفها بسرعة، شو بتعمل؟",
    options: [
      { id: "a", text: "بسكرها وبطبّق خطتي كما هي", strengths: ["discipline"] },
      { id: "b", text: "بسحب الهدف أبعد طمعاً بربح أكبر", weaknesses: ["greed"] },
      { id: "c", text: "بسكر جزء منها وبحرك وقف الخسارة للتعادل", strengths: ["risk_control"] },
    ],
  },
  {
    id: "q9",
    text: "أكتر جلسة تداول بتحس حالك مرتاح فيها؟",
    options: [
      { id: "a", text: "جلسة لندن", session: "london" },
      { id: "b", text: "جلسة نيويورك", session: "newyork" },
      { id: "c", text: "الجلسة الآسيوية", session: "asia" },
      { id: "d", text: "مش فارقة معي، بتداول بأي وقت", session: "flexible" },
    ],
  },
  {
    id: "q10",
    text: "كيف بتحدد نموذج الدخول (الاستراتيجية) يلي بتعتمد عليها؟",
    options: [
      { id: "a", text: "نموذج ثابت من نماذج السيولة والهيكلية (ICT / SMC)", strengths: ["structure", "discipline"] },
      { id: "b", text: "مؤشرات فنية كلاسيكية بشكل ثابت" },
      { id: "c", text: "أنماط شموع وبرايس أكشن بشكل ثابت" },
      { id: "d", text: "بدون استراتيجية ثابتة، بقرر حسب اللحظة", weaknesses: ["no_plan"] },
    ],
  },
  {
    id: "q11",
    text: "بعد صفقة خاسرة، قد إيش بتستنى قبل ما تفتح صفقة جديدة؟",
    options: [
      { id: "a", text: "بلتزم باستراحة يوم أو أكثر لو الخسارة كبيرة", strengths: ["discipline"] },
      { id: "b", text: "بفتح صفقة جديدة بنفس اليوم بس بحذر", risk: "medium" },
      { id: "c", text: "بفتح فوراً عشان أعوّض", weaknesses: ["revenge"], risk: "high" },
    ],
  },
  {
    id: "q12",
    text: "كيف بتحدد حجم الصفقة (اللوت) قبل الدخول؟",
    options: [
      { id: "a", text: "بحسبه بدقة حسب نسبة % المخاطرة المحددة مسبقاً", strengths: ["capital_mgmt"] },
      { id: "b", text: "عندي فكرة عامة بس مش دايماً بحسب بدقة" },
      { id: "c", text: "بنفس الحجم تقريباً بكل مرة بدون حسبة", weaknesses: ["no_plan"] },
    ],
  },
  {
    id: "q13",
    text: "إذا السوق تحرك بعكس توقعك بشكل حاد، شو بتعمل؟",
    options: [
      { id: "a", text: "بلتزم بوقف الخسارة المحدد مسبقاً وما بتدخل يدوياً", strengths: ["discipline"] },
      { id: "b", text: "براقب وبقيّم الوضع بهدوء وبقرر" },
      { id: "c", text: "بحس بضغط نفسي كبير وبتصرف بعشوائية", weaknesses: ["emotional"] },
    ],
  },
  {
    id: "q14",
    text: "بتوثق صفقاتك بسجل تداول (Trading Journal)؟",
    options: [
      { id: "a", text: "نعم، بشكل دائم ومنتظم بعد كل صفقة", strengths: ["journaling"] },
      { id: "b", text: "أحياناً، مش دايماً" },
      { id: "c", text: "لأ، ما بوثق صفقاتي", weaknesses: ["no_journal"] },
    ],
  },
  {
    id: "q15",
    text: "هدفك الأساسي من التداول؟",
    options: [
      { id: "a", text: "إتقان فن الدخول بأعلى دقة ممكنة، حتى لو صفقات قليلة", type: "sniper" },
      { id: "b", text: "أرباح سريعة ومتكررة يومياً", type: "scalper" },
      { id: "c", text: "دخل إضافي ثابت من متابعة يومية للسوق", type: "day_trader" },
      { id: "d", text: "بناء ثروة على المدى الطويل", type: "swing_trader" },
    ],
  },
  {
    id: "q16",
    text: "لو فاتتك فرصة دخول ممتازة، شو رد فعلك؟",
    options: [
      { id: "a", text: "بتقبلها بهدوء وبستنى الفرصة الجاية", strengths: ["patience", "discipline"] },
      { id: "b", text: "بحس بندم وبدخل بفرصة أضعف عشان ما تفوتني", weaknesses: ["fomo"] },
      { id: "c", text: "بلاحقها بالدخول متأخر بسعر أسوأ", weaknesses: ["fomo", "emotional"] },
    ],
  },
];

const RISK_POINTS = { low: 0, medium: 1, high: 2 };

/* ============================================================
   تحليل إجابات الاختبار → ملف شخصية المتداول
   answers: { q1: "a", q2: "c", ... }
   ============================================================ */
export function scoreDnaQuiz(answers) {
  const typeScores = { sniper: 0, scalper: 0, day_trader: 0, swing_trader: 0 };
  const sessionScores = { london: 0, newyork: 0, asia: 0, flexible: 0 };
  const strengthCount = {};
  const weaknessCount = {};
  let riskSum = 0;
  let riskCount = 0;
  let disciplineHits = 0;
  let disciplineTotal = 0;

  for (const q of DNA_QUESTIONS) {
    const chosenId = answers[q.id];
    const opt = q.options.find((o) => o.id === chosenId);
    if (!opt) continue;

    if (opt.type) typeScores[opt.type] = (typeScores[opt.type] || 0) + 1;
    if (opt.session) sessionScores[opt.session] += 1;
    if (opt.risk) {
      riskSum += RISK_POINTS[opt.risk];
      riskCount += 1;
    }
    (opt.strengths || []).forEach((s) => (strengthCount[s] = (strengthCount[s] || 0) + 1));
    (opt.weaknesses || []).forEach((w) => (weaknessCount[w] = (weaknessCount[w] || 0) + 1));

    // كل سؤال فيه خيار "منضبط" ضمنياً (قوة) يُحسب لصالح مؤشر الانضباط العام
    if (opt.strengths?.length || opt.risk === "low") {
      disciplineHits += 1;
    }
    disciplineTotal += 1;
  }

  const traderType = Object.entries(typeScores).sort((a, b) => b[1] - a[1])[0][0];

  const avgRisk = riskCount > 0 ? riskSum / riskCount : 1;
  const riskTolerance = avgRisk < 0.66 ? "low" : avgRisk < 1.33 ? "medium" : "high";

  const sessionPreference = Object.entries(sessionScores).sort((a, b) => b[1] - a[1])[0][0];

  const totalWeaknessHits = Object.values(weaknessCount).reduce((a, b) => a + b, 0);
  const totalStrengthHits = Object.values(strengthCount).reduce((a, b) => a + b, 0);

  // درجة الانضباط: مبنية على نسبة الإجابات "المنضبطة" مقابل عدد الأسئلة
  const disciplineScore = Math.round(Math.min(100, (disciplineHits / disciplineTotal) * 100));

  // درجة النفسية العامة: تبدأ من 100 وتنقص حسب عدد نقاط الضعف، وتزيد قليلاً حسب نقاط القوة
  const psychologyRaw = 70 + totalStrengthHits * 4 - totalWeaknessHits * 6;
  const psychologyScore = Math.max(10, Math.min(100, Math.round(psychologyRaw)));

  const strengths = Object.entries(strengthCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key]) => ({ key, text: STRENGTH_TEXT[key] || key }));

  const weaknesses = Object.entries(weaknessCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key]) => ({ key, text: WEAKNESS_TEXT[key] || key }));

  const weeklyPlan = weaknesses.slice(0, 3).map((w) => ({
    key: w.key,
    task: WEEKLY_TASK_BANK[w.key] || "راجع هذه النقطة بعناية بخطتك الأسبوعية.",
  }));

  return {
    traderType,
    riskTolerance,
    sessionPreference,
    psychologyScore,
    disciplineScore,
    strengths,
    weaknesses,
    weeklyPlan,
  };
}

/* ============================================================
   تحليل الصفقات الفعلية (rawTrades من جدول trades) → إحصائيات بيئة التداول
   ============================================================ */
const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function computeTradeInsights(rawTrades) {
  const decided = (rawTrades || []).filter((t) => t.result === "win" || t.result === "loss");
  const totalTrades = (rawTrades || []).length;

  if (decided.length === 0) {
    return {
      totalTrades,
      hasEnoughData: false,
      winRate: null,
      bestAsset: null,
      bestSetup: null,
      bestSession: null,
      bestDay: null,
      worstDay: null,
      dnaMaturity: Math.min(100, Math.round((totalTrades / 30) * 100)),
    };
  }

  const wins = decided.filter((t) => t.result === "win").length;
  const winRate = Math.round((wins / decided.length) * 100);

  function bestGroupBy(field, minSample = 3) {
    const groups = {};
    for (const t of decided) {
      const key = (t[field] || "").toString().trim();
      if (!key) continue;
      if (!groups[key]) groups[key] = { wins: 0, total: 0 };
      groups[key].total += 1;
      if (t.result === "win") groups[key].wins += 1;
    }
    const eligible = Object.entries(groups).filter(([, v]) => v.total >= minSample);
    const pool = eligible.length > 0 ? eligible : Object.entries(groups);
    if (pool.length === 0) return null;
    const [key, v] = pool.sort((a, b) => b[1].wins / b[1].total - a[1].wins / a[1].total)[0];
    return { name: key, winRate: Math.round((v.wins / v.total) * 100), sample: v.total };
  }

  const bestAsset = bestGroupBy("asset", 2);
  const bestSetup = bestGroupBy("setup", 2);
  const bestSession = bestGroupBy("session", 2);

  // أفضل/أسوأ يوم أسبوعي حسب تاريخ الصفقة
  const dayGroups = {};
  for (const t of decided) {
    if (!t.trade_date) continue;
    const d = new Date(t.trade_date);
    if (Number.isNaN(d.getTime())) continue;
    const key = DAY_NAMES[d.getDay()];
    if (!dayGroups[key]) dayGroups[key] = { wins: 0, total: 0 };
    dayGroups[key].total += 1;
    if (t.result === "win") dayGroups[key].wins += 1;
  }
  const dayEntries = Object.entries(dayGroups).filter(([, v]) => v.total >= 2);
  let bestDay = null;
  let worstDay = null;
  if (dayEntries.length > 0) {
    const sorted = [...dayEntries].sort((a, b) => b[1].wins / b[1].total - a[1].wins / a[1].total);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    bestDay = { name: best[0], winRate: Math.round((best[1].wins / best[1].total) * 100) };
    worstDay = { name: worst[0], winRate: Math.round((worst[1].wins / worst[1].total) * 100) };
  }

  return {
    totalTrades,
    hasEnoughData: true,
    winRate,
    bestAsset,
    bestSetup,
    bestSession,
    bestDay,
    worstDay,
    dnaMaturity: Math.min(100, Math.round((totalTrades / 30) * 100)),
  };
}
