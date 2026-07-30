"use client";
import { useState } from "react";
import { GOLD, BORDER, card, sectionTitle, sectionEyebrow, transition } from "./shared";

function buildFaq(settings) {
  const signup = settings?.signupPercent || 10;
  const renewal = settings?.renewalPercent || 8;
  const minPayout = settings?.minPayoutUsd || 0;
  const cycle = settings?.payoutCycleDays || 14;

  return [
    {
      q: "كيف أحصل على العمولة؟",
      a: `في مصدرين للدخل بس: عمولة تسجيل ${signup}% من قيمة أول اشتراك لأي شخص ينضم برابطك، وعمولة تجديد شهري ${renewal}% من قيمة كل تجديد بعد هيك، طول ما ضل مشترك. بدون أي طبقات أو مستويات تحتك — راعي مباشر واحد بس.`,
    },
    {
      q: "ليش عمولة التسجيل ما بتظهر فوراً؟",
      a: "عشان نحمي البرنامج من التسجيل الشكلي، عمولة التسجيل بتضل «بانتظار إكمال الدرس» لحد ما المدعو يكمّل أول درس فعلياً بالمنصة. أول ما يكمّله، عمولتك بتتحرر تلقائياً وبتنضم لدورة الصرف.",
    },
    {
      q: "متى تُحتسب عمولة التجديد؟",
      a: "عمولة التجديد ما إلها أي شرط — فور ما ينجح الدفع الشهري للمدعو، عمولتك بتنسجل مباشرة بحالة «معلّقة» وبتدخل بأقرب دورة صرف.",
    },
    {
      q: "متى أقدر أسحب أرباحي؟",
      a: `لما يوصل إجمالي عمولاتك المعلّقة للحد الأدنى ($${minPayout})، وتكون خزّنت طريقة استلام (PayPal / Wise / تحويل بنكي)، بتنحول تلقائياً لدفعة «بانتظار التحويل» وبعدين «تم الدفع» — الدورة كل ${cycle} يوم تقريباً.`,
    },
    {
      q: "ما هو الحد الأدنى للسحب؟",
      a: `الحد الأدنى الحالي هو $${minPayout}. أي عمولات أقل من هيك بتضل متراكمة معلّقة لحد ما توصل هالحد.`,
    },
    {
      q: "ماذا يحدث إذا ألغى المدعو اشتراكه قبل ما يكمّل درس؟",
      a: "عمولة التسجيل بتضل بانتظار إكمال الدرس. لو ألغى قبل ما يكمّل، ما بتنحرر العمولة — هيك منضمن إنه الإحالة كانت حقيقية.",
    },
    {
      q: "هل يوجد حد أقصى للأرباح؟",
      a: "لا يوجد حد أقصى — كل ما دعيت ناس أكثر واستمروا مشتركين، أرباحك بتزيد بدون سقف.",
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
  const signup = settings?.signupPercent || 10;
  const renewal = settings?.renewalPercent || 8;
  const minPayout = settings?.minPayoutUsd || 0;
  const cycle = settings?.payoutCycleDays || 14;

  const terms = [
    `عمولة التسجيل: ${signup}% من قيمة أول اشتراك، تُدفع مرة وحدة بعد إكمال المدعو أول درس بالمنصة.`,
    `عمولة التجديد: ${renewal}% من قيمة كل تجديد شهري، طول ما استمر المدعو مشتركاً.`,
    "راعي مباشر واحد بس لكل عضو — بدون طبقات أو عمولات على شبكة الشبكة.",
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
