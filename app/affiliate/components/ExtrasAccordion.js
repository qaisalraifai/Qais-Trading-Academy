"use client";
import { useState } from "react";
import RecentActivity from "./RecentActivity";
import BonusWheel from "./BonusWheel";
import Badges from "./Badges";
import MarketingKit from "./MarketingKit";
import { GOLD, card, sectionTitle, sectionEyebrow, transition } from "./shared";

export default function ExtrasAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <section id="more" style={{ scrollMarginTop: 90, marginBottom: "1.4rem" }}>
      <div style={card} className="qta-animate-in">
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "right", padding: 0 }}
        >
          <p style={sectionEyebrow}>اختياري</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={sectionTitle}>أنشطة إضافية</h2>
              <p style={{ color: "#93A0B8", fontSize: "0.8rem", marginTop: 4 }}>آخر النشاطات، عجلة الحظ، وأدوات تسويقية إضافية</p>
            </div>
            <span style={{ color: GOLD, fontSize: "1.1rem", transform: open ? "rotate(180deg)" : "none", transition }}>⌄</span>
          </div>
        </button>

        {open && (
          <div style={{ marginTop: "1.3rem" }} className="qta-animate-in">
            <RecentActivity />
            <BonusWheel />
            <Badges />
            <MarketingKit />
          </div>
        )}
      </div>
    </section>
  );
}
