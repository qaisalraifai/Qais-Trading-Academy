"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { gold, s, glass, transition } from "../styles";

const BONUS_LABELS = {
  direct: "مباشرة", renewal: "تجديد", binary: "ثنائية", matching: "مطابقة",
  rank: "رتبة", leadership: "قيادة", infinity: "Infinity", fast_start: "انطلاقة", achievement: "إنجاز",
};
const METHOD_LABELS = { bank_transfer: "تحويل بنكي", e_wallet: "محفظة إلكترونية", usdt: "USDT" };

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MlmOpsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState("withdrawals");
  const [withdrawals, setWithdrawals] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [kycProfiles, setKycProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => { checkAdmin(); }, []);
  useEffect(() => {
    if (tab === "withdrawals") fetchWithdrawals();
    else if (tab === "commissions") fetchCommissions();
    else fetchKyc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") router.push("/dashboard");
  }

  async function fetchWithdrawals() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/mlm-withdrawals?status=pending");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWithdrawals(data.withdrawals || []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  async function fetchCommissions() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/mlm-commissions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCommissions(data.commissions || []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  async function processWithdrawal(id, action) {
    if (action === "reject" && !confirm("متأكدة بدك ترفضي هالطلب؟")) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/mlm-withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId: id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchWithdrawals();
    } catch (e) { setError(e.message); } finally { setBusyId(null); }
  }

  async function fetchKyc() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/mlm-kyc?status=pending");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKycProfiles(data.profiles || []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  async function processKyc(userId, action) {
    if (action === "reject" && !confirm("متأكدة بدك ترفضي التحقق؟")) return;
    setBusyId(userId);
    try {
      const res = await fetch("/api/admin/mlm-kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchKyc();
    } catch (e) { setError(e.message); } finally { setBusyId(null); }
  }

  async function cancelCommission(id) {
    if (!confirm("متأكدة بدك تلغي هالعمولة؟ رح ينخصم المبلغ من محفظة العضو.")) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/mlm-commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchCommissions();
    } catch (e) { setError(e.message); } finally { setBusyId(null); }
  }

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={s.header}>
        <div>
          <div style={s.headerSub}>QAIS TRADING ACADEMY — إدارة</div>
          <div style={s.headerTitle}>💸 السحوبات والعمولات</div>
        </div>
        <a href="/admin" style={{ color: gold, textDecoration: "none", fontSize: "0.85rem" }}>← رجوع للوحة الأدمن</a>
      </div>

      <div style={{ ...s.section, display: "flex", gap: "0.6rem" }}>
        {["withdrawals", "commissions", "kyc"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? gold : "transparent",
              color: tab === t ? "#111" : "#aaa",
              border: `1px solid ${tab === t ? gold : "#2a2a2a"}`,
              borderRadius: 8, padding: "0.5rem 1.2rem", cursor: "pointer", fontWeight: 700, transition,
            }}
          >
            {t === "withdrawals" ? "طلبات السحب المعلّقة" : t === "commissions" ? "كل العمولات" : "طلبات KYC المعلّقة"}
          </button>
        ))}
      </div>

      <div style={s.section}>
        {error && <div style={{ color: "#FF4D4F", marginBottom: "1rem" }}>{error}</div>}
        {loading ? (
          <div style={{ color: "#888" }}>جاري التحميل...</div>
        ) : tab === "withdrawals" ? (
          withdrawals.length === 0 ? (
            <div style={{ color: "#555" }}>ما في طلبات سحب معلّقة حاليًا</div>
          ) : (
            <div style={{ display: "grid", gap: "0.8rem" }}>
              {withdrawals.map((w) => (
                <div key={w.id} style={{ ...glass, padding: "1rem 1.4rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{w.profiles?.username || w.user_id}</div>
                    <div style={{ fontSize: "0.8rem", color: "#888" }}>
                      {fmt(w.amount)} دينار — {METHOD_LABELS[w.method]} — {w.destination_details}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#666" }}>{new Date(w.requested_at).toLocaleString("ar")}</div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button disabled={busyId === w.id} onClick={() => processWithdrawal(w.id, "approve")}
                      style={{ background: "#4CAF50", color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 700 }}>
                      موافقة ودُفع
                    </button>
                    <button disabled={busyId === w.id} onClick={() => processWithdrawal(w.id, "reject")}
                      style={{ background: "transparent", color: "#FF4D4F", border: "1px solid #FF4D4F", borderRadius: 8, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 700 }}>
                      رفض
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : tab === "kyc" ? (
          kycProfiles.length === 0 ? (
            <div style={{ color: "#555" }}>ما في طلبات KYC معلّقة حاليًا</div>
          ) : (
            <div style={{ display: "grid", gap: "0.8rem" }}>
              {kycProfiles.map((p) => (
                <div key={p.id} style={{ ...glass, padding: "1rem 1.4rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {p.username}
                      {p.is_flagged_suspicious && (
                        <span style={{ color: "#FF4D4F", fontSize: "0.75rem", marginRight: 8 }}>⚠️ مشبوه: {p.flagged_reason}</span>
                      )}
                    </div>
                    {p.documentSignedUrl ? (
                      <a href={p.documentSignedUrl} target="_blank" rel="noreferrer" style={{ color: gold, fontSize: "0.8rem" }}>
                        عرض المستند →
                      </a>
                    ) : (
                      <div style={{ fontSize: "0.8rem", color: "#666" }}>لا يوجد مستند مرفوع</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button disabled={busyId === p.id} onClick={() => processKyc(p.id, "verify")}
                      style={{ background: "#4CAF50", color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 700 }}>
                      توثيق
                    </button>
                    <button disabled={busyId === p.id} onClick={() => processKyc(p.id, "reject")}
                      style={{ background: "transparent", color: "#FF4D4F", border: "1px solid #FF4D4F", borderRadius: 8, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 700 }}>
                      رفض
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : commissions.length === 0 ? (
          <div style={{ color: "#555" }}>لا يوجد عمولات</div>
        ) : (
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {commissions.map((c) => (
              <div key={c.id} style={{ ...glass, padding: "0.8rem 1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.8rem", opacity: c.status === "cancelled" ? 0.5 : 1 }}>
                <div style={{ fontSize: "0.85rem" }}>
                  <strong>{c.beneficiary?.username || c.beneficiary_id}</strong> — {BONUS_LABELS[c.bonus_type] || c.bonus_type} — {fmt(c.amount)} دينار
                  <span style={{ color: "#666", marginRight: 8 }}>{new Date(c.created_at).toLocaleDateString("ar")}</span>
                </div>
                {c.status !== "cancelled" && (
                  <button disabled={busyId === c.id} onClick={() => cancelCommission(c.id)}
                    style={{ background: "transparent", color: "#FF4D4F", border: "1px solid #FF4D4F", borderRadius: 6, padding: "0.35rem 0.8rem", cursor: "pointer", fontSize: "0.75rem" }}>
                    إلغاء
                  </button>
                )}
                {c.status === "cancelled" && <span style={{ fontSize: "0.75rem", color: "#888" }}>ملغاة</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
