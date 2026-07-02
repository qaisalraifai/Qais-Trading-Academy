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
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: "'Segoe UI', sans-serif",
      direction: "rtl",
      padding: "2rem",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
          <img src="/logo.jpg" style={{ width: 50, borderRadius: "50%" }} />
          <div>
            <p style={{ color: "#C9A24B", fontSize: 12, letterSpacing: 2, margin: 0 }}>QAIS TRADING ACADEMY</p>
            <h1 style={{ margin: 0, fontSize: 24 }}>المحاضرات</h1>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {lectures?.map((lecture, index) => (
            <Link key={lecture.id} href={`/lecture/${lecture.id}`} style={{ textDecoration: "none" }}>
              <div style={{
                background: "#111",
                border: "1px solid #222",
                borderRadius: 12,
                padding: "1.2rem 1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                cursor: "pointer",
                transition: "border-color 0.2s",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: "linear-gradient(135deg, #C9A24B, #a07a2e)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: "bold", color: "#000", fontSize: 18, flexShrink: 0,
                }}>
                  {index + 1}
                </div>
                <div>
                  <div style={{ fontWeight: "bold", fontSize: 16, color: "#fff" }}>{lecture.title}</div>
                  {lecture.description && (
                    <div style={{ color: "#888", fontSize: 13, marginTop: 4 }}>{lecture.description}</div>
                  )}
                </div>
                <div style={{ marginRight: "auto", color: "#C9A24B", fontSize: 20 }}>←</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
