import { createAdminClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// ينشئ صف profiles مباشرة بعد supabase.auth.signUp()، باستخدام Service Role
// (يتجاوز RLS تماماً) — لأنه بلحظة التسجيل المستخدم لسا ممكن يكون بدون
// session نشطة (لو تفعيل الإيميل مطلوب)، وبالتالي أي insert/upsert من
// المتصفح (anon/authenticated الوهمي) ممكن يفشل بصمت بسبب RLS.
export async function POST(request) {
  const { userId, username } = await request.json();

  if (!userId || !username) {
    return NextResponse.json(
      { error: "بيانات ناقصة" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // نتأكد إنه المستخدم فعلاً موجود بجدول auth.users بهاد الـ id
  // (حماية بسيطة من إساءة استخدام هاد الـ endpoint)
  const { data: authUser, error: authError } =
    await supabase.auth.admin.getUserById(userId);

  if (authError || !authUser?.user) {
    return NextResponse.json(
      { error: "مستخدم غير صالح" },
      { status: 400 }
    );
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        username: username.trim(),
        role: "student",
        subscription_status: "inactive",
      },
      { onConflict: "id", ignoreDuplicates: false }
    );

  if (profileError) {
    console.error("create-profile upsert failed:", profileError);
    return NextResponse.json(
      { error: profileError.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
