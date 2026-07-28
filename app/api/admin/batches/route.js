import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/batches?course_id=... — يرجّع كل الدفعات (أو دفعات دورة معينة)
// مع عدد الطلاب المسجلين والمقاعد المتبقية بشكل لحظي
export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");

  const supabase = createAdminClient();

  let query = supabase
    .from("batches")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (courseId) query = query.eq("course_id", courseId);

  const { data: batches, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const batchIds = (batches || []).map((b) => b.id);
  let countsMap = {};

  if (batchIds.length > 0) {
    const { data: enrollments, error: enrollError } = await supabase
      .from("batch_enrollments")
      .select("batch_id")
      .in("batch_id", batchIds);

    if (enrollError) return NextResponse.json({ error: enrollError.message }, { status: 500 });

    countsMap = (enrollments || []).reduce((acc, row) => {
      acc[row.batch_id] = (acc[row.batch_id] || 0) + 1;
      return acc;
    }, {});
  }

  const enriched = (batches || []).map((b) => {
    const seatsTaken = countsMap[b.id] || 0;
    return {
      ...b,
      seats_taken: seatsTaken,
      seats_remaining: b.seats_total == null ? null : Math.max(b.seats_total - seatsTaken, 0),
      is_full: b.seats_total != null && seatsTaken >= b.seats_total,
    };
  });

  // قائمة الأدمنز (يُستخدمون كمدربين مؤقتًا لعدم وجود كيان "مدرب" منفصل بالمنصة حاليًا)
  const { data: instructors } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("role", "admin")
    .order("username", { ascending: true });

  return NextResponse.json({ batches: enriched, instructors: instructors || [] });
}

// POST /api/admin/batches — إنشاء دفعة جديدة
export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { course_id, name, instructor_id, start_date, end_date, seats_total, registration_status } = body;

  if (!course_id) {
    return NextResponse.json({ error: "لازم تحددي الدورة التابعة لها الدفعة" }, { status: 400 });
  }
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "اسم الدفعة مطلوب" }, { status: 400 });
  }
  if (seats_total !== undefined && seats_total !== null && seats_total !== "" && Number(seats_total) <= 0) {
    return NextResponse.json({ error: "عدد المقاعد لازم يكون رقم أكبر من صفر" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // تأكيد إن الدورة موجودة فعلاً
  const { data: course } = await supabase.from("courses").select("id").eq("id", course_id).maybeSingle();
  if (!course) {
    return NextResponse.json({ error: "الدورة غير موجودة" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("batches")
    .insert({
      course_id,
      name: name.trim(),
      instructor_id: instructor_id || null,
      start_date: start_date || null,
      end_date: end_date || null,
      seats_total: seats_total ? Number(seats_total) : null,
      registration_status: registration_status === "closed" ? "closed" : "open",
      is_default: false, // الدفعات الافتراضية بتتنشئ بس تلقائيًا بالمرحلة 1
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batch: { ...data, seats_taken: 0, seats_remaining: data.seats_total, is_full: false } });
}
