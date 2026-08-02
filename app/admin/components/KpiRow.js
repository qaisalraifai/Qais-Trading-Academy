"use client";
import { glass, gold, monoStack } from "../styles";

export default function KpiRow({ kpis }) {
  if (!kpis) return null;
  const items = [
    { label: "Revenue", value: `$${kpis.revenue.toLocaleString("en-US")}`, delta: null, color: gold },
    { label: "Retention", value: `${kpis.retention}%`, color: "#4CAF50" },
    { label: "Renewal Rate", value: `${kpis.renewalRate}%`, color: "#4FA8E0" },
    { label: "Average Subscription", value: `${kpis.avgSubMonths} أشهر`, color: "#B26FE0" },
  ];

  return (
    <div style={{ ...glass, display: "flex", padding: "1.1rem 1.5rem" }}>
      {items.map((it, i) => (
        <div key={it.label} style={{ flex: 1, display: "flex", alignItems: "center", gap: "1rem", ...(i > 0 ? { borderRight: "1px solid #1c1c1c", paddingRight: "1.2rem", marginRight: "1.2rem" } : {}) }}>
          <div>
            <div style={{ fontFamily: monoStack, fontSize: "1.35rem", fontWeight: 600, color: it.color }}>{it.value}</div>
            <div style={{ fontSize: "0.75rem", color: "#666", marginTop: 2 }}>{it.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
