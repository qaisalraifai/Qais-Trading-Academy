import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";
import { creditWallet } from "@/lib/wallets";

const WALLET_BY_BONUS_TYPE = {
  direct: "commission",
  renewal: "commission",
  binary: "commission",
  matching: "commission",
  rank: "bonus",
  leadership: "bonus",
  infinity: "bonus",
  fast_start: "bonus",
  achievement: "bonus",
};

// GET: لائحة العمولات — فلترة اختيارية bonus_type, status, userId
export async function GET(request) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const bonusType = searchParams.get("bonus_type");
  const statusFilter = searchParams.get("status");
  const userId = searchParams.get("userId");

  const supabaseAdmin = createAdminClient();
  let query = supabaseAdmin
    .from("mlm_commissions")
    .select("*, beneficiary:beneficiary_id (username)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (bonusType) query = query.eq("bonus_type", bonusType);
  if (statusFilter) query = query.eq("status", statusFilter);
  if (userId) query = query.eq("beneficiary_id", userId);

  const { data: commissions, error: fetchError } = await query;
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  return NextResponse.json({ commissions });
}

// POST: يلغي عمولة موجودة — { commissionId, note }. بيرجّع المبلغ من محفظة المستفيد
export async function POST(request) {
  const { user, error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { commissionId, note } = await request.json();
  if (!commissionId) return NextResponse.json({ error: "commissionId مطلوب" }, { status: 400 });

  const supabaseAdmin = createAdminClient();

  const { data: commission, error: fetchError } = await supabaseAdmin
    .from("mlm_commissions")
    .select("*")
    .eq("id", commissionId)
    .maybeSingle();

  if (fetchError || !commission) {
    return NextResponse.json({ error: "العمولة غير موجودة" }, { status: 404 });
  }
  if (commission.status === "cancelled") {
    return NextResponse.json({ error: "ملغاة مسبقًا" }, { status: 400 });
  }

  const walletType = WALLET_BY_BONUS_TYPE[commission.bonus_type] || "commission";
  await creditWallet(
    supabaseAdmin,
    commission.beneficiary_id,
    walletType,
    -Number(commission.amount),
    "commission_cancelled_by_admin",
    commission.id
  );

  await supabaseAdmin.from("mlm_commissions").update({ status: "cancelled" }).eq("id", commissionId);

  await supabaseAdmin.from("audit_log").insert({
    actor_admin_id: user.id,
    target_user_id: commission.beneficiary_id,
    action: "commission_cancelled",
    details: { commissionId, amount: commission.amount, bonusType: commission.bonus_type, note: note || null },
  });

  return NextResponse.json({ success: true });
}
