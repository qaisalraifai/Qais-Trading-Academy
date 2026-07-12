import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

/*
 * هاي الصفحة بيوصلها المستخدم تلقائياً بعد ما يضغط رابط تأكيد الإيميل
 * (أو أي رابط تأكيد ثاني زي استرجاع كلمة المرور مستقبلاً).
 *
 * Supabase بيرسل المستخدم هون مع "code" بالرابط (?code=xxxx).
 * شغلتنا هون: نستبدل هاد الكود بجلسة دخول فعلية (session)، وبعدها
 * نوجه المستخدم حسب حالة اشتراكه:
 *   - عنده اشتراك فعّال أصلاً  → /dashboard
 *   - ما عنده اشتراك لسا      → /payment
 *   - أي خطأ بالعملية         → /login مع رسالة توضيحية
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=رابط_غير_صالح`);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.user) {
    return NextResponse.redirect(`${origin}/login?error=فشل_تأكيد_الحساب`);
  }

  // نتحقق من حالة الاشتراك حتى نعرف نوجهه لصفحة الدفع ولا الداشبورد مباشرة
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("subscription_status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.subscription_status === "active") {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  return NextResponse.redirect(`${origin}/payment`);
}
