"use client";
import { useState } from "react";
import { GOLD, BORDER, card, sectionTitle, sectionEyebrow, transition } from "./shared";

function buildFaq(settings) {
  const l1 = settings?.level1Percent || 0;
  const l2 = settings?.level2Percent || 0;
  const l3 = settings?.level3Percent || 0;
  const minPayout = settings?.minPayoutUsd || 0;
  const cycle = settings?.payoutCycleDays || 14;

  return [
    {
      q: "كيف أحصل على العمولة؟",
      a: `تحصل على ${l1}% من قيمة اشتراك أي شخص ينضم مباشرة عن طريق رابطك (مستوى 1)، و${l2}% من اشتراكات شبكته (مستوى 2)، و${l3}% من المستوى الثالث. العمولة تُحتسب تلقائياً فور نجاح عملية الدفع.`,
    },
    {
      q: "متى يتم احتساب العمولة؟",
      a: "فور ما تتم عملية الدفع بنجاح، بتنسجل عمولتك مباشرة بحالة «معلّقة» وبتظهر بجدول الإحالات فوراً.",
    },
    {
      q: "لماذا ظهرت عمولتي كـ «معلّقة»؟",
      a: `كل عمولة جديدة تبدأ «معلّقة» لحد أقرب دورة دفع (كل ${cycle} يوم تقريباً)، وقتها منراجعها ومنحولها لـ «جاهزة للسحب» إذا استوفت الشروط.`,
    },
    {
      q: "متى أقدر أسحب أرباحي؟",
      a: `لما يوصل إجمالي عمولاتك المعلّقة للحد الأدنى ($${minPayout})، وتكون خزّنت طريقة استلام (PayPal / Wise / تحويل بنكي)، بتنحول تلقائياً لدفعة «بانتظار التحويل» وبعدين «تم الدفع».`,
    },
    {
      q: "ما هو الحد الأدنى للسحب؟",
      a: `الحد الأدنى الحالي هو $${minPayout}. أي عمولات أقل من هيك بتضل متراكمة معلّقة لحد ما توصل هالحد.`,
    },
    {
      q: "ماذا يحدث إذا ألغى العميل اشتراكه؟",
      a: "إذا انلغى أو استُرجع اشتراك قبل ما تتحول عمولته لـ «جاهزة للسحب»، بتتم مراجعتها يدوياً وممكن تتعدّل أو تُلغى حسب سياسة البرنامج.",
    },
    {
      q: "هل يوجد حد أقصى للأرباح؟",
      a: "لا يوجد حد أقصى — أرباحك مرتبطة مباشرة بحجم شبكتك ونشاطها، وكل ما تكبر شبكتك بتكبر أرباحك.",
    },
    {
      q: "كيف يتم دفع أرباحي؟",
      a: "التحويل حالياً يدوي عبر الطريقة المحفوظة عندك (PayPal / Wise / تحويل بنكي)، وبيوصلك إشعار فور تنفيذ الدفعة.",
    },
  ];
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", marginBottom: "0.6rem" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.02)",
          border: "none",
          color: "#EAECEF",
          padding: "0.9rem 1.1rem",
          textAlign: "right",
          fontSize: "0.86rem",
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          transition,
        }}
      >
        <span>{q}</span>
        <span style={{ color: GOLD, transform: open ? "rotate(180deg)" : "none", transition }}>⌄</span>
      </button>
      {open && (
        <div style={{ padding: "0 1.1rem 1rem", color: "#9A9A9A", fontSize: "0.8rem", lineHeight: 1.8 }} className="qta-animate-in">
          {a}
        </div>
      )}
    </div>
  );
}

export function FaqSection({ settings }) {
  const items = buildFaq(settings);
  return (
    <section id="faq" style={{ scrollMarginTop: 90, marginBottom: "1.4rem" }}>
      <div style={card} className="qta-animate-in">
        <p style={sectionEyebrow}>مساعدة سريعة</p>
        <h2 style={sectionTitle}>الأسئلة الشائعة</h2>
        <p style={{ color: "#9A9A9A", fontSize: "0.82rem", marginBottom: "1.2rem" }}>أهم الأسئلة يلي بتخطر ببالك.</p>
        <div>
          {items.map((it) => (
            <FaqItem key={it.q} {...it} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function TermsSection({ settings }) {
  const [open, setOpen] = useState(false);
  const l1 = settings?.level1Percent || 0;
  const l2 = settings?.level2Percent || 0;
  const l3 = settings?.level3Percent || 0;
  const minPayout = settings?.minPayoutUsd || 0;
  const cycle = settings?.payoutCycleDays || 14;

  const terms = [
    `نسبة العمولة: ${l1}% على الإحالة المباشرة (مستوى 1)، ${l2}% على مستوى 2، ${l3}% على مستوى 3.`,
    `الحد الأدنى للسحب: $${minPayout}.`,
    `دورة الدفع: كل ${cycle} يوم تقريباً.`,
    "العمولة تُحسب فقط على الاشتراكات الفعلية الناجحة، ولا تشمل الاسترجاعات أو المعاملات الملغاة.",
    "يحق للأكاديمية مراجعة أو تعليق أي عمولة مشبوهة (نشاط وهمي، حسابات مكررة، أو مخالفة لسياسة الاستخدام).",
    "يحق للأكاديمية تعديل نسب العمولة أو الحد الأدنى للسحب أو دورة الدفع بإشعار مسبق داخل المنصة.",
    "استمرار استخدامك لرابط الإحالة يُعتبر موافقة ضمنية على هذه الشروط وأي تحديثات لاحقة عليها.",
    "التسويق الممنوع: يُمنع استخدام إعلانات مدفوعة على اسم العلامة التجارية للأكاديمية، أو انتحال صفة موظف رسمي.",
  ];

  return (
    <section id="terms" style={{ scrollMarginTop: 90, marginBottom: "1.4rem" }}>
      <div style={card} className="qta-animate-in">
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "right", padding: 0 }}
        >
          <p style={sectionEyebrow}>القانونية</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={sectionTitle}>الشروط والأحكام</h2>
            <span style={{ color: GOLD, transform: open ? "rotate(180deg)" : "none", transition }}>⌄</span>
          </div>
        </button>
        {open && (
          <ul style={{ marginTop: "1rem", paddingRight: "1.1rem", color: "#9A9A9A", fontSize: "0.8rem", lineHeight: 2 }} className="qta-animate-in">
            {terms.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
