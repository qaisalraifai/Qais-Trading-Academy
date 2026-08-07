"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-client";

export default function MarkCompleteButton({ lectureId, isCompleted }) {
  const [completed, setCompleted] = useState(isCompleted);
  const [loading, setLoading] = useState(false);

  async function handleMark() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("student_progress").upsert(
      {
        student_id: user.id,
        lecture_id: lectureId,
        is_completed: true,
        watched_percentage: 100,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "student_id,lecture_id" }
    );

    setCompleted(true);
    setLoading(false);
  }

  if (completed) {
    return <p style={styles.done}>تم إكمال هذه المحاضرة</p>;
  }

  return (
    <button onClick={handleMark} disabled={loading} style={styles.button}>
      {loading ? "جاري الحفظ..." : "✔️ علّمها كمكتملة"}
    </button>
  );
}

const styles = {
  button: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#1FBF87",
    color: "#fff",
    border: "none",
    borderRadius: "3px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  done: { color: "#1FBF87", fontWeight: "bold" },
};
