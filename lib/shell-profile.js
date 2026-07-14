// دالة مساعدة موحّدة: تجيب بيانات البروفايل اللازمة لتغليف أي صفحة بـ <AppShell>
// (الاسم، هل أدمن، أيام الاشتراك المتبقية) — تُستخدم من كل صفحات app/*/page.js
export async function getShellProfile(supabase, user) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, role, subscription_end")
    .eq("id", user.id)
    .maybeSingle();

  const username = profile?.username || user.email;
  const isAdmin = profile?.role === "admin";

  let daysLeft = null;
  if (profile?.subscription_end) {
    const diffMs = new Date(profile.subscription_end).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  return { username, isAdmin, daysLeft, initials: (username || "؟").trim().charAt(0).toUpperCase() };
}
