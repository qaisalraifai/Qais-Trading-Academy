import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase-server";
import { parseDevice } from "@/lib/activity-log";

// GET /r/[code] — رابط التتبع اللي المسوّق يشاركه (بدل الرابط المباشر لـ /signup).
// يسجل نقرة بجدول affiliate_clicks، يحط cookie فيها id النقرة، وبعدين يحوّل لصفحة التسجيل.
export async function GET(request, { params }) {
  const origin = new URL(request.url).origin;
  const code = (params?.code || "").trim();

  if (!code) {
    return NextResponse.redirect(new URL("/signup", origin));
  }

  const admin = createAdminClient();
  const { data: affiliate } = await admin
    .from("profiles")
    .select("id, affiliate_status")
    .eq("affiliate_code", code)
    .maybeSingle();

  // كود غير موجود أو مسوّق مش مفعّل — منحوّل لصفحة التسجيل العادية بدون تسجيل نقرة
  if (!affiliate || affiliate.affiliate_status !== "approved") {
    return NextResponse.redirect(new URL("/signup", origin));
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const userAgent = request.headers.get("user-agent") || "";
  const referrer = request.headers.get("referer") || "";

  const { data: click, error } = await admin
    .from("affiliate_clicks")
    .insert({
      affiliate_id: affiliate.id,
      affiliate_code: code,
      ip_hash: ipHash,
      user_agent: userAgent,
      device: parseDevice(userAgent),
      referrer,
      landing_path: "/signup",
    })
    .select("id")
    .single();

  if (error) console.error("click insert failed:", error.message);

  const target = new URL(`/signup?ref=${encodeURIComponent(code)}`, origin);
  const res = NextResponse.redirect(target);
  const maxAge = 60 * 60 * 24 * 30; // 30 يوم
  if (click?.id) res.cookies.set("qta_click_id", click.id, { maxAge, path: "/" });
  res.cookies.set("qta_ref", code, { maxAge, path: "/" });
  return res;
}
