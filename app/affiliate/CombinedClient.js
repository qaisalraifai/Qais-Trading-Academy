"use client";
import { useEffect, useState } from "react";
import AffiliateClient from "./AffiliateClient";
import MlmClient from "../mlm/MlmClient";
import CommissionLevelsExplainer from "./components/CommissionLevelsExplainer";
import {
  GOLD,
  BORDER,
  card,
  monoStack,
  displayStack,
  transition,
  SkeletonBlock,
  ShimmerStyles,
} from "./components/shared";

const TABS = [
  { key: "affiliate", label: "🔗 برنامج التسويق بالعمولة", icon: "🔗" },
  { key: "mlm", label: "🌳 الشبكة (Network)", icon: "🌳" },
];

export default function CombinedClient() {
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [tab, setTab] = useState("affiliate");

  useEffect(() => {
    // اقرأ التبويب المطلوب من الرابط، مثلاً /affiliate?tab=mlm (قادم من إعادة توجيه صفحة /mlm القديمة)
    try {
      const params = new URLSearchParams(window.location.search);
      const wanted = params.get("tab");
      if (wanted === "mlm" || wanted === "affiliate") setTab(wanted);
    } catch {}

    (async () => {
      try {
        const res = await fetch("/api/affiliate/me");
        const json = await res.json();
        if (res.ok) setSettings(json.settings);
      } catch {
        // مش مشكلة، الشرح بيشتغل برضه بدون النسب الحقيقية
      } finally {
        setLoadingSettings(false);
      }
    })();
  }, []);

  return (
    <div style={s.page}>
      <ShimmerStyles />

      <div style={{ marginBottom: "1.6rem" }}>
        <p style={{ fontFamily: monoStack, color: GOLD, fontSize: 11, letterSpacing: 3, marginBottom: 8 }}>
          QAIS TRADING ACADEMY
        </p>
        <h1 style={{ fontSize: "1.7rem", fontWeight: 800, fontFamily: displayStack, margin: 0 }}>
          مركز العمولات والشبكة
        </h1>
        <p style={{ color: "#9A9A9A", fontSize: "0.85rem", marginTop: 8, lineHeight: 1.8, maxWidth: 680 }}>
          كل شي يخص أرباحك من التسويق — برنامج الإحالة البسيط وشبكتك الثنائية — بصفحة وحدة. اقرأ الشرح تحت
          منيح قبل ما تبلّش حتى تعرف بالضبط من وين بتيجي كل عمولة.
        </p>
      </div>

      {loadingSettings ? (
        <div style={{ ...card, marginBottom: "1.4rem" }}>
          <SkeletonBlock h={16} w={220} />
          <div style={{ height: 12 }} />
          <SkeletonBlock h={90} radius={14} />
        </div>
      ) : (
        <CommissionLevelsExplainer settings={settings} />
      )}

      {/* تبديل بين برنامج الإحالة والشبكة */}
      <div style={s.tabsWrap}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              ...s.tabBtn,
              background: tab === t.key ? "rgba(212,175,55,0.12)" : "transparent",
              borderColor: tab === t.key ? GOLD : BORDER,
              color: tab === t.key ? GOLD : "#9A9A9A",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: tab === "affiliate" ? "block" : "none" }}>
        <AffiliateClient embedded />
      </div>
      <div style={{ display: tab === "mlm" ? "block" : "none" }}>
        <MlmClient embedded />
      </div>

      <a href="/dashboard" style={s.backLink}>← رجوع للوحة التحكم</a>
    </div>
  );
}

const s = {
  page: { direction: "rtl", color: "#EAECEF", padding: "2rem 1.5rem 4rem", maxWidth: 1150, margin: "0 auto" },
  tabsWrap: { display: "flex", gap: 10, marginBottom: "1.6rem", flexWrap: "wrap", position: "sticky", top: 8, zIndex: 5 },
  tabBtn: {
    border: "1px solid",
    borderRadius: 12,
    padding: "0.75rem 1.3rem",
    fontSize: "0.86rem",
    fontWeight: 700,
    cursor: "pointer",
    transition,
    whiteSpace: "nowrap",
  },
  backLink: { display: "block", textAlign: "center", color: "#666", fontSize: "0.85rem", textDecoration: "none", marginTop: "1.5rem" },
};
