"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { gold, s, glass } from "../styles";

const BONUS_LABELS = {
  direct: "مباشرة", renewal: "تجديد", binary: "ثنائية", matching: "مطابقة",
  rank: "رتبة", leadership: "قيادة", infinity: "Infinity", fast_start: "انطلاقة", achievement: "إنجاز",
};

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatCard({ label, value, sub, highlight }) {
  return (
    <div style={{ ...glass, padding: "1.3rem 1.5rem" }}>
      <div style={{ fontSize: "0.75rem", color: "#5D6880", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: highlight ? gold : "#EDF1F8" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.7rem", color: "#5D6880", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function MlmAnalyticsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    checkAdmin();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") router.push("/dashboard");
  }

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/mlm-analytics");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={s.header}>
        <div>
          <div style={s.headerSub}>QAIS TRADING ACADEMY — إدارة</div>
          <div style={s.headerTitle}>تقارير وأداء الخطة</div>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <a href="/admin/mlm-ops" style={{ color: gold, textDecoration: "none", fontSize: "0.85rem" }}>السحوبات والعمولات</a>
          <a href="/admin/mlm-settings" style={{ color: gold, textDecoration: "none", fontSize: "0.85rem" }}>الإعدادات</a>
          <a href="/admin" style={{ color: gold, textDecoration: "none", fontSize: "0.85rem" }}>← لوحة الأدمن</a>
        </div>
      </div>

      <div style={s.section}>
        {error && <div style={{ color: "#E8495F", marginBottom: "1rem" }}>{error}</div>}
        {loading || !data ? (
          <div style={{ color: "#5D6880" }}>جاري التحميل...</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              <StatCard label="إجمالي الأعضاء" value={data.totalMembers} sub={`${data.activeMembers} نشط`} />
              <StatCard label="إيرادات هالشهر" value={`${fmt(data.monthRevenue)}`} sub="من payments" highlight />
              <StatCard label="إيرادات هالسنة" value={fmt(data.yearRevenue)} />
              <StatCard label="عمولات مدفوعة هالشهر" value={fmt(data.monthCommissionsTotal)} highlight />
              <StatCard label="سحوبات معلّقة" value={data.pendingWithdrawalsCount} sub={`${fmt(data.pendingWithdrawalsAmount)} دينار`} />
              <StatCard label="KYC بانتظار المراجعة" value={data.pendingKycCount} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div style={{ ...glass, padding: "1.3rem 1.5rem" }}>
                <div style={{ fontSize: "0.85rem", color: "#5D6880", marginBottom: "1rem" }}>العمولات هالشهر حسب النوع</div>
                {Object.keys(data.commissionsByType).length === 0 ? (
                  <div style={{ color: "#3E4761", fontSize: "0.85rem" }}>لا يوجد بعد</div>
                ) : (
                  Object.entries(data.commissionsByType).map(([type, amount]) => (
                    <div key={type} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid #1E2941", fontSize: "0.85rem" }}>
                      <span>{BONUS_LABELS[type] || type}</span>
                      <span style={{ color: gold, fontWeight: 700 }}>{fmt(amount)} دينار</span>
                    </div>
                  ))
                )}
              </div>

              <div style={{ ...glass, padding: "1.3rem 1.5rem" }}>
                <div style={{ fontSize: "0.85rem", color: "#5D6880", marginBottom: "1rem" }}>أفضل 10 قادة (حسب CV)</div>
                {data.topLeaders.length === 0 ? (
                  <div style={{ color: "#3E4761", fontSize: "0.85rem" }}>لا يوجد بعد</div>
                ) : (
                  data.topLeaders.map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid #1E2941", fontSize: "0.85rem" }}>
                      <span>{i + 1}. {l.username} <span style={{ color: "#5D6880" }}>({l.rankName})</span></span>
                      <span style={{ color: gold, fontWeight: 700 }}>{fmt(l.totalCv)} CV</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
