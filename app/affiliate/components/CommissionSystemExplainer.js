"use client";
import { useMemo, useState } from "react";
import {
  GOLD,
  BORDER,
  card,
  sectionTitle,
  sectionEyebrow,
  monoStack,
  displayStack,
  transition,
  fmt,
} from "./shared";

const SIGNUP_BASE = 300; // قيمة اشتراك أول شهر
const RENEWAL_BASE = 100; // قيمة التجديد الشهري

/** يحسب الدخل الشهري + التراكمي لسيناريو "r إحالات كل شهر لمدة n أشهر" */
function computeMonthlySeries({ referralsPerMonth, months, signupAmt, renewalAmt }) {
  const series = [];
  let cumulative = 0;
  for (let m = 1; m <= months; m++) {
    const newSignupIncome = referralsPerMonth * signupAmt;
    const renewingCount = referralsPerMonth * (m - 1);
    const renewalIncome = renewingCount * renewalAmt;
    const monthIncome = newSignupIncome + renewalIncome;
    cumulative += monthIncome;
    series.push({ month: m, income: monthIncome, cumulative, totalReferred: referralsPerMonth * m });
  }
  return series;
}

/** سيناريو "إحالة واحدة بس بالشهر الأول، وبتضل مجدّدة لباقي المدة" */
function computeSingleReferralSeries({ months, signupAmt, renewalAmt }) {
  const series = [];
  let cumulative = 0;
  for (let m = 1; m <= months; m++) {
    const income = m === 1 ? signupAmt : renewalAmt;
    cumulative += income;
    series.push({ month: m, income, cumulative, totalReferred: 1 });
  }
  return series;
}

function Bar({ value, max, label, highlight }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1, minWidth: 34 }}>
      <span style={{ fontFamily: monoStack, fontSize: 11, color: highlight ? GOLD : "#9A9A9A", fontWeight: 700 }}>
        ${fmt(value)}
      </span>
      <div style={{ width: "100%", height: 90, display: "flex", alignItems: "flex-end", background: "rgba(255,255,255,0.03)", borderRadius: 6, overflow: "hidden" }}>
        <div
          style={{
            width: "100%",
            height: `${pct}%`,
            background: highlight ? "linear-gradient(180deg, #E9CE7A, #C9A24B)" : "rgba(201,162,75,0.35)",
            transition: "height .4s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 10.5, color: "#787878" }}>{label}</span>
    </div>
  );
}

function StatPill({ big, small, sub, color = GOLD }) {
  return (
    <div style={{ ...card, padding: "1.3rem 1.1rem", textAlign: "center", flex: 1, minWidth: 150 }}>
      <p style={{ fontFamily: monoStack, fontSize: 26, fontWeight: 800, color, marginBottom: 4 }}>{big}</p>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#EAECEF", marginBottom: 2 }}>{small}</p>
      {sub && <p style={{ fontSize: 11.5, color: "#8A8A8A", lineHeight: 1.6 }}>{sub}</p>}
    </div>
  );
}

export default function CommissionSystemExplainer({ settings }) {
  const signupPercent = settings?.signupPercent || 10;
  const renewalPercent = settings?.renewalPercent || 8;
  const signupAmt = Math.round(((SIGNUP_BASE * signupPercent) / 100) * 100) / 100;
  const renewalAmt = Math.round(((RENEWAL_BASE * renewalPercent) / 100) * 100) / 100;

  // الآلة الحاسبة التفاعلية
  const [mode, setMode] = useState("monthly"); // "once" | "monthly"
  const [referralsPerMonth, setReferralsPerMonth] = useState(2);
  const [months, setMonths] = useState(6);

  const series = useMemo(() => {
    return mode === "once"
      ? computeSingleReferralSeries({ months, signupAmt, renewalAmt })
      : computeMonthlySeries({ referralsPerMonth, months, signupAmt, renewalAmt });
  }, [mode, referralsPerMonth, months, signupAmt, renewalAmt]);

  const lastMonth = series[series.length - 1];
  const maxIncome = Math.max(...series.map((s) => s.income), 1);

  // مقارنة المستويات الثلاثة (مطابقة تماماً لجدول العرض التقديمي)
  const comparisonRows = useMemo(() => {
    const scenarios = [
      { label: "عرضي — صديق واحد بس", referralsPerMonth: null, once: true },
      { label: "منتظم — شخصين شهرياً", referralsPerMonth: 2, once: false },
      { label: "نشيط جداً — 5 أشخاص شهرياً", referralsPerMonth: 5, once: false },
    ];
    return scenarios.map((sc) => {
      const s = sc.once
        ? computeSingleReferralSeries({ months: 6, signupAmt, renewalAmt })
        : computeMonthlySeries({ referralsPerMonth: sc.referralsPerMonth, months: 6, signupAmt, renewalAmt });
      const last = s[s.length - 1];
      return {
        label: sc.label,
        month6Income: last.income,
        total6mo: last.cumulative,
        totalReferred: last.totalReferred,
      };
    });
  }, [signupAmt, renewalAmt]);

  return (
    <div style={{ marginBottom: "1.6rem" }}>
      {/* تنويه افتتاحي */}
      <div style={{ ...card, marginBottom: "1rem", border: `1px solid ${GOLD}55`, background: "rgba(212,175,55,0.05)" }} className="qta-animate-in">
        <p style={{ fontSize: 13, color: "#D8CBA0", lineHeight: 1.9, margin: 0 }}>
          📋 دليلك لفهم نظام المكافآت — كيف تكسب من كل شخص تدعوه للأكاديمية، بالأرقام والأمثلة.
          كل الأرقام تحت أمثلة توضيحية للحساب، مش وعد أو ضمان بدخل معيّن.
        </p>
      </div>

      {/* الأساس: مصدرين للدخل */}
      <div style={{ ...card, marginBottom: "1rem" }} className="qta-animate-in">
        <p style={sectionEyebrow}>الأساس</p>
        <h2 style={sectionTitle}>الفكرة ببساطة: مصدرين للدخل</h2>
        <p style={{ color: "#9A9A9A", fontSize: 13, margin: "0.4rem 0 1.2rem" }}>
          كل ما دعوت ناس أكثر، وكل ما استمروا معك أطول، دخلك يكبر — <b style={{ color: GOLD }}>بدون أي طبقات أو فرق تحتك</b>.
          راعي مباشر واحد بس، بدون مستوى 2 أو 3.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "1.1rem 1.2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ ...numBadge }}>1</span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>عمولة تسجيل</span>
            </div>
            <p style={{ color: "#9A9A9A", fontSize: 12.5, lineHeight: 1.8, margin: 0 }}>
              لمرة وحدة، لما تدعو صديق وهو يبلّش فعلياً بالتعلم.
            </p>
          </div>
          <div style={{ flex: 1, minWidth: 220, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "1.1rem 1.2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ ...numBadge }}>2</span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>عمولة تجديد</span>
            </div>
            <p style={{ color: "#9A9A9A", fontSize: 12.5, lineHeight: 1.8, margin: 0 }}>
              شهرياً، طول ما الشخص يلي دعوته يكمّل معانا ويجدد اشتراكه.
            </p>
          </div>
        </div>
      </div>

      {/* الأرقام */}
      <div style={{ ...card, marginBottom: "1rem" }} className="qta-animate-in">
        <p style={sectionEyebrow}>الأرقام</p>
        <h2 style={sectionTitle}>شو بالضبط بتاخد؟</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: "1rem" }}>
          <StatPill big={`$${SIGNUP_BASE}`} small="قيمة اشتراك أول شهر" sub="يدفعها العضو الجديد عند التسجيل" color="#9A9A9A" />
          <StatPill big={`$${fmt(signupAmt)}`} small={`عمولتك من التسجيل (${signupPercent}%)`} sub="تُدفع لك مرة وحدة بعد إكمال أول درس" />
          <StatPill big={`$${RENEWAL_BASE}`} small="قيمة التجديد الشهري" sub="يدفعها العضو كل شهر يستمر فيه" color="#9A9A9A" />
          <StatPill big={`$${fmt(renewalAmt)}`} small={`عمولتك من التجديد (${renewalPercent}%)`} sub="تُدفع لك كل شهر يجدد فيه — طول ما يستمر" />
        </div>
      </div>

      {/* تنويه مهم: الشرط */}
      <div style={{ ...card, marginBottom: "1rem", border: "1px solid rgba(79,168,224,0.4)", background: "rgba(79,168,224,0.05)" }} className="qta-animate-in">
        <p style={{ ...sectionEyebrow, color: "#4FA8E0" }}>مهم</p>
        <h2 style={sectionTitle}>عمولة التسجيل مش أوتوماتيكية</h2>
        <ul style={{ margin: "0.8rem 0 0", paddingRight: 18, color: "#B8C4CC", fontSize: 12.8, lineHeight: 2 }}>
          <li>لازم الشخص يلي دعوته يكمّل <b style={{ color: "#EAECEF" }}>أول درس فعلياً</b> قبل ما تستحق عمولة التسجيل.</li>
          <li>هذا مو عائق — هذا حماية إلك وللبرنامج كله من التسجيل الشكلي اللي ما بيفيد حدا.</li>
          <li>يعني دخلك مرتبط بقيمة حقيقية بتوصل للشخص، مش بس بتوقيعه.</li>
          <li>أفضل استراتيجية لدخل مستمر: اختر ناس فعلاً مهتمين، وتابعهم أول أسبوع.</li>
        </ul>
      </div>

      {/* مثال عملي 1: صديق واحد */}
      <div style={{ ...card, marginBottom: "1rem" }} className="qta-animate-in">
        <p style={sectionEyebrow}>مثال عملي ١</p>
        <h2 style={sectionTitle}>لو دعيت صديق واحد بس</h2>
        <p style={{ color: "#9A9A9A", fontSize: 12.5, margin: "0.3rem 0 1.1rem" }}>
          افترض إنه استمر معانا كامل الـ٦ أشهر وجدّد كل شهر.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
          {computeSingleReferralSeries({ months: 6, signupAmt, renewalAmt }).map((s) => (
            <Bar
              key={s.month}
              value={s.income}
              max={Math.max(signupAmt, renewalAmt)}
              label={s.month === 1 ? "شهر ١ (تسجيل)" : `شهر ${s.month}`}
              highlight={s.month === 1}
            />
          ))}
        </div>
        <div style={{ textAlign: "center", paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
          <span style={{ fontFamily: monoStack, fontSize: 24, fontWeight: 800, color: GOLD }}>
            ${fmt(signupAmt + renewalAmt * 5)}
          </span>
          <p style={{ fontSize: 12, color: "#9A9A9A", margin: "2px 0 0" }}>إجمالي خلال ٦ أشهر من صديق واحد بس</p>
        </div>
      </div>

      {/* الآلة الحاسبة التفاعلية */}
      <div style={{ ...card, marginBottom: "1rem" }} className="qta-animate-in">
        <p style={sectionEyebrow}>جرّبها بنفسك</p>
        <h2 style={sectionTitle}>احسب دخلك المتوقع</h2>
        <p style={{ color: "#9A9A9A", fontSize: 12.5, margin: "0.3rem 0 1.2rem" }}>
          حرّك الأشرطة تحت وشوف كيف دخلك بيتغيّر حسب عدد الإحالات ومدة الاستمرار.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: "1.2rem" }}>
          <button
            onClick={() => setMode("once")}
            style={{ ...modeBtn, ...(mode === "once" ? modeBtnActive : {}) }}
          >
            إحالة واحدة بس
          </button>
          <button
            onClick={() => setMode("monthly")}
            style={{ ...modeBtn, ...(mode === "monthly" ? modeBtnActive : {}) }}
          >
            إحالات كل شهر
          </button>
        </div>

        {mode === "monthly" && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={sliderLabel}>
              عدد الإحالات الجديدة كل شهر: <b style={{ color: GOLD }}>{referralsPerMonth}</b>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={referralsPerMonth}
              onChange={(e) => setReferralsPerMonth(Number(e.target.value))}
              style={rangeInput}
            />
          </div>
        )}

        <div style={{ marginBottom: "1.2rem" }}>
          <label style={sliderLabel}>
            مدة الاستمرار (بالأشهر): <b style={{ color: GOLD }}>{months}</b>
          </label>
          <input
            type="range"
            min={1}
            max={12}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            style={rangeInput}
          />
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: "1.1rem", overflowX: "auto", paddingBottom: 4 }}>
          {series.map((s) => (
            <Bar key={s.month} value={s.income} max={maxIncome} label={`ش${s.month}`} highlight={s.month === months} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatPill big={`$${fmt(lastMonth?.income || 0)}`} small={`دخل الشهر ${months}`} />
          <StatPill big={`$${fmt(lastMonth?.cumulative || 0)}`} small={`إجمالي ${months} أشهر`} />
          <StatPill big={lastMonth?.totalReferred || 0} small="إجمالي المدعوين" />
        </div>
      </div>

      {/* المقارنة الكاملة */}
      <div style={{ ...card, marginBottom: "1rem" }} className="qta-animate-in">
        <p style={sectionEyebrow}>المقارنة الكاملة</p>
        <h2 style={sectionTitle}>ثلاث مستويات نشاط — نفس القاعدة</h2>
        <div style={{ overflowX: "auto", marginTop: "1rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 480 }}>
            <thead>
              <tr>
                {["مستوى النشاط", "دخل الشهر ٦", "إجمالي ٦ أشهر", "إجمالي المدعوين"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((r) => (
                <tr key={r.label}>
                  <td style={tdStyle}>{r.label}</td>
                  <td style={{ ...tdStyle, color: GOLD, fontFamily: monoStack, fontWeight: 700 }}>${fmt(r.month6Income)}</td>
                  <td style={{ ...tdStyle, color: GOLD, fontFamily: monoStack, fontWeight: 700 }}>${fmt(r.total6mo)}</td>
                  <td style={tdStyle}>{r.totalReferred}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ color: "#9A9A9A", fontSize: 12.5, marginTop: "1rem", lineHeight: 1.8 }}>
          النشاط المنتظم أهم من الاندفاع لمرة وحدة — عمولة التجديد الشهرية هي يلي بتبني دخل ثابت مع الوقت.
        </p>
      </div>

      {/* كن واقعياً */}
      <div style={{ ...card, marginBottom: "1rem" }} className="qta-animate-in">
        <p style={sectionEyebrow}>كن واقعياً</p>
        <h2 style={sectionTitle}>شو يأثر فعلياً على دخلك؟</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "1rem" }}>
          {[
            { t: "استمرارية الشخص يلي دعيته", d: "لو توقف عن التجديد، تتوقف عمولة الشهري معه — الدعم والمتابعة بترفع فرص استمراره." },
            { t: "جدية المُحال من البداية", d: "الشخص يلي فعلاً مهتم ومكمّل الدروس بيستمر أطول من شخص سجّل بس لتجربة." },
            { t: "طاقة البرنامج الاستيعابية", d: "عدد الأعضاء الجدد يلي ممكن ينضموا كل شهر محدود بقدرة المدرب على المتابعة الجيدة — مو أعداد مفتوحة." },
          ].map((it, i) => (
            <div key={it.t} style={{ display: "flex", gap: 10, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.9rem 1rem" }}>
              <span style={{ ...numBadge, flexShrink: 0 }}>{i + 1}</span>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, margin: "0 0 4px" }}>{it.t}</p>
                <p style={{ color: "#9A9A9A", fontSize: 12, margin: 0, lineHeight: 1.7 }}>{it.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* بصراحة تامة */}
      <div style={{ ...card, marginBottom: "1rem", border: "1px solid rgba(246,70,93,0.3)", background: "rgba(246,70,93,0.04)" }} className="qta-animate-in">
        <p style={{ ...sectionEyebrow, color: "#F6465D" }}>بصراحة تامة</p>
        <h2 style={sectionTitle}>هاي أمثلة حساب، مش وعد بدخل</h2>
        <ul style={{ margin: "0.8rem 0 0", paddingRight: 18, color: "#C9AEB0", fontSize: 12.5, lineHeight: 1.95 }}>
          <li>كل الأرقام فوق حساب رياضي بسيط على افتراض معيّن (عدد إحالات + مدة استمرار) — مش أرقام مضمونة ولا نتيجة متوقعة لكل شخص.</li>
          <li>دخلك الفعلي بيعتمد على جهدك، وعلى مدى اهتمام الناس يلي بتدعوهم، وعلى ظروف كل شخص المختلفة.</li>
          <li>مو كل الناس رح تحصل على نفس النتيجة — وهذا طبيعي بأي نشاط تسويقي أو تعليمي.</li>
          <li>الهدف من هالصفحة إنك تفهم كيف يشتغل النظام بالضبط، مو إنك تبني توقعات ثابتة على أمثلة توضيحية.</li>
        </ul>
      </div>

      {/* خلاصة */}
      <div style={{ ...card }} className="qta-animate-in">
        <p style={sectionEyebrow}>خلاصة</p>
        <h2 style={sectionTitle}>دخل يبنى بالوقت، بجهد حقيقي، وبمتابعة</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: "1rem" }}>
          {[
            { t: "ابدأ بسيط", d: "ادعُ شخص واحد بجدية، وتابعه أول أسبوع." },
            { t: "كن منتظم", d: "دعوة شخصين-ثلاثة بالشهر أهم من دفعة كبيرة لمرة وحدة." },
            { t: "دخلك يتراكم", d: "كل عضو مستمر معانا = دخل شهري إضافي طول ما يجدد." },
          ].map((it, i) => (
            <div key={it.t} style={{ flex: 1, minWidth: 180, textAlign: "center", padding: "1rem" }}>
              <div style={{ ...numBadge, margin: "0 auto 10px" }}>{i + 1}</div>
              <p style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 6 }}>{it.t}</p>
              <p style={{ color: "#9A9A9A", fontSize: 12, lineHeight: 1.7 }}>{it.d}</p>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", color: "#787878", fontSize: 12, marginTop: "1rem", paddingTop: "1rem", borderTop: `1px solid ${BORDER}` }}>
          أي سؤال عن نظام العمولات؟ تواصل مع مدربك مباشرة.
        </p>
      </div>
    </div>
  );
}

const numBadge = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  borderRadius: "50%",
  background: "rgba(212,175,55,0.15)",
  color: GOLD,
  fontWeight: 800,
  fontSize: 12.5,
  fontFamily: monoStack,
};

const modeBtn = {
  flex: 1,
  padding: "0.6rem 0.8rem",
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: "transparent",
  color: "#9A9A9A",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
  transition,
};

const modeBtnActive = {
  borderColor: GOLD,
  color: GOLD,
  background: "rgba(212,175,55,0.1)",
};

const sliderLabel = { display: "block", fontSize: 12.5, color: "#C8C0B0", marginBottom: 8 };

const rangeInput = { width: "100%", accentColor: GOLD };

const thStyle = {
  textAlign: "right",
  padding: "0.6rem 0.7rem",
  color: "#8A8A8A",
  fontSize: 11.5,
  fontWeight: 700,
  borderBottom: `1px solid ${BORDER}`,
  whiteSpace: "nowrap",
};

const tdStyle = {
  textAlign: "right",
  padding: "0.65rem 0.7rem",
  borderBottom: `1px solid ${BORDER}`,
  color: "#EAECEF",
  whiteSpace: "nowrap",
};
