import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const period = searchParams.get("period") || "all"; // all | today | week | month
  const statuses = (searchParams.get("status") || "").split(",").filter(Boolean); // active, inactive, vip
  const sort = searchParams.get("sort") || "newest"; // newest | oldest | highest_paid

  const supabase = createAdminClient();

  let query = supabase.from("profiles").select("*");

  if (search) {
    query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
  }

  if (period !== "all") {
    const now = new Date();
    let from;
    if (period === "today") from = new Date(now.setHours(0, 0, 0, 0));
    if (period === "week") from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (period === "month") from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (from) query = query.gte("created_at", from.toISOString());
  }

  if (statuses.length) {
    const orParts = [];
    if (statuses.includes("active")) orParts.push("subscription_status.eq.active");
    if (statuses.includes("inactive")) orParts.push("subscription_status.eq.inactive");
    if (statuses.includes("vip")) orParts.push("plan.in.(vip,elite)");
    if (orParts.length) query = query.or(orParts.join(","));
  }

  if (sort === "newest") query = query.order("created_at", { ascending: false });
  if (sort === "oldest") query = query.order("created_at", { ascending: true });

  const { data: users, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // مجموع المدفوعات لكل مستخدم (دفعة واحدة query بدل N+1)
  const ids = (users || []).map((u) => u.id);
  let paidByUser = {};
  if (ids.length) {
    const { data: payments } = await supabase
      .from("payments")
      .select("user_id, amount, status")
      .in("user_id", ids)
      .eq("status", "paid");
    (payments || []).forEach((p) => {
      paidByUser[p.user_id] = (paidByUser[p.user_id] || 0) + Number(p.amount || 0);
    });
  }

  const now = Date.now();
  let enriched = (users || []).map((u) => {
    const end = u.subscription_end ? new Date(u.subscription_end).getTime() : null;
    const daysLeft = end ? Math.ceil((end - now) / (1000 * 60 * 60 * 24)) : null;
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      phone: u.phone,
      country: u.country,
      avatar_url: u.avatar_url,
      role: u.role,
      plan: u.plan || "member",
      subscription_status: u.subscription_status,
      subscription_start: u.subscription_start,
      subscription_end: u.subscription_end,
      daysLeft,
      auto_renew: !!u.auto_renew,
      suspended: !!u.suspended,
      last_login_at: u.last_login_at,
      last_login_ip: u.last_login_ip,
      last_device: u.last_device,
      login_count: u.login_count || 0,
      created_at: u.created_at,
      totalPaid: paidByUser[u.id] || 0,
    };
  });

  if (sort === "highest_paid") {
    enriched = enriched.sort((a, b) => b.totalPaid - a.totalPaid);
  }

  return NextResponse.json({ users: enriched });
}
