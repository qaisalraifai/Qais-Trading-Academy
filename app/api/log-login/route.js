import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { logActivity, getClientIp, parseDevice, lookupCountry } from "@/lib/activity-log";

// يُستدعى من صفحة /login مباشرة بعد نجاح تسجيل الدخول (من المتصفح)
// بيسجل IP + الجهاز + يزيد عداد الدخول + يضيف سطر بالـ Timeline
export async function POST(request) {
  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const ip = getClientIp(request);
  const device = parseDevice(request.headers.get("user-agent"));
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("login_count, country")
    .eq("id", userId)
    .maybeSingle();

  const country = profile?.country || (await lookupCountry(ip));

  await supabase
    .from("profiles")
    .update({
      last_login_at: new Date().toISOString(),
      last_login_ip: ip,
      last_device: device,
      login_count: (profile?.login_count || 0) + 1,
      ...(country ? { country } : {}),
    })
    .eq("id", userId);

  await logActivity(userId, "login", "تسجيل دخول", { ip, device });

  return NextResponse.json({ success: true });
}
