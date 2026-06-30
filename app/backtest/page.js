import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
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

  let debugInfo = "";

  // تحقق إذا متغير SERVICE_ROLE_KEY موجود أصلاً
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    debugInfo = "NO_SERVICE_KEY_ENV";
  }

  let username = "ضيف";

  if (!debugInfo) {
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    if (profileError) {
      debugInfo = "ADMIN_ERR:" + profileError.message;
    } else if (!profile) {
      debugInfo = "ADMIN_NO_PROFILE_id_" + user.id.slice(0, 8);
    } else if (!profile.username) {
      debugInfo = "ADMIN_USERNAME_EMPTY";
    } else {
      username = profile.username;
    }
  }

  const finalDisplay = debugInfo || username;
  const encodedUser = encodeURIComponent(finalDisplay);

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
