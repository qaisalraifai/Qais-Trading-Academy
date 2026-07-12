import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { Paddle, Environment } from "@paddle/paddle-node-sdk";

// GET /api/account
// بيرجع بيانات اشتراك المستخدم الحالي نفسه (مش أي مستخدم تاني) + سجل مدفوعاته.
// يُستخدم من صفحة "الإعدادات" بالداشبورد.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });
  }

  const admin = createAdminClient();

  const [{ data: profile, error: profileError }, { data: payments }] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "username, email, plan, role, subscription_status, subscription_start, subscription_end, auto_renew, paddle_customer_id, paddle_subscription_id"
      )
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("payments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (profileError || !profile) {
    return NextResponse.json({ error: "تعذر جلب بيانات الحساب" }, { status: 404 });
  }

  // منجرب نجيب روابط إدارة الاشتراك (تحديث بطاقة / إلغاء) مباشرة من Paddle.
  // هاي روابط جاهزة من Paddle نفسه، ما منبنيها يدوياً. لو فشل الطلب (اشتراك تجريبي
  // ما إله paddle_subscription_id مثلاً)، منكمل عادي بدونها.
  let managementUrls = null;
  if (profile.paddle_subscription_id) {
    try {
      const isSandbox = process.env.PADDLE_API_KEY?.startsWith("pdl_sdbx_");
      const paddle = new Paddle(process.env.PADDLE_API_KEY, {
        environment: isSandbox ? Environment.sandbox : Environment.production,
      });
      const subscription = await paddle.subscriptions.get(profile.paddle_subscription_id);
      managementUrls = subscription?.managementUrls || null;
    } catch (e) {
      console.error("تعذر جلب روابط إدارة الاشتراك من Paddle:", e.message);
    }
  }

  return NextResponse.json({
    profile,
    payments: payments || [],
    managementUrls,
  });
}
