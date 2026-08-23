import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { getWhop } from "@/lib/whop";

// GET /api/account
// بيرجع بيانات اشتراك المستخدم الحالي نفسه (مش أي مستخدم تاني) + سجل مدفوعاته.
// يُستخدم من صفحة "الإعدادات" بالداشبورد.
export async function GET() {
  const supabase = await createClient();
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
        "username, email, plan, role, subscription_status, subscription_start, subscription_end, auto_renew, whop_user_id, whop_membership_id"
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

  // على عكس Paddle، Whop ما بيعطي رابط iframe مخصص لتحديث البطاقة. بدالها في
  // صفحة حسابه المستضافة على whop.com (Profile → Orders) يقدر يدير منها
  // فاتورته وطريقة دفعه وإلغاء اشتراكه. منجيب حالة العضوية الحقيقية من Whop
  // (بدل ما نعتمد بس على قاعدة بياناتنا) لعرضها بدقة بالإعدادات.
  let membership = null;
  if (profile.whop_membership_id) {
    try {
      const whop = getWhop();
      membership = await whop.memberships.retrieve(profile.whop_membership_id);
    } catch (e) {
      console.error("تعذر جلب تفاصيل العضوية من Whop:", e.message);
    }
  }

  return NextResponse.json({
    profile,
    payments: payments || [],
    // رابط عام لصفحة إدارة الطلبات على Whop (تسجيل دخول ثم إدارة الفاتورة/البطاقة/الإلغاء)
    managementUrl: "https://whop.com/orders",
    membership: membership
      ? {
          status: membership.status,
          cancelAtPeriodEnd: membership.cancel_at_period_end ?? membership.cancelAtPeriodEnd ?? null,
          renewalDate: membership.renewal_period_end || membership.next_renewal_date || null,
        }
      : null,
  });
}
