import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(new URL("/dashboard?discord=cancelled", request.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/dashboard?discord=error", request.url));
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // بادل الـ code بـ access token من Discord
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Discord token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(new URL("/dashboard?discord=error", request.url));
  }

  const tokenData = await tokenRes.json();

  // اجلب هوية حساب Discord (id + username)
  const meRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!meRes.ok) {
    console.error("Discord /users/@me failed:", await meRes.text());
    return NextResponse.redirect(new URL("/dashboard?discord=error", request.url));
  }

  const me = await meRes.json();

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ discord_id: me.id, discord_username: me.username })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to save discord_id:", error);
    return NextResponse.redirect(new URL("/dashboard?discord=error", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard?discord=linked", request.url));
}
