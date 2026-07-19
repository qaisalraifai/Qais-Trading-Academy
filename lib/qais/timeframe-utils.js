/* ============================================================================
   lib/qais/timeframe-utils.js
   أدوات مساعدة لتجميع فريمات Monthly/Weekly محلياً من شموع Daily — بدون طلب
   شبكة إضافي (Yahoo ما بيوفرهم مباشرة). تُستخدم فقط كسياق إضافي "عند الحاجة"
   (ثانياً) — مش جزء من سلّم الهيكلية الأساسي (Daily/4H/1H).
   ============================================================================ */

const DAY_SEC = 24 * 60 * 60;

/* بداية أسبوع UTC (الاثنين) للطابع الزمني المعطى */
function weekBucketStart(timeSec) {
  const d = new Date(timeSec * 1000);
  const day = d.getUTCDay(); // 0=Sunday..6=Saturday
  const diffToMonday = (day + 6) % 7; // Monday=0
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMonday));
  return Math.floor(monday.getTime() / 1000);
}

function monthBucketStart(timeSec) {
  const d = new Date(timeSec * 1000);
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  return Math.floor(first.getTime() / 1000);
}

function aggregateBy(dailyCandles, bucketFn) {
  if (!dailyCandles || dailyCandles.length === 0) return [];
  const buckets = new Map();
  for (const c of dailyCandles) {
    const key = bucketFn(c.time);
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, { time: key, open: c.open, high: c.high, low: c.low, close: c.close });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close; // آخر شمعة يومية بالباكت هي المرجع للإغلاق
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

export function toWeeklyCandles(dailyCandles) {
  return aggregateBy(dailyCandles, weekBucketStart);
}

export function toMonthlyCandles(dailyCandles) {
  return aggregateBy(dailyCandles, monthBucketStart);
}

export { DAY_SEC };
