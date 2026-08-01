import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-server";

// دالة مساعدة موحّدة: تجيب بيانات البروفايل اللازمة لتغليف أي صفحة بـ <AppShell>
// (الاسم، هل أدمن، أيام الاشتراك المتبقية) — تُستخدم من كل صفحات app/*/page.js
//
// بوابة اختيار الدفعة: أول ما يسجّل الطالب دخول، لازم يختار دفعته مرة وحدة
// (صفحة كاملة /select-batch) قبل ما يوصل لأي محتوى تاني بالمنصة — بث، دورات،
// إعلانات... إلخ. بما إنه هاي الدالة مستخدمة من كل صفحة تقريبًا، هي المكان
// المركزي المناسب للتحقق، بدل ما نكرر الفحص بكل صفحة لحالها.
// options.skipBatchGate=true بتستخدم بس من صفحة /select-batch نفسها (لتفادي
// حلقة تحويل لا نهائية) ومن صفحات الأدمن الخالصة.
export async function getShellProfile(supabase, user, options = {}) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, role, subscription_end")
    .eq("id", user.id)
    .maybeSingle();

  const username = profile?.username || user.email;
  const isAdmin = profile?.role === "admin";

  if (!options.skipBatchGate && !isAdmin) {
    const admin = createAdminClient();
    const { count } = await admin
      .from("batch_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (!count) redirect("/select-batch");
  }

  let daysLeft = null;
  if (profile?.subscription_end) {
    const diffMs = new Date(profile.subscription_end).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  return { username, isAdmin, daysLeft, initials: (username || "؟").trim().charAt(0).toUpperCase() };
}
