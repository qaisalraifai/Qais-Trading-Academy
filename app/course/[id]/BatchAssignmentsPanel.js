"use client";

import { useEffect, useState } from "react";

// المرحلة 11: واجبات دفعة الطالب لهاي الدورة — تسليم وإعادة تسليم ومتابعة التقييم
// كومبوننت مستقل بيجيب بياناته لحاله، ما بيأثر على منطق المحاضرات أو الملفات إطلاقًا
function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

function AssignmentRow({ assignment, onSubmitted }) {
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sub = assignment.my_submission;
  const isGraded = !!sub?.grade;

  async function handleSubmit() {
    if (!file && !note.trim()) {
      setErr("لازم ترفعي ملف أو تكتبي ملاحظة عالأقل");
      return;
    }
    setErr("");
    setBusy(true);
    const formData = new FormData();
    if (file) formData.append("file", file);
    if (note.trim()) formData.append("note", note.trim());

    const res = await fetch(`/api/batches/assignments/${assignment.id}/submit`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(data.error || "صار خطأ، حاولي مرة ثانية");
      return;
    }
    setFile(null);
    setNote("");
    onSubmitted();
  }

  return (
    <div
      style={{
        background: "#181A20",
        border: "1px solid #D4AF3722",
        borderRadius: 10,
        padding: "0.9rem 1.1rem",
        marginBottom: "0.7rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>{assignment.title}</div>
          {assignment.description && (
            <div style={{ color: "#aaa", fontSize: 12.5, marginTop: 4 }}>{assignment.description}</div>
          )}
          {assignment.due_date && (
            <div style={{ color: "#D4AF37", fontSize: 12, marginTop: 4 }}>
              آخر موعد للتسليم: {formatDate(assignment.due_date)}
            </div>
          )}
        </div>
        {isGraded && (
          <span
            style={{
              background: "#D4AF3722",
              color: "#D4AF37",
              borderRadius: 8,
              padding: "0.3rem 0.7rem",
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            الدرجة: {sub.grade}
          </span>
        )}
      </div>

      {sub && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#8f8" }}>
          ✅ تم التسليم {sub.file_name ? `— ${sub.file_name}` : ""} ({formatDate(sub.submitted_at)})
          {isGraded && sub.feedback && (
            <div style={{ color: "#ccc", marginTop: 4 }}>ملاحظات المدرب: {sub.feedback}</div>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ color: "#ccc", fontSize: 12 }}
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ملاحظة اختيارية..."
          rows={2}
          style={{
            background: "#111108",
            border: "1px solid #D4AF3733",
            borderRadius: 6,
            color: "#eee",
            padding: "0.5rem",
            fontSize: 12.5,
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
        {err && <div style={{ color: "#f66", fontSize: 12 }}>{err}</div>}
        <button
          onClick={handleSubmit}
          disabled={busy}
          style={{
            background: "#D4AF37",
            color: "#111",
            border: "none",
            borderRadius: 8,
            padding: "0.5rem 1rem",
            fontWeight: 800,
            fontSize: 13,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.7 : 1,
            alignSelf: "flex-start",
          }}
        >
          {busy ? "جاري الإرسال..." : sub ? "إعادة التسليم" : "تسليم الواجب"}
        </button>
      </div>
    </div>
  );
}

export default function BatchAssignmentsPanel({ courseId }) {
  const [assignments, setAssignments] = useState(undefined); // undefined = جاري التحميل
  const [open, setOpen] = useState(true);

  function load() {
    fetch(`/api/batches/assignments?course_id=${courseId}`)
      .then((res) => res.json())
      .then((data) => setAssignments(data.assignments || []))
      .catch(() => setAssignments([]));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // ما منعرض القسم إطلاقًا لو ما في واجبات (ولا حتى وهو عم يحمّل، تجنبًا لوميض فاضي)
  if (assignments === undefined || assignments.length === 0) return null;

  return (
    <div
      style={{
        background: "#111108",
        border: "1px solid #D4AF3733",
        borderRadius: 12,
        marginBottom: "1.5rem",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "none",
          border: "none",
          color: "#fff",
          padding: "0.9rem 1.1rem",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800 }}>📝 واجبات الدفعة ({assignments.length})</span>
        <span style={{ color: "#D4AF37", fontSize: 12 }}>{open ? "إخفاء ▲" : "إظهار ▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 1.1rem 1rem" }}>
          {assignments.map((a) => (
            <AssignmentRow key={a.id} assignment={a} onSubmitted={load} />
          ))}
        </div>
      )}
    </div>
  );
}
