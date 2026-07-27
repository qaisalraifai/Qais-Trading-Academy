"use client";
import { useState } from "react";
import {
  GOLD,
  BORDER,
  card,
  sectionTitle,
  sectionEyebrow,
  displayStack,
  monoStack,
  transition,
} from "./shared";

const LEVEL_ROWS = (settings) => [
  {
    n: "1",
    title: "المستوى الأول — الإحالة المباشرة",
    percent: settings?.level1Percent || 0,
    desc: "أي شخص يسجّل ويشترك عن طريق رابطك مباشرة (يعني هو دعوتك إنت بنفسك).",
    example: "مثال: صديقك اشترك بـ 100$ عن طريق رابطك ← تاخذ نسبة المستوى الأول من الـ 100$ فوراً.",
  },
  {
    n: "2",
    title: "المستوى الثاني — شبكة اللي دعوتهم",
    percent: settings?.level2Percent || 0,
    desc: "أي شخص ينضم عن طريق رابط أحد الأشخاص يلي دعوتهم إنت (يعني هو مو تحتك مباشرة، تحت واحد تبعك).",
    example: "مثال: صديقك جاب صديق له واشترك ← تاخذ نسبة المستوى الثاني من اشتراك هالشخص، حتى لو ما تعرفه شخصياً.",
  },
  {
    n: "3",
    title: "المستوى الثالث — الجيل الثالث",
    percent: settings?.level3Percent || 0,
    desc: "أي شخص ينضم عن طريق رابط شخص من المستوى الثاني (يعني ثالث حلقة بالسلسلة).",
    example: "مثال: صديق صديق صديقك اشترك ← بتاخذ نسبة أقل، بس برضه بتاخذ عمولة عليه.",
  },
];

const BONUS_ITEMS = [
  {
    icon: "⚡",
    title: "Fast Start — انطلاقة سريعة",
    when: "مرة وحدة، أول اشتراك ناجح لعضو جديد جبته",
    desc: "مكافأة فورية بتوصلك لحظة ما أول شخص تدعوه يدفع اشتراكه لأول مرة. هدفها تحفّزك تبلّش بسرعة.",
  },
  {
    icon: "🎯",
    title: "Direct Bonus — عمولة مباشرة",
    when: "على كل عضو تدعوه إنت بنفسك",
    desc: "عمولة ثابتة أو نسبة من كل عضو ينضم مباشرة تحتك بالشجرة الثنائية (مو زي عمولة المستوى 1 بمسار الإحالة البسيط — هاي جزء من نظام الشبكة).",
  },
  {
    icon: "🌳",
    title: "Binary Bonus — عمولة ثنائية",
    when: "أسبوعي/دوري، حسب توازن فريقك",
    desc: "شجرتك مقسومة لرجلين: يسار ويمين. العمولة بتنحسب على «الرجل الأضعف» (الأقل إنتاجاً)، والفائض من الرجل الأقوى بيترحّل تلقائياً للدورة الجاية (Carry Forward) بدل ما يضيع.",
  },
  {
    icon: "🔁",
    title: "Renewal Bonus — عمولة تجديد",
    when: "شهري، عند كل تجديد اشتراك بفريقك",
    desc: "دخل متكرر: كل مرة عضو بفريقك (مو بس اللي دعوتهم مباشرة) يجدّد اشتراكه الشهري، بتاخذ نسبة من قيمة التجديد.",
  },
  {
    icon: "🤝",
    title: "Matching Bonus — عمولة مطابقة",
    when: "شهري، مبني على أرباح فريقك المباشر",
    desc: "نسبة من إجمالي العمولات (Direct + Binary) يلي كسبها الأشخاص يلي رعيتهم إنت مباشرة. يعني كل ما ساعدت فريقك يكسب أكتر، إنت كمان بتكسب أكتر.",
  },
  {
    icon: "🏅",
    title: "Rank Bonus — مكافأة رتبة",
    when: "مرة وحدة، عند كل ترقية رتبة",
    desc: "مبلغ مقطوع بينصرف مرة وحدة أول ما تحقق شروط رتبة جديدة (عدد مباشرين + إجمالي CV بالفريقين).",
  },
  {
    icon: "👑",
    title: "Leadership Pool — صندوق القيادة",
    when: "شهري، توزيع من صندوق مشترك",
    desc: "نسبة من إجمالي مبيعات الأكاديمية بتتجمع بصندوق شهري، وبتنوزّع على القادة يلي وصلوا لرتب عليا حسب نقاطهم — دخل إضافي فوق كل شي فوق.",
  },
  {
    icon: "♾️",
    title: "Infinity Bonus",
    when: "شهري، لأعلى الرتب بس",
    desc: "لما توصل لأعلى رتبة، بتاخذ نسبة من إنتاج فريقك الكامل بدون حد أقصى بالعمق (يعني حتى لو الفريق كبير جداً وامتد أجيال كتير تحتك).",
  },
  {
    icon: "🏆",
    title: "Achievement Bonus — مكافأة إنجاز",
    when: "عند تحقيق أهداف/تحديات محددة",
    desc: "مكافآت إضافية بتحطها الإدارة أحياناً كتحديات موسمية أو أهداف نمو معينة (مو دخل ثابت شهري).",
  },
];

const RANKS = [
  { name: "Starter", req: "عضوان مباشران" },
  { name: "Builder", req: "10 مباشرين / 1,000 CV" },
  { name: "Leader", req: "30 عضو / 4,000 CV" },
  { name: "Executive", req: "80 عضو / 12,000 CV" },
  { name: "Diamond", req: "200 عضو / 40,000 CV" },
  { name: "Crown Ambassador", req: "500 عضو / 120,000 CV" },
];

const COMPARE_ROWS = [
  ["البنية", "3 مستويات فقط (1 ← 2 ← 3)، بلا حد أقصى بعدد الأشخاص بكل مستوى", "شجرة ثنائية (يسار / يمين) بعمق غير محدود عبر الرتب"],
  ["نوع العمولة", "نسبة % ثابتة من قيمة كل اشتراك", "9 أنواع دخل مختلفة (فوري، متكرر، جماعي، صندوق قيادة...)"],
  ["الرتب والترقيات", "لا يوجد نظام رتب", "6 رتب من Starter لـ Crown Ambassador، كل وحدة بفتح مكافآت أكبر"],
  ["الدخل المتكرر (شهري)", "نسبة من كل تجديد لمن تحت المستويات الثلاثة", "Renewal + Matching + Leadership Pool معاً"],
  ["سقف الأرباح", "لا يوجد سقف، بس محصور بـ 3 مستويات عمق", "لا يوجد سقف — وبيزيد كل ما ارتقيت برتبتك"],
  ["شرط التفعيل", "تقديم طلب انضمام والموافقة عليه (حالة «مسوّق مفعّل»)", "متاحة تلقائياً لكل عضو، وبتُبنى مع كل إحالة"],
  ["السحب", "حد أدنى بالدولار + طريقة استلام محفوظة (PayPal/Wise/بنكي)", "لازم تحقق هوية (KYC) أولاً، وحد أدنى 50 دينار"],
  ["أين تشوف أرباحك", "قسم «برنامج التسويق بالعمولة»", "قسم «الشبكة (Network)» — محافظ منفصلة: عمولات، مكافآت، كاش باك، سحب"],
];

function Segment({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "rgba(212,175,55,0.12)" : "transparent",
        border: `1px solid ${active ? GOLD : BORDER}`,
        color: active ? GOLD : "#9A9A9A",
        borderRadius: 10,
        padding: "0.5rem 1rem",
        fontSize: "0.78rem",
        fontWeight: 700,
        cursor: "pointer",
        transition,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export default function CommissionLevelsExplainer({ settings }) {
  const [track, setTrack] = useState("both"); // both | affiliate | mlm
  const levels = LEVEL_ROWS(settings);
  const showAffiliate = track === "both" || track === "affiliate";
  const showMlm = track === "both" || track === "mlm";

  return (
    <section id="commission-levels" style={{ scrollMarginTop: 90, marginBottom: "1.4rem" }}>
      <div style={card} className="qta-animate-in">
        <p style={sectionEyebrow}>ضروري تفهمه قبل ما تبلّش</p>
        <h2 style={sectionTitle}>مستويات العمولة بالتفصيل — والفرق بين المسارين</h2>
        <p style={{ color: "#9A9A9A", fontSize: "0.85rem", lineHeight: 1.9, margin: "0.6rem 0 1.3rem", maxWidth: 780 }}>
          عنا مسارين لكسب الفلوس بالأكاديمية، وكل واحد فيهم شغلته مختلفة عن التاني تماماً. تحت شرح كل مسار
          لحاله بأدق التفاصيل، وبعدها جدول مقارنة سريع يلخّصلك الفرق بينهم بلمحة وحدة.
        </p>

        {/* اختيار المسار */}
        <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <Segment active={track === "both"} onClick={() => setTrack("both")}>عرض الكل</Segment>
          <Segment active={track === "affiliate"} onClick={() => setTrack("affiliate")}>🔗 برنامج الإحالة (3 مستويات)</Segment>
          <Segment active={track === "mlm"} onClick={() => setTrack("mlm")}>🌳 الشبكة الثنائية (MLM)</Segment>
        </div>

        {/* المسار الأول: برنامج الإحالة البسيط */}
        {showAffiliate && (
          <div style={{ marginBottom: showMlm ? "2rem" : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: "1.1rem" }}>🔗</span>
              <h3 style={{ fontSize: "0.98rem", fontWeight: 800, fontFamily: displayStack, margin: 0 }}>
                المسار الأول: برنامج التسويق بالعمولة (3 مستويات)
              </h3>
            </div>
            <p style={{ color: "#9A9A9A", fontSize: "0.82rem", lineHeight: 1.8, marginBottom: "1rem" }}>
              نظام بسيط ومباشر: بتاخذ نسبة % ثابتة من قيمة اشتراك أي شخص ينضم عن طريق رابطك — وبعدين نسبة أقل
              على اللي هنن جابوهم، وهيك لغاية 3 مستويات فقط. ما في شجرة، ما في رتب، ما في تعقيد — بس نسبة واضحة
              على كل مستوى.
            </p>

            <div style={{ display: "grid", gap: "0.8rem" }}>
              {levels.map((lv) => (
                <div
                  key={lv.n}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 14,
                    padding: "1rem 1.1rem",
                    display: "flex",
                    gap: "1rem",
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      borderRadius: "50%",
                      background: "rgba(212,175,55,0.1)",
                      border: `1px solid ${GOLD}55`,
                      color: GOLD,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: monoStack,
                    }}
                  >
                    <span style={{ fontSize: "0.6rem", opacity: 0.8 }}>لفل</span>
                    <span style={{ fontSize: "1rem", fontWeight: 800, lineHeight: 1 }}>{lv.n}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                      <p style={{ fontWeight: 700, fontSize: "0.86rem", color: "#EAECEF", margin: 0 }}>{lv.title}</p>
                      <span style={{ fontFamily: monoStack, color: GOLD, fontWeight: 800, fontSize: "1rem" }}>{lv.percent}%</span>
                    </div>
                    <p style={{ color: "#9A9A9A", fontSize: "0.78rem", lineHeight: 1.7, margin: "4px 0" }}>{lv.desc}</p>
                    <p style={{ color: "#6E7177", fontSize: "0.74rem", lineHeight: 1.6, fontStyle: "italic" }}>{lv.example}</p>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: "0.9rem",
                background: "rgba(212,175,55,0.05)",
                border: `1px solid ${GOLD}33`,
                borderRadius: 12,
                padding: "0.8rem 1rem",
                fontSize: "0.78rem",
                color: "#C8C0B0",
                lineHeight: 1.8,
              }}
            >
              💡 <strong>خلاصة بسيطة:</strong> كل ما نزلت مستوى، النسبة بتقل — بس العدد يلي ممكن تكسب منه بيكبر
              (لأنه شبكة اللي تحتك بتتوسع تلقائياً بدون ما تعمل شي إنت). العمولة بتتحسب فوراً وقت الدفع، وبتضل
              «معلّقة» لحد أقرب دورة دفع قبل ما تصير جاهزة للسحب.
            </div>
          </div>
        )}

        {/* المسار الثاني: الشبكة الثنائية MLM */}
        {showMlm && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: "1.1rem" }}>🌳</span>
              <h3 style={{ fontSize: "0.98rem", fontWeight: 800, fontFamily: displayStack, margin: 0 }}>
                المسار الثاني: الشبكة الثنائية (نظام النقاط والرتب)
              </h3>
            </div>
            <p style={{ color: "#9A9A9A", fontSize: "0.82rem", lineHeight: 1.8, marginBottom: "1rem" }}>
              هون القصة مختلفة تماماً: كل عضو بينضم بيتحط بواحدة من رجلين بشجرتك — <span style={{ color: GOLD }}>يسار</span> أو{" "}
              <span style={{ color: GOLD }}>يمين</span> — بلا حد لعمق الشجرة. وبدل عمولة وحدة بسيطة، عندك <strong style={{ color: "#EAECEF" }}>9 أنواع دخل مختلفة</strong>{" "}
              بتشتغل مع بعض، وكل ما بنيت فريق أكبر وأقوى بترتقي لرتب أعلى وبتفتح مكافآت أكبر.
            </p>

            <div style={{ fontWeight: 700, marginBottom: "0.7rem", fontSize: "0.85rem", color: "#EAECEF" }}>
              أنواع الدخل التسعة — وشو الفرق بينهم
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.8rem", marginBottom: "1.4rem" }}>
              {BONUS_ITEMS.map((b) => (
                <div
                  key={b.title}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 12,
                    padding: "0.9rem 1rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: "1.05rem" }}>{b.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "#EAECEF" }}>{b.title}</span>
                  </div>
                  <p style={{ fontSize: "0.72rem", color: GOLD, marginBottom: 4, fontFamily: monoStack, letterSpacing: 0.3 }}>{b.when}</p>
                  <p style={{ fontSize: "0.76rem", color: "#9A9A9A", lineHeight: 1.7, margin: 0 }}>{b.desc}</p>
                </div>
              ))}
            </div>

            <div style={{ fontWeight: 700, marginBottom: "0.7rem", fontSize: "0.85rem", color: "#EAECEF" }}>
              مسار الرتب الست — كل رتبة بتفتحلك مكافآت أكبر
            </div>
            <div style={{ display: "flex", gap: "0.6rem", overflowX: "auto", paddingBottom: 6 }}>
              {RANKS.map((r, i) => (
                <div key={r.name} style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
                  <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${GOLD}44`, borderRadius: 10, padding: "0.7rem 1rem", textAlign: "center", minWidth: 130 }}>
                    <div style={{ fontWeight: 700, color: GOLD, fontSize: "0.82rem" }}>{r.name}</div>
                    <div style={{ fontSize: "0.68rem", color: "#888", marginTop: 2 }}>{r.req}</div>
                  </div>
                  {i < RANKS.length - 1 && <div style={{ color: "#444" }}>←</div>}
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: "1rem",
                background: "rgba(212,175,55,0.05)",
                border: `1px solid ${GOLD}33`,
                borderRadius: 12,
                padding: "0.8rem 1rem",
                fontSize: "0.78rem",
                color: "#C8C0B0",
                lineHeight: 1.8,
              }}
            >
              💡 <strong>خلاصة بسيطة:</strong> هون مو بس عمولة على اللي دعوتهم — عندك دخل من تجديد الفريق، دخل من
              نجاح فريقك، ودخل جماعي من صندوق القيادة كل ما رتبتك ارتفعت. بالمقابل، السحب من محفظة الشبكة
              بده تحقّق من الهوية (KYC) أولاً.
            </div>
          </div>
        )}

        {/* جدول المقارنة */}
        <div style={{ marginTop: "2rem" }}>
          <div style={{ fontWeight: 700, marginBottom: "0.8rem", fontSize: "0.9rem", color: "#EAECEF" }}>
            مقارنة سريعة: برنامج الإحالة مقابل الشبكة الثنائية
          </div>
          <div style={{ overflowX: "auto", borderRadius: 14, border: `1px solid ${BORDER}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", minWidth: 560 }}>
              <thead>
                <tr style={{ background: "rgba(212,175,55,0.06)" }}>
                  <th style={thStyle}>المعيار</th>
                  <th style={thStyle}>🔗 برنامج الإحالة</th>
                  <th style={thStyle}>🌳 الشبكة الثنائية</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                    {row.map((cell, j) => (
                      <td key={j} style={{ ...tdStyle, color: j === 0 ? "#EAECEF" : "#9A9A9A", fontWeight: j === 0 ? 700 : 400 }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ color: "#6E7177", fontSize: "0.72rem", marginTop: 8, lineHeight: 1.7 }}>
            ملاحظة: الأرقام والنسب هون تقريبية للتوضيح — نسب برنامج الإحالة (المستويات 1-2-3) بتتحدث تلقائياً حسب
            آخر إعدادات الأكاديمية وبتظهر فعلياً بقسم «برنامج التسويق بالعمولة» تحت.
          </p>
        </div>
      </div>
    </section>
  );
}

const thStyle = { textAlign: "right", padding: "0.7rem 0.9rem", color: "#EAECEF", fontWeight: 700, borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" };
const tdStyle = { textAlign: "right", padding: "0.65rem 0.9rem", borderBottom: `1px solid ${BORDER}`, lineHeight: 1.6 };
