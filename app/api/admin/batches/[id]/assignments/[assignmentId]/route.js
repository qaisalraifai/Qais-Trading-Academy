import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// PATCH /api/admin/batches/[id]/assignments/[assignmentId] — تعديل عنوان/وصف/موعد الواجب
export async function PATCH(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });

  const updates = {};
  if (body.title !== undefined) updates.title = body.title?.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.due_date !== undefined) updates.due_date = body.due_date || null;
  if (body.batch_course_id !== undefined) {
    if (body.batch_course_id) {
      const { data: courseLink } = await supabase.from("batch_courses").select("id").eq("id", body.batch_course_id).eq("batch_id", params.id).maybeSingle();
      if (!courseLink) return NextResponse.json({ error: "الدورة غير مرتبطة بهاي الدفعة" }, { status: 400 });
    }
    updates.batch_course_id = body.batch_course_id || null;
  }

  const { data, error } = await supabase
    .from("batch_assignments")
    .update(updates)
    .eq("id", params.assignmentId)
    .eq("batch_id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ assignment: data });
}

// DELETE /api/admin/batches/[id]/assignments/[assignmentId] — حذف الواجب (وكل تسليماته تلقائيًا)
export async function DELETE(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("batch_assignments")
    .delete()
    .eq("id", params.assignmentId)
    .eq("batch_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
