"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  GOLD,
  BORDER,
  card,
  sectionTitle,
  sectionEyebrow,
  monoStack,
  fmt,
} from "./shared";

/** يحدد مستوى المسوّق حسب عدد عملائه المتراكم لهيك اللحظة */
function tierFor(count, tiers) {
  if (!tiers || tiers.length === 0) return { title_ar: "Bronze", badge_icon: "🥉", color_hex: "#B08D57", signup_amount: 30, renewal_amount: 8 };
  let current = tiers[0];
  for (const t of tiers) {
    if (count >= t.min_active_clients) current = t;
    else break;
  }
  return current;
}

/** دخل شهري + تراكمي لسيناريو "r إحالات كل شهر" — كل شهر بياخد عمولة
 * التسجيل عن الجدد + عمولة التجديد عن كل القدامى، بمستواه بهيك اللحظة
 * بالضبط (مو بمستوى وقت ما سجّل كل عميل) — تماماً متل النظام الحقيقي. */
function computeMonthlySeries({ referralsPerMonth, months, tiers }) {
  const series = [];
  let cumulative = 0;
  for (let m = 1; m <= months; m++) {
    const totalReferred = referralsPerMonth * m;
    const tier = tierFor(totalReferred, tiers);
    const renewingCount = referralsPerMonth * (m - 1);
    const monthIncome = referralsPerMonth * Number(tier.signup_amount) + renewingCount * Number(tier.renewal_amount);
    cumulative += monthIncome;
    series.push({ month: m, income: monthIncome, cumulative, totalReferred, tier });
  }
  return series;
}

/** سيناريو "إحالة واحدة بس" — بيضل بمستوى Bronze لأنه ما في عملاء إضافيين */
function computeSingleReferralSeries({ months, tiers }) {
  const series = [];
  let cumulative = 0;
  const tier = tierFor(1, tiers);
  for (let m = 1; m <= months; m++) {
    const income = m === 1 ? Number(tier.signup_amount) : Number(tier.renewal_amount);
    cumulative += income;
    series.push({ month: m, income, cumulative, totalReferred: 1, tier });
  }
  return series;
}

function Bar({ value, max, label, highlight, color = GOLD }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1, minWidth: 34 }}>
      <span style={{ fontFamily: monoStack, fontSize: 11, color: highlight ? color : "#9A9A9A", fontWeight: 700 }}>
        ${fmt(value)}
      </span>
      <div style={{ width: "100%", height: 90, display: "flex", alignItems: "flex-end", background: "rgba(255,255,255,0.03)", borderRadius: 6, overflow: "hidden" }}>
        <div
          style={{
            width: "100%",
            height: `${pct}%`,
            background: highlight ? `linear-gradient(180deg, ${color}, ${color}aa)` : `${color}55`,
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

export default function CommissionSystemExplainer({ tiers }) {
  const bronze = tiers?.[0] || { signup_amount: 30, renewal_amount: 8 };
  const elite = tiers?.[tiers.length - 1] || { signup_amount: 100, renewal_amount: 25 };

  const [mode, setMode] = useState("monthly"); // "once" | "monthly"
  const [referralsPerMonth, setReferralsPerMonth] = useState(2);
  const [months, setMonths] = useState(6);

  const series = useMemo(() => {
    return mode === "once"
      ? computeSingleReferralSeries({ months, tiers })
      : computeMonthlySeries({ referralsPerMonth, months, tiers });
  }, [mode, referralsPerMonth, months, tiers]);

  const lastMonth = series[series.length - 1];
  const maxIncome = Math.max(...series.map((s) => s.income), 1);

  return (
    <div style={{ marginBottom: "1.6rem" }}>
      {/* تنويه افتتاحي */}
      <div style={{ ...card, marginBottom: "1rem", border: `1px solid ${GOLD}55`, background: "rgba(212,175,55,0.05)" }} className="qta-animate-in">
        <p style={{ fontSize: 13, color: "#D8CBA0", lineHeight: 1.9, margin: 0 }}>
          📋 دليلك لفهم نظام العمولة — كيف تكسب من كل شخص تدعوه، وكيف عمولتك بترتفع أوتوماتيكياً كل ما ترقّيت مستوى.
        </p>
      </div>

      {/* الأساس */}
      <div style={{ ...card, marginBottom: "1rem" }} className="qta-animate-in">
        <p style={sectionEyebrow}>الأساس</p>
        <h2 style={sectionTitle}>مصدرين للدخل، وعمولة تكبر معك</h2>
        <p style={{ color: "#9A9A9A", fontSize: 13, margin: "0.4rem 0 1.2rem" }}>
          بدون أي طبقات أو فرق تحتك — راعي مباشر واحد بس. بس عمولتك نفسها مش ثابتة: كل ما زاد عدد
          عملائك النشطين، بترقّى مستوى، وعمولتك على كل عملياتك الجاية بترتفع فوراً — من{" "}
          <b style={{ color: GOLD }}>${fmt(bronze.signup_amount)}</b> عند البداية، لحد{" "}
          <b style={{ color: GOLD }}>${fmt(elite.signup_amount)}</b> بأعلى مستوى.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "1.1rem 1.2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={numBadge}>1</span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>عمولة تسجيل</span>
            </div>
            <p style={{ color: "#9A9A9A", fontSize: 12.5, lineHeight: 1.8, margin: 0 }}>
              لمرة وحدة، لما تدعو صديق وهو يبلّش فعلياً بالتعلم — بعمولة مستواك الحالي.
            </p>
          </div>
          <div style={{ flex: 1, minWidth: 220, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "1.1rem 1.2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={numBadge}>2</span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>عمولة تجديد</span>
            </div>
            <p style={{ color: "#9A9A9A", fontSize: 12.5, lineHeight: 1.8, margin: 0 }}>
              شهرياً، طول ما استمر عملاؤك — بعمولة مستواك الحالي وقت كل تجديد (حتى من عملاء قدامى).
            </p>
          </div>
        </div>
      </div>

      {/* جدول المستويات المصغّر */}
      {tiers && tiers.length > 0 && (
        <div style={{ ...card, marginBottom: "1rem" }} className="qta-animate-in">
          <p style={sectionEyebrow}>المستويات</p>
          <h2 style={sectionTitle}>عمولتك بكل مستوى</h2>
          <div style={{ display: "flex", gap: 8, marginTop: "1rem", flexWrap: "wrap" }}>
            {tiers.map((t) => (
              <div key={t.id} style={{ flex: "1 1 110px", textAlign: "center", border: `1px solid ${t.color_hex}44`, borderRadius: 12, padding: "0.8rem 0.5rem", background: `${t.color_hex}0c` }}>
                <div style={{ fontSize: 20 }}>{t.badge_icon}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: t.color_hex, margin: "4px 0" }}>{t.title_ar}</div>
                <div style={{ fontSize: 11, color: "#B8B0A0" }}>${fmt(t.signup_amount)} / ${fmt(t.renewal_amount)}</div>
                <div style={{ fontSize: 10, color: "#6E7177", marginTop: 3 }}>{t.min_active_clients}+ عميل</div>
              </div>
            ))}
          </div>
          <Link href="/affiliate/tiers" style={{ display: "inline-block", marginTop: "1rem", color: GOLD, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
            تفاصيل كل مستوى وشروط الترقية ←
          </Link>
        </div>
      )}

      {/* تنويه مهم: الشرط */}
      <div style={{ ...card, marginBottom: "1rem", border: "1px solid rgba(79,168,224,0.4)", background: "rgba(79,168,224,0.05)" }} className="qta-animate-in">
        <p style={{ ...sectionEyebrow, color: "#4FA8E0" }}>مهم</p>
        <h2 style={sectionTitle}>عمولة التسجيل مش أوتوماتيكية</h2>
        <ul style={{ margin: "0.8rem 0 0", paddingRight: 18, color: "#B8C4CC", fontSize: 12.8, lineHeight: 2 }}>
          <li>لازم الشخص يلي دعوته يكمّل <b style={{ color: "#EAECEF" }}>أول درس فعلياً</b> قبل ما تستحق عمولة التسجيل.</li>
          <li>هذا حماية إلك وللبرنامج كله من التسجيل الشكلي اللي ما بيفيد حدا.</li>
          <li>عمولة التسجيل بتتحدد وتُقفل بمستواك وقت التسجيل نفسه — ما بتتغيّر لو مستواك تغيّر بعدين.</li>
        </ul>
      </div>

      {/* الآلة الحاسبة التفاعلية */}
      <div style={{ ...card, marginBottom: "1rem" }} className="qta-animate-in">
        <p style={sectionEyebrow}>جرّبها بنفسك</p>
        <h2 style={sectionTitle}>احسب دخلك المتوقع (مع ترقية المستوى تلقائياً)</h2>
        <p style={{ color: "#9A9A9A", fontSize: 12.5, margin: "0.3rem 0 1.2rem" }}>
          حرّك الأشرطة تحت — لاحظ كيف عمولتك بترتفع لحالها كل ما تراكمت عملاءك وترقّيت مستوى.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: "1.2rem" }}>
          <button onClick={() => setMode("once")} style={{ ...modeBtn, ...(mode === "once" ? modeBtnActive : {}) }}>
            إحالة واحدة بس
          </button>
          <button onClick={() => setMode("monthly")} style={{ ...modeBtn, ...(mode === "monthly" ? modeBtnActive : {}) }}>
            إحالات كل شهر
          </button>
        </div>

        {mode === "monthly" && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={sliderLabel}>
              عدد الإحالات الجديدة كل شهر: <b style={{ color: GOLD }}>{referralsPerMonth}</b>
            </label>
            <input type="range" min={1} max={15} value={referralsPerMonth} onChange={(e) => setReferralsPerMonth(Number(e.target.value))} style={rangeInput} />
          </div>
        )}

        <div style={{ marginBottom: "1.2rem" }}>
          <label style={sliderLabel}>
            مدة الاستمرار (بالأشهر): <b style={{ color: GOLD }}>{months}</b>
          </label>
          <input type="range" min={1} max={18} value={months} onChange={(e) => setMonths(Number(e.target.value))} style={rangeInput} />
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: "1.1rem", overflowX: "auto", paddingBottom: 4 }}>
          {series.map((s) => (
            <Bar key={s.month} value={s.income} max={maxIncome} label={`ش${s.month}`} highlight={s.month === months} color={s.tier?.color_hex} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatPill big={`$${fmt(lastMonth?.income || 0)}`} small={`دخل الشهر ${months}`} />
          <StatPill big={`$${fmt(lastMonth?.cumulative || 0)}`} small={`إجمالي ${months} أشهر`} />
          <StatPill
            big={`${lastMonth?.tier?.badge_icon || ""} ${lastMonth?.tier?.title_ar || ""}`}
            small="مستواك بنهاية المدة"
            color={lastMonth?.tier?.color_hex}
          />
        </div>
      </div>

      {/* بصراحة تامة */}
      <div style={{ ...card, marginBottom: "1rem", border: "1px solid rgba(246,70,93,0.3)", background: "rgba(246,70,93,0.04)" }} className="qta-animate-in">
        <p style={{ ...sectionEyebrow, color: "#F6465D" }}>بصراحة تامة</p>
        <h2 style={sectionTitle}>هاي أمثلة حساب، مش وعد بدخل</h2>
        <ul style={{ margin: "0.8rem 0 0", paddingRight: 18, color: "#C9AEB0", fontSize: 12.5, lineHeight: 1.95 }}>
          <li>كل الأرقام فوق حساب رياضي بسيط على افتراض معيّن — مش أرقام مضمونة لكل شخص.</li>
          <li>دخلك الفعلي بيعتمد على جهدك، وعلى مدى اهتمام الناس يلي بتدعوهم، وعلى استمرارهم الفعلي كعملاء نشطين.</li>
          <li>الهدف من هالصفحة إنك تفهم كيف يشتغل النظام بالضبط، مو إنك تبني توقعات ثابتة على أمثلة توضيحية.</li>
        </ul>
      </div>

      <div style={{ textAlign: "center" }}>
        <Link href="/affiliate/tiers" style={{ color: GOLD, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          شوف صفحة المستويات الكاملة ←
        </Link>
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
};

const modeBtnActive = {
  borderColor: GOLD,
  color: GOLD,
  background: "rgba(212,175,55,0.1)",
};

const sliderLabel = { display: "block", fontSize: 12.5, color: "#C8C0B0", marginBottom: 8 };
const rangeInput = { width: "100%", accentColor: GOLD };
