"use client";
import { Crown, GitFork, Handshake, Infinity as InfinityIcon, Medal, Repeat, Target, Zap } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const GOLD = "#DCD4F7";
const CARD = "#0A0614";
const BORDER = "#241C3E";

/* أيقونة كل نوع بونص — مربوطة بالعنوان لأنه ثابت بكل اللغات */
const BONUS_ICONS = {
  "Fast Start": Zap,
  "Direct Bonus": Target,
  "Binary Bonus": GitFork,
  "Renewal Bonus": Repeat,
  "Matching Bonus": Handshake,
  "Rank Bonus": Medal,
  "Leadership Pool": Crown,
  "Infinity Bonus": InfinityIcon,
};

export default function TreeAndCommissionsExplainer() {
  const { t, raw } = useLocale();
  const BONUS_ITEMS = raw("affiliate.bonusItems") || [];
  const RANKS = raw("affiliate.ranks") || [];

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 0, padding: "1.8rem", marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.8rem" }}>
        <div>
          <div style={{ color: GOLD, fontSize: "0.75rem", letterSpacing: 1, marginBottom: 4 }}>{t("affiliate.treeHowTitle")}</div>
          <div style={{ fontSize: "1.15rem", fontWeight: 800 }}>{t("affiliate.treeTitle")}</div>
        </div>
        <a href="/mlm" style={{ color: GOLD, fontSize: "0.85rem", textDecoration: "none", border: `1px solid #3D2F63`, borderRadius: 3, padding: "0.45rem 1rem" }}>
          {t("affiliate.treeViewLink")}
        </a>
      </div>

      {/* شرح الشجرة الثنائية ببساطة */}
      <div style={{ background: "#141024", borderRadius: 0, padding: "1.2rem 1.4rem", marginBottom: "1.5rem" }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: "0.9rem" }}>{t("affiliate.treeIdeaTitle")}</div>
        <div style={{ fontSize: "0.85rem", color: "#bbb", lineHeight: 2 }}>{t("affiliate.treeIdeaText")}</div>
      </div>

      {/* الأنواع الثمانية */}
      <div style={{ fontWeight: 700, marginBottom: "0.8rem", fontSize: "0.9rem" }}>{t("affiliate.treeEightSourcesTitle")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.8rem", marginBottom: "1.6rem" }}>
        {BONUS_ITEMS.map((b) => (
          <div key={b.title} style={{ background: "#141024", border: `1px solid ${BORDER}`, borderRadius: 3, padding: "0.9rem 1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
              {(() => {
                const BonusIcon = BONUS_ICONS[b.title];
                return BonusIcon ? <BonusIcon size={15} strokeWidth={1.75} color={GOLD} aria-hidden /> : null;
              })()}
              <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{b.title}</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#6E6690", lineHeight: 1.6 }}>{b.desc}</div>
          </div>
        ))}
      </div>

      {/* مسار الرتب */}
      <div style={{ fontWeight: 700, marginBottom: "0.8rem", fontSize: "0.9rem" }}>{t("affiliate.treeRanksTitle")}</div>
      <div style={{ display: "flex", gap: "0.6rem", overflowX: "auto", paddingBottom: 4 }}>
        {RANKS.map((r, i) => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
            <div style={{ background: "#141024", border: `1px solid #3D2F63`, borderRadius: 3, padding: "0.7rem 1rem", textAlign: "center", minWidth: 130 }}>
              <div style={{ fontWeight: 700, color: GOLD, fontSize: "0.85rem" }}>{r.name}</div>
              <div style={{ fontSize: "0.7rem", color: "#6E6690", marginTop: 2 }}>{r.req}</div>
            </div>
            {i < RANKS.length - 1 && <div style={{ color: "#4A4368" }}>←</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
