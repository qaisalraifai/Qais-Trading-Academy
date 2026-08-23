import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getWhop } from "@/lib/whop";

// POST /api/checkout
// بيتأكد مين المستخدم الحالي (سيرفر-سايد، من كوكيز الجلسة)، وبعدين
// بيطلب من Whop جلسة دفع (checkout configuration) مربوطة بـ user.id عبر metadata.
// هاي الطريقة أأمن من إرسال مفتاح الـ API للمتصفح متل ما كان صاير مع بعض
// إعدادات Paddle — كل شي هون بيصير سيرفر-لسيرفر.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });
  }

  const planId = process.env.WHOP_PLAN_ID;
  if (!planId) {
    return NextResponse.json(
      { error: "متغير WHOP_PLAN_ID غير مضبوط بإعدادات المشروع." },
      { status: 500 }
    );
  }

  try {
    const whop = getWhop();
    const config = await whop.checkoutConfigurations.create({
      plan_id: planId,
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success?type=subscription`,
      metadata: { user_id: user.id },
    });

    return NextResponse.json({ sessionId: config.id });
  } catch (e) {
    console.error("تعذر إنشاء جلسة دفع Whop:", e.message);
    return NextResponse.json({ error: "تعذر بدء عملية الدفع، حاول لاحقاً" }, { status: 502 });
  }
}
