import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import MarkCompleteButton from "@/app/components/MarkCompleteButton";

export default async function LecturePage({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lecture } = await supabase
    .from("lectures")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!lecture) redirect("/dashboard");

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, title")
    .eq("lecture_id", lecture.id)
    .maybeSingle();

  const { data: progress } = await supabase
    .from("student_progress")
    .select("is_completed")
    .eq("student_id", user.id)
    .eq("lecture_id", lecture.id)
    .maybeSingle();

  return (
    <div style={styles.container}>
      <a href="/dashboard" style={styles.back}>
        ← رجوع للوحة
      </a>

      <h1 style={styles.title}>{lecture.title}</h1>

      <div style={styles.videoWrapper}>
        <iframe
          src={`https://www.youtube.com/embed/${lecture.youtube_video_id}`}
          style={styles.iframe}
          allowFullScreen
          title={lecture.title}
        />
      </div>

      {lecture.description && (
        <p style={styles.description}>{lecture.description}</p>
      )}

      <MarkCompleteButton
        lectureId={lecture.id}
        isCompleted={!!progress?.is_completed}
      />

      {quiz && (
        <a href={`/quiz/${quiz.id}`} style={styles.quizButton}>
          📝 ابدأ اختبار: {quiz.title}
        </a>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0f0f0f",
    color: "#fff",
    direction: "rtl",
    fontFamily: "system-ui, sans-serif",
    padding: "2rem",
    maxWidth: "700px",
    margin: "0 auto",
  },
  back: { color: "#10b981", textDecoration: "none", marginBottom: "1rem", display: "inline-block" },
  title: { marginBottom: "1rem" },
  videoWrapper: {
    position: "relative",
    paddingBottom: "56.25%",
    marginBottom: "1.5rem",
    borderRadius: "12px",
    overflow: "hidden",
  },
  iframe: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    border: "none",
  },
  description: { color: "#ccc", marginBottom: "1.5rem", lineHeight: 1.6 },
  quizButton: {
    display: "inline-block",
    marginTop: "1rem",
    padding: "0.75rem 1.5rem",
    backgroundColor: "#3b82f6",
    color: "#fff",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: "bold",
  },
};
