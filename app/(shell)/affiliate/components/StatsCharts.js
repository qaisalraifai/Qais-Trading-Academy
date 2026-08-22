"use client";
import { useState, useMemo, useEffect } from "react";
import { GOLD, BORDER, card, sectionTitle, sectionEyebrow, monoStack, transition, fmt, EmptyState } from "./shared";

const PERIODS = [
  { key: "daily", label: "يومي" },
  { key: "weekly", label: "أسبوعي" },
  { key: "monthly", label: "شهري" },
];

function EarningsBarChart({ rows, color = GOLD, valuePrefix = "$" }) {
  const width = 700;
  const height = 220;
  const padding = { top: 20, right: 10, bottom: 30, left: 10 };
  const max = Math.max(1, ...rows.map((r) => r.total));
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barGap = 8;
  const barW = rows.length > 0 ? Math.max(6, chartW / rows.length - barGap) : 0;

  const hasData = rows.some((r) => r.total > 0);

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", minWidth: 480, height: "auto", display: "block" }}>
        {/* خطوط شبكة أفقية خفيفة */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + chartH * (1 - f)}
            y2={padding.top + chartH * (1 - f)}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}
        {!hasData && (
          <text x={width / 2} y={height / 2} textAnchor="middle" fill="#4A4368" fontSize="12">
            ما في بيانات مسجّلة بهاي الفترة بعد
          </text>
        )}
        {rows.map((r, i) => {
          const barH = (r.total / max) * chartH;
          const x = padding.left + i * (chartW / rows.length) + (chartW / rows.length - barW) / 2;
          const y = padding.top + chartH - barH;
          return (
            <g key={r.key}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(barH, r.total > 0 ? 2 : 0)}
                rx={4}
                fill={r.total > 0 ? color : "rgba(255,255,255,0.06)"}
                opacity={r.total > 0 ? 0.9 : 0.5}
              >
                <title>{`${r.label}: ${valuePrefix}${fmt(r.total)}`}</title>
              </rect>
              <text
                x={x + barW / 2}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                fill="#6E6690"
                fontSize="9"
                fontFamily="monospace"
              >
                {r.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function StatsCharts({ funnel, series }) {
  const [period, setPeriod] = useState("daily");
  const rows = series?.[period] || [];

  const [growth, setGrowth] = useState(null);
  useEffect(() => {
    fetch("/api/affiliate/growth-stats")
      .then((r) => r.json())
      .then(setGrowth)
      .catch(() => {});
  }, []);

  const funnelStats = [
    { label: "عدد الزيارات", value: funnel?.clicks ?? 0, tip: "عدد مرات الضغط على رابط الإحالة تبعك." },
    { label: "عدد التسجيلات", value: funnel?.signups ?? 0, tip: "عدد الحسابات الجديدة اللي اتسجلت عن طريق رابطك." },
    { label: "معدل التحويل", value: `${(funnel?.conversionRate ?? 0).toFixed(1)}%`, tip: "نسبة اللي سجّلوا من إجمالي الزيارات." },
    { label: "ربح كل نقرة (EPC)", value: `$${fmt(funnel?.epc)}`, tip: "متوسط أرباحك من كل نقرة على رابطك." },
  ];

  const totalForPeriod = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows]);

  return (
    <section id="stats" style={{ scrollMarginTop: 90, marginBottom: "1.4rem" }}>
      <div style={card} className="qta-animate-in">
        <p style={sectionEyebrow}>الأداء</p>
        <h2 style={sectionTitle}>الإحصائيات</h2>
        <p style={{ color: "#A79FC4", fontSize: "0.82rem", marginBottom: "1.2rem" }}>تابع أداء رابطك وأرباحك على مر الوقت.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.8rem", marginBottom: "1.4rem" }}>
          {funnelStats.map((st) => (
            <div key={st.label} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, borderRadius: 0, padding: "1rem", textAlign: "center" }}>
              <p style={{ color: "#A79FC4", fontSize: "0.72rem", marginBottom: 6 }}>{st.label}</p>
              <p style={{ color: GOLD, fontSize: "1.2rem", fontWeight: 800, fontFamily: monoStack }}>{st.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.6rem", marginBottom: "0.9rem" }}>
          <p style={{ fontWeight: 700, fontSize: "0.88rem", color: "#F5F3FF" }}>
            الأرباح — إجمالي الفترة: <span style={{ color: GOLD, fontFamily: monoStack }}>${fmt(totalForPeriod)}</span>
          </p>
          <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, borderRadius: 3, padding: 4 }}>
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                style={{
                  border: "none",
                  background: period === p.key ? GOLD : "transparent",
                  color: period === p.key ? "#141024" : "#A79FC4",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  padding: "0.4rem 0.9rem",
                  borderRadius: 3,
                  cursor: "pointer",
                  transition,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
 <EmptyState icon="" title="ما في بيانات كفاية بعد" desc="ابدأ شارك رابطك وبتظهر أرباحك هون." />
        ) : (
          <EarningsBarChart rows={rows} />
        )}

        {growth && (growth.activeClientsSeries?.length > 0 || growth.activeNow > 0 || growth.cancelledNow > 0) && (
          <div style={{ marginTop: "1.8rem", paddingTop: "1.4rem", borderTop: `1px solid ${BORDER}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.8rem", marginBottom: "1.2rem" }}>
              <div style={{ background: "rgba(76,175,80,0.05)", border: "1px solid rgba(76,175,80,0.25)", borderRadius: 0, padding: "1rem", textAlign: "center" }}>
                <p style={{ color: "#A79FC4", fontSize: "0.72rem", marginBottom: 6 }}>معدل الاحتفاظ بالعملاء</p>
                <p style={{ color: "#10E5A0", fontSize: "1.2rem", fontWeight: 800, fontFamily: monoStack }}>{growth.retentionRate}%</p>
              </div>
              <div style={{ background: "rgba(246,70,93,0.05)", border: "1px solid rgba(246,70,93,0.25)", borderRadius: 0, padding: "1rem", textAlign: "center" }}>
                <p style={{ color: "#A79FC4", fontSize: "0.72rem", marginBottom: 6 }}>معدل إلغاء العملاء</p>
                <p style={{ color: "#FF453A", fontSize: "1.2rem", fontWeight: 800, fontFamily: monoStack }}>{growth.churnRate}%</p>
              </div>
            </div>

            {growth.activeClientsSeries?.length > 0 && (
              <>
                <p style={{ fontWeight: 700, fontSize: "0.88rem", color: "#F5F3FF", marginBottom: "0.9rem" }}>
                  العملاء النشطون — آخر 30 يوم
                </p>
                <EarningsBarChart rows={growth.activeClientsSeries} color="#7C4DFF" valuePrefix="" />
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
