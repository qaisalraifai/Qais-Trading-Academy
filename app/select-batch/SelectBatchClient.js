"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GOLD = "#DCD4F7";

export default function SelectBatchClient({ batches }) {
  const router = useRouter();
  const [enrollingId, setEnrollingId] = useState(null);
  const [error, setError] = useState("");

  async function handleJoin(batchId) {
    setEnrollingId(batchId);
    setError("");
    const res = await fetch("/api/batches/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch_id: batchId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "صار خطأ، حاولي مرة تانية");
      setEnrollingId(null);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.2rem" }}>
      <div style={{ textAlign: "center", marginBottom: "2.2rem" }}>
 <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color:"#F5F3FF" }}>أهلًا فيكِ </h1>
        <p style={{ color: "#A79FC4", fontSize: 15, marginTop: "0.6rem", lineHeight: 1.7 }}>
          قبل ما تبلشي، اختاري الدفعة اللي بدك تنضمي فيها. هاد الاختيار بيفتحلك كل محتوى الدفعة —
          الدورات، البث المباشر، الإعلانات، والاختبارات — بمكان واحد.
        </p>
      </div>

      {error && (
        <p style={{ color: "#FF453A", textAlign: "center", marginBottom: "1rem", fontSize: 14 }}>{error}</p>
      )}

      {batches.length === 0 ? (
        <p style={{ color: "#6E6690", textAlign: "center", fontSize: 15 }}>
          ما في دفعات متاحة للتسجيل هلأ. تواصلي معنا للمساعدة.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          {batches.map((b) => (
            <div
              key={b.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                background: "#141024",
                border: `1px solid #2A2145`,
                borderRadius: 0,
                padding: "1.3rem 1.5rem",
                boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 17, color: "#F5F3FF" }}>{b.name}</p>
                <p style={{ margin: "0.4rem 0 0", color: "#6E6690", fontSize: 13 }}>
                  {b.start_date || "—"} → {b.end_date || "—"}
                  {b.seats_total != null && ` — ${b.seats_remaining} مقعد متاح`}
                </p>
              </div>
              <button
                onClick={() => handleJoin(b.id)}
                disabled={enrollingId !== null || b.is_full}
                style={{
                  background: b.is_full ? "#2A2145" : GOLD,
                  color: b.is_full ? "#6E6690" : "#000",
                  border: "none",
                  borderRadius: 3,
                  padding: "0.7rem 1.4rem",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: b.is_full ? "not-allowed" : "pointer",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {b.is_full ? "مكتملة" : enrollingId === b.id ? "جاري الانضمام..." : "انضمي لهاي الدفعة"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
