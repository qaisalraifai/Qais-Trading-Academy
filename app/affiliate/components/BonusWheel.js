"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const GOLD = "#D4AF37";
const CARD = "#0d0d0d";
const BORDER = "#2B2F36";
const SLICE_COLORS = ["#D4AF37", "#7A5F14", "#D4AF37", "#6B5010", "#D4AF37", "#7A5F14", "#4a3a08"];

export default function BonusWheel() {
  const { t } = useLocale();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const wheelRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliate/wheel");
      const json = await res.json();
      setStatus(json);
    } finally {
      setLoading(false);
    }
  }

  async function handleSpin() {
    if (spinning || !status || status.availableSpins <= 0) return;
    setError("");
    setResult(null);
    setSpinning(true);

    try {
      const res = await fetch("/api/affiliate/wheel", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t("affiliate.genericError"));

      const prizes = status.prizes || [];
      const index = Math.max(0, prizes.findIndex((p) => p.label === json.prize.label));
      const sliceAngle = 360 / prizes.length;
      const targetAngle = 360 * 6 + (360 - (index * sliceAngle + sliceAngle / 2));
      setRotation((prev) => prev - (prev % 360) + targetAngle);

      setTimeout(() => {
        setSpinning(false);
        setResult(json.prize);
        load();
      }, 3200);
    } catch (e) {
      setError(e.message);
      setSpinning(false);
    }
  }

  if (loading) return null;
  if (!status) return null;

  const prizes = status.prizes || [];
  const sliceAngle = 360 / (prizes.length || 1);

  return (
    <div style={s.card}>
      <p style={s.sectionTitle}>{t("affiliate.wheelTitle")}</p>
      <p style={s.desc}>
        {t("affiliate.wheelDesc", { perSpin: status.referralsPerSpin, count: status.referralsCount })}
        {status.availableSpins > 0 ? t("affiliate.wheelSpinsAvailable", { n: status.availableSpins }) : t("affiliate.wheelSpinsRemaining", { n: status.referralsToNextSpin })}
      </p>

      {error && <p style={s.error}>{error}</p>}

      <div style={s.wheelWrap}>
        <div style={s.pointer} />
        <div
          ref={wheelRef}
          style={{
            ...s.wheel,
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? "transform 3.2s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
          }}
        >
          {prizes.map((p, i) => (
            <div
              key={i}
              style={{
                ...s.slice,
                transform: `rotate(${i * sliceAngle}deg)`,
                background: SLICE_COLORS[i % SLICE_COLORS.length],
              }}
            >
              <span style={{ ...s.sliceLabel, transform: `rotate(${sliceAngle / 2}deg)` }}>{p.label.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSpin} disabled={spinning || status.availableSpins <= 0} style={{ ...s.btn, opacity: status.availableSpins <= 0 ? 0.4 : 1 }}>
        {spinning ? t("affiliate.wheelSpinning") : status.availableSpins > 0 ? t("affiliate.wheelSpinBtn") : t("affiliate.wheelNoSpins")}
      </button>

      {result && !spinning && (
        <div style={s.resultBox}>{t("affiliate.wheelWinMessage", { prize: result.label })}</div>
      )}
    </div>
  );
}

const s = {
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "1.6rem", marginBottom: "1.2rem", textAlign: "center" },
  sectionTitle: { fontSize: "1rem", fontWeight: 700, color: GOLD, marginBottom: "0.6rem" },
  desc: { color: "#9a9488", fontSize: "0.82rem", lineHeight: 1.6, marginBottom: "1.2rem" },
  error: { color: "#F6465D", fontSize: "0.8rem", marginBottom: "1rem" },
  wheelWrap: { position: "relative", width: 240, height: 240, margin: "0 auto 1.4rem" },
  pointer: { position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "18px solid #EAECEF", zIndex: 5 },
  wheel: { width: 240, height: 240, borderRadius: "50%", position: "relative", overflow: "hidden", border: `3px solid ${GOLD}`, boxShadow: "0 0 30px rgba(201,162,75,0.25)" },
  slice: { position: "absolute", width: "50%", height: "50%", top: 0, left: "50%", transformOrigin: "0% 100%", clipPath: "polygon(0 0, 100% 0, 0 100%)" },
  sliceLabel: { position: "absolute", top: "20%", left: "-30%", fontSize: "0.6rem", color: "#080600", fontWeight: 700, whiteSpace: "nowrap" },
  btn: { background: GOLD, color: "#080600", border: "none", padding: "0.8rem 1.8rem", borderRadius: 8, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" },
  resultBox: { marginTop: "1.2rem", background: "#1a1400", border: `1px solid ${GOLD}66`, color: GOLD, padding: "0.8rem 1rem", borderRadius: 8, fontSize: "0.88rem" },
};
