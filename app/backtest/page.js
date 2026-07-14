import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import BacktestClient from "./BacktestClient";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, backtest_balance")
    .eq("id", user.id)
    .single();

  const username = profile?.username || "ضيف";
  const initialBalance = profile?.backtest_balance ?? 3000;
  const shellProfile = await getShellProfile(supabase, user);

  const { data: tradesRows } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <PageShell {...shellProfile}>
      <BacktestClient
        userId={user.id}
        username={username}
        initialBalance={Number(initialBalance)}
        initialTrades={tradesRows || []}
      />
    </PageShell>
  );
}
