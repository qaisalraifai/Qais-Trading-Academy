"use client";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase-client";

/* ============================================================================
   CoursesClient — Workspace مستقلة لـ "المحاضرات / الكورسات".
   منقول حرفياً (نفس الكود ونفس منطق الجلب) من app/dashboard/DashboardClient.js
   لتشغيله كصفحة مستقلة بكامل عرض الشاشة بدل تبويب داخل الداشبورد.
   ============================================================================ */

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";
const GOLD_DARK = "#9C7A22";

const cardStyle = {
  background: "linear-gradient(145deg, #22252B, #181A20)",
  border: `1px solid ${GOLD}26`,
  borderRadius: 18,
  boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
};

const DIFFICULTY_LABELS = {
  beginner: { label: "مبتدئ", color: "#4CAF50" },
  intermediate: { label: "متوسط", color: "#FFA726" },
  advanced: { label: "متقدم", color: "#EF5350" },
};

const LECTURE_FILTERS = [
  { key: "all", label: "الكل" },
  { key: "completed", label: "مكتملة" },
  { key: "incomplete", label: "غير مكتملة" },
  { key: "favorite", label: "المفضلة" },
];

function formatDuration(seconds) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatLastWatched(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  return date.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

const COURSE_COLORS = [
  { solid: "#3DDC84", soft: "#3DDC8422", border: "#3DDC8455" },
  { solid: "#B084F5", soft: "#B084F522", border: "#B084F555" },
  { solid: "#4FA0F5", soft: "#4FA0F522", border: "#4FA0F555" },
];

const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced"];
const DIFFICULTY_AR = { beginner: "مبتدئ", intermediate: "متوسط", advanced: "متقدم" };
function LecturesView({
  username, currentStreak = 0,
  courses, allLectures, progressMap, loading,
  selectedCourseId, onSelectCourse, onBackToCourses,
  selectedLecture, onSelect, onBack,
  batchInfo, onEnrollBatch, enrolling,
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid");

  const courseStats = useMemo(() => {
    return courses.map((course, index) => {
      const courseLectures = allLectures.filter((l) => l.course_id === course.id);
      const totalLessons = courseLectures.length;
      const totalSeconds = courseLectures.reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
      const completedCount = courseLectures.filter((l) => progressMap[l.id]?.completed).length;
      const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

      const presentDifficulties = DIFFICULTY_ORDER.filter((d) => courseLectures.some((l) => l.difficulty === d));
      let difficultyLabel = null;
      if (presentDifficulties.length === 1) difficultyLabel = DIFFICULTY_AR[presentDifficulties[0]];
      else if (presentDifficulties.length > 1) {
        difficultyLabel = `${DIFFICULTY_AR[presentDifficulties[0]]} - ${DIFFICULTY_AR[presentDifficulties[presentDifficulties.length - 1]]}`;
      }

      return {
        ...course,
        totalLessons,
        totalHours: totalSeconds / 3600,
        completedCount,
        progressPct,
        difficultyLabel,
        color: COURSE_COLORS[index % COURSE_COLORS.length],
      };
    });
  }, [courses, allLectures, progressMap]);

  // إحصائيات عامة للبانر
  const overallStats = useMemo(() => {
    const totalLessons = allLectures.length;
    const completedSeconds = allLectures
      .filter((l) => progressMap[l.id]?.completed)
      .reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
    const completedCount = allLectures.filter((l) => progressMap[l.id]?.completed).length;
    const overallPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    return { totalLessons, completedHours: completedSeconds / 3600, overallPct };
  }, [allLectures, progressMap]);

  // آخر محاضرة عم يتابعها الطالب (لزر "متابعة التعلم")
  const continueLecture = useMemo(() => {
    const inProgress = allLectures
      .filter((l) => {
        const p = progressMap[l.id];
        return p && !p.completed && p.last_watched_at;
      })
      .sort((a, b) => new Date(progressMap[b.id].last_watched_at) - new Date(progressMap[a.id].last_watched_at));
    if (inProgress.length > 0) return { ...inProgress[0], progress: progressMap[inProgress[0].id] };
    return null;
  }, [allLectures, progressMap]);

  const selectedCourse = courseStats.find((c) => c.id === selectedCourseId) || null;

  const chapters = useMemo(() => {
    if (!selectedCourseId) return [];
    const resolvedBatchCourseId = batchInfo?.batch_course_id ?? null;
    const courseLectures = allLectures.filter(
      (l) => l.course_id === selectedCourseId && (l.batch_course_id === null || l.batch_course_id === resolvedBatchCourseId)
    );
    const order = [];
    const map = new Map();
    courseLectures.forEach((lecture) => {
      const chapterName = lecture.chapter || "عام";
      if (!map.has(chapterName)) {
        map.set(chapterName, { name: chapterName, order: lecture.chapter_order ?? 999, lectures: [] });
        order.push(chapterName);
      }
      map.get(chapterName).lectures.push({ ...lecture, progress: progressMap[lecture.id] || null });
    });
    return order.map((name) => map.get(name)).sort((a, b) => a.order - b.order);
  }, [selectedCourseId, allLectures, progressMap, batchInfo]);

  const filteredChapters = useMemo(() => {
    return chapters
      .map((chapter) => {
        const filteredLectures = chapter.lectures.filter((lecture) => {
          const matchesSearch = !search.trim() || lecture.title?.toLowerCase().includes(search.trim().toLowerCase());
          const isCompleted = !!lecture.progress?.completed;
          const isFavorite = !!lecture.progress?.favorite;
          let matchesFilter = true;
          if (filter === "completed") matchesFilter = isCompleted;
          else if (filter === "incomplete") matchesFilter = !isCompleted;
          else if (filter === "favorite") matchesFilter = isFavorite;
          return matchesSearch && matchesFilter;
        });
        return { ...chapter, filteredLectures };
      })
      .filter((chapter) => chapter.filteredLectures.length > 0);
  }, [chapters, search, filter]);

  if (loading) {
    return (
      <div style={{ color: "#666", fontSize: 14, padding: "3rem 0", textAlign: "center" }}>
        ...جاري تحميل البرامج التعليمية
      </div>
    );
  }

  /* المستوى 3: مشغل الفيديو */
  if (selectedLecture) {
    return (
      <div style={{ ...cardStyle, padding: "1.3rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{selectedLecture.title}</h2>
            {selectedLecture.description && (
              <p style={{ color: "#666", margin: "6px 0 0", fontSize: 13 }}>{selectedLecture.description}</p>
            )}
          </div>
          <div onClick={onBack} style={{ color: GOLD, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
            ← رجوع للمحاضرات
          </div>
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            paddingTop: "56.25%",
            background: "#000",
            borderRadius: 12,
            overflow: "hidden",
            border: `1px solid ${GOLD}22`,
          }}
        >
          <iframe
            src={
              selectedLecture.video_provider === "drive"
                ? `https://drive.google.com/file/d/${selectedLecture.youtube_video_id}/preview`
                : `https://www.youtube.com/embed/${selectedLecture.youtube_video_id}?rel=0&modestbranding=1`
            }
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  /* المستوى 2: فصول ومحاضرات كورس معيّن */
  if (selectedCourse) {
    // بوابة اختيار الدفعة — أول مرة الطالب يفتح هاي الدورة ولسا ما اختار دفعته
    if (batchInfo?.needs_selection) {
      return (
        <div style={{ ...cardStyle, padding: "1.3rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 26 }}>{selectedCourse.icon}</div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{selectedCourse.title}</h2>
            </div>
            <div onClick={onBackToCourses} style={{ color: GOLD, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
              ← البرامج التعليمية
            </div>
          </div>
          <p style={{ color: "#999", fontSize: 14, marginBottom: "1.2rem" }}>
            اختاري الدفعة اللي بدك تنضمي فيها لهاي الدورة قبل ما تبلشي بالمحاضرات:
          </p>
          {batchInfo.batches.length === 0 ? (
            <p style={{ color: "#666", fontSize: 14 }}>ما في دفعات متاحة للتسجيل هلأ لهاي الدورة. تواصلي معنا للمساعدة.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {batchInfo.batches.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "#181A20", border: `1px solid ${GOLD}22`, borderRadius: 10, padding: "0.9rem 1.1rem",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{b.name}</p>
                    <p style={{ margin: "0.3rem 0 0", color: "#666", fontSize: 12 }}>
                      {b.start_date || "—"} → {b.end_date || "—"}
                      {b.seats_total != null && ` — ${b.seats_remaining} مقعد متاح`}
                    </p>
                  </div>
                  <button
                    onClick={() => onEnrollBatch(b.id)}
                    disabled={enrolling || b.is_full}
                    style={{
                      background: b.is_full ? "#333" : GOLD, color: b.is_full ? "#888" : "#000",
                      border: "none", borderRadius: 8, padding: "0.55rem 1.1rem", fontWeight: 700,
                      fontSize: 13, cursor: b.is_full ? "not-allowed" : "pointer",
                    }}
                  >
                    {b.is_full ? "مكتملة" : enrolling ? "جاري التسجيل..." : "انضمي"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={{ ...cardStyle, padding: "1.3rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 26 }}>{selectedCourse.icon}</div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{selectedCourse.title}</h2>
          </div>
          <div onClick={onBackToCourses} style={{ color: GOLD, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
            ← البرامج التعليمية
          </div>
        </div>

        {/* بحث وفلترة */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginBottom: "1.5rem" }}>
          <input
            type="text"
            placeholder="🔍 البحث عن محاضرة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: "1 1 200px",
              background: "#181A20",
              border: `1px solid ${GOLD}33`,
              borderRadius: 10,
              padding: "0.6rem 1rem",
              color: "#fff",
              fontSize: 13,
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {LECTURE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  background: filter === f.key ? `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})` : "#181A20",
                  color: filter === f.key ? "#000" : "#999",
                  border: filter === f.key ? "none" : `1px solid ${GOLD}22`,
                  borderRadius: 8,
                  padding: "0.55rem 0.9rem",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {filteredChapters.map((chapter) => {
            const total = chapter.lectures.length;
            const completed = chapter.lectures.filter((l) => l.progress?.completed).length;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            return (
              <div key={chapter.name}>
                <div style={{ marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>{chapter.name}</h3>
                    <span style={{ fontSize: 11, color: GOLD, fontWeight: 700 }}>
                      {pct}% &nbsp;·&nbsp; {completed} / {total} درس
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 5, background: "#1a1a0a", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`, borderRadius: 3 }} />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                  {chapter.filteredLectures.map((lecture) => {
                    const diff = DIFFICULTY_LABELS[lecture.difficulty];
                    const isCompleted = !!lecture.progress?.completed;
                    const watchedPct = lecture.progress?.watched_pct || 0;
                    const lastWatched = formatLastWatched(lecture.progress?.last_watched_at);
                    const duration = formatDuration(lecture.duration_seconds);

                    return (
                      <div
                        key={lecture.id}
                        onClick={() => onSelect(lecture)}
                        style={{
                          background: "#181A20",
                          border: isCompleted ? "1px solid #4CAF5044" : `1px solid ${GOLD}22`,
                          borderRadius: 12,
                          padding: "0.9rem 1.1rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "1rem",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: isCompleted ? "#4CAF5022" : `${GOLD}22`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 15, flexShrink: 0,
                        }}>
                          {isCompleted ? "✅" : "▶️"}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{lecture.title}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem", marginTop: 4, fontSize: 11, color: "#777" }}>
                            {duration && <span>⏱ {duration}</span>}
                            {diff && <span style={{ color: diff.color }}>🟢 {diff.label}</span>}
                            {lecture.practice_type && <span>🧪 تمرين تطبيقي</span>}
                            {lastWatched && <span>📅 آخر مشاهدة: {lastWatched}</span>}
                          </div>
                          {!isCompleted && watchedPct > 0 && (
                            <div style={{ width: "100%", height: 3, background: "#1a1a0a", borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
                              <div style={{ width: `${watchedPct}%`, height: "100%", background: `${GOLD}88`, borderRadius: 2 }} />
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                          {lecture.progress?.favorite && <span style={{ fontSize: 13 }}>⭐</span>}
                          <div style={{ color: GOLD, fontSize: 14 }}>←</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredChapters.length === 0 && (
            <div style={{ color: "#444", fontSize: 13, textAlign: "center", padding: "2rem 0" }}>
              لا توجد نتائج مطابقة.
            </div>
          )}
        </div>
      </div>
    );
  }

  /* المستوى 1: بانر الترحيب + الإحصائيات + بطاقات البرامج */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>

      {/* بانر الترحيب */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          background: `linear-gradient(135deg, #2B2F36 0%, #181A20 60%)`,
          border: `1px solid ${GOLD}33`,
          borderRadius: 16,
          padding: "1.6rem 1.8rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, zIndex: 1 }}>
          <div
            style={{
              width: 54, height: 54, borderRadius: "50%",
              background: `${GOLD}18`, border: `2px solid ${GOLD}55`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0,
            }}
          >
            🎓
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>مرحباً {username} 👋</p>
            <p style={{ margin: "5px 0 0", color: "#999", fontSize: 13 }}>واصل رحلتك التعليمية وتعلم التداول باحترافية</p>
          </div>
        </div>

        {/* رسم زخرفي: أعمدة متصاعدة */}
        <svg width="150" height="70" viewBox="0 0 150 70" style={{ opacity: 0.55, flexShrink: 0 }}>
          {[14, 24, 18, 34, 26, 46, 60].map((h, i) => (
            <rect key={i} x={i * 21} y={70 - h} width="12" height={h} rx="3" fill={GOLD} opacity={0.25 + i * 0.09} />
          ))}
          <polyline points="0,55 21,45 42,50 63,30 84,38 105,15 126,5" fill="none" stroke={GOLD_LIGHT} strokeWidth="2" />
        </svg>

        <div
          onClick={() => {
            if (continueLecture) onSelect(continueLecture);
            else if (courseStats[0]) onSelectCourse(courseStats[0].id);
          }}
          style={{
            background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
            color: "#1a1608", fontWeight: 800, fontSize: 13,
            padding: "0.8rem 1.4rem", borderRadius: 10, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, zIndex: 1, whiteSpace: "nowrap",
          }}
        >
          <span>{continueLecture ? "متابعة التعلم" : "ابدأ الآن"}</span>
          <span>▶️</span>
        </div>
      </div>

      {/* إحصائيات عامة */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.9rem" }}>
        {[
          { label: "إجمالي الدروس", value: overallStats.totalLessons, icon: null },
          { label: "الساعات المكتملة", value: `${overallStats.completedHours.toFixed(1)} ساعة`, icon: null },
          { label: "نسبة التقدم الإجمالية", value: `${overallStats.overallPct}%`, ring: overallStats.overallPct },
          { label: "أيام متتالية 🔥", value: `${currentStreak} يوم`, icon: null },
        ].map((s, i) => (
          <div key={i} style={{ ...cardStyle, padding: "1rem 1.2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ color: "#888", fontSize: 11, margin: 0 }}>{s.label}</p>
              <p style={{ color: "#fff", fontSize: 19, fontWeight: 800, margin: "4px 0 0" }}>{s.value}</p>
            </div>
            {s.ring !== undefined && (
              <div
                style={{
                  width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                  background: `conic-gradient(${GOLD} ${s.ring * 3.6}deg, #1a1a0a 0deg)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#181A20" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* عنوان القسم + تبديل العرض */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
        <div>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>البرامج التعليمية</p>
          <p style={{ margin: "4px 0 0", color: "#777", fontSize: 12.5 }}>اختر البرنامج الذي تريد متابعته</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { key: "grid", icon: "▦" },
            { key: "list", icon: "☰" },
          ].map((v) => (
            <div
              key={v.key}
              onClick={() => setViewMode(v.key)}
              style={{
                width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                background: viewMode === v.key ? `${GOLD}22` : "#181A20",
                border: viewMode === v.key ? `1px solid ${GOLD}66` : `1px solid ${GOLD}22`,
                color: viewMode === v.key ? GOLD_LIGHT : "#666",
                cursor: "pointer", fontSize: 14,
              }}
            >
              {v.icon}
            </div>
          ))}
        </div>
      </div>

      {/* بطاقات البرامج */}
      <div
        style={{
          display: viewMode === "grid" ? "grid" : "flex",
          flexDirection: viewMode === "grid" ? undefined : "column",
          gridTemplateColumns: viewMode === "grid" ? "repeat(auto-fit, minmax(240px, 1fr))" : undefined,
          gap: "1rem",
        }}
      >
        {courseStats.length === 0 ? (
          <div style={{ color: "#444", fontSize: 13, textAlign: "center", padding: "2rem 0" }}>
            لا توجد برامج تعليمية بعد
          </div>
        ) : (
          courseStats.map((course) => (
            <div
              key={course.id}
              onClick={() => onSelectCourse(course.id)}
              style={{
                background: "#181A20",
                border: `1px solid ${course.color.border}`,
                borderRadius: 14,
                padding: "1.25rem",
                cursor: "pointer",
                display: "flex",
                flexDirection: viewMode === "grid" ? "column" : "row",
                alignItems: viewMode === "grid" ? "stretch" : "center",
                gap: "0.9rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
                <div
                  style={{
                    width: 46, height: 46, borderRadius: 10, background: course.color.soft,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0,
                  }}
                >
                  {course.icon}
                </div>
                {course.difficultyLabel && (
                  <span
                    style={{
                      background: course.color.soft, color: course.color.solid,
                      fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                      border: `1px solid ${course.color.border}`, whiteSpace: "nowrap",
                    }}
                  >
                    {course.difficultyLabel}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>{course.title}</div>
                {course.description && (
                  <div style={{ color: "#777", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>{course.description}</div>
                )}
                <div style={{ display: "flex", gap: "0.9rem", fontSize: 11.5, color: "#999", marginTop: 8 }}>
                  <span>📖 {course.totalLessons} درس</span>
                  <span>⏱ {course.totalHours.toFixed(1)} ساعة</span>
                </div>
              </div>

              <div style={{ minWidth: viewMode === "grid" ? undefined : 200, flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: course.color.solid, marginBottom: 5 }}>
                  <span>التقدم</span>
                  <span>{course.progressPct}%</span>
                </div>
                <div style={{ width: "100%", minWidth: 140, height: 6, background: "#1a1a0a", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${course.progressPct}%`, height: "100%", background: course.color.solid, borderRadius: 4 }} />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: viewMode === "grid" ? "column" : "row", gap: "0.5rem", flexShrink: 0 }}>
                <div
                  style={{
                    border: `1px solid ${course.color.solid}66`, color: course.color.solid,
                    fontWeight: 700, fontSize: 12, textAlign: "center",
                    padding: "0.55rem 1rem", borderRadius: 8, whiteSpace: "nowrap",
                  }}
                >
                  متابعة البرنامج ‹
                </div>
                <div style={{ color: "#888", fontSize: 11.5, textAlign: "center", padding: "0.3rem", textDecoration: "underline", whiteSpace: "nowrap" }}>
                  عرض المحتوى
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* شريط الميزات */}
      <div style={{ ...cardStyle, padding: "1.2rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
        {[
          { icon: "🎓", label: "شهادة معتمدة", sub: "احصل على شهادة عند إكمال جميع البرامج" },
          { icon: "🏆", label: "اختبارات وتقييمات", sub: "اختبر معلوماتك بعد كل فصل وتابع تقدمك" },
          { icon: "📈", label: "تطبيق عملي", sub: "طبق ما تتعلمه مباشرة على الشارت" },
          { icon: "⭐", label: "إنجازات ومكافآت", sub: "حقق الإنجازات وارتقِ في المستويات" },
        ].map((f, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6 }}>
            <div
              style={{
                width: 46, height: 46, borderRadius: "50%", background: `${GOLD}18`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}
            >
              {f.icon}
            </div>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#eee" }}>{f.label}</p>
            <p style={{ margin: 0, fontSize: 10.5, color: "#666", lineHeight: 1.4 }}>{f.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------- غلاف الصفحة: يجيب البيانات ويعرض LecturesView -------------------- */
export default function CoursesClient({ username, currentStreak = 0 }) {
  const [courses, setCourses] = useState([]);
  const [allLectures, setAllLectures] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [batchInfoByCourse, setBatchInfoByCourse] = useState({}); // courseId -> { needs_selection, batch_id, batch_course_id, batches }
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadLectures() {
      setLecturesLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const [{ data: coursesData }, { data: lecturesData }, progressResult] = await Promise.all([
        supabase.from("courses").select("*").order("order_index", { ascending: true }),
        supabase
          .from("lectures")
          .select("*")
          .order("chapter_order", { ascending: true })
          .order("order_index", { ascending: true }),
        user
          ? supabase.from("lecture_progress").select("*").eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
      ]);

      if (!active) return;
      const pMap = {};
      (progressResult.data || []).forEach((p) => {
        pMap[p.lecture_id] = p;
      });
      setCourses(coursesData || []);
      setAllLectures(lecturesData || []);
      setProgressMap(pMap);
      setLecturesLoading(false);
    }
    loadLectures();
    return () => {
      active = false;
    };
  }, []);

  // -------------------- بوابة اختيار الدفعة --------------------
  // أول مرة الطالب يختار دورة، بنتحقق هل عنده دفعة محلولة لهاي الدورة أصلًا.
  // لو لأ، بنرجّع له قائمة الدفعات المتاحة عشان يختار (شوف
  // app/api/batches/for-course/[courseId]/route.js).
  async function resolveBatchForCourse(courseId) {
    const res = await fetch(`/api/batches/for-course/${courseId}`);
    const data = await res.json();
    if (res.ok) {
      setBatchInfoByCourse((prev) => ({ ...prev, [courseId]: data }));
    }
  }

  function handleSelectCourse(courseId) {
    setSelectedCourseId(courseId);
    if (courseId && !batchInfoByCourse[courseId]) {
      resolveBatchForCourse(courseId);
    }
  }

  async function handleEnrollBatch(batchId) {
    if (!selectedCourseId) return;
    setEnrolling(true);
    const res = await fetch("/api/batches/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: selectedCourseId, batch_id: batchId }),
    });
    const data = await res.json();
    setEnrolling(false);
    if (!res.ok) {
      alert(data.error || "صار خطأ بالتسجيل، حاولي مرة تانية");
      return;
    }
    await resolveBatchForCourse(selectedCourseId);
  }
  // ---------------------------------------------------------------

  return (
    <LecturesView
      username={username}
      currentStreak={currentStreak}
      courses={courses}
      allLectures={allLectures}
      progressMap={progressMap}
      loading={lecturesLoading}
      selectedCourseId={selectedCourseId}
      onSelectCourse={handleSelectCourse}
      onBackToCourses={() => setSelectedCourseId(null)}
      selectedLecture={selectedLecture}
      onSelect={setSelectedLecture}
      onBack={() => setSelectedLecture(null)}
      batchInfo={selectedCourseId ? batchInfoByCourse[selectedCourseId] : null}
      onEnrollBatch={handleEnrollBatch}
      enrolling={enrolling}
    />
  );
}
