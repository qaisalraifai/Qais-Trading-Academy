import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

const VALID_STATUSES = ["not_started", "ongoing", "paused", "ended", "archived"];

// PATCH /api/admin/batches/[id]/courses/[linkId] — تعديل حالة الدورة أو ترتيبها جوا الدفعة
// ما في إضافة/حذف دورة يدوي — كل دفعة بتحتوي تلقائيًا كل دورات المنصة
// body: { status? , order_index? }
export async function PATCH(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });

  const updateData = {};
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "حالة غير معروفة" }, { status: 400 });
    }
    updateData.status = body.status;
  }
  if (body.order_index !== undefined) updateData.order_index = Number(body.order_index);

  const { data, error } = await supabase
    .from("batch_courses")
    .update(updateData)
    .eq("id", params.linkId)
    .eq("batch_id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ batch_course: data });
}
