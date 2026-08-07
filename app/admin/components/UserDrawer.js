"use client";
import { useEffect, useState } from "react";
import { gold, glass, transition, monoStack, timeAgo } from "../styles";

/* لون النشاط — نقطة ملوّنة بدل إيموجي. اللون لحاله بيوصل الحالة
   (أخضر = تم، كهرماني = تنبيه، أحمر = فشل، رمادي = محايد). */
const ACTIVITY_COLOR = {
  login: "#10E5A0",
  renew: "#10E5A0",
  password_change: "#F0A13C",
  watch_course: "#10E5A0",
  payment_failed: "#FF453A",
  suspended: "#FF453A",
  unsuspended: "#10E5A0",
  deleted: "#FF453A",
  note: "#6E6690",
  discount: "#F0A13C",
  coupon_created: "#F0A13C",
  extended: "#10E5A0",
  free_activation: "#7C4DFF",
};

function ActivityDot({ type }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        flexShrink: 0,
        background: ACTIVITY_COLOR[type] || "#6E6690",
      }}
    />
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", fontSize: "0.85rem" }}>
      <span style={{ color: "#6E6690" }}>{label}</span>
      <span style={{ color: "#F5F3FF", fontFamily: monoStack, fontSize: "0.82rem" }}>{value ?? "—"}</span>
    </div>
  );
}

function SectionDivider({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", margin: "1.3rem 0 0.5rem" }}>
      <span style={{ fontSize: "0.72rem", color: "#4A4368", fontWeight: 600, letterSpacing: "0.5px" }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: "#241C3E" }} />
    </div>
  );
}

export default function UserDrawer({ userId, onClose, onAction, fetchDetail }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDetail(userId).then((d) => {
      if (!cancelled) {
        setData(d);
        setForm({ username: d?.profile?.username || "", email: d?.profile?.email || "", phone: d?.profile?.phone || "", country: d?.profile?.country || "", plan: d?.profile?.plan || "member" });
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [userId, fetchDetail]);

  const p = data?.profile;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", zIndex: 90, animation: "fadeIn 200ms" }} />
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width: "min(420px, 92vw)",
          background: "#0A0614",
          borderLeft: "1px solid #241C3E",
          boxShadow: "20px 0 60px rgba(0,0,0,0.6)",
          zIndex: 100,
          overflowY: "auto",
          padding: "1.6rem",
          direction: "rtl",
          animation: "slideIn 280ms cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <style>{`
          @keyframes slideIn { from { transform: translateX(-100%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
          @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        `}</style>

        <button onClick={onClose} style={{ background: "none", border: "1px solid #1E1836", color: "#6E6690", borderRadius: 3, width: 32, height: 32, cursor: "pointer", marginBottom: "1rem" }}>✕</button>

        {loading || !p ? (
          <p style={{ color: "#4A4368", textAlign: "center", padding: "3rem 0" }}>جاري التحميل...</p>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem", padding: "0.5rem 0 1rem" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#141024,#141024)", border: `2px solid ${gold}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", color: gold, fontWeight: 700, overflow: "hidden" }}>
                {p.avatar_url ? <img src={p.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (p.username || "?").charAt(0).toUpperCase()}
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>{p.username}</div>
              <div style={{ fontSize: "0.78rem", color: gold }}>{p.plan === "elite" ? "Elite Member" : p.plan === "vip" ? "VIP Member" : p.role === "admin" ? "Administrator" : "Member"}</div>
            </div>

            <SectionDivider>معلومات الحساب</SectionDivider>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {["username", "email", "phone", "country"].map((f) => (
                  <input key={f} placeholder={f} value={form[f] || ""} onChange={(e) => setForm({ ...form, [f]: e.target.value })} style={{ background: "#0A0614", border: "1px solid #1E1836", color: "#F5F3FF", padding: "0.5rem 0.7rem", borderRadius: 3, fontSize: "0.85rem" }} />
                ))}
                <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} style={{ background: "#0A0614", border: "1px solid #1E1836", color: "#F5F3FF", padding: "0.5rem 0.7rem", borderRadius: 3, fontSize: "0.85rem" }}>
                  {["trial", "member", "vip", "elite"].map((pl) => <option key={pl} value={pl}>{pl}</option>)}
                </select>
              </div>
            ) : (
              <>
                <Row label="البريد" value={p.email} />
                <Row label="الهاتف" value={p.phone} />
                <Row label="الدولة" value={p.country} />
                <Row label="IP" value={p.last_login_ip} />
                <Row label="آخر جهاز" value={p.last_device} />
                <Row label="آخر تسجيل دخول" value={timeAgo(p.last_login_at)} />
                <Row label="عدد تسجيلات الدخول" value={p.login_count} />
              </>
            )}

            <SectionDivider>الاشتراك</SectionDivider>
            <Row label="نوع الخطة" value={p.plan} />
            <Row label="بداية" value={p.subscription_start ? new Date(p.subscription_start).toLocaleDateString("ar") : "—"} />
            <Row label="نهاية" value={p.subscription_end ? new Date(p.subscription_end).toLocaleDateString("ar") : "—"} />
            <Row label="Auto Renew" value={p.auto_renew ? "مفعّل" : "غير مفعّل"} />

            <SectionDivider>Payments</SectionDivider>
            {data.payments?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {data.payments.slice(0, 8).map((pay) => (
                  <div key={pay.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", padding: "0.4rem 0", borderBottom: "1px solid #141024" }}>
                    <span style={{ color: "#A79FC4" }}>{new Date(pay.created_at).toLocaleDateString("ar")}</span>
                    <span style={{ color: pay.status === "paid" ? "#10E5A0" : "#FF453A" }}>{pay.status}</span>
                    <span style={{ fontFamily: monoStack, color: gold }}>${Number(pay.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : <p style={{ color: "#4A4368", fontSize: "0.8rem" }}>لا يوجد دفعات مسجلة</p>}

            <SectionDivider>Timeline</SectionDivider>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", maxHeight: 220, overflowY: "auto" }}>
              {data.activity?.length ? data.activity.map((a) => (
                <div key={a.id} style={{ display: "flex", gap: "0.5rem", fontSize: "0.8rem" }}>
                  <ActivityDot type={a.type} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#A79FC4" }}>{a.message}</div>
                    <div style={{ color: "#4A4368", fontSize: "0.7rem" }}>{timeAgo(a.created_at)}</div>
                  </div>
                </div>
              )) : <p style={{ color: "#4A4368", fontSize: "0.8rem" }}>لا يوجد أنشطة مسجلة</p>}
            </div>

            <SectionDivider>Actions</SectionDivider>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              {editing ? (
                <>
                  <button
                    onClick={async () => { await onAction("save_edit", p, form); setEditing(false); }}
                    style={{ background: `linear-gradient(135deg, ${gold}, #8A7CB8)`, color: "#000", border: "none", padding: "0.55rem 1.1rem", borderRadius: 3, cursor: "pointer", fontWeight: 700, fontSize: "0.82rem" }}
                  >
                    حفظ
                  </button>
                  <button onClick={() => setEditing(false)} style={{ background: "none", border: "1px solid #1E1836", color: "#A79FC4", padding: "0.55rem 1.1rem", borderRadius: 3, cursor: "pointer", fontSize: "0.82rem" }}>إلغاء</button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditing(true)} style={actionBtnStyle()}>Edit</button>
                  {p.role !== "admin" && (
                    <button onClick={() => onAction("activate_free", p)} style={actionBtnStyle("#10E5A0")}>تفعيل مجاني</button>
                  )}
                  <button onClick={() => onAction(p.suspended ? "unsuspend" : "suspend", p)} style={actionBtnStyle("#FF9800")}>{p.suspended ? "رفع الإيقاف" : "Suspend"}</button>
                  <button onClick={() => onAction("delete", p)} style={actionBtnStyle("#FF453A")}>Delete</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function actionBtnStyle(color = "#A79FC4") {
  return {
    background: "none",
    border: `1px solid ${color}44`,
    color,
    padding: "0.55rem 1.1rem",
    borderRadius: 3,
    cursor: "pointer",
    fontSize: "0.82rem",
    transition,
  };
}
