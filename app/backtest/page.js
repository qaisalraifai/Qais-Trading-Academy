import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function BacktestPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // لو مش مسجل دخول، رجّعه لصفحة تسجيل الدخول
  if (!user) {
    redirect("/login");
  }

  // جيب اسم المستخدم من جدول profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const username = profile?.username || "ضيف";
  const encodedUser = encodeURIComponent(username);

  return (
    <div style={{ width: "100vw", height: "100vh", margin: 0, padding: 0, overflow: "hidden" }}>
      <iframe
        src={`https://qaisalraifai.github.io/backtest-qta/?user=${encodedUser}`}
        style={{ width: "100%", height: "100%", border: "none" }}
        allow="fullscreen"
      />
    </div>
  );
}
