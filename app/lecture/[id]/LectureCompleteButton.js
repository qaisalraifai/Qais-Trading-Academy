"use client";
import { useState } from "react";

export default function LectureCompleteButton({ lectureId, initialCompleted = false }) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      const res = await fetch("/api/lecture-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId, completed: !completed, watchedPct: !completed ? 100 : undefined }),
      });
      if (res.ok) setCompleted((v) => !v);
    } catch (e) {
      console.error("toggle lecture completion failed:", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      style={{
        marginTop: "1rem",
        alignSelf: "flex-start",
        background: completed ? "linear-gradient(135deg, #DCD4F7, #8A7CB8)" : "transparent",
        border: `1px solid ${completed ? "#DCD4F7" : "#3D2F63"}`,
        color: completed ? "#141024" : "#DCD4F7",
        padding: "0.65rem 1.2rem",
        borderRadius: 3,
        fontSize: "0.85rem",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {saving ? "جاري الحفظ..." : completed ? "تمت مشاهدة الدرس" : "وسمها كمكتملة"}
    </button>
  );
}
