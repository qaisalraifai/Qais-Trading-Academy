import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";

// POST /api/batches/enroll { course_id, batch_id }
// اختيار الطالب لدفعته لأول مرة بدورة معينة. هاد المسار الوحيد المسموح
// للطالب يسجّل فيه نفسه بدفعة — بعدها التسجيل دائم وما بتطلعله شاشة
// الاختيار مرة ثانية لنفس الدورة. أي نقل لاحق بين الدفعات قرار إداري بس
// (شوف /api/admin/batches/transfer)، الطالب ما فيه صلاحية يبدّل حاله بنفسه.
export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "لازم تسجّلي دخول" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { course_id, batch_id } = body;
  if (!course_id || !batch_id) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const admin = createAdminClient();

  // تأكيد إن الطالب مش مسجّل أصلًا بدفعة لهاي الدورة (يمنع التلاعب بإعادة
  // استدعاء الطلب لتغيير دفعته بنفسه)
  const { data: existing } = await admin
    .from("batch_enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", course_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "أنت مسجّل أصلًا بدفعة لهاي الدورة" }, { status: 400 });
  }

  const { data: batch } = await admin
    .from("batches")
    .select("*")
    .eq("id", batch_id)
    .eq("course_id", course_id)
    .maybeSingle();

  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });
  if (batch.is_archived || batch.registration_status !== "open") {
    return NextResponse.json({ error: "التسجيل بهاي الدفعة مغلق حاليًا" }, { status: 400 });
  }

  if (batch.seats_total != null) {
    const { count } = await admin
      .from("batch_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batch_id);
    if (count != null && count >= batch.seats_total) {
      return NextResponse.json({ error: "المقاعد خلصت بهاي الدفعة، اختاري دفعة ثانية" }, { status: 400 });
    }
  }

  const { error } = await admin.from("batch_enrollments").insert({
    user_id: user.id,
    batch_id,
    course_id,
  });

  if (error) {
    // احتياط لو صار تسجيل بنفس اللحظة من طلب متزامن (unique constraint)
    if (error.code === "23505") {
      return NextResponse.json({ error: "أنت مسجّل أصلًا بدفعة لهاي الدورة" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity(user.id, "note", `اختار الطالب دفعة "${batch.name}"`, {
    batch_id,
    course_id,
  });

  return NextResponse.json({ success: true, batch });
}
