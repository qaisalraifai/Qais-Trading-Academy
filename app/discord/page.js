import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import DiscordSection from "@/app/components/DiscordSection";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";

export default async function DiscordPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("discord_id, discord_username")
    .eq("id", user.id)
    .single();

  const shellProfile = await getShellProfile(supabase, user);

  return (
    <PageShell {...shellProfile}>
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #0E0A1A 0%, #0E0A1A 60%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', sans-serif",
      direction: "rtl",
      padding: "2rem",
    }}>
      {/* أيقونة Discord كبيرة */}
      <div style={{
        width: 120, height: 120,
        background: "linear-gradient(135deg, #5865F2, #4752c4)",
        borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 56,
        boxShadow: "0 0 60px #5865F244, 0 0 120px #5865F222",
        marginBottom: 24,
      }}>
        🎮
      </div>

      <p style={{ color: "#5865F2", letterSpacing: 4, fontSize: 11, margin: "0 0 12px" }}>QAIS TRADING ACADEMY</p>
      <h1 style={{ color: "#fff", fontSize: 28, margin: "0 0 8px", fontWeight: 800 }}>مجتمع Discord</h1>
      <p style={{ color: "#4A4368", fontSize: 14, margin: "0 0 12px", textAlign: "center", maxWidth: 400, lineHeight: 1.7 }}>
        انضم إلى سيرفر Discord الخاص بأكاديمية Qais Trading وتفاعل مع المتداولين واحصل على الدعم والمناقشات اليومية
      </p>

      <div style={{
        background: "#0E0A1A",
        border: "1px solid #5865F233",
        borderRadius: 0,
        padding: "2rem",
        width: "100%",
        maxWidth: 440,
        marginTop: 24,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        <DiscordSection
          discordId={profile?.discord_id}
          discordUsername={profile?.discord_username}
        />
      </div>

      <a href="/dashboard" style={{
        color: "#4A4368", fontSize: 13, textDecoration: "none",
        marginTop: 24, display: "flex", alignItems: "center", gap: 6,
      }}>
        ← رجوع للرئيسية
      </a>
    </div>
    </PageShell>
  );
}
