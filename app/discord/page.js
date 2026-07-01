import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import DiscordSection from "@/app/components/DiscordSection";

export default async function DiscordPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("discord_id, discord_username")
    .eq("id", user.id)
    .single();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', sans-serif",
      direction: "rtl",
    }}>
      <img src="/logo.png" alt="QTA" style={{ width: 80, marginBottom: 20, borderRadius: "50%" }} />
      <p style={{ color: "#C9A24B", letterSpacing: 3, fontSize: 13, marginBottom: 24 }}>QAIS TRADING ACADEMY</p>
      <h2 style={{ color: "#fff", fontSize: 24, marginBottom: 40 }}>مجتمع Discord 🎮</h2>
      <DiscordSection
        discordId={profile?.discord_id}
        discordUsername={profile?.discord_username}
      />
    </div>
  );
}
