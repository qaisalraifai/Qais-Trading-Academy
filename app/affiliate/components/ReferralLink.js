"use client";
import { useState } from "react";
import { GOLD, BORDER, card, sectionTitle, sectionEyebrow, monoStack, btnGhost, btnPrimary, transition } from "./shared";
import QrCodeBox from "./QrCodeBox";

export default function ReferralLink({ link, clicks, code }) {
  const [copyState, setCopyState] = useState("");
  const [showQr, setShowQr] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopyState("تم النسخ ✓");
      setTimeout(() => setCopyState(""), 2000);
    });
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Qais Trading Academy", text: "انضم لأكاديمية Qais Trading عن طريق رابطي", url: link });
      } catch {
        // المستخدم ألغى المشاركة — تجاهل
      }
    } else {
      copyLink();
    }
  }

  return (
    <section id="link" style={{ scrollMarginTop: 90, marginBottom: "1.4rem" }}>
      <div style={card} className="qta-animate-in">
        <p style={sectionEyebrow}>رابطك الخاص</p>
        <h2 style={sectionTitle}>رابط الإحالة</h2>
        <p style={{ color: "#A79FC4", fontSize: "0.82rem", marginBottom: "1.2rem" }}>شاركه بأي وسيلة، وكل تسجيل يصير من خلاله بينحسب لصالحك تلقائياً.</p>

        <div
          style={{
            display: "flex",
            gap: "1.4rem",
            flexWrap: "wrap",
            alignItems: "stretch",
          }}
        >
          <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${BORDER}`,
                borderRadius: 0,
                padding: "0.9rem 1.1rem",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontFamily: monoStack, fontSize: "0.85rem", color: "#A79FC4", direction: "ltr", flex: 1, wordBreak: "break-all" }}>
                {link}
              </span>
              <button onClick={copyLink} style={btnGhost}>{copyState || "نسخ"}</button>
            </div>

            <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
              <button onClick={shareLink} style={btnPrimary}>مشاركة سريعة</button>
              <button
                onClick={() => setShowQr((v) => !v)}
                style={btnGhost}
              >
                {showQr ? "إخفاء QR" : "عرض QR Code"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent("انضم لأكاديمية Qais Trading عن طريق رابطي\n" + link)}`}
                target="_blank"
                rel="noreferrer"
                style={{ ...btnGhost, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                واتساب
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("انضم لأكاديمية Qais Trading")}`}
                target="_blank"
                rel="noreferrer"
                style={{ ...btnGhost, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                تيليجرام
              </a>
            </div>

            <div
              style={{
                display: "flex",
                gap: "1.5rem",
                marginTop: "0.4rem",
                paddingTop: "0.9rem",
                borderTop: `1px solid ${BORDER}`,
              }}
            >
              <div>
                <p style={{ color: "#6E6690", fontSize: "0.7rem", marginBottom: 4 }}>كود الإحالة</p>
                <p style={{ color: GOLD, fontFamily: monoStack, fontWeight: 700, fontSize: "0.85rem" }}>{code || "—"}</p>
              </div>
              <div>
                <p style={{ color: "#6E6690", fontSize: "0.7rem", marginBottom: 4 }}>عدد مرات الضغط على الرابط</p>
                <p style={{ color: "#F5F3FF", fontFamily: monoStack, fontWeight: 700, fontSize: "0.85rem" }}>{clicks ?? 0}</p>
              </div>
            </div>
          </div>

          {showQr && <QrCodeBox value={link} size={180} filename="qta-referral-qr.png" />}
        </div>
      </div>
    </section>
  );
}
