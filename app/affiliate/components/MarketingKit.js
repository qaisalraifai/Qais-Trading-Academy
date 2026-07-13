"use client";
import { useEffect, useState } from "react";

const GOLD = "#D4AF37";
const CARD = "#0d0d0d";
const BORDER = "#242424";

const TYPE_LABELS = { logo: "شعار", banner: "بانر", video: "فيديو", copy: "نص جاهز" };

export default function MarketingKit() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/affiliate/marketing-kit")
      .then((r) => r.json())
      .then((json) => setAssets(json.assets || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <div style={s.card}>
      <p style={s.sectionTitle}>📦 Marketing Kit</p>
      {assets.length === 0 ? (
        <p style={s.empty}>ما في أدوات تسويقية مضافة حالياً — تابع هالقسم لاحقاً.</p>
      ) : (
        <div style={s.grid}>
          {assets.map((a) => (
            <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer" style={s.item}>
              {a.type === "banner" || a.type === "logo" ? (
                <img src={a.thumbnail_url || a.file_url} alt={a.title} style={s.thumb} />
              ) : (
                <div style={s.iconBox}>{a.type === "video" ? "🎬" : "📝"}</div>
              )}
              <p style={s.itemTitle}>{a.title}</p>
              <p style={s.itemType}>{TYPE_LABELS[a.type] || a.type}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "1.6rem", marginBottom: "1.2rem" },
  sectionTitle: { fontSize: "1rem", fontWeight: 700, color: GOLD, marginBottom: "1rem" },
  empty: { color: "#555", fontSize: "0.85rem" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.9rem" },
  item: { display: "block", background: "#080808", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "0.8rem", textDecoration: "none", textAlign: "center" },
  thumb: { width: "100%", height: 80, objectFit: "cover", borderRadius: 6, marginBottom: 8, background: "#111" },
  iconBox: { width: "100%", height: 80, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", background: "#111", borderRadius: 6, marginBottom: 8 },
  itemTitle: { fontSize: "0.78rem", color: "#F5F5F5", fontWeight: 600, marginBottom: 2 },
  itemType: { fontSize: "0.68rem", color: "#6E6E6E" },
};
