"use client";
import { GOLD, BORDER, card, sectionTitle, sectionEyebrow, monoStack, fmt, fmtDate, EmptyState, btnGhost } from "./shared";

const PAYOUT_STATUS_LABELS = {
  awaiting_transfer: { label: "بانتظار التحويل", color: "#eab308" },
  paid: { label: "تم الدفع", color: "#3DBB6E" },
  failed: { label: "فشل التحويل", color: "#E5484D" },
};

const METHOD_LABELS = { paypal: "PayPal", wise: "Wise", bank: "تحويل بنكي" };

function printReceipt(p) {
  const win = window.open("", "_blank", "width=420,height=600");
  if (!win) return;
  win.document.write(`
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>إيصال دفعة</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #111; }
          h1 { font-size: 18px; color: #B8860B; margin-bottom: 4px; }
          p.sub { color: #666; font-size: 12px; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          td { padding: 8px 4px; border-bottom: 1px solid #ddd; font-size: 13px; }
          td.label { color: #666; }
          .amount { font-size: 22px; font-weight: bold; color: #B8860B; margin: 16px 0; }
        </style>
      </head>
      <body>
        <h1>Qais Trading Academy</h1>
        <p class="sub">إيصال دفعة عمولة</p>
        <div class="amount">$${fmt(p.amount)}</div>
        <table>
          <tr><td class="label">رقم المرجع</td><td>${p.reference || p.id}</td></tr>
          <tr><td class="label">الحالة</td><td>${(PAYOUT_STATUS_LABELS[p.status] || {}).label || p.status}</td></tr>
          <tr><td class="label">طريقة الدفع</td><td>${METHOD_LABELS[p.method] || p.method || "-"}</td></tr>
          <tr><td class="label">الفترة</td><td>${fmtDate(p.period_start)} → ${fmtDate(p.period_end)}</td></tr>
          <tr><td class="label">تاريخ الدفع</td><td>${p.paid_at ? fmtDate(p.paid_at) : "لسا ما انصرفت"}</td></tr>
        </table>
        <script>window.print();</script>
      </body>
    </html>
  `);
  win.document.close();
}

export default function PayoutsHistory({ payouts = [] }) {
  return (
    <section id="payouts" style={{ scrollMarginTop: 90, marginBottom: "1.4rem" }}>
      <div style={card} className="qta-animate-in">
        <p style={sectionEyebrow}>سجل الاستلام</p>
        <h2 style={sectionTitle}>المدفوعات</h2>
        <p style={{ color: "#9A9A9A", fontSize: "0.82rem", marginBottom: "1.2rem" }}>كل دفعة تم تجهيزها أو صرفها لك.</p>

        {payouts.length === 0 ? (
          <EmptyState icon="🏦" title="ما في دفعات لسا" desc="أول ما تجمع عمولات كافية، رح تظهر هون." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["تاريخ الدفع", "المبلغ", "طريقة الدفع", "الحالة", "الفترة", ""].map((h) => (
                    <th key={h} style={{ textAlign: "right", color: "#6E7177", fontSize: "0.72rem", padding: "0.6rem", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => {
                  const st = PAYOUT_STATUS_LABELS[p.status] || { label: p.status, color: "#9A9A9A" };
                  return (
                    <tr key={p.id}>
                      <td style={tdStyle}>{p.paid_at ? fmtDate(p.paid_at) : "—"}</td>
                      <td style={{ ...tdStyle, fontFamily: monoStack, color: GOLD }}>${fmt(p.amount)}</td>
                      <td style={tdStyle}>{METHOD_LABELS[p.method] || p.method || "—"}</td>
                      <td style={tdStyle}>
                        <span style={{ display: "inline-block", border: `1px solid ${st.color}55`, color: st.color, borderRadius: 999, padding: "0.2rem 0.7rem", fontSize: "0.7rem", fontWeight: 600 }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontSize: "0.75rem", color: "#9A9A9A" }}>
                        {fmtDate(p.period_start)} → {fmtDate(p.period_end)}
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => printReceipt(p)} style={{ ...btnGhost, padding: "0.35rem 0.8rem", fontSize: "0.7rem" }}>
                          تنزيل الفاتورة
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

const tdStyle = { padding: "0.7rem 0.6rem", fontSize: "0.82rem", color: "#C8C0B0", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" };
