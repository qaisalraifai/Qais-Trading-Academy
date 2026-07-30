import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import PageShell from "@/app/components/layout/PageShell";
import { getShellProfile } from "@/lib/shell-profile";

export default async function LecturesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const shellProfile = await getShellProfile(supabase, user);

  // الكورسات الثلاثة
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .order("order_index", { ascending: true });

  // كل المحاضرات (باش نحسب عدد الدروس والساعات لكل كورس)
  const { data: lectures } = await supabase
    .from("lectures")
    .select("id, course_id, duration_seconds");

  // تقدم الطالب
  const { data: progress } = await supabase
    .from("lecture_progress")
    .select("lecture_id, completed")
    .eq("user_id", user.id);

  const completedIds = new Set(
    (progress || []).filter((p) => p.completed).map((p) => p.lecture_id)
  );

  const courseStats = (courses || []).map((course) => {
    const courseLectures = (lectures || []).filter((l) => l.course_id === course.id);
    const totalLessons = courseLectures.length;
    const totalSeconds = courseLectures.reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
    const completedCount = courseLectures.filter((l) => completedIds.has(l.id)).length;
    const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    const totalHours = totalSeconds / 3600;
    return { ...course, totalLessons, totalHours, completedCount, progressPct };
  });

  return (
    <PageShell {...shellProfile}>
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #1a1608 0%, #181A20 60%)",
      color: "#fff",
      fontFamily: "'Segoe UI', sans-serif",
      direction: "rtl",
      padding: "2rem",
    }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              border: "2px solid #D4AF37",
              boxShadow: "0 0 20px #D4AF3744",
              overflow: "hidden", flexShrink: 0,
            }}>
              <img src="/logo.jpg" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div>
              <p style={{ color: "#D4AF37", fontSize: 11, letterSpacing: 3, margin: 0 }}>QAIS TRADING ACADEMY</p>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>البرامج التعليمية</h1>
            </div>
          </div>
          <Link href="/dashboard" style={{ color: "#555", fontSize: 13, textDecoration: "none" }}>← رجوع</Link>
        </div>

        <p style={{ color: "#555", fontSize: 14, marginBottom: "2rem" }}>اختر البرنامج وابدأ رحلتك التعليمية</p>

        {/* Course Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.5rem",
        }}>
          {courseStats.map((course) => (
            <Link key={course.id} href={`/course/${course.id}`} style={{ textDecoration: "none" }}>
              <div style={{
                background: "linear-gradient(145deg, #111108, #181A20)",
                border: "1px solid #D4AF3733",
                borderRadius: 18,
                padding: "1.75rem",
                cursor: "pointer",
                boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                transition: "transform 0.15s ease",
              }}>
                {/* Icon */}
                <div style={{ fontSize: 40 }}>{course.icon}</div>

                {/* Title + Description */}
                <div>
                  <div style={{ fontWeight: 800, fontSize: 19, color: "#fff", marginBottom: 6 }}>{course.title}</div>
                  {course.description && (
                    <div style={{ color: "#777", fontSize: 13, lineHeight: 1.6 }}>{course.description}</div>
                  )}
                </div>

                {/* Stats */}
                <div style={{ display: "flex", gap: "1.25rem", fontSize: 12, color: "#999" }}>
                  <span>📚 {course.totalLessons} درس</span>
                  <span>⏱ {course.totalHours.toFixed(1)} ساعة</span>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#D4AF37", marginBottom: 6 }}>
                    <span>التقدم</span>
                    <span>{course.progressPct}%</span>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "#1a1a0a", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{
                      width: `${course.progressPct}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #D4AF37, #e6c674)",
                      borderRadius: 5,
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                    {course.completedCount} / {course.totalLessons} درس
                  </div>
                </div>

                {/* Continue button */}
                <div style={{
                  background: "linear-gradient(135deg, #D4AF37, #9C7A22)",
                  color: "#000",
                  fontWeight: 700,
                  fontSize: 13,
                  textAlign: "center",
                  padding: "0.65rem",
                  borderRadius: 10,
                  boxShadow: "0 4px 12px #D4AF3733",
                }}>
                  {course.progressPct > 0 ? "متابعة" : "ابدأ الآن"}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {(!courseStats || courseStats.length === 0) && (
          <div style={{ color: "#555", textAlign: "center", padding: "3rem 0" }}>
            لا توجد برامج تعليمية بعد.
          </div>
        )}

      </div>
    </div>
    </PageShell>
  );
}
