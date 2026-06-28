"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    checkAdmin();
    fetchUsers();
  }, []);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") router.push("/dashboard");
  }

  async function fetchUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setUsers(data || []);
    setLoading(false);
  }

  async function updateStatus(id, status) {
    const now = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    await supabase.from("profiles").update({
      subscription_status: status,
      subscription_start: status === "active" ? now.toISOString() : null,
      subscription_end: status === "active" ? end.toISOString() : null,
    }).eq("id", id);
    fetchUsers();
  }

  const filtered = users.filter(u => {
    const matchSearch = u.username?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || u.subscription_status === filter;
    return matchSearch && matchFilter;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => u.subscription_status === "active").length,
    inactive: users.filter(u => u.subscription_status === "inactive").length,
    expiring: users.filter(u => {
      if (!u.subscription_end) return false;
      const days = (new Date(u.subscription_end) - new Date()) / (1000 * 60 * 60 * 24);
      return days > 0 && days <= 7;
    }).length,
  };

  function statusBadge(status, endDate) {
    if (status === "active") {
      const days = endDate ? Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
      if (days !== null && days <= 7) return { label: `ينتهي بـ ${days} أيام`, color: "#C9A24B" };
      return { label: "نشط", color: "#4CAF50" };
    }
    return { label: "منتهي", color: "#666" };
  }

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={s.header}>
        <div>
          <p style={s.headerSub}>لوحة التحكم</p>
          <h1 style={s.headerTitle}>Qais Trading Academy</h1>
        </div>
        <button onClick={() => { supabase.auth.signOut(); router.push("/login"); }} style={s.logoutBtn}>
          تسجيل الخروج
        </button>
      </header>

      {/* Stats */}
      <div style={s.statsRow}>
        {[
          { label: "إجمالي المشتركين", value: stats.total, color: "#C9A24B" },
          { label: "اشتراكات نشطة", value: stats.active, color: "#4CAF50" },
          { label: "اشتراكات منتهية", value: stats.inactive, color: "#666" },
          { label: "تنتهي خلال 7 أيام", value: stats.expiring, color: "#FF9800" },
        ].map((s2, i) => (
          <div key={i} style={s.statCard}>
            <span style={{ ...s.statNum, color: s2.color }}>{s2.value}</span>
            <span style={s.statLabel}>{s2.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={s.toolbar}>
        <input
          placeholder="بحث باسم المستخدم..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={s.searchInput}
        />
        <div style={s.filterBtns}>
          {[["all", "الكل"], ["active", "نشط"], ["inactive", "منتهي"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} style={{ ...s.filterBtn, ...(filter === val ? s.filterBtnActive : {}) }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <p style={s.loading}>جاري التحميل...</p>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {["اسم المستخدم", "الحالة", "بداية الاشتراك", "نهاية الاشتراك", "تاريخ التسجيل", "إجراء"].map((h, i) => (
                  <th key={i} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const badge = statusBadge(user.subscription_status, user.subscription_end);
                return (
                  <tr key={user.id} style={s.tr}>
                    <td style={s.td}>
                      <span style={s.username}>{user.username || "—"}</span>
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, backgroundColor: badge.color + "22", color: badge.color, border: `1px solid ${badge.color}44` }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={s.mono}>{user.subscription_start ? new Date(user.subscription_start).toLocaleDateString("ar") : "—"}</span>
                    </td>
                    <td style={s.td}>
                      <span style={s.mono}>{user.subscription_end ? new Date(user.subscription_end).toLocaleDateString("ar") : "—"}</span>
                    </td>
                    <td style={s.td}>
                      <span style={s.mono}>{new Date(user.created_at).toLocaleDateString("ar")}</span>
                    </td>
                    <td style={s.td}>
                      {user.subscription_status === "active" ? (
                        <button onClick={() => updateStatus(user.id, "inactive")} style={s.btnDanger}>إلغاء</button>
                      ) : (
                        <button onClick={() => updateStatus(user.id, "active")} style={s.btnSuccess}>تفعيل</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ ...s.td, textAlign: "center", color: "#444", padding: "3rem" }}>لا يوجد مستخدمون</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const gold = "#C9A24B";
const ink = "#050505";
const s = {
  page: { backgroundColor: ink, color: "#E8E0D0", direction: "rtl", fontFamily: "'Inter', sans-serif", minHeight: "100vh", padding: "0 0 4rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2rem 3rem", borderBottom: "1px solid #141414" },
  headerSub: { fontFamily: "'JetBrains Mono', monospace", color: gold, fontSize: "0.75rem", letterSpacing: "2px", marginBottom: "0.25rem" },
  headerTitle: { fontSize: "1.4rem", fontWeight: 800 },
  logoutBtn: { background: "none", border: "1px solid #222", color: "#666", padding: "0.5rem 1.2rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1px", backgroundColor: "#111", margin: "2rem 3rem", border: "1px solid #111" },
  statCard: { backgroundColor: "#0d0d0d", padding: "1.75rem 2rem", display: "flex", flexDirection: "column", gap: "0.4rem" },
  statNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: "2rem", fontWeight: 500 },
  statLabel: { color: "#555", fontSize: "0.8rem" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 3rem", marginBottom: "1rem", gap: "1rem", flexWrap: "wrap" },
  searchInput: { backgroundColor: "#0d0d0d", border: "1px solid #1a1a1a", color: "#E8E0D0", padding: "0.6rem 1rem", borderRadius: "4px", fontSize: "0.9rem", width: "280px", outline: "none" },
  filterBtns: { display: "flex", gap: "0.5rem" },
  filterBtn: { background: "none", border: "1px solid #1a1a1a", color: "#555", padding: "0.5rem 1rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" },
  filterBtnActive: { borderColor: gold, color: gold },
  tableWrap: { margin: "0 3rem", border: "1px solid #111", borderRadius: "4px", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { backgroundColor: "#0a0a0a", padding: "1rem 1.25rem", textAlign: "right", fontSize: "0.78rem", color: "#444",
