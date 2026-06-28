import { createAdminClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function POST(request) {
  const { username, password, inviteCode } = await request.json();

  if (!username || !password || !inviteCode) {
    return NextResponse.json(
      { error: "كل الحقول مطلوبة" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // 1) تحقق من كود الدعوة
  const { data: invite, error: inviteError } = await supabase
    .from("invite_codes")
    .select("*")
    .eq("code", inviteCode.trim())
    .eq("is_used", false)
    .single();

  if (inviteError || !invite) {
    return NextResponse.json(
      { error: "كود الدعوة غير صحيح أو مستخدم من قبل" },
      { status: 400 }
    );
  }

  // 2) تحقق إنه اسم المستخدم غير مستخدم من قبل
  const fakeEmail = `${username.trim().toLowerCase()}@eduapp.local`;

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username.trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "اسم المستخدم محجوز، اختر اسم آخر" },
      { status: 400 }
    );
  }

  // 3) إنشاء المستخدم بنظام Auth (بإيميل داخلي وهمي)
  const { data: authUser, error: authError } =
    await supabase.auth.admin.createUser({
      email: fakeEmail,
      password: password,
      email_confirm: true,
    });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // 4) إنشاء البروفايل
  const { error: profileError } = await supabase.from("profiles").insert({
    id: authUser.user.id,
    username: username.trim(),
    role: "student",
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  // 5) تحديث كود الدعوة كمستخدم
  await supabase
    .from("invite_codes")
    .update({ is_used: true, used_by: authUser.user.id })
    .eq("id", invite.id);

  return NextResponse.json({ success: true, email: fakeEmail });
}
