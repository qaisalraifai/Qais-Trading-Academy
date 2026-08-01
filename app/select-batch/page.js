import { createClient, createAdminClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";
import SelectBatchClient from "./SelectBatchClient";

// صفحة كاملة (مو نافذة صغيرة) — أول شي يشوفه الطالب بعد تسجيل الدخول لو
// لسا ما اختار دفعته. بمجرد ما يختار، هاد الاختيار بيصير هو المرجع لكل
// شي بالمنصة (البث، الدورات، الإعلانات...) — تسجيل بمستوى الدفعة الكاملة.
export default async function SelectBatchPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // skipBatchGate: true — عشان نتفادى حلقة تحويل لا نهائية على نفس الصفحة
  const shellProfile = await getShellProfile(supabase, user, { skipBatchGate: true });

  const admin = createAdminClient();

  // لو الطالب أصلًا عنده دفعة، ما إله داعي يرجع هون — نوديه للداشبورد مباشرة
  const { count: existingCount } = await admin
    .from("batch_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (existingCount) redirect("/dashboard");

  const { data: rawBatches } = await admin
    .from("batches")
    .select("*")
    .eq("is_archived", false)
    .eq("registration_status", "open")
    .order("start_date", { ascending: true });

  const batches = await Promise.all(
    (rawBatches || []).map(async (b) => {
      const { count } = await admin
        .from("batch_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", b.id);
      const seatsTaken = count || 0;
      return {
        ...b,
        seats_remaining: b.seats_total == null ? null : Math.max(b.seats_total - seatsTaken, 0),
        is_full: b.seats_total != null && seatsTaken >= b.seats_total,
      };
    })
  );

  return (
    <PageShell {...shellProfile}>
      <SelectBatchClient batches={batches} />
    </PageShell>
  );
}
