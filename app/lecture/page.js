import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function LecturesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lectures } = await supabase
    .from("lectures")
    .select("*")
    .order("order_index", { ascending: true });

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #1a1200 0%, #0a0a0a 60%)",
      color: "#fff",
      fontFamily: "'Segoe UI', sans-serif",
      direction: "rtl",
      padding: "2rem",
    }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              border: "2px solid #C9A24B",
              boxShadow: "0 0 20px #C9A24B44",
              overflow: "hidden", flexShrink: 0,
            }}>
              <img src="/logo.jpg" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div>
              <p style={{ color: "#C9A24B", fontSize: 11, letterSpacing: 3, margin: 0 }}>QAIS TRADING ACADEMY</p>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>المحاضرات</h1>
            </div>
          </div>
          <Link href="/dashboard" style={{ color: "#555", fontSize: 13, textDecoration: "none" }}>← رجوع</Link>
        </div>

        <p style={{ color: "#555", fontSize: 14, marginBottom: "2rem" }}>تعلم من الأفضل</p>

        {/* Lectures List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {lectures?.map((lecture, index) => (
            <Link key={lecture.id} href={`/lecture/${lecture.id}`} style={{ textDecoration: "none" }}>
              <div style={{
                background: "linear-gradient(145deg, #111108, #0d0d0a)",
                border: "1px solid #C9A24B22",
                borderRadius: 14,
                padding: "1.2rem 1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "1.2rem",
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}>
                {/* Number */}
                <div style={{
                  width: 46, height: 46, borderRadius: "50%",
                  background: "linear-gradient(135deg, #C9A24B, #a07a2e)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, color: "#000", fontSize: 18, flexShrink: 0,
                  boxShadow: "0 4px 12px #C9A24B44",
                }}>
                  {index + 1}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>{lecture.title}</div>
                  {lecture.description && (
                    <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>{lecture.description}</div>
                  )}
                </div>

                {/* Arrow */}
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "#C9A24B22",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#C9A24B", fontSize: 16, flexShrink: 0,
                }}>←</div>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
