"use client";
import { useState } from "react";
import { glass, gold, monoStack } from "../styles";

export function SubscriptionsTrendChart({ data, big = false }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  if (!data?.length) return null;

  const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
  const half = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, half).reduce((s, d) => s + (d.value || 0), 0);
  const secondHalf = data.slice(half).reduce((s, d) => s + (d.value || 0), 0);
  const pctChange = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 1000) / 10 : null;

  const w = 640;
  const h = big ? 240 : 140;
  const pad = 10;
  const max = Math.max(...data.map((d) => d.value), 1);
  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - (d.value / max) * (h - pad * 2);
    return { x, y, ...d };
  });
  const path = `M${points.map((p) => `${p.x},${p.y}`).join(" L")}`;
  const areaPath = `${path} L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`;

  return (
    <div style={{ ...glass, padding: big ? "1.8rem 2rem" : "1.4rem 1.6rem", flex: 1, minWidth: 320 }}>
      {big ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.6rem", marginBottom: "1.2rem" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#888", fontWeight: 700, letterSpacing: "1.2px", fontFamily: monoStack, textTransform: "uppercase" }}>
              إجمالي التسجيلات · آخر 30 يوم
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", marginTop: "0.4rem" }}>
              <span style={{ fontFamily: monoStack, fontSize: "2.4rem", fontWeight: 800, color: gold }}>
                {total.toLocaleString("en-US")}
              </span>
              {pctChange !== null && (
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: pctChange >= 0 ? "#4CAF50" : "#ef5350" }}>
                  {pctChange >= 0 ? "↗" : "↘"} {Math.abs(pctChange)}% مقارنة بالنصف الأول من الشهر
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.8rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#999", fontWeight: 600 }}>📈 Subscriptions</span>
          <span style={{ fontSize: "0.72rem", color: "#555" }}>آخر 30 يوم</span>
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gold} stopOpacity="0.3" />
            <stop offset="100%" stopColor={gold} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#subGrad)" stroke="none" />
        <path d={path} fill="none" stroke={gold} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
            <circle cx={p.x} cy={p.y} r={hoverIdx === i ? 4 : 0} fill={gold} />
            <rect x={p.x - (w / data.length) / 2} y={0} width={w / data.length} height={h} fill="transparent" />
          </g>
        ))}
      </svg>
      {hoverIdx !== null && (
        <div style={{ fontSize: "0.75rem", color: "#aaa", fontFamily: monoStack }}>
          {points[hoverIdx].date}: {points[hoverIdx].value} مستخدم جديد
        </div>
      )}
    </div>
  );
}

export function RevenueBarChart({ data }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div style={{ ...glass, padding: "1.4rem 1.6rem", flex: 1, minWidth: 280 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <span style={{ fontSize: "0.85rem", color: "#999", fontWeight: 600 }}>💰 Revenue</span>
        <span style={{ fontSize: "0.72rem", color: "#555" }}>آخر 6 أشهر</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.7rem", height: 100 }}>
        {data.map((d, i) => (
          <div
            key={i}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem", cursor: "default" }}
          >
            {hoverIdx === i && <span style={{ fontSize: "0.68rem", color: gold, fontFamily: monoStack }}>${d.value}</span>}
            <div
              style={{
                width: "100%",
                height: Math.max((d.value / max) * 80, 3),
                borderRadius: 5,
                background: hoverIdx === i ? `linear-gradient(180deg, ${gold}, #a07a2e)` : "linear-gradient(180deg, #C9A24B55, #C9A24B22)",
                transition: "all 250ms",
              }}
            />
            <span style={{ fontSize: "0.68rem", color: "#666" }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
