import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/batches/[id]/assignments — كل واجبات هاي الدفعة مع عدد التسليمات لكل وحدة
export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: assignments, error } = await supabase
    .from("batch_assignments")
    .select("*")
    .eq("batch_id", params.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const assignmentIds = (assignments || []).map((a) => a.id);
  let countsMap = {};
  if (assignmentIds.length) {
    const { data: subs } = await supabase
      .from("assignment_submissions")
      .select("assignment_id, grade")
      .in("assignment_id", assignmentIds);
    (subs || []).forEach((s) => {
      if (!countsMap[s.assignment_id]) countsMap[s.assignment_id] = { submitted: 0, graded: 0 };
      countsMap[s.assignment_id].submitted += 1;
      if (s.grade) countsMap[s.assignment_id].graded += 1;
    });
  }

  const withCounts = (assignments || []).map((a) => ({
    ...a,
    submitted_count: countsMap[a.id]?.submitted || 0,
    graded_count: countsMap[a.id]?.graded || 0,
  }));

  const batchCourseIds = [...new Set(withCounts.map((a) => a.batch_course_id).filter(Boolean))];
  let batchCourseMap = {};
  if (batchCourseIds.length) {
    const { data: links } = await supabase.from("batch_courses").select("id, course_id").in("id", batchCourseIds);
    const courseIds = [...new Set((links || []).map((l) => l.course_id))];
    const { data: courses } = await supabase.from("courses").select("id, title, icon").in("id", courseIds);
    const coursesMap = (courses || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {});
    batchCourseMap = (links || []).reduce((acc, l) => ({ ...acc, [l.id]: coursesMap[l.course_id] || null }), {});
  }
  const enriched = withCounts.map((a) => ({ ...a, course: a.batch_course_id ? batchCourseMap[a.batch_course_id] || null : null }));

  return NextResponse.json({ assignments: enriched });
}

// POST /api/admin/batches/[id]/assignments — إنشاء واجب جديد لهاي الدفعة
// body: { title, description?, due_date? }
export async function POST(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: batch } = await supabase.from("batches").select("id").eq("id", params.id).maybeSingle();
  if (!batch) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const title = body?.title?.trim();
  if (!title) return NextResponse.json({ error: "لازم تكتبي عنوان الواجب" }, { status: 400 });

  const batch_course_id = body?.batch_course_id || null;
  if (batch_course_id) {
    const { data: courseLink } = await supabase.from("batch_courses").select("id").eq("id", batch_course_id).eq("batch_id", params.id).maybeSingle();
    if (!courseLink) return NextResponse.json({ error: "الدورة غير مرتبطة بهاي الدفعة" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("batch_assignments")
    .insert({
      batch_id: params.id,
      batch_course_id,
      created_by: auth.user.id,
      title,
      description: body?.description?.trim() || null,
      due_date: body?.due_date || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let course = null;
  if (data.batch_course_id) {
    const { data: link2 } = await supabase.from("batch_courses").select("course_id").eq("id", data.batch_course_id).maybeSingle();
    if (link2?.course_id) {
      const { data: c } = await supabase.from("courses").select("id, title, icon").eq("id", link2.course_id).maybeSingle();
      course = c || null;
    }
  }

  return NextResponse.json({ assignment: { ...data, submitted_count: 0, graded_count: 0, course } });
}
