"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { gold, s as baseStyles, glass, transition } from "../styles";

const STATUS_LABELS = {
  pending: "قيد المراجعة",
  approved: "مفعّل",
  rejected: "مرفوض",
  suspended: "معلّق",
};

const STATUS_COLORS = {
  pending: "#eab308",
  approved: "#4CAF50",
  rejected: "#ef4444",
  suspended: "#888",
};

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdminAffiliatesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [tab, setTab] = useState("applications"); // applications | payouts | settings
  const [affiliates, setAffiliates] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [payoutFilter, setPayoutFilter] = useState("awaiting_transfer");

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (tab === "applications") fetchAffiliates();
    if (tab === "payouts") fetchPayouts();
    if (tab === "settings") fetchSettings();
  }, [tab, payoutFilter]);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") { router.push("/dashboard"); return; }
    fetchAffiliates();
  }

  async function fetchAffiliates() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/affiliates");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطأ");
      setAffiliates(json.affiliates || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPayouts() {
    setLoading(true);
    setError("");
    try {
      const url = payoutFilter ? `/api/admin/affiliates/payouts?status=${payoutFilter}` : "/api/admin/affiliates/payouts";
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطأ");
      setPayouts(json.payouts || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSettings() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/affiliates/settings");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطأ");
      setSettings(json.settings);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id, action) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/affiliates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطأ");
      await fetchAffiliates();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkPaid(id) {
    const reference = window.prompt("رقم/مرجع التحويل (اختياري):", "");
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/affiliates/payouts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_paid", reference }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطأ");
      await fetchPayouts();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkFailed(id) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/affiliates/payouts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_failed" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطأ");
      await fetchPayouts();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/affiliates/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطأ");
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div style={baseStyles.page}>
      <div style={baseStyles.header}>
        <div>
          <p style={baseStyles.headerSub}>QAIS TRADING ACADEMY — ADMIN</p>
          <h1 style={baseStyles.headerTitle}>إدارة برنامج التسويق بالعمولة</h1>
        </div>
        <Link href="/admin" style={{ ...baseStyles.btn, textDecoration: "none" }}>← رجوع للوحة الأدمن</Link>
      </div>

      <div style={{ ...styles.tabs, margin: "1.5rem 3rem 0" }}>
        {[
          { key: "applications", label: "طلبات المسوّقين" },
          { key: "payouts", label: "دفعات الصرف" },
          { key: "settings", label: "إعدادات العمولة" },
        ].map((t) => (
          <div
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ ...styles.tab, ...(tab === t.key ? styles.tabActive : {}) }}
          >
            {t.label}
          </div>
        ))}
      </div>

      <div style={baseStyles.section}>
        {error && <div style={styles.errorBox}>{error}</div>}

        {loading ? (
          <p style={{ color: "#666" }}>جاري التحميل...</p>
        ) : tab === "applications" ? (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>الاسم</th>
                  <th style={styles.th}>كود الإحالة</th>
                  <th style={styles.th}>الحالة</th>
                  <th style={styles.th}>طريقة الاستلام</th>
                  <th style={styles.th}>معلّق</th>
                  <th style={styles.th}>جاهز</th>
                  <th style={styles.th}>مدفوع</th>
                  <th style={styles.th}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.length === 0 && (
                  <tr><td style={styles.td} colSpan={8}>ما في طلبات لسا</td></tr>
                )}
                {affiliates.map((a) => (
                  <tr key={a.id}>
                    <td style={styles.td}>{a.username}</td>
                    <td style={{ ...styles.td, fontFamily: "monospace" }}>{a.affiliate_code || "-"}</td>
                    <td style={styles.td}>
                      <span style={{ color: STATUS_COLORS[a.affiliate_status] || "#888" }}>
                        {STATUS_LABELS[a.affiliate_status] || a.affiliate_status}
                      </span>
                    </td>
                    <td style={styles.td}>{a.payout_method || "-"}</td>
                    <td style={styles.td}>${fmt(a.totals.pending)}</td>
                    <td style={styles.td}>${fmt(a.totals.ready)}</td>
                    <td style={styles.td}>${fmt(a.totals.paid)}</td>
                    <td style={styles.td}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {a.affiliate_status === "pending" && (
                          <>
                            <button disabled={busyId === a.id} onClick={() => handleAction(a.id, "approve")} style={{ ...baseStyles.btn, ...baseStyles.btnGold }}>موافقة</button>
                            <button disabled={busyId === a.id} onClick={() => handleAction(a.id, "reject")} style={{ ...baseStyles.btn, ...baseStyles.btnDanger }}>رفض</button>
                          </>
                        )}
                        {a.affiliate_status === "approved" && (
                          <button disabled={busyId === a.id} onClick={() => handleAction(a.id, "suspend")} style={{ ...baseStyles.btn, ...baseStyles.btnDanger }}>تعليق</button>
                        )}
                        {(a.affiliate_status === "suspended" || a.affiliate_status === "rejected") && (
                          <button disabled={busyId === a.id} onClick={() => handleAction(a.id, "reactivate")} style={{ ...baseStyles.btn, ...baseStyles.btnGold }}>إعادة تفعيل</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "payouts" ? (
          <>
            <div style={{ ...styles.tabs, marginBottom: "1rem" }}>
              {[
                { key: "awaiting_transfer", label: "بانتظار التحويل" },
                { key: "paid", label: "تم الدفع" },
                { key: "failed", label: "فشل" },
                { key: "", label: "الكل" },
              ].map((f) => (
                <div key={f.key} onClick={() => setPayoutFilter(f.key)} style={{ ...styles.tab, ...(payoutFilter === f.key ? styles.tabActive : {}), fontSize: "0.78rem" }}>
                  {f.label}
                </div>
              ))}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>المسوّق</th>
                    <th style={styles.th}>المبلغ</th>
                    <th style={styles.th}>طريقة التحويل</th>
                    <th style={styles.th}>الحالة</th>
                    <th style={styles.th}>الفترة</th>
                    <th style={styles.th}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.length === 0 && (
                    <tr><td style={styles.td} colSpan={6}>ما في دفعات بهاي الحالة</td></tr>
                  )}
                  {payouts.map((p) => (
                    <tr key={p.id}>
                      <td style={styles.td}>{p.affiliate_username} <span style={{ color: "#555", fontFamily: "monospace", fontSize: "0.75rem" }}>({p.affiliate_code})</span></td>
                      <td style={styles.td}>${fmt(p.amount)}</td>
                      <td style={styles.td}>
                        {p.method}
                        {p.payout_details?.email ? ` — ${p.payout_details.email}` : ""}
                        {p.payout_details?.account ? ` — ${p.payout_details.account}` : ""}
                      </td>
                      <td style={styles.td}>{p.status}</td>
                      <td style={styles.td}>
                        {p.period_start ? new Date(p.period_start).toLocaleDateString("ar") : "-"}
                        {" → "}
                        {p.period_end ? new Date(p.period_end).toLocaleDateString("ar") : "-"}
                      </td>
                      <td style={styles.td}>
                        {p.status === "awaiting_transfer" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button disabled={busyId === p.id} onClick={() => handleMarkPaid(p.id)} style={{ ...baseStyles.btn, ...baseStyles.btnGold }}>تأشير كمدفوعة</button>
                            <button disabled={busyId === p.id} onClick={() => handleMarkFailed(p.id)} style={{ ...baseStyles.btn, ...baseStyles.btnDanger }}>فشل</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : tab === "settings" && settings ? (
          <div style={{ ...glass, padding: "2rem", maxWidth: 480 }}>
            <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "1.5rem", lineHeight: 1.8 }}>
              نسب العمولة لكل مستوى (من قيمة كل دفعة)، والحد الأدنى للمبلغ حتى يتجهز للصرف،
              ودورة الصرف بالأيام (14 = كل أسبوعين).
            </p>
            {[
              { key: "level1_percent", label: "نسبة المستوى 1 (%)" },
              { key: "level2_percent", label: "نسبة المستوى 2 (%)" },
              { key: "level3_percent", label: "نسبة المستوى 3 (%)" },
              { key: "min_payout_usd", label: "الحد الأدنى للصرف ($)" },
              { key: "payout_cycle_days", label: "دورة الصرف (أيام)" },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: "1.1rem" }}>
                <label style={{ display: "block", color: "#888", fontSize: "0.8rem", marginBottom: 6 }}>{f.label}</label>
                <input
                  type="number"
                  value={settings[f.key]}
                  onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
                  style={styles.input}
                />
              </div>
            ))}
            <button disabled={savingSettings} onClick={handleSaveSettings} style={{ ...baseStyles.btn, ...baseStyles.btnGold, marginTop: "0.5rem" }}>
              {savingSettings ? "جاري الحفظ..." : "حفظ الإعدادات"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  tabs: { display: "flex", gap: 8, flexWrap: "wrap" },
  tab: { padding: "0.6rem 1.1rem", borderRadius: 10, border: "1px solid #222", color: "#888", fontSize: "0.85rem", cursor: "pointer", transition },
  tabActive: { color: gold, borderColor: `${gold}66`, background: `${gold}11` },
  errorBox: { background: "#2a0d0d", border: "1px solid #ef444444", color: "#ef4444", padding: "0.8rem 1rem", borderRadius: 8, marginBottom: "1.2rem", fontSize: "0.85rem" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "right", color: "#666", fontSize: "0.75rem", padding: "0.7rem", borderBottom: "1px solid #1c1c1c" },
  td: { padding: "0.7rem", fontSize: "0.85rem", color: "#C8C0B0", borderBottom: "1px solid #1c1c1c" },
  input: { width: "100%", background: "#080808", border: "1px solid #1e1e1e", color: "#FFFFFF", padding: "0.7rem 1rem", borderRadius: 6, fontSize: "0.9rem" },
};
