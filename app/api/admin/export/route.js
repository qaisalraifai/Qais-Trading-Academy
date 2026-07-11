import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// بيرجع CSV (بيفتح مباشرة بـ Excel) — ما احتجنا مكتبة خارجية
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const { data: users, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const headers = ["username", "email", "role", "plan", "subscription_status", "subscription_start", "subscription_end", "country", "last_login_at", "login_count", "created_at"];
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [headers.join(",")];
  (users || []).forEach((u) => {
    rows.push(headers.map((h) => escape(u[h])).join(","));
  });

  const csv = "\uFEFF" + rows.join("\n"); // BOM حتى Excel يفتح العربي صح

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="users-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
