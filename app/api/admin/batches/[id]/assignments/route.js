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

  return NextResponse.json({ assignments: withCounts });
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

  const { data, error } = await supabase
    .from("batch_assignments")
    .insert({
      batch_id: params.id,
      created_by: auth.user.id,
      title,
      description: body?.description?.trim() || null,
      due_date: body?.due_date || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ assignment: { ...data, submitted_count: 0, graded_count: 0 } });
}
