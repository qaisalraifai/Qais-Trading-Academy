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

  // المرحلة 7: البث النشط حاليًا لكل دفعة (لو في)، عشان تبان زر "ابدأ/أنهِ بث" بالحالة الصح
  let liveMap = {};
  if (batchIds.length > 0) {
    const { data: liveSessions } = await supabase
      .from("live_sessions")
      .select("id, room_name, title, started_at, batch_id")
      .in("batch_id", batchIds)
      .eq("is_active", true);

    liveMap = (liveSessions || []).reduce((acc, row) => {
      acc[row.batch_id] = row;
      return acc;
    }, {});
  }

  // المرحلة 7: كل المدربين المرتبطين بكل دفعة (تعدد مدربين)
  let instructorsListMap = {};
  if (batchIds.length > 0) {
    const { data: batchInstructors } = await supabase
      .from("batch_instructors")
      .select("batch_id, instructor_id")
      .in("batch_id", batchIds);
    const instructorIds = [...new Set((batchInstructors || []).map((bi) => bi.instructor_id))];
    let instructorProfiles = {};
    if (instructorIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", instructorIds);
      instructorProfiles = (profs || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
    }
    (batchInstructors || []).forEach((bi) => {
      if (!instructorsListMap[bi.batch_id]) instructorsListMap[bi.batch_id] = [];
      if (instructorProfiles[bi.instructor_id]) instructorsListMap[bi.batch_id].push(instructorProfiles[bi.instructor_id]);
    });
  }

  const enriched = (batches || []).map((b) => {
    const seatsTaken = countsMap[b.id] || 0;
    return {
      ...b,
      seats_taken: seatsTaken,
      live_session: liveMap[b.id] || null,
      seats_remaining: b.seats_total == null ? null : Math.max(b.seats_total - seatsTaken, 0),
      is_full: b.seats_total != null && seatsTaken >= b.seats_total,
      instructors_list: instructorsListMap[b.id] || [],
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
  const { name, instructor_ids, start_date, end_date, seats_total, registration_status } = body;
  // instructor_ids: array (المرحلة 7 — تعدد المدربين). لسا بندعم instructor_id المفرد كـ fallback.
  const instructorIdList = Array.isArray(instructor_ids) ? instructor_ids.filter(Boolean) : (body.instructor_id ? [body.instructor_id] : []);

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "اسم الدفعة مطلوب" }, { status: 400 });
  }
  if (seats_total !== undefined && seats_total !== null && seats_total !== "" && Number(seats_total) <= 0) {
    return NextResponse.json({ error: "عدد المقاعد لازم يكون رقم أكبر من صفر" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // كل دفعة بتحتوي تلقائيًا كل الدورات الموجودة بالمنصة — بدون أي اختيار يدوي
  const { data: allCourses, error: coursesError } = await supabase
    .from("courses")
    .select("id")
    .order("order_index", { ascending: true });
  if (coursesError) return NextResponse.json({ error: coursesError.message }, { status: 500 });
  if (!allCourses || allCourses.length === 0) {
    return NextResponse.json({ error: "لازم يكون في دورة وحدة عالأقل بالمنصة قبل ما تنشئي دفعة" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("batches")
    .insert({
      course_id: allCourses[0].id, // مرجع تاريخي فقط (Legacy) — المرجع الفعلي هلأ batch_courses
      name: name.trim(),
      instructor_id: instructorIdList[0] || null, // المدرب الرئيسي — أول واحد بالقائمة، للتوافق مع الشاشات القديمة
      start_date: start_date || null,
      end_date: end_date || null,
      seats_total: seats_total ? Number(seats_total) : null,
      registration_status: registration_status === "closed" ? "closed" : "open",
      is_default: false, // الدفعات الافتراضية بتتنشئ بس تلقائيًا بالمرحلة 1
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ربط كل دورات المنصة تلقائيًا بالدفعة الجديدة
  await supabase.from("batch_courses").insert(
    allCourses.map((c, idx) => ({ batch_id: data.id, course_id: c.id, order_index: idx, status: "not_started" }))
  );

  // المرحلة 7: ربط كل المدربين المختارين بجدول batch_instructors
  let instructorsList = [];
  if (instructorIdList.length) {
    await supabase.from("batch_instructors").insert(instructorIdList.map((id) => ({ batch_id: data.id, instructor_id: id })));
    const { data: profs } = await supabase.from("profiles").select("id, username").in("id", instructorIdList);
    instructorsList = profs || [];
  }

  return NextResponse.json({ batch: { ...data, seats_taken: 0, seats_remaining: data.seats_total, is_full: false, instructors_list: instructorsList } });
}
