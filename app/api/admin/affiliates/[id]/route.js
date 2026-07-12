  import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/activity-log";

// PATCH /api/admin/affiliates/[id]  { action: "approve" | "reject" | "suspend" | "reactivate" }
export async function PATCH(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = params;
  const { action } = await request.json();

  const statusMap = {
    approve: "approved",
    reject: "rejected",
    suspend: "suspended",
    reactivate: "approved",
  };

  const newStatus = statusMap[action];
  if (!newStatus) {
    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const updateData = { affiliate_status: newStatus };
  if (newStatus === "approved") {
    updateData.is_affiliate = true;
    updateData.affiliate_joined_at = new Date().toISOString();
  }
  if (newStatus === "suspended" || newStatus === "rejected") {
    updateData.is_affiliate = false;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", id)
    .select("id, username")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });

  const messages = {
    approve: "تمت الموافقة على طلب التسويق بالعمولة",
    reject: "تم رفض طلب التسويق بالعمولة",
    suspend: "تم تعليق حساب المسوّق",
    reactivate: "تم إعادة تفعيل حساب المسوّق",
  };
  await logActivity(id, "note", messages[action] || "تحديث حالة المسوّق");

  return NextResponse.json({ success: true, status: newStatus });
}
