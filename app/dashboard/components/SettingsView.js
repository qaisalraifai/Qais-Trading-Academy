"use client";
import { useEffect, useState } from "react";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";
const GOLD_DARK = "#9C7A22";
const GREEN = "#02C076";
const RED = "#F6465D";
const BLUE = "#4FA8E0";

const cardStyle = {
  background: "linear-gradient(145deg, #22252B, #181A20)",
  border: `1px solid ${GOLD}26`,
  borderRadius: 18,
  boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
};

const PLAN_INFO = {
  member: { label: "Member", icon: "⭐", color: "#9a9a9a" },
  trial: { label: "Trial", icon: "🔷", color: BLUE },
  elite: { label: "Elite Access", icon: "👑", color: GOLD },
  vip: { label: "VIP", icon: "💎", color: BLUE },
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar", { year: "numeric", month: "2-digit", day: "2-digit" });
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
      if (!res.ok) throw new Error(json.error || "تعذر تحميل بيانات الحساب");
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
      setCouponResult({ valid: false, message: "صار خطأ، جرب مرة ثانية" });
    } finally {
      setCouponBusy(false);
    }
  }

  if (loading) {
    return <div style={{ color: "#666", fontSize: 14, padding: "3rem 0", textAlign: "center" }}>...جاري تحميل بيانات الحساب</div>;
  }

  if (error || !data) {
    return (
      <div style={{ ...cardStyle, padding: "3rem", textAlign: "center", color: "#666", fontSize: 14 }}>
        تعذر تحميل بيانات الحساب. {error}
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
                  background: isActive ? "#0f3d2c" : "#3d1a1a",
                  border: `1px solid ${isActive ? GREEN : RED}33`,
                  color: isActive ? GREEN : RED,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "0.25rem 0.7rem",
                  borderRadius: 20,
                }}
              >
                {isActive ? "🟢 نشط" : "🔴 غير نشط"}
              </span>
            </div>
            <p style={{ margin: 0, color: "#888", fontSize: 12 }}>وصول كامل لجميع الميزات</p>
          </div>
          <div style={{ textAlign: "left" }}>
            <p style={{ margin: 0, color: "#888", fontSize: 12 }}>{username}</p>
          </div>
        </div>

        {daysLeft !== null && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#999", marginBottom: 6 }}>
              <span>ينتهي بعد {daysLeft} يوم</span>
              <span>{fmtDate(profile.subscription_end)}</span>
            </div>
            <div style={{ width: "100%", height: 7, background: "#1a1a0a", borderRadius: 4, overflow: "hidden" }}>
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
      <SectionCard title="معلومات الفاتورة" icon="💳">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: lastPayment?.invoice_url ? "1rem" : 0 }}>
          <InfoField label="آخر دفعة" value={lastPayment ? `$${Number(lastPayment.amount).toFixed(2)}` : "—"} />
          <InfoField label="طريقة الدفع" value={lastPayment?.method === "whop" ? "بطاقة عبر Whop" : lastPayment?.method || "—"} />
          <InfoField label="تاريخ آخر دفعة" value={lastPayment ? fmtDate(lastPayment.created_at) : "—"} />
          <InfoField label="رقم الفاتورة" value={lastPayment ? `#${String(lastPayment.id).slice(0, 8).toUpperCase()}` : "—"} />
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
              border: `1px solid ${GOLD}44`,
              color: GOLD_LIGHT,
              fontSize: 13,
              fontWeight: 700,
              padding: "0.55rem 1.1rem",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            <span>⬇️</span><span>تحميل الفاتورة PDF</span>
          </a>
        )}
      </SectionCard>

      {/* 2.5 طريقة الدفع */}
      <SectionCard title="طريقة الدفع" icon="💳">
        {hasWhopMembership ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>
                {membership?.cancelAtPeriodEnd ? "الاشتراك مجدول للإيقاف" : "بطاقتك مسجلة عبر Whop"}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>
                تقدر تحدّث بطاقتك أو تلغي اشتراكك من صفحة طلباتك على Whop.
              </p>
            </div>
            <a
              href={managementUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                border: `1px solid ${GOLD}66`,
                background: "transparent",
                color: GOLD_LIGHT,
                fontSize: 13,
                fontWeight: 700,
                padding: "0.55rem 1.1rem",
                borderRadius: 10,
                textDecoration: "none",
              }}
            >
              إدارة الاشتراك على Whop ↗
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>ما في طريقة دفع مضافة</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>ضيف بطاقة حتى تفعّل اشتراكك وتوصل لكل الميزات.</p>
            </div>
            <a
              href="/payment"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
                color: "#1a1608",
                border: "none",
                fontWeight: 800,
                fontSize: 13,
                padding: "0.6rem 1.3rem",
                borderRadius: 10,
                textDecoration: "none",
              }}
            >
              <span>➕</span><span>الاشتراك الآن</span>
            </a>
          </div>
        )}
      </SectionCard>

      {/* 3. التجديد */}
      <SectionCard title="التجديد" icon="🔄">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>
              التجديد التلقائي {data.profile.auto_renew ? "مفعّل" : "متوقف"}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>
              {data.profile.auto_renew
                ? "رح يتجدد اشتراكك تلقائياً بنهاية الفترة الحالية."
                : "وصولك رح يستمر لحد نهاية الفترة المدفوعة الحالية، وما رح ينخصم شي بعدها."}
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
              border: `1px solid ${GOLD}66`,
              color: data.profile.auto_renew ? "#1a1608" : GOLD_LIGHT,
              fontWeight: 800,
              fontSize: 13,
              padding: "0.6rem 1.2rem",
              borderRadius: 10,
              cursor: renewBusy ? "wait" : "pointer",
              opacity: renewBusy ? 0.6 : 1,
            }}
          >
            {renewBusy ? "...جاري الحفظ" : data.profile.auto_renew ? "إيقاف التجديد التلقائي" : "تشغيل التجديد التلقائي"}
          </button>
        </div>

      </SectionCard>

      {/* 4. تغيير الخطة */}
      <SectionCard title="تغيير الخطة" icon="🎫">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.9rem" }}>
          {["member", "elite", "vip"].map((key) => {
            const info = PLAN_INFO[key];
            const isCurrent = profile.plan === key;
            return (
              <div
                key={key}
                style={{
                  border: `1px solid ${isCurrent ? GOLD : "#222"}`,
                  background: isCurrent ? `linear-gradient(135deg, ${GOLD}1a, #181A20)` : "#181A20",
                  borderRadius: 12,
                  padding: "1rem",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 4 }}>{info.icon}</div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: isCurrent ? GOLD_LIGHT : "#ccc" }}>{info.label}</p>
                {isCurrent ? (
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 8,
                      fontSize: 10,
                      fontWeight: 800,
                      color: "#1a1608",
                      background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
                      padding: "3px 10px",
                      borderRadius: 20,
                    }}
                  >
                    Current Plan
                  </span>
                ) : (
                  <a
                    href={`mailto:qaisalraifai@gmail.com?subject=${encodeURIComponent("طلب تغيير خطة الاشتراك")}&body=${encodeURIComponent(`بدي غيّر خطتي إلى ${info.label}`)}`}
                    style={{ display: "block", marginTop: 8, fontSize: 11, color: "#888", textDecoration: "underline" }}
                  >
                    تواصل مع الدعم للتغيير
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* 5. المزايا الحالية */}
      <SectionCard title="مزايا الاشتراك" icon="📋">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.6rem" }}>
          {["جميع المحاضرات", "التقويم الاقتصادي", "Replay التدريب", "الاستراتيجيات", "التقارير", "مجتمع Discord"].map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#ccc" }}>
              <span style={{ color: GREEN }}>✅</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 6. سجل المدفوعات */}
      <SectionCard title="سجل المدفوعات" icon="📄">
        {payments && payments.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${GOLD}22`, color: "#888", textAlign: "right" }}>
                  <th style={{ padding: "0.5rem", fontWeight: 600 }}>التاريخ</th>
                  <th style={{ padding: "0.5rem", fontWeight: 600 }}>المبلغ</th>
                  <th style={{ padding: "0.5rem", fontWeight: 600 }}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #1a1a0a" }}>
                    <td style={{ padding: "0.6rem 0.5rem", color: "#ccc" }}>{fmtDate(p.created_at)}</td>
                    <td style={{ padding: "0.6rem 0.5rem", color: GOLD_LIGHT, fontWeight: 700 }}>${Number(p.amount).toFixed(2)}</td>
                    <td style={{ padding: "0.6rem 0.5rem", color: p.status === "paid" ? GREEN : RED }}>
                      {p.status === "paid" ? "✅ مكتمل" : p.status === "refunded" ? "↩️ مسترجع" : "❌ فشل"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: "#666", fontSize: 13, margin: 0 }}>ما في دفعات مسجلة لهلق.</p>
        )}
      </SectionCard>

      {/* 7. كود الخصم */}
      <SectionCard title="عندك كوبون؟" icon="🏷️">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="أدخل كود الخصم"
            style={{
              flex: 1,
              minWidth: 200,
              background: "#181A20",
              border: `1px solid ${GOLD}33`,
              borderRadius: 10,
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
              color: "#1a1608",
              border: "none",
              fontWeight: 800,
              fontSize: 13,
              padding: "0.6rem 1.4rem",
              borderRadius: 10,
              cursor: couponBusy ? "wait" : "pointer",
              opacity: couponBusy || !couponCode.trim() ? 0.6 : 1,
            }}
          >
            {couponBusy ? "...جاري التحقق" : "تطبيق"}
          </button>
        </div>
        {couponResult && (
          <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, color: couponResult.valid ? GREEN : RED }}>
            {couponResult.valid ? "✅" : "⚠️"} {couponResult.message}
          </p>
        )}
      </SectionCard>

      {/* 8. الدعم */}
      <div style={{ ...cardStyle, padding: "1.4rem 1.6rem", textAlign: "center" }}>
        <p style={{ margin: "0 0 10px", fontSize: 14, color: "#ccc" }}>هل تواجه مشكلة في الاشتراك؟</p>
        <a
          href="mailto:qaisalraifai@gmail.com"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: `1px solid ${GOLD}44`,
            color: GOLD_LIGHT,
            fontSize: 13,
            fontWeight: 700,
            padding: "0.6rem 1.3rem",
            borderRadius: 10,
            textDecoration: "none",
          }}
        >
          <span>💬</span><span>تواصل مع الدعم</span>
        </a>
      </div>
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <p style={{ margin: "0 0 4px", fontSize: 11, color: "#888" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>{value}</p>
    </div>
  );
}
