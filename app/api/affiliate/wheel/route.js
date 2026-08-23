import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { createNotification } from "@/lib/notifications";
import { WHEEL_PRIZES, REFERRALS_PER_SPIN, currentPeriod, spinWheel } from "@/lib/bonus-wheel";

async function getAuthedApprovedAffiliate() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجل دخول", status: 401 };

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("affiliate_status").eq("id", user.id).maybeSingle();
  if (!profile || profile.affiliate_status !== "approved") {
    return { error: "هاي الميزة متاحة للمسوّقين المفعّلين فقط", status: 403 };
  }
  return { admin, userId: user.id };
}

// GET /api/affiliate/wheel — تقدّم الشهر الحالي، عدد اللفات المتاحة، وسجل آخر اللفات
export async function GET() {
  const auth = await getAuthedApprovedAffiliate();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { admin, userId } = auth;

  const period = currentPeriod();
  const { data: progress } = await admin
    .from("bonus_wheel_progress")
    .select("*")
    .eq("affiliate_id", userId)
    .eq("period", period)
    .maybeSingle();

  const { data: history } = await admin
    .from("bonus_wheel_spins")
    .select("id, prize_label, prize_type, prize_value, spun_at")
    .eq("affiliate_id", userId)
    .order("spun_at", { ascending: false })
    .limit(10);

  const spinsEarned = progress?.spins_earned || 0;
  const spinsUsed = progress?.spins_used || 0;

  return NextResponse.json({
    period,
    referralsCount: progress?.referrals_count || 0,
    referralsPerSpin: REFERRALS_PER_SPIN,
    referralsToNextSpin: REFERRALS_PER_SPIN - ((progress?.referrals_count || 0) % REFERRALS_PER_SPIN),
    availableSpins: Math.max(0, spinsEarned - spinsUsed),
    prizes: WHEEL_PRIZES.map((p) => ({ label: p.label, type: p.type })),
    history: history || [],
  });
}

// POST /api/affiliate/wheel — يلف العجلة لو في لفة متاحة، ويسجل الجائزة
export async function POST() {
  const auth = await getAuthedApprovedAffiliate();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { admin, userId } = auth;

  const period = currentPeriod();
  const { data: progress } = await admin
    .from("bonus_wheel_progress")
    .select("*")
    .eq("affiliate_id", userId)
    .eq("period", period)
    .maybeSingle();

  const available = Math.max(0, (progress?.spins_earned || 0) - (progress?.spins_used || 0));
  if (available <= 0) {
    return NextResponse.json({ error: `ما عندك لفات متاحة — كمّل ${REFERRALS_PER_SPIN} إحالات مدفوعة هالشهر لتاخذ لفة` }, { status: 400 });
  }

  const prize = spinWheel();

  const { error: spinError } = await admin.from("bonus_wheel_spins").insert({
    affiliate_id: userId,
    period,
    prize_label: prize.label,
    prize_type: prize.type,
    prize_value: prize.value,
  });
  if (spinError) return NextResponse.json({ error: spinError.message }, { status: 500 });

  await admin
    .from("bonus_wheel_progress")
    .update({ spins_used: (progress?.spins_used || 0) + 1, updated_at: new Date().toISOString() })
    .eq("affiliate_id", userId)
    .eq("period", period);

  await createNotification(admin, userId, {
    type: "wheel_spin",
    title: "نتيجة لفة العجلة",
    message: `مبروك! ربحت: ${prize.label}`,
    link: "/affiliate",
  });

  return NextResponse.json({ prize });
}
