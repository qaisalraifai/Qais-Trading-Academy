"use client";

const GOLD = "#D4AF37";
const CARD = "#0d0d0d";
const BORDER = "#242424";

const BONUS_ITEMS = [
  { icon: "⚡", title: "Fast Start", desc: "مكافأة فورية عند أول اشتراك ناجح" },
  { icon: "🎯", title: "Direct Bonus", desc: "عمولة مباشرة عن كل عضو تدعوه بنفسك" },
  { icon: "🌳", title: "Binary Bonus", desc: "عمولة على الرجل الأضعف بشجرتك، مع ترحيل الفائض تلقائيًا" },
  { icon: "🔁", title: "Renewal Bonus", desc: "دخل متكرر من كل تجديد شهري لفريقك" },
  { icon: "🤝", title: "Matching Bonus", desc: "نسبة من أرباح الأشخاص يلي رعيتهم مباشرة" },
  { icon: "🏅", title: "Rank Bonus", desc: "مكافأة تُدفع مرة عند كل ترقية رتبة" },
  { icon: "👑", title: "Leadership Pool", desc: "توزيع شهري من صندوق القيادة على القادة المؤهلين" },
  { icon: "♾️", title: "Infinity Bonus", desc: "لأعلى رتبة — نسبة من إنتاج فريقك الكامل بلا حد" },
];

const RANKS = [
  { name: "Starter", req: "عضوان مباشران" },
  { name: "Builder", req: "10 مباشرين / 1,000 CV" },
  { name: "Leader", req: "30 عضو / 4,000 CV" },
  { name: "Executive", req: "80 عضو / 12,000 CV" },
  { name: "Diamond", req: "200 عضو / 40,000 CV" },
  { name: "Crown Ambassador", req: "500 عضو / 120,000 CV" },
];

export default function TreeAndCommissionsExplainer() {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "1.8rem", marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.8rem" }}>
        <div>
          <div style={{ color: GOLD, fontSize: "0.75rem", letterSpacing: 1, marginBottom: 4 }}>كيف تكسب فلوسك؟</div>
          <div style={{ fontSize: "1.15rem", fontWeight: 800 }}>🌳 الشجرة الثنائية ونظام العمولات</div>
        </div>
        <a href="/mlm" style={{ color: GOLD, fontSize: "0.85rem", textDecoration: "none", border: `1px solid ${GOLD}55`, borderRadius: 8, padding: "0.45rem 1rem" }}>
          شوف شجرتك ومحافظك الحقيقية ←
        </a>
      </div>

      {/* شرح الشجرة الثنائية ببساطة */}
      <div style={{ background: "#141414", borderRadius: 12, padding: "1.2rem 1.4rem", marginBottom: "1.5rem" }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: "0.9rem" }}>الفكرة بكلمتين</div>
        <div style={{ fontSize: "0.85rem", color: "#bbb", lineHeight: 2 }}>
          كل عضو بينضم تحتك بينحط بواحدة من رجلين — <span style={{ color: GOLD }}>يسار</span> أو <span style={{ color: GOLD }}>يمين</span>.
          لما توصل دعوة مباشرة منك لعضو، وبنفس الوقت تبني فريق قوي بالرجلين، بتكسب أنواع عمولات مختلفة تلقائيًا —
          من أول لحظة اشتراك، ولحد الترقيات الكبيرة والدخل الشهري المتكرر.
        </div>
      </div>

      {/* الأنواع الثمانية */}
      <div style={{ fontWeight: 700, marginBottom: "0.8rem", fontSize: "0.9rem" }}>مصادر دخلك الثمانية</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.8rem", marginBottom: "1.6rem" }}>
        {BONUS_ITEMS.map((b) => (
          <div key={b.title} style={{ background: "#141414", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "0.9rem 1rem" }}>
            <div style={{ fontSize: "1.1rem", marginBottom: 4 }}>{b.icon} <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{b.title}</span></div>
            <div style={{ fontSize: "0.75rem", color: "#888", lineHeight: 1.6 }}>{b.desc}</div>
          </div>
        ))}
      </div>

      {/* مسار الرتب */}
      <div style={{ fontWeight: 700, marginBottom: "0.8rem", fontSize: "0.9rem" }}>مسار الرتب الست</div>
      <div style={{ display: "flex", gap: "0.6rem", overflowX: "auto", paddingBottom: 4 }}>
        {RANKS.map((r, i) => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
            <div style={{ background: "#141414", border: `1px solid ${GOLD}44`, borderRadius: 10, padding: "0.7rem 1rem", textAlign: "center", minWidth: 130 }}>
              <div style={{ fontWeight: 700, color: GOLD, fontSize: "0.85rem" }}>{r.name}</div>
              <div style={{ fontSize: "0.7rem", color: "#888", marginTop: 2 }}>{r.req}</div>
            </div>
            {i < RANKS.length - 1 && <div style={{ color: "#444" }}>←</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
