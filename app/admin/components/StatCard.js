"use client";
import { useEffect, useRef, useState } from "react";
import { gold, glass, transition, monoStack, displayStack, shadowLuxe, shadowGold } from "../styles";

// عدّاد أرقام متحرك بسيط (بدون مكتبة خارجية)
function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = value;
    startRef.current = null;
    let raf;
    function tick(ts) {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 90;
  const h = 28;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const path = `M${points.join(" L")}`;
  const areaPath = `${path} L${w},${h} L0,${h} Z`;
  const gradId = `spark-${color.replace("#", "")}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function StatCard({ icon, label, value, prefix = "", suffix = "", delta, color = gold, sparkline, sub }) {
  const [hover, setHover] = useState(false);
  const animated = useCountUp(typeof value === "number" ? value : 0);
  const display = typeof value === "number" ? animated.toLocaleString("en-US") : value;
  const hasDelta = delta !== undefined && delta !== null;
  const deltaUp = hasDelta && delta >= 0;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...glass,
        position: "relative",
        overflow: "hidden",
        padding: "1.5rem 1.6rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem",
        cursor: "default",
        transition,
        transform: hover ? "translateY(-3px)" : "none",
        boxShadow: hover ? `${shadowLuxe}, 0 0 0 1px ${color}44 inset, 0 10px 34px -10px ${color}55` : shadowLuxe,
      }}
    >
      {/* خط علوي متدرج ذهبي خفيف — نفس تفصيلة Aureus */}
      <div style={{ position: "absolute", insetInline: 0, top: 0, height: 1, background: `linear-gradient(90deg, transparent, ${color}66, transparent)` }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.6rem" }}>
        <span
          style={{
            color: "#777",
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            fontFamily: monoStack,
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <span style={{ fontSize: "1rem" }}>{icon}</span>
          {label}
        </span>

        {hasDelta && (
          <span
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.2rem",
              padding: "0.2rem 0.55rem",
              borderRadius: "9999px",
              fontSize: "0.72rem",
              fontWeight: 700,
              fontFamily: monoStack,
              color: deltaUp ? "#3DBB6E" : "#E5484D",
              background: deltaUp ? "#3DBB6E22" : "#E5484D22",
            }}
          >
            {deltaUp ? "↗" : "↘"} {Math.abs(delta)}%
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
        <span style={{ fontFamily: displayStack, fontSize: "2rem", fontWeight: 800, color: "#F5F0E4", letterSpacing: "-0.01em" }}>
          {prefix}
          <span style={{ fontFamily: monoStack, fontWeight: 700 }}>{display}</span>
          {suffix}
        </span>
      </div>

      {(sub || sparkline) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
          <span style={{ color: "#5a5a5a", fontSize: "0.78rem" }}>{sub}</span>
          {sparkline && <Sparkline data={sparkline} color={color} />}
        </div>
      )}

      {/* توهج خافت بالزاوية عند الـ hover — زي Aureus */}
      <div style={{
        position: "absolute", left: -24, bottom: -24, width: 96, height: 96, borderRadius: "50%",
        background: `${color}22`, filter: "blur(28px)", opacity: hover ? 1 : 0, transition,
      }} />
    </div>
  );
}
