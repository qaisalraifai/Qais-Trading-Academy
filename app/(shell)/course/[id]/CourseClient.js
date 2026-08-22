"use client";

import { BookOpen, CircleCheck, Clock, Play, Star } from "lucide-react";
import { resolveIcon } from "@/lib/icon-registry";
import { useState, useMemo } from "react";
import Link from "next/link";

const DIFFICULTY_LABELS = {
  beginner: { label: "مبتدئ", color: "#10E5A0" },
  intermediate: { label: "متوسط", color: "#F0A13C" },
  advanced: { label: "متقدم", color: "#FF453A" },
};

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

const FILTERS = [
  { key: "all", label: "الكل" },
  { key: "completed", label: "مكتملة" },
  { key: "incomplete", label: "غير مكتملة" },
  { key: "favorite", label: "المفضلة" },
];

export default function CourseClient({ course, chapters }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filteredChapters = useMemo(() => {
    return chapters
      .map((chapter) => {
        const filteredLectures = chapter.lectures.filter((lecture) => {
          const matchesSearch =
            !search.trim() ||
            lecture.title?.toLowerCase().includes(search.trim().toLowerCase());

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

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, #120B24 0%, #0E0A1A 60%)",
      color: "#fff",
      fontFamily: "'Segoe UI', sans-serif",
      direction: "rtl",
      padding: "2rem",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "flex" }}>
              {(() => {
                const CourseIcon = resolveIcon(course.icon, BookOpen);
                return <CourseIcon size={34} strokeWidth={1.5} color="#F5F3FF" aria-hidden />;
              })()}
            </div>
            <div>
              <p style={{ color: "#DCD4F7", fontSize: 11, letterSpacing: 2, margin: 0 }}>QAIS TRADING ACADEMY</p>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800 }}>{course.title}</h1>
            </div>
          </div>
          <Link href="/lecture" style={{ color: "#4A4368", fontSize: 13, textDecoration: "none" }}>← البرامج التعليمية</Link>
        </div>

        {course.description && (
          <p style={{ color: "#6E6690", fontSize: 14, marginBottom: "1.5rem" }}>{course.description}</p>
        )}

        {/* Search + Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "2rem" }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <input
              type="text"
              placeholder="البحث عن محاضرة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                background: "#141024",
                border: "1px solid #2A2145",
                borderRadius: 3,
                padding: "0.65rem 1rem",
                color: "#fff",
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  background: filter === f.key ? "linear-gradient(135deg, #DCD4F7, #8A7CB8)" : "#141024",
                  color: filter === f.key ? "#000" : "#A79FC4",
                  border: filter === f.key ? "none" : "1px solid #2A2145",
                  borderRadius: 3,
                  padding: "0.6rem 1rem",
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

        {/* Chapters */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {filteredChapters.map((chapter) => {
            const total = chapter.lectures.length;
            const completed = chapter.lectures.filter((l) => l.progress?.completed).length;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <div key={chapter.name}>
                {/* Chapter header + progress bar */}
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>{chapter.name}</h2>
                    <span style={{ fontSize: 12, color: "#DCD4F7", fontWeight: 700 }}>
                      {pct}% &nbsp;·&nbsp; {completed} / {total} درس
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "#1E1836", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #DCD4F7, #F5F3FF)",
                      borderRadius: 3,
                    }} />
                  </div>
                </div>

                {/* Lectures in this chapter */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {chapter.filteredLectures.map((lecture) => {
                    const diff = DIFFICULTY_LABELS[lecture.difficulty];
                    const isCompleted = !!lecture.progress?.completed;
                    const watchedPct = lecture.progress?.watched_pct || 0;
                    const lastWatched = formatLastWatched(lecture.progress?.last_watched_at);
                    const duration = formatDuration(lecture.duration_seconds);

                    return (
                      <Link key={lecture.id} href={`/lecture/${lecture.id}`} style={{ textDecoration: "none" }}>
                        <div style={{
                          background: "#141024",
                          border: isCompleted ? "1px solid #10E5A044" : "1px solid #2A2145",
                          borderRadius: 0,
                          padding: "1rem 1.25rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "1rem",
                          cursor: "pointer",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                        }}>
                          {/* Status icon */}
                          <div style={{
                            width: 40, height: 40, borderRadius: "50%",
                            background: isCompleted ? "#10E5A022" : "#2A2145",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}>
                            {isCompleted
                              ? <CircleCheck size={17} strokeWidth={1.75} color="#10E5A0" aria-hidden />
                              : <Play size={15} strokeWidth={1.75} color="#F5F3FF" fill="#F5F3FF" aria-hidden />}
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{lecture.title}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginTop: 5, fontSize: 12, color: "#6E6690" }}>
                              {duration && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  <Clock size={12} strokeWidth={1.75} aria-hidden />
                                  {duration}
                                </span>
                              )}
                              {diff && (
                                <span style={{ color: diff.color }}>{diff.label}</span>
                              )}
                              {lecture.practice_type && <span>تمرين تطبيقي</span>}
                              {lastWatched && <span>آخر مشاهدة: {lastWatched}</span>}
                            </div>
                            {!isCompleted && watchedPct > 0 && (
                              <div style={{ width: "100%", height: 4, background: "#1E1836", borderRadius: 3, overflow: "hidden", marginTop: 8 }}>
                                <div style={{
                                  width: `${watchedPct}%`,
                                  height: "100%",
                                  background: "#3D2F63",
                                  borderRadius: 3,
                                }} />
                              </div>
                            )}
                          </div>

                          {/* Favorite + arrow */}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                            {lecture.progress?.favorite && <span style={{ fontSize: 14 }}><Star size={14} aria-hidden /></span>}
                            <div style={{
                              width: 32, height: 32, borderRadius: "50%",
                              background: "#2A2145",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: "#DCD4F7", fontSize: 14,
                            }}>←</div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredChapters.length === 0 && (
            <div style={{ color: "#4A4368", textAlign: "center", padding: "3rem 0" }}>
              لا توجد نتائج مطابقة.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
