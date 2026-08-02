"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const GOLD = "#E8B86D";
const BG = "#0B0E11";
const CARD = "#0D0E10";
const BORDER = "#2B2F36";

const BONUS_KEYS = {
  direct: "mlm.bonusDirect",
  renewal: "mlm.bonusRenewal",
  binary: "mlm.bonusBinary",
  matching: "mlm.bonusMatching",
  rank: "mlm.bonusRank",
  leadership: "mlm.bonusLeadership",
  infinity: "mlm.bonusInfinity",
  fast_start: "mlm.bonusFastStart",
  achievement: "mlm.bonusAchievement",
};

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: "1.5rem",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function TreeSlot({ label, child, t }) {
  return (
    <div
      style={{
        flex: 1,
        background: "#0D0E10",
        border: `1px dashed ${child ? GOLD + "55" : "#2A2E39"}`,
        borderRadius: 12,
        padding: "1rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "0.7rem", color: "#777", marginBottom: 6 }}>{label}</div>
      {child ? (
        <>
          <div style={{ fontWeight: 700 }}>{child.username}</div>
          <div style={{ fontSize: "0.7rem", color: child.is_active_member ? "#3DBB6E" : "#888", marginTop: 4 }}>
            {child.is_active_member ? t("mlm.active") : t("mlm.inactive")}
          </div>
        </>
      ) : (
        <div style={{ color: "#555", fontSize: "0.85rem" }}>{t("mlm.emptySlot")}</div>
      )}
    </div>
  );
}

export default function MlmClient({ embedded = false }) {
  const { t, dir, locale } = useLocale();
  const dateLocale = locale === "ar" ? "ar" : "en-US";
  const router = useRouter();
  const supabase = createClient();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kycStatus, setKycStatus] = useState("none");
  const [kycFile, setKycFile] = useState(null);
  const [kycUploading, setKycUploading] = useState(false);
  const [kycMsg, setKycMsg] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("bank_transfer");
  const [withdrawDest, setWithdrawDest] = useState("");
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);

  useEffect(() => {
    load();
    loadKyc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadKyc() {
    try {
      const res = await fetch("/api/mlm/kyc");
      const json = await res.json();
      if (res.ok) setKycStatus(json.kycStatus);
    } catch {}
  }

  async function submitKyc(e) {
    e.preventDefault();
    if (!kycFile) return;
    setKycUploading(true);
    setKycMsg("");
    try {
      const formData = new FormData();
      formData.append("file", kycFile);
      const res = await fetch("/api/mlm/kyc", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setKycStatus("pending");
      setKycMsg(t("mlm.kycSubmitted"));
    } catch (e) {
      setKycMsg(e.message);
    } finally {
      setKycUploading(false);
    }
  }

  async function submitWithdraw(e) {
    e.preventDefault();
    setWithdrawBusy(true);
    setWithdrawMsg("");
    try {
      const res = await fetch("/api/mlm/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(withdrawAmount), method: withdrawMethod, destinationDetails: withdrawDest }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setWithdrawMsg(t("mlm.withdrawSubmitted"));
      setWithdrawAmount("");
      setWithdrawDest("");
      await load();
    } catch (e) {
      setWithdrawMsg(e.message);
    } finally {
      setWithdrawBusy(false);
    }
  }

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      const res = await fetch("/api/mlm/my-summary");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t("mlm.loadFailed"));
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const outerStyle = embedded
    ? { color: "#EAECEF", direction: dir }
    : { color: "#EAECEF", padding: "2rem 1.5rem 3rem", direction: dir, maxWidth: 1150, margin: "0 auto" };

  if (loading) {
    return (
      <div style={embedded ? { color: "#EAECEF", direction: dir } : { background: BG, color: "#EAECEF", minHeight: "100vh", padding: "3rem", direction: dir }}>
        {t("mlm.loading")}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={embedded ? { color: "#E5484D", direction: dir } : { background: BG, color: "#E5484D", minHeight: "100vh", padding: "3rem", direction: dir }}>
        {error || t("mlm.unexpectedError")}
      </div>
    );
  }

  const { profile, rank, nextRank, tree, wallets, recentCommissions } = data;
  const totalTeamCv = Number(profile.cvLeft || 0) + Number(profile.cvRight || 0);

  return (
    <div style={outerStyle}>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ color: GOLD, fontSize: "0.75rem", letterSpacing: 2, marginBottom: 4 }}>QAIS TRADING ACADEMY</div>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: 0 }}>{t("mlm.pageTitle")}</h1>
      </div>

      {/* الرتبة */}
      <Card style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#888" }}>{t("mlm.currentRank")}</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: GOLD }}>{rank?.name_ar || t("mlm.noRank")}</div>
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: "0.75rem", color: profile.isActiveMember ? "#3DBB6E" : "#E5484D" }}>
              {profile.isActiveMember ? t("mlm.activeMembership") : t("mlm.inactiveMembership")}
            </div>
            <div style={{ fontSize: "0.7rem", color: "#666", marginTop: 2 }}>
              {t("mlm.lastRenewal", { date: profile.lastRenewalAt ? new Date(profile.lastRenewalAt).toLocaleDateString(dateLocale) : "—" })}
            </div>
          </div>
        </div>

        {nextRank && (
          <div style={{ marginTop: "1.2rem", paddingTop: "1.2rem", borderTop: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: "0.75rem", color: "#888", marginBottom: 6 }}>
              {t("mlm.upgradeToRank", { rank: nextRank.name_ar, direct: profile.directCount, minDirect: nextRank.min_direct_members, cv: fmt(totalTeamCv), minCv: fmt(nextRank.min_total_cv) })}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#2B2F36", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (profile.directCount / nextRank.min_direct_members) * 100)}%`, height: "100%", background: GOLD }} />
              </div>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#2B2F36", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (totalTeamCv / nextRank.min_total_cv) * 100)}%`, height: "100%", background: GOLD }} />
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* المحافظ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          [t("mlm.walletCommission"), wallets.commission],
          [t("mlm.walletBonus"), wallets.bonus],
          [t("mlm.walletCashback"), wallets.cashback],
          [t("mlm.walletWithdrawal"), wallets.withdrawal],
        ].map(([label, value]) => (
          <Card key={label}>
            <div style={{ fontSize: "0.75rem", color: "#888", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800 }}>{fmt(value)} <span style={{ fontSize: "0.75rem", color: "#888" }}>{t("mlm.currencyUnit")}</span></div>
          </Card>
        ))}
      </div>

      {/* الشجرة الثنائية */}
      <Card style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.85rem", color: "#888" }}>{t("mlm.myBinaryTree")}</div>
          <a href="/mlm/tree" style={{ color: GOLD, fontSize: "0.8rem", textDecoration: "none" }}>{t("mlm.viewFullTree")}</a>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <TreeSlot label={t("mlm.leftLeg")} child={tree.leftChild} t={t} />
          <TreeSlot label={t("mlm.rightLeg")} child={tree.rightChild} t={t} />
        </div>
        <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", fontSize: "0.8rem", color: "#888" }}>
          <div>{t("mlm.cvLeft")} <strong style={{ color: "#EAECEF" }}>{fmt(profile.cvLeft)}</strong></div>
          <div>{t("mlm.cvRight")} <strong style={{ color: "#EAECEF" }}>{fmt(profile.cvRight)}</strong></div>
          <div>{t("mlm.carryUnmatched")} <strong style={{ color: "#EAECEF" }}>{fmt(profile.carryLeft)} / {fmt(profile.carryRight)}</strong></div>
        </div>
      </Card>

      {/* KYC */}
      <Card style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.85rem", color: "#888", marginBottom: "1rem" }}>{t("mlm.kycTitle")}</div>
        {kycStatus === "verified" ? (
          <div style={{ color: "#3DBB6E" }}>{t("mlm.kycVerified")}</div>
        ) : kycStatus === "pending" ? (
          <div style={{ color: GOLD }}>{t("mlm.kycPending")}</div>
        ) : (
          <form onSubmit={submitKyc} style={{ display: "flex", gap: "0.8rem", alignItems: "center", flexWrap: "wrap" }}>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setKycFile(e.target.files?.[0] || null)}
              style={{ color: "#aaa", fontSize: "0.85rem" }} />
            <button type="submit" disabled={!kycFile || kycUploading}
              style={{ background: GOLD, color: "#111", border: "none", borderRadius: 8, padding: "0.5rem 1.2rem", fontWeight: 700, cursor: "pointer" }}>
              {kycUploading ? t("mlm.kycUploading") : t("mlm.kycSubmitBtn")}
            </button>
            {kycStatus === "rejected" && <span style={{ color: "#E5484D", fontSize: "0.8rem" }}>{t("mlm.kycRejected")}</span>}
            }
          </form>
        )}
        {kycMsg && <div style={{ marginTop: 8, fontSize: "0.8rem", color: "#aaa" }}>{kycMsg}</div>}
        }
      </Card>

      {/* طلب سحب */}
      <Card style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.85rem", color: "#888", marginBottom: "1rem" }}>
          {t("mlm.withdrawTitle", { balance: fmt(wallets.withdrawal) })}
        </div>
        {kycStatus !== "verified" ? (
          <div style={{ color: "#666", fontSize: "0.85rem" }}>{t("mlm.withdrawNeedsKyc")}</div>
        ) : (
          <form onSubmit={submitWithdraw} style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", alignItems: "center" }}>
            <input type="number" min="50" step="0.01" placeholder={t("mlm.amountPlaceholder")} value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              style={{ width: 120, padding: "0.5rem", borderRadius: 8, border: "1px solid #2A2E39", background: "#0D0E10", color: "#EAECEF" }} />
            <select value={withdrawMethod} onChange={(e) => setWithdrawMethod(e.target.value)}
              style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid #2A2E39", background: "#0D0E10", color: "#EAECEF" }}>
              <option value="bank_transfer">{t("mlm.bankTransferOpt")}</option>
              <option value="e_wallet">{t("mlm.eWalletOpt")}</option>
              <option value="usdt">USDT</option>
            </select>
            <input placeholder={t("mlm.accountNumberPlaceholder")} value={withdrawDest} onChange={(e) => setWithdrawDest(e.target.value)}
              style={{ flex: 1, minWidth: 180, padding: "0.5rem", borderRadius: 8, border: "1px solid #2A2E39", background: "#0D0E10", color: "#EAECEF" }} />
            <button type="submit" disabled={withdrawBusy}
              style={{ background: GOLD, color: "#111", border: "none", borderRadius: 8, padding: "0.5rem 1.2rem", fontWeight: 700, cursor: "pointer" }}>
              {withdrawBusy ? t("mlm.sendingRequest") : t("mlm.sendRequestBtn")}
            </button>
          </form>
        )}
        {withdrawMsg && <div style={{ marginTop: 8, fontSize: "0.8rem", color: "#aaa" }}>{withdrawMsg}</div>}
        }
      </Card>

      {/* آخر العمولات */}
      <Card>
        <div style={{ fontSize: "0.85rem", color: "#888", marginBottom: "1rem" }}>{t("mlm.recentCommissionsTitle")}</div>
        {recentCommissions.length === 0 ? (
          <div style={{ color: "#555", fontSize: "0.85rem" }}>{t("mlm.noCommissionsYet")}</div>
        ) : (
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {recentCommissions.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.6rem 0.8rem",
                  background: "#0D0E10",
                  borderRadius: 8,
                  fontSize: "0.85rem",
                }}
              >
                <span>{BONUS_KEYS[c.bonus_type] ? t(BONUS_KEYS[c.bonus_type]) : c.bonus_type}</span>
                <span style={{ color: GOLD, fontWeight: 700 }}>{fmt(c.amount)} {t("mlm.currencyUnit")}</span>
                <span style={{ color: "#666" }}>{new Date(c.created_at).toLocaleDateString(dateLocale)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
