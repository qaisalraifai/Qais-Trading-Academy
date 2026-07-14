"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../components/layout/AppShell";
import NotificationBell from "../components/NotificationBell";
import Leaderboard from "./components/Leaderboard";
import Badges from "./components/Badges";
import BonusWheel from "./components/BonusWheel";
import TreeAndCommissionsExplainer from "./components/TreeAndCommissionsExplainer";
import RecentActivity from "./components/RecentActivity";
import { gold, ink, glass, noiseBg, shadowLuxe, shadowGold, gradientGold, displayStack, monoStack, transition } from "@/app/admin/styles";

const GOLD = gold;
const BG = ink;
const BORDER = "rgba(201,162,75,0.14)";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_LABELS = {
  none: "لسا ما طلبت الانضمام",
  pending: "طلبك قيد المراجعة",
  approved: "مسوّق مفعّل",
  rejected: "تم رفض طلبك",
  suspended: "حسابك معلّق حالياً",
};

const PAYOUT_STATUS_LABELS = {
  awaiting_transfer: "بانتظار التحويل",
  paid: "تم الدفع",
  failed: "فشل التحويل",
};

export default function AffiliateClient({ username, isAdmin = false, subscriptionEnd = null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState("paypal");
  const [payoutValue, setPayoutValue] = useState("");
  const [copyState, setCopyState] = useState("");
  const [siteOrigin, setSiteOrigin] = useState("");

  const initials = (username || "؟").trim().charAt(0).toUpperCase();
  let daysLeft = null;
  if (subscriptionEnd) {
    const diffMs = new Date(subscriptionEnd).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }
  const goToDashboard = () => router.push("/dashboard");

  useEffect(() => {
    setSiteOrigin(window.location.origin);
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliate/me");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "حدث خطأ");
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
      if (!res.ok) throw new Error(json.error || "حدث خطأ");
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
      if (!res.ok) throw new Error(json.error || "حدث خطأ");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingPayout(false);
    }
  }

  function copyLink() {
    const link = `${siteOrigin}/r/${data?.affiliateCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopyState("تم النسخ ✓");
      setTimeout(() => setCopyState(""), 2000);
    });
  }

  if (loading) {
    return (
      <AppShell
        username={username}
        initials={initials}
        isAdmin={isAdmin}
        daysLeft={daysLeft}
        activeKey={null}
        setActiveKey={goToDashboard}
        onNavToLectures={goToDashboard}
        showProfileHeader={false}
      >
        <div style={s.page}>
          <p style={{ color: "#666" }}>جاري التحميل...</p>
        </div>
      </AppShell>
    );
  }

  const status = data?.status || "none";

  return (
    <AppShell
      username={username}
      initials={initials}
      isAdmin={isAdmin}
      daysLeft={daysLeft}
      activeKey={null}
      setActiveKey={goToDashboard}
      onNavToLectures={goToDashboard}
      showProfileHeader={false}
    >
    <div style={s.page}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "-1rem" }}>
        {status === "approved" && <NotificationBell />}
      </div>

      <div style={s.header}>
        <p style={s.eyebrow}>QAIS TRADING ACADEMY</p>
        <h1 style={s.title}>برنامج التسويق بالعمولة</h1>
        <p style={s.sub}>اربح عمولة على كل طالب تجيبه، وعلى شبكته لحد 3 مستويات</p>
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      {status === "none" && (
        <div style={s.card}>
          <p style={s.cardText}>
            بصفتك طالب بالأكاديمية، فيك تنضم لبرنامج التسويق بالعمولة وتشارك رابطك الخاص
            مع أصدقائك ومتابعينك، وتاخذ عمولة على كل اشتراك يصير عن طريقك — وحتى عمولة
            أقل على اللي بيجيبوهم هنن (شبكي 3 مستويات).
          </p>
          <button onClick={handleApply} disabled={applying} style={s.btn}>
            {applying ? "جاري الإرسال..." : "قدّم طلب الانضمام"}
          </button>
        </div>
      )}

      {status === "pending" && (
        <div style={s.card}>
          <p style={s.statusBadgePending}>{STATUS_LABELS.pending}</p>
          <p style={s.cardText}>رح نراجع طلبك ونرد عليك قريباً. تابع هاي الصفحة للتحديثات.</p>
        </div>
      )}

      {status === "rejected" && (
        <div style={s.card}>
          <p style={s.statusBadgeRejected}>{STATUS_LABELS.rejected}</p>
          <p style={s.cardText}>لو بتعتقد في خطأ، تواصل معنا عبر الدعم.</p>
        </div>
      )}

      {status === "suspended" && (
        <div style={s.card}>
          <p style={s.statusBadgeRejected}>{STATUS_LABELS.suspended}</p>
        </div>
      )}

      {status === "approved" && (
        <>
          {/* رابط الإحالة */}
          <div style={s.card}>
            <p style={s.sectionTitle}>رابط الإحالة الخاص فيك</p>
            <div style={s.linkRow}>
              <span style={s.linkText}>{siteOrigin}/r/{data.affiliateCode}</span>
              <button onClick={copyLink} style={s.copyBtn}>{copyState || "نسخ"}</button>
            </div>
          </div>

          {/* الأرباح */}
          <div style={s.grid3}>
            <div style={s.statCard}>
              <p style={s.statLabel}>إجمالي الأرباح</p>
              <p style={s.statValue}>${fmt(data.earnings.totalEarned)}</p>
            </div>
            <div style={s.statCard}>
              <p style={s.statLabel}>قيد الانتظار</p>
              <p style={s.statValue}>${fmt(data.earnings.pending + data.earnings.ready)}</p>
            </div>
            <div style={s.statCard}>
              <p style={s.statLabel}>تم صرفه</p>
              <p style={s.statValue}>${fmt(data.earnings.paid)}</p>
            </div>
          </div>

          {/* تتبّع النقرات / Conversion Funnel */}
          {data.funnel && (
            <div style={s.card}>
              <p style={s.sectionTitle}>أداء رابطك</p>
              <div style={s.grid3}>
                <div style={s.networkCard}>
                  <p style={s.statLabel}>عدد الزيارات</p>
                  <p style={s.statValue}>{data.funnel.clicks}</p>
                </div>
                <div style={s.networkCard}>
                  <p style={s.statLabel}>نسبة التحويل</p>
                  <p style={s.statValue}>{data.funnel.conversionRate.toFixed(1)}%</p>
                  <p style={s.networkSub}>{data.funnel.signups} تسجيل من {data.funnel.clicks} زيارة</p>
                </div>
                <div style={s.networkCard}>
                  <p style={s.statLabel}>ربح كل نقرة (EPC)</p>
                  <p style={s.statValue}>${fmt(data.funnel.epc)}</p>
                </div>
              </div>
            </div>
          )}

          {/* الشبكة */}
          <div style={s.card}>
            <p style={s.sectionTitle}>شبكتك</p>
            <div style={s.grid3}>
              <div style={s.networkCard}>
                <p style={s.statLabel}>المستوى 1 (مباشر)</p>
                <p style={s.statValue}>{data.network.level1}</p>
                <p style={s.networkSub}>${fmt(data.earnings.byLevel[1])} أرباح</p>
              </div>
              <div style={s.networkCard}>
                <p style={s.statLabel}>المستوى 2</p>
                <p style={s.statValue}>{data.network.level2}</p>
                <p style={s.networkSub}>${fmt(data.earnings.byLevel[2])} أرباح</p>
              </div>
              <div style={s.networkCard}>
                <p style={s.statLabel}>المستوى 3</p>
                <p style={s.statValue}>{data.network.level3}</p>
                <p style={s.networkSub}>${fmt(data.earnings.byLevel[3])} أرباح</p>
              </div>
            </div>
          </div>

          {/* بيانات استلام العمولة */}
          <div style={s.card}>
            <p style={s.sectionTitle}>طريقة استلام العمولة</p>
            <p style={s.cardTextSmall}>
              التحويل حالياً يدوي لحد ما نفعّل ربط PayPal/Wise الفعلي — بس خزّن بياناتك من هلأ
              حتى يجهز أول ما يصير التحويل أوتوماتيك.
            </p>
            <div style={s.payoutRow}>
              <select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)} style={s.select}>
                <option value="paypal">PayPal</option>
                <option value="wise">Wise</option>
                <option value="bank">تحويل بنكي</option>
              </select>
              <input
                style={s.input}
                placeholder={payoutMethod === "paypal" ? "إيميل PayPal" : payoutMethod === "wise" ? "رقم حساب Wise" : "تفاصيل الحساب البنكي"}
                value={payoutValue}
                onChange={(e) => setPayoutValue(e.target.value)}
              />
              <button onClick={handleSavePayout} disabled={savingPayout} style={s.btnSmall}>
                {savingPayout ? "جاري الحفظ..." : "حفظ"}
              </button>
            </div>
            {data.payoutMethod && (
              <p style={s.savedNote}>
                محفوظ حالياً: {data.payoutMethod === "paypal" ? "PayPal" : data.payoutMethod === "wise" ? "Wise" : "تحويل بنكي"}
                {data.payoutDetails?.email ? ` — ${data.payoutDetails.email}` : ""}
                {data.payoutDetails?.account ? ` — ${data.payoutDetails.account}` : ""}
              </p>
            )}
          </div>

          <RecentActivity />
          <BonusWheel />
          <Badges />
          <Leaderboard />
          <TreeAndCommissionsExplainer />

          {/* سجل الدفعات */}
          <div style={s.card}>
            <p style={s.sectionTitle}>سجل الدفعات</p>
            {data.payouts.length === 0 ? (
              <p style={s.cardTextSmall}>ما في دفعات لسا.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>المبلغ</th>
                      <th style={s.th}>الحالة</th>
                      <th style={s.th}>الفترة</th>
                      <th style={s.th}>تاريخ الدفع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payouts.map((p) => (
                      <tr key={p.id}>
                        <td style={s.td}>${fmt(p.amount)}</td>
                        <td style={s.td}>{PAYOUT_STATUS_LABELS[p.status] || p.status}</td>
                        <td style={s.td}>
                          {p.period_start ? new Date(p.period_start).toLocaleDateString("ar") : "-"}
                          {" → "}
                          {p.period_end ? new Date(p.period_end).toLocaleDateString("ar") : "-"}
                        </td>
                        <td style={s.td}>{p.paid_at ? new Date(p.paid_at).toLocaleDateString("ar") : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <a href="/dashboard" style={s.backLink}>← رجوع للوحة التحكم</a>
    </div>
    </AppShell>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    backgroundColor: BG,
    backgroundImage: noiseBg,
    direction: "rtl",
    color: "#EAECEF",
    padding: "3rem 1.5rem 4rem",
    maxWidth: 1150,
    margin: "0 auto",
  },
  header: { textAlign: "center", marginBottom: "2.2rem" },
  eyebrow: { fontFamily: monoStack, color: GOLD, fontSize: 11, letterSpacing: 3, marginBottom: 10 },
  title: { fontSize: "1.9rem", fontWeight: 800, marginBottom: 8, fontFamily: displayStack, letterSpacing: "-0.02em" },
  sub: { color: "#9A9A9A", fontSize: "0.9rem" },
  errorBox: { background: "#2a0d0d", border: "1px solid #F6465D44", color: "#F6465D", padding: "0.8rem 1rem", borderRadius: 10, marginBottom: "1.2rem", fontSize: "0.85rem" },
  card: { ...glass, boxShadow: shadowLuxe, borderRadius: 18, padding: "1.8rem", marginBottom: "1.3rem" },
  cardText: { color: "#B8B0A0", fontSize: "0.92rem", lineHeight: 1.9, marginBottom: "1.2rem" },
  cardTextSmall: { color: "#9A9A9A", fontSize: "0.82rem", lineHeight: 1.7, marginBottom: "1rem" },
  btn: { backgroundImage: gradientGold, boxShadow: shadowGold, color: "#16130a", border: "none", padding: "0.85rem 1.7rem", borderRadius: 10, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", transition },
  btnSmall: { backgroundImage: gradientGold, boxShadow: shadowGold, color: "#16130a", border: "none", padding: "0.7rem 1.2rem", borderRadius: 8, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", whiteSpace: "nowrap", transition },
  statusBadgePending: { color: "#eab308", fontWeight: 700, fontSize: "0.95rem", marginBottom: 8 },
  statusBadgeRejected: { color: "#F6465D", fontWeight: 700, fontSize: "0.95rem", marginBottom: 8 },
  sectionTitle: { fontSize: "1rem", fontWeight: 700, color: GOLD, marginBottom: "0.9rem", fontFamily: displayStack },
  linkRow: { display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "0.8rem 1rem", flexWrap: "wrap" },
  linkText: { fontFamily: monoStack, fontSize: "0.85rem", color: "#C8C0B0", direction: "ltr", flex: 1, wordBreak: "break-all" },
  copyBtn: { background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, padding: "0.45rem 1rem", borderRadius: 8, cursor: "pointer", fontSize: "0.8rem", whiteSpace: "nowrap", transition },
  grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" },
  statCard: { ...glass, boxShadow: shadowLuxe, borderRadius: 14, padding: "1.3rem", textAlign: "center" },
  networkCard: { background: "rgba(255,255,255,0.025)", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "1.2rem", textAlign: "center" },
  statLabel: { color: "#9A9A9A", fontSize: "0.75rem", marginBottom: 6 },
  statValue: { color: GOLD, fontSize: "1.5rem", fontWeight: 800, fontFamily: monoStack },
  networkSub: { color: "#6E7177", fontSize: "0.72rem", marginTop: 4 },
  payoutRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  select: { background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, color: "#EAECEF", padding: "0.7rem 1rem", borderRadius: 8, fontSize: "0.85rem" },
  input: { flex: 1, minWidth: 200, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, color: "#EAECEF", padding: "0.7rem 1rem", borderRadius: 8, fontSize: "0.85rem", direction: "ltr", textAlign: "right" },
  savedNote: { color: "#9A9A9A", fontSize: "0.78rem", marginTop: "0.8rem" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "right", color: "#9A9A9A", fontSize: "0.75rem", padding: "0.6rem", borderBottom: `1px solid ${BORDER}` },
  td: { padding: "0.6rem", fontSize: "0.85rem", color: "#C8C0B0", borderBottom: `1px solid ${BORDER}` },
  backLink: { display: "block", textAlign: "center", color: "#666", fontSize: "0.85rem", textDecoration: "none", marginTop: "1.5rem" },
};
