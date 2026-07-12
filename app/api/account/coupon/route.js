import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";

// POST /api/account/coupon  { code: string }
// بيتحقق من كود الخصم. مافي تطبيق آلي فوري على فاتورة Paddle (هاد بيحتاج ربط
// الكوبون بخصم حقيقي بـ Paddle)، فمنسجل الطلب بسجل النشاطات (type: "discount")
// حتى فريق الدعم يطبقه يدوياً على الفاتورة الجاية.
export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });
  }

  const { code } = await request.json();
  const trimmed = (code || "").trim().toUpperCase();
  if (!trimmed) {
    return NextResponse.json({ valid: false, message: "أدخل كود الخصم أولاً" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: coupon } = await admin
    .from("coupons")
    .select("*")
    .eq("code", trimmed)
    .maybeSingle();

  if (!coupon) {
    return NextResponse.json({ valid: false, message: "كود الخصم غير صحيح" });
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, message: "انتهت صلاحية هاد الكود" });
  }

  if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
    return NextResponse.json({ valid: false, message: "تم استهلاك هاد الكود بالكامل" });
  }

  const discountLabel =
    coupon.discount_type === "percent" ? `${coupon.discount_value}%` : `$${coupon.discount_value}`;

  await logActivity(user.id, "discount", `طلب تطبيق كوبون: ${trimmed}`, {
    code: trimmed,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
  });

  return NextResponse.json({
    valid: true,
    discountLabel,
    message: `تم قبول الكود! خصم ${discountLabel} — رح يتطبق على فاتورتك الجاية، فريق الدعم رح يأكد معك.`,
  });
}
