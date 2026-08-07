"use client";

import { BookOpen, Users } from "lucide-react";
import { resolveIcon } from "@/lib/icon-registry";
import { useState } from "react";
import { useRouter } from "next/navigation";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
}

export default function BatchSelectClient({ course, batches }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const availableBatches = batches.filter((b) => !b.is_full);
  const allFull = availableBatches.length === 0;

  async function handleConfirm() {
    if (!selectedId || saving) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/batches/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: course.id, batch_id: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "صار خطأ، حاولي مرة ثانية");
        setSaving(false);
        return;
      }
      router.refresh();
    } catch {
      setError("صار خطأ بالاتصال، حاولي مرة ثانية");
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at top, #120B24 0%, #0E0A1A 60%)",
        color: "#fff",
        fontFamily: "'Segoe UI', sans-serif",
        direction: "rtl",
        padding: "2rem",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
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

        <h2 style={{ fontSize: 17, fontWeight: 700, margin: "1.5rem 0 0.4rem" }}>اختاري دفعتك</h2>
        <p style={{ color: "#6E6690", fontSize: 13.5, marginBottom: "1.75rem", lineHeight: 1.7 }}>
          هاي أول مرة تفتحي فيها هاي الدورة. اختاري الدفعة المناسبة إلك من القائمة تحت — بعد ما
          تأكدي، رح تنضمي إلها بشكل دائم وما رح تشوفي هاي الشاشة مرة ثانية لنفس الدورة. لو حبيتي
          تغيّري دفعتك بعدين، تواصلي مع الإدارة.
        </p>

        {allFull && (
          <div
            style={{
              background: "#1C1630",
              border: "1px solid #FF453A44",
              borderRadius: 0,
              padding: "1rem 1.25rem",
              color: "#FF453A",
              fontSize: 13.5,
              marginBottom: "1.5rem",
            }}
          >
            كل الدفعات المتاحة حاليًا مكتملة العدد. تواصلي مع الإدارة لتنسيق تسجيلك.
          </div>
        )}

        {/* Batches list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1.75rem" }}>
          {batches.map((batch) => {
            const isSelected = selectedId === batch.id;
            const disabled = batch.is_full;

            return (
              <button
                key={batch.id}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedId(batch.id)}
                style={{
                  textAlign: "right",
                  background: isSelected ? "#141024" : "#141024",
                  border: isSelected ? "1.5px solid #DCD4F7" : "1px solid #2A2145",
                  borderRadius: 0,
                  padding: "1.1rem 1.25rem",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.45 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  boxShadow: isSelected ? "0 4px 20px rgba(212,175,55,0.15)" : "0 4px 16px rgba(0,0,0,0.3)",
                  transition: "border 0.15s ease",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {batch.name}
                    {disabled && (
                      <span style={{ fontSize: 11, color: "#FF453A", background: "#1C1630", padding: "0.15rem 0.5rem", borderRadius: 3 }}>
                        مكتملة
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.9rem", marginTop: 6, fontSize: 12.5, color: "#6E6690" }}>
                    <span>تبدأ: {formatDate(batch.start_date)}</span>
                    {batch.end_date && <span>تنتهي: {formatDate(batch.end_date)}</span>}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Users size={13} strokeWidth={1.75} aria-hidden />
                      {batch.seats_total != null ? `${batch.seats_remaining} مقعد متبقي من ${batch.seats_total}` : "مقاعد غير محدودة"}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: isSelected ? "6px solid #DCD4F7" : "2px solid #4A4368",
                    flexShrink: 0,
                    background: "transparent",
                  }}
                />
              </button>
            );
          })}
        </div>

        {error && <p style={{ color: "#FF453A", fontSize: 13.5, marginBottom: "1rem" }}>{error}</p>}

        <button
          onClick={handleConfirm}
          disabled={!selectedId || saving}
          style={{
            width: "100%",
            background: !selectedId || saving ? "#1C1630" : "linear-gradient(135deg, #DCD4F7, #8A7CB8)",
            color: !selectedId || saving ? "#6E6690" : "#000",
            border: "none",
            borderRadius: 0,
            padding: "0.9rem",
            fontSize: 14.5,
            fontWeight: 800,
            cursor: !selectedId || saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "جاري التسجيل..." : "تأكيد الانضمام لهاي الدفعة"}
        </button>
      </div>
    </div>
  );
}
