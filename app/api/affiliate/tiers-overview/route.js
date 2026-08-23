import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { getAllTiers, getAffiliateTierStatus } from "@/lib/tiers";

// GET /api/affiliate/tiers-overview — كل المستويات (للجميع)، + تقدّمي الشخصي
// لو كنت مسوّق مفعّل (لعرض المستوى الحالي وشريط التقدم بنفس الصفحة).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });

  const admin = createAdminClient();
  const tiers = await getAllTiers(admin);

  const { data: profile } = await admin
    .from("profiles")
    .select("affiliate_status")
    .eq("id", user.id)
    .maybeSingle();

  let myStatus = null;
  if (profile?.affiliate_status === "approved") {
    myStatus = await getAffiliateTierStatus(admin, user.id);
  }

  return NextResponse.json({ tiers, myStatus, isAffiliate: profile?.affiliate_status === "approved" });
}
