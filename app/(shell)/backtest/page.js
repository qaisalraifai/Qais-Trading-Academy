import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getVerifiedUserId } from "@/lib/auth-context";
import { redirect } from "next/navigation";
import BacktestClient from "./BacktestClient";

export const dynamic = "force-dynamic";

export default async function BacktestPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  /* ⚠️ الهوية من ترويسة الـmiddleware المتحقَّقة — نفس سبب `dashboard/page.js`:
     الفحص انعمل قبل شوي بنفس الطلب، وإعادته رحلة شبكية لنتيجة موجودة.
     `getVerifiedUserId` بترجع لـ`auth.getUser()` كامل لو الترويسة غابت، فنموذج
     الثقة ما تغيّر. */
  const userId = await getVerifiedUserId();

  if (!userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, backtest_balance")
    .eq("id", userId)
    .single();

  const username = profile?.username || "ضيف";
  const initialBalance = profile?.backtest_balance ?? 3000;

  const { data: tradesRows } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return (
    <BacktestClient
      userId={userId}
      username={username}
      initialBalance={Number(initialBalance)}
      initialTrades={tradesRows || []}
    />
  );
}
