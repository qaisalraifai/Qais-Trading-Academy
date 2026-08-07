"use client";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const GOLD = "#C9A860";
const GOLD_LIGHT = "#E4CD95";
const GOLD_DARK = "#9C7F42";
const GREEN = "#1FBF87";
const RED = "#E8495F";
const BLUE = "#5FA8E8";

const cardStyle = {
  background: "#111726",
  border: `1px solid #26314A`,
  borderRadius: 0,
  boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
};

const PLAN_INFO = {
  member: { label: "Member", icon: "⭐", color: "#93A0B8" },
  trial: { label: "Trial", icon: "🔷", color: BLUE },
  elite: { label: "Elite Access", icon: "👑", color: GOLD },
  vip: { label: "VIP", icon: "💎", color: BLUE },
};

function fmtDate(d, locale) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(locale === "ar" ? "ar" : "en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function SectionCard({ title, icon, children, style }) {
  return (
    <div style={{ ...cardStyle, padding: "1.4rem 1.6rem", marginBottom: "1.2rem", ...style }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
          <span style={{ fontSize: 17 }}>{icon}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}

export default function SettingsView({ username }) {
  const { t, locale } = useLocale();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [renewBusy, setRenewBusy] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponResult, setCouponResult] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t("settings.loadError"));
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAutoRenew() {
    if (!data) return;
    const nextValue = !data.profile.auto_renew;
    setRenewBusy(true);
    // تحديث فوري بالواجهة (متفائل)، ومنرجع للحالة القديمة لو فشل الطلب
    setData((prev) => ({ ...prev, profile: { ...prev.profile, auto_renew: nextValue } }));
    try {
      const res = await fetch("/api/account/auto-renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextValue }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setData((prev) => ({ ...prev, profile: { ...prev.profile, auto_renew: !nextValue } }));
    } finally {
      setRenewBusy(false);
    }
  }

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponBusy(true);
    setCouponResult(null);
    try {
      const res = await fetch("/api/account/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode }),
      });
      const json = await res.json();
      setCouponResult(json);
    } catch {
      setCouponResult({ valid: false, message: t("settings.couponGenericError") });
    } finally {
      setCouponBusy(false);
    }
  }

  if (loading) {
    return <div style={{ color: "#5D6880", fontSize: 14, padding: "3rem 0", textAlign: "center" }}>{t("settings.loading")}</div>;
  }

  if (error || !data) {
    return (
      <div style={{ ...cardStyle, padding: "3rem", textAlign: "center", color: "#5D6880", fontSize: 14 }}>
        {t("settings.loadError")}. {error}
      </div>
    );
  }

  const { profile, payments, managementUrl, membership } = data;
  const hasWhopMembership = Boolean(profile.whop_membership_id);
  const planInfo = PLAN_INFO[profile.plan] || PLAN_INFO.member;
  const isActive = profile.subscription_status === "active";

  let daysLeft = null;
  let percentLeft = 0;
  if (profile.subscription_end) {
    const diffMs = new Date(profile.subscription_end) - new Date();
    daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    if (profile.subscription_start) {
      const totalMs = new Date(profile.subscription_end) - new Date(profile.subscription_start);
      percentLeft = totalMs > 0 ? Math.min(100, Math.max(4, (diffMs / totalMs) * 100)) : 0;
    } else {
      percentLeft = Math.min(100, Math.max(4, (daysLeft / 30) * 100));
    }
  }

  const lastPayment = payments?.[0] || null;

  return (
    <div>
      {/* 1. حالة الاشتراك */}
      <SectionCard>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>{planInfo.icon}</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{planInfo.label}</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: isActive ? "#111726" : "#1E2941",
                  border: `1px solid ${isActive ? GREEN : RED}33`,
                  color: isActive ? GREEN : RED,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "0.25rem 0.7rem",
                  borderRadius: 20,
                }}
              >
                {isActive ? t("settings.active") : t("settings.inactive")}
              </span>
            </div>
            <p style={{ margin: 0, color: "#5D6880", fontSize: 12 }}>{t("settings.fullAccessDesc")}</p>
          </div>
          <div style={{ textAlign: "left" }}>
            <p style={{ margin: 0, color: "#5D6880", fontSize: 12 }}>{username}</p>
          </div>
        </div>

        {daysLeft !== null && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#93A0B8", marginBottom: 6 }}>
              <span>{t("settings.expiresIn", { days: daysLeft })}</span>
              <span>{fmtDate(profile.subscription_end, locale)}</span>
            </div>
            <div style={{ width: "100%", height: 7, background: "#1B2438", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  width: `${percentLeft}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`,
                }}
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* 2. معلومات الفاتورة */}
      <SectionCard title={t("settings.billingInfoTitle")} icon="💳">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: lastPayment?.invoice_url ? "1rem" : 0 }}>
          <InfoField label={t("settings.lastPayment")} value={lastPayment ? `$${Number(lastPayment.amount).toFixed(2)}` : "—"} />
          <InfoField label={t("settings.paymentMethod")} value={lastPayment?.method === "whop" ? t("settings.cardViaWhop") : lastPayment?.method || "—"} />
          <InfoField label={t("settings.lastPaymentDate")} value={lastPayment ? fmtDate(lastPayment.created_at, locale) : "—"} />
          <InfoField label={t("settings.invoiceNumber")} value={lastPayment ? `#${String(lastPayment.id).slice(0, 8).toUpperCase()}` : "—"} />
        </div>
        {lastPayment?.invoice_url && (
          <a
            href={lastPayment.invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: `1px solid #3E5478`,
              color: GOLD_LIGHT,
              fontSize: 13,
              fontWeight: 700,
              padding: "0.55rem 1.1rem",
              borderRadius: 3,
              textDecoration: "none",
            }}
          >
            <span>⬇️</span><span>{t("settings.downloadInvoice")}</span>
          </a>
        )}
      </SectionCard>

      {/* 2.5 طريقة الدفع */}
      <SectionCard title={t("settings.paymentMethodTitle")} icon="💳">
        {hasWhopMembership ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>
                {membership?.cancelAtPeriodEnd ? t("settings.subscriptionScheduledStop") : t("settings.cardRegisteredWhop")}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#5D6880" }}>
                {t("settings.manageOnWhopHint")}
              </p>
            </div>
            <a
              href={managementUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                border: `1px solid #3E5478`,
                background: "transparent",
                color: GOLD_LIGHT,
                fontSize: 13,
                fontWeight: 700,
                padding: "0.55rem 1.1rem",
                borderRadius: 3,
                textDecoration: "none",
              }}
            >
              {t("settings.manageOnWhopBtn")}
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>{t("settings.noPaymentMethod")}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#5D6880" }}>{t("settings.addCardHint")}</p>
            </div>
            <a
              href="/payment"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
                color: "#101828",
                border: "none",
                fontWeight: 800,
                fontSize: 13,
                padding: "0.6rem 1.3rem",
                borderRadius: 3,
                textDecoration: "none",
              }}
            >
              <span>➕</span><span>{t("settings.subscribeNow")}</span>
            </a>
          </div>
        )}
      </SectionCard>

      {/* 3. التجديد */}
      <SectionCard title={t("settings.renewalTitle")} icon="🔄">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>
              {data.profile.auto_renew ? t("settings.autoRenewEnabled") : t("settings.autoRenewDisabled")}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#5D6880" }}>
              {data.profile.auto_renew ? t("settings.autoRenewOnDesc") : t("settings.autoRenewOffDesc")}
            </p>
          </div>
          <button
            onClick={toggleAutoRenew}
            disabled={renewBusy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: data.profile.auto_renew ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})` : "transparent",
              border: `1px solid #3E5478`,
              color: data.profile.auto_renew ? "#101828" : GOLD_LIGHT,
              fontWeight: 800,
              fontSize: 13,
              padding: "0.6rem 1.2rem",
              borderRadius: 3,
              cursor: renewBusy ? "wait" : "pointer",
              opacity: renewBusy ? 0.6 : 1,
            }}
          >
            {renewBusy ? t("settings.saving") : data.profile.auto_renew ? t("settings.disableAutoRenew") : t("settings.enableAutoRenew")}
          </button>
        </div>

      </SectionCard>

      {/* 4. تغيير الخطة */}
      <SectionCard title={t("settings.changePlanTitle")} icon="🎫">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.9rem" }}>
          {["member", "elite", "vip"].map((key) => {
            const info = PLAN_INFO[key];
            const isCurrent = profile.plan === key;
            return (
              <div
                key={key}
                style={{
                  border: `1px solid ${isCurrent ? GOLD : "#1B2438"}`,
                  background: isCurrent ? `linear-gradient(135deg, #26314A, #0C1220)` : "#0C1220",
                  borderRadius: 0,
                  padding: "1rem",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 4 }}>{info.icon}</div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: isCurrent ? GOLD_LIGHT : "#93A0B8" }}>{info.label}</p>
                {isCurrent ? (
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 8,
                      fontSize: 10,
                      fontWeight: 800,
                      color: "#101828",
                      background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
                      padding: "3px 10px",
                      borderRadius: 20,
                    }}
                  >
                    {t("settings.currentPlanBadge")}
                  </span>
                ) : (
                  <a
                    href={`mailto:qaisalraifai@gmail.com?subject=${encodeURIComponent(t("settings.changePlanEmailSubject"))}&body=${encodeURIComponent(t("settings.changePlanEmailBody", { plan: info.label }))}`}
                    style={{ display: "block", marginTop: 8, fontSize: 11, color: "#5D6880", textDecoration: "underline" }}
                  >
                    {t("settings.contactSupportChange")}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* 5. المزايا الحالية */}
      <SectionCard title={t("settings.benefitsTitle")} icon="📋">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.6rem" }}>
          {[
            t("settings.benefitLectures"),
            t("settings.benefitCalendar"),
            t("settings.benefitReplay"),
            t("settings.benefitReports"),
            t("settings.benefitDiscord"),
          ].map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#93A0B8" }}>
              <span style={{ color: GREEN }}>✅</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 6. سجل المدفوعات */}
      <SectionCard title={t("settings.paymentHistoryTitle")} icon="📄">
        {payments && payments.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid #26314A`, color: "#5D6880", textAlign: "right" }}>
                  <th style={{ padding: "0.5rem", fontWeight: 600 }}>{t("settings.colDate")}</th>
                  <th style={{ padding: "0.5rem", fontWeight: 600 }}>{t("settings.colAmount")}</th>
                  <th style={{ padding: "0.5rem", fontWeight: 600 }}>{t("settings.colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #1B2438" }}>
                    <td style={{ padding: "0.6rem 0.5rem", color: "#93A0B8" }}>{fmtDate(p.created_at, locale)}</td>
                    <td style={{ padding: "0.6rem 0.5rem", color: GOLD_LIGHT, fontWeight: 700 }}>${Number(p.amount).toFixed(2)}</td>
                    <td style={{ padding: "0.6rem 0.5rem", color: p.status === "paid" ? GREEN : RED }}>
                      {p.status === "paid" ? t("settings.statusPaid") : p.status === "refunded" ? t("settings.statusRefunded") : t("settings.statusFailed")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: "#5D6880", fontSize: 13, margin: 0 }}>{t("settings.noPaymentsYet")}</p>
        )}
      </SectionCard>

      {/* 7. كود الخصم */}
      <SectionCard title={t("settings.couponTitle")} icon="️">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder={t("settings.couponPlaceholder")}
            style={{
              flex: 1,
              minWidth: 200,
              background: "#0C1220",
              border: `1px solid #26314A`,
              borderRadius: 3,
              padding: "0.6rem 1rem",
              color: "#fff",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={applyCoupon}
            disabled={couponBusy || !couponCode.trim()}
            style={{
              background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
              color: "#101828",
              border: "none",
              fontWeight: 800,
              fontSize: 13,
              padding: "0.6rem 1.4rem",
              borderRadius: 3,
              cursor: couponBusy ? "wait" : "pointer",
              opacity: couponBusy || !couponCode.trim() ? 0.6 : 1,
            }}
          >
            {couponBusy ? t("settings.couponChecking") : t("settings.couponApply")}
          </button>
        </div>
        {couponResult && (
          <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, color: couponResult.valid ? GREEN : RED }}>
            {couponResult.valid ? "✅" : "️"} {couponResult.message}
          </p>
        )}
      </SectionCard>

      {/* 8. الدعم */}
      <div style={{ ...cardStyle, padding: "1.4rem 1.6rem", textAlign: "center" }}>
        <p style={{ margin: "0 0 10px", fontSize: 14, color: "#93A0B8" }}>{t("settings.supportQuestion")}</p>
        <a
          href="mailto:qaisalraifai@gmail.com"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: `1px solid #3E5478`,
            color: GOLD_LIGHT,
            fontSize: 13,
            fontWeight: 700,
            padding: "0.6rem 1.3rem",
            borderRadius: 3,
            textDecoration: "none",
          }}
        >
          <span>💬</span><span>{t("settings.contactSupport")}</span>
        </a>
      </div>
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <p style={{ margin: "0 0 4px", fontSize: 11, color: "#5D6880" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>{value}</p>
    </div>
  );
}
