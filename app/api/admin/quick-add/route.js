import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { type, payload = {} } = await request.json();
  const supabase = createAdminClient();

  if (type === "add_user") {
    const { username, password, plan = "member" } = payload;
    if (!username || !password) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

    const fakeEmail = `${username.trim().toLowerCase()}@eduplatform.com`;
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: fakeEmail,
      password,
      email_confirm: true,
    });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    const { error: profileError } = await supabase.from("profiles").insert({
      id: authUser.user.id,
      username: username.trim(),
      role: "student",
      plan,
    });
    if (profileError) {
      await supabase.auth.admin.deleteUser(authUser.user.id).catch(() => {});
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    await logActivity(authUser.user.id, "note", "تمت إضافة الحساب يدوياً من لوحة التحكم");
    return NextResponse.json({ success: true, userId: authUser.user.id });
  }

  if (type === "broadcast_notification") {
    const { title, message } = payload;
    if (!title || !message) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

    /* صف لكل مستخدم — مش صف واحد بـ`user_id: null`.
       ---------------------------------------------------------------------
       كان بينحفظ صف واحد فاضي المستخدم، بينما القراءة بـ/api/notifications
       بتفلتر `.eq("user_id", user.id)` — فالإشعار العام **ما كان يوصل ولا
       حدا** ولا مرة.

       وفتح الفلتر ما بيكفي: `read` عمود واحد بالصف، فأول واحد بيقراه
       بيأشّره مقروء عند الكل. حالة القراءة لازم تكون لكل مستخدم لحاله.
       ونفس النمط مستعمل أصلاً بإعلانات الدفعات (batches/[id]/announcements).

       بينبعت لكل الحسابات — هاد المعنى الحرفي لـbroadcast. ما في عمود
       «فعّال/معطّل» واضح على `profiles` (قيم `status` مختلطة بين جداول)،
       فأي تصفية بتكون تخميناً وممكن تستثني ناس بصمت. */
    const { data: users, error: usersError } = await supabase.from("profiles").select("id");
    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 });
    if (!users?.length) return NextResponse.json({ error: "ما في مستخدمين لإرسال الإشعار" }, { status: 400 });

    const rows = users.map((u) => ({
      user_id: u.id,
      type: "broadcast",
      title: title.trim(),
      message: message.trim(),
      link: null,
    }));

    /* دفعات: إدراج آلاف الصفوف بطلب واحد بينرفض أو بيتقطع. */
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase.from("notifications").insert(rows.slice(i, i + CHUNK));
      if (error) {
        return NextResponse.json(
          { error: error.message, sent: i, total: rows.length },
          { status: 500 }
        );
      }
    }
    return NextResponse.json({ success: true, recipients: rows.length });
  }

  return NextResponse.json({ error: "نوع غير معروف" }, { status: 400 });
}
