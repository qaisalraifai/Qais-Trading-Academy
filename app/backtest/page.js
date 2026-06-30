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

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  // وضع تشخيص مؤقت: لو في خطأ أو ما في بيانات، نعرضه بدل "ضيف"
  let debugInfo = "";
  if (profileError) {
    debugInfo = "ERR:" + profileError.message;
  } else if (!profile) {
    debugInfo = "NO_PROFILE_FOUND_id_" + user.id.slice(0, 8);
  } else if (!profile.username) {
    debugInfo = "USERNAME_EMPTY";
  }

  const username = profile?.username || debugInfo || "ضيف";
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
