import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { isValidGender, GENDER_COOKIE } from "@/lib/gender";

/* ============================================================================
   /api/user/gender — تعديل صيغة المخاطبة بعد التسجيل
   ----------------------------------------------------------------------------
   الحقل صار **إلزامياً** بالتسجيل، بس الحسابات اللي انفتحت قبله ما عندها
   قيمة — فبلا هالمسار بيضلّوا يتخاطبوا بالمذكّر للأبد بلا أي طريقة يغيّروها.

   ⚠️ **ما انحطّ بـ`/api/user/settings`** مع إنه إعداد مستخدم: هداك صندوق
   أسود بيخزّن مفاتيح `qta_*` بجدول `user_settings` كـJSON. والصيغة **عمود
   بـ`profiles`** بيقراه الخادم بكل صفحة (`PROFILE_COLUMNS`) — فحفظه بمكان
   تاني بيعني مصدرَي حقيقة لنفس القيمة. هاد المسار نسخة طبق الأصل من
   `/api/user/locale`، وهو التفضيل الوحيد التاني اللي بيعيش على `profiles`.

   ⚠️ **الهوية من الجلسة مش من الجسم.** المسار بيعدّل صفّاً بمفتاح الخدمة،
   فلو أخذ `userId` من الطلب كان أي حدا يقدر يعدّل صيغة أي حساب. `getUser()`
   بتتحقق من التوكن عند Supabase، والتعديل محصور بصفّه هو.
   ============================================================================ */

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { gender } = body;

  if (!isValidGender(gender)) {
    return NextResponse.json({ error: "قيمة غير صالحة" }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ gender }).eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "تعذّر الحفظ" }, { status: 500 });
  }

  const res = NextResponse.json({ gender, saved: true });
  res.cookies.set(GENDER_COOKIE, gender, { path: "/", maxAge: 31536000, sameSite: "lax" });
  return res;
}
