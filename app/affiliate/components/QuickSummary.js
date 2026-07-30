"use client";
import { GOLD, BORDER, card, fmt, monoStack, displayStack, transition, btnPrimary, InfoDot } from "./shared";

export const SECTIONS = [
  { id: "how", label: "كيف يعمل" },
  { id: "link", label: "رابط الإحالة" },
  { id: "stats", label: "الإحصائيات" },
  { id: "referrals", label: "الإحالات" },
  { id: "payouts", label: "المدفوعات" },
  { id: "more", label: "أنشطة إضافية" },
  { id: "faq", label: "الأسئلة الشائعة" },
];

function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function QuickSummary({ data, onShare }) {
  const available = (data.earnings?.ready || 0) + (data.earnings?.paid ? 0 : 0);
  const readyToWithdraw = data.earnings?.ready || 0;
  const pending = data.earnings?.pending || 0;
  const referralsCount = data.network?.direct || 0;
  const activeSubs = (data.referrals || []).filter((r) => r.subscriptionStatus === "active" || r.subscriptionStatus === "vip").length;

  const stats = [
    { label: "إجمالي الأرباح", value: `$${fmt(data.earnings?.totalEarned)}`, tip: "كل العمولات اللي حصلت عليها من بداية اشتراكك بالبرنامج، بكل الحالات." },
    { label: "قابلة للسحب", value: `$${fmt(readyToWithdraw)}`, highlight: true, tip: "عمولات وصلت مرحلة الجهوزية، ورح تنضم لأقرب دفعة." },
    { label: "معلّقة", value: `$${fmt(pending)}`, tip: "عمولات جديدة لسا ما وصلت موعد الدفعة القادمة." },
    { label: "عدد الإحالات", value: referralsCount, tip: "إجمالي الأعضاء يلي انضموا عن طريقك مباشرة." },
    { label: "مشتركين نشطين", value: activeSubs, tip: "من إحالاتك المباشرة، عدد اللي عندهم اشتراك فعّال حالياً." },
    { label: "نسبة عمولة التسجيل", value: `${data.settings?.signupPercent || 10}%`, tip: "نسبتك من قيمة أول اشتراك، تتحرر بعد ما يكمّل المدعو أول درس." },
  ];

  return (
    <div style={{ marginBottom: "1.4rem" }}>
      <div style={{ ...card, padding: "1.6rem 1.6rem 1.2rem" }} className="qta-animate-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.8rem", marginBottom: "1.3rem" }}>
          <div>
            <p style={{ fontFamily: monoStack, color: GOLD, fontSize: 11, letterSpacing: 3, marginBottom: 8 }}>QAIS TRADING ACADEMY</p>
            <h1 style={{ fontSize: "1.7rem", fontWeight: 800, fontFamily: displayStack, letterSpacing: "-0.02em", marginBottom: 4 }}>
              برنامج العمولة
            </h1>
            <p style={{ color: "#9A9A9A", fontSize: "0.85rem" }}>ملخص سريع لكل أرباحك وشبكتك بلمحة واحدة</p>
          </div>
          <button onClick={onShare} style={btnPrimary}>
            🔗 مشاركة رابط الإحالة
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.9rem" }}>
          {stats.map((st) => (
            <div
              key={st.label}
              style={{
                background: st.highlight ? "rgba(212,175,55,0.06)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${st.highlight ? GOLD + "44" : BORDER}`,
                borderRadius: 14,
                padding: "1rem 0.9rem",
                textAlign: "center",
                transition,
              }}
            >
              <p style={{ color: "#9A9A9A", fontSize: "0.72rem", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {st.label}
                <InfoDot text={st.tip} />
              </p>
              <p style={{ color: st.highlight ? GOLD : "#EAECEF", fontSize: "1.35rem", fontWeight: 800, fontFamily: monoStack }}>{st.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* شريط تنقّل الأقسام */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          padding: "0.9rem 0.2rem 0.2rem",
          marginTop: "0.2rem",
        }}
        className="qta-section-nav"
      >
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            onClick={() => scrollTo(sec.id)}
            style={{
              flexShrink: 0,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${BORDER}`,
              color: "#C8C0B0",
              padding: "0.45rem 0.95rem",
              borderRadius: 999,
              fontSize: "0.78rem",
              cursor: "pointer",
              transition,
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = GOLD)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = BORDER)}
          >
            {sec.label}
          </button>
        ))}
      </div>
    </div>
  );
}
