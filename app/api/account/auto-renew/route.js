import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";
import { getWhop } from "@/lib/whop";

// POST /api/account/auto-renew  { enabled: boolean }
// المستخدم بيتحكم بتجديده التلقائي بنفسه من صفحة الإعدادات.
// لو عنده عضوية Whop فعلية، منجدول/منلغي الإلغاء عند Whop كمان مش بس بقاعدة البيانات،
// حتى ما تنخصم فاتورة تانية بعد ما يوقف التجديد.
//
// ملاحظة: اسم الحقل بطلب التحديث (cancel_at_period_end) مبني على وثائق Whop
// لإلغاء/استئناف العضوية — تأكد منه بصفحة docs.whop.com/api-reference/memberships
// قبل النشر لو تغيّر بنسخة الـ SDK عندك.
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
    .select("whop_membership_id")
    .eq("id", user.id)
    .maybeSingle();

  // منحاول نطابق الحالة عند Whop. هاي خطوة "أفضل جهد" — لو فشلت (مثلاً حساب تجريبي
  // بدون عضوية Whop حقيقية) منكمل ومنحدث قاعدة البيانات بس، ومنسجل الخطأ للمتابعة اليدوية.
  let whopSynced = true;
  if (profile?.whop_membership_id) {
    try {
      const whop = getWhop();
      if (enabled) {
        // إلغاء جدولة الإيقاف السابقة (استئناف التجديد)
        await whop.memberships.update(profile.whop_membership_id, {
          cancel_at_period_end: false,
        });
      } else {
        // جدولة إيقاف العضوية بنهاية الفترة المدفوعة الحالية (بيضل الوصول شغال لهيك تاريخ)
        await whop.memberships.cancel(profile.whop_membership_id, {
          cancel_at_period_end: true,
        });
      }
    } catch (e) {
      whopSynced = false;
      console.error("تعذر مزامنة حالة التجديد مع Whop:", e.message);
    }
  }

  const { error } = await admin.from("profiles").update({ auto_renew: enabled }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(
    user.id,
    "note",
    enabled ? "المستخدم فعّل التجديد التلقائي" : "المستخدم أوقف التجديد التلقائي",
    { whopSynced }
  );

  return NextResponse.json({ success: true, whopSynced });
}
