"use client";
import { useState } from "react";
import { gold, glass, transition } from "../styles";

const menuItems = [
  ["add_user", "👤 إضافة مستخدم"],
  ["add_subscription", "💳 إضافة اشتراك"],
  ["notify", "📢 إرسال إشعار"],
  ["extend", "⏳ تمديد اشتراك"],
  ["discount", "🏷 خصم"],
  ["coupon", "🎟 إنشاء كوبون"],
];

const inputStyle = {
  background: "#0d0d0d",
  border: "1px solid #222",
  color: "#eee",
  padding: "0.6rem 0.8rem",
  borderRadius: 8,
  fontSize: "0.85rem",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

function Modal({ title, onClose, onSubmit, children, submitLabel = "تأكيد" }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }} />
      <div style={{ ...glass, position: "relative", width: "min(380px, 92vw)", padding: "1.6rem", direction: "rtl" }}>
        <h3 style={{ margin: "0 0 1.1rem", fontSize: "1rem", color: "#E8E0D0" }}>{title}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>{children}</div>
        <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.3rem" }}>
          <button onClick={onSubmit} style={{ background: `linear-gradient(135deg, ${gold}, #a07a2e)`, color: "#000", border: "none", padding: "0.6rem 1.2rem", borderRadius: 10, fontWeight: 700, cursor: "pointer", flex: 1 }}>
            {submitLabel}
          </button>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #222", color: "#999", padding: "0.6rem 1.2rem", borderRadius: 10, cursor: "pointer" }}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QuickActions({ users, onAddUser, onNotifyBroadcast, onCreateCoupon, onExtendUser, onDiscountUser }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  function openModal(key) {
    setOpen(false);
    setForm({});
    setModal(key);
  }

  async function submit() {
    if (modal === "add_user") await onAddUser(form);
    if (modal === "notify") await onNotifyBroadcast(form);
    if (modal === "coupon") await onCreateCoupon(form);
    if (modal === "extend") await onExtendUser(form);
    if (modal === "discount") await onDiscountUser(form);
    setModal(null);
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <div style={{ position: "fixed", bottom: 28, left: 28, zIndex: 150 }}>
        {open && (
          <div style={{ ...glass, position: "absolute", bottom: 60, left: 0, minWidth: 200, padding: "0.5rem", boxShadow: "0 12px 30px rgba(0,0,0,0.6)" }}>
            {menuItems.map(([key, label]) => (
              <div
                key={key}
                onClick={() => openModal(key)}
                style={{ padding: "0.65rem 0.8rem", fontSize: "0.85rem", color: "#ccc", cursor: "pointer", borderRadius: 8, transition }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#161616")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {label}
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${gold}, #a07a2e)`,
            border: "none",
            color: "#000",
            fontSize: "1.6rem",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: `0 8px 25px ${gold}55`,
            transition,
            transform: open ? "rotate(45deg)" : "none",
          }}
        >
          +
        </button>
      </div>

      {modal === "add_user" && (
        <Modal title="👤 إضافة مستخدم" onClose={() => setModal(null)} onSubmit={submit}>
          <input placeholder="اسم المستخدم" style={inputStyle} onChange={set("username")} />
          <input placeholder="كلمة المرور" type="password" style={inputStyle} onChange={set("password")} />
          <select style={inputStyle} onChange={set("plan")} defaultValue="member">
            {["trial", "member", "vip", "elite"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Modal>
      )}

      {modal === "add_subscription" && (
        <Modal title="💳 إضافة اشتراك" onClose={() => setModal(null)} onSubmit={() => { onExtendUser(form); setModal(null); }}>
          <select style={inputStyle} onChange={set("userId")} defaultValue="">
            <option value="" disabled>اختر المستخدم</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
          <input placeholder="عدد الأيام (مثلاً 30)" type="number" style={inputStyle} onChange={set("days")} />
        </Modal>
      )}

      {modal === "notify" && (
        <Modal title="📢 إرسال إشعار للجميع" onClose={() => setModal(null)} onSubmit={submit}>
          <input placeholder="عنوان الإشعار" style={inputStyle} onChange={set("title")} />
          <textarea placeholder="نص الإشعار" style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} onChange={set("message")} />
        </Modal>
      )}

      {modal === "extend" && (
        <Modal title="⏳ تمديد اشتراك" onClose={() => setModal(null)} onSubmit={submit}>
          <select style={inputStyle} onChange={set("userId")} defaultValue="">
            <option value="" disabled>اختر المستخدم</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
          <input placeholder="عدد الأيام" type="number" style={inputStyle} onChange={set("days")} />
        </Modal>
      )}

      {modal === "discount" && (
        <Modal title="🏷 منح خصم" onClose={() => setModal(null)} onSubmit={submit}>
          <select style={inputStyle} onChange={set("userId")} defaultValue="">
            <option value="" disabled>اختر المستخدم</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
          <input placeholder="نسبة الخصم %" type="number" style={inputStyle} onChange={set("percent")} />
        </Modal>
      )}

      {modal === "coupon" && (
        <Modal title="🎟 إنشاء كوبون" onClose={() => setModal(null)} onSubmit={submit}>
          <input placeholder="الكود (مثلاً QAIS20)" style={inputStyle} onChange={set("code")} />
          <select style={inputStyle} onChange={set("discount_type")} defaultValue="percent">
            <option value="percent">نسبة %</option>
            <option value="fixed">مبلغ ثابت $</option>
          </select>
          <input placeholder="قيمة الخصم" type="number" style={inputStyle} onChange={set("discount_value")} />
          <input placeholder="أقصى عدد استخدامات (اختياري)" type="number" style={inputStyle} onChange={set("max_uses")} />
        </Modal>
      )}
    </>
  );
}
