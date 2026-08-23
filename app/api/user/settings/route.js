import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

/* /api/user/settings — تخزين عام لكل تخصيصات الطالب (ألوان الريبلاي، القوالب
   المحفوظة، الأدوات المفضّلة، إلخ) بحساب المستخدم، بدل ما تضيع مع تغيير
   الجهاز أو مسح الكاش. مصمّمة كـ"صندوق أسود" - أي مفتاح localStorage يبدأ
   بـ"qta_" (شوف lib/user-settings-sync.js) بينحفظ هون تلقائياً بدون ما نحتاج
   نضيف عمود جديد بقاعدة البيانات كل مرة نضيف فيها إعداد جديد بالواجهة. */

// GET — يرجع كل الإعدادات المحفوظة بحساب المستخدم الحالي (أو data:null لو
// مش مسجّل دخول / زائر)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ data: null });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_settings")
    .select("data")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = ما في صف بعد (طالب جديد لسا ما حفظ شي) - مش خطأ فعلي
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data?.data || null });
}

// POST { data: { key: value | null, ... } } — دمج (merge) مفاتيح جديدة/معدّلة
// مع الإعدادات المحفوظة سابقاً. value = null معناها احذف هاد المفتاح.
// لو المستخدم زائر (مش مسجّل دخول)، ما منحفظ شي بالسيرفر بصمت (بيضل شغال
// محلياً بالمتصفح بس).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const incoming = body?.data;
  if (!incoming || typeof incoming !== "object") {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ saved: false });

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("user_settings")
    .select("data")
    .eq("user_id", user.id)
    .single();

  const merged = { ...(existing?.data || {}) };
  for (const [key, value] of Object.entries(incoming)) {
    if (!key.startsWith("qta_")) continue; // حماية إضافية - بس مفاتيح المنصة
    if (value === null) delete merged[key];
    else merged[key] = value;
  }

  const { error } = await admin
    .from("user_settings")
    .upsert({ user_id: user.id, data: merged, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ saved: false, error: error.message }, { status: 500 });
  return NextResponse.json({ saved: true });
}
