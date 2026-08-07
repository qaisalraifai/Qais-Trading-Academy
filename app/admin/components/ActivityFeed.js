"use client";
import { glass, gold, displayStack, timeAgo } from "../styles";

const dotColors = {
  login: "#1FBF87",
  renew: "#1FBF87",
  payment_failed: "#E8495F",
  suspended: "#E8495F",
  note: "#5D6880",
  extended: "#1FBF87",
  discount: "#E0A44A",
  free_activation: "#B26FE0",
};

export default function ActivityFeed({ items }) {
  return (
    <div style={{ ...glass, padding: "1.5rem 1.6rem", flex: 1, minWidth: 260 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.1rem" }}>
        <span style={{ fontFamily: displayStack, fontSize: "1.05rem", fontWeight: 700, color: "#F6F0E1" }}>آخر العمليات</span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.7rem", color: "#1FBF87", fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1FBF87", boxShadow: "0 0 6px #1FBF87" }} /> Live
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem", maxHeight: 300, overflowY: "auto" }}>
        {(items || []).length === 0 && <p style={{ color: "#3E4761", fontSize: "0.8rem" }}>لا يوجد نشاط بعد</p>}
        {(items || []).map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.7rem" }}>
            <span
              style={{
                marginTop: "0.4rem",
                width: 8,
                height: 8,
                flexShrink: 0,
                borderRadius: "50%",
                background: dotColors[a.type] || "#5D6880",
              }}
            />
            <div>
              <div style={{ fontSize: "0.9rem", color: "#F6F0E1", fontWeight: 600 }}>
                {a.message}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#5D6880", marginTop: "0.15rem" }}>
                <span style={{ color: gold }}>{a.username || "مستخدم"}</span> · {timeAgo(a.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
