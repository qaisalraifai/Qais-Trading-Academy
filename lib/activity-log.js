import { createAdminClient } from "@/lib/supabase-server";

/**
 * يسجل حدث بجدول activity_log. يُستخدم من API routes فقط (Service Role).
 * type: login | renew | password_change | watch_course | payment_failed |
 *       suspended | unsuspended | deleted | note | discount | coupon_created | extended
 */
export async function logActivity(userId, type, message, metadata = {}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("activity_log").insert({
    user_id: userId,
    type,
    message,
    metadata,
  });
  if (error) console.error("logActivity failed:", error.message);
}

/**
 * يحدد "الدولة" التقريبية من الـ IP باستخدام خدمة مجانية بدون مفتاح.
 * أفضل جهد فقط — إذا فشل بيرجع null وما بيوقف الطلب.
 */
export async function lookupCountry(ip) {
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.")) return null;
  try {
    const res = await fetch(`https://ipapi.co/${ip}/country_name/`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    if (!text || text.length > 60 || text.toLowerCase().includes("undefined")) return null;
    return text;
  } catch {
    return null;
  }
}

/**
 * يستخرج IP الحقيقي من الـ headers (Vercel/proxy-aware).
 */
export function getClientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * يحول الـ User-Agent لاسم جهاز/متصفح مقروء بشكل مبسط، بدون مكتبة خارجية.
 */
export function parseDevice(userAgent) {
  if (!userAgent) return "غير معروف";
  const ua = userAgent.toLowerCase();

  let os = "غير معروف";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("iphone")) os = "iPhone";
  else if (ua.includes("ipad")) os = "iPad";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("mac os")) os = "Mac";
  else if (ua.includes("linux")) os = "Linux";

  let browser = "";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/") && !ua.includes("edg/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/") && !ua.includes("chrome/")) browser = "Safari";

  return browser ? `${os} · ${browser}` : os;
}
