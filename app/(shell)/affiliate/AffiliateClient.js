"use client";
import { useEffect, useState } from "react";
import NotificationBell from "@/app/components/NotificationBell";
import QuickSummary from "./components/QuickSummary";
import TierProgress from "./components/TierProgress";
import ReferralLink from "./components/ReferralLink";
import CampaignLinks from "./components/CampaignLinks";
import AchievementsGrid from "./components/AchievementsGrid";
import StatsCharts from "./components/StatsCharts";
import Leaderboard from "./components/Leaderboard";
import ReferralsTable from "./components/ReferralsTable";
import PayoutsHistory from "./components/PayoutsHistory";
import { FaqSection, TermsSection } from "./components/FaqTerms";
import AlertToasts from "./components/AlertToasts";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  GOLD,
  BORDER,
  card,
  sectionTitle,
  sectionEyebrow,
  btnPrimary,
  monoStack,
  displayStack,
  SkeletonBlock,
  ShimmerStyles,
} from "./components/shared";

export default function AffiliateClient({ embedded = false }) {
  const { t, dir } = useLocale();
  const STATUS_LABELS = {
    none: t("affiliate.statusNone"),
    pending: t("affiliate.statusPending"),
    approved: t("affiliate.statusApproved"),
    rejected: t("affiliate.statusRejected"),
    suspended: t("affiliate.statusSuspended"),
  };
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState("paypal");
  const [payoutValue, setPayoutValue] = useState("");
  const [siteOrigin, setSiteOrigin] = useState("");

  useEffect(() => {
    setSiteOrigin(window.location.origin);
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/affiliate/me");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t("affiliate.genericError"));
      setData(json);
      if (json.payoutMethod) setPayoutMethod(json.payoutMethod);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    setApplying(true);
    setError("");
    try {
      const res = await fetch("/api/affiliate/apply", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t("affiliate.genericError"));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setApplying(false);
    }
  }

  async function handleSavePayout() {
    if (!payoutValue.trim()) return;
    setSavingPayout(true);
    setError("");
    try {
      const details =
        payoutMethod === "paypal"
          ? { email: payoutValue.trim() }
          : payoutMethod === "wise"
          ? { account: payoutValue.trim() }
          : { info: payoutValue.trim() };
      const res = await fetch("/api/affiliate/payout-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: payoutMethod, details }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t("affiliate.genericError"));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingPayout(false);
    }
  }

  function handleShare() {
    const link = `${siteOrigin}/r/${data?.affiliateCode}`;
    if (navigator.share) {
      navigator.share({ title: "Qais Trading Academy", text: t("affiliate.shareText"), url: link }).catch(() => {});
    } else {
      navigator.clipboard.writeText(link);
    }
  }

  const pageStyle = { ...(embedded ? s.pageEmbedded : s.page), direction: dir };

  if (loading) {
    return (
      <div style={pageStyle}>
        <ShimmerStyles />
        <div style={{ ...card, marginBottom: "1.3rem" }}>
          <SkeletonBlock h={14} w={140} />
          <div style={{ height: 12 }} />
          <SkeletonBlock h={30} w={260} />
          <div style={{ height: 20 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.9rem" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} h={70} radius={14} />
            ))}
          </div>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ ...card, marginBottom: "1.3rem" }}>
            <SkeletonBlock h={16} w={180} />
            <div style={{ height: 14 }} />
            <SkeletonBlock h={90} radius={14} />
          </div>
        ))}
      </div>
    );
  }

  const status = data?.status || "none";
  const link = data?.affiliateCode ? `${siteOrigin}/r/${data.affiliateCode}` : "";

  return (
    <div style={pageStyle}>
      <ShimmerStyles />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "-1rem" }}>
        {status === "approved" && <NotificationBell />}
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      {status === "none" && (
        <div style={{ ...card, textAlign: "center", padding: "2.4rem 1.8rem" }} className="qta-animate-in">
          <p style={{ fontFamily: monoStack, color: GOLD, fontSize: 11, letterSpacing: 3, marginBottom: 10 }}>QAIS TRADING ACADEMY</p>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, fontFamily: displayStack, marginBottom: 12 }}>{t("affiliate.programTitleShort")}</h1>
          <p style={{ color: "#A79FC4", fontSize: "0.9rem", lineHeight: 1.9, marginBottom: "1.4rem", maxWidth: 480, margin: "0 auto 1.4rem" }}>
            {t("affiliate.noneIntro")}
          </p>
          <button onClick={handleApply} disabled={applying} style={btnPrimary}>
            {applying ? t("affiliate.sending") : t("affiliate.applyBtn")}
          </button>
        </div>
      )}

      {status === "pending" && (
        <div style={card} className="qta-animate-in">
          <p style={{ color: "#F0A13C", fontWeight: 700, fontSize: "0.95rem", marginBottom: 8 }}>{STATUS_LABELS.pending}</p>
          <p style={{ color: "#A79FC4", fontSize: "0.85rem" }}>{t("affiliate.pendingText")}</p>
        </div>
      )}

      {status === "rejected" && (
        <div style={card} className="qta-animate-in">
          <p style={{ color: "#FF453A", fontWeight: 700, fontSize: "0.95rem", marginBottom: 8 }}>{STATUS_LABELS.rejected}</p>
          <p style={{ color: "#A79FC4", fontSize: "0.85rem" }}>{t("affiliate.rejectedText")}</p>
        </div>
      )}

      {status === "suspended" && (
        <div style={card} className="qta-animate-in">
          <p style={{ color: "#FF453A", fontWeight: 700, fontSize: "0.95rem" }}>{STATUS_LABELS.suspended}</p>
        </div>
      )}

      {status === "approved" && (
        <>
          <QuickSummary data={data} onShare={handleShare} />
          <TierProgress tier={data.tier} />
          <ReferralLink link={link} clicks={data.funnel?.clicks} code={data.affiliateCode} />
          <CampaignLinks affiliateCode={data.affiliateCode} siteOrigin={siteOrigin} />
          <AchievementsGrid />
          <StatsCharts funnel={data.funnel} series={data.series} />
          <Leaderboard />
          <ReferralsTable referrals={data.referrals} />

          {/* طريقة استلام العمولة */}
          <div id="payout-method" style={{ ...card, marginBottom: "1.4rem", scrollMarginTop: 90 }} className="qta-animate-in">
            <p style={sectionEyebrow}>{t("affiliate.payoutSettingsEyebrow")}</p>
            <h2 style={sectionTitle}>{t("affiliate.payoutMethodTitle")}</h2>
            <p style={{ color: "#A79FC4", fontSize: "0.8rem", lineHeight: 1.7, margin: "0.6rem 0 1.1rem" }}>
              {t("affiliate.payoutMethodHint")}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)} style={s.select}>
                <option value="paypal">PayPal</option>
                <option value="wise">Wise</option>
                <option value="bank">{t("affiliate.bankTransfer")}</option>
              </select>
              <input
                style={s.input}
                placeholder={payoutMethod === "paypal" ? t("affiliate.paypalEmailPlaceholder") : payoutMethod === "wise" ? t("affiliate.wiseAccountPlaceholder") : t("affiliate.bankDetailsPlaceholder")}
                value={payoutValue}
                onChange={(e) => setPayoutValue(e.target.value)}
              />
              <button onClick={handleSavePayout} disabled={savingPayout} style={btnPrimary}>
                {savingPayout ? t("affiliate.saving") : t("affiliate.save")}
              </button>
            </div>
            {data.payoutMethod && (
              <p style={{ color: "#A79FC4", fontSize: "0.78rem", marginTop: "0.8rem" }}>
                {t("affiliate.savedCurrently", { method: data.payoutMethod === "paypal" ? "PayPal" : data.payoutMethod === "wise" ? "Wise" : t("affiliate.bankTransfer") })}
                {data.payoutDetails?.email ? ` — ${data.payoutDetails.email}` : ""}
                {data.payoutDetails?.account ? ` — ${data.payoutDetails.account}` : ""}
              </p>
            )}
          </div>

          <PayoutsHistory payouts={data.payouts} />
          <FaqSection settings={data.settings} tier={data.tier} />
          <TermsSection settings={data.settings} tier={data.tier} />

          <AlertToasts />
        </>
      )}

      <a href="/dashboard" style={{ ...s.backLink, display: embedded ? "none" : "block" }}>{t("affiliate.backToDashboard")}</a>
    </div>
  );
}

const s = {
  page: { color: "#F5F3FF", padding: "2rem 1.5rem 4rem", maxWidth: 1150, margin: "0 auto" },
  pageEmbedded: { color: "#F5F3FF", maxWidth: "100%" },
  errorBox: { background: "#141024", border: "1px solid #FF453A44", color: "#FF453A", padding: "0.8rem 1rem", borderRadius: 3, marginBottom: "1.2rem", fontSize: "0.85rem" },
  select: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,162,75,0.14)", color: "#F5F3FF", padding: "0.7rem 1rem", borderRadius: 3, fontSize: "0.85rem" },
  input: { flex: 1, minWidth: 200, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,162,75,0.14)", color: "#F5F3FF", padding: "0.7rem 1rem", borderRadius: 3, fontSize: "0.85rem", direction: "ltr", textAlign: "right" },
  backLink: { display: "block", textAlign: "center", color: "#6E6690", fontSize: "0.85rem", textDecoration: "none", marginTop: "1.5rem" },
};
