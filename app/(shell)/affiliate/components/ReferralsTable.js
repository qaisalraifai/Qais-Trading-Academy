"use client";
import { useMemo, useState } from "react";
import {
  GOLD,
  BORDER,
  card,
  sectionTitle,
  sectionEyebrow,
  monoStack,
  transition,
  fmt,
  fmtDate,
  timeAgo,
  SUB_STATUS_LABELS,
  COMMISSION_STATUS_LABELS,
  EmptyState,
} from "./shared";

const SORT_OPTIONS = [
  { key: "joinedAt_desc", label: "الأحدث تسجيلاً" },
  { key: "joinedAt_asc", label: "الأقدم تسجيلاً" },
  { key: "commissionAmount_desc", label: "أعلى عمولة" },
  { key: "lastActivity_desc", label: "آخر نشاط" },
];

export default function ReferralsTable({ referrals = [] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("joinedAt_desc");

  const filtered = useMemo(() => {
    let rows = [...referrals];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => (r.username || "").toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.subscriptionStatus === statusFilter);
    }
    const [field, dir] = sortKey.split("_");
    rows.sort((a, b) => {
      let av = a[field];
      let bv = b[field];
      if (field === "joinedAt" || field === "lastActivity") {
        av = new Date(av || 0).getTime();
        bv = new Date(bv || 0).getTime();
      }
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [referrals, search, statusFilter, sortKey]);

  const statusCounts = useMemo(() => {
    const counts = {};
    for (const r of referrals) counts[r.subscriptionStatus] = (counts[r.subscriptionStatus] || 0) + 1;
    return counts;
  }, [referrals]);

  return (
    <section id="referrals" style={{ scrollMarginTop: 90, marginBottom: "1.4rem" }}>
      <div style={card} className="qta-animate-in">
        <p style={sectionEyebrow}>شبكتك المباشرة</p>
        <h2 style={sectionTitle}>الإحالات ({referrals.length})</h2>
        <p style={{ color: "#A79FC4", fontSize: "0.82rem", marginBottom: "1.2rem" }}>كل شخص انضم عن طريق رابطك مباشرة.</p>

        {referrals.length === 0 ? (
 <EmptyState icon="" title="ما في إحالات لسا" desc="شارك رابطك من قسم «رابط الإحالة» فوق وابدأ اجمع إحالاتك." />
        ) : (
          <>
            <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", marginBottom: "1.1rem" }}>
              <input
                placeholder="ابحث باسم المستخدم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  flex: "1 1 200px",
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${BORDER}`,
                  color: "#F5F3FF",
                  padding: "0.6rem 1rem",
                  borderRadius: 3,
                  fontSize: "0.82rem",
                }}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, color: "#F5F3FF", padding: "0.6rem 1rem", borderRadius: 3, fontSize: "0.82rem" }}
              >
                <option value="all">كل الحالات ({referrals.length})</option>
                {Object.entries(statusCounts).map(([k, count]) => (
                  <option key={k} value={k}>
                    {(SUB_STATUS_LABELS[k] || SUB_STATUS_LABELS.none).label} ({count})
                  </option>
                ))}
              </select>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, color: "#F5F3FF", padding: "0.6rem 1rem", borderRadius: 3, fontSize: "0.82rem" }}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {filtered.length === 0 ? (
 <EmptyState icon="" title="ما في نتائج مطابقة" desc="جرّب تغيّر كلمة البحث أو الفلتر." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["اسم المستخدم", "تاريخ التسجيل", "حالة الاشتراك", "قيمة آخر دفعة", "تاريخ آخر دفعة", "قيمة العمولة", "حالة العمولة", "آخر نشاط"].map((h) => (
                        <th key={h} style={{ textAlign: "right", color: "#6E6690", fontSize: "0.72rem", padding: "0.6rem", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const sub = SUB_STATUS_LABELS[r.subscriptionStatus] || SUB_STATUS_LABELS.none;
                      const comm = COMMISSION_STATUS_LABELS[r.commissionStatus] || COMMISSION_STATUS_LABELS.none;
                      return (
                        <tr key={r.id} style={{ transition }}>
                          <td style={tdStyle}>{r.username}</td>
                          <td style={tdStyle}>{fmtDate(r.joinedAt)}</td>
                          <td style={tdStyle}>
                            <span style={{ ...pill, color: sub.color, borderColor: sub.color + "55" }}>{sub.label}</span>
                          </td>
                          <td style={{ ...tdStyle, fontFamily: monoStack, color: "#A79FC4" }}>
                            {r.lastPaymentAmount != null ? `$${fmt(r.lastPaymentAmount)}` : "—"}
                          </td>
                          <td style={{ ...tdStyle, color: "#A79FC4", fontSize: "0.75rem" }}>
                            {r.lastPaymentDate ? fmtDate(r.lastPaymentDate) : "—"}
                          </td>
                          <td style={{ ...tdStyle, fontFamily: monoStack, color: GOLD }}>${fmt(r.commissionAmount)}</td>
                          <td style={tdStyle}>
                            <span style={{ ...pill, color: comm.color, borderColor: comm.color + "55" }}>{comm.label}</span>
                          </td>
                          <td style={{ ...tdStyle, color: "#A79FC4", fontSize: "0.75rem" }}>{timeAgo(r.lastActivity)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

const tdStyle = { padding: "0.7rem 0.6rem", fontSize: "0.82rem", color: "#A79FC4", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" };
const pill = { display: "inline-block", border: "1px solid", borderRadius: 999, padding: "0.2rem 0.7rem", fontSize: "0.7rem", fontWeight: 600 };
