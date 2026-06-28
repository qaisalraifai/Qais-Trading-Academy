import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import LogoutButton from "@/app/components/LogoutButton";

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const { data: lectures } = await supabase
    .from("lectures")
    .select("*")
    .order("order_index", { ascending: true });

  const { data: progress } = await supabase
    .from("student_progress")
    .select("lecture_id, is_completed")
    .eq("student_id", user.id);

  const completedIds = new Set(
    (progress || []).filter((p) => p.is_completed).map((p) => p.lecture_id)
  );

  const total = lectures?.length || 0;
  const completedCount = completedIds.size;
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>أهلاً، {profile?.username}</h1>
        <LogoutButton />
      </div>

      <div style={styles.progressBox}>
        <p style={styles.progressText}>
          تقدمك: {completedCount} من {total} محاضرة ({percent}%)
        </p>
        <div style={styles.progressBarBg}>
          <div style={{ ...styles.progressBarFill, width: `${percent}%` }} />
        </div>
      </div>

      <h2 style={styles.subtitle}>المحاضرات</h2>

      <div style={styles.list}>
        {(lectures || []).map((lecture) => (
          <a
            key={lecture.id}
            href={`/lecture/${lecture.id}`}
            style={styles.card}
          >
            <span style={styles.cardTitle}>{lecture.title}</span>
            <span style={styles.badge}>
              {completedIds.has(lecture.id) ? "✅ مكتملة" : "▶️ ابدأ"}
            </span>
          </a>
        ))}

        {(!lectures || lectures.length === 0) && (
          <p style={{ color: "#999" }}>لا توجد محاضرات بعد.</p>
        )}
      </div>
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem",
  },
  title: { fontSize: "1.5rem" },
  progressBox: {
    backgroundColor: "#1a1a1a",
    padding: "1rem",
    borderRadius: "12px",
    marginBottom: "2rem",
  },
  progressText: { marginBottom: "0.5rem", color: "#ccc" },
  progressBarBg: {
    backgroundColor: "#333",
    borderRadius: "8px",
    height: "10px",
    overflow: "hidden",
  },
  progressBarFill: {
    backgroundColor: "#10b981",
    height: "100%",
    transition: "width 0.3s",
  },
  subtitle: { marginBottom: "1rem" },
  list: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  card: {
    backgroundColor: "#1a1a1a",
    padding: "1rem",
    borderRadius: "10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#fff",
    textDecoration: "none",
  },
  cardTitle: { fontSize: "1rem" },
  badge: { fontSize: "0.85rem", color: "#10b981" },
};
