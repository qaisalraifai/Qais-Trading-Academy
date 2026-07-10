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

  const fakeEmail = `${username.trim().toLowerCase()}@eduplatform.com`;

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

  const { data: authUser, error: authError } =
    await supabase.auth.admin.createUser({
      email: fakeEmail,
      password: password,
      email_confirm: true,
    });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: authUser.user.id,
    username: username.trim(),
    role: "student",
  });

  if (profileError) {
    // لازم نلغي حساب الـ auth يلي انعمل، وإلا رح يضل عالق بدون profile
    // (بالضبط نفس المشكلة يلي صلحناها بمسار /signup)
    await supabase.auth.admin.deleteUser(authUser.user.id).catch((e) =>
      console.error("Rollback of auth user failed:", e)
    );
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  await supabase
    .from("invite_codes")
    .update({ is_used: true, used_by: authUser.user.id })
    .eq("id", invite.id);

  return NextResponse.json({ success: true });
}
