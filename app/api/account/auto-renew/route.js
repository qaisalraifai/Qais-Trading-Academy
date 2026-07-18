import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { Paddle, Environment } from "@paddle/paddle-node-sdk";

// POST /api/account/auto-renew  { enabled: boolean }
// المستخدم بيتحكم بتجديده التلقائي بنفسه من صفحة الإعدادات.
// لو عنده اشتراك Paddle فعلي، منجدول/منلغي الإلغاء عند Paddle كمان مش بس بقاعدة البيانات،
// حتى ما تنخصم فاتورة تانية بعد ما يوقف التجديد.
export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });
  }

  const { enabled } = await request.json();
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("paddle_subscription_id")
    .eq("id", user.id)
    .maybeSingle();

  // منحاول نطابق الحالة عند Paddle. هاي خطوة "أفضل جهد" — لو فشلت (مثلاً حساب تجريبي
  // بدون اشتراك Paddle حقيقي) منكمل ومنحدث قاعدة البيانات بس، ومنسجل الخطأ للمتابعة اليدوية.
  let paddleSynced = true;
  if (profile?.paddle_subscription_id) {
    try {
      const isSandbox = process.env.PADDLE_API_KEY?.startsWith("pdl_sdbx_");
      const paddle = new Paddle(process.env.PADDLE_API_KEY, {
        environment: isSandbox ? Environment.sandbox : Environment.production,
      });
      if (enabled) {
        // إلغاء أي جدولة إيقاف سابقة (استئناف التجديد)
        await paddle.subscriptions.update(profile.paddle_subscription_id, {
          scheduledChange: null,
        });
      } else {
        // جدولة إيقاف الاشتراك بنهاية الفترة المدفوعة الحالية (بيضل الوصول شغال لهيك تاريخ)
        await paddle.subscriptions.cancel(profile.paddle_subscription_id, {
          effectiveFrom: "next_billing_period",
        });
      }
    } catch (e) {
      paddleSynced = false;
      console.error("تعذر مزامنة حالة التجديد مع Paddle:", e.message);
    }
  }

  const { error } = await admin.from("profiles").update({ auto_renew: enabled }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(
    user.id,
    "note",
    enabled ? "المستخدم فعّل التجديد التلقائي" : "المستخدم أوقف التجديد التلقائي",
    { paddleSynced }
  );

  return NextResponse.json({ success: true, paddleSynced });
}
