"use client";
import { useState } from "react";
import { gold, glass, transition, monoStack, statusColors, planColors, daysLeftColor, timeAgo } from "../styles";

const roleBadge = {
  admin: { label: "ADMIN", ...planColors.admin },
};

function PlanBadge({ plan }) {
  const conf = planColors[plan] || planColors.member;
  const labels = { owner: "OWNER", admin: "ADMIN", vip: "VIP", elite: "ELITE", member: "MEMBER", trial: "TRIAL" };
  return (
    <span style={{ background: conf.bg, color: conf.fg, border: `1px solid ${conf.border}`, padding: "0.28rem 0.7rem", borderRadius: 999, fontSize: "0.72rem", fontWeight: 600 }}>
      {labels[plan] || plan}
    </span>
  );
}

function StatusDot({ user }) {
  let color, label;
  if (user.suspended) { color = statusColors.suspended; label = "Suspended"; }
  else if (user.subscription_status !== "active") { color = statusColors.expired; label = "Expired"; }
  else if (user.plan === "vip" || user.plan === "elite") { color = statusColors.vip; label = "VIP"; }
  else if (user.daysLeft !== null && user.daysLeft <= 7) { color = statusColors.expiring; label = "Expiring Soon"; }
  else { color = statusColors.active; label = "Active"; }
  return <span style={{ color, fontSize: "0.8rem", fontWeight: 500 }}>{label}</span>;
}

function Avatar({ user }) {
  const initial = (user.username || "?").charAt(0).toUpperCase();
  return user.avatar_url ? (
    <img src={user.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: `1px solid ${gold}44` }} />
  ) : (
    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#141024,#141024)", border: `1px solid ${gold}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", color: gold, fontWeight: 700 }}>
      {initial}
    </div>
  );
}

const actionsList = [
  ["view", "👁", "عرض"],
  ["edit", "✏", "تعديل"],
 ["renew","","تجديد"],
 ["activate_free","","تفعيل مجاني"],
  ["email", "📧", "إشعار"],
  ["suspend", "🚫", "إيقاف"],
 ["delete","","حذف"],
];

async function activateFreeDirect(user) {
  try {
    const res = await fetch(`/api/admin/users/${user.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "activate_free", payload: {} }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      alert(`تم تفعيل وصول مجاني لحساب ${user.username}`);
      window.location.reload();
    } else {
      alert(`فشل الطلب (${res.status}): ${data.error || "خطأ غير معروف"}`);
    }
  } catch (err) {
    alert(`خطأ بالاتصال: ${err.message}`);
  }
}

function ActionsBar({ user, onAction }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", justifyContent: "flex-start" }}
    >
      {actionsList.map(([key, icon, label]) => {
        if (key === "activate_free" && user.role === "admin") return null; // ما تظهر لحساب الأدمن، مو محتاجها
        const isFree = key === "activate_free";
        return (
          <button
            key={key}
            title={label}
            onClick={() => (isFree ? activateFreeDirect(user) : onAction(key, user))}
            style={{
              background: "none",
              border: "1px solid #1E1836",
              color: key === "delete" ? "#FF453A" : "#A79FC4",
              width: 28,
              height: 28,
              minWidth: 28,
              borderRadius: 3,
              cursor: "pointer",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = key === "delete" ? "#FF453A" : gold; e.currentTarget.style.background = "#141024"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1E1836"; e.currentTarget.style.background = "none"; }}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}

export default function UsersTable({ users, loading, onOpenUser, onAction }) {
  const [hoverRow, setHoverRow] = useState(null);

  return (
    <div style={{ ...glass, overflow: "hidden" }}>
      {loading ? (
        <p style={{ textAlign: "center", padding: "3rem", color: "#4A4368" }}>جاري التحميل...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
            <thead>
              <tr>
                {["", "الاسم", "الرتبة", "الخطة", "البداية", "النهاية", "الأيام المتبقية", "المدفوع", "الحالة", "آخر دخول", ""].map((h, i) => (
                  <th key={i} style={{ background: "#141024", padding: "0.9rem 1.1rem", textAlign: "right", fontSize: "0.74rem", color: "#4A4368", fontWeight: 500, borderBottom: "1px solid #141024", whiteSpace: "nowrap" }}>
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
                    borderBottom: "1px solid #0A0614",
                    cursor: "pointer",
                    background: hoverRow === user.id ? "rgba(201,162,75,0.045)" : "transparent",
                    transition,
                  }}
                >
                  <td style={{ padding: "0.85rem 1.1rem" }}><Avatar user={user} /></td>
                  <td style={{ padding: "0.85rem 1.1rem", fontWeight: 500, color: "#F5F3FF" }}>{user.username || "—"}</td>
                  <td style={{ padding: "0.85rem 1.1rem" }}>
                    {user.role === "admin" ? <PlanBadge plan="admin" /> : <span style={{ color: "#4A4368", fontSize: "0.8rem" }}>Student</span>}
                  </td>
                  <td style={{ padding: "0.85rem 1.1rem" }}><PlanBadge plan={user.plan} /></td>
                  <td style={{ padding: "0.85rem 1.1rem", fontFamily: monoStack, color: "#6E6690", fontSize: "0.8rem" }}>
                    {user.subscription_start ? new Date(user.subscription_start).toLocaleDateString("ar") : "—"}
                  </td>
                  <td style={{ padding: "0.85rem 1.1rem", fontFamily: monoStack, color: "#6E6690", fontSize: "0.8rem" }}>
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
                  <td style={{ padding: "0.85rem 1.1rem", color: "#4A4368", fontSize: "0.78rem" }}>{timeAgo(user.last_login_at)}</td>
                  <td style={{ padding: "0.85rem 1.1rem" }} onClick={(e) => e.stopPropagation()}>
                    <ActionsBar user={user} onAction={onAction} />
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: "center", color: "#4A4368", padding: "3rem" }}>لا يوجد مستخدمون</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
