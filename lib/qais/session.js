/* ============================================================================
   lib/qais/session.js
   كاشف جلسة التداول الحالية (Session Filter) بالاعتماد على ساعة UTC فقط —
   بدون أي طلب شبكة إضافي. الجلسات القياسية (تقريبية، بالتوقيت الشتوي):

     Sydney   21:00 → 06:00 UTC
     Tokyo    00:00 → 09:00 UTC
     London   07:00 → 16:00 UTC
     New York 12:00 → 21:00 UTC

   التداخل London/New York (12:00-16:00 UTC) هو أقوى فترة سيولة باليوم،
   وبيُحتسب "نشِط" بالنسبة لكلتا الجلستين + عندو وزن أعلى بالسكور.

   ملاحظة: هالملف جديد بالكامل ومستقل — ما بيلمس أي ملف موجود، فمُستخدم فقط
   من محرك السكور الجديد الخاص بالرادار (radar v2)، بدون أي تأثير على باقي
   الميزات (Market Intelligence، QAIS Engine tester، الخ).
   ============================================================================ */

const SESSIONS = [
  { key: "sydney", label: "Sydney", start: 21, end: 6 },
  { key: "tokyo", label: "Tokyo", start: 0, end: 9 },
  { key: "london", label: "London", start: 7, end: 16 },
  { key: "newyork", label: "New York", start: 12, end: 21 },
];

function inWindow(hour, start, end) {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end; // نطاق يعبر منتصف الليل (Sydney)
}

/**
 * @param {Date} [date]
 * @returns {{ active: string[], primary: string, label: string, isMajor: boolean, isOverlap: boolean, utcHour: number }}
 */
export function getMarketSession(date = new Date()) {
  const hour = date.getUTCHours();
  const active = SESSIONS.filter((s) => inWindow(hour, s.start, s.end)).map((s) => s.label);

  const isOverlap = active.includes("London") && active.includes("New York");
  const isMajor = active.includes("London") || active.includes("New York");

  let primary = "Closed";
  if (isOverlap) primary = "London / New York Overlap";
  else if (active.includes("London")) primary = "London";
  else if (active.includes("New York")) primary = "New York";
  else if (active.includes("Tokyo")) primary = "Tokyo";
  else if (active.includes("Sydney")) primary = "Sydney";

  return {
    active,
    primary,
    label: active.length ? active.join(" + ") : "Market Closed",
    isMajor,
    isOverlap,
    utcHour: hour,
  };
}
