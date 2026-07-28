import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

const BUCKET = "batch-files";

// DELETE /api/admin/batches/[id]/files/[fileId] — حذف ملف من مكتبة الدفعة (التخزين + السجل)
export async function DELETE(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();

  const { data: file } = await supabase
    .from("batch_files")
    .select("*")
    .eq("id", params.fileId)
    .eq("batch_id", params.id)
    .maybeSingle();

  if (!file) return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });

  await supabase.storage.from(BUCKET).remove([file.file_path]);

  const { error } = await supabase.from("batch_files").delete().eq("id", params.fileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
