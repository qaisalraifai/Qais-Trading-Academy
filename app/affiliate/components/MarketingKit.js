"use client";
import { FileText, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const GOLD = "#DCD4F7";
const CARD = "#0A0614";
const BORDER = "#241C3E";

const TYPE_KEYS = { logo: "affiliate.typeLogo", banner: "affiliate.typeBanner", video: "affiliate.typeVideo", copy: "affiliate.typeCopy" };

export default function MarketingKit() {
  const { t } = useLocale();
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
      <p style={s.sectionTitle}>{t("affiliate.marketingKitTitle")}</p>
      {assets.length === 0 ? (
        <p style={s.empty}>{t("affiliate.marketingKitEmpty")}</p>
      ) : (
        <div style={s.grid}>
          {assets.map((a) => (
            <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer" style={s.item}>
              {a.type === "banner" || a.type === "logo" ? (
                <img src={a.thumbnail_url || a.file_url} alt={a.title} style={s.thumb} />
              ) : (
                <div style={s.iconBox}>
                  {a.type === "video"
                    ? <Video size={26} strokeWidth={1.5} color="#6E6690" aria-hidden />
                    : <FileText size={26} strokeWidth={1.5} color="#6E6690" aria-hidden />}
                </div>
              )}
              <p style={s.itemTitle}>{a.title}</p>
              <p style={s.itemType}>{TYPE_KEYS[a.type] ? t(TYPE_KEYS[a.type]) : a.type}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 0, padding: "1.6rem", marginBottom: "1.2rem" },
  sectionTitle: { fontSize: "1rem", fontWeight: 700, color: GOLD, marginBottom: "1rem" },
  empty: { color: "#4A4368", fontSize: "0.85rem" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.9rem" },
  item: { display: "block", background: "#0A0614", border: `1px solid ${BORDER}`, borderRadius: 3, padding: "0.8rem", textDecoration: "none", textAlign: "center" },
  thumb: { width: "100%", height: 80, objectFit: "cover", borderRadius: 3, marginBottom: 8, background: "#141024" },
  iconBox: { width: "100%", height: 80, display: "flex", alignItems: "center", justifyContent: "center", background: "#141024", borderRadius: 3, marginBottom: 8 },
  itemTitle: { fontSize: "0.78rem", color: "#F5F3FF", fontWeight: 600, marginBottom: 2 },
  itemType: { fontSize: "0.68rem", color: "#6E6690" },
};
