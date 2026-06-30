import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  let debugInfo = "";
  if (profileError) {
    debugInfo = "ERR:" + profileError.message;
  } else if (!profile) {
    debugInfo = "NO_PROFILE";
  } else if (!profile.username) {
    debugInfo = "EMPTY_USERNAME";
  }

  const display = `EMAIL_${user.email}_${debugInfo || ("USERNAME_" + profile.username)}`;
  const encodedUser = encodeURIComponent(display);

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
