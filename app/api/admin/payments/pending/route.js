import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-server";

// GET /api/admin/payments/pending
// كل عمليات الدفع اليدوي (USDT) بحالة "pending" — قائمة المراجعة بلوحة الأدمن.
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { data: transactions, error } = await admin
    .from("payment_transactions")
    .select(
      `id, user_id, amount, currency, status, created_at, invoice_id,
       invoices ( plan_code ),
       manual_payment_submissions ( id, network, txid, proof_image_path, submitted_at, wallet_id )`
    )
    .eq("provider_code", "manual_usdt")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set((transactions || []).map((t) => t.user_id))];
  // نجيب بيانات المستخدمين بشكل منفصل (join مباشر مش متاح دايماً حسب RLS/الاسم)
  const { data: users } = await admin.from("profiles").select("id, username, email").in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]));

  // نولّد روابط موقّتة (Signed URLs) لصور الإثبات حتى الأدمن يقدر يشوفها بدون
  // ما يخلي الـ bucket عام (public)
  const enriched = await Promise.all(
    (transactions || []).map(async (t) => {
      const submission = t.manual_payment_submissions?.[0] || null;
      let proofUrl = null;
      if (submission?.proof_image_path) {
        const { data: signed } = await admin.storage
          .from("payment-proofs")
          .createSignedUrl(submission.proof_image_path, 60 * 30);
        proofUrl = signed?.signedUrl || null;
      }
      return {
        id: t.id,
        amount: t.amount,
        currency: t.currency,
        createdAt: t.created_at,
        planCode: t.invoices?.plan_code,
        network: submission?.network,
        txid: submission?.txid,
        proofUrl,
        submittedAt: submission?.submitted_at,
        user: usersById[t.user_id] || null,
      };
    })
  );

  return NextResponse.json({ pending: enriched });
}
