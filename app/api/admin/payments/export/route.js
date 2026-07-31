import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// GET /api/admin/payments/export — تصدير سجل كل عمليات الدفع كملف CSV
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { data: transactions, error } = await admin
    .from("payment_transactions")
    .select("id, user_id, provider_code, amount, currency, status, external_ref, created_at")
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set((transactions || []).map((t) => t.user_id))];
  const { data: users } = await admin
    .from("profiles")
    .select("id, username, email")
    .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]));

  const header = ["transaction_id", "date", "user", "email", "provider", "amount", "currency", "status", "external_ref"];
  const rows = (transactions || []).map((t) => {
    const u = usersById[t.user_id] || {};
    return [t.id, t.created_at, u.username || "", u.email || "", t.provider_code, t.amount, t.currency, t.status, t.external_ref || ""]
      .map(csvEscape)
      .join(",");
  });

  const csv = [header.join(","), ...rows].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
