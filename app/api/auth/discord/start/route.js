import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify",
    state: user.id,
    prompt: "consent",
  });

  return NextResponse.redirect(
    `https://discord.com/api/oauth2/authorize?${params.toString()}`
  );
}
