"use client";
import { glass, gold, timeAgo } from "../styles";

const icons = {
  login: "🟢",
  renew: "🟢",
  payment_failed: "🔴",
  suspended: "🔴",
  note: "⚪",
  extended: "🟢",
  discount: "🟡",
  free_activation: "🎁",
};

export default function ActivityFeed({ items }) {
  return (
    <div style={{ ...glass, padding: "1.3rem 1.4rem", flex: 1, minWidth: 260 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem" }}>
        <span style={{ fontSize: "0.85rem", color: "#999", fontWeight: 600 }}>آخر العمليات</span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.68rem", color: "#4CAF50" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4CAF50", boxShadow: "0 0 6px #4CAF50" }} /> Live
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxHeight: 260, overflowY: "auto" }}>
        {(items || []).length === 0 && <p style={{ color: "#444", fontSize: "0.8rem" }}>لا يوجد نشاط بعد</p>}
        {(items || []).map((a, i) => (
          <div key={a.id} style={{ padding: "0.6rem 0", borderBottom: i < items.length - 1 ? "1px solid #141414" : "none", display: "flex", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.9rem" }}>{icons[a.type] || "⚪"}</span>
            <div>
              <div style={{ fontSize: "0.82rem", color: "#ccc" }}>
                <span style={{ color: gold, fontWeight: 600 }}>{a.username || "مستخدم"}</span> {a.message}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#444" }}>{timeAgo(a.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
