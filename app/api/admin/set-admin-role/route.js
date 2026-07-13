import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

const VALID_ROLES = ["super_admin", "financial_manager", "support_manager", "compliance_manager", "marketing_manager", null];

// POST: { userId, adminRole } — يعيّن الدور الإداري الدقيق لعضو (لازم يكون role="admin" أصلاً)
export async function POST(request) {
  const { user, error, status } = await requireAdminRole([]); // super_admin بس
  if (error) return NextResponse.json({ error }, { status });

  const { userId, adminRole } = await request.json();
  if (!userId || !VALID_ROLES.includes(adminRole)) {
    return NextResponse.json({ error: "دور إداري غير صحيح" }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ admin_role: adminRole })
    .eq("id", userId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await supabaseAdmin.from("audit_log").insert({
    actor_admin_id: user.id,
    target_user_id: userId,
    action: "admin_role_changed",
    details: { newRole: adminRole },
  });

  return NextResponse.json({ success: true });
}
