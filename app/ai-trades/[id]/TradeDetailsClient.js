"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, RefreshCw, ArrowRight, CircleCheck as CheckCircle2, Circle as XCircle, Layers, Waves, GitBranch, GitCommitVertical as GitCommit, Box, Zap as FvgIcon, Radio, Target } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const GOLD = "#DCD4F7";
const GOLD_LIGHT = "#F5F3FF";
const GREEN = "#10E5A0";
const RED = "#FF453A";
const BLUE = "#7C4DFF";

const glass = {
  background: "#141024",
  border: `1px solid #2A2145`,
  borderRadius: 0,
  boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
  backdropFilter: "blur(10px)",
};

const CLOSED_STATUSES = ["Closed Winner", "Stopped Out"];

function statusColor(status) {
  if (status === "Closed Winner") return GREEN;
  if (status === "Stopped Out") return RED;
  if (status === "Open") return "#A79FC4";
  return GOLD_LIGHT;
}

function fmt(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n >= 100 ? n.toFixed(2) : n.toFixed(4);
}

function fmtDate(iso, locale) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB");
}

export default function TradeDetailsClient({ tradeId }) {
  const { t, locale } = useLocale();
  const [trade, setTrade] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/ai-trades/${tradeId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("aiTrades.detailsPageLoadFailed"));
      setTrade(data.trade);
    } catch (e) {
      setError(e.message || t("aiTrades.detailsPageLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [tradeId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch(`/api/ai-trades/${tradeId}/check`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.trade) setTrade(data.trade);
    } catch {
      /* فشل الفحص — فيه يعيد الطالب المحاولة يدوياً */
    } finally {
      setChecking(false);
    }
  }, [tradeId]);

  if (loading) {
    return <div style={{ padding: "2rem", color: "#6E6690" }}>{t("aiTrades.loading")}</div>;
  }
  if (error || !trade) {
    return <div style={{ padding: "2rem", color: RED }}>{error || t("aiTrades.tradeNotFound")}</div>;
  }

  const isBuy = trade.direction === "up";
  const dirColor = isBuy ? GREEN : RED;
  const isClosed = CLOSED_STATUSES.includes(trade.status);
  const a = trade.ai_analysis || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", padding: "1.2rem", maxWidth: 980, margin: "0 auto" }}>
      <Link href="/ai-trades" style={{ display: "flex", alignItems: "center", gap: 6, color: "#A79FC4", fontSize: 12.5, textDecoration: "none", width: "fit-content" }}>
        <ArrowRight size={14} /> {t("aiTrades.backToAllTrades")}
      </Link>

      {/* ================= Header ================= */}
      <div style={{ ...glass, border: `1.5px solid #3D2F63`, padding: "1.2rem 1.4rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, background: `${dirColor}1f`, border: `1px solid ${dirColor}66`, color: dirColor, fontWeight: 900, fontSize: 14, borderRadius: 3, padding: "6px 14px" }}>
              {isBuy ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              {isBuy ? "BUY" : "SELL"}
            </span>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: "#F5F3FF", margin: 0 }}>{trade.symbol}</h1>
            <span style={{ fontSize: 11.5, color: "#A79FC4", background: "#141024", border: "1px solid #241C3E", borderRadius: 3, padding: "3px 9px" }}>
              {trade.timeframe}
            </span>
            <span style={{ fontSize: 11.5, color: "#6E6690", background: "#141024", border: "1px solid #241C3E", borderRadius: 3, padding: "3px 9px" }}>
              {t("aiTrades.sourceLabel", { source: trade.source })}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 13, fontWeight: 900, color: statusColor(trade.status),
                background: `${statusColor(trade.status)}1a`, border: `1px solid ${statusColor(trade.status)}55`,
                borderRadius: 3, padding: "6px 14px",
              }}
            >
              {trade.status}
            </span>
            {!isClosed && (
              <button
                onClick={handleCheck}
                disabled={checking}
                style={{ display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`, border: "none", color: "#0E0A1A", fontWeight: 800, borderRadius: 3, padding: "7px 14px", fontSize: 12, cursor: checking ? "default" : "pointer" }}
              >
                <RefreshCw size={12} /> {checking ? t("aiTrades.checking") : t("aiTrades.checkPriceNow")}
              </button>
            )}
          </div>
        </div>

        <StatusProgress status={trade.status} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginTop: 16 }}>
          <Stat label="Confidence" value={trade.confidence != null ? `${trade.confidence}%` : "—"} color={GOLD_LIGHT} />
          <Stat label="Entry" value={fmt(trade.entry)} />
          <Stat label="Stop Loss" value={fmt(trade.stop_loss)} color={RED} />
          <Stat label="TP1" value={fmt(trade.tp1)} color={GREEN} />
          <Stat label="TP2" value={fmt(trade.tp2)} color={GREEN} />
          <Stat label="TP3" value={fmt(trade.tp3)} color={BLUE} />
          <Stat label="TP4" value={fmt(trade.tp4)} color={BLUE} />
          <Stat label="Risk/Reward" value={trade.risk_reward != null ? `${trade.risk_reward}R` : "—"} />
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 14, fontSize: 11.5, color: "#6E6690" }}>
          <span>{t("aiTrades.createdDate")} <b style={{ color: "#A79FC4" }}>{fmtDate(trade.created_at, locale)}</b></span>
          <span>{t("aiTrades.lastCheck")} <b style={{ color: "#A79FC4" }}>{fmtDate(trade.last_checked_at, locale)}</b> ({fmt(trade.last_checked_price)})</span>
          {trade.closed_at && <span>{t("aiTrades.closedDate")} <b style={{ color: "#A79FC4" }}>{fmtDate(trade.closed_at, locale)}</b></span>}
        </div>
      </div>

      {/* ================= لماذا دخل الـ AI (Why) ================= */}
      {Array.isArray(a.why) && a.why.length > 0 && (
        <div style={{ ...glass, padding: "1.1rem 1.3rem" }}>
          <SectionTitle icon={CheckCircle2} title={t("aiTrades.whyAiEntered")} />
          <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {a.why.map((w, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#ddd" }}>
                <CheckCircle2 size={14} color={GREEN} style={{ flexShrink: 0, marginTop: 2 }} />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ================= التحليل الفني الكامل ================= */}
      <div style={{ ...glass, padding: "1.1rem 1.3rem" }}>
        <SectionTitle icon={Layers} title={t("aiTrades.fullTechnicalAnalysis")} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 12 }}>
          <AnalysisRow icon={GitBranch} label="Market Structure" value={a.marketStructure} />
          <AnalysisRow icon={Waves} label="Liquidity" value={a.liquidityStatus} />
          <AnalysisRow icon={GitCommit} label="BOS" value={a.bosStatus} />
          <AnalysisRow icon={GitCommit} label="CHOCH" value={a.chochStatus} />
          <AnalysisRow icon={Box} label="Order Block" value={a.ob?.status || (a.ob ? "Detected" : null)} />
          <AnalysisRow icon={FvgIcon} label="Fair Value Gap" value={a.fvgStatus} />
          <AnalysisRow icon={Radio} label="Session" value={a.sessionLabel || a.session} />
          <AnalysisRow icon={Target} label="Premium / Discount" value={a.premiumDiscount} />
          <AnalysisRow icon={TrendingUp} label="HTF Trend" value={a.htfTrend} />
        </div>
      </div>

      {/* ================= منطق الدخول (Checklist) ================= */}
      {Array.isArray(a.reasonsChecklist) && a.reasonsChecklist.length > 0 && (
        <div style={{ ...glass, padding: "1.1rem 1.3rem" }}>
          <SectionTitle icon={CheckCircle2} title={t("aiTrades.entryLogicChecklist")} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginTop: 12 }}>
            {a.reasonsChecklist.map((c) => (
              <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, background: "#141024", border: "1px solid #241C3E", borderRadius: 3, padding: "8px 10px" }}>
                {c.ok ? <CheckCircle2 size={14} color={GREEN} /> : <XCircle size={14} color="#4A4368" />}
                <span style={{ fontSize: 12, color: c.ok ? "#ddd" : "#6E6690" }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: "#4A4368", textAlign: "center" }}>
        {t("aiTrades.internalTradeDisclaimer")}
      </div>
    </div>
  );
}

const STAGES = ["Open", "Running", "TP1 Hit", "TP2 Hit", "TP3 Hit", "TP4 Hit"];

function StatusProgress({ status }) {
  const isLoss = status === "Stopped Out";
  const isWin = status === "Closed Winner";
  const activeIdx = isLoss || isWin ? STAGES.length : STAGES.indexOf(status);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 16, overflowX: "auto" }}>
      {STAGES.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 70 }}>
          <div
            style={{
              flex: 1, height: 5, borderRadius: 3,
              background: isLoss ? (i <= activeIdx ? RED : "#241C3E") : i <= activeIdx || isWin ? GREEN : "#241C3E",
            }}
          />
        </div>
      ))}
      <div
        style={{
          flexShrink: 0, width: 9, height: 9, borderRadius: "50%",
          background: isWin ? GREEN : isLoss ? RED : "#241C3E",
          boxShadow: isWin ? `0 0 8px ${GREEN}` : isLoss ? `0 0 8px ${RED}` : "none",
        }}
      />
    </div>
  );
}

function Stat({ label, value, color = "#F5F3FF" }) {
  return (
    <div style={{ background: "#141024", border: "1px solid #241C3E", borderRadius: 3, padding: "7px 10px" }}>
      <div style={{ fontSize: 10.5, color: "#6E6690", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function AnalysisRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#141024", border: "1px solid #241C3E", borderRadius: 3, padding: "9px 11px" }}>
      <Icon size={14} color={GOLD_LIGHT} style={{ flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 10.5, color: "#6E6690" }}>{label}</div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#ddd" }}>{value || "—"}</div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Icon size={16} color={GOLD} />
      <h2 style={{ fontSize: 14, fontWeight: 800, color: "#F5F3FF", margin: 0 }}>{title}</h2>
    </div>
  );
}
