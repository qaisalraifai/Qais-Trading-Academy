import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function LecturePage({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lecture } = await supabase
    .from("lectures")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!lecture) redirect("/lecture");

  const { data: lectures } = await supabase
    .from("lectures")
    .select("id, title, order_index")
    .order("order_index", { ascending: true });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: "'Segoe UI', sans-serif",
      direction: "rtl",
      display: "flex",
    }}>
      {/* Sidebar */}
      <div style={{
        width: 280, background: "#111", borderLeft: "1px solid #222",
        padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem",
        overflowY: "auto",
      }}>
        <Link href="/lecture" style={{ color: "#C9A24B", textDecoration: "none", fontSize: 13, marginBottom: "1rem", display: "block" }}>
          ← قائمة المحاضرات
        </Link>
        {lectures?.map((l, index) => (
          <Link key={l.id} href={`/lecture/${l.id}`} style={{ textDecoration: "none" }}>
            <div style={{
              padding: "0.75rem 1rem",
              borderRadius: 8,
              background: l.id === params.id ? "linear-gradient(135deg, #C9A24B22, #a07a2e22)" : "transparent",
              border: l.id === params.id ? "1px solid #C9A24B55" : "1px solid transparent",
              color: l.id === params.id ? "#C9A24B" : "#aaa",
              fontSize: 14,
              cursor: "pointer",
            }}>
              {index + 1}. {l.title}
            </div>
          </Link>
        ))}
      </div>

      {/* Video */}
      <div style={{ flex: 1, padding: "2rem", display: "flex", flexDirection: "column" }}>
        <h2 style={{ margin: "0 0 1rem", fontSize: 22 }}>{lecture.title}</h2>
        {lecture.description && (
          <p style={{ color: "#888", margin: "0 0 1.5rem", fontSize: 14 }}>{lecture.description}</p>
        )}
        <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", background: "#000", borderRadius: 12, overflow: "hidden" }}>
          <iframe
            src={`https://www.youtube.com/embed/${lecture.youtube_video_id}?rel=0&modestbranding=1`}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
            allowFullScreen
          />
        </div>
        <p style={{ color: "#555", fontSize: 12, marginTop: "0.75rem" }}>
          💡 اضغط على أيقونة التكبير ⛶ بالفيديو للعرض بشاشة كاملة
        </p>
      </div>
    </div>
  );
}
