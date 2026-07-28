import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// DELETE /api/admin/batches/[id]/certificates/[certId] — سحب شهادة (لو انصدرت بالغلط
// أو الطالب انطرد من الدفعة). ما بيأثر على تقدمه المحفوظ إطلاقًا.
export async function DELETE(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("batch_certificates")
    .delete()
    .eq("id", params.certId)
    .eq("batch_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
