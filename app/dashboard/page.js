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
      background: "#0a0a0a",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', sans-serif",
      direction: "rtl",
    }}>
      <img src="/logo.jpg" alt="QTA" style={{ width: 90, marginBottom: 24, borderRadius: "50%" }} />
      <p style={{ color: "#C9A24B", letterSpacing: 3, fontSize: 13, marginBottom: 8 }}>QAIS TRADING ACADEMY</p>
      <h1 style={{ color: "#fff", fontSize: 28, margin: "0 0 6px" }}>أهلاً {username} 👋</h1>
      <p style={{ color: "#666", marginBottom: 48, fontSize: 15 }}>من أين تبدأ جلستك اليوم؟</p>

      <Link href="/lecture" style={{
        background: "linear-gradient(135deg, #C9A24B, #a07a2e)",
        color: "#000",
        borderRadius: 20,
        padding: "32px 60px",
        fontSize: 22,
        fontWeight: "bold",
        textDecoration: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 8px 32px rgba(201,162,75,0.3)",
      }}>
        <span style={{ fontSize: 48 }}>🎓</span>
        <span>المحاضرات</span>
        <span style={{ fontSize: 13, fontWeight: "normal", opacity: 0.8 }}>ابدأ التعلم ←</span>
      </Link>
    </div>
  );
}
