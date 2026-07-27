"use client";
import { GOLD, BORDER, card, sectionTitle, sectionEyebrow, displayStack } from "./shared";

export default function HowItWorks({ settings }) {
  const steps = [
    {
      icon: "🔗",
      title: "خذ رابط الإحالة تبعك",
      desc: "من قسم «رابط الإحالة» تحت، رابطك جاهز أوتوماتيكياً بمجرد ما تصير مسوّق مفعّل.",
    },
    {
      icon: "📤",
      title: "شاركه مع أصدقائك ومتابعينك",
      desc: "انسخه أو استخدم أزرار المشاركة السريعة أو كود QR — على واتساب، تيليجرام، أو أي منصة.",
    },
    {
      icon: "👤",
      title: "لما حدا يسجّل عن طريقه",
      desc: "بينحسب تلقائياً كإحالة تبعك (مستوى 1)، وبتظهر بجدول «الإحالات» فوراً.",
    },
    {
      icon: "💳",
      title: "لما يشترك ويدفع",
      desc: `بتنحسب عمولتك فوراً كـ «معلّقة» — ${settings?.level1Percent || 0}% من قيمة اشتراكه المباشر، ونسب أقل من شبكته (مستوى 2 و3).`,
    },
    {
      icon: "⏳",
      title: "فترة الانتظار",
      desc: `العمولة تضل «معلّقة» لحد أقرب دورة دفع (كل ${settings?.payoutCycleDays || 14} يوم تقريباً)، وقتها منتأكد إنه الاشتراك فعلي وما انلغى.`,
    },
    {
      icon: "✅",
      title: "تصبح قابلة للسحب",
      desc: `إذا وصل إجمالي عمولاتك المعلّقة الحد الأدنى ($${settings?.minPayoutUsd || 0}) وعندك طريقة استلام محفوظة، بتتحول لـ «جاهزة للسحب».`,
    },
    {
      icon: "🏦",
      title: "استلام الأرباح",
      desc: "بندفعلك عبر الطريقة يلي اخترتها (PayPal / Wise / تحويل بنكي)، وبتنسجل بسجل المدفوعات فوراً.",
    },
  ];

  return (
    <section id="how" style={{ scrollMarginTop: 90, marginBottom: "1.4rem" }}>
      <div style={{ ...card }} className="qta-animate-in">
        <p style={sectionEyebrow}>خطوة بخطوة</p>
        <h2 style={sectionTitle}>كيف يعمل برنامج العمولة؟</h2>
        <p style={{ color: "#9A9A9A", fontSize: "0.82rem", marginBottom: "1.3rem" }}>
          افهم البرنامج كامل بأقل من دقيقة 👇
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "0.9rem" }}>
          {steps.map((st, i) => (
            <div
              key={st.title}
              style={{
                position: "relative",
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${BORDER}`,
                borderRadius: 14,
                padding: "1.1rem 1rem 1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "rgba(212,175,55,0.1)",
                    border: `1px solid ${GOLD}55`,
                    color: GOLD,
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: displayStack,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: "1.15rem" }}>{st.icon}</span>
              </div>
              <p style={{ fontWeight: 700, fontSize: "0.86rem", color: "#EAECEF", marginBottom: 5 }}>{st.title}</p>
              <p style={{ color: "#9A9A9A", fontSize: "0.76rem", lineHeight: 1.7 }}>{st.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
