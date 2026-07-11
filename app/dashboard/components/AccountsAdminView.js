"use client";

import { useCallback, useEffect, useState } from "react";

import { gold, s, glass, transition } from "../../admin/styles";
import StatCard from "../../admin/components/StatCard";
import Toolbar from "../../admin/components/Toolbar";
import FilterChips from "../../admin/components/FilterChips";
import KpiRow from "../../admin/components/KpiRow";
import { SubscriptionsTrendChart, RevenueBarChart } from "../../admin/components/Charts";
import UsersTable from "../../admin/components/UsersTable";
import UserDrawer from "../../admin/components/UserDrawer";
import ActivityFeed from "../../admin/components/ActivityFeed";
import QuickActions from "../../admin/components/QuickActions";

/*
 * نفس محتوى لوحة تحكم الأدمن (app/admin/page.js) بالضبط، بس من غير الـ <header>
 * الخاص فيها (لأنه صفحة الداشبورد عندها هيدر وسايدبار خاص فيها أصلاً).
 * هيك تبويب "إدارة الحسابات" جوا الداشبورد بيصير مطابق 100% للوحة /admin المستقلة.
 */
export default function AccountsAdminView() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [statuses, setStatuses] = useState([]);
  const [sort, setSort] = useState("newest");
  const [chips, setChips] = useState([]);

  const [drawerUserId, setDrawerUserId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, period, statuses, sort]);

  useEffect(() => {
    fetchStats();
    fetchFeed();
    const interval = setInterval(fetchFeed, 20000);
    return () => clearInterval(interval);
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const params = new URLSearchParams({ search, period, sort, status: statuses.join(",") });
    const res = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }

  async function fetchStats() {
    const res = await fetch("/api/admin/stats");
    const data = await res.json();
    setStats(data);
  }

  async function fetchFeed() {
    const res = await fetch("/api/admin/activity");
    const data = await res.json();
    setFeed(data.items || []);
  }

  const fetchDetail = useCallback(async (userId) => {
    const res = await fetch(`/api/admin/users/${userId}`);
    return res.json();
  }, []);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 2800);
  }

  async function callAction(userId, action, payload = {}) {
    const res = await fetch(`/api/admin/users/${userId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || "صار خطأ", true);
      return false;
    }
    return true;
  }

  // فلترة إضافية من Chips وتقاطعها مع plan الحقيقي بعد ما توصل البيانات
  const chipFiltered = users.filter((u) => {
    if (chips.length === 0) return true;
    return chips.some((chip) => {
      if (chip === "vip") return u.plan === "vip";
      if (chip === "elite") return u.plan === "elite";
      if (chip === "trial") return u.plan === "trial";
      if (chip === "expired") return u.subscription_status !== "active";
      if (chip === "cancelled") return u.subscription_status === "inactive" && !u.suspended;
      if (chip === "pending") return u.subscription_status === "inactive" && u.daysLeft === null;
      return true;
    });
  });

  function toggleStatus(v) {
    setStatuses((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }
  function toggleChip(v) {
    setChips((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }

  // إجراءات الجدول / القائمة المنسدلة
  async function handleTableAction(key, user) {
    if (key === "view") {
      setDrawerUserId(user.id);
      return;
    }
    if (key === "edit") {
      setDrawerUserId(user.id);
      return;
    }
    if (key === "renew") {
      const ok = await callAction(user.id, "renew");
      if (ok) {
        showToast(`تم تجديد اشتراك ${user.username}`);
        fetchUsers();
        fetchStats();
        fetchFeed();
      }
      return;
    }
    if (key === "email") {
      const title = prompt("عنوان الإشعار:");
      if (!title) return;
      const message = prompt("نص الإشعار:") || "";
      const ok = await callAction(user.id, "notify", { title, message });
      if (ok) showToast("تم إرسال الإشعار");
      return;
    }
    if (key === "suspend") {
      if (!confirm(`تأكيد إيقاف حساب ${user.username}؟`)) return;
      const ok = await callAction(user.id, "suspend");
      if (ok) {
        showToast(`تم إيقاف ${user.username}`);
        fetchUsers();
        fetchFeed();
      }
      return;
    }
    if (key === "delete") {
      if (!confirm(`تأكيد حذف حساب ${user.username} نهائياً؟ لا يمكن التراجع.`)) return;
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast(`تم حذف ${user.username}`);
        fetchUsers();
        fetchStats();
      } else showToast("فشل الحذف", true);
      return;
    }
  }

  // إجراءات الـ Drawer
  async function handleDrawerAction(key, profile, form) {
    if (key === "save_edit") {
      const res = await fetch(`/api/admin/users/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        showToast("تم الحفظ");
        fetchUsers();
      } else showToast("فشل الحفظ", true);
      return;
    }
    if (key === "suspend" || key === "unsuspend") {
      const ok = await callAction(profile.id, key);
      if (ok) {
        showToast(key === "suspend" ? "تم الإيقاف" : "تم رفع الإيقاف");
        fetchUsers();
        setDrawerUserId(null);
      }
      return;
    }
    if (key === "delete") {
      if (!confirm("تأكيد حذف الحساب نهائياً؟")) return;
      const res = await fetch(`/api/admin/users/${profile.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("تم الحذف");
        setDrawerUserId(null);
        fetchUsers();
        fetchStats();
      }
      return;
    }
  }

  // Quick Actions (+)
  async function handleAddUser(form) {
    const res = await fetch("/api/admin/quick-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "add_user", payload: form }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast("تمت إضافة المستخدم");
      fetchUsers();
      fetchStats();
    } else showToast(data.error || "فشل الإضافة", true);
  }
  async function handleNotifyBroadcast(form) {
    const res = await fetch("/api/admin/quick-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "broadcast_notification", payload: form }),
    });
    if (res.ok) showToast("تم إرسال الإشعار للجميع");
    else showToast("فشل الإرسال", true);
  }
  async function handleCreateCoupon(form) {
    const res = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) showToast(`تم إنشاء الكوبون ${form.code}`);
    else showToast(data.error || "فشل الإنشاء", true);
  }
  async function handleExtendUser(form) {
    if (!form.userId) return showToast("اختر مستخدم", true);
    const ok = await callAction(form.userId, "extend", { days: Number(form.days) || 30 });
    if (ok) {
      showToast("تم التمديد");
      fetchUsers();
      fetchStats();
    }
  }
  async function handleDiscountUser(form) {
    if (!form.userId) return showToast("اختر مستخدم", true);
    const ok = await callAction(form.userId, "discount", { percent: Number(form.percent) || 0 });
    if (ok) showToast("تم منح الخصم");
  }

  function handleExport() {
    window.open("/api/admin/export", "_blank");
  }

  const cards = stats?.cards;
  const trend = stats?.charts?.signupsTrend?.map((d) => d.value) || [];

  return (
    <div>
      {/* الإحصائيات */}
      <div style={{ ...s.section, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <StatCard icon="👥" label="إجمالي المستخدمين" value={cards?.totalUsers ?? 0} color={gold} sparkline={trend} sub="آخر 30 يوم" />
        <StatCard icon="🟢" label="نشطون الآن" value={cards?.activeNow ?? 0} color="#4CAF50" sub="آخر 15 دقيقة" />
        <StatCard icon="💎" label="أعضاء VIP" value={cards?.vipCount ?? 0} color="#B26FE0" />
        <StatCard icon="📈" label="معدل التجديد" value={cards?.renewalRate ?? 0} suffix="%" color="#4FA8E0" />
        <StatCard icon="💰" label="الإيرادات الشهرية" value={cards?.monthlyRevenue ?? 0} prefix="$" color={gold} />
        <StatCard icon="💵" label="الإيرادات الكلية" value={cards?.totalRevenue ?? 0} prefix="$" color={gold} />
        <StatCard icon="⌛" label="تنتهي خلال 7 أيام" value={cards?.expiringSoon ?? 0} color="#FF9800" />
        <StatCard icon="❌" label="اشتراكات منتهية" value={cards?.expiredCount ?? 0} color="#8b8b8b" />
      </div>

      <div style={s.divider} />

      {/* الرسوم البيانية */}
      <div style={{ ...s.section, display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <SubscriptionsTrendChart data={stats?.charts?.signupsTrend} />
        <RevenueBarChart data={stats?.charts?.revenueByMonth} />
      </div>

      {/* KPIs */}
      <div style={s.section}>
        <KpiRow kpis={stats?.kpis} />
      </div>

      <div style={s.divider} />

      {/* Toolbar + Chips */}
      <div style={{ ...s.section, display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Toolbar
          search={search}
          setSearch={setSearch}
          period={period}
          setPeriod={setPeriod}
          statuses={statuses}
          toggleStatus={toggleStatus}
          sort={sort}
          setSort={setSort}
          onExport={handleExport}
        />
        <FilterChips active={chips} toggle={toggleChip} />
      </div>

      {/* الجدول + Activity Feed */}
      <div style={{ ...s.section, display: "flex", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "3 1 640px", minWidth: 320 }}>
          <UsersTable users={chipFiltered} loading={loading} onOpenUser={(u) => setDrawerUserId(u.id)} onAction={handleTableAction} />
        </div>
        <div style={{ flex: "1 1 260px", minWidth: 260 }}>
          <ActivityFeed items={feed} />
        </div>
      </div>

      {drawerUserId && (
        <UserDrawer userId={drawerUserId} onClose={() => setDrawerUserId(null)} onAction={handleDrawerAction} fetchDetail={fetchDetail} />
      )}

      <QuickActions
        users={users}
        onAddUser={handleAddUser}
        onNotifyBroadcast={handleNotifyBroadcast}
        onCreateCoupon={handleCreateCoupon}
        onExtendUser={handleExtendUser}
        onDiscountUser={handleDiscountUser}
      />

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            right: 28,
            zIndex: 300,
            ...glass,
            padding: "0.8rem 1.3rem",
            color: toast.isError ? "#ef5350" : "#4CAF50",
            borderColor: toast.isError ? "#ef535055" : "#4CAF5055",
            fontSize: "0.85rem",
            transition,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
