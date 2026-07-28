import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/batches/[id]/announcements — سجل الإعلانات المُرسلة لهاي الدفعة
export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("batch_announcements")
    .select("id, title, message, link, recipients_count, created_at")
    .eq("batch_id", params.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcements: data || [] });
}

// POST /api/admin/batches/[id]/announcements { title, message, link? }
// يرسل إعلان لكل طلاب هاي الدفعة بس (عن طريق جدول notifications الموجود)، بدون ما يوصل لدفعة ثانية
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { title, message, link } = body;

  if (!title || !title.trim()) {
    return NextResponse.json({ error: "عنوان الإعلان مطلوب" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: batch } = await supabase.from("batches").select("id").eq("id", params.id).maybeSingle();
  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });

  const { data: enrollments, error: enrollError } = await supabase
    .from("batch_enrollments")
    .select("user_id")
    .eq("batch_id", params.id);

  if (enrollError) return NextResponse.json({ error: enrollError.message }, { status: 500 });

  const userIds = (enrollments || []).map((e) => e.user_id);

  // نسجّل الإعلان أول بغض النظر عن عدد المسجلين (حتى لو صفر، يضل بالسجل)
  const { data: announcement, error: annError } = await supabase
    .from("batch_announcements")
    .insert({
      batch_id: params.id,
      sent_by: auth.user.id,
      title: title.trim(),
      message: message?.trim() || "",
      link: link?.trim() || null,
      recipients_count: userIds.length,
    })
    .select()
    .single();

  if (annError) return NextResponse.json({ error: annError.message }, { status: 500 });

  if (userIds.length > 0) {
    const notifRows = userIds.map((uid) => ({
      user_id: uid,
      type: "batch_announcement",
      title: title.trim(),
      message: message?.trim() || "",
      link: link?.trim() || null,
    }));
    const { error: notifError } = await supabase.from("notifications").insert(notifRows);
    if (notifError) return NextResponse.json({ error: notifError.message }, { status: 500 });
  }

  return NextResponse.json({ announcement });
}
