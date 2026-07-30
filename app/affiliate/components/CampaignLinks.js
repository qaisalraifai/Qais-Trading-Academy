"use client";
import { useEffect, useState } from "react";
import QrCodeBox from "./QrCodeBox";
import { GOLD, BORDER, card, sectionTitle, sectionEyebrow, monoStack, btnGhost, btnPrimary } from "./shared";

export default function CampaignLinks({ affiliateCode, siteOrigin }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openQrId, setOpenQrId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/affiliate/campaign-links");
      const json = await res.json();
      if (res.ok) setLinks(json.links || []);
    } finally {
      setLoading(false);
    }
  }

  async function createLink() {
    if (!slug.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/affiliate/campaign-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, label }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "حدث خطأ");
      setLinks((prev) => [json.link, ...prev]);
      setSlug("");
      setLabel("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteLink(id) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/affiliate/campaign-links?id=${id}`, { method: "DELETE" }).catch(() => {});
  }

  function linkFor(l) {
    return `${siteOrigin}/r/${affiliateCode}?c=${l.slug}`;
  }

  function copy(l) {
    navigator.clipboard.writeText(linkFor(l)).then(() => {
      setCopiedId(l.id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  }

  if (loading) return null;

  return (
    <section id="campaigns" style={{ scrollMarginTop: 90, marginBottom: "1.4rem" }}>
      <div style={card} className="qta-animate-in">
        <p style={sectionEyebrow}>أدوات تسويق متقدّمة</p>
        <h2 style={sectionTitle}>روابط حملات مخصّصة</h2>
        <p style={{ color: "#9A9A9A", fontSize: "0.82rem", margin: "0.5rem 0 1.2rem", lineHeight: 1.8 }}>
          سوّي رابط منفصل لكل قناة (إنستغرام، تيك توك، واتساب...) وتابع أداء كل واحد لحاله —
          نفس عمولتك، بس بتعرف بالضبط منين جايينك العملاء.
        </p>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1.3rem" }}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="اسم داخلي (مثلاً: حملة إنستغرام)"
            style={s.input}
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="اسم الرابط (أحرف إنجليزية، مثلاً: insta)"
            style={{ ...s.input, direction: "ltr", textAlign: "left", maxWidth: 220 }}
          />
          <button onClick={createLink} disabled={saving || !slug.trim()} style={btnPrimary}>
            {saving ? "جاري الإنشاء..." : "+ إنشاء رابط"}
          </button>
        </div>
        {error && <p style={{ color: "#F6465D", fontSize: "0.78rem", marginBottom: "1rem" }}>{error}</p>}

        {links.length === 0 ? (
          <p style={{ color: "#6E7177", fontSize: "0.82rem" }}>ما سويت أي رابط حملة لسا.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
            {links.map((l) => (
              <div key={l.id} style={s.row}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontWeight: 700, fontSize: "0.85rem", color: "#EAECEF", marginBottom: 3 }}>
                    {l.label || l.slug}
                  </p>
                  <p style={{ fontFamily: monoStack, fontSize: "0.75rem", color: "#8A8580", direction: "ltr", textAlign: "left" }}>
                    {linkFor(l)}
                  </p>
                </div>
                <div style={s.statsBox}>
                  <div style={s.stat}>
                    <span style={{ color: GOLD, fontWeight: 800 }}>{l.clicks}</span>
                    <span style={s.statLabel}>نقرة</span>
                  </div>
                  <div style={s.stat}>
                    <span style={{ color: "#4CAF50", fontWeight: 800 }}>{l.conversions}</span>
                    <span style={s.statLabel}>تسجيل</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button onClick={() => copy(l)} style={{ ...btnGhost, fontSize: "0.72rem", padding: "0.5rem 0.8rem" }}>
                    {copiedId === l.id ? "تم النسخ ✓" : "نسخ"}
                  </button>
                  <button
                    onClick={() => setOpenQrId(openQrId === l.id ? null : l.id)}
                    style={{ ...btnGhost, fontSize: "0.72rem", padding: "0.5rem 0.8rem" }}
                  >
                    QR
                  </button>
                  <button
                    onClick={() => deleteLink(l.id)}
                    style={{ ...btnGhost, fontSize: "0.72rem", padding: "0.5rem 0.8rem", borderColor: "#F6465D55", color: "#F6465D" }}
                  >
                    حذف
                  </button>
                </div>
                {openQrId === l.id && (
                  <div style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: "0.6rem" }}>
                    <QrCodeBox value={linkFor(l)} size={150} filename={`qta-${l.slug}-qr.png`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const s = {
  input: {
    flex: 1,
    minWidth: 160,
    background: "rgba(255,255,255,0.03)",
    border: `1px solid ${BORDER}`,
    color: "#EAECEF",
    padding: "0.7rem 1rem",
    borderRadius: 8,
    fontSize: "0.82rem",
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.9rem",
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: "0.9rem 1.1rem",
    background: "rgba(255,255,255,0.015)",
  },
  statsBox: { display: "flex", gap: "1.1rem" },
  stat: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 46 },
  statLabel: { fontSize: "0.65rem", color: "#6E7177", marginTop: 2 },
};
