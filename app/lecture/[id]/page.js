import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";
import LectureCompleteButton from "./LectureCompleteButton";

export default async function LecturePage({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const shellProfile = await getShellProfile(supabase, user);

  const { data: lecture } = await supabase
    .from("lectures").select("*").eq("id", params.id).single();
  if (!lecture) redirect("/lecture");

  const { data: progress } = await supabase
    .from("lecture_progress")
    .select("completed")
    .eq("user_id", user.id)
    .eq("lecture_id", params.id)
    .maybeSingle();

  const { data: lectures } = await supabase
    .from("lectures").select("id, title, order_index")
    .order("order_index", { ascending: true });

  return (
    <PageShell {...shellProfile}>
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #120B24 0%, #0E0A1A 60%)",
      color: "#fff",
      fontFamily: "'Segoe UI', sans-serif",
      direction: "rtl",
      display: "flex",
    }}>
      {/* Sidebar */}
      <div style={{
        width: 280,
        background: "linear-gradient(180deg, #141024 0%, #0E0A1A 100%)",
        borderLeft: "1px solid #2A2145",
        padding: "1.5rem 1rem",
        display: "flex", flexDirection: "column", gap: "0.5rem",
        overflowY: "auto",
      }}>
        {/* Logo + Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid #1E1836" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #DCD4F7", overflow: "hidden", flexShrink: 0 }}>
            <img src="/logo.svg" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div>
            <p style={{ color: "#DCD4F7", fontSize: 9, letterSpacing: 2, margin: 0 }}>QTA</p>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 700, margin: 0 }}>المحاضرات</p>
          </div>
        </div>

        <Link href="/lecture" style={{ color: "#DCD4F7", textDecoration: "none", fontSize: 12, marginBottom: "0.5rem", display: "block" }}>
          ← قائمة المحاضرات
        </Link>

        {lectures?.map((l, index) => (
          <Link key={l.id} href={`/lecture/${l.id}`} style={{ textDecoration: "none" }}>
            <div style={{
              padding: "0.75rem 1rem",
              borderRadius: 3,
              background: l.id === params.id ? "linear-gradient(135deg, #2A2145, #8A7CB811)" : "transparent",
              border: l.id === params.id ? "1px solid #3D2F63" : "1px solid transparent",
              color: l.id === params.id ? "#DCD4F7" : "#6E6690",
              fontSize: 13,
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: l.id === params.id ? "linear-gradient(135deg, #DCD4F7, #8A7CB8)" : "#1E1836",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: l.id === params.id ? "#000" : "#4A4368",
                flexShrink: 0,
              }}>
                {index + 1}
              </div>
              {l.title}
            </div>
          </Link>
        ))}
      </div>

      {/* Video Area */}
      <div style={{ flex: 1, padding: "2rem", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ color: "#DCD4F7", fontSize: 11, letterSpacing: 3, margin: "0 0 8px" }}>QAIS TRADING ACADEMY</p>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{lecture.title}</h2>
          {lecture.description && (
            <p style={{ color: "#6E6690", margin: "8px 0 0", fontSize: 14 }}>{lecture.description}</p>
          )}
        </div>

        {/* Video */}
        <div style={{
          position: "relative", width: "100%", paddingTop: "56.25%",
          background: "#000", borderRadius: 0, overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          border: "1px solid #2A2145",
        }}>
          <iframe
            src={
              lecture.video_provider === "drive"
                ? `https://drive.google.com/file/d/${lecture.youtube_video_id}/preview`
                : `https://www.youtube.com/embed/${lecture.youtube_video_id}?rel=0&modestbranding=1`
            }
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>

        <p style={{ color: "#4A4368", fontSize: 12, marginTop: "0.75rem" }}>اضغط على أيقونة التكبير ⛶ بالفيديو للعرض بشاشة كاملة
        </p>

        <LectureCompleteButton lectureId={params.id} initialCompleted={!!progress?.completed} />
      </div>
    </div>
    </PageShell>
  );
}
