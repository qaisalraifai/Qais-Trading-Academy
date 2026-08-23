import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

/*
 * رابط تأكيد الإيميل الجديد — بيشتغل بأي جهاز أو متصفح يفتحه فيه المستخدم
 * (على عكس /auth/callback يلي بيعتمد على PKCE ولازم نفس جهاز التسجيل).
 *
 * Supabase بترسل المستخدم هون مع token_hash + type بالرابط، ونحن
 * بنتحقق منهم مباشرة عبر verifyOtp من غير ما نحتاج أي حالة محفوظة
 * بالمتصفح مسبقاً.
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/payment";

  if (token_hash && type) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error && data?.user) {
      // لو النوع "تسجيل جديد" (signup) ما منوديه عالدفع من هون —
      // ممكن يكون فاتح الرابط من جهاز/متصفح تاني غير يلي سجل منه
      // (متل ما بيصير لما يفتح الإيميل من التلفون). بنعرضله صفحة
      // تأكيد بسيطة، والجهاز الأصلي (اللابتوب مثلاً) هو يلي رح يتابع
      // لحاله تلقائياً (شوف signup/page.js).
      if (type === "signup") {
        return NextResponse.redirect(`${origin}/auth/confirmed`);
      }

      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("profiles")
        .select("subscription_status")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile?.subscription_status === "active") {
        return NextResponse.redirect(`${origin}/dashboard`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=فشل_تأكيد_الحساب`);
}
