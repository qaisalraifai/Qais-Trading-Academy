import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const username = profile?.username || user.email;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #1a1200 0%, #0a0a0a 60%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', sans-serif",
      direction: "rtl",
      padding: "2rem",
    }}>
      {/* Logo */}
      <div style={{
        width: 100, height: 100, borderRadius: "50%",
        border: "2px solid #C9A24B",
        boxShadow: "0 0 40px #C9A24B44, 0 0 80px #C9A24B22",
        overflow: "hidden", marginBottom: 20,
      }}>
        <img src="/logo.jpg" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      <p style={{ color: "#C9A24B", letterSpacing: 4, fontSize: 11, margin: "0 0 12px" }}>QAIS TRADING ACADEMY</p>
      <h1 style={{ color: "#fff", fontSize: 26, margin: "0 0 6px", fontWeight: 800 }}>أهلاً {username} 👋</h1>
      <p style={{ color: "#555", marginBottom: 40, fontSize: 14 }}>من أين تبدأ جلستك اليوم؟</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 360 }}>
        <Link href="/lecture" style={{
          background: "linear-gradient(145deg, #111108, #0d0d0a)",
          border: "1px solid #C9A24B55",
          color: "#fff", borderRadius: 14, padding: "1.5rem 2rem",
          textDecoration: "none", display: "flex", alignItems: "center", gap: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          <span style={{ fontSize: 36 }}>🎓</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#C9A24B" }}>المحاضرات</div>
            <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>ابدأ التعلم ←</div>
          </div>
        </Link>

        <Link href="/discord" style={{
          background: "linear-gradient(145deg, #0d0d1a, #0a0a14)",
          border: "1px solid #5865F255",
          color: "#fff", borderRadius: 14, padding: "1.5rem 2rem",
          textDecoration: "none", display: "flex", alignItems: "center", gap: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          <span style={{ fontSize: 36 }}>🎮</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#5865F2" }}>مجتمع Discord</div>
            <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>انضم للسيرفر ←</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
