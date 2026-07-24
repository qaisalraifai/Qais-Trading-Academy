/* ============================================================================
   lib/twelvedata-candles.js
   جالب شموع Twelve Data (https://twelvedata.com) — هدفه الأساسي إنه يعطينا
   سعر "سبوت" حقيقي للمعادن (XAU/USD، XAG/USD...) بدل عقد Yahoo الآجل
   المستمر (GC=F) اللي بيعمل قفزات مصطنعة كل تدوير (rollover). شوفي التعليق
   بأول lib/assets.js وlib/yahoo-candles.js لتفاصيل المشكلة الأصلية.

   الخطة المجانية عند Twelve Data: 800 طلب/يوم، 8 طلبات/دقيقة، حتى 5000 نقطة
   بالطلب الواحد. لازم متغير بيئة TWELVE_DATA_API_KEY مضبوط (Vercel → Settings
   → Environment Variables). لو مش مضبوط، الدالة بترجع error فوراً بدون ما
   تعمل أي طلب شبكة - عشان route.js يقدر يتجاوزها فوراً وينزل لسلسلة Yahoo
   القديمة بدون أي تأخير أو استهلاك حصة بالمجان.
   ============================================================================ */

const TD_BASE = "https://api.twelvedata.com/time_series";

/* فريمات المشروع (1min|5min|15min|1h|4h|1day) مطابقة حرفياً لتسمية Twelve
   Data لنفس الفريمات - ما في داعي لأي تحويل. */
const INTERVAL_SECONDS = {
  "1min": 60,
  "5min": 300,
  "15min": 900,
  "1h": 3600,
  "4h": 4 * 3600,
  "1day": 24 * 3600,
};

/* Twelve Data برجّع datetime كنص "YYYY-MM-DD HH:MM:SS" (فريمات دون اليوم)
   أو "YYYY-MM-DD" بس (فريم اليوم/الأسبوع/الشهر). طلبنا timezone=UTC صراحة
   بالباراميترات، فهاد النص دايماً UTC - بس ما بيجي فيه "Z" بالآخر، وnew
   Date(string) ممكن يفسّرها كتوقيت محلي حسب البيئة. فبنفكّها يدوياً بـ
   Date.UTC عشان نضمن نفس السلوك بأي سيرفر. */
function parseTdDatetime(str) {
  const [datePart, timePart] = String(str).split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  let h = 0, mi = 0, s = 0;
  if (timePart) {
    const parts = timePart.split(":").map(Number);
    h = parts[0] || 0;
    mi = parts[1] || 0;
    s = parts[2] || 0;
  }
  if (!y || !m || !d) return NaN;
  return Math.floor(Date.UTC(y, m - 1, d, h, mi, s) / 1000);
}

function toTdDateParam(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/**
 * يجيب شموع OHLC "سبوت" من Twelve Data.
 * @param {string} symbol - رمز Twelve Data (مثل "XAU/USD")
 * @param {string} interval - أحد مفاتيح INTERVAL_SECONDS (1min|5min|15min|1h|4h|1day)
 * @param {number} wanted - عدد الشموع المطلوبة (يُقص لآخر N شمعة، أقصى حد 5000 بالطلب الواحد بالخطة المجانية)
 * @param {number|null} anchorTimestamp - نقطة قص/Replay اختيارية (Unix seconds) - لو موجودة، منطلب نافذة تغطيها بدل آخر البيانات فقط
 * @returns {Promise<{candles: Array}|{error: string}>}
 */
export async function fetchTwelveDataCandles(symbol, interval = "15min", wanted = 1000, anchorTimestamp = null) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return { error: "TWELVE_DATA_API_KEY غير مضبوط" };
  }
  if (!symbol) {
    return { error: "لا يوجد رمز Twelve Data لهذا الأصل" };
  }

  const count = Math.min(Number(wanted) || 1000, 5000);
  const params = new URLSearchParams({
    symbol,
    interval,
    outputsize: String(count),
    order: "ASC",
    timezone: "UTC",
    apikey: apiKey,
  });

  if (anchorTimestamp && Number.isFinite(anchorTimestamp)) {
    // زي منطق anchor بيوهو بالضبط: منطلب نافذة تنتهي شوي بعد نقطة القص
    // (مش دايماً "آخر شي متوفر") عشان الريبلاي يقدر يفوت لأبعد منها.
    const secPerBar = INTERVAL_SECONDS[interval] || 900;
    const bufferSeconds = Math.max(secPerBar * 300, 3 * 24 * 60 * 60);
    const nowSec = Math.floor(Date.now() / 1000);
    const endSec = Math.min(nowSec, anchorTimestamp + bufferSeconds);
    params.set("end_date", toTdDateParam(endSec));
  }

  let res, data;
  try {
    res = await fetch(`${TD_BASE}?${params.toString()}`, { cache: "no-store" });
  } catch (e) {
    return { error: `تعذّر الاتصال بـ Twelve Data: ${e.message}` };
  }
  try {
    data = await res.json();
  } catch {
    return { error: "Twelve Data رجّعت استجابة مش JSON صالح" };
  }

  if (!res.ok || data?.status === "error" || (typeof data?.code === "number" && data.code >= 400)) {
    return { error: data?.message || `Twelve Data رفضت الطلب (status ${res.status})` };
  }

  const values = Array.isArray(data?.values) ? data.values : [];
  if (!values.length) {
    return { error: "Twelve Data ما رجّعت أي شموع لهذا الرمز/الفريم" };
  }

  const candles = values
    .map((v) => ({
      time: parseTdDatetime(v.datetime),
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: Number.isFinite(Number(v.volume)) ? Number(v.volume) : 0,
    }))
    .filter(
      (c) =>
        Number.isFinite(c.time) &&
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close)
    )
    // Twelve Data برجّع شمعة يومية منفصلة للسبت والأحد للمعادن (رغم إنه
    // السوق شبه مقفول عطلة الأسبوع) - الفتح≈الأعلى≈الأدنى≈الإغلاق بيها
    // تقريباً، فبتطلع كـ"شحطة رفيعة" بدل شمعة طبيعية. TradingView/البروكرات
    // ما بتعرض هيك شموع أصلاً (بتدمج عطلة الأسبوع بشمعة الإثنين). فبنشيلها
    // من الفريم اليومي بس (الفريمات الأقل من يوم إلها منطق تداول حقيقي
    // بعطلة الأسبوع أحياناً، فما منلمسها).
    .filter((c) => {
      if (interval !== "1day") return true;
      const dow = new Date(c.time * 1000).getUTCDay(); // 0=أحد، 6=سبت
      return dow !== 0 && dow !== 6;
    })
    .sort((a, b) => a.time - b.time)
    .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);

  if (!candles.length) {
    return { error: "بيانات Twelve Data وصلت لكن كلها غير صالحة" };
  }

  return { candles: candles.slice(-count) };
}
