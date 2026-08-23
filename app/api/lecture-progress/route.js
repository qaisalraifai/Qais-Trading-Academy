import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";
import { releaseSignupCommissionIfEligible } from "@/lib/referral-commissions";

// POST /api/lecture-progress — يسجّل/يحدّث تقدّم الطالب بمحاضرة معيّنة.
// body: { lectureId, completed?, watchedPct?, favorite? }
//
// أهم شي هون: أول مرة يصير completed=true لأي محاضرة، منفحص إذا في عمولة
// تسجيل بانتظار راعي هالطالب (awaiting_lesson) ومنحررها فوراً — هاد هو
// شرط "أكمل أول درس" المطلوب قبل ما تُدفع عمولة التسجيل.
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });
  }

  const { lectureId, completed, watchedPct, favorite } = await request.json();
  if (!lectureId) {
    return NextResponse.json({ error: "lectureId مطلوب" }, { status: 400 });
  }

  const admin = createAdminClient();

  const update = { user_id: user.id, lecture_id: lectureId, updated_at: new Date().toISOString() };
  if (typeof completed === "boolean") update.completed = completed;
  if (typeof watchedPct === "number") update.watched_pct = Math.max(0, Math.min(100, watchedPct));
  if (typeof favorite === "boolean") update.favorite = favorite;
  if (completed === true) update.last_watched_at = new Date().toISOString();

  const { error } = await admin
    .from("lecture_progress")
    .upsert(update, { onConflict: "user_id,lecture_id" });

  if (error) {
    console.error("lecture-progress upsert failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (completed === true) {
    await releaseSignupCommissionIfEligible(admin, user.id).catch((e) =>
      console.error("releaseSignupCommissionIfEligible failed:", e.message)
    );
  }

  return NextResponse.json({ success: true });
}
