import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

export async function PUT(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { title, description, icon, order_index } = body;

  const updateData = {};
  if (title !== undefined) {
    if (!title) {
      return NextResponse.json({ error: "عنوان الكورس مطلوب" }, { status: 400 });
    }
    updateData.title = title;
  }
  if (description !== undefined) updateData.description = description || null;
  if (icon !== undefined) updateData.icon = icon || "📚";
  if (order_index !== undefined && order_index !== "") updateData.order_index = order_index;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("courses")
    .update(updateData)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ course: data });
}

export async function DELETE(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  // فك ارتباط المحاضرات المرتبطة بهاد الكورس قبل الحذف
  // (course_id تصير null بدل ما تنحذف المحاضرات نفسها)
  const { error: unlinkError } = await supabase
    .from("lectures")
    .update({ course_id: null })
    .eq("course_id", params.id);

  if (unlinkError) {
    return NextResponse.json({ error: unlinkError.message }, { status: 500 });
  }

  const { error } = await supabase.from("courses").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
