/* ============================================================================
   lib/qais/config.js
   إعدادات QAIS SK Engine — الأصول المراقبة، الفريمات، وترتيب الأولوية بينها
   (مطابق لتوثيق SK + ICT v2 — الفريمات الأساسية Daily/4H/1H + Monthly/Weekly
   كسياق إضافي عند الحاجة + فريم تنفيذ تلقائي M15/M5)
   ============================================================================ */

// نفس المثال يلي انطرح بالفكرة (ذهب/GBPUSD/EURUSD/NAS100/US30/BTC) + إمكانية
// التوسعة لاحقاً بسهولة لأي رمز موجود أصلاً بـ lib/assets.js
export const DEFAULT_RADAR_SYMBOLS = ["XAUUSD", "GBPUSD", "EURUSD", "NAS100", "US30", "BTCUSD"];

/* الفريمات المستخدمة بالتحليل — Yahoo بيوفر مباشرة لغاية 1day فقط؛ Monthly/Weekly
   بتتحسب محلياً بتجميع شموع الـ Daily (راجع lib/qais/timeframe-utils.js) بدل ما
   نعمل طلب شبكة إضافي لكل رمز. */
export const RADAR_TIMEFRAMES = {
  daily: "1day",
  h4: "4h",
  h1: "1h",
  m15: "15min",
  m5: "5min",
};

// عدد الشموع المطلوبة لكل فريم — لازم يطابق تماماً يلي بيجيبه العميل الحي
// (MarketIntelligenceView.js's runAnalysis, fetchCandles(..., 5000)) وإلا
// الكرون بيشوف مدى تاريخي أقصر بكتير من الشارت الحي، فيطلع قراءة هيكلية
// مختلفة تماماً لنفس الرمز (كان محدود بـ300 قبل = أقل من سنة ونص للـDaily،
// بينما الشارت الحي بيشوف أكتر من 19 سنة — تناقض حقيقي كان بيكسر ذاكرة الـOB
// ومبدأ المتوروشكا كليهما لأنو الكرون ما كان يقدر يشوف كفاية تاريخ أصلاً).
export const CANDLE_COUNT = { daily: 5000, h4: 5000, h1: 5000, m15: 5000, m5: 5000 };

/* ترتيب أولوية الهيكلية الرئيسية (5.5 / 2) — من الأعلى (External) للأدنى (Internal).
   Monthly/Weekly مش جزء افتراضي من هالسلم — بتتحسب وبتُعرض كسياق فقط، وبتؤثر
   بالقرار فقط إذا كان عندها حدث هيكلي (BOS/MSS) حديث فعلاً ("عند الحاجة" — 2). */
export const STRUCTURE_FRAME_ORDER = ["daily", "h4", "h1"];
export const CONTEXT_FRAME_ORDER = ["monthly", "weekly"];

/* فريمات تنفيذ الـ OB المسموحة — الاختيار تلقائي: الأداة تجرب الاثنين وتفضّل
   الأقوى/الأعلى توافقاً؛ عند التعادل بالجودة، الأولوية لـ 5M (مطابقةً لتوثيق
   RADAR — SK+ICT الجديد، الفصل ٦-٧: "الدخول يكون عند إعادة اختبار الـ Block
   Order على فريم 5M"). 15M يبقى مصدر ثانوي/احتياطي فقط عند تعادل الجودة. */
export const EXECUTION_FRAME_ORDER = ["m5", "m15"];

/* فريمات فحص الـ SMT (توثيق RADAR الجديد، الفصل ٥/٦): "وجود SMT مؤكد على 1H
   أو 15M" — نفحص H1 أولاً (أقوى/أوثق)، وإذا ما تأكد ننزل لـ 15M. */
export const SMT_FRAME_ORDER = ["h1", "m15"];

/* أولوية مصدر الأهداف (خامس عشر) — كما ورد حرفياً بالتوثيق: Sequence 4H أولاً،
   ثم Daily، ثم موجات الفريم التنفيذي نفسه (الأقرب فعلياً). */
export const SEQUENCE_PRIORITY = ["h4", "daily", "execution"];

/* -------------------- فلتر الأخبار الاقتصادية (توثيق RADAR الجديد، الفصل ٩) --------------------
   "لا يسمح النظام بفتح أي صفقة أثناء صدور الأخبار الاقتصادية المهمة، بغض النظر
   عن اكتمال باقي الشروط." — النافذة الزمنية حول أي خبر بتأثير High (قبله وبعده). */
export const NEWS_BLOCK_WINDOW_MINUTES = 30;

/* خرائط الرمز → العملات المتأثرة به (لمطابقتها مع جدول economic_events).
   الفوركس القياسي (6 أحرف) بنستنتج عملتيه تلقائياً (أول 3 = أساس، آخر 3 = مقابل)،
   والباقي (معادن/كريبتو/مؤشرات/أسهم) مرتبط أساساً بالدولار الأمريكي. */
const SYMBOL_CURRENCY_OVERRIDES = {
  XAUUSD: ["USD"], XAGUSD: ["USD"], XPTUSD: ["USD"], XPDUSD: ["USD"], COPPER: ["USD"],
  NAS100: ["USD"], US30: ["USD"], SPX500: ["USD"],
  BTCUSD: ["USD"], ETHUSD: ["USD"], SOLUSD: ["USD"], XRPUSD: ["USD"], BNBUSD: ["USD"], DOGEUSD: ["USD"],
  AAPL: ["USD"], TSLA: ["USD"], MSFT: ["USD"], AMZN: ["USD"],
  XAUEUR: ["EUR"], SPX500EUR: ["EUR"],
};

export function getSymbolCurrencies(symbol) {
  if (SYMBOL_CURRENCY_OVERRIDES[symbol]) return SYMBOL_CURRENCY_OVERRIDES[symbol];
  if (/^[A-Z]{6}$/.test(symbol)) return [symbol.slice(0, 3), symbol.slice(3, 6)];
  return ["USD"];
}
