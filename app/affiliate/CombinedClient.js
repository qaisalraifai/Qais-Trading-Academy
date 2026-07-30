"use client";
import { useEffect, useState } from "react";
import AffiliateClient from "./AffiliateClient";
import CommissionSystemExplainer from "./components/CommissionSystemExplainer";
import {
  GOLD,
  monoStack,
  displayStack,
  card,
  SkeletonBlock,
  ShimmerStyles,
} from "./components/shared";

export default function CombinedClient() {
  const [tiersData, setTiersData] = useState(null);
  const [loadingTiers, setLoadingTiers] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/affiliate/tiers-overview");
        const json = await res.json();
        if (res.ok) setTiersData(json);
      } catch {
        // مش مشكلة، الشرح بيشتغل برضه بالقيم الافتراضية
      } finally {
        setLoadingTiers(false);
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
          برنامج عمولة الإحالة
        </h1>
        <p style={{ color: "#9A9A9A", fontSize: "0.85rem", marginTop: 8, lineHeight: 1.8, maxWidth: 680 }}>
          نظام بسيط ومباشر — تدعو، صاحبك ينضم ويتعلم، وياخد كل واحد فيكم قيمته. اقرأ الشرح تحت
          منيح قبل ما تبلّش حتى تعرف بالضبط من وين بتيجي كل عمولة.
        </p>
      </div>

      {loadingTiers ? (
        <div style={{ ...card, marginBottom: "1.4rem" }}>
          <SkeletonBlock h={16} w={220} />
          <div style={{ height: 12 }} />
          <SkeletonBlock h={90} radius={14} />
        </div>
      ) : (
        <CommissionSystemExplainer tiers={tiersData?.tiers} />
      )}

      <AffiliateClient embedded />

      <a href="/dashboard" style={s.backLink}>← رجوع للوحة التحكم</a>
    </div>
  );
}

const s = {
  page: { direction: "rtl", color: "#EAECEF", padding: "2rem 1.5rem 4rem", maxWidth: 1150, margin: "0 auto" },
  backLink: { display: "block", textAlign: "center", color: "#666", fontSize: "0.85rem", textDecoration: "none", marginTop: "1.5rem" },
};
