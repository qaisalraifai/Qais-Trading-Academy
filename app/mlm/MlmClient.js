"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

const GOLD = "#D4AF37";
const BG = "#0B0E11";
const CARD = "#0d0d0d";
const BORDER = "#2B2F36";

const BONUS_LABELS = {
  direct: "عمولة مباشرة",
  renewal: "عمولة تجديد",
  binary: "عمولة ثنائية",
  matching: "عمولة مطابقة",
  rank: "مكافأة رتبة",
  leadership: "صندوق قيادة",
  infinity: "Infinity Bonus",
  fast_start: "انطلاقة سريعة",
  achievement: "مكافأة إنجاز",
};

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: "1.5rem",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function TreeSlot({ label, child }) {
  return (
    <div
      style={{
        flex: 1,
        background: "#181A20",
        border: `1px dashed ${child ? GOLD + "55" : "#2A2E39"}`,
        borderRadius: 12,
        padding: "1rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "0.7rem", color: "#777", marginBottom: 6 }}>{label}</div>
      {child ? (
        <>
          <div style={{ fontWeight: 700 }}>{child.username}</div>
          <div style={{ fontSize: "0.7rem", color: child.is_active_member ? "#4CAF50" : "#888", marginTop: 4 }}>
            {child.is_active_member ? "نشط" : "غير نشط"}
          </div>
        </>
      ) : (
        <div style={{ color: "#555", fontSize: "0.85rem" }}>مكان فاضي</div>
      )}
    </div>
  );
}

export default function MlmClient({ embedded = false }) {
  const router = useRouter();
  const supabase = createClient();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kycStatus, setKycStatus] = useState("none");
  const [kycFile, setKycFile] = useState(null);
  const [kycUploading, setKycUploading] = useState(false);
  const [kycMsg, setKycMsg] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("bank_transfer");
  const [withdrawDest, setWithdrawDest] = useState("");
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);

  useEffect(() => {
    load();
    loadKyc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadKyc() {
    try {
      const res = await fetch("/api/mlm/kyc");
      const json = await res.json();
      if (res.ok) setKycStatus(json.kycStatus);
    } catch {}
  }

  async function submitKyc(e) {
    e.preventDefault();
    if (!kycFile) return;
    setKycUploading(true);
    setKycMsg("");
    try {
      const formData = new FormData();
      formData.append("file", kycFile);
      const res = await fetch("/api/mlm/kyc", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setKycStatus("pending");
      setKycMsg("تم إرسال المستند، بانتظار مراجعة الإدارة");
    } catch (e) {
      setKycMsg(e.message);
    } finally {
      setKycUploading(false);
    }
  }

  async function submitWithdraw(e) {
    e.preventDefault();
    setWithdrawBusy(true);
    setWithdrawMsg("");
    try {
      const res = await fetch("/api/mlm/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(withdrawAmount), method: withdrawMethod, destinationDetails: withdrawDest }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setWithdrawMsg("تم إرسال طلب السحب بنجاح، بانتظار الموافقة");
      setWithdrawAmount("");
      setWithdrawDest("");
      await load();
    } catch (e) {
      setWithdrawMsg(e.message);
    } finally {
      setWithdrawBusy(false);
    }
  }

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      const res = await fetch("/api/mlm/my-summary");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل التحميل");
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const outerStyle = embedded
    ? { color: "#EAECEF", direction: "rtl", fontFamily: "'Inter', sans-serif" }
    : { background: BG, color: "#EAECEF", minHeight: "100vh", padding: "2.5rem 3rem", direction: "rtl", fontFamily: "'Inter', sans-serif" };

  if (loading) {
    return (
      <div style={embedded ? { color: "#EAECEF", direction: "rtl" } : { background: BG, color: "#EAECEF", minHeight: "100vh", padding: "3rem", direction: "rtl" }}>
        جاري التحميل...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={embedded ? { color: "#F6465D", direction: "rtl" } : { background: BG, color: "#F6465D", minHeight: "100vh", padding: "3rem", direction: "rtl" }}>
        {error || "خطأ غير متوقع"}
      </div>
    );
  }

  const { profile, rank, nextRank, tree, wallets, recentCommissions } = data;
  const totalTeamCv = Number(profile.cvLeft || 0) + Number(profile.cvRight || 0);

  return (
    <div style={outerStyle}>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ color: GOLD, fontSize: "0.75rem", letterSpacing: 2, marginBottom: 4 }}>QAIS TRADING ACADEMY</div>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: 0 }}>مركز الشبكة الخاص بي</h1>
      </div>

      {/* الرتبة */}
      <Card style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#888" }}>الرتبة الحالية</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: GOLD }}>{rank?.name_ar || "بدون رتبة"}</div>
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: "0.75rem", color: profile.isActiveMember ? "#4CAF50" : "#F6465D" }}>
              {profile.isActiveMember ? "● عضوية نشطة" : "● عضوية غير نشطة"}
            </div>
            <div style={{ fontSize: "0.7rem", color: "#666", marginTop: 2 }}>
              آخر تجديد: {profile.lastRenewalAt ? new Date(profile.lastRenewalAt).toLocaleDateString("ar") : "—"}
            </div>
          </div>
        </div>

        {nextRank && (
          <div style={{ marginTop: "1.2rem", paddingTop: "1.2rem", borderTop: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: "0.75rem", color: "#888", marginBottom: 6 }}>
              للترقية لرتبة {nextRank.name_ar}: {profile.directCount}/{nextRank.min_direct_members} مباشرين — {fmt(totalTeamCv)}/{fmt(nextRank.min_total_cv)} CV
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#2B2F36", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (profile.directCount / nextRank.min_direct_members) * 100)}%`, height: "100%", background: GOLD }} />
              </div>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#2B2F36", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (totalTeamCv / nextRank.min_total_cv) * 100)}%`, height: "100%", background: GOLD }} />
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* المحافظ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          ["محفظة العمولات", wallets.commission],
          ["محفظة المكافآت", wallets.bonus],
          ["محفظة الكاش باك", wallets.cashback],
          ["محفظة السحب", wallets.withdrawal],
        ].map(([label, value]) => (
          <Card key={label}>
            <div style={{ fontSize: "0.75rem", color: "#888", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800 }}>{fmt(value)} <span style={{ fontSize: "0.75rem", color: "#888" }}>دينار</span></div>
          </Card>
        ))}
      </div>

      {/* الشجرة الثنائية */}
      <Card style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.85rem", color: "#888" }}>شجرتي الثنائية (المباشرة تحتي)</div>
          <a href="/mlm/tree" style={{ color: GOLD, fontSize: "0.8rem", textDecoration: "none" }}>عرض الشجرة الكاملة →</a>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <TreeSlot label="الرجل اليسرى" child={tree.leftChild} />
          <TreeSlot label="الرجل اليمنى" child={tree.rightChild} />
        </div>
        <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", fontSize: "0.8rem", color: "#888" }}>
          <div>CV يسار: <strong style={{ color: "#EAECEF" }}>{fmt(profile.cvLeft)}</strong></div>
          <div>CV يمين: <strong style={{ color: "#EAECEF" }}>{fmt(profile.cvRight)}</strong></div>
          <div>غير مُطابق (Carry): <strong style={{ color: "#EAECEF" }}>{fmt(profile.carryLeft)} / {fmt(profile.carryRight)}</strong></div>
        </div>
      </Card>

      {/* KYC */}
      <Card style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.85rem", color: "#888", marginBottom: "1rem" }}>التحقق من الهوية (KYC)</div>
        {kycStatus === "verified" ? (
          <div style={{ color: "#4CAF50" }}>✅ تم التحقق — فيكِ تسحبي أرباحك</div>
        ) : kycStatus === "pending" ? (
          <div style={{ color: GOLD }}>⏳ مستندك بمراجعة الإدارة</div>
        ) : (
          <form onSubmit={submitKyc} style={{ display: "flex", gap: "0.8rem", alignItems: "center", flexWrap: "wrap" }}>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setKycFile(e.target.files?.[0] || null)}
              style={{ color: "#aaa", fontSize: "0.85rem" }} />
            <button type="submit" disabled={!kycFile || kycUploading}
              style={{ background: GOLD, color: "#111", border: "none", borderRadius: 8, padding: "0.5rem 1.2rem", fontWeight: 700, cursor: "pointer" }}>
              {kycUploading ? "جاري الرفع..." : "إرسال للمراجعة"}
            </button>
            {kycStatus === "rejected" && <span style={{ color: "#F6465D", fontSize: "0.8rem" }}>تم رفض المستند السابق — ارفعي مستند جديد</span>}
          </form>
        )}
        {kycMsg && <div style={{ marginTop: 8, fontSize: "0.8rem", color: "#aaa" }}>{kycMsg}</div>}
      </Card>

      {/* طلب سحب */}
      <Card style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.85rem", color: "#888", marginBottom: "1rem" }}>
          طلب سحب (الرصيد المتاح: {fmt(wallets.withdrawal)} دينار — الحد الأدنى 50 دينار)
        </div>
        {kycStatus !== "verified" ? (
          <div style={{ color: "#666", fontSize: "0.85rem" }}>لازم تكملي التحقق من الهوية فوق قبل ما تقدري تسحبي</div>
        ) : (
          <form onSubmit={submitWithdraw} style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", alignItems: "center" }}>
            <input type="number" min="50" step="0.01" placeholder="المبلغ" value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              style={{ width: 120, padding: "0.5rem", borderRadius: 8, border: "1px solid #2A2E39", background: "#181A20", color: "#EAECEF" }} />
            <select value={withdrawMethod} onChange={(e) => setWithdrawMethod(e.target.value)}
              style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid #2A2E39", background: "#181A20", color: "#EAECEF" }}>
              <option value="bank_transfer">تحويل بنكي</option>
              <option value="e_wallet">محفظة إلكترونية</option>
              <option value="usdt">USDT</option>
            </select>
            <input placeholder="رقم الحساب/المحفظة" value={withdrawDest} onChange={(e) => setWithdrawDest(e.target.value)}
              style={{ flex: 1, minWidth: 180, padding: "0.5rem", borderRadius: 8, border: "1px solid #2A2E39", background: "#181A20", color: "#EAECEF" }} />
            <button type="submit" disabled={withdrawBusy}
              style={{ background: GOLD, color: "#111", border: "none", borderRadius: 8, padding: "0.5rem 1.2rem", fontWeight: 700, cursor: "pointer" }}>
              {withdrawBusy ? "جاري الإرسال..." : "إرسال الطلب"}
            </button>
          </form>
        )}
        {withdrawMsg && <div style={{ marginTop: 8, fontSize: "0.8rem", color: "#aaa" }}>{withdrawMsg}</div>}
      </Card>

      {/* آخر العمولات */}
      <Card>
        <div style={{ fontSize: "0.85rem", color: "#888", marginBottom: "1rem" }}>آخر العمولات</div>
        {recentCommissions.length === 0 ? (
          <div style={{ color: "#555", fontSize: "0.85rem" }}>لا يوجد عمولات بعد</div>
        ) : (
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {recentCommissions.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.6rem 0.8rem",
                  background: "#181A20",
                  borderRadius: 8,
                  fontSize: "0.85rem",
                }}
              >
                <span>{BONUS_LABELS[c.bonus_type] || c.bonus_type}</span>
                <span style={{ color: GOLD, fontWeight: 700 }}>{fmt(c.amount)} دينار</span>
                <span style={{ color: "#666" }}>{new Date(c.created_at).toLocaleDateString("ar")}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
