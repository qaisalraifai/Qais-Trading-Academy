"use client";

import { useEffect, useState } from "react";

// المرحلة 10: مكتبة ملفات دفعة الطالب لهاي الدورة (ملازم، أوراق عمل، مرفقات)
// كومبوننت مستقل بيجيب بياناته لحاله، ما بيأثر على منطق المحاضرات إطلاقًا
function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

export default function BatchFilesPanel({ courseId }) {
  const [files, setFiles] = useState(undefined); // undefined = جاري التحميل
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/batches/files?course_id=${courseId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setFiles(data.files || []);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // ما منعرض القسم إطلاقًا لو ما في ملفات (ولا حتى وهو عم يحمّل، تجنبًا لوميض فاضي)
  if (files === undefined || files.length === 0) return null;

  return (
    <div style={{
      background: "#141024",
      border: "1px solid #2A2145",
      borderRadius: 0,
      marginBottom: "1.5rem",
      overflow: "hidden",
    }}>
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
        <span style={{ fontSize: 14, fontWeight: 800 }}>ملفات الدفعة ({files.length})</span>
        <span style={{ color: "#DCD4F7", fontSize: 12 }}>{open ? "إخفاء ▲" : "إظهار ▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 1.1rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {files.map((f) => (
            <a
              key={f.id}
              href={f.download_url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#0E0A1A",
                border: "1px solid #2A2145",
                borderRadius: 3,
                padding: "0.65rem 0.9rem",
                color: "#F5F3FF",
                textDecoration: "none",
                fontSize: 13,
              }}
            >
              <span>{f.file_name}</span>
              <span style={{ color: "#6E6690", fontSize: 11 }}>{formatSize(f.file_size)} — تحميل ⬇</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
