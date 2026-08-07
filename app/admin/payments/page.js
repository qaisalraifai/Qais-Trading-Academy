"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { gold, s, glass } from "../styles";

const inputStyle = {
  background: "#080B14",
  border: "1px solid #1E2941",
  color: "#EDF1F8",
  borderRadius: 3,
  padding: "0.55rem 0.8rem",
  fontSize: "0.85rem",
  fontFamily: "inherit",
};

const TABS = [
  { key: "pending", label: "بانتظار المراجعة" },
  { key: "methods", label: "وسائل الدفع" },
  { key: "wallets", label: "محافظ الكريبتو" },
  { key: "stats", label: "الإحصائيات" },
];

export default function AdminPaymentsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const [pending, setPending] = useState([]);
  const [providers, setProviders] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [stats, setStats] = useState(null);

  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [newWallet, setNewWallet] = useState({ network: "TRC20", currency: "USDT", address: "", label: "" });

  useEffect(() => {
    checkAdmin();
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push("/login");
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") router.push("/dashboard");
  }

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  }

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [pendingRes, providersRes, walletsRes, statsRes] = await Promise.all([
        fetch("/api/admin/payments/pending").then((r) => r.json()),
        fetch("/api/admin/payment-methods").then((r) => r.json()),
        fetch("/api/admin/crypto-wallets").then((r) => r.json()),
        fetch("/api/admin/payments/stats").then((r) => r.json()),
      ]);
      setPending(pendingRes.pending || []);
      setProviders(providersRes.providers || []);
      setWallets(walletsRes.wallets || []);
      setStats(statsRes);
    } catch (e) {
      setError("تعذر تحميل بيانات المدفوعات");
    } finally {
      setLoading(false);
    }
  }

  async function approveTx(id) {
    try {
      const res = await fetch(`/api/admin/payments/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("تم تفعيل الاشتراك ✅");
      loadAll();
    } catch (e) {
      showToast(e.message || "فشلت الموافقة", true);
    }
  }

  async function rejectTx(id) {
    try {
      const res = await fetch(`/api/admin/payments/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("تم الرفض وإبلاغ الطالب");
      setRejectingId(null);
      setRejectReason("");
      loadAll();
    } catch (e) {
      showToast(e.message || "فشل الرفض", true);
    }
  }

  async function toggleProvider(code, enabled) {
    try {
      const res = await fetch("/api/admin/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, enabled }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      loadAll();
    } catch (e) {
      showToast(e.message || "فشل التحديث", true);
    }
  }

  async function addWallet() {
    if (!newWallet.address) return showToast("لازم تدخل عنوان المحفظة", true);
    try {
      const res = await fetch("/api/admin/crypto-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWallet),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("تمت إضافة المحفظة");
      setNewWallet({ network: "TRC20", currency: "USDT", address: "", label: "" });
      loadAll();
    } catch (e) {
      showToast(e.message || "فشلت الإضافة", true);
    }
  }

  async function toggleWallet(id, is_active) {
    await fetch(`/api/admin/crypto-wallets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    loadAll();
  }

  async function deleteWallet(id) {
    if (!confirm("متأكد من حذف هاي المحفظة؟")) return;
    await fetch(`/api/admin/crypto-wallets/${id}`, { method: "DELETE" });
    loadAll();
  }

  function handleExport() {
    window.open("/api/admin/payments/export", "_blank");
  }

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={s.header}>
        <div>
          <div style={s.headerSub}>QAIS TRADING ACADEMY — إدارة</div>
          <div style={s.headerTitle}>إدارة المدفوعات</div>
        </div>
        <a href="/admin" style={{ color: gold, textDecoration: "none", fontSize: "0.85rem" }}>← رجوع للوحة الأدمن</a>
      </div>

      <div style={{ ...s.section, display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              ...s.btn,
              ...(tab === t.key ? s.btnGold : {}),
            }}
          >
            {t.label}
            {t.key === "pending" && pending.length > 0 ? ` (${pending.length})` : ""}
          </button>
        ))}
      </div>

      {error && <div style={{ ...s.section, color: "#E8495F" }}>{error}</div>}
      {loading ? (
        <div style={{ ...s.section, color: "#5D6880" }}>...جاري التحميل</div>
      ) : (
        <>
          {tab === "pending" && (
            <div style={s.section}>
              <div style={s.sectionTitle}>طلبات دفع USDT اليدوي بانتظار موافقتك — التفعيل فوري بعد الموافقة</div>
              {pending.length === 0 ? (
                <div style={{ ...s.card, padding: "2rem", textAlign: "center", color: "#5D6880" }}>لا يوجد طلبات حالياً 🎉</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {pending.map((p) => (
                    <div key={p.id} style={{ ...s.card, padding: "1.25rem", display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "flex-start" }}>
                      {p.proofUrl && (
                        <a href={p.proofUrl} target="_blank" rel="noreferrer">
                          <img src={p.proofUrl} alt="إثبات التحويل" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 3, border: "1px solid #1E2941" }} />
                        </a>
                      )}
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontWeight: 700 }}>{p.user?.username || "—"} <span style={{ color: "#5D6880", fontWeight: 400 }}>({p.user?.email || "—"})</span></div>
                        <div style={{ color: "#5D6880", fontSize: "0.85rem", marginTop: "0.3rem" }}>
                          {p.planCode === "signup" ? "اشتراك أول" : "تجديد شهري"} · {p.amount} {p.currency} · شبكة {p.network || "—"}
                        </div>
                        <div style={{ color: "#aaa", fontSize: "0.8rem", marginTop: "0.3rem", fontFamily: "monospace" }}>
                          TXID: {p.txid || "لم يُدخل"}
                        </div>
                        <div style={{ color: "#3E4761", fontSize: "0.75rem", marginTop: "0.3rem" }}>
                          {new Date(p.submittedAt || p.createdAt).toLocaleString("ar-EG")}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 160 }}>
                        <button onClick={() => approveTx(p.id)} style={{ ...s.btn, ...s.btnGold }}>موافقة وتفعيل</button>
                        {rejectingId === p.id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                            <input
                              placeholder="سبب الرفض (اختياري)"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              style={inputStyle}
                            />
                            <div style={{ display: "flex", gap: "0.4rem" }}>
                              <button onClick={() => rejectTx(p.id)} style={{ ...s.btn, ...s.btnDanger, flex: 1 }}>تأكيد الرفض</button>
                              <button onClick={() => setRejectingId(null)} style={{ ...s.btn, flex: 1 }}>إلغاء</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setRejectingId(p.id)} style={{ ...s.btn, ...s.btnDanger }}>رفض</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "methods" && (
            <div style={s.section}>
              <div style={s.sectionTitle}>تفعيل أو تعطيل أي وسيلة دفع — بينعكس فوراً على صفحة الدفع للطلاب</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {providers.map((p) => (
                  <div key={p.code} style={{ ...s.card, padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.name} <span style={{ color: "#3E4761", fontSize: "0.75rem" }}>({p.code})</span></div>
                      <div style={{ color: "#5D6880", fontSize: "0.8rem", marginTop: "0.2rem" }}>{p.description}</div>
                      <div style={{ color: "#3E4761", fontSize: "0.75rem", marginTop: "0.2rem" }}>
                        {p.supports_auto_renew ? "تجديد تلقائي" : "بدون تجديد تلقائي — يعتمد على نظام الفوترة والتذكيرات"}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleProvider(p.code, !p.enabled)}
                      style={{ ...s.btn, ...(p.enabled ? s.btnGold : {}) }}
                    >
                      {p.enabled ? "مفعّل" : "معطّل"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "wallets" && (
            <div style={s.section}>
              <div style={s.sectionTitle}>محافظ استقبال USDT — تظهر للطالب حسب الشبكة اللي يختارها</div>
              <div style={{ ...s.card, padding: "1.25rem", marginBottom: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
                <select value={newWallet.network} onChange={(e) => setNewWallet({ ...newWallet, network: e.target.value })} style={inputStyle}>
                  <option value="TRC20">TRC20 (Tron)</option>
                  <option value="BEP20">BEP20 (BNB Chain)</option>
                  <option value="ERC20">ERC20 (Ethereum)</option>
                </select>
                <input placeholder="عنوان المحفظة" value={newWallet.address} onChange={(e) => setNewWallet({ ...newWallet, address: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
                <input placeholder="ملاحظة داخلية (اختياري)" value={newWallet.label} onChange={(e) => setNewWallet({ ...newWallet, label: e.target.value })} style={{ ...inputStyle, minWidth: 160 }} />
                <button onClick={addWallet} style={{ ...s.btn, ...s.btnGold }}>+ إضافة محفظة</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {wallets.map((w) => (
                  <div key={w.id} style={{ ...s.card, padding: "0.9rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.6rem" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{w.network} · {w.currency}</div>
                      <div style={{ color: "#aaa", fontSize: "0.8rem", fontFamily: "monospace", marginTop: "0.2rem" }}>{w.address}</div>
                      {w.label && <div style={{ color: "#3E4761", fontSize: "0.75rem", marginTop: "0.2rem" }}>{w.label}</div>}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => toggleWallet(w.id, !w.is_active)} style={{ ...s.btn, ...(w.is_active ? s.btnGold : {}) }}>
                        {w.is_active ? "فعّالة" : "معطّلة"}
                      </button>
                      <button onClick={() => deleteWallet(w.id)} style={{ ...s.btn, ...s.btnDanger }}>حذف</button>
                    </div>
                  </div>
                ))}
                {wallets.length === 0 && <div style={{ color: "#5D6880" }}>ما في محافظ مضافة بعد.</div>}
              </div>
            </div>
          )}

          {tab === "stats" && stats && (
            <div style={s.section}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
                <div style={s.sectionTitle}>إجمالي الإيرادات وعدد العمليات لكل وسيلة دفع</div>
                <button onClick={handleExport} style={{ ...s.btn, ...s.btnGold }}>تصدير سجل المدفوعات CSV</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
                <div style={{ ...s.card, padding: "1.25rem" }}>
                  <div style={{ color: "#5D6880", fontSize: "0.8rem" }}>إجمالي الإيرادات</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: gold }}>${stats.totalRevenue?.toFixed(2)}</div>
                </div>
                <div style={{ ...s.card, padding: "1.25rem" }}>
                  <div style={{ color: "#5D6880", fontSize: "0.8rem" }}>عدد العمليات الناجحة</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800 }}>{stats.totalCount}</div>
                </div>
                <div style={{ ...s.card, padding: "1.25rem" }}>
                  <div style={{ color: "#5D6880", fontSize: "0.8rem" }}>بانتظار المراجعة</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#FF9800" }}>{stats.pendingReview}</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "1.5rem" }}>
                {stats.byProvider?.map((p) => (
                  <div key={p.code} style={{ ...s.card, padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ display: "flex", gap: "1.5rem", color: "#aaa", fontSize: "0.85rem" }}>
                      <span>{p.count} عملية</span>
                      <span style={{ color: gold, fontWeight: 700 }}>${p.revenue.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)",
          background: toast.isError ? "#E8495F" : gold, color: "#111726", padding: "0.7rem 1.4rem",
          borderRadius: 3, fontWeight: 700, fontSize: "0.85rem", zIndex: 999,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
