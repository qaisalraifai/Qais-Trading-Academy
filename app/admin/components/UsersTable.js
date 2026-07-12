"use client";
import { useState } from "react";
import { gold, glass, transition, monoStack, statusColors, planColors, daysLeftColor, timeAgo } from "../styles";

const roleBadge = {
  admin: { label: "🟣 ADMIN", ...planColors.admin },
};

function PlanBadge({ plan }) {
  const conf = planColors[plan] || planColors.member;
  const labels = { owner: "🟡 OWNER", admin: "🟣 ADMIN", vip: "🔵 VIP", elite: "🟡 ELITE", member: "⚪ MEMBER", trial: "🔷 TRIAL" };
  return (
    <span style={{ background: conf.bg, color: conf.fg, border: `1px solid ${conf.border}`, padding: "0.28rem 0.7rem", borderRadius: 999, fontSize: "0.72rem", fontWeight: 600 }}>
      {labels[plan] || plan}
    </span>
  );
}

function StatusDot({ user }) {
  let color, label;
  if (user.suspended) { color = statusColors.suspended; label = "⚫ Suspended"; }
  else if (user.subscription_status !== "active") { color = statusColors.expired; label = "🔴 Expired"; }
  else if (user.plan === "vip" || user.plan === "elite") { color = statusColors.vip; label = "🟣 VIP"; }
  else if (user.daysLeft !== null && user.daysLeft <= 7) { color = statusColors.expiring; label = "🟡 Expiring Soon"; }
  else { color = statusColors.active; label = "🟢 Active"; }
  return <span style={{ color, fontSize: "0.8rem", fontWeight: 500 }}>{label}</span>;
}

function Avatar({ user }) {
  const initial = (user.username || "?").charAt(0).toUpperCase();
  return user.avatar_url ? (
    <img src={user.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: `1px solid ${gold}44` }} />
  ) : (
    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#1c1c1c,#0a0a0a)", border: `1px solid ${gold}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", color: gold, fontWeight: 700 }}>
      {initial}
    </div>
  );
}

const actionsList = [
  ["view", "👁 عرض"],
  ["edit", "✏ تعديل"],
  ["renew", "🔄 تجديد"],
  ["activate_free", "🎁 تفعيل مجاني"],
  ["email", "📧 إشعار"],
  ["suspend", "🚫 إيقاف"],
  ["delete", "🗑 حذف"],
];

function ActionsMenu({ user, onAction }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ background: "none", border: "1px solid #222", color: "#999", width: 30, height: 30, borderRadius: 8, cursor: "pointer" }}
      >
        ⚙
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 36,
              zIndex: 50,
              background: "#0d0d0d",
              border: "1px solid #222",
              borderRadius: 10,
              minWidth: 150,
              boxShadow: "0 12px 30px rgba(0,0,0,0.6)",
              overflow: "hidden",
            }}
          >
            {actionsList.map(([key, label]) => (
              <div
                key={key}
                onClick={() => { setOpen(false); onAction(key, user); }}
                style={{
                  padding: "0.6rem 0.9rem",
                  fontSize: "0.82rem",
                  color: key === "delete" ? "#ef5350" : "#ccc",
                  cursor: "pointer",
                  transition,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#161616")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function UsersTable({ users, loading, onOpenUser, onAction }) {
  const [hoverRow, setHoverRow] = useState(null);

  return (
    <div style={{ ...glass, overflow: "hidden" }}>
      {loading ? (
        <p style={{ textAlign: "center", padding: "3rem", color: "#444" }}>جاري التحميل...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
            <thead>
              <tr>
                {["", "الاسم", "الرتبة", "الخطة", "البداية", "النهاية", "الأيام المتبقية", "المدفوع", "الحالة", "آخر دخول", ""].map((h, i) => (
                  <th key={i} style={{ background: "#0a0a0a", padding: "0.9rem 1.1rem", textAlign: "right", fontSize: "0.74rem", color: "#444", fontWeight: 500, borderBottom: "1px solid #111", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  onMouseEnter={() => setHoverRow(user.id)}
                  onMouseLeave={() => setHoverRow(null)}
                  onClick={() => onOpenUser(user)}
                  style={{
                    borderBottom: "1px solid #0d0d0d",
                    cursor: "pointer",
                    background: hoverRow === user.id ? "rgba(201,162,75,0.045)" : "transparent",
                    transition,
                  }}
                >
                  <td style={{ padding: "0.85rem 1.1rem" }}><Avatar user={user} /></td>
                  <td style={{ padding: "0.85rem 1.1rem", fontWeight: 500, color: "#E8E0D0" }}>{user.username || "—"}</td>
                  <td style={{ padding: "0.85rem 1.1rem" }}>
                    {user.role === "admin" ? <PlanBadge plan="admin" /> : <span style={{ color: "#555", fontSize: "0.8rem" }}>Student</span>}
                  </td>
                  <td style={{ padding: "0.85rem 1.1rem" }}><PlanBadge plan={user.plan} /></td>
                  <td style={{ padding: "0.85rem 1.1rem", fontFamily: monoStack, color: "#666", fontSize: "0.8rem" }}>
                    {user.subscription_start ? new Date(user.subscription_start).toLocaleDateString("ar") : "—"}
                  </td>
                  <td style={{ padding: "0.85rem 1.1rem", fontFamily: monoStack, color: "#666", fontSize: "0.8rem" }}>
                    {user.subscription_end ? new Date(user.subscription_end).toLocaleDateString("ar") : "—"}
                  </td>
                  <td style={{ padding: "0.85rem 1.1rem" }}>
                    {user.daysLeft !== null ? (
                      <span style={{ color: daysLeftColor(user.daysLeft), fontFamily: monoStack, fontSize: "0.82rem", fontWeight: 600 }}>
                        {user.daysLeft > 0 ? `${user.daysLeft} يوم` : "منتهي"}
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ padding: "0.85rem 1.1rem", fontFamily: monoStack, color: gold, fontSize: "0.85rem" }}>${user.totalPaid.toLocaleString("en-US")}</td>
                  <td style={{ padding: "0.85rem 1.1rem" }}><StatusDot user={user} /></td>
                  <td style={{ padding: "0.85rem 1.1rem", color: "#555", fontSize: "0.78rem" }}>{timeAgo(user.last_login_at)}</td>
                  <td style={{ padding: "0.85rem 1.1rem" }} onClick={(e) => e.stopPropagation()}>
                    <ActionsMenu user={user} onAction={onAction} />
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: "center", color: "#444", padding: "3rem" }}>لا يوجد مستخدمون</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
