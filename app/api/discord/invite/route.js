import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createSingleUseInvite } from "@/lib/discord";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مسجل دخول" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, discord_id")
    .eq("id", user.id)
    .single();

  if (!profile?.discord_id) {
    return NextResponse.json(
      { error: "لازم تربطي حساب Discord أولاً" },
      { status: 400 }
    );
  }

  if (profile.subscription_status !== "active") {
    return NextResponse.json({ error: "اشتراكك غير نشط حالياً" }, { status: 403 });
  }

  try {
    const url = await createSingleUseInvite();
    return NextResponse.json({ url });
  } catch (e) {
    console.error("Create invite error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
